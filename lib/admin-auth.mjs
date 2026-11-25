export const ADMIN_EMAIL = "admin@skillbarter.local";
export const ADMIN_PASSWORD = "Admin12345!";
export const adminAccount = Object.freeze({
  name: "Администратор поддержки",
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
  role: "admin",
});

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const PROFILE_FIELDS = ["name", "city", "about", "skills", "avatar"];

export function isAdminActor(actor) {
  return Boolean(actor && actor.role === "admin" && (actor.email === ADMIN_EMAIL || actor.verified === true));
}

// Filled by the server from trusted Supabase profiles, never from API input.
export function adminEmailsFor(ledger) {
  return [ADMIN_EMAIL, ...(Array.isArray(ledger.adminEmails) ? ledger.adminEmails : [])];
}

export function ensureAdminAccount(users) {
  if (!Array.isArray(users) || users.some((account) => !account || typeof account.email !== "string" ||
    typeof account.name !== "string" || typeof account.password !== "string")) {
    throw new Error("Не удалось прочитать аккаунты. Сохранённые данные не изменены.");
  }
  const existing = users.find((account) => normalizeEmail(account.email) === ADMIN_EMAIL);
  if (!existing) return [...users, { ...adminAccount }];
  if (existing.email === ADMIN_EMAIL && existing.role === "admin") return users;
  // The reserved support account keeps its credentials, profile and linked history.
  return users.map((account) => account === existing ? { ...account, email: ADMIN_EMAIL, role: "admin" } : account);
}

export function profileFromAccount(account) {
  const { password, sessionToken, role, ...profile } = account;
  return { ...profile, email: normalizeEmail(account.email), role: isAdminActor(account) ? "admin" : "user" };
}

export function registeredAccount(values, sessionToken) {
  const email = normalizeEmail(values.email);
  const name = String(values.name || "").trim();
  if (email === ADMIN_EMAIL) throw new Error("Этот адрес зарезервирован для администратора поддержки.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Введите корректный адрес электронной почты.");
  if (name.length < 2 || name.length > 50) throw new Error("Имя должно содержать от 2 до 50 символов.");
  if (typeof values.password !== "string" || values.password.length < 6) throw new Error("Пароль должен содержать не менее 6 символов.");
  return { name, email, password: values.password, role: "user", sessionToken };
}

export function startAccountSession(users, values, sessionToken) {
  const email = normalizeEmail(values.email);
  const current = users.find((account) => normalizeEmail(account.email) === email && account.password === values.password);
  if (!current) throw new Error("Неверный адрес электронной почты или пароль.");
  const updated = { ...current, email, sessionToken };
  const profile = profileFromAccount(updated);
  return {
    users: users.map((account) => account === current ? updated : account),
    profile,
    session: { ...profile, token: sessionToken },
  };
}

export function restoreSessionProfile(users, session) {
  if (!session || typeof session.email !== "string") return null;
  const account = users.find((item) => normalizeEmail(item.email) === normalizeEmail(session.email));
  if (!account) return null;
  if (isAdminActor(account) && (!session.token || session.token !== account.sessionToken)) return null;
  if (session.token && session.token !== account.sessionToken) return null;
  return profileFromAccount(account);
}

export function updateAccountProfile(account, changes) {
  const allowed = Object.fromEntries(PROFILE_FIELDS.filter((field) => Object.hasOwn(changes, field)).map((field) => [field, changes[field]]));
  const next = { ...account, ...allowed };
  if (typeof next.name !== "string" || next.name.trim().length < 2 || next.name.trim().length > 50) {
    throw new Error("Имя должно содержать от 2 до 50 символов.");
  }
  if ((next.city !== undefined && (typeof next.city !== "string" || next.city.length > 80)) ||
    (next.about !== undefined && (typeof next.about !== "string" || next.about.length > 500)) ||
    (next.avatar !== undefined && (typeof next.avatar !== "string" || next.avatar.length > 1500000)) ||
    (next.skills !== undefined && (!Array.isArray(next.skills) || next.skills.length > 12 || next.skills.some((skill) => typeof skill !== "string" || skill.length > 80)))) {
    throw new Error("Не удалось сохранить профиль.");
  }
  return { ...next, name: next.name.trim() };
}
