"use client";

import { useEffect, useId, useState } from "react";
import { useLanguage } from "./LanguageContext";
import { dayFromKey, localDateKey } from "@/lib/calendar-dates.mjs";

function monthOffset(month, offset) {
  const date = dayFromKey(`${month}-01`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export default function DateCalendar({ value = "", onChange, min, max, markedDates = [], disabled = false }) {
  const { t, locale } = useLanguage();
  const titleId = useId();
  const [month, setMonth] = useState("");
  useEffect(() => {
    const key = dayFromKey(value) ? value : dayFromKey(min) ? min : localDateKey();
    if (value || !month) setMonth(key.slice(0, 7));
  }, [value, min]);
  if (!month) return null;
  const first = dayFromKey(`${month}-01`);
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12));
  const previous = monthOffset(month, -1), next = monthOffset(month, 1);
  const offset = (first.getUTCDay() + 6) % 7;
  const marked = new Set(markedDates);
  const dayLabel = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const weekdayLabel = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 0, 5 + i, 12)));

  return <div className="min-w-0 border-2 border-ink bg-card p-3 sm:p-4" role="group" aria-labelledby={titleId}>
    <div className="flex justify-between items-center gap-2 mb-4">
      <button type="button" aria-label={t("Предыдущий месяц")} disabled={disabled || Boolean(min && month <= min.slice(0, 7))}
        onClick={() => setMonth(previous)} className="border-2 border-ink w-9 h-9 shrink-0 font-bold disabled:opacity-30">←</button>
      <p id={titleId} aria-live="polite" className="text-center font-bold text-sm capitalize">{new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(first)}</p>
      <button type="button" aria-label={t("Следующий месяц")} disabled={disabled || Boolean(max && month >= max.slice(0, 7))}
        onClick={() => setMonth(next)} className="border-2 border-ink w-9 h-9 shrink-0 font-bold disabled:opacity-30">→</button>
    </div>
    <div className="grid grid-cols-7 gap-1 text-center">
      {weekdays.map((day) => <span key={day.toISOString()} className="text-[11px] text-ink/60 font-semibold py-1">{weekdayLabel.format(day)}</span>)}
      {Array.from({ length: offset }, (_, i) => <span key={`empty:${i}`} aria-hidden="true" />)}
      {Array.from({ length: last.getUTCDate() }, (_, i) => {
        const key = `${month}-${String(i + 1).padStart(2, "0")}`;
        const selected = key === value;
        const available = marked.has(key);
        return <button key={key} type="button" data-date={key} aria-pressed={selected}
          aria-label={`${dayLabel.format(dayFromKey(key))}${available ? `, ${t("Есть свободное время")}` : ""}`}
          disabled={disabled || Boolean(min && key < min) || Boolean(max && key > max)} onClick={() => onChange(key)}
          className={`relative min-h-10 border-2 text-sm font-semibold disabled:opacity-25 ${selected ? "bg-y text-k border-ink" : available ? "bg-lb text-k border-ink" : "border-transparent hover:border-ink"}`}>
          {i + 1}{available && <span aria-hidden="true" className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-current rounded-full" />}
        </button>;
      })}
    </div>
    <p className="text-xs text-ink/60 mt-3">{t("Голубым отмечены дни со свободным временем.")}</p>
  </div>;
}
