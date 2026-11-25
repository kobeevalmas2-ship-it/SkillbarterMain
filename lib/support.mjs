import { adminEmailsFor, isAdminActor } from "./admin-auth.mjs";
import { balanceFor, normalizeEmail } from "./wallet.mjs";
import { readActivity, REQUEST_STATUS_LABELS } from "./requests.mjs";

export const SUPPORT_STATUS_LABELS = Object.freeze({
  open: "Открыта", reviewing: "На рассмотрении", resolved: "Решена", rejected: "Отклонена",
});
const ACTIVE_CASE_STATUSES = ["open", "reviewing"];
const ACTIVE_REQUEST_STATUSES = ["pending", "accepted", "in_progress", "awaiting_confirmation"];
const validDate = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const validPerson = (value) => value && typeof value.email === "string" && value.email === normalizeEmail(value.email) && value.email && typeof value.name === "string" && value.name.trim();

export function emptySupport() {
  return { version: 1, cases: [], messages: [], audit: [] };
}

export function readSupport(ledger) {
  if (ledger.support === undefined) return emptySupport();
  try {
    const support = ledger.support;
    if (!support || support.version !== 1) throw new Error();
    for (const collection of [support.cases, support.messages, support.audit]) {
      if (!Array.isArray(collection) || collection.some((item) => !item || typeof item.id !== "string" || !item.id)) throw new Error();
      if (new Set(collection.map((item) => item.id)).size !== collection.length) throw new Error();
    }
    const requests = new Map(readActivity(ledger).requests.map((request) => [request.id, request]));
    for (const item of support.cases) {
      const request = requests.get(item.requestId);
      if (!request || !validPerson(item.reporter) || !validPerson(item.customer) || !validPerson(item.provider)) throw new Error();
      if (item.customer.email !== request.customer.email || item.provider.email !== request.provider.email) throw new Error();
      if (![item.customer.email, item.provider.email].includes(item.reporter.email)) throw new Error();
      if (typeof item.title !== "string" || typeof item.text !== "string" || item.text.trim().length < 10 || item.text.length > 3000) throw new Error();
      if (!Object.hasOwn(SUPPORT_STATUS_LABELS, item.status) || !validDate(item.createdAt) || !validDate(item.updatedAt)) throw new Error();
      if (item.resolution !== null) {
        const decision = item.resolution;
        if (!decision || !["refund", "cancel", "refund_cancel", "reject"].includes(decision.action) || !adminEmailsFor(ledger).includes(decision.by) ||
          typeof decision.reason !== "string" || decision.reason.trim().length < 10 || decision.reason.length > 2000 ||
          !Number.isSafeInteger(decision.minutes) || decision.minutes < 0 || !validDate(decision.createdAt)) throw new Error();
      }
      if (ACTIVE_CASE_STATUSES.includes(item.status) !== (item.resolution === null)) throw new Error();
    }
    const cases = new Map(support.cases.map((item) => [item.id, item]));
    for (const message of support.messages) {
      const item = cases.get(message.caseId);
      if (!item) throw new Error();
      const readers = [item.customer.email, item.provider.email, ...adminEmailsFor(ledger)];
      if (!readers.includes(message.authorEmail) || typeof message.authorName !== "string" || typeof message.text !== "string" ||
        !message.text.trim() || message.text.length > 3000 || !validDate(message.createdAt) || !Array.isArray(message.readBy) ||
        message.readBy.some((email) => !readers.includes(email))) throw new Error();
    }
    for (const entry of support.audit) {
      if (!adminEmailsFor(ledger).includes(entry.actorEmail) || typeof entry.action !== "string" || typeof entry.reason !== "string" ||
        entry.reason.trim().length < 10 || entry.reason.length > 2000 || !validDate(entry.createdAt)) throw new Error();
      if (entry.minutes !== undefined && (!Number.isSafeInteger(entry.minutes) || entry.minutes < 0)) throw new Error();
    }
    return support;
  } catch {
    throw new Error("Не удалось прочитать обращения поддержки. Сохранённые данные не изменены.");
  }
}

