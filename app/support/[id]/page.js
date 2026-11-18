"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useLanguage } from "@/components/LanguageContext";
import { useSupport } from "@/components/SupportContext";
import { SUPPORT_ACTIONS, SupportGate, SupportStatus, supportDate } from "@/components/SupportPanel";

export default function SupportDetailPage({ params }) {
  const { t, locale } = useLanguage();
  const { user, ready: authReady, isAdmin } = useAuth();
  const { cases = [], ready, error, refresh, getCaseMessages, sendCaseMessage, markCaseRead } = useSupport();
  const complaint = cases.find((item) => item.id === params.id);
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

  useEffect(() => {
    setText(""); setSendError(""); setReadError(""); setAnnouncement(""); readAttempt.current = "";
  }, [params.id, email]);

  useEffect(() => {
    if (!complaint?.id || !email || !ready || error) return;
    const key = `${email}:${complaint.id}:${unreadKey}`;
    if (readAttempt.current === key) return;
    readAttempt.current = key;
    let active = true;
    Promise.resolve().then(() => markCaseRead(complaint.id)).then(() => { if (active) setReadError(""); }).catch((err) => { if (active) setReadError(err.message || "Не удалось отметить переписку прочитанной."); });
    return () => { active = false; };
  }, [complaint?.id, email, ready, error, unreadKey, markCaseRead]);

  useEffect(() => {
    if (chat.current) chat.current.scrollTop = chat.current.scrollHeight;
  }, [params.id, messages.length]);

  async function submit(event) {
    event.preventDefault();
    if (pending.current || !canReply) return;
    const value = text.trim();
    if (!value || value.length > 2000) { setSendError("Сообщение должно содержать от 1 до 2000 символов."); return; }
    pending.current = true; setSending(true); setSendError(""); setAnnouncement("");
    try {
      await sendCaseMessage(complaint.id, value);
      setText(""); setAnnouncement("Сообщение отправлено в поддержку.");
    } catch (err) { setSendError(err.message || "Не удалось отправить сообщение. Черновик сохранён."); }
    finally { pending.current = false; setSending(false); }
  }

  async function retryRead() {
    setReadError("");
    try { await markCaseRead(complaint.id); }
    catch (err) { setReadError(err.message || "Не удалось отметить переписку прочитанной."); }
  }

  return <SupportGate {...{ user, authReady, ready, error, refresh }} next={`/support/${params.id}`}>
    {!complaint ? <section className="max-w-3xl mx-auto px-4 py-14"><div className="border-2 border-ink bg-card p-8"><h1 className="font-head font-extrabold text-3xl">{t("Обращение не найдено")}</h1><p className="text-ink/65 mt-4">{t("Оно недоступно этому аккаунту или было удалено.")}</p><Link href="/support" className="btn bg-y inline-block mt-6">{t("Все обращения ↗")}</Link></div></section> : <section className="max-w-6xl mx-auto px-4 py-10 md:py-14">
      <Link href="/support" className="text-sm underline underline-offset-4">{t("← Все обращения")}</Link>
      <div className="flex flex-wrap gap-4 justify-between items-start mt-6"><div className="min-w-0"><span className="lbl text-acc">{t("Обращение в поддержку")}</span><h1 className="font-head font-extrabold text-3xl md:text-5xl mt-3 break-words">{complaint.title}</h1><p className="text-xs text-ink/60 mt-3">{t("Создано: {date}", { date: supportDate(complaint.createdAt, locale) })}</p></div><SupportStatus status={complaint.status} /></div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-7 mt-8 items-start">
        <div className="min-w-0 space-y-7">
          <article className="border-2 border-ink bg-card p-5 sm:p-6"><h2 className="font-head font-extrabold text-xl">{t("Описание проблемы")}</h2><p className="text-xs text-ink/60 mt-2 break-words">{t("Обратился: {name}", { name: complaint.reporter?.name || complaint.reporter?.email })}</p><p className="whitespace-pre-wrap break-words text-sm leading-relaxed mt-4">{complaint.text}</p></article>
          {complaint.resolution && <article className="border-2 border-ink bg-y text-k p-5 sm:p-6" aria-labelledby="support-resolution-title"><span className="lbl">{t("Решение администратора")}</span><h2 id="support-resolution-title" className="font-head font-extrabold text-xl mt-2">{t(SUPPORT_ACTIONS[complaint.resolution.action] || "Обращение рассмотрено")}</h2>{complaint.resolution.minutes > 0 && <p className="font-semibold mt-3">{t("Возвращено заказчику: {minutes} мин", { minutes: complaint.resolution.minutes })}</p>}<p className="text-sm whitespace-pre-wrap break-words mt-4">{complaint.resolution.reason}</p><p className="text-xs mt-4">{t("Решение принято: {date}", { date: supportDate(complaint.resolution.createdAt, locale) })}</p><Link href="/wallet" className="inline-block text-sm font-bold underline underline-offset-4 mt-4">{t("Проверить историю минут ↗")}</Link></article>}
          <section className="border-2 border-ink bg-card" aria-labelledby="support-chat-title"><div className="p-5 sm:p-6 border-b-2 border-ink"><h2 id="support-chat-title" className="font-head font-extrabold text-2xl">{t("Переписка по жалобе")}</h2><p className="text-xs text-ink/65 mt-2">{t("Здесь администратор и участники заявки могут уточнить обстоятельства и предоставить пояснения.")}</p></div>
            <div ref={chat} role="log" aria-label={t("Сообщения по жалобе")} aria-live="polite" aria-relevant="additions" className="p-4 sm:p-6 max-h-[32rem] overflow-y-auto overscroll-contain">
              {messages.length ? <ol className="space-y-4">{messages.map((message) => { const own = message.authorEmail === email; return <li key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}><div className={`border-2 border-ink p-3 sm:p-4 max-w-[92%] sm:max-w-[85%] min-w-0 ${own ? "bg-lb text-k" : "bg-bg"}`}><p className="text-xs font-bold break-words">{own ? t("Вы") : message.authorName || message.authorEmail}</p><p className="text-sm whitespace-pre-wrap break-words mt-2">{message.text}</p><time dateTime={message.createdAt} className="text-[11px] block opacity-65 mt-3">{supportDate(message.createdAt, locale)}</time></div></li>; })}</ol> : <div className="text-center py-7"><p className="font-semibold">{t("Пока нет сообщений")}</p><p className="text-sm text-ink/65 mt-2">{t(canReply ? "Добавьте подробности или дождитесь ответа администратора." : "Переписка по этому обращению не велась.")}</p></div>}
            </div>
            {readError && <div role="alert" className="border-t-2 border-ink bg-co text-k p-3 text-sm"><p>{t(readError)}</p><button type="button" onClick={retryRead} className="underline underline-offset-4 mt-2">{t("Повторить")}</button></div>}
            {canReply ? <form onSubmit={submit} className="p-4 sm:p-6 border-t-2 border-ink" aria-busy={sending}><label htmlFor="support-message" className="lbl block mb-2">{t("Сообщение в поддержку")}</label><textarea id="support-message" className="fld w-full min-h-24 resize-y" rows={3} maxLength={2000} required disabled={sending} value={text} onChange={(event) => setText(event.target.value)} placeholder={t("Дополните жалобу или ответьте на вопрос…")} aria-describedby="support-message-count" /><div className="flex flex-wrap items-center justify-between gap-3 mt-3"><p id="support-message-count" className="text-xs text-ink/60">{t("{count} / {max} символов", { count: text.length, max: 2000 })}</p><button type="submit" className="btn bg-y disabled:opacity-50" disabled={sending || !text.trim()}>{t(sending ? "Отправляем…" : "Отправить сообщение")}</button></div>{sendError && <p role="alert" className="border-2 border-ink bg-co text-k p-3 text-sm mt-4 break-words">{t(sendError)}</p>}<p role="status" className="text-xs mt-3">{t(announcement)}</p></form> : <div className="border-t-2 border-ink p-5 text-sm text-ink/65"><p>{t("Обращение закрыто. Переписка доступна для просмотра.")}</p><Link href={`/requests/${complaint.requestId}`} className="inline-block underline underline-offset-4 mt-3">{t("Если нужна дополнительная проверка, отправьте новую жалобу со страницы заявки.")}</Link></div>}
          </section>
        </div>
        <aside className="border-2 border-ink bg-card p-5 sm:p-6"><h2 className="font-head font-extrabold text-xl">{t("Данные обращения")}</h2><dl className="text-sm mt-5 space-y-4"><div><dt className="text-xs text-ink/60">{t("Заказчик")}</dt><dd className="font-semibold mt-1 break-words">{complaint.customer?.name || complaint.customer?.email}</dd></div><div><dt className="text-xs text-ink/60">{t("Исполнитель")}</dt><dd className="font-semibold mt-1 break-words">{complaint.provider?.name || complaint.provider?.email}</dd></div><div><dt className="text-xs text-ink/60">{t("Последнее обновление")}</dt><dd className="mt-1">{supportDate(complaint.updatedAt || complaint.createdAt, locale)}</dd></div></dl><Link href={`/requests/${complaint.requestId}`} className="btn bg-lb inline-block mt-6">{t("Исходная заявка ↗")}</Link>{isAdmin && <Link href={`/admin?case=${complaint.id}`} className="block text-sm font-bold underline underline-offset-4 mt-5">{t("Рассмотреть в панели администратора ↗")}</Link>}<p className="text-xs text-ink/60 mt-5">{t("Решение и возврат минут выполняет администратор после проверки обстоятельств.")}</p></aside>
      </div>
    </section>}
  </SupportGate>;
}
