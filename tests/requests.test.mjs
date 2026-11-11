import test from "node:test";
import assert from "node:assert/strict";
import { balanceFor, createTransfer, emptyLedger, ensureAccount, readLedger, WALLET_KEY } from "../lib/wallet.mjs";
import {
  REQUEST_STATUS_LABELS, addRequestMessage, allowedRequestActions, availableBalanceFor,
  createRequest, emptyActivity, markAllNotificationsRead, markNotificationRead,
  markRequestRead, readActivity, reservedFor, transitionRequest,
} from "../lib/requests.mjs";

const customer = { name: "Алия", email: "aliya@example.com" };
const provider = { name: "Данияр", email: "daniyar@example.com" };
const outsider = { name: "Другой участник", email: "other@example.com" };
const secondProvider = { name: "Другой автор", email: "teacher@example.com" };
const createdAt = "2026-11-11T10:00:00.000Z";
const scheduledAt = "2026-11-12T10:00:00.000Z";
const offer = { id: "javascript-help", email: provider.email, n: provider.name,
  t: "Практика JavaScript", cat: "Разработка", m1: 30, m2: 120 };
const values = { minutes: 60, scheduledAt };
const initial = () => [customer, provider, outsider, secondProvider]
  .reduce((ledger, person) => ensureAccount(ledger, person, createdAt), emptyLedger());
const request = (ledger, id = "request-1") => readActivity(ledger).requests.find((item) => item.id === id);
const pending = (minutes = 60) => createRequest(initial(), customer, offer, { ...values, minutes }, "request-1", createdAt);
const accepted = (minutes = 60) => transitionRequest(pending(minutes), provider, "request-1", "accepted", createdAt);

test("a request preserves the service agreement without charging before completion", () => {
  const original = initial();
  const serialized = JSON.stringify(original);
  const ledger = createRequest(original, customer, offer, { ...values, message: "Хочу разобрать замыкания." }, "request-1", createdAt);
  const item = request(ledger);
  assert.equal(item.status, "pending");
  assert.equal(item.title, offer.t);
  assert.equal(item.offerId, offer.id);
  assert.equal(item.customer.email, customer.email);
  assert.equal(item.provider.email, provider.email);
  assert.equal(item.minutes, 60);
  assert.equal(new Date(item.scheduledAt).toISOString(), scheduledAt);
  assert.equal(balanceFor(ledger, customer.email), 120);
  assert.equal(reservedFor(ledger, customer.email), 0);
  assert.equal(availableBalanceFor(ledger, customer.email), 120);
  assert.ok(readActivity(ledger).messages.some((message) => message.requestId === item.id && message.text === "Хочу разобрать замыкания." && message.authorEmail === customer.email));
  assert.ok(readActivity(ledger).notifications.some((notice) => notice.recipient === provider.email && notice.requestId === item.id && !notice.readAt));
  assert.equal(JSON.stringify(original), serialized, "creating a request must not mutate the earlier snapshot");
});

test("acceptance reserves minutes, and only the customer can confirm one completed payment", () => {
  let ledger = accepted();
  assert.equal(request(ledger).status, "accepted");
  assert.equal(reservedFor(ledger, customer.email), 60);
  assert.equal(availableBalanceFor(ledger, customer.email), 60);
  assert.equal(balanceFor(ledger, customer.email), 120);
  ledger = transitionRequest(ledger, provider, "request-1", "in_progress", scheduledAt);
  ledger = transitionRequest(ledger, provider, "request-1", "awaiting_confirmation", "2026-11-12T11:00:00.000Z");
  assert.equal(reservedFor(ledger, customer.email), 60);
  assert.throws(() => transitionRequest(ledger, provider, "request-1", "completed", "2026-11-12T11:01:00.000Z"));
  ledger = transitionRequest(ledger, customer, "request-1", "completed", "2026-11-12T11:05:00.000Z");
  assert.equal(request(ledger).status, "completed");
  assert.equal(balanceFor(ledger, customer.email), 60);
  assert.equal(balanceFor(ledger, provider.email), 180);
  assert.equal(reservedFor(ledger, customer.email), 0);
  assert.equal(availableBalanceFor(ledger, customer.email), 60);
  const payment = ledger.transactions.filter((tx) => tx.id === "request:request-1");
  assert.equal(payment.length, 1);
  assert.equal(payment[0].offerId, offer.id);
  assert.equal(payment[0].type, "service");
  assert.deepEqual(request(ledger).history.map((event) => event.status), ["pending", "accepted", "in_progress", "awaiting_confirmation", "completed"]);
  try { ledger = transitionRequest(ledger, customer, "request-1", "completed", "2026-11-12T11:06:00.000Z"); }
  catch { /* Rejecting a repeated terminal action is also safe. */ }
  assert.equal(balanceFor(ledger, customer.email), 60);
  assert.equal(ledger.transactions.filter((tx) => tx.id === "request:request-1").length, 1);
});

