import { balanceFor, createTransfer, ensureAccount, normalizeEmail } from "./wallet.mjs";

export const REQUEST_STATUS_LABELS = Object.freeze({
  pending: "Ожидает ответа", accepted: "Согласована", in_progress: "В процессе",
  awaiting_confirmation: "Ожидает подтверждения", completed: "Завершена",
  declined: "Отклонена", cancelled: "Отменена",
});
const RESERVED_STATUSES = ["accepted", "in_progress", "awaiting_confirmation"];
const isDate = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const isPerson = (value) => value && typeof value.name === "string" && value.name.trim() && typeof value.email === "string" && value.email && value.email === normalizeEmail(value.email);
const isStatus = (value) => Object.hasOwn(REQUEST_STATUS_LABELS, value);
const uniqueIds = (items) => new Set(items.map(({ id }) => id)).size === items.length;

export function emptyActivity() { return { version: 1, requests: [], messages: [], notifications: [] }; }

export function readActivity(ledger) {
  if (ledger.activity === undefined) return emptyActivity();
  try {
    const activity = ledger.activity;
    if (!activity || activity.version !== 1 || ![activity.requests, activity.messages, activity.notifications].every(Array.isArray)) throw new Error();
    if (![activity.requests, activity.messages, activity.notifications].every(uniqueIds)) throw new Error();
    if (activity.requests.some((r) => !r || typeof r.id !== "string" || !r.id || typeof r.offerId !== "string" || !r.offerId ||
      typeof r.title !== "string" || !r.title || typeof r.category !== "string" || !isPerson(r.customer) || !isPerson(r.provider) ||
      r.customer.email === r.provider.email || !Number.isSafeInteger(r.minutes) || r.minutes <= 0 || r.minutes > 480 ||
      !isDate(r.scheduledAt) || !isDate(r.createdAt) || !isDate(r.updatedAt) || !isStatus(r.status) ||
      !Array.isArray(r.history) || !r.history.length || r.history.some((h) => !h || !isStatus(h.status) || ![r.customer.email, r.provider.email].includes(h.by) || !isDate(h.createdAt)))) throw new Error();
    const requestById = new Map(activity.requests.map((r) => [r.id, r]));
    if (activity.messages.some((m) => {
      const r = requestById.get(m?.requestId);
      const people = r ? [r.customer.email, r.provider.email] : [];
      return !m || typeof m.id !== "string" || !m.id || !r || !people.includes(m.authorEmail) || typeof m.authorName !== "string" ||
        typeof m.text !== "string" || !m.text.trim() || m.text.length > 2000 || !isDate(m.createdAt) || !Array.isArray(m.readBy) || m.readBy.some((email) => !people.includes(email));
    })) throw new Error();
    if (activity.notifications.some((n) => {
      const r = requestById.get(n?.requestId);
      return !n || typeof n.id !== "string" || !n.id || !r || ![r.customer.email, r.provider.email].includes(n.recipient) ||
        !["request", "status", "message"].includes(n.type) || typeof n.text !== "string" || !n.values || typeof n.values !== "object" ||
        Array.isArray(n.values) || !isDate(n.createdAt) || (n.readAt !== null && !isDate(n.readAt));
    })) throw new Error();
    return activity;
  } catch {
    throw new Error("Не удалось прочитать заявки и сообщения. Сохранённые данные не изменены.");
  }
}

function currentActor(actor) {
  if (!isPerson(actor)) throw new Error("Войдите в аккаунт.");
  return normalizeEmail(actor.email);
}
function participantRequest(activity, actor, id) {
  const email = currentActor(actor);
  const request = activity.requests.find((r) => r.id === id);
  if (!request || ![request.customer.email, request.provider.email].includes(email)) throw new Error("Заявка не найдена или недоступна.");
  return request;
}
function notification(id, recipient, requestId, type, text, values, now) {
  return { id, recipient, requestId, type, text, values, createdAt: now, readAt: null };
}
function assertNow(now) { if (!isDate(now)) throw new Error("Проверьте дату и время занятия."); }

