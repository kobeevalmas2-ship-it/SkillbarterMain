"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useLanguage } from "./LanguageContext";
import { useRequests } from "./RequestsContext";
import LoadingState from "./LoadingState";
import { REQUEST_STATUS_LABELS, allowedRequestActions } from "@/lib/requests.mjs";

const STATUS_COLORS = {
  pending: "bg-y", accepted: "bg-lb", in_progress: "bg-pu", awaiting_confirmation: "bg-y",
  completed: "bg-lb", declined: "bg-co", cancelled: "bg-co",
};
const ACTION_LABELS = {
  accepted: "Принять заявку", declined: "Отклонить", cancelled: "Отменить заявку",
  in_progress: "Начать занятие", awaiting_confirmation: "Занятие проведено", completed: "Подтвердить завершение",
};

export function requestDate(value, locale, options = { dateStyle: "medium", timeStyle: "short" }) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(locale, options).format(date) : "—";
}

export function RequestStatus({ status }) {
  const { t } = useLanguage();
  return <span className={`inline-block border-2 border-ink px-2 py-1 text-xs font-bold text-k ${STATUS_COLORS[status] || "bg-y"}`}>
    {t(REQUEST_STATUS_LABELS[status] || status)}
  </span>;
}

export function WorkflowGate({ authReady, user, ready, error, refresh, next, children }) {
  const { t } = useLanguage();
  const variant = next === "/day" ? "dashboard" : next?.startsWith("/requests/") ? "detail" : "page";
  if (!authReady) return <div className="max-w-6xl mx-auto px-4 py-10 md:py-14"><LoadingState variant={variant} label={t("Загружаем ваш кабинет…")} /></div>;
  if (!user) return <section className="max-w-2xl mx-auto px-4 py-14">
    <div className="border-2 border-ink bg-card p-7 sm:p-9 sh">
      <span className="lbl text-acc">{t("Ваши обмены в одном месте")}</span>
      <h1 className="font-head font-extrabold text-4xl mt-4">{t("Войдите, чтобы продолжить")}</h1>
      <p className="text-ink/70 mt-4">{t("После входа здесь появятся ваши заявки, сообщения и уведомления.")}</p>
      <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn bg-y inline-block mt-7">{t("Войти в аккаунт ↗")}</Link>
    </div>
  </section>;
  if (error) return <section className="max-w-4xl mx-auto px-4 py-14">
    <p role="alert" className="border-2 border-ink bg-co text-k p-5">{t(error.message || error)}</p>
    <button type="button" className="btn bg-y mt-5" onClick={refresh}>{t("Повторить загрузку")}</button>
  </section>;
  if (!ready) return <div className="max-w-6xl mx-auto px-4 py-10 md:py-14"><LoadingState variant={variant} label={t("Загружаем ваши обмены…")} /></div>;
  return children;
}

export function RequestActions({ request, email }) {
  const { t } = useLanguage();
  const { changeStatus } = useRequests();
  const [busy, setBusy] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const pending = useRef(false);
  const actions = allowedRequestActions(request, email);

  async function act(status) {
    if (pending.current) return;
    pending.current = true;
    setBusy(status);
    setError("");
    try { await changeStatus(request.id, status); setConfirmation(""); }
    catch (err) { setError(err.message || "Не удалось изменить статус заявки."); }
    finally { pending.current = false; setBusy(""); }
  }

  if (!actions.length && !error) return null;
  const needsConfirmation = ["declined", "cancelled", "completed"].includes(confirmation) && actions.includes(confirmation);
  return <div className="mt-4" aria-busy={Boolean(busy)}>
    {needsConfirmation ? <div className="border-2 border-ink bg-bg p-4">
      <p className="text-sm font-semibold">{t(confirmation === "completed"
        ? "Подтвердить завершение и перевести исполнителю {minutes} мин?"
        : confirmation === "declined" ? "Отклонить эту заявку?" : "Отменить эту заявку?", { minutes: request.minutes })}</p>
      <div className="flex flex-wrap gap-3 mt-3">
        <button type="button" disabled={Boolean(busy)} className="btn bg-y text-sm disabled:opacity-50" onClick={() => act(confirmation)}>{t(busy ? "Сохраняем…" : "Да, подтвердить")}</button>
        <button type="button" disabled={Boolean(busy)} className="underline text-sm underline-offset-4 disabled:opacity-50" onClick={() => { setConfirmation(""); setError(""); }}>{t("Вернуться")}</button>
      </div>
    </div> : <div className="flex flex-wrap gap-3">
      {actions.map((status) => <button key={status} type="button" disabled={Boolean(busy)}
        className={`${["declined", "cancelled"].includes(status) ? "border-2 border-ink px-3 py-2 font-semibold bg-card" : "btn bg-y"} text-sm disabled:opacity-50`}
        onClick={() => {
          if (["declined", "cancelled", "completed"].includes(status)) { setConfirmation(status); setError(""); }
          else act(status);
        }}>{t(busy === status ? "Сохраняем…" : ACTION_LABELS[status])}</button>)}
    </div>}
    {error && <p role="alert" className="border-2 border-ink bg-co text-k p-3 text-sm mt-3">{t(error)}</p>}
  </div>;
}

export function RequestCard({ request, email, showActions = false }) {
  const { t, locale } = useLanguage();
  const incoming = request.provider.email === email;
  const counterpart = incoming ? request.customer : request.provider;
  return <article className="min-w-0 border-2 border-ink bg-card p-5 sm:p-6 shs">
    <div className="flex flex-wrap justify-between items-start gap-3">
      <span className="lbl text-ink/60">{t(incoming ? "Вы помогаете" : "Вам помогают")}</span>
      <RequestStatus status={request.status} />
    </div>
    <h2 className="font-head font-extrabold text-2xl break-words mt-3"><Link href={`/requests/${request.id}`} className="underline-offset-4 hover:underline">{request.title}</Link></h2>
    <p className="text-sm text-ink/70 break-words mt-2">{t(incoming ? "Участник: {name}" : "Исполнитель: {name}", { name: counterpart.name })}</p>
    <dl className="grid sm:grid-cols-2 gap-3 mt-5 text-sm">
      <div><dt className="lbl text-ink/60">{t("Дата и время")}</dt><dd className="font-semibold mt-1"><time dateTime={request.scheduledAt}>{requestDate(request.scheduledAt, locale)}</time></dd></div>
      <div><dt className="lbl text-ink/60">{t("Длительность и стоимость")}</dt><dd className="font-mono font-bold mt-1">{request.minutes} {t("мин")}</dd></div>
    </dl>
    {showActions && <RequestActions request={request} email={email} />}
    <Link href={`/requests/${request.id}`} className="inline-block font-semibold text-sm underline underline-offset-4 mt-5">{t("Открыть заявку и чат ↗")}</Link>
  </article>;
}
