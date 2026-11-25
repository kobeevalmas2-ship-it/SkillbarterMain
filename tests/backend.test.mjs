import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, emptyState, filterSnapshot, initializeState } from "../lib/server/domain.mjs";
import { balanceFor, readLedger, WALLET_KEY } from "../lib/wallet.mjs";
import { readActivity } from "../lib/requests.mjs";
import { readSupport } from "../lib/support.mjs";
import { readAvailability } from "../lib/availability.mjs";
import { updateState } from "../lib/server/store.mjs";

const now = "2026-12-01T08:00:00.000Z";
const alice = { id: "alice-id", email: "alice@example.com", name: "Алиса", role: "user", verified: true };
const bob = { id: "bob-id", email: "bob@example.com", name: "Боб", role: "user", verified: true };
const other = { id: "other-id", email: "other@example.com", name: "Другой участник", role: "user", verified: true };
const admin = { id: "support-id", email: "support@example.com", name: "Поддержка", role: "admin", verified: true };
const people = [alice, bob, other, admin];
const offer = { t: "Разбор JavaScript", d: "Помогу разобраться с задачами JavaScript.",
  cat: "Разработка", f: "Онлайн", l: "Начинающий", m1: 30, m2: 120 };
const act = (state, actor, action, values = {}, id) => applyAction(state, actor, { action, values, id }, people, now);

function initial() {
  return people.reduce((state, person) => initializeState(state, person, people, now), emptyState());
}

function conversations() {
  let state = act(initial(), bob, "offer.add", offer, "offer-bob");
  state = act(state, alice, "request.create", { offerId: "offer-bob", minutes: 60,
    scheduledAt: "2027-01-01T10:00:00.000Z", message: "Личное сообщение Алисы" }, "request-alice");
  state = act(state, other, "request.create", { offerId: "offer-bob", minutes: 60,
    scheduledAt: "2027-01-02T10:00:00.000Z", message: "Личное сообщение другого участника" }, "request-other");
  state = act(state, alice, "support.create", { requestId: "request-alice", text: "Нужна помощь с первой заявкой." }, "support-alice");
  state = act(state, other, "support.create", { requestId: "request-other", text: "Закрытое обращение другого участника." }, "support-other");
  state = act(state, alice, "favorite.set", { selected: true }, "offer-bob");
  return act(state, other, "favorite.set", { selected: true }, "offer-bob");
}

test("server commands require an actor and reject unknown operations without modifying state", () => {
  const state = initial();
  const before = JSON.stringify(state);
  assert.throws(() => act(state, null, "wallet.transfer", { to: bob.email, minutes: 30 }, "transfer-1"),
    (error) => error.status === 401);
  assert.throws(() => act(state, alice, "replace-ledger", { ledger: { balance: 999999 } }), /Неизвестная операция/);
  assert.throws(() => applyAction(state, alice, { action: "wallet.transfer", values: [] }, people, now), /Некорректный запрос/);
  assert.equal(JSON.stringify(state), before);
});

test("the server chooses the sender and grants welcome minutes once across retries", () => {
  const values = { from: other.email, to: bob.email, minutes: 60, note: "Занятие", role: "admin", balance: 99999 };
  let state = act(initial(), alice, "wallet.transfer", values, "transfer-1");
  state = act(state, alice, "wallet.transfer", values, "transfer-2");
  assert.equal(balanceFor(state.ledger, alice.email), 0);
  assert.equal(balanceFor(state.ledger, bob.email), 240);
  assert.equal(balanceFor(state.ledger, other.email), 120);
  const retried = act(state, alice, "wallet.transfer", values, "transfer-1");
  assert.deepEqual(retried.ledger, state.ledger);
  assert.equal(retried.ledger.transactions.filter((item) => item.id === `welcome:${alice.email}`).length, 1);
  assert.throws(() => act(state, alice, "wallet.transfer", { ...values, minutes: 30 }, "transfer-1"), /номер операции уже использован/);
});

test("clients cannot transfer to invented accounts or use reserved system operation IDs", () => {
  const state = initial();
  assert.throws(() => act(state, alice, "wallet.transfer", { to: "invented@example.com", minutes: 30 }, "transfer-1"), /не найден/);
  assert.throws(() => act(state, alice, "wallet.transfer", { to: bob.email, minutes: 30 }, `welcome:${alice.email}`), /номер операции/);
  assert.throws(() => act(state, alice, "wallet.transfer", { to: bob.email, minutes: 30, type: "bonus" }, "transfer-1"), /Неизвестный тип/);
});

test("a manual service payment preserves the wallet form's service type without a catalog offer", () => {
  const state = act(initial(), alice, "wallet.transfer", { to: bob.email, minutes: 30,
    note: "Помощь с задачей", type: "service" }, "manual-service");
  const payment = state.ledger.transactions.find((item) => item.id === "manual-service");
  assert.equal(payment.type, "service");
  assert.equal(payment.offerId, undefined);
  assert.equal(balanceFor(state.ledger, alice.email), 90);
  assert.equal(balanceFor(state.ledger, bob.email), 150);
});

