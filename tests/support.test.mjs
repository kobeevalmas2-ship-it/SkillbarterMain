import test from "node:test";
import assert from "node:assert/strict";
import { ADMIN_EMAIL, adminAccount } from "../lib/admin-auth.mjs";
import { balanceFor, createTransfer, emptyLedger, ensureAccount, readLedger, WALLET_KEY } from "../lib/wallet.mjs";
import { createRequest, readActivity, reservedFor, transitionRequest } from "../lib/requests.mjs";
import {
  addSupportMessage, adminCancelRequest, adminRefundRequest, adminSetRequestStatus, adminTransferMinutes,
  changeSupportStatus, markSupportCaseRead, openComplaint, readSupport, resolveComplaint,
} from "../lib/support.mjs";

const customer = { name: "Алия", email: "aliya@example.com", role: "user" };
const provider = { name: "Данияр", email: "daniyar@example.com", role: "user" };
const outsider = { name: "Другой участник", email: "other@example.com", role: "user" };
const admin = { name: adminAccount.name, email: ADMIN_EMAIL, role: "admin" };
const createdAt = "2026-11-18T10:00:00.000Z";
const scheduledAt = "2026-11-19T10:00:00.000Z";
const reviewedAt = "2026-11-19T12:00:00.000Z";
const complaintText = "На занятии объясняли другую тему, хотя в переписке мы согласовали JavaScript.";
const reason = "Переписка подтверждает, что согласованная тема занятия не была раскрыта.";
const offer = { id: "javascript-help", email: provider.email, n: provider.name,
  t: "Практика JavaScript", cat: "Разработка", m1: 30, m2: 120 };
const initial = () => [customer, provider, outsider, admin].reduce((ledger, actor) => ensureAccount(ledger, actor, createdAt), emptyLedger());
const requestById = (ledger) => readActivity(ledger).requests.find((item) => item.id === "request-1");
const caseById = (ledger, id = "case-1") => readSupport(ledger).cases.find((item) => item.id === id);
const totalMinutes = (ledger) => ledger.accounts.reduce((sum, account) => sum + balanceFor(ledger, account.email), 0);
const pending = () => createRequest(initial(), customer, offer, { minutes: 60, scheduledAt }, "request-1", createdAt);
function completed() {
  let ledger = transitionRequest(pending(), provider, "request-1", "accepted", createdAt);
  ledger = transitionRequest(ledger, provider, "request-1", "in_progress", scheduledAt);
  ledger = transitionRequest(ledger, provider, "request-1", "awaiting_confirmation", "2026-11-19T11:00:00.000Z");
  return transitionRequest(ledger, customer, "request-1", "completed", "2026-11-19T11:05:00.000Z");
}
const complained = () => openComplaint(completed(), customer, { requestId: "request-1", text: complaintText }, "case-1", reviewedAt);

test("a lesson participant can report a completed exchange and notify the support administrator", () => {
  const before = completed();
  const serialized = JSON.stringify(before);
  const ledger = openComplaint(before, customer, { requestId: "request-1", text: complaintText }, "case-1", reviewedAt);
  const item = caseById(ledger);
  assert.equal(item.requestId, "request-1");
  assert.equal(item.title, offer.t);
  assert.equal(item.reporter.email, customer.email);
  assert.equal(item.customer.email, customer.email);
  assert.equal(item.provider.email, provider.email);
  assert.equal(item.status, "open");
  assert.equal(item.text, complaintText);
  assert.ok(readActivity(ledger).notifications.some((notice) => notice.recipient === ADMIN_EMAIL && !notice.readAt));
  assert.equal(balanceFor(ledger, customer.email), 60);
  assert.equal(balanceFor(ledger, provider.email), 180);
  assert.equal(JSON.stringify(before), serialized);
  assert.throws(() => openComplaint(ledger, customer, { requestId: "request-1", text: complaintText }, "case-2", reviewedAt));
});

test("complaints require an actual participant, existing request and a useful description", () => {
  const ledger = completed();
  for (const actor of [null, outsider]) assert.throws(() => openComplaint(ledger, actor, { requestId: "request-1", text: complaintText }, "invalid", reviewedAt));
  for (const text of ["", "short", "x".repeat(3001)]) assert.throws(() => openComplaint(ledger, customer, { requestId: "request-1", text }, "invalid", reviewedAt));
  assert.throws(() => openComplaint(ledger, customer, { requestId: "missing", text: complaintText }, "invalid", reviewedAt));
});

