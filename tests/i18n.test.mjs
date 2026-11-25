import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { LANGUAGE_COOKIE, LANGUAGE_KEY, LANGUAGES, normalizeLanguage, translate } from "../lib/i18n.mjs";
import common from "../lib/translations-common.mjs";
import catalog from "../lib/translations-catalog.mjs";
import account from "../lib/translations-account.mjs";
import homeUx from "../lib/translations-home-ux.mjs";
import searchUx from "../lib/translations-search-ux.mjs";
import profileUx from "../lib/translations-profile-ux.mjs";
import offerEditor from "../lib/translations-offer-editor.mjs";
import appearance from "../lib/translations-appearance.mjs";
import workflowUi from "../lib/translations-workflow-ui.mjs";
import workflowCore from "../lib/translations-workflow-core.mjs";
import supportUi from "../lib/translations-support-ui.mjs";
import adminUi from "../lib/translations-admin-ui.mjs";
import supportCore from "../lib/translations-support-core.mjs";
import calendarUi from "../lib/translations-calendar-ui.mjs";
import availabilityCore from "../lib/translations-availability-core.mjs";
import availabilityEditor from "../lib/translations-availability-editor.mjs";
import availabilityPicker from "../lib/translations-availability-picker.mjs";
import { REQUEST_STATUS_LABELS } from "../lib/requests.mjs";
import { SUPPORT_STATUS_LABELS } from "../lib/support.mjs";
import { emptyCatalog, readCatalog, saveOffer, CATALOG_KEY } from "../lib/catalog.mjs";