test("offer and favorite ownership comes from the verified actor", () => {
  let state = act(initial(), alice, "offer.add", { ...offer, email: bob.email, n: bob.name }, "offer-1");
  assert.equal(state.catalog.offers[0].email, alice.email);
  assert.equal(state.catalog.offers[0].n, alice.name);
  assert.throws(() => act(state, bob, "offer.update", offer, "offer-1"), /только свои услуги/);
  state = act(state, bob, "favorite.set", { selected: true, email: other.email }, "offer-1");
  assert.deepEqual(state.catalog.favorites, { [bob.email]: ["offer-1"] });
});

test("snapshots hide other people's transactions, chats, support cases, and favorites", () => {
  let state = conversations();
  state = act(state, other, "wallet.transfer", { to: bob.email, minutes: 30, note: "Секретная операция" }, "private-transfer");
  const snapshot = filterSnapshot(state, alice, people);
  assert.deepEqual(snapshot.ledger.accounts.map((item) => item.email), [alice.email]);
  assert.ok(snapshot.ledger.transactions.every((item) => item.from === alice.email || item.to === alice.email));
  assert.deepEqual(snapshot.ledger.activity.requests.map((item) => item.id), ["request-alice"]);
  assert.ok(snapshot.ledger.activity.messages.every((item) => item.requestId === "request-alice"));
  assert.ok(snapshot.ledger.activity.notifications.every((item) => item.recipient === alice.email));
  assert.deepEqual(snapshot.ledger.support.cases.map((item) => item.id), ["support-alice"]);
  assert.ok(snapshot.ledger.support.messages.every((item) => item.caseId === "support-alice"));
  assert.deepEqual(snapshot.ledger.support.audit, []);
  assert.deepEqual(snapshot.catalog.favorites, { [alice.email]: ["offer-bob"] });
  assert.equal(JSON.stringify(snapshot).includes("Личное сообщение другого участника"), false);
  assert.equal(JSON.stringify(snapshot).includes("Секретная операция"), false);
  readLedger({ getItem: (key) => key === WALLET_KEY ? JSON.stringify(snapshot.ledger) : null });
  readActivity(snapshot.ledger);
  readSupport(snapshot.ledger);
  readAvailability(snapshot.ledger);
});

test("anonymous snapshots expose the catalog without private account or conversation data", () => {
  const snapshot = filterSnapshot(conversations(), null, people);
  assert.equal(snapshot.catalog.offers.length, 1);
  assert.deepEqual(snapshot.catalog.favorites, {});
  assert.deepEqual(snapshot.participants, []);
  assert.deepEqual(snapshot.ledger.accounts, []);
  assert.deepEqual(snapshot.ledger.transactions, []);
  assert.deepEqual(snapshot.ledger.activity.requests, []);
  assert.deepEqual(snapshot.ledger.activity.messages, []);
  assert.deepEqual(snapshot.ledger.activity.notifications, []);
  assert.deepEqual(snapshot.ledger.support.cases, []);
  assert.deepEqual(snapshot.ledger.support.messages, []);
});

test("guessing a request or support ID does not grant access", () => {
  const state = conversations();
  assert.throws(() => act(state, other, "request.message", { text: "Попытка прочитать чат", messageId: "attack-message" }, "request-alice"), /недоступна/);
  assert.throws(() => act(state, other, "request.status", { status: "cancelled" }, "request-alice"), /недоступна/);
  assert.throws(() => act(state, other, "support.message", { text: "В чужое обращение", messageId: "attack-message" }, "support-alice"), /недоступно/);
});

test("admin commands ignore role claims in the request body and allow trusted administrators", () => {
  const state = initial();
  const values = { from: alice.email, to: bob.email, minutes: 30, reason: "Корректировка по решению поддержки",
    role: "admin", actor: admin };
  assert.throws(() => act(state, alice, "admin.transfer", values, "admin-transfer"), /администратору/);
  const result = act(state, admin, "admin.transfer", values, "admin-transfer");
  assert.equal(balanceFor(result.ledger, alice.email), 90);
  assert.equal(result.ledger.transactions[0].adminEmail, admin.email);
  assert.equal(filterSnapshot(result, admin, people).ledger.support.audit.length, 1);
  assert.equal(filterSnapshot(result, alice, people).ledger.support.audit.length, 0);
});