test("support correspondence is available to the participants and administrator with individual read receipts", () => {
  let ledger = complained();
  ledger = addSupportMessage(ledger, admin, "case-1", "Проверяем переписку и описание предложения.", "support-message-1", reviewedAt);
  const first = readSupport(ledger).messages.find((message) => message.id === "support-message-1");
  assert.equal(first.authorEmail, ADMIN_EMAIL);
  assert.ok(first.readBy.includes(ADMIN_EMAIL));
  assert.ok(!first.readBy.includes(customer.email));
  ledger = markSupportCaseRead(ledger, customer, "case-1", reviewedAt);
  assert.ok(readSupport(ledger).messages.find((message) => message.id === first.id).readBy.includes(customer.email));
  assert.ok(!readSupport(ledger).messages.find((message) => message.id === first.id).readBy.includes(provider.email));
  ledger = addSupportMessage(ledger, provider, "case-1", "Готов предоставить материалы занятия для проверки.", "support-message-2", reviewedAt);
  assert.throws(() => addSupportMessage(ledger, outsider, "case-1", "Чужое сообщение", "outside", reviewedAt));
  assert.throws(() => markSupportCaseRead(ledger, outsider, "case-1", reviewedAt));
  for (const text of ["", " ", "x".repeat(2001)]) assert.throws(() => addSupportMessage(ledger, customer, "case-1", text, "invalid", reviewedAt));
  assert.throws(() => addSupportMessage(ledger, admin, "case-1", "Повторный идентификатор", first.id, reviewedAt));
});

test("only the canonical administrator can review, reject, refund, cancel or transfer participants' minutes", () => {
  const ledger = complained();
  for (const actor of [customer, provider, outsider, { ...customer, role: "admin" }, { ...admin, role: "user" }]) {
    assert.throws(() => changeSupportStatus(ledger, actor, "case-1", "reviewing", reason, reviewedAt));
    assert.throws(() => resolveComplaint(ledger, actor, "case-1", { action: "reject", reason }, reviewedAt));
    assert.throws(() => adminRefundRequest(ledger, actor, "request-1", { reason }, reviewedAt));
    assert.throws(() => adminCancelRequest(ledger, actor, "request-1", reason, reviewedAt));
    assert.throws(() => adminTransferMinutes(ledger, actor, { from: provider.email, to: customer.email, minutes: 10, reason }, "forbidden", reviewedAt));
  }
});

test("a substantiated complaint refunds the actual lesson payment once and records the decision", () => {
  let ledger = changeSupportStatus(complained(), admin, "case-1", "reviewing", reason, reviewedAt);
  const totalBefore = totalMinutes(ledger);
  assert.equal(caseById(ledger).status, "reviewing");
  ledger = resolveComplaint(ledger, admin, "case-1", { action: "refund", reason }, reviewedAt);
  assert.equal(caseById(ledger).status, "resolved");
  assert.equal(caseById(ledger).resolution.action, "refund");
  assert.equal(caseById(ledger).resolution.reason, reason);
  assert.equal(caseById(ledger).resolution.minutes, 60);
  assert.equal(requestById(ledger).status, "refunded");
  assert.equal(balanceFor(ledger, customer.email), 120);
  assert.equal(balanceFor(ledger, provider.email), 120);
  assert.equal(totalMinutes(ledger), totalBefore);
  assert.equal(ledger.transactions.filter((transaction) => transaction.type === "refund").length, 1);
  assert.ok(readSupport(ledger).audit.some((entry) => entry.actorEmail === ADMIN_EMAIL && entry.reason));
  const saved = JSON.stringify(ledger);
  try { ledger = resolveComplaint(ledger, admin, "case-1", { action: "refund", reason }, reviewedAt); } catch {}
  assert.equal(balanceFor(ledger, customer.email), 120);
  assert.equal(ledger.transactions.filter((transaction) => transaction.type === "refund").length, 1);
  assert.equal(JSON.stringify(ledger), saved);
});