export function reservedFor(ledger, email) {
  const normalized = normalizeEmail(email);
  return readActivity(ledger).requests.filter((r) => r.customer.email === normalized && RESERVED_STATUSES.includes(r.status)).reduce((sum, r) => sum + r.minutes, 0);
}
export function availableBalanceFor(ledger, email) { return balanceFor(ledger, email) - reservedFor(ledger, email); }

export function allowedRequestActions(request, email) {
  if (!request) return [];
  const normalized = normalizeEmail(email);
  const customer = request.customer.email === normalized;
  const provider = request.provider.email === normalized;
  if (!customer && !provider) return [];
  if (request.status === "pending") return provider ? ["accepted", "declined"] : ["cancelled"];
  if (request.status === "accepted") return provider ? ["in_progress", "cancelled"] : ["cancelled"];
  if (request.status === "in_progress" && provider) return ["awaiting_confirmation"];
  if (request.status === "awaiting_confirmation" && customer) return ["completed"];
  return [];
}

export function createRequest(ledger, actor, offer, values, id, now = new Date().toISOString()) {
  const email = currentActor(actor);
  assertNow(now);
  const activity = readActivity(ledger);
  if (typeof id !== "string" || !id || activity.requests.some((r) => r.id === id)) throw new Error("Не удалось создать уникальную заявку.");
  if (!offer || !offer.id || !offer.email || !offer.n || typeof offer.t !== "string") throw new Error("Услуга больше недоступна.");
  const providerEmail = normalizeEmail(offer.email);
  if (email === providerEmail) throw new Error("Нельзя отправить заявку на свою услугу.");
  if (!Number.isSafeInteger(values.minutes) || values.minutes < offer.m1 || values.minutes > offer.m2 || values.minutes > 480) throw new Error("Выберите допустимую длительность занятия.");
  if (!isDate(values.scheduledAt) || Date.parse(values.scheduledAt) <= Date.parse(now)) throw new Error("Выберите дату и время в будущем.");
  const message = String(values.message || "").trim();
  if (message.length > 2000) throw new Error("Сообщение должно быть не длиннее 2000 символов.");
  let next = ensureAccount(ledger, actor, now);
  next = ensureAccount(next, { email: providerEmail, name: offer.n }, now);
  if (availableBalanceFor(next, email) < values.minutes) throw new Error("Недостаточно свободных минут для заявки.");
  const request = { id, offerId: offer.id, title: offer.t, category: offer.cat || "Другое",
    customer: { email, name: actor.name.trim() }, provider: { email: providerEmail, name: offer.n },
    minutes: values.minutes, scheduledAt: new Date(values.scheduledAt).toISOString(), status: "pending", createdAt: now, updatedAt: now,
    history: [{ status: "pending", by: email, createdAt: now }] };
  const firstMessage = message ? [{ id: `${id}:first-message`, requestId: id, authorEmail: email, authorName: actor.name.trim(), text: message, createdAt: now, readBy: [email] }] : [];
  return { ...next, activity: { ...activity, requests: [request, ...activity.requests], messages: [...activity.messages, ...firstMessage],
    notifications: [notification(`${id}:created`, providerEmail, id, "request", "Новая заявка: {title}", { title: offer.t }, now), ...activity.notifications] } };
}

function checkConflicts(activity, request) {
  const start = Date.parse(request.scheduledAt);
  const end = start + request.minutes * 60000;
  const participants = [request.customer.email, request.provider.email];
  if (activity.requests.some((r) => r.id !== request.id && RESERVED_STATUSES.includes(r.status) &&
    [r.customer.email, r.provider.email].some((email) => participants.includes(email)) &&
    Date.parse(r.scheduledAt) < end && Date.parse(r.scheduledAt) + r.minutes * 60000 > start)) {
    throw new Error("На это время уже согласовано другое занятие. Обсудите новое время в чате и создайте новую заявку.");
  }
}

