"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";
import { useLanguage } from "./LanguageContext";
import { useSupport } from "./SupportContext";
import LoadingState from "./LoadingState";

export const SUPPORT_STATUSES = {
  open: "Новая жалоба",
  reviewing: "На рассмотрении",
  resolved: "Решена",
  rejected: "Отклонена",
};

export const SUPPORT_ACTIONS = {
  refund: "Минуты возвращены",
  cancel: "Занятие отменено",
  refund_cancel: "Занятие отменено, минуты возвращены",
  reject: "Жалоба отклонена",
};

export function supportDate(value, locale) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function SupportStatus({ status }) {
  const { t } = useLanguage();
  const color = status === "resolved" ? "bg-y" : status === "rejected" ? "bg-co" : status === "reviewing" ? "bg-pu" : "bg-lb";
  return <span className={`inline-block border-2 border-ink px-2 py-1 text-xs font-bold text-k ${color}`}>{t(SUPPORT_STATUSES[status] || "Новая жалоба")}</span>;
}

export function SupportGate({ user, authReady, ready, error, refresh, next = "/support", children }) {
  const { t } = useLanguage();
  if (!authReady) return <section className="max-w-5xl mx-auto px-4 py-10"><LoadingState label="Загружаем поддержку…" /></section>;
  if (!user) return <section className="max-w-3xl mx-auto px-4 py-14"><div className="border-2 border-ink bg-card p-7 sm:p-10 shs"><span className="lbl text-acc">{t("Служба поддержки")}</span><h1 className="font-head font-extrabold text-3xl sm:text-4xl mt-3">{t("Войдите, чтобы обратиться в поддержку")}</h1><p className="text-ink/65 mt-4">{t("После входа здесь появятся ваши жалобы и ответы администратора.")}</p><Link href={`/login?next=${encodeURIComponent(next)}`} className="btn bg-y inline-block mt-6">{t("Войти в аккаунт ↗")}</Link></div></section>;
  if (error) return <section className="max-w-3xl mx-auto px-4 py-14"><div role="alert" className="border-2 border-ink bg-card p-7"><h1 className="font-head font-extrabold text-2xl">{t("Поддержка временно недоступна")}</h1><p className="text-sm mt-3 break-words">{t(error.message || String(error))}</p><button type="button" onClick={refresh} className="btn bg-y mt-5">{t("Повторить загрузку")}</button></div></section>;
  if (!ready) return <section className="max-w-5xl mx-auto px-4 py-10"><LoadingState label="Загружаем поддержку…" /></section>;
  return children;
}

export default function SupportPanel({ request }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { ready, error, refresh, cases = [], createComplaint } = useSupport();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [createdId, setCreatedId] = useState("");
  const pending = useRef(false);
  const email = user?.email?.trim().toLowerCase();
  const participant = Boolean(email && [request?.customer?.email, request?.provider?.email].some((value) => value?.trim().toLowerCase() === email));
  const activeCase = cases.find((item) => item.requestId === request?.id && ["open", "reviewing"].includes(item.status));
  const caseId = activeCase?.id || createdId;
  const trimmed = text.trim();

  useEffect(() => {
    setExpanded(false); setText(""); setActionError(""); setCreatedId("");
  }, [request?.id, email]);

  async function submit(event) {
    event.preventDefault();
    if (pending.current || !ready || !participant) return;
    if (trimmed.length < 10 || trimmed.length > 3000) { setActionError("Опишите проблему: от 10 до 3000 символов."); return; }
    pending.current = true; setSubmitting(true); setActionError("");
    try {
      const result = await createComplaint({ requestId: request.id, text: trimmed });
      const id = typeof result === "string" ? result : result?.id;
      setText(""); setExpanded(false);
      if (id) { setCreatedId(id); router.push(`/support/${id}`); }
    } catch (err) { setActionError(err.message || "Не удалось отправить жалобу. Попробуйте ещё раз."); }
    finally { pending.current = false; setSubmitting(false); }
  }

  if (!participant) return null;
  return <section className="border-2 border-ink bg-card p-5 sm:p-6 mt-7" aria-labelledby="request-support-title">
    <span className="lbl text-acc">{t("Служба поддержки")}</span>
    <h2 id="request-support-title" className="font-head font-extrabold text-xl mt-2">{t("Возникла проблема с занятием?")}</h2>
    <p className="text-sm text-ink/65 mt-3">{t("Сообщите о несоответствии услуги или другой проблеме. Администратор рассмотрит жалобу и при необходимости вернёт минуты.")}</p>
    {!ready && !error ? <div className="mt-5"><LoadingState variant="compact" label="Загружаем поддержку…" /></div> : error ? <div className="mt-4"><p role="alert" className="text-sm break-words">{t(error.message || String(error))}</p><button type="button" onClick={refresh} className="underline underline-offset-4 text-sm mt-3">{t("Повторить загрузку")}</button></div> : caseId ? <div className="flex flex-wrap gap-3 items-center mt-5">{activeCase && <SupportStatus status={activeCase.status} />}<Link href={`/support/${caseId}`} className="btn bg-lb">{t("Открыть обращение ↗")}</Link></div> : <>
      {!expanded ? <button type="button" className="btn bg-co mt-5" onClick={() => setExpanded(true)}>{t("Пожаловаться на занятие")}</button> : <form onSubmit={submit} className="mt-5" aria-busy={submitting}>
        <p className="text-sm mb-4">{t("Жалоба по заявке: {title}", { title: request.title })}</p>
        <label htmlFor="complaint-description" className="lbl block mb-2">{t("Что произошло?")}</label>
        <textarea id="complaint-description" className="fld w-full min-h-36 resize-y" rows={5} maxLength={3000} minLength={10} required disabled={submitting} value={text} onChange={(event) => setText(event.target.value)} aria-describedby="complaint-description-help complaint-description-count" placeholder={t("Например: договаривались об английском, но на занятии объясняли другую тему.")} />
        <div className="flex flex-wrap justify-between gap-2 mt-2 text-xs text-ink/65"><p id="complaint-description-help">{t("От 10 до 3000 символов. Опишите договорённость и результат занятия.")}</p><p id="complaint-description-count">{t("{count} / {max} символов", { count: text.length, max: 3000 })}</p></div>
        <p className="text-xs text-ink/65 mt-3">{t("Жалоба и переписка будут доступны администратору и участникам заявки.")}</p>
        <div className="flex flex-wrap gap-3 mt-5"><button type="submit" className="btn bg-y disabled:opacity-50" disabled={submitting || trimmed.length < 10}>{t(submitting ? "Отправляем жалобу…" : "Отправить жалобу")}</button><button type="button" className="border-2 border-ink px-4 py-2 text-sm font-bold disabled:opacity-50" disabled={submitting} onClick={() => setExpanded(false)}>{t("Свернуть")}</button></div>
      </form>}
    </>}
    {actionError && <p role="alert" className="border-2 border-ink bg-co text-k p-3 text-sm mt-4 break-words">{t(actionError)}</p>}
  </section>;
}
