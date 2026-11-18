"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { useLanguage } from "./LanguageContext";
import { useRequests } from "./RequestsContext";
import DateCalendar from "./DateCalendar";
import { localDateKey, parseLocalDateTime } from "@/lib/calendar-dates.mjs";

function nextLocalDay(day) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + 1);
  return localDateKey(date);
}

export default function AvailabilityEditor() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const { calendarFor, addAvailableTime, removeAvailableTime } = useRequests();
  const [now, setNow] = useState(null);
  const [day, setDay] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [nextDay, setNextDay] = useState(false);
  const [timeZone, setTimeZone] = useState("");
  const [busy, setBusy] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const form = useRef(null);
  const calendarContainer = useRef(null);

  useEffect(() => {
    const current = new Date();
    setNow(current.getTime());
    setDay(localDateKey(current));
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const calendar = user ? calendarFor(user.email) : null;
  const windows = useMemo(() => (calendar?.windows || [])
    .filter((window) => now !== null && Date.parse(window.endAt) > now)
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)), [calendar, now]);
  const markedDates = useMemo(() => [...new Set(windows.flatMap((window) => [
    localDateKey(new Date(window.startAt)), localDateKey(new Date(Date.parse(window.endAt) - 1)),
  ]))], [windows]);
  const today = now === null ? undefined : localDateKey(new Date(now));

  function change(setter, value, field) {
    setter(value);
    setMessage("");
    setError("");
    setFieldErrors((current) => { const next = { ...current }; delete next[field]; return next; });
  }

  async function submit(event) {
    event.preventDefault();
    if (pending.current || !timeZone) return;
    const errors = {};
    if (!day) errors.day = "Выберите день для свободного времени.";
    if (!startTime) errors.startTime = "Укажите время начала окна.";
    if (!endTime) errors.endTime = "Укажите время окончания окна.";
    const start = day && startTime ? parseLocalDateTime(day, startTime) : null;
    const endDay = day && nextDay ? nextLocalDay(day) : day;
    const end = endDay && endTime ? parseLocalDateTime(endDay, endTime) : null;
    if (day && startTime && !start) errors.startTime = "Это местное время недоступно из-за перевода часов. Выберите другое.";
    if (endDay && endTime && !end) errors.endTime = "Это местное время недоступно из-за перевода часов. Выберите другое.";
    if (start && start.getTime() <= Date.now()) errors.startTime = "Начало окна должно быть в будущем.";
    if (start && end) {
      const duration = (end.getTime() - start.getTime()) / 60000;
      if (duration < 15 || duration > 1440) errors.endTime = "Окно должно длиться от 15 минут до 24 часов. Проверьте начало и конец.";
    }
    setFieldErrors(errors);
    setError("");
    setMessage("");
    if (Object.keys(errors).length) {
      const first = Object.keys(errors)[0];
      if (first === "day") calendarContainer.current?.focus();
      else form.current?.elements.namedItem(first)?.focus();
      return;
    }
    pending.current = true;
    setBusy("add");
    try {
      await addAvailableTime({ startAt: start.toISOString(), endAt: end.toISOString(), timeZone });
      setStartTime("");
      setEndTime("");
      setNextDay(false);
      setNow(Date.now());
      setMessage("Свободное время опубликовано. Оно доступно для записи на ваши услуги.");
    } catch (err) {
      setError(err.message || "Не удалось опубликовать свободное время. Попробуйте ещё раз.");
    } finally {
      pending.current = false;
      setBusy("");
    }
  }

  async function remove(id) {
    if (pending.current) return;
    pending.current = true;
    setBusy(id);
    setError("");
    setMessage("");
    try {
      await removeAvailableTime(id);
      setConfirmation("");
      setMessage("Окно удалено из свободного времени. Созданные заявки остались без изменений.");
    } catch (err) {
      setError(err.message || "Не удалось удалить окно. Попробуйте ещё раз.");
    } finally {
      pending.current = false;
      setBusy("");
    }
  }

  const formatDate = (value) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: timeZone || "UTC" }).format(new Date(value));
  const inlineError = (field) => fieldErrors[field] && <p id={`availability-${field}-error`} role="alert" className="text-sm text-red-700 mt-2">{t(fieldErrors[field])}</p>;

  return <div className="mt-7">
    {timeZone && <p className="border-2 border-ink bg-lb text-k p-3 text-sm break-words">{t("Часовой пояс устройства: {timeZone}. Выбирайте и просматривайте время в этом часовом поясе.", { timeZone })}</p>}
    {error && <p role="alert" className="border-2 border-ink bg-co text-k p-4 text-sm mt-5">{t(error)}</p>}
    {message && <p role="status" className="border-2 border-ink bg-lb text-k p-4 text-sm mt-5">{t(message)}</p>}
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-7 mt-6 items-start">
      <form ref={form} onSubmit={submit} noValidate aria-busy={Boolean(busy)} className="border-2 border-ink bg-card p-5 sm:p-6 sh min-w-0">
        <h2 className="font-head font-extrabold text-3xl">{t("Добавить свободное окно")}</h2>
        <p className="text-sm text-ink/65 mt-3">{t("Выберите день и интервал от 15 минут до 24 часов. Можно добавить несколько окон на один день.")}</p>
        <div ref={calendarContainer} tabIndex={-1} aria-describedby={fieldErrors.day ? "availability-day-error" : undefined} className="mt-5">
          <DateCalendar value={day} onChange={(value) => change(setDay, value, "day")} min={today} markedDates={markedDates} disabled={Boolean(busy) || now === null} />
        </div>
        {inlineError("day")}
        <div className="grid sm:grid-cols-2 gap-4 mt-5">
          <div>
            <label htmlFor="availability-start" className="lbl block mb-2">{t("Начало окна")}</label>
            <input id="availability-start" name="startTime" type="time" className="fld" required step="60" value={startTime}
              onChange={(event) => change(setStartTime, event.target.value, "startTime")} disabled={Boolean(busy)}
              aria-invalid={Boolean(fieldErrors.startTime)} aria-describedby={fieldErrors.startTime ? "availability-startTime-error" : undefined} />
            {inlineError("startTime")}
          </div>
          <div>
            <label htmlFor="availability-end" className="lbl block mb-2">{t("Конец окна")}</label>
            <input id="availability-end" name="endTime" type="time" className="fld" required step="60" value={endTime}
              onChange={(event) => change(setEndTime, event.target.value, "endTime")} disabled={Boolean(busy)}
              aria-invalid={Boolean(fieldErrors.endTime)} aria-describedby={fieldErrors.endTime ? "availability-endTime-error" : undefined} />
            {inlineError("endTime")}
          </div>
        </div>
        <label className="flex gap-3 items-start mt-4 text-sm cursor-pointer">
          <input type="checkbox" className="mt-1 accent-[#3346e0]" checked={nextDay} disabled={Boolean(busy)} onChange={(event) => change(setNextDay, event.target.checked, "endTime")} />
          <span>{t("Окно заканчивается на следующий день")}</span>
        </label>
        <button type="submit" className="btn bg-y w-full mt-6 disabled:opacity-50" disabled={Boolean(busy) || !timeZone}>{t(busy === "add" ? "Публикуем окно…" : "Опубликовать свободное время")}</button>
      </form>

      <section className="border-2 border-ink bg-card p-5 sm:p-6 min-w-0" aria-labelledby="availability-windows-title" aria-busy={Boolean(busy)}>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="availability-windows-title" className="font-head font-extrabold text-3xl">{t("Опубликованные окна")}</h2>
          <span className="lbl">{t("Всего окон: {count}", { count: windows.length })}</span>
        </div>
        <p className="text-sm text-ink/65 mt-3">{t("Здесь показаны окна, которые ещё не закончились. Удаление окна закрывает новую запись и не отменяет уже созданные заявки.")}</p>
        {windows.length ? <ul className="grid gap-4 mt-5">
          {windows.map((window) => <li key={window.id} className="border-2 border-ink bg-bg p-4">
            <div className="text-sm font-semibold leading-relaxed break-words">
              <time dateTime={window.startAt}>{formatDate(window.startAt)}</time><span aria-hidden="true"> → </span><time dateTime={window.endAt}>{formatDate(window.endAt)}</time>
            </div>
            {confirmation === window.id ? <div className="mt-4">
              <p className="text-sm">{t("Убрать это окно из свободного времени? Созданные заявки сохранятся.")}</p>
              <div className="flex flex-wrap gap-3 mt-3">
                <button type="button" className="btn bg-co text-sm disabled:opacity-50" disabled={Boolean(busy)} onClick={() => remove(window.id)}>{t(busy === window.id ? "Удаляем окно…" : "Да, убрать окно")}</button>
                <button type="button" className="underline underline-offset-4 text-sm disabled:opacity-50" disabled={Boolean(busy)} onClick={() => setConfirmation("")}>{t("Отмена")}</button>
              </div>
            </div> : <button type="button" className="mt-3 text-sm font-semibold underline underline-offset-4 disabled:opacity-50" disabled={Boolean(busy)} onClick={() => { setConfirmation(window.id); setError(""); setMessage(""); }}>{t("Убрать окно")}</button>}
          </li>)}
        </ul> : <div className="border-2 border-dashed border-ink p-6 mt-5">
          <h3 className="font-head font-extrabold text-2xl">{t("Свободное время ещё не опубликовано")}</h3>
          <p className="text-sm text-ink/65 mt-3">{t("Добавьте первое окно в календаре, чтобы участники могли записываться на ваши услуги.")}</p>
        </div>}
      </section>
    </div>
  </div>;
}