export function transitionRequest(ledger, actor, id, status, now = new Date().toISOString()) {
  assertNow(now);
  const activity = readActivity(ledger);
  const request = participantRequest(activity, actor, id);
  // A retried confirmation never charges the customer twice.
  if (request.status === "completed" && status === "completed" && actor.email === request.customer.email) return ledger;
  if (!allowedRequestActions(request, actor.email).includes(status)) throw new Error("Это действие недоступно для текущего статуса заявки.");
  if (status === "accepted") {
    if (Date.parse(request.scheduledAt) <= Date.parse(now)) throw new Error("Время занятия уже прошло. Создайте заявку на другое время.");
    if (availableBalanceFor(ledger, request.customer.email) < request.minutes) throw new Error("У заказчика недостаточно свободных минут для подтверждения.");
    checkConflicts(activity, request);
  }
  let next = ledger;
  if (status === "completed") next = createTransfer(ledger, { id: `request:${id}`, from: request.customer.email, to: request.provider.email,
    minutes: request.minutes, note: request.title.slice(0, 200), type: "service", offerId: request.offerId }, now);
  const updated = { ...request, status, updatedAt: now, history: [...request.history, { status, by: actor.email, createdAt: now }] };
  const recipient = actor.email === request.customer.email ? request.provider.email : request.customer.email;
  return { ...next, activity: { ...activity, requests: activity.requests.map((r) => r.id === id ? updated : r),
    notifications: [notification(`${id}:status:${updated.history.length}`, recipient, id, "status", "Статус заявки «{title}»: {status}",
      { title: request.title, status: REQUEST_STATUS_LABELS[status] }, now), ...activity.notifications] } };
}

export function addRequestMessage(ledger, actor, requestId, text, id, now = new Date().toISOString()) {
  assertNow(now);
  const activity = readActivity(ledger);
  const request = participantRequest(activity, actor, requestId);
  const message = typeof text === "string" ? text.trim() : "";
  if (!message || message.length > 2000) throw new Error("Введите сообщение от 1 до 2000 символов.");
  if (typeof id !== "string" || !id || activity.messages.some((m) => m.id === id)) throw new Error("Не удалось создать уникальное сообщение.");
  const recipient = actor.email === request.customer.email ? request.provider.email : request.customer.email;
  return { ...ledger, activity: { ...activity,
    messages: [...activity.messages, { id, requestId, authorEmail: actor.email, authorName: actor.name, text: message, createdAt: now, readBy: [actor.email] }],
    notifications: [notification(`${id}:message`, recipient, requestId, "message", "Новое сообщение от {name}: {title}", { name: actor.name, title: request.title }, now), ...activity.notifications] } };
}

export function markRequestRead(ledger, actor, id, now = new Date().toISOString()) {
  const activity = readActivity(ledger);
  participantRequest(activity, actor, id);
  const hasUnread = activity.messages.some((m) => m.requestId === id && !m.readBy.includes(actor.email)) ||
    activity.notifications.some((n) => n.requestId === id && n.recipient === actor.email && !n.readAt);
  if (!hasUnread) return ledger;
  assertNow(now);
  return { ...ledger, activity: { ...activity,
    messages: activity.messages.map((m) => m.requestId === id && !m.readBy.includes(actor.email) ? { ...m, readBy: [...m.readBy, actor.email] } : m),
    notifications: activity.notifications.map((n) => n.requestId === id && n.recipient === actor.email && !n.readAt ? { ...n, readAt: now } : n) } };
}

export function markNotificationRead(ledger, actor, id, now = new Date().toISOString()) {
  currentActor(actor);
  assertNow(now);
  const activity = readActivity(ledger);
  const item = activity.notifications.find((n) => n.id === id && n.recipient === actor.email);
  if (!item) throw new Error("Уведомление не найдено.");
  if (item.readAt) return ledger;
  return { ...ledger, activity: { ...activity, notifications: activity.notifications.map((n) => n === item ? { ...n, readAt: now } : n) } };
}

export function markAllNotificationsRead(ledger, actor, now = new Date().toISOString()) {
  currentActor(actor);
  assertNow(now);
  const activity = readActivity(ledger);
  if (!activity.notifications.some((n) => n.recipient === actor.email && !n.readAt)) return ledger;
  return { ...ledger, activity: { ...activity, notifications: activity.notifications.map((n) => n.recipient === actor.email && !n.readAt ? { ...n, readAt: now } : n) } };
}