function requireAdmin(actor) {
  if (!isAdminActor(actor)) throw new Error("Это действие доступно только администратору.");
}

function validateTime(now) {
  if (!validDate(now)) throw new Error("Некорректная дата операции.");
}

function decisionReason(value) {
  const reason = typeof value === "string" ? value.trim() : "";
  if (reason.length < 10 || reason.length > 2000) throw new Error("Укажите причину решения от 10 до 2000 символов.");
  return reason;
}

function getRequest(ledger, id) {
  const request = readActivity(ledger).requests.find((item) => item.id === id);
  if (!request) throw new Error("Заявка не найдена или недоступна.");
  return request;
}

function canReadCase(item, actor) {
  return Boolean(actor && (isAdminActor(actor) || [item.customer.email, item.provider.email].includes(actor.email)));
}

function getCase(ledger, actor, id) {
  const item = readSupport(ledger).cases.find((entry) => entry.id === id);
  if (!item || !canReadCase(item, actor)) throw new Error("Обращение не найдено или недоступно.");
  return item;
}

function notify(ledger, request, recipients, key, text, values, now, caseId) {
  const activity = readActivity(ledger);
  const additions = [...new Set(recipients)].map((recipient) => ({
    id: `${key}:${recipient}`, recipient, requestId: request.id, type: caseId ? "support" : "status",
    ...(caseId ? { caseId } : {}), text, values, createdAt: now, readAt: null,
  }));
  return { ...ledger, activity: { ...activity, notifications: [...additions, ...activity.notifications] } };
}

function recordAudit(ledger, actor, action, reason, now, details = {}) {
  const support = readSupport(ledger);
  const entry = { id: `admin:${support.audit.length + 1}`, actorEmail: actor.email, action, reason, createdAt: now, ...details };
  return { ...ledger, support: { ...support, audit: [entry, ...support.audit] } };
}

function updateRequest(ledger, request, status, actor, now, reason) {
  const activity = readActivity(ledger);
  const updated = { ...request, status, updatedAt: now,
    history: [...request.history, { status, by: actor.email, createdAt: now, reason }] };
  return { ...ledger, activity: { ...activity, requests: activity.requests.map((item) => item.id === request.id ? updated : item) } };
}

export function openComplaint(ledger, actor, values, id, now = new Date().toISOString()) {
  validateTime(now);
  const request = getRequest(ledger, values.requestId);
  if (!actor || ![request.customer.email, request.provider.email].includes(actor.email)) throw new Error("Жалобу может отправить только участник занятия.");
  const text = typeof values.text === "string" ? values.text.trim() : "";
  if (text.length < 10 || text.length > 3000) throw new Error("Опишите проблему от 10 до 3000 символов.");
  const support = readSupport(ledger);
  if (typeof id !== "string" || !id || support.cases.some((item) => item.id === id)) throw new Error("Не удалось создать уникальное обращение.");
  if (support.cases.some((item) => item.requestId === request.id && item.reporter.email === actor.email && ACTIVE_CASE_STATUSES.includes(item.status))) {
    throw new Error("У вас уже есть открытая жалоба по этому занятию.");
  }
  const item = { id, requestId: request.id, title: request.title, reporter: { email: actor.email, name: actor.name },
    customer: request.customer, provider: request.provider, status: "open", text, createdAt: now, updatedAt: now, resolution: null };
  let next = { ...ledger, support: { ...support, cases: [item, ...support.cases], messages: [...support.messages, {
    id: `${id}:initial`, caseId: id, authorEmail: actor.email, authorName: actor.name, text, createdAt: now, readBy: [actor.email],
  }] } };
  next = notify(next, request, [...adminEmailsFor(ledger), request.customer.email, request.provider.email].filter((email) => email !== actor.email),
    `${id}:opened`, "Новая жалоба по занятию «{title}»", { title: request.title }, now, id);
  return next;
}

