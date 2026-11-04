export const WALLET_KEY = "skillbarter-wallet-v1";
export const STARTING_MINUTES = 120;

// These are the authors of the sample offers, available for local demo transfers.
export const DEMO_PARTICIPANTS = [
  { name: "Айару Кайрат", email: "aiaru@skillbarter.local" },
  { name: "Алмас Кобеев", email: "almas@skillbarter.local" },
  { name: "Сымбат Кылыш", email: "symbat@skillbarter.local" },
  { name: "Баянсулу Жойлоу", email: "bayansulu@skillbarter.local" },
];

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function emptyLedger() {
  return { version: 1, accounts: [], transactions: [] };
}

export function readLedger(storage) {
  const raw = storage.getItem(WALLET_KEY);
  if (!raw) return emptyLedger();
  try {
    const ledger = JSON.parse(raw);
    if (ledger.version !== 1 || !Array.isArray(ledger.accounts) || !Array.isArray(ledger.transactions)) throw new Error();
    if (ledger.accounts.some((account) => typeof account.email !== "string" || typeof account.name !== "string")) throw new Error();
    if (ledger.transactions.some((tx) =>
      typeof tx.id !== "string" || !Number.isSafeInteger(tx.minutes) || tx.minutes <= 0 ||
      !["bonus", "transfer", "service"].includes(tx.type) || typeof tx.to !== "string" ||
      (tx.type === "bonus" ? tx.from !== null : typeof tx.from !== "string") ||
      typeof tx.note !== "string" || !Number.isFinite(Date.parse(tx.createdAt))
    )) throw new Error();
    return ledger;
  } catch {
    throw new Error("Не удалось прочитать историю кошелька. Сохранённые данные не изменены.");
  }
}

export function ensureAccount(ledger, profile, now = new Date().toISOString()) {
  const email = normalizeEmail(profile.email);
  if (!email || !profile.name?.trim()) throw new Error("Не указан участник перевода.");
  if (ledger.accounts.some((account) => account.email === email)) return ledger;
  return {
    ...ledger,
    accounts: [...ledger.accounts, { email, name: profile.name.trim() }],
    transactions: [{ id: `welcome:${email}`, from: null, to: email, minutes: STARTING_MINUTES,
      type: "bonus", note: "Стартовые минуты за регистрацию", createdAt: now }, ...ledger.transactions],
  };
}

export function balanceFor(ledger, email) {
  const account = normalizeEmail(email);
  return ledger.transactions.reduce((balance, tx) =>
    balance + (tx.to === account ? tx.minutes : 0) - (tx.from === account ? tx.minutes : 0), 0);
}

export function historyFor(ledger, email) {
  const account = normalizeEmail(email);
  return ledger.transactions.filter((tx) => tx.to === account || tx.from === account);
}

// One ledger snapshot holds both sides of a transfer; balances are derived from it.
export function createTransfer(ledger, { id, from, to, minutes, note = "", type = "transfer", offerId }, now = new Date().toISOString()) {
  const sender = normalizeEmail(from);
  const recipient = normalizeEmail(to);
  const description = String(note).trim();
  if (!id || typeof id !== "string") throw new Error("Не удалось создать номер перевода.");
  if (!["transfer", "service"].includes(type)) throw new Error("Неизвестный тип операции.");
  if (offerId !== undefined && (typeof offerId !== "string" || !offerId || type !== "service")) throw new Error("Некорректная услуга для оплаты.");
  if (!Number.isSafeInteger(minutes) || minutes <= 0) throw new Error("Введите целое количество минут больше нуля.");
  if (sender === recipient) throw new Error("Нельзя перевести минуты самому себе.");
  if (!ledger.accounts.some((account) => account.email === sender)) throw new Error("Войдите в аккаунт для перевода.");
  if (!ledger.accounts.some((account) => account.email === recipient)) throw new Error("Участник с такой почтой не найден.");
  if (description.length > 200) throw new Error("Назначение должно быть не длиннее 200 символов.");
  const existing = ledger.transactions.find((tx) => tx.id === id);
  if (existing) {
    if (existing.from === sender && existing.to === recipient && existing.minutes === minutes && existing.note === description && existing.type === type && existing.offerId === offerId) return ledger;
    throw new Error("Этот номер операции уже использован.");
  }
  if (balanceFor(ledger, sender) < minutes) throw new Error("Недостаточно минут на балансе. Уменьшите сумму перевода.");
  return { ...ledger, transactions: [{ id, from: sender, to: recipient, minutes,
    note: description, type, ...(offerId ? { offerId } : {}), createdAt: now }, ...ledger.transactions] };
}
