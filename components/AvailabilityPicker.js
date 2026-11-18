"use client";

import DateCalendar from "./DateCalendar";
import { useLanguage } from "./LanguageContext";
import { dayFromKey, localDateKey } from "@/lib/calendar-dates.mjs";

export default function AvailabilityPicker({ slots, value, onChange, selectedDay, onDayChange, minutes, validDuration, disabled = false }) {
  const { t, locale } = useLanguage();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const markedDates = [...new Set(slots.map((slot) => localDateKey(new Date(slot.startAt))))].sort();
  const daySlots = slots.filter((slot) => localDateKey(new Date(slot.startAt)) === selectedDay);
  const selected = daySlots.find((slot) => slot.startAt === value);
  const time = (date) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(date));
  const zoneName = (date) => new Intl.DateTimeFormat(locale, { timeZoneName: "short" }).formatToParts(new Date(date)).find((part) => part.type === "timeZoneName")?.value || timeZone;
  const fullDateTime = (date) => new Intl.DateTimeFormat(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(new Date(date));
  const dayTitle = selectedDay ? new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" }).format(dayFromKey(selectedDay)) : "";

  return <fieldset disabled={disabled} className="min-w-0 grid gap-3" aria-describedby="availability-timezone">
    <legend className="text-sm font-semibold mb-2">{t("Свободное время исполнителя")}</legend>
    <p id="availability-timezone" className="text-xs text-ink/65">{t("Время по часовому поясу вашего устройства: {timeZone}.", { timeZone })}</p>
    <DateCalendar value={selectedDay} onChange={onDayChange} min={localDateKey()} markedDates={markedDates} disabled={disabled || !validDuration} />
    {dayTitle && <h3 className="font-semibold text-sm capitalize">{dayTitle}</h3>}
    {!validDuration ? <p role="status" className="text-sm text-ink/70">{t("Укажите допустимую длительность, чтобы увидеть свободное время.")}</p> : daySlots.length > 0 ? <div role="group" aria-label={t("Доступные слоты на выбранный день")} className="grid grid-cols-2 gap-2">
      {daySlots.map((slot) => <button key={`${slot.windowId}:${slot.startAt}`} type="button" aria-pressed={value === slot.startAt}
        aria-label={t("С {start} до {end}", { start: fullDateTime(slot.startAt), end: fullDateTime(slot.endAt) })}
        onClick={() => onChange(slot.startAt)} disabled={disabled}
        className={`border-2 border-ink px-2 py-2.5 text-sm font-semibold disabled:opacity-50 ${value === slot.startAt ? "bg-y text-k shs" : "bg-card"}`}>
        {time(slot.startAt)}–{time(slot.endAt)}
        <span className="block text-xs font-normal mt-1">{zoneName(slot.startAt)}{zoneName(slot.endAt) !== zoneName(slot.startAt) ? ` → ${zoneName(slot.endAt)}` : ""}</span>
        {localDateKey(new Date(slot.endAt)) !== selectedDay && <span className="block text-xs font-normal mt-1">{t("Окончание на следующий день")}</span>}
      </button>)}
    </div> : <p role="status" className="text-sm text-ink/70 border-2 border-dashed border-ink p-3">{t(slots.length
      ? "На этот день свободного времени нет. Выберите день с отметкой в календаре."
      : "Для этой длительности пока нет свободного времени. Попробуйте другую длительность или вернитесь позже.")}</p>}
    {selected && <div className="bg-lb text-k border-2 border-ink p-3 text-sm" role="status">
      <p className="font-bold">{t("Вы выбрали занятие")}</p>
      <dl className="grid gap-2 mt-2">
        <div><dt className="text-xs opacity-70">{t("Начало занятия")}</dt><dd className="font-semibold">{fullDateTime(selected.startAt)}</dd></div>
        <div><dt className="text-xs opacity-70">{t("Окончание занятия")}</dt><dd className="font-semibold">{fullDateTime(selected.endAt)}</dd></div>
        <div><dt className="text-xs opacity-70">{t("Длительность")}</dt><dd className="font-semibold">{minutes} {t("мин")}</dd></div>
      </dl>
    </div>}
    <p className="text-xs text-ink/65">{t("После отправки заявки это время будет занято до её отмены или отклонения.")}</p>
  </fieldset>;
}