export function addSupportMessage(ledger, actor, id, text, messageId, now = new Date().toISOString()) {
  validateTime(now);
  const item = getCase(ledger, actor, id);
  if (!ACTIVE_CASE_STATUSES.includes(item.status)) throw new Error("Обращение закрыто. При необходимости создайте новое обращение.");
  const message = typeof text === "string" ? text.trim() : "";
  if (!message || message.length > 2000) throw new Error("Введите сообщение от 1 до 2000 символов.");
  const support = readSupport(ledger);
  if (!messageId || typeof messageId !== "string" || support.messages.some((entry) => entry.id === messageId)) throw new Error("Не удалось создать уникальное сообщение.");
  let next = { ...ledger, support: { ...support,
    cases: support.cases.map((entry) => entry.id === id ? { ...entry, updatedAt: now } : entry),
    messages: [...support.messages, { id: messageId, caseId: id, authorEmail: actor.email, authorName: actor.name, text: message, createdAt: now, readBy: [actor.email] }],
  } };
  next = notify(next, getRequest(next, item.requestId), [...adminEmailsFor(ledger), item.customer.email, item.provider.email].filter((email) => email !== actor.email),
    `${messageId}:support`, "Ответ в поддержке по занятию «{title}»", { title: item.title }, now, id);
  return next;
}

export function markSupportCaseRead(ledger, actor, id, now = new Date().toISOString()) {
  validateTime(now);
  getCase(ledger, actor, id);
  const support = readSupport(ledger);
  const activity = readActivity(ledger);
  const unreadMessages = support.messages.some((message) => message.caseId === id && !message.readBy.includes(actor.email));
  const unreadNotices = activity.notifications.some((notice) => notice.caseId === id && notice.recipient === actor.email && !notice.readAt);
  if (!unreadMessages && !unreadNotices) return ledger;
  return { ...ledger, support: { ...support, messages: support.messages.map((message) =>
    message.caseId === id && !message.readBy.includes(actor.email) ? { ...message, readBy: [...message.readBy, actor.email] } : message) },
    activity: { ...activity, notifications: activity.notifications.map((notice) =>
      notice.caseId === id && notice.recipient === actor.email && !notice.readAt ? { ...notice, readAt: now } : notice) } };
}

export function changeSupportStatus(ledger, actor, id, status, note, now = new Date().toISOString()) {
  requireAdmin(actor);
  validateTime(now);
  const reason = decisionReason(note);
  const item = getCase(ledger, actor, id);
  if (!ACTIVE_CASE_STATUSES.includes(status) || !ACTIVE_CASE_STATUSES.includes(item.status)) throw new Error("Нельзя изменить статус закрытого обращения.");
  if (item.status === status) return ledger;
  const support = readSupport(ledger);
  let next = { ...ledger, support: { ...support, cases: support.cases.map((entry) => entry.id === id ? { ...entry, status, updatedAt: now } : entry) } };
  next = recordAudit(next, actor, "case_status", reason, now, { caseId: id, requestId: item.requestId });
  return notify(next, getRequest(next, item.requestId), [item.customer.email, item.provider.email],
    `${id}:review:${readSupport(next).audit.length}`, "Статус жалобы по занятию «{title}» изменён", { title: item.title }, now, id);
}

function paymentFor(ledger, request) {
  return ledger.transactions.find((transaction) => transaction.id === `request:${request.id}` && transaction.type === "service" &&
    transaction.offerId === request.offerId && transaction.from === request.customer.email && transaction.to === request.provider.email && transaction.minutes === request.minutes);
}

export function refundedForRequest(ledger, requestId) {
  return ledger.transactions.filter((transaction) => transaction.type === "refund" && transaction.requestId === requestId)
    .reduce((sum, transaction) => sum + transaction.minutes, 0);
}

