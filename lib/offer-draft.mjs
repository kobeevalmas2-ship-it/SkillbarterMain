export const OFFER_EDITOR_FIELDS = ["t", "d", "cat", "l", "f", "city", "m1", "m2", "lg"];

export function offerEditorValues(offer) {
  return {
    t: String(offer?.t ?? ""), d: String(offer?.d ?? ""), cat: String(offer?.cat ?? ""),
    l: String(offer?.l ?? "Начинающий"), f: String(offer?.f ?? "Онлайн"),
    city: String(offer?.city ?? ""), m1: String(offer?.m1 ?? 30),
    m2: String(offer?.m2 ?? 120), lg: String(offer?.lg ?? "Русский"),
  };
}

export function offerEditorChanged(previous, next) {
  return OFFER_EDITOR_FIELDS.some((field) => previous[field] !== next[field]);
}

export function offerDraftKey(email, offerId) {
  if (!email?.trim()) throw new Error("Войдите, чтобы управлять своими услугами.");
  return `skillbarter-offer-draft-v1:${encodeURIComponent(email.trim().toLowerCase())}:${offerId ? `edit:${encodeURIComponent(offerId)}` : "new"}`;
}

export function readOfferDraft(storage, email, offerId) {
  const raw = storage.getItem(offerDraftKey(email, offerId));
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw);
    if (draft?.version !== 1 || !draft.values || OFFER_EDITOR_FIELDS.some((field) =>
      typeof draft.values[field] !== "string" || draft.values[field].length > 10000)) throw new Error();
    return Object.fromEntries(OFFER_EDITOR_FIELDS.map((field) => [field, draft.values[field]]));
  } catch {
    throw new Error("Не удалось восстановить черновик. Проверьте заполнение формы.");
  }
}

export function writeOfferDraft(storage, email, offerId, values) {
  const fields = Object.fromEntries(OFFER_EDITOR_FIELDS.map((field) => [field, String(values[field] ?? "")]));
  storage.setItem(offerDraftKey(email, offerId), JSON.stringify({ version: 1, values: fields }));
}

export function clearOfferDraft(storage, email, offerId) {
  storage.removeItem(offerDraftKey(email, offerId));
}

export function validateOfferEditor(values) {
  const errors = {};
  const title = values.t.trim(), description = values.d.trim(), city = values.city.trim(), language = values.lg.trim();
  if (title.length < 3 || title.length > 120) errors.t = "Название должно содержать от 3 до 120 символов.";
  if (description.length < 10 || description.length > 3000) errors.d = "Описание должно содержать от 10 до 3000 символов.";
  if (!["Разработка", "Языки", "Дизайн", "Образование", "Карьера", "Другое"].includes(values.cat)) errors.cat = "Выберите категорию услуги.";
  if (!["Начинающий", "Средний", "Продвинутый"].includes(values.l)) errors.l = "Выберите уровень подготовки.";
  if (!["Онлайн", "Офлайн"].includes(values.f)) errors.f = "Выберите формат встречи.";
  if (values.f === "Офлайн" && !city) errors.city = "Укажите город для офлайн-встречи.";
  else if (values.f === "Офлайн" && city.length > 80) errors.city = "Город должен содержать не больше 80 символов.";
  for (const field of ["m1", "m2"]) {
    const minutes = Number(values[field]);
    if (!Number.isInteger(minutes) || minutes < 15 || minutes > 480) errors[field] = "Введите целое число от 15 до 480 минут.";
  }
  if (!errors.m1 && !errors.m2 && Number(values.m1) > Number(values.m2)) errors.m2 = "Максимальная длительность не должна быть меньше минимальной.";
  if (!language || language.length > 80) errors.lg = "Укажите язык общения: от 1 до 80 символов.";
  return errors;
}