test("completed request confirmations remain idempotent in the server dispatcher", () => {
  let state = conversations();
  state = act(state, bob, "request.status", { status: "accepted" }, "request-alice");
  state = act(state, bob, "request.status", { status: "in_progress" }, "request-alice");
  state = act(state, bob, "request.status", { status: "awaiting_confirmation" }, "request-alice");
  state = act(state, alice, "request.status", { status: "completed" }, "request-alice");
  const retried = act(state, alice, "request.status", { status: "completed" }, "request-alice");
  assert.deepEqual(retried.ledger, state.ledger);
  assert.equal(retried.ledger.transactions.filter((item) => item.id === "request:request-alice").length, 1);
});

test("a changed Auth email cannot grant another welcome bonus or inherit a previous UID's balance", () => {
  const state = initial();
  const changed = { ...alice, email: "alice-new@example.com" };
  const changedPeople = people.map((person) => person.id === alice.id ? changed : person);
  assert.throws(() => initializeState(state, changed, changedPeople, now), (error) => error.status === 409);
  const replacement = { ...alice, id: "new-owner-uid" };
  const replacementPeople = people.map((person) => person.id === alice.id ? replacement : person);
  assert.throws(() => initializeState(state, replacement, replacementPeople, now), (error) => error.status === 409);
  assert.equal(balanceFor(state.ledger, alice.email), 120);
  assert.equal(balanceFor(state.ledger, changed.email), 0);
  assert.equal(state.ledger.transactions.length, people.length);
});

test("demotion removes admin powers while preserving readable historical corrections", () => {
  const corrected = act(initial(), admin, "admin.transfer", { from: alice.email, to: bob.email,
    minutes: 30, reason: "Исправление по обращению клиента" }, "admin-correction");
  const formerAdmin = { ...admin, role: "user" };
  const currentPeople = people.map((person) => person.id === admin.id ? formerAdmin : person);
  const state = initializeState(corrected, formerAdmin, currentPeople, now);
  assert.ok(state.ledger.adminEmails.includes(admin.email));
  readLedger({ getItem: () => JSON.stringify(state.ledger) });
  readSupport(state.ledger);
  assert.throws(() => applyAction(state, formerAdmin, { action: "admin.transfer", id: "forbidden-correction",
    values: { from: alice.email, to: bob.email, minutes: 30, reason: "Повторная попытка после снятия роли" } }, currentPeople, now), /администратору/);
  assert.deepEqual(filterSnapshot(state, formerAdmin, currentPeople).ledger.support.audit, []);
});

function fakeDatabase(state = initial()) {
  let record = { revision: 0, state: structuredClone(state) };
  let conflicts = 0;
  let writes = 0;
  const client = {
    from(table) {
      if (table === "profiles") return { select: () => ({ order: () => ({
        range: async (from, to) => ({ data: structuredClone(people.slice(from, to + 1)), error: null }),
      }) }) };
      assert.equal(table, "application_state");
      return { select: () => ({ eq: () => ({ single: async () => ({ data: structuredClone(record), error: null }) }) }) };
    },
    async rpc(name, { p_revision, p_state }) {
      assert.equal(name, "skillbarter_commit_state");
      if (p_revision !== record.revision) {
        conflicts++;
        return { data: false, error: null };
      }
      record = { revision: record.revision + 1, state: structuredClone(p_state) };
      writes++;
      return { data: true, error: null };
    },
  };
  return { client, state: () => record.state, conflicts: () => conflicts, writes: () => writes };
}

test("concurrent server transfers recheck the latest balance instead of overspending or losing a write", async () => {
  const database = fakeDatabase();
  const outcomes = await Promise.allSettled([
    updateState(alice, { action: "wallet.transfer", id: "race-bob", values: { to: bob.email, minutes: 80 } }, database.client),
    updateState(alice, { action: "wallet.transfer", id: "race-other", values: { to: other.email, minutes: 80 } }, database.client),
  ]);
  assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
  const rejection = outcomes.find((result) => result.status === "rejected");
  assert.match(rejection.reason.message, /Недостаточно минут/);
  assert.equal(database.conflicts(), 1);
  assert.equal(database.writes(), 1);
  assert.equal(balanceFor(database.state().ledger, alice.email), 40);
  assert.equal(database.state().ledger.transactions.filter((transaction) => transaction.type === "transfer").length, 1);
});

test("concurrent independent changes survive a stale revision retry without overwriting each other", async () => {
  const database = fakeDatabase();
  await Promise.all([
    updateState(alice, { action: "wallet.transfer", id: "parallel-alice", values: { to: bob.email, minutes: 20 } }, database.client),
    updateState(other, { action: "wallet.transfer", id: "parallel-other", values: { to: bob.email, minutes: 30 } }, database.client),
  ]);
  assert.equal(database.conflicts(), 1);
  assert.equal(database.writes(), 2);
  assert.equal(balanceFor(database.state().ledger, alice.email), 100);
  assert.equal(balanceFor(database.state().ledger, other.email), 90);
  assert.equal(balanceFor(database.state().ledger, bob.email), 170);
  assert.equal(database.state().ledger.transactions.filter((transaction) => transaction.type === "transfer").length, 2);
});
