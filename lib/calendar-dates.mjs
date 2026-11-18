export function localDateKey(date = new Date()) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Calendar days are date-only values. Use UTC when formatting this Date.
export function dayFromKey(key) {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = new Date(`${key}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === key ? date : null;
}

export function parseLocalDateTime(day, time) {
  if (!dayFromKey(day) || typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const date = new Date(`${day}T${time}:00`);
  // Reject dates/times normalized by the engine, including skipped DST hours.
  return localDateKey(date) === day && date.getHours() === Number(time.slice(0, 2)) && date.getMinutes() === Number(time.slice(3)) ? date : null;
}