export function adminRefundRequest(ledger, actor, id, options, now = new Date().toISOString()) {
  requireAdmin(actor);
  validateTime(now);
  const reason = decisionReason(options.reason);
  const request = getRequest(ledger, id);
  const payment = paymentFor(ledger, request);
  if (!payment) throw new Error("По этому занятию нет оплаченной операции для возврата.");
  const alreadyRefunded = refundedForRequest(ledger, id);
  const remaining = payment.minutes - alreadyRefunded;
  const minutes = options.minutes === undefined ? remaining : options.minutes;
  if (!Number.isSafeInteger(minutes) || minutes <= 0 || minutes > remaining) throw new Error("Сумма возврата должна быть целой и не превышать невозвращённые минуты занятия.");
  const transaction = { id: `refund:${id}:${alreadyRefunded + minutes}`, from: payment.to, to: payment.from,
    minutes, note: "Возврат минут за занятие", type: "refund", offerId: request.offerId, requestId: id,
    reverses: payment.id, adminEmail: actor.email, reason, createdAt: now };
  let next = { ...ledger, transactions: [transaction, ...ledger.transactions] };
  const updated = { ...request, refundedMinutes: alreadyRefunded + minutes };
  next = updateRequest(next, updated, alreadyRefunded + minutes === payment.minutes ? "refunded" : request.status, actor, now, reason);
  next = recordAudit(next, actor, "refund", reason, now, { requestId: id, from: payment.to, to: payment.from, minutes });
  return notify(next, request, [request.customer.email, request.provider.email], transaction.id,
    "Администратор вернул {minutes} мин за занятие «{title}»", { minutes, title: request.title }, now);
}

export function adminCancelRequest(ledger, actor, id, explanation, now = new Date().toISOString()) {
  requireAdmin(actor);
  validateTime(now);
  const reason = decisionReason(explanation);
  let request = getRequest(ledger, id);
  if (request.status === "cancelled") return ledger;
  let next = ledger;
  const payment = paymentFor(next, request);
  if (payment && refundedForRequest(next, id) < payment.minutes) {
    next = adminRefundRequest(next, actor, id, { reason }, now);
    request = getRequest(next, id);
  }
  next = updateRequest(next, request, "cancelled", actor, now, reason);
  next = recordAudit(next, actor, "cancel_request", reason, now, { requestId: id });
  return notify(next, request, [request.customer.email, request.provider.email], `cancel:${id}`,
    "Администратор отменил занятие «{title}»", { title: request.title }, now);
}

export function resolveComplaint(ledger, actor, id, options, now = new Date().toISOString()) {
  requireAdmin(actor);
  validateTime(now);
  const reason = decisionReason(options.reason);
  const item = getCase(ledger, actor, id);
  const action = options.action;
  if (!["refund", "cancel", "refund_cancel", "reject"].includes(action)) throw new Error("Выберите допустимое решение по жалобе.");
  if (!ACTIVE_CASE_STATUSES.includes(item.status)) {
    const sameAmount = options.minutes === undefined || options.minutes === item.resolution?.minutes;
    if (item.resolution?.action === action && item.resolution.reason === reason && sameAmount) return ledger;
    throw new Error("По этой жалобе уже принято решение.");
  }
  const refundedBefore = refundedForRequest(ledger, item.requestId);
  let next = ledger;
  if (action === "refund") next = adminRefundRequest(next, actor, item.requestId, { reason, minutes: options.minutes }, now);
  if (action === "cancel" || action === "refund_cancel") next = adminCancelRequest(next, actor, item.requestId, reason, now);
  const refundedMinutes = refundedForRequest(next, item.requestId) - refundedBefore;
  const support = readSupport(next);
  const resolution = { action, reason, minutes: refundedMinutes, by: actor.email, createdAt: now };
  next = { ...next, support: { ...support,
    cases: support.cases.map((entry) => entry.id === id ? { ...entry, status: action === "reject" ? "rejected" : "resolved", updatedAt: now, resolution } : entry),
    messages: [...support.messages, { id: `${id}:decision`, caseId: id, authorEmail: actor.email, authorName: actor.name,
      text: reason, createdAt: now, readBy: [actor.email] }],
  } };
  next = recordAudit(next, actor, "resolve_case", reason, now, { caseId: id, requestId: item.requestId, minutes: refundedMinutes });
  return notify(next, getRequest(next, item.requestId), [item.customer.email, item.provider.email], `${id}:decision`,
    "Поддержка приняла решение по занятию «{title}»", { title: item.title }, now, id);
}

