import common from "./translations-common.mjs";
import catalog from "./translations-catalog.mjs";
import account from "./translations-account.mjs";
import homeUx from "./translations-home-ux.mjs";
import searchUx from "./translations-search-ux.mjs";
import profileUx from "./translations-profile-ux.mjs";
import offerEditor from "./translations-offer-editor.mjs";
import appearance from "./translations-appearance.mjs";
import workflowUi from "./translations-workflow-ui.mjs";
import workflowCore from "./translations-workflow-core.mjs";

export const LANGUAGE_KEY = "skillbarter-language";
export const LANGUAGE_COOKIE = "skillbarter-language";
export const LANGUAGES = Object.freeze([
  { code: "ru", label: "RU", name: "Русский", locale: "ru-RU" },
  { code: "kk", label: "KZ", name: "Қазақша", locale: "kk-KZ" },
  { code: "en", label: "EN", name: "English", locale: "en-US" },
]);

export function normalizeLanguage(value) {
  return LANGUAGES.some(({ code }) => code === value) ? value : "ru";
}

const translations = { ...common, ...catalog, ...account, ...homeUx, ...searchUx, ...profileUx, ...offerEditor, ...appearance, ...workflowUi, ...workflowCore };

// Russian source strings also serve as stable keys. Stored domain values stay unchanged.
export function translate(language, source, values = {}) {
  const selected = normalizeLanguage(language);
  const entry = Object.hasOwn(translations, source) ? translations[source] : null;
  const message = selected === "ru" ? source : entry?.[selected] || source;
  return String(message).replace(/\{(\w+)\}/g, (placeholder, key) =>
    Object.hasOwn(values, key) ? String(values[key]) : placeholder);
}