test("request roles prevent outsiders, skipped stages and actions for the wrong participant", () => {
  const ledger = pending();
  const unchanged = JSON.stringify(ledger);
  assert.deepEqual(new Set(allowedRequestActions(request(ledger), provider.email)), new Set(["accepted", "declined"]));
  assert.deepEqual(allowedRequestActions(request(ledger), customer.email), ["cancelled"]);
  assert.deepEqual(allowedRequestActions(request(ledger), outsider.email), []);
  for (const [actor, status] of [[customer, "accepted"], [customer, "declined"], [provider, "completed"], [provider, "in_progress"], [outsider, "accepted"], [outsider, "cancelled"]]) {
    assert.throws(() => transitionRequest(ledger, actor, "request-1", status, createdAt));
  }
  assert.throws(() => transitionRequest(ledger, provider, "missing", "accepted", createdAt));
  assert.throws(() => transitionRequest(ledger, provider, "request-1", "unknown", createdAt));
  assert.equal(JSON.stringify(ledger), unchanged);
});

test("cancelling an accepted request releases the reservation without transferring minutes", () => {
  for (const actor of [customer, provider]) {
    const ledger = transitionRequest(accepted(90), actor, "request-1", "cancelled", createdAt);
    assert.equal(request(ledger).status, "cancelled");
    assert.equal(reservedFor(ledger, customer.email), 0);
    assert.equal(availableBalanceFor(ledger, customer.email), 120);
    assert.equal(balanceFor(ledger, provider.email), 120);
    assert.equal(ledger.transactions.filter((tx) => tx.type === "service").length, 0);
    assert.deepEqual(allowedRequestActions(request(ledger), customer.email), []);
  }
  const declined = transitionRequest(pending(), provider, "request-1", "declined", createdAt);
  assert.equal(reservedFor(declined, customer.email), 0);
  assert.deepEqual(allowedRequestActions(request(declined), provider.email), []);
});

test("accepted requests cannot reserve more minutes than the customer owns", () => {
  let ledger = pending(90);
  ledger = createRequest(ledger, customer, { ...offer, id: "second-service", email: secondProvider.email, n: secondProvider.name },
    { minutes: 60, scheduledAt: "2026-11-13T10:00:00.000Z" }, "request-2", createdAt);
  ledger = transitionRequest(ledger, provider, "request-1", "accepted", createdAt);
  assert.throws(() => transitionRequest(ledger, secondProvider, "request-2", "accepted", createdAt));
  assert.equal(request(ledger, "request-2").status, "pending");
  assert.equal(reservedFor(ledger, customer.email), 90);
  assert.equal(availableBalanceFor(ledger, customer.email), 30);
});

