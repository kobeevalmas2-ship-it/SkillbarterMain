import test from "node:test";
import assert from "node:assert/strict";
import { balanceFor, createTransfer, emptyLedger, ensureAccount, historyFor, readLedger, WALLET_KEY } from "../lib/wallet.mjs";

const alice = { name: "Алиса", email: "alice@example.com" };
const bob = { name: "Боб", email: "bob@example.com" };
const outsider = { name: "Другой участник", email: "other@example.com" };
const operation = { id: "transfer-1", from: alice.email, to: bob.email, minutes: 60, note: "За помощь с Java" };
const initial = () => ensureAccount(ensureAccount(emptyLedger(), alice), bob);

test("120 welcome minutes are granted once per account, including after reload", () => {
  const ledger = ensureAccount(emptyLedger(), { ...alice, email: " ALICE@EXAMPLE.COM " });
  assert.equal(balanceFor(ledger, alice.email), 120);
  assert.equal(ledger.transactions.length, 1);
  const reloaded = JSON.parse(JSON.stringify(ledger));
  assert.deepEqual(ensureAccount(reloaded, alice), reloaded);
  assert.equal(balanceFor(reloaded, bob.email), 0);
});

test("a service payment debits sender and credits recipient with one shared operation", () => {
  const original = initial();
  const ledger = createTransfer(original, { ...operation, type: "service" });
  assert.equal(balanceFor(ledger, alice.email), 60);
  assert.equal(balanceFor(ledger, bob.email), 180);
  assert.equal(balanceFor(ledger, alice.email) + balanceFor(ledger, bob.email), 240);
  assert.equal(historyFor(ledger, alice.email)[0].id, historyFor(ledger, bob.email)[0].id);
  assert.equal(historyFor(ledger, alice.email)[0].type, "service");
  assert.equal(historyFor(ledger, outsider.email).length, 0);
  assert.equal(balanceFor(original, alice.email), 120);
});

test("retrying the same operation never charges twice, even after spending the remainder", () => {
  const paid = createTransfer(initial(), operation);
  const empty = createTransfer(paid, { ...operation, id: "transfer-2" });
  assert.equal(balanceFor(empty, alice.email), 0);
  const retried = createTransfer(empty, operation);
  assert.equal(retried, empty);
  assert.equal(historyFor(retried, alice.email).length, 3);
});

test("an operation ID cannot be reused for different payment details", () => {
  const ledger = createTransfer(initial(), operation);
  assert.throws(() => createTransfer(ledger, { ...operation, minutes: 30 }), /номер операции уже использован/);
});

test("invalid amounts cannot change balances or history", () => {
  const ledger = initial();
  for (const minutes of [0, -30, 1.5, NaN, Infinity, "60", Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => createTransfer(ledger, { ...operation, minutes }), /целое количество/);
  }
  assert.equal(ledger.transactions.length, 2);
  assert.equal(balanceFor(ledger, alice.email), 120);
});

test("insufficient funds and successive payments cannot overdraw the wallet", () => {
  const ledger = createTransfer(initial(), { ...operation, minutes: 90 });
  assert.throws(() => createTransfer(ledger, { ...operation, id: "transfer-2", minutes: 60 }), /Недостаточно минут/);
  assert.equal(balanceFor(ledger, alice.email), 30);
  assert.equal(balanceFor(ledger, bob.email), 210);
});

test("self-transfers, unknown participants and invalid transaction types are rejected", () => {
  const ledger = initial();
  assert.throws(() => createTransfer(ledger, { ...operation, to: " ALICE@example.com " }), /самому себе/);
  assert.throws(() => createTransfer(ledger, { ...operation, to: outsider.email }), /не найден/);
  assert.throws(() => createTransfer(ledger, { ...operation, from: outsider.email }), /Войдите/);
  assert.throws(() => createTransfer(ledger, { ...operation, type: "bonus" }), /Неизвестный тип/);
  assert.throws(() => createTransfer(ledger, { ...operation, note: "a".repeat(201) }), /200 символов/);
});

test("a reverse transfer appears in each participant's own history", () => {
  const ledger = createTransfer(createTransfer(initial(), operation), {
    id: "return-1", from: bob.email, to: alice.email, minutes: 30,
  });
  assert.equal(balanceFor(ledger, alice.email), 90);
  assert.equal(balanceFor(ledger, bob.email), 150);
  assert.equal(historyFor(ledger, alice.email)[0].to, alice.email);
  assert.equal(historyFor(ledger, bob.email)[0].from, bob.email);
  assert.equal(historyFor(ledger, alice.email).filter((tx) => tx.type === "bonus").length, 1);
});

test("persisted history and balances survive a new storage read", () => {
  const saved = JSON.stringify(createTransfer(initial(), operation));
  const storage = { getItem: (key) => key === WALLET_KEY ? saved : null };
  const restored = readLedger(storage);
  assert.equal(balanceFor(restored, alice.email), 60);
  assert.equal(balanceFor(restored, bob.email), 180);
  assert.equal(historyFor(restored, alice.email)[0].note, operation.note);
  assert.deepEqual(readLedger({ getItem: () => null }), emptyLedger());
});

test("corrupt or unsupported saved data is reported instead of resetting funds", () => {
  for (const raw of ["{broken", "null", JSON.stringify({ version: 2, accounts: [], transactions: [] }),
    JSON.stringify({ version: 1, accounts: [], transactions: [{}] })]) {
    assert.throws(() => readLedger({ getItem: () => raw }), /Сохранённые данные не изменены/);
  }
});