const dictionaries = { common, catalog, account, homeUx, searchUx, profileUx, offerEditor, appearance, workflowUi, workflowCore, supportUi, adminUi, supportCore, calendarUi, availabilityCore, availabilityEditor, availabilityPicker };
const entries = Object.assign({}, ...Object.values(dictionaries));
const placeholders = (message) => [...new Set([...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort();

test("the language selector offers Russian, Kazakh and English with valid locales", () => {
  assert.deepEqual(LANGUAGES.map(({ code }) => code), ["ru", "kk", "en"]);
  assert.equal(LANGUAGE_KEY, "skillbarter-language");
  assert.equal(LANGUAGE_COOKIE, LANGUAGE_KEY);
  for (const language of LANGUAGES) {
    assert.ok(language.label && language.name);
    assert.equal(new Intl.Locale(language.locale).language, language.code);
    assert.doesNotThrow(() => new Intl.DateTimeFormat(language.locale).format(new Date("2026-11-11T12:00:00Z")));
    assert.equal(normalizeLanguage(language.code), language.code);
  }
});

test("invalid saved language values safely fall back to Russian", () => {
  for (const value of [undefined, null, "", "kz", "fr", "EN", "en-US", "__proto__", 1, {}, []]) {
    assert.equal(normalizeLanguage(value), "ru");
    assert.equal(translate(value, "Разработка"), "Разработка");
  }
});

test("every declared translation supplies Kazakh and English and preserves its parameters", () => {
  for (const [dictionaryName, dictionary] of Object.entries(dictionaries)) {
    assert.ok(Object.keys(dictionary).length > 0, `${dictionaryName} must contain translations`);
    for (const [source, variants] of Object.entries(dictionary)) {
      assert.equal(translate("ru", source), source);
      for (const language of ["kk", "en"]) {
        assert.equal(typeof variants[language], "string", `${dictionaryName}: ${source} (${language})`);
        assert.ok(variants[language].trim(), `${dictionaryName}: empty ${language} translation for ${source}`);
        assert.deepEqual(placeholders(variants[language]), placeholders(source), `${dictionaryName}: changed ${language} parameters for ${source}`);
      }
    }
  }
});

test("the translation API switches language and interpolates every declared message parameter", () => {
  let parameterized = 0;
  for (const [source, variants] of Object.entries(entries)) {
    const keys = placeholders(source);
    const values = Object.fromEntries(keys.map((key) => [key, `${key}: Айару $& <text>`]));
    if (keys.length) parameterized++;
    for (const language of ["kk", "en"]) {
      const expected = variants[language].replace(/\{(\w+)\}/g, (_, key) => values[key]);
      assert.equal(translate(language, source, values), expected, `${language}: ${source}`);
    }
  }
  assert.ok(parameterized > 0, "dynamic UI messages should have translated parameters");
  assert.equal(translate("en", "{name} · {name} · {missing}", { name: "$& Айару" }), "$& Айару · $& Айару · {missing}");
});

test("the updated user journeys declare translations for their static interface text", () => {
  for (const file of [
    "app/page.jsx", "app/find/FindClient.jsx", "components/OfferCard.jsx",
    "components/NewOfferModal.jsx", "app/login/page.jsx", "app/profile/page.jsx",
    "app/day/page.jsx", "app/notifications/page.jsx", "app/requests/page.jsx", "app/requests/[id]/page.jsx",
    "app/admin/page.jsx", "app/support/page.jsx", "app/support/[id]/page.jsx", "components/SupportPanel.jsx", "components/SupportContext.jsx",
    "components/ThemeSwitcher.jsx", "components/LoadingState.jsx", "components/Header.jsx",
    "app/availability/page.jsx", "components/AvailabilityEditor.jsx", "components/AvailabilityPicker.jsx", "components/DateCalendar.jsx", "app/services/page.jsx",
    ...readdirSync(new URL("../components/", import.meta.url)).filter((name) => /^Request.*\.jsx$/.test(name)).map((name) => `components/${name}`),
  ]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    for (const match of source.matchAll(/\bt\(("(?:[^"\\]|\\.)*")/g)) {
      const message = JSON.parse(match[1]);
      assert.ok(Object.hasOwn(entries, message), `${file}: missing translations for ${message}`);
    }
  }
});

test("support states and administrator errors have translations in all interface languages", () => {
  const errors = ["support.mjs", "admin-auth.mjs"].flatMap((file) => {
    const source = readFileSync(new URL(`../lib/${file}`, import.meta.url), "utf8");
    return [...source.matchAll(/new Error\(("(?:[^"\\]|\\.)*")\)/g)].map((match) => JSON.parse(match[1]));
  });
  for (const message of [...Object.values(SUPPORT_STATUS_LABELS), ...errors]) {
    assert.ok(Object.hasOwn(entries, message), `missing support translation for ${message}`);
    for (const language of ["kk", "en"]) assert.equal(translate(language, message), entries[message][language]);
  }
});

test("request states and domain errors have translations for all supported interface languages", () => {
  const source = ["requests.mjs", "availability.mjs"].map((file) => readFileSync(new URL(`../lib/${file}`, import.meta.url), "utf8")).join("\n");
  const errors = [...source.matchAll(/new Error\(("(?:[^"\\]|\\.)*")\)/g)].map((match) => JSON.parse(match[1]));
  for (const message of [...Object.values(REQUEST_STATUS_LABELS), ...errors]) {
    assert.ok(Object.hasOwn(entries, message), `missing workflow translation for ${message}`);
    for (const language of ["kk", "en"]) {
      assert.equal(translate(language, message), entries[message][language]);
    }
  }
});

test("unknown user content and object-prototype names remain unchanged", () => {
  const content = [
    "Я помогаю с React и қазақ тілі · <b>мой текст</b>",
    "Айару Кайрат",
    "Новый авторский курс № 472",
    "toString",
    "constructor",
    "__proto__",
  ];
  for (const language of ["ru", "kk", "en"]) {
    for (const source of content) assert.equal(translate(language, source), source);
  }
});

test("translating catalog labels leaves saved values and filtering identity intact", () => {
  const user = { name: "Автор", email: "author@example.com" };
  const fields = {
    t: "Мой собственный курс № 472", d: "Учимся вместе по авторской программе.",
    cat: "Разработка", f: "Онлайн", l: "Начинающий", lg: "Русский", city: "Алматы", m1: 30, m2: 90,
  };
  const saved = saveOffer(emptyCatalog(), [], user, fields, "localized-offer");
  const serialized = JSON.stringify(saved);
  for (const language of ["kk", "en"]) {
    for (const field of ["cat", "f", "l", "lg"]) {
      assert.equal(translate(language, saved.offers[0][field]), entries[fields[field]][language]);
    }
    assert.equal(translate(language, saved.offers[0].t), fields.t);
    assert.equal(translate(language, saved.offers[0].d), fields.d);
  }
  assert.equal(JSON.stringify(saved), serialized);
  const restored = readCatalog({ getItem: (key) => key === CATALOG_KEY ? serialized : null });
  assert.equal(restored.offers.filter((offer) => offer.cat === "Разработка").length, 1);
  for (const field of ["cat", "f", "l", "lg"]) assert.equal(restored.offers[0][field], fields[field]);
  for (const category of ["Разработка", "Языки", "Дизайн", "Образование", "Карьера", "Другое"]) {
    assert.notEqual(translate("en", category), category, `${category} must have a localized display label`);
  }
});
