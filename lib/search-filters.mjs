const CATEGORIES = ["Разработка", "Языки", "Дизайн", "Образование", "Карьера", "Другое"];
export const EMPTY_FILTERS = Object.freeze({ q: "", cat: "", fmt: "", city: "", sort: "new" });

export function readSearchFilters(params = {}) {
  const value = (key) => {
    const input = typeof params.get === "function" ? params.get(key) : params[key];
    return typeof input === "string" ? input : "";
  };
  const cat = value("cat"), fmt = value("fmt");
  return {
    q: value("q").slice(0, 200),
    cat: CATEGORIES.includes(cat) ? cat : "",
    fmt: ["Онлайн", "Офлайн"].includes(fmt) ? fmt : "",
    city: value("city").slice(0, 80),
    sort: value("sort") === "min" ? "min" : "new",
  };
}

export function findHref(filters) {
  const normalized = readSearchFilters(filters);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(normalized)) {
    if (value && !(key === "sort" && value === "new")) params.set(key, value);
  }
  return params.size ? `/find?${params}` : "/find";
}

// Return links can only point to the catalog, with recognized search parameters.
export function catalogReturnHref(value) {
  if (value === "/find") return value;
  if (typeof value !== "string" || !value.startsWith("/find?") || value.includes("#")) return null;
  return findHref(readSearchFilters(new URLSearchParams(value.slice(6))));
}

export function filterOffers(offers, filters) {
  const { q, cat, fmt, city, sort } = readSearchFilters(filters);
  const query = q.trim().toLowerCase(), location = city.trim().toLowerCase();
  const matches = offers.filter((offer) =>
    (!cat || offer.cat === cat) &&
    (!fmt || offer.f === fmt) &&
    (!location || (offer.city || "").toLowerCase().includes(location)) &&
    `${offer.t} ${offer.d}`.toLowerCase().includes(query)
  );
  return sort === "min"
    ? matches.sort((a, b) => a.m1 - b.m1 || a.m2 - b.m2)
    : matches.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}
