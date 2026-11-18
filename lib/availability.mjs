import { normalizeEmail } from "./wallet.mjs";
import { readActivity } from "./requests.mjs";

const MINUTE = 60000;
const SLOT_STEP = 15 * MINUTE;
const MAX_WINDOWS = 365;
const OCCUPIED_STATUSES = new Set(["accepted", "in_progress", "awaiting_confirmation", "completed"]);

function minuteTimestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:\.000)?Z$/.test(value)) return NaN;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return NaN;
  return new Date(timestamp).toISOString() === value.replace(/:00Z$/, ":00.000Z") ? timestamp : NaN;
}

function validTimeZone(value) {
  if (typeof value !== "string" || !value || /^[+-]/.test(value)) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; }
  catch { return false; }
}

function nowTimestamp(now) {
  const timestamp = typeof now === "string" ? Date.parse(now) : NaN;
  if (!Number.isFinite(timestamp)) throw new Error("Проверьте дату и время занятия.");
  return timestamp;
}

function actorEmail(actor) {
  if (!actor || typeof actor.email !== "string" || !actor.email || actor.email !== normalizeEmail(actor.email) ||
      typeof actor.name !== "string" || !actor.name.trim()) throw new Error("Войдите в аккаунт.");
  return actor.email;
}

function validDuration(minutes) { return Number.isSafeInteger(minutes) && minutes >= 15 && minutes <= 480; }
function overlaps(start, end, otherStart, otherEnd) { return start < otherEnd && otherStart < end; }

export function readAvailability(ledger) {
  if (ledger.availability === undefined) return { version: 1, calendars: [] };
  try {
    const availability = ledger.availability;
    if (!availability || availability.version !== 1 || !Array.isArray(availability.calendars)) throw new Error();
    const emails = new Set();
    for (const calendar of availability.calendars) {
      if (!calendar || typeof calendar.email !== "string" || !calendar.email || calendar.email !== normalizeEmail(calendar.email) ||
          emails.has(calendar.email) || !validTimeZone(calendar.timeZone) || !Array.isArray(calendar.windows) || calendar.windows.length > MAX_WINDOWS) throw new Error();
      emails.add(calendar.email);
      const ids = new Set();
      const intervals = calendar.windows.map((window) => {
        if (!window || typeof window.id !== "string" || !window.id || ids.has(window.id)) throw new Error();
        ids.add(window.id);
        const start = minuteTimestamp(window.startAt), end = minuteTimestamp(window.endAt);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 15 * MINUTE || end - start > 24 * 60 * MINUTE) throw new Error();
        return { start, end };
      }).sort((a, b) => a.start - b.start);
      if (intervals.some((interval, index) => index > 0 && interval.start < intervals[index - 1].end)) throw new Error();
    }
    return availability;
  } catch {
    throw new Error("Не удалось прочитать календарь свободного времени. Сохранённые данные не изменены.");
  }
}

export function calendarFor(ledger, email) {
  const normalized = normalizeEmail(email);
  return readAvailability(ledger).calendars.find((calendar) => calendar.email === normalized) || null;
}

export function addAvailabilityWindow(ledger, actor, values, id, now = new Date().toISOString()) {
  const email = actorEmail(actor);
  const availability = readAvailability(ledger);
  const current = availability.calendars.find((calendar) => calendar.email === email);
  const timestamp = nowTimestamp(now);
  // Old windows no longer offer any time. Pruning them does not touch requests.
  const windows = (current?.windows || []).filter((window) => Date.parse(window.endAt) > timestamp);
  if (!validTimeZone(values?.timeZone)) throw new Error("Выберите действующий часовой пояс.");
  const start = minuteTimestamp(values?.startAt), end = minuteTimestamp(values?.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error("Укажите начало и конец окна с точностью до минуты.");
  if (start <= timestamp) throw new Error("Добавьте окно свободного времени в будущем.");
  if (end - start < 15 * MINUTE || end - start > 24 * 60 * MINUTE) throw new Error("Окно должно длиться от 15 минут до 24 часов.");
  if (typeof id !== "string" || !id || windows.some((window) => window.id === id)) throw new Error("Не удалось создать уникальное окно свободного времени.");
  if (windows.length >= MAX_WINDOWS) throw new Error("В календаре может быть не больше 365 окон. Удалите ненужные окна.");
  if (windows.some((window) => overlaps(start, end, Date.parse(window.startAt), Date.parse(window.endAt)))) {
    throw new Error("Это окно пересекается с другим. Выберите другое время.");
  }
  const window = { id, startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString() };
  const calendar = { email, timeZone: values.timeZone, windows: [...windows, window].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)) };
  return { ...ledger, availability: { ...availability, calendars: [...availability.calendars.filter((item) => item.email !== email), calendar] } };
}