test("partial and repeated refunds cannot exceed the original amount paid for the lesson", () => {
  let ledger = adminRefundRequest(completed(), admin, "request-1", { reason, minutes: 20 }, reviewedAt);
  assert.equal(balanceFor(ledger, customer.email), 80);
  assert.equal(balanceFor(ledger, provider.email), 160);
  assert.equal(requestById(ledger).status, "completed");
  assert.throws(() => adminRefundRequest(ledger, admin, "request-1", { reason, minutes: 41 }, reviewedAt));
  ledger = adminRefundRequest(ledger, admin, "request-1", { reason, minutes: 40 }, reviewedAt);
  assert.equal(requestById(ledger).status, "refunded");
  assert.equal(balanceFor(ledger, customer.email), 120);
  assert.equal(ledger.transactions.filter((transaction) => transaction.type === "refund").reduce((sum, transaction) => sum + transaction.minutes, 0), 60);
  assert.throws(() => adminRefundRequest(ledger, admin, "request-1", { reason, minutes: 1 }, reviewedAt));
  assert.throws(() => adminRefundRequest(pending(), admin, "request-1", { reason }, reviewedAt));
});

test("the administrator can refund a spent payment while preserving the total minutes", () => {
  let ledger = completed();
  ledger = createTransfer(ledger, { id: "spend-payment", from: provider.email, to: outsider.email, minutes: 180, note: "Использованные минуты" }, reviewedAt);
  const before = totalMinutes(ledger);
  ledger = adminRefundRequest(ledger, admin, "request-1", { reason }, reviewedAt);
  assert.equal(balanceFor(ledger, customer.email), 120);
  assert.equal(balanceFor(ledger, provider.email), -60);
  assert.equal(totalMinutes(ledger), before);
  assert.throws(() => createTransfer(ledger, { id: "ordinary-debit", from: provider.email, to: outsider.email, minutes: 1 }, reviewedAt));
});

test("administrative cancellation releases active reservations and refunds a completed lesson", () => {
  const accepted = transitionRequest(pending(), provider, "request-1", "accepted", createdAt);
  assert.equal(reservedFor(accepted, customer.email), 60);
  const cancelled = adminCancelRequest(accepted, admin, "request-1", reason, reviewedAt);
  assert.equal(requestById(cancelled).status, "cancelled");
  assert.equal(reservedFor(cancelled, customer.email), 0);
  assert.equal(balanceFor(cancelled, customer.email), 120);
  assert.equal(cancelled.transactions.filter((transaction) => transaction.type === "refund").length, 0);
  const refunded = adminCancelRequest(completed(), admin, "request-1", reason, reviewedAt);
  assert.equal(requestById(refunded).status, "cancelled");
  assert.equal(balanceFor(refunded, customer.email), 120);
  assert.equal(balanceFor(refunded, provider.email), 120);
});

test("manual administrative transfers support corrections, keep ordinary permissions, and require a reason", () => {
  let ledger = initial();
  const before = totalMinutes(ledger);
  ledger = adminTransferMinutes(ledger, admin, { from: provider.email, to: customer.email, minutes: 200, reason }, "admin-correction-1", reviewedAt);
  assert.equal(balanceFor(ledger, provider.email), -80);
  assert.equal(balanceFor(ledger, customer.email), 320);
  assert.equal(totalMinutes(ledger), before);
  assert.equal(ledger.transactions.find((transaction) => transaction.id === "admin-correction-1").type, "admin_adjustment");
  for (const change of [{ minutes: 0 }, { minutes: -1 }, { minutes: 1.5 }, { minutes: Number.MAX_SAFE_INTEGER + 1 }, { minutes: Number.MAX_SAFE_INTEGER }, { reason: "" }, { from: customer.email, to: customer.email }, { to: "missing@example.com" }]) {
    assert.throws(() => adminTransferMinutes(ledger, admin, { from: provider.email, to: customer.email, minutes: 10, reason, ...change }, "invalid", reviewedAt));
  }
  const unchanged = JSON.stringify(ledger);
  try { ledger = adminTransferMinutes(ledger, admin, { from: provider.email, to: customer.email, minutes: 200, reason }, "admin-correction-1", reviewedAt); } catch {}
  assert.equal(JSON.stringify(ledger), unchanged);
});