test("wallet transfers cannot spend reserved minutes or bypass the hold with a request-shaped ID", () => {
  const ledger = accepted(90);
  const transfer = { id: "ordinary-transfer", from: customer.email, to: outsider.email, minutes: 31, note: "Перевод знакомому" };
  assert.throws(() => createTransfer(ledger, transfer, createdAt));
  assert.throws(() => createTransfer(ledger, { ...transfer, type: "service", offerId: offer.id }, createdAt));
  assert.throws(() => createTransfer(ledger, { ...transfer, id: "request:request-1", minutes: 90 }, createdAt));
  let next = createTransfer(ledger, { ...transfer, minutes: 30 }, createdAt);
  assert.equal(availableBalanceFor(next, customer.email), 0);
  assert.equal(reservedFor(next, customer.email), 90);
  next = transitionRequest(next, provider, "request-1", "in_progress", scheduledAt);
  next = transitionRequest(next, provider, "request-1", "awaiting_confirmation", "2026-11-12T11:30:00.000Z");
  const attemptedCompletion = { id: "request:request-1", from: customer.email, to: provider.email, minutes: 90,
    note: offer.t, type: "service", offerId: offer.id };
  for (const invalid of [{ type: "transfer" }, { to: outsider.email }, { offerId: "different-service" }, { note: "Другое назначение" }, { minutes: 89 }]) {
    assert.throws(() => createTransfer(next, { ...attemptedCompletion, ...invalid }, "2026-11-12T11:31:00.000Z"));
  }
  next = transitionRequest(next, customer, "request-1", "completed", "2026-11-12T11:35:00.000Z");
  assert.equal(balanceFor(next, customer.email), 0);
  assert.equal(reservedFor(next, customer.email), 0);
  assert.equal(balanceFor(next, provider.email), 210);
});

test("a participant cannot accept overlapping appointments but adjacent times are allowed", () => {
  let ledger = accepted();
  ledger = createRequest(ledger, outsider, offer, { minutes: 30, scheduledAt: "2026-11-12T10:30:00.000Z" }, "provider-conflict", createdAt);
  assert.throws(() => transitionRequest(ledger, provider, "provider-conflict", "accepted", createdAt));
  ledger = createRequest(ledger, customer, { ...offer, id: "another-service", email: secondProvider.email, n: secondProvider.name },
    { minutes: 30, scheduledAt: "2026-11-12T10:45:00.000Z" }, "customer-conflict", createdAt);
  assert.throws(() => transitionRequest(ledger, secondProvider, "customer-conflict", "accepted", createdAt));
  ledger = createRequest(ledger, outsider, offer, { minutes: 30, scheduledAt: "2026-11-12T11:00:00.000Z" }, "adjacent", createdAt);
  ledger = transitionRequest(ledger, provider, "adjacent", "accepted", createdAt);
  assert.equal(request(ledger, "adjacent").status, "accepted");
});

test("request creation rejects invalid agreements, self bookings and duplicate identities", () => {
  const ledger = initial();
  for (const change of [
    { minutes: 0 }, { minutes: 29 }, { minutes: 121 }, { minutes: 30.5 }, { minutes: "60" },
    { scheduledAt: "not-a-date" }, { scheduledAt: "2026-11-10T10:00:00.000Z" },
    { message: "x".repeat(2001) },
  ]) assert.throws(() => createRequest(ledger, customer, offer, { ...values, ...change }, "invalid", createdAt));
  assert.throws(() => createRequest(ledger, provider, offer, values, "self", createdAt));
  assert.throws(() => createRequest(ledger, null, offer, values, "guest", createdAt));
  const created = createRequest(ledger, customer, offer, values, "request-1", createdAt);
  assert.throws(() => createRequest(created, customer, offer, values, "request-1", createdAt));
  assert.equal(readActivity(created).requests.length, 1);
});

test("only participants can send messages, and the other participant receives an unread notification", () => {
  let ledger = pending();
  ledger = addRequestMessage(ledger, customer, "request-1", "  Давайте разберём замыкания.  ", "message-1", createdAt);
  const message = readActivity(ledger).messages.find((item) => item.id === "message-1");
  assert.equal(message.text, "Давайте разберём замыкания.");
  assert.equal(message.authorEmail, customer.email);
  assert.ok(message.readBy.includes(customer.email));
  assert.ok(!message.readBy.includes(provider.email));
  assert.ok(readActivity(ledger).notifications.some((notice) => notice.recipient === provider.email && notice.type === "message" && !notice.readAt));
  for (const text of ["", "  \n  ", "x".repeat(2001)]) assert.throws(() => addRequestMessage(ledger, customer, "request-1", text, "invalid", createdAt));
  assert.throws(() => addRequestMessage(ledger, outsider, "request-1", "Чужое сообщение", "outside", createdAt));
  assert.throws(() => addRequestMessage(ledger, provider, "missing", "Сообщение", "missing", createdAt));
  assert.throws(() => addRequestMessage(ledger, provider, "request-1", "Другой текст", "message-1", createdAt));
});