export function removeAvailabilityWindow(ledger, actor, id, now = new Date().toISOString()) {
  const email = actorEmail(actor);
  nowTimestamp(now);
  const availability = readAvailability(ledger);
  const current = availability.calendars.find((calendar) => calendar.email === email);
  if (!current?.windows.some((window) => window.id === id)) throw new Error("Окно свободного времени не найдено или недоступно.");
  // Keep an empty calendar: removing the last window must not enable manual booking.
  return { ...ledger, availability: { ...availability, calendars: availability.calendars.map((calendar) =>
    calendar.email === email ? { ...calendar, windows: calendar.windows.filter((window) => window.id !== id) } : calendar) } };
}

export function requestOccupiesTime(request) {
  return OCCUPIED_STATUSES.has(request.status) || (request.status === "pending" && request.calendarBooking === true);
}

function occupiedIntervals(ledger, providerEmail, customerEmail, excludeRequestId) {
  const people = new Set([normalizeEmail(providerEmail), normalizeEmail(customerEmail)].filter(Boolean));
  return readActivity(ledger).requests.filter((request) => request.id !== excludeRequestId && requestOccupiesTime(request) &&
    [request.provider.email, request.customer.email].some((email) => people.has(email))).map((request) => {
    const start = Date.parse(request.scheduledAt);
    return { start, end: start + request.minutes * MINUTE };
  });
}

export function slotsFor(ledger, providerEmail, minutes, { customerEmail, now = new Date().toISOString() } = {}) {
  const calendar = calendarFor(ledger, providerEmail);
  const timestamp = nowTimestamp(now);
  if (!calendar || !validDuration(minutes) || (customerEmail && normalizeEmail(customerEmail) === normalizeEmail(providerEmail))) return [];
  const occupied = occupiedIntervals(ledger, providerEmail, customerEmail);
  const duration = minutes * MINUTE;
  const slots = [];
  for (const window of calendar.windows) {
    const windowStart = Date.parse(window.startAt), windowEnd = Date.parse(window.endAt);
    for (let start = windowStart; start + duration <= windowEnd; start += SLOT_STEP) {
      if (start <= timestamp || occupied.some((interval) => overlaps(start, start + duration, interval.start, interval.end))) continue;
      slots.push({ startAt: new Date(start).toISOString(), endAt: new Date(start + duration).toISOString(), windowId: window.id });
    }
  }
  return slots.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}

export function assertBookable(ledger, providerEmail, startAt, minutes, { customerEmail, excludeRequestId, now = new Date().toISOString() } = {}) {
  const calendar = calendarFor(ledger, providerEmail);
  const timestamp = nowTimestamp(now);
  if (!validDuration(minutes)) throw new Error("Выберите допустимую длительность занятия.");
  if (!calendar) throw new Error("Автор ещё не настроил календарь свободного времени.");
  if (customerEmail && normalizeEmail(customerEmail) === normalizeEmail(providerEmail)) throw new Error("Нельзя отправить заявку на свою услугу.");
  const start = minuteTimestamp(startAt), end = start + minutes * MINUTE;
  const window = calendar.windows.find((item) => {
    const from = Date.parse(item.startAt);
    return start >= from && end <= Date.parse(item.endAt) && (start - from) % SLOT_STEP === 0;
  });
  if (!Number.isFinite(start) || start <= timestamp || !window) throw new Error("Это время недоступно. Выберите другой свободный слот.");
  if (occupiedIntervals(ledger, providerEmail, customerEmail, excludeRequestId).some((interval) => overlaps(start, end, interval.start, interval.end))) {
    throw new Error("Это время уже занято. Выберите другой свободный слот.");
  }
  return { startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), windowId: window.id };
}
