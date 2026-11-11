import test from "node:test";
import assert from "node:assert/strict";
import { clearOfferDraft, offerDraftKey, offerEditorChanged, offerEditorValues, readOfferDraft, validateOfferEditor, writeOfferDraft } from "../lib/offer-draft.mjs";
import { offerFields } from "../lib/catalog.mjs";

const author = "author@example.com";
const other = "other@example.com";
const valid = { ...offerEditorValues(), t: "Основы Java", d: "Разберём основы языка и решим задачи вместе.", cat: "Разработка" };
function storage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
}

test("new and edited offer drafts persist independently for each signed-in account", () => {
  const store = storage();
  writeOfferDraft(store, author, undefined, valid);
  writeOfferDraft(store, author, "offer-1", { ...valid, t: "Правки первой услуги" });
  writeOfferDraft(store, author, "offer-2", { ...valid, t: "Правки второй услуги" });
  writeOfferDraft(store, other, undefined, { ...valid, t: "Черновик другого автора" });
  assert.deepEqual(readOfferDraft(store, author), valid);
  assert.equal(readOfferDraft(store, author, "offer-1").t, "Правки первой услуги");
  assert.equal(readOfferDraft(store, author, "offer-2").t, "Правки второй услуги");
  assert.equal(readOfferDraft(store, other).t, "Черновик другого автора");
  assert.equal(readOfferDraft(store, other, "offer-1"), null);
  assert.equal(offerDraftKey(" Author@Example.com "), offerDraftKey(author));
  assert.notEqual(offerDraftKey(author, "new"), offerDraftKey(author));
  assert.throws(() => readOfferDraft(store, ""), /Войдите/);
});

test("incomplete drafts preserve empty fields and edits while ignoring offer metadata", () => {
  const store = storage();
  const draft = { ...valid, t: "", d: "Ещё пишу", m1: "", city: "Астана", email: other, id: "injected" };
  writeOfferDraft(store, author, "offer-1", draft);
  const restored = readOfferDraft(store, author, "offer-1");
  assert.equal(restored.t, "");
  assert.equal(restored.m1, "");
  assert.equal(restored.city, "Астана");
  assert.equal(restored.email, undefined);
  assert.equal(restored.id, undefined);
  assert.equal(offerEditorChanged(valid, restored), true);
  assert.equal(offerEditorChanged(valid, { ...valid }), false);
});

test("clearing a published draft leaves other accounts and other offer drafts intact", () => {
  const store = storage();
  writeOfferDraft(store, author, undefined, valid);
  writeOfferDraft(store, author, "offer-1", valid);
  writeOfferDraft(store, other, undefined, valid);
  clearOfferDraft(store, author);
  assert.equal(readOfferDraft(store, author), null);
  assert.deepEqual(readOfferDraft(store, author, "offer-1"), valid);
  assert.deepEqual(readOfferDraft(store, other), valid);
  clearOfferDraft(store, author, "offer-1");
  assert.equal(readOfferDraft(store, author, "offer-1"), null);
});

test("corrupt drafts are reported and unavailable storage does not produce false save success", () => {
  const store = storage();
  const key = offerDraftKey(author);
  for (const raw of ["{bad", "null", '{"version":2}', JSON.stringify({ version: 1, values: { ...valid, t: 1 } }), JSON.stringify({ version: 1, values: { ...valid, d: "x".repeat(10001) } })]) {
    store.setItem(key, raw);
    assert.throws(() => readOfferDraft(store, author), /Не удалось восстановить черновик/);
    assert.equal(store.getItem(key), raw);
  }
  const unavailable = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); }, removeItem() { throw new Error("blocked"); } };
  assert.throws(() => readOfferDraft(unavailable, author), /blocked/);
  assert.throws(() => writeOfferDraft(unavailable, author, undefined, valid), /quota/);
  assert.throws(() => clearOfferDraft(unavailable, author), /blocked/);
});

test("editor validation identifies the actual invalid fields and accepts catalog-compatible values", () => {
  assert.deepEqual(validateOfferEditor(valid), {});
  assert.doesNotThrow(() => offerFields(valid));
  const invalid = validateOfferEditor({ ...valid, t: " ", d: "мало", cat: "Unknown", lg: " ", m1: "121", m2: "120", f: "Офлайн", city: " " });
  assert.deepEqual(Object.keys(invalid), ["t", "d", "cat", "city", "m2", "lg"]);
  for (const change of [{ m1: "" }, { m1: "14" }, { m2: "481" }, { m2: "30.5" }]) {
    const errors = validateOfferEditor({ ...valid, ...change });
    assert.ok(errors[Object.keys(change)[0]]);
  }
  const offline = { ...valid, f: "Офлайн", city: "Алматы", m1: "15", m2: "480" };
  assert.deepEqual(validateOfferEditor(offline), {});
  assert.doesNotThrow(() => offerFields(offline));
  assert.ok(validateOfferEditor({ ...offline, city: "x".repeat(81) }).city);
  assert.equal(validateOfferEditor({ ...valid, city: "" }).city, undefined);
});
