import test from "node:test";
import assert from "node:assert/strict";
import { allOffers, CATALOG_KEY, emptyCatalog, readCatalog, saveOffer, serviceQuote, setFavorite } from "../lib/catalog.mjs";
import { balanceFor, createTransfer, emptyLedger, ensureAccount } from "../lib/wallet.mjs";

const author = { name: "Автор", email: "author@example.com" };
const customer = { name: "Участник", email: "customer@example.com" };
const values = { t: "Занятие по Java", d: "Разберём основы Java и решим задачи вместе.", cat: "Разработка", f: "Онлайн", l: "Начинающий", lg: "Русский", city: "Алматы", m1: "30", m2: "120" };
const defaults = [{ ...values, id: "demo", email: author.email, m1: 30, m2: 120 }];

test("creating and editing preserves service identity and author across reloads", () => {
  const created = saveOffer(emptyCatalog(), defaults, author, values, "my-offer", false, "2026-11-04T10:00:00Z");
  const changed = saveOffer(created, defaults, author, { ...values, t: "Java с практикой", m2: "90", email: customer.email, id: "other" }, "my-offer", true);
  assert.equal(changed.offers.length, 1);
  assert.equal(changed.offers[0].id, "my-offer");
  assert.equal(changed.offers[0].email, author.email);
  assert.equal(changed.offers[0].min, "30–90");
  assert.equal(changed.offers[0].createdAt, created.offers[0].createdAt);
  assert.equal(created.offers[0].t, values.t);
  const restored = readCatalog({ getItem: (key) => key === CATALOG_KEY ? JSON.stringify(changed) : null });
  assert.equal(restored.offers[0].t, "Java с практикой");
});

test("guests and other participants cannot create or change someone else's service", () => {
  assert.throws(() => saveOffer(emptyCatalog(), defaults, null, values, "new"), /Войдите/);
  assert.throws(() => saveOffer(emptyCatalog(), defaults, customer, values, "demo", true), /только свои/);
  assert.throws(() => saveOffer(emptyCatalog(), defaults, author, values, "missing", true), /не найдена/);
});

test("editing a demo service overrides it without duplicating it in the catalog", () => {
  const catalog = saveOffer(emptyCatalog(), defaults, author, { ...values, t: "Обновлённая услуга" }, "demo", true);
  const offers = allOffers(catalog, defaults);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].t, "Обновлённая услуга");
});

test("invalid durations, missing offline city and short descriptions are rejected", () => {
  for (const change of [{ m1: 121 }, { m2: 481 }, { m1: 1.5 }, { m1: 0 }, { m2: "" }, { d: "мало" }, { f: "Офлайн", city: " " }, { cat: "Unknown" }]) {
    assert.throws(() => saveOffer(emptyCatalog(), defaults, author, { ...values, ...change }, "new"));
  }
});

test("favorites are separate per account and remain connected to edited services", () => {
  let catalog = setFavorite(emptyCatalog(), customer.email, "demo", true, defaults);
  catalog = setFavorite(catalog, customer.email, "demo", true, defaults);
  assert.deepEqual(catalog.favorites[customer.email], ["demo"]);
  assert.equal(catalog.favorites[author.email], undefined);
  catalog = saveOffer(catalog, defaults, author, { ...values, t: "Новое название" }, "demo", true);
  assert.equal(allOffers(catalog, defaults).find((offer) => catalog.favorites[customer.email].includes(offer.id)).t, "Новое название");
  catalog = setFavorite(catalog, customer.email, "demo", false, defaults);
  assert.deepEqual(catalog.favorites[customer.email], []);
  assert.throws(() => setFavorite(catalog, "", "demo", true, defaults), /Войдите/);
});

test("corrupt catalog storage is reported instead of discarded", () => {
  for (const raw of ["{bad", "null", '{"version":2}', '{"version":1,"offers":[],"favorites":{"test":"bad"}}']) {
    assert.throws(() => readCatalog({ getItem: () => raw }), /Данные не изменены/);
  }
});

test("service checkout enforces duration and attaches the stable offer ID to one payment", () => {
  const quote = serviceQuote(defaults[0], 60);
  assert.equal(quote.offerId, "demo");
  for (const minutes of [0, 29, 121, 30.5]) assert.throws(() => serviceQuote(defaults[0], minutes), /длительность/);
  let ledger = ensureAccount(ensureAccount(emptyLedger(), author), customer);
  const request = { ...quote, id: "pay-1", from: customer.email };
  ledger = createTransfer(ledger, request);
  assert.equal(balanceFor(ledger, customer.email), 60);
  assert.equal(balanceFor(ledger, author.email), 180);
  assert.equal(ledger.transactions[0].offerId, "demo");
  assert.equal(createTransfer(ledger, request), ledger);
  assert.throws(() => createTransfer(ledger, { ...request, offerId: "another" }), /номер операции/);
});
