export const CATALOG_KEY = "skillbarter-catalog-v1";

export function emptyCatalog() {
  return { version: 1, offers: [], favorites: {} };
}

export function readCatalog(storage) {
  const raw = storage.getItem(CATALOG_KEY);
  if (!raw) return emptyCatalog();
  try {
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.offers) || !data.favorites || typeof data.favorites !== "object" || Array.isArray(data.favorites)) throw new Error();
    if (data.offers.some((offer) => !offer || typeof offer.id !== "string" || typeof offer.email !== "string" || typeof offer.t !== "string" || typeof offer.d !== "string" || !Number.isInteger(offer.m1) || !Number.isInteger(offer.m2))) throw new Error();
    if (Object.values(data.favorites).some((ids) => !Array.isArray(ids) || ids.some((id) => typeof id !== "string"))) throw new Error();
    return data;
  } catch {
    throw new Error("Не удалось прочитать сохранённые услуги и избранное. Данные не изменены.");
  }
}

export function allOffers(catalog, defaults) {
  const savedIds = new Set(catalog.offers.map((offer) => offer.id));
  return [...catalog.offers, ...defaults.filter((offer) => !savedIds.has(offer.id))];
}

export function offerFields(values) {
  const t = String(values.t || "").trim();
  const d = String(values.d || "").trim();
  const city = String(values.city || "").trim();
  const lg = String(values.lg || "Русский").trim();
  const m1 = Number(values.m1);
  const m2 = Number(values.m2);
  if (t.length < 3 || t.length > 120) throw new Error("Название должно содержать от 3 до 120 символов.");
  if (d.length < 10 || d.length > 3000) throw new Error("Описание должно содержать от 10 до 3000 символов.");
  if (!["Разработка", "Языки", "Дизайн", "Образование", "Карьера", "Другое"].includes(values.cat)) throw new Error("Выберите категорию услуги.");
  if (!["Онлайн", "Офлайн"].includes(values.f)) throw new Error("Выберите формат встречи.");
  if (!["Начинающий", "Средний", "Продвинутый"].includes(values.l)) throw new Error("Выберите уровень подготовки.");
  if (![m1, m2].every((n) => Number.isInteger(n) && n >= 15 && n <= 480) || m1 > m2) throw new Error("Укажите длительность от 15 до 480 минут. Минимум не должен превышать максимум.");
  if (values.f === "Офлайн" && !city) throw new Error("Укажите город для офлайн-встречи.");
  if (city.length > 80 || !lg || lg.length > 80) throw new Error("Проверьте город и язык общения: не больше 80 символов.");
  return { t, d, cat: values.cat, f: values.f, l: values.l, city, lg, m1, m2, min: `${m1}–${m2}`, v: m2 };
}

export function saveOffer(catalog, defaults, user, values, id, editing = false, now = new Date().toISOString()) {
  if (!user?.email || !user?.name) throw new Error("Войдите, чтобы управлять своими услугами.");
  const email = user.email.trim().toLowerCase();
  const existing = allOffers(catalog, defaults).find((offer) => offer.id === id);
  if (editing && !existing) throw new Error("Услуга не найдена.");
  if (existing && (!editing || existing.email !== email)) throw new Error("Можно редактировать только свои услуги.");
  const fields = offerFields(values);
  const offer = { ...fields, id, email, n: existing?.n || user.name, i: existing?.i || user.name.slice(0, 2).toUpperCase(),
    createdAt: existing?.createdAt || now, updatedAt: now };
  return { ...catalog, offers: [offer, ...catalog.offers.filter((item) => item.id !== id)] };
}

export function setFavorite(catalog, email, id, selected, defaults) {
  if (!email) throw new Error("Войдите, чтобы сохранять избранное.");
  if (!allOffers(catalog, defaults).some((offer) => offer.id === id)) throw new Error("Услуга не найдена.");
  const previous = catalog.favorites[email] || [];
  const ids = selected ? [...new Set([...previous, id])] : previous.filter((item) => item !== id);
  return { ...catalog, favorites: { ...catalog.favorites, [email]: ids } };
}

export function serviceQuote(offer, minutes) {
  if (!offer) throw new Error("Услуга больше недоступна.");
  if (!Number.isInteger(minutes) || minutes < offer.m1 || minutes > offer.m2) throw new Error(`Выберите длительность от ${offer.m1} до ${offer.m2} минут.`);
  return { offerId: offer.id, to: offer.email, minutes, note: offer.t, type: "service" };
}
