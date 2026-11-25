"use client";

import { useLanguage } from "./LanguageContext";
import { LANGUAGES } from "@/lib/i18n.mjs";

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div role="group" aria-label={t("Язык интерфейса")} className="flex shrink-0 border-2 border-ink bg-card font-mono text-xs font-bold">
      {LANGUAGES.map(({ code, label, name }) => (
        <button key={code} type="button" lang={code} aria-label={name} title={name}
          aria-pressed={language === code} onClick={() => setLanguage(code)}
          className={`relative min-w-8 sm:min-w-9 min-h-9 px-1.5 sm:px-2 transition-colors focus-visible:z-10 ${code !== "ru" ? "border-l-2 border-ink" : ""} ${language === code ? "bg-y text-k" : "text-ink hover:bg-ink/10"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}