test("read receipts and notification actions affect only the current participant", () => {
  let ledger = addRequestMessage(pending(), customer, "request-1", "Есть вопрос по занятию.", "message-1", createdAt);
  ledger = transitionRequest(ledger, provider, "request-1", "accepted", createdAt);
  const providerNotice = readActivity(ledger).notifications.find((notice) => notice.recipient === provider.email && !notice.readAt);
  const customerNotice = readActivity(ledger).notifications.find((notice) => notice.recipient === customer.email && !notice.readAt);
  assert.ok(providerNotice && customerNotice);
  assert.throws(() => markNotificationRead(ledger, customer, providerNotice.id, createdAt));
  ledger = markNotificationRead(ledger, provider, providerNotice.id, createdAt);
  assert.ok(readActivity(ledger).notifications.find((notice) => notice.id === providerNotice.id).readAt);
  assert.ok(!readActivity(ledger).notifications.find((notice) => notice.id === customerNotice.id).readAt);
  ledger = markRequestRead(ledger, provider, "request-1", createdAt);
  assert.ok(readActivity(ledger).messages.find((item) => item.id === "message-1").readBy.includes(provider.email));
  assert.throws(() => markRequestRead(ledger, outsider, "request-1", createdAt));
  ledger = addRequestMessage(ledger, customer, "request-1", "Ещё один вопрос.", "message-2", createdAt);
  ledger = markAllNotificationsRead(ledger, provider, createdAt);
  assert.ok(readActivity(ledger).notifications.filter((notice) => notice.recipient === provider.email).every((notice) => notice.readAt));
  assert.ok(!readActivity(ledger).notifications.find((notice) => notice.id === customerNotice.id).readAt);
  assert.ok(!readActivity(ledger).messages.find((item) => item.id === "message-2").readBy.includes(provider.email), "marking notifications read must not claim the chat was opened");
});

test("requests, messages and notices survive the existing wallet storage round trip", () => {
  let ledger = addRequestMessage(accepted(), provider, "request-1", "Ссылка будет здесь перед встречей.", "message-1", createdAt);
  ledger = markRequestRead(ledger, customer, "request-1", createdAt);
  const saved = JSON.stringify(ledger);
  const restored = readLedger({ getItem: (key) => key === WALLET_KEY ? saved : null });
  assert.deepEqual(readActivity(restored), readActivity(ledger));
  assert.equal(reservedFor(restored, customer.email), 60);
  assert.equal(availableBalanceFor(restored, customer.email), 60);
  assert.deepEqual(readActivity(emptyLedger()), emptyActivity());
});

test("corrupt saved activity is reported instead of silently removing requests or messages", () => {
  const valid = pending();
  const variants = [
    null,
    { ...emptyActivity(), version: 2 },
    { ...emptyActivity(), requests: {} },
    { ...emptyActivity(), messages: {} },
    { ...emptyActivity(), notifications: {} },
    { ...readActivity(valid), requests: [{ ...request(valid), status: "invented-status" }] },
    { ...readActivity(valid), requests: [{ ...request(valid), minutes: -1 }] },
    { ...readActivity(valid), requests: [request(valid), request(valid)] },
    { ...readActivity(valid), messages: [{ id: "broken", requestId: "request-1", authorEmail: customer.email, authorName: customer.name, text: null, createdAt, readBy: [] }] },
    { ...readActivity(valid), messages: [{ id: "broken", requestId: "missing", authorEmail: customer.email, authorName: customer.name, text: "Сообщение", createdAt, readBy: [] }] },
  ];
  for (const activity of variants) assert.throws(() => readActivity({ ...valid, activity }));
  for (const status of ["pending", "accepted", "in_progress", "awaiting_confirmation", "completed", "declined", "cancelled"]) {
    assert.equal(typeof REQUEST_STATUS_LABELS[status], "string");
    assert.ok(REQUEST_STATUS_LABELS[status]);
  }
});
