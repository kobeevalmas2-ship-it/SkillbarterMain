"use client";

import { useLanguage } from "./LanguageContext";
import { useTheme } from "./ThemeProvider";

export default function ThemeSwitcher() {
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  return (
    <label className="inline-flex shrink-0 items-center">
      <span className="sr-only">{t("Тема оформления")}</span>
      <select value={theme} onChange={(event) => setTheme(event.target.value)}
        className="max-w-[138px] min-h-10 border-2 border-ink bg-card text-ink px-2 text-xs font-semibold cursor-pointer"
        title={t("Тема оформления")}>
        <option value="light">☀ {t("Светлая")}</option>
        <option value="dark">☾ {t("Тёмная")}</option>
        <option value="system">◐ {t("Системная")}</option>
      </select>
    </label>
  );
}
