"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { LANGUAGES, LANGUAGE_COOKIE, LANGUAGE_KEY, normalizeLanguage, translate } from "@/lib/i18n.mjs";

const LanguageContext = createContext(null);
const PAGE_TITLES = {
  "/find": "Найти помощь — SkillBarter",
  "/services": "Мои услуги — SkillBarter",
  "/favorites": "Избранное — SkillBarter",
  "/login": "Вход — SkillBarter",
  "/profile": "Профиль — SkillBarter",
  "/wallet": "Кошелёк и история транзакций · SkillBarter",
  "/day": "Мой день — SkillBarter",
  "/requests": "Заявки — SkillBarter",
  "/notifications": "Уведомления — SkillBarter",
};

export function LanguageProvider({ children, initialLanguage = "ru" }) {
  const [language, setCurrentLanguage] = useState(() => normalizeLanguage(initialLanguage));
  const path = usePathname();

  const setLanguage = useCallback((value) => {
    const selected = normalizeLanguage(value);
    setCurrentLanguage(selected);
    document.documentElement.lang = selected;
    // Interface switching still works when browser storage is unavailable.
    try { localStorage.setItem(LANGUAGE_KEY, selected); } catch {}
    document.cookie = `${LANGUAGE_COOKIE}=${selected}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_KEY);
      if (LANGUAGES.some(({ code }) => code === saved)) setLanguage(saved);
    } catch {}
    const onStorage = (event) => {
      if (event.key === LANGUAGE_KEY || event.key === null) setLanguage(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [setLanguage]);

  const t = useCallback((source, values) => translate(language, source, values), [language]);
  const locale = LANGUAGES.find(({ code }) => code === language).locale;

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t(PAGE_TITLES[path] || (path?.startsWith("/requests/") ? "Заявка и чат — SkillBarter" : path?.startsWith("/offers/") ? "Услуга · SkillBarter" : "SkillBarter"));
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = t(path?.startsWith("/offers/") ? "Подробности услуги и оплата временем" : "Обмен навыками за время");
  }, [language, path, t]);

  const value = useMemo(() => ({ language, locale, setLanguage, t }), [language, locale, setLanguage, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
