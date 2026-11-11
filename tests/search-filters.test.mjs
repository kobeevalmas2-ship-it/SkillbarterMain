import test from "node:test";
import assert from "node:assert/strict";
import { EMPTY_FILTERS, readSearchFilters, findHref, catalogReturnHref, filterOffers } from "../lib/search-filters.mjs";

test("catalog links preserve all filters, Cyrillic and special characters", () => {
  const filters = { q: "C++ & дизайн?", cat: "Дизайн", fmt: "Офлайн", city: "Астана", sort: "min" };
  const href = findHref(filters);
  assert.ok(href.startsWith("/find?"));
  assert.deepEqual(readSearchFilters(new URLSearchParams(href.slice(6))), filters);
  assert.equal(findHref(EMPTY_FILTERS), "/find");
});

test("unknown and repeated parameters cannot become unsupported filter values", () => {
  assert.deepEqual(readSearchFilters({ cat: ["Языки", "Дизайн"], fmt: "remote", sort: "__proto__", q: null }), EMPTY_FILTERS);
  assert.deepEqual(readSearchFilters(new URLSearchParams("cat=invalid&fmt=invalid&sort=invalid")), EMPTY_FILTERS);
});

test("service return links only accept the local catalog and known parameters", () => {
  for (const href of [null, "https://example.com/find", "//example.com/find", "/find/other", "/find#test", "/find?cat=Языки#test", "javascript:alert(1)", "/find\\@example.com"]) {
    assert.equal(catalogReturnHref(href), null, String(href));
  }
  assert.equal(catalogReturnHref("/find?next=https://example.com"), "/find");
  assert.equal(catalogReturnHref(findHref({ q: "Java", cat: "Разработка" })), findHref({ q: "Java", cat: "Разработка" }));
});

test("combined filters ignore casing and surrounding whitespace and never mutate the catalog", () => {
  const offers = [
    { t: "Figma", d: "Основы дизайна", cat: "Дизайн", f: "Офлайн", city: "Астана", m1: 60, m2: 120 },
    { t: "Java", d: "Первый проект", cat: "Разработка", f: "Онлайн", city: "Алматы", m1: 30, m2: 120 },
    { t: "Figma", d: "Компоненты", cat: "Дизайн", f: "Офлайн", city: "Астана", m1: 30, m2: 90 },
  ];
  const copy = structuredClone(offers);
  assert.deepEqual(filterOffers(offers, { q: "  FIGMA ", cat: "Дизайн", fmt: "Офлайн", city: " астана ", sort: "min" }), [offers[2], offers[0]]);
  assert.deepEqual(offers, copy);
  assert.equal(filterOffers(offers, { q: "проект" })[0], offers[1]);
});

test("newest sorting uses publication time instead of moving edited older offers first", () => {
  const offers = [
    { t: "Edited older offer", d: "", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-11-11T00:00:00Z" },
    { t: "Demo A", d: "" },
    { t: "New offer", d: "", createdAt: "2026-10-01T00:00:00Z" },
    { t: "Demo B", d: "" },
  ];
  assert.deepEqual(filterOffers(offers, {}), [offers[2], offers[0], offers[1], offers[3]]);
});