export function adminTransferMinutes(ledger, actor, values, id, now = new Date().toISOString()) {
  requireAdmin(actor);
  validateTime(now);
  const reason = decisionReason(values.reason);
  const from = normalizeEmail(values.from);
  const to = normalizeEmail(values.to);
  if (!from || !to || from === to) throw new Error("Выберите двух разных участников перевода.");
  if (![from, to].every((email) => ledger.accounts.some((account) => account.email === email))) throw new Error("Участник перевода не найден.");
  if (!Number.isSafeInteger(values.minutes) || values.minutes <= 0) throw new Error("Введите целое количество минут больше нуля.");
  if (!id || typeof id !== "string") throw new Error("Не удалось создать номер перевода.");
  const existing = ledger.transactions.find((transaction) => transaction.id === id);
  if (existing) {
    if (existing.type === "admin_adjustment" && existing.adminEmail === actor.email && existing.from === from && existing.to === to && existing.minutes === values.minutes && existing.reason === reason) return ledger;
    throw new Error("Этот номер операции уже использован.");
  }
  if (!Number.isSafeInteger(balanceFor(ledger, from) - values.minutes) || !Number.isSafeInteger(balanceFor(ledger, to) + values.minutes)) {
    throw new Error("Сумма перевода слишком велика для баланса участника.");
  }
  let next = { ...ledger, transactions: [{ id, from, to, minutes: values.minutes, type: "admin_adjustment",
    note: "Перевод минут администратором", adminEmail: actor.email, reason, createdAt: now }, ...ledger.transactions] };
  next = recordAudit(next, actor, "transfer", reason, now, { from, to, minutes: values.minutes });
  return next;
}

export function adminSetRequestStatus(ledger, actor, id, options, now = new Date().toISOString()) {
  requireAdmin(actor);
  validateTime(now);
  const reason = decisionReason(options.reason);
  if (options.status === "cancelled") return adminCancelRequest(ledger, actor, id, reason, now);
  if (options.status === "refunded") return adminRefundRequest(ledger, actor, id, { reason, minutes: options.minutes }, now);
  const request = getRequest(ledger, id);
  if (!Object.hasOwn(REQUEST_STATUS_LABELS, options.status)) throw new Error("Выберите допустимый статус заявки.");
  if (request.status === options.status) return ledger;
  if (!ACTIVE_REQUEST_STATUSES.includes(request.status)) throw new Error("Для закрытого занятия доступны отмена и возврат минут.");
  let next = ledger;
  if (options.status === "completed") {
    const payment = paymentFor(ledger, request);
    if (!payment && ledger.transactions.some((transaction) => transaction.id === `request:${id}`)) {
      throw new Error("Этот номер операции уже использован.");
    }
    if (!payment) next = { ...ledger, transactions: [{ id: `request:${id}`, from: request.customer.email, to: request.provider.email,
      minutes: request.minutes, note: request.title.slice(0, 200), type: "service", offerId: request.offerId,
      adminEmail: actor.email, reason, createdAt: now }, ...ledger.transactions] };
  }
  next = updateRequest(next, request, options.status, actor, now, reason);
  next = recordAudit(next, actor, "request_status", reason, now, { requestId: id, status: options.status });
  return notify(next, request, [request.customer.email, request.provider.email], `admin-status:${id}:${readSupport(next).audit.length}`,
    "Статус заявки «{title}»: {status}", { title: request.title, status: REQUEST_STATUS_LABELS[options.status] }, now);
}
