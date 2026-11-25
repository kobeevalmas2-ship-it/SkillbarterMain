"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useLanguage } from "@/components/LanguageContext";
import { useSupport } from "@/components/SupportContext";
import { SUPPORT_ACTIONS, SupportGate, SupportStatus, supportDate } from "@/components/SupportPanel";

export default function SupportDetailPage() {
  const { id } = useParams();
  const { t, locale } = useLanguage();
  const { user, ready: authReady, isAdmin } = useAuth();
  const { cases = [], ready, error, refresh, getCaseMessages, sendCaseMessage, markCaseRead } = useSupport();
  const complaint = cases.find((item) => item.id === id);
  const messages = complaint ? getCaseMessages(complaint.id) : [];
  const canReply = complaint && ["open", "reviewing"].includes(complaint.status);
  const email = user?.email;
  const unreadKey = messages.filter((item) => item.authorEmail !== email && !item.readBy?.includes(email)).map((item) => item.id).join("|");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [readError, setReadError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const pending = useRef(false);
  const readAttempt = useRef("");
  const chat = useRef(null);

  useEffect(() => { setText(""); setSendError(""); setReadError(""); setAnnouncement(""); readAttempt.current = ""; }, [id, email]);
  useEffect(() => {
    if (!complaint?.id || !email || !ready || error) return;
    const key = `${email}:${complaint.id}:${unreadKey}`;
    if (readAttempt.current === key) return;
    readAttempt.current = key;
    let active = true;
    Promise.resolve().then(() => markCaseRead(complaint.id)).then(() => { if (active) setReadError(""); }).catch((err) => { if (active) setReadError(err.message || "Не удалось отметить переписку прочитанной."); });
    return () => { active = false; };
  }, [complaint?.id, email, ready, error, unreadKey, markCaseRead]);
  useEffect(() => { if (chat.current) chat.current.scrollTop = chat.current.scrollHeight; }, [id, messages.length]);

  async function submit(event) {
    event.preventDefault();
    if (pending.current || !canReply) return;
    const value = text.trim();
    if (!value || value.length > 2000) { setSendError("Сообщение должно содержать от 1 до 2000 символов."); return; }
    pending.current = true; setSending(true); setSendError(""); setAnnouncement("");
    try { await sendCaseMessage(complaint.id, value); setText(""); setAnnouncement("Сообщение отправлено в поддержку."); }
    catch (err) { setSendError(err.message || "Не удалось отправить сообщение. Черновик сохранён."); }
    finally { pending.current = false; setSending(false); }
  }
  async function retryRead() {
    setReadError("");
    try { await markCaseRead(complaint.id); }
    catch (err) { setReadError(err.message || "Не удалось отметить переписку прочитанной."); }
  }

  return <SupportGate {...{ user, authReady, ready, error, refresh }} next={`/support/${id}`}>
    {!complaint ? <section className="max-w-3xl mx-auto px-4 py-14"><div className="border-2 border-ink bg-card p-8"><h1 className="font-head font-extrabold text-3xl">{t("Обращение не найдено")}</h1><p className="text-ink/65 mt-4">{t("Оно недоступно этому аккаунту или было удалено.")}</p><Link href="/support" className="btn bg-y inline-block mt-6">{t("Все обращения ←")}</Link></div></section> : <section className="max-w-6xl mx-auto px-4 py-5 md:py-8">
      <Link href="/support" className="text-sm underline underline-offset-4">{t("← Все обращения")}</Link>
      <div className="flex flex-wrap gap-4 justify-between items-center mt-4"><div className="min-w-0"><span className="lbl text-acc">{t("Чат с поддержкой")}</span><h1 className="font-head font-extrabold text-2xl md:text-3xl mt-1 break-words">{complaint.title}</h1></div><SupportStatus status={complaint.status} /></div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_270px] gap-5 mt-5 items-start">
        <section className="border-2 border-ink bg-card h-[min(72vh,760px)] min-h-[480px] flex flex-col" aria-labelledby="support-chat-title">
          <header className="px-4 sm:px-5 py-3 border-b-2 border-ink flex justify-between items-center gap-3"><div className="flex items-center gap-3"><span aria-hidden="true" className="w-10 h-10 shrink-0 grid place-items-center border-2 border-ink bg-lb text-xl">✉</span><div><h2 id="support-chat-title" className="font-head font-extrabold text-lg">{t("Переписка")}</h2><p className="text-xs text-ink/60">{t("Создано: {date}", { date: supportDate(complaint.createdAt, locale) })}</p></div></div><span className="text-xs font-semibold text-ink/60">{messages.length} {t("сообщений")}</span></header>
          <div ref={chat} role="log" aria-label={t("Сообщения по жалобе")} aria-live="polite" aria-relevant="additions" className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto overscroll-contain bg-bg/50">
            <article className="max-w-[90%] sm:max-w-[78%] border-2 border-ink bg-y text-k p-4 mb-5"><div className="flex items-center gap-2 text-xs font-bold"><span className="grid place-items-center w-7 h-7 bg-ink text-white">!</span>{t("Обращение в поддержку")}</div><p className="text-sm whitespace-pre-wrap break-words mt-3">{complaint.text}</p><time dateTime={complaint.createdAt} className="text-[11px] block opacity-65 mt-3">{supportDate(complaint.createdAt, locale)}</time></article>
            {messages.length ? <ol className="space-y-4">{messages.map((message) => { const own = message.authorEmail === email; return <li key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}><div className={`border-2 border-ink p-3 sm:p-4 max-w-[88%] sm:max-w-[78%] min-w-0 ${own ? "bg-lb text-k" : "bg-card"}`}><p className="text-xs font-bold break-words">{own ? t("Вы") : message.authorName || message.authorEmail}</p><p className="text-sm whitespace-pre-wrap break-words mt-2">{message.text}</p><time dateTime={message.createdAt} className="text-[11px] block opacity-65 mt-3">{supportDate(message.createdAt, locale)}</time></div></li>; })}</ol> : <p className="ml-3 text-sm text-ink/55">{t("Ожидайте ответа — он появится здесь.")}</p>}
          </div>
          {readError && <div role="alert" className="border-t-2 border-ink bg-co text-k p-3 text-sm"><p>{t(readError)}</p><button type="button" onClick={retryRead} className="underline underline-offset-4 mt-2">{t("Повторить")}</button></div>}
          {canReply ? <form onSubmit={submit} className="p-3 sm:p-4 border-t-2 border-ink" aria-busy={sending}><label htmlFor="support-message" className="sr-only">{t("Сообщение в поддержку")}</label><div className="flex items-end gap-3"><textarea id="support-message" className="fld min-h-12 max-h-36 resize-y flex-1" rows={2} maxLength={2000} required disabled={sending} value={text} onChange={(event) => setText(event.target.value)} placeholder={t("Напишите сообщение…")} aria-describedby="support-message-count" /><button type="submit" aria-label={t("Отправить сообщение")} title={t("Отправить сообщение")} className="btn bg-y !px-3 !py-3 disabled:opacity-50" disabled={sending || !text.trim()}><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></button></div><div className="flex justify-between gap-3 mt-2"><p id="support-message-count" className="text-[11px] text-ink/55">{t("{count} / {max} символов", { count: text.length, max: 2000 })}</p>{sendError && <p role="alert" className="text-xs text-red-700 break-words">{t(sendError)}</p>}<p role="status" className="sr-only">{t(announcement)}</p></div></form> : <div className="border-t-2 border-ink p-4 text-sm text-ink/65">{t("Обращение закрыто. Переписка доступна для просмотра.")}</div>}
        </section>
        <aside className="border-2 border-ink bg-card p-4"><div className="flex items-center gap-3"><span className="grid place-items-center w-10 h-10 border-2 border-ink bg-pu text-k font-bold">i</span><div><h2 className="font-head font-extrabold">{t("Детали")}</h2><p className="text-xs text-ink/60">{t("Обращение #{id}", { id: complaint.id.slice(0, 6) })}</p></div></div><dl className="text-sm mt-4 space-y-3"><div><dt className="text-xs text-ink/60">{t("Заказчик")}</dt><dd className="font-semibold mt-1 break-words">{complaint.customer?.name || complaint.customer?.email}</dd></div><div><dt className="text-xs text-ink/60">{t("Исполнитель")}</dt><dd className="font-semibold mt-1 break-words">{complaint.provider?.name || complaint.provider?.email}</dd></div><div><dt className="text-xs text-ink/60">{t("Последнее обновление")}</dt><dd className="mt-1">{supportDate(complaint.updatedAt || complaint.createdAt, locale)}</dd></div></dl>
          {complaint.resolution && <div className="border-2 border-ink bg-y text-k p-3 mt-4"><span className="lbl">{t("Решение администратора")}</span><h3 className="font-bold mt-1">{t(SUPPORT_ACTIONS[complaint.resolution.action] || "Обращение рассмотрено")}</h3><p className="text-xs mt-2 whitespace-pre-wrap">{complaint.resolution.reason}</p>{complaint.resolution.minutes > 0 && <p className="text-xs font-bold mt-2">{t("Возвращено заказчику: {minutes} мин", { minutes: complaint.resolution.minutes })}</p>}<Link href="/wallet" className="inline-block text-xs font-bold underline underline-offset-4 mt-2">{t("История минут →")}</Link></div>}
          <Link href={`/requests/${complaint.requestId}`} className="btn bg-lb inline-flex justify-center w-full mt-4">{t("Исходная заявка →")}</Link>{isAdmin && <Link href={`/admin?case=${complaint.id}`} className="block text-xs font-bold underline underline-offset-4 mt-4">{t("Открыть в панели администратора →")}</Link>}
        </aside>
      </div>
    </section>}
  </SupportGate>;
}