test("rejecting an unsubstantiated complaint retains the payment and records an explanation", () => {
  const ledger = resolveComplaint(complained(), admin, "case-1", { action: "reject", reason }, reviewedAt);
  assert.equal(caseById(ledger).status, "rejected");
  assert.equal(caseById(ledger).resolution.reason, reason);
  assert.equal(requestById(ledger).status, "completed");
  assert.equal(balanceFor(ledger, customer.email), 60);
  assert.equal(balanceFor(ledger, provider.email), 180);
  assert.equal(ledger.transactions.filter((transaction) => transaction.type === "refund").length, 0);
});

test("administrative request changes preserve one payment and cannot reopen a refunded lesson", () => {
  let ledger = pending();
  assert.throws(() => adminSetRequestStatus(ledger, customer, "request-1", { status: "completed", reason }, reviewedAt));
  ledger = adminSetRequestStatus(ledger, admin, "request-1", { status: "completed", reason }, reviewedAt);
  assert.equal(requestById(ledger).status, "completed");
  assert.equal(balanceFor(ledger, customer.email), 60);
  assert.equal(balanceFor(ledger, provider.email), 180);
  ledger = adminSetRequestStatus(ledger, admin, "request-1", { status: "completed", reason }, reviewedAt);
  assert.equal(ledger.transactions.filter((transaction) => transaction.id === "request:request-1").length, 1);
  ledger = adminRefundRequest(ledger, admin, "request-1", { reason }, reviewedAt);
  assert.throws(() => adminSetRequestStatus(ledger, admin, "request-1", { status: "accepted", reason }, reviewedAt));
  assert.equal(balanceFor(ledger, customer.email), 120);
});

test("administrator corrections retain existing lesson reservations while ordinary transfers stay constrained", () => {
  let ledger = transitionRequest(pending(), provider, "request-1", "accepted", createdAt);
  ledger = adminTransferMinutes(ledger, admin, { from: customer.email, to: outsider.email, minutes: 100, reason }, "admin-correction-hold", reviewedAt);
  assert.equal(balanceFor(ledger, customer.email), 20);
  assert.equal(reservedFor(ledger, customer.email), 60);
  assert.equal(totalMinutes(ledger), totalMinutes(initial()));
  assert.throws(() => createTransfer(ledger, { id: "spend-reserved", from: customer.email, to: provider.email, minutes: 1 }, reviewedAt));
});

test("support history and refunded transactions survive storage reloads and malformed support is rejected", () => {
  let ledger = resolveComplaint(complained(), admin, "case-1", { action: "refund_cancel", reason }, reviewedAt);
  const serialized = JSON.stringify(ledger);
  const restored = readLedger({ getItem: (key) => key === WALLET_KEY ? serialized : null });
  assert.deepEqual(readSupport(restored), readSupport(ledger));
  assert.equal(balanceFor(restored, customer.email), 120);
  assert.deepEqual(readSupport(emptyLedger()), { version: 1, cases: [], messages: [], audit: [] });
  for (const support of [null, { version: 2, cases: [], messages: [], audit: [] }, { version: 1, cases: {}, messages: [], audit: [] }, { ...readSupport(ledger), cases: [caseById(ledger), caseById(ledger)] }]) {
    assert.throws(() => readSupport({ ...ledger, support }));
  }
});

test("wallet reload rejects forged refund metadata and refunds exceeding the original payment", () => {
  const valid = adminRefundRequest(completed(), admin, "request-1", { reason, minutes: 20 }, reviewedAt);
  const refund = valid.transactions.find((transaction) => transaction.type === "refund");
  const read = (ledger) => readLedger({ getItem: () => JSON.stringify(ledger) });
  for (const change of [
    { adminEmail: customer.email }, { reason: "" }, { reverses: "missing-payment" },
    { requestId: "different-request" }, { offerId: "different-offer" },
    { to: outsider.email }, { from: customer.email }, { minutes: 61 },
  ]) {
    assert.throws(() => read({ ...valid, transactions: valid.transactions.map((transaction) => transaction === refund ? { ...transaction, ...change } : transaction) }));
  }
  assert.throws(() => read({ ...valid, transactions: [{ ...refund, id: "refund-over-budget", minutes: 41 }, ...valid.transactions] }));
  assert.throws(() => read({ ...valid, transactions: [refund, ...valid.transactions] }));
});
