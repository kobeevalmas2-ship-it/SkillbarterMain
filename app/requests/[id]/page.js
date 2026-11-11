"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useLanguage } from "@/components/LanguageContext";
import { useRequests } from "@/components/RequestsContext";
import { RequestActions, RequestStatus, requestDate, WorkflowGate } from "@/components/RequestUI";

const STATUS_HINTS = {
  pending: "Заявка отправлена. Исполнитель может принять её или предложить обсудить условия в чате.",
  accepted: "Время согласовано, минуты зарезервированы. Обсудите детали встречи в чате.",
  in_progress: "Занятие началось. После встречи исполнитель отметит, что помощь оказана.",
  awaiting_confirmation: "Исполнитель отметил занятие как проведённое. Заказчику нужно подтвердить завершение.",
  completed: "Обмен завершён. Минуты переведены исполнителю, запись сохранена в кошельке.",
  declined: "Исполнитель отклонил заявку. Можно найти другое предложение в каталоге.",
  cancelled: "Заявка отменена. Зарезервированные минуты снова доступны для обмена.",
};

export default function RequestDetailPage({ params }) {
  const { t, locale } = useLanguage();
  const { user, ready: authReady } = useAuth();
  const { requests = [], notifications = [], getMessages, ready, error, refresh, sendMessage, markRequestRead } = useRequests();
  const request = requests.find((item) => item.id === params.id);
  const messages = request ? getMessages(request.id) : [];
  const [text, setText] = useState("");
  const [sendError, setSendError] = useState("");
  const [readError, setReadError] = useState("");
  const [sending, setSending] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const pending = useRef(false);
  const chatList = useRef(null);
  const needsRead = Boolean(request && user && (messages.some((message) => message.authorEmail !== user.email && !message.readBy?.includes(user.email)) || notifications.some((notification) => notification.requestId === request.id && !notification.readAt)));

  useEffect(() => {
    setText(""); setSendError(""); setReadError(""); setAnnouncement("");
  }, [params.id, user?.email]);

  useEffect(() => {
    if (!request || !needsRead) return;
    markRequestRead(request.id).then(() => setReadError("")).catch((err) => setReadError(err.message || "Не удалось отметить сообщения прочитанными."));
  }, [request?.id, needsRead, markRequestRead]);

  useEffect(() => {
    if (chatList.current) chatList.current.scrollTop = chatList.current.scrollHeight;
  }, [params.id, messages.length]);

  async function submit(event) {
    event.preventDefault();
    if (pending.current || !request) return;
    if (!text.trim() || text.trim().length > 2000) { setSendError("Введите сообщение от 1 до 2000 символов."); return; }
    pending.current = true;
    setSending(true); setSendError(""); setAnnouncement("");
    try { await sendMessage(request.id, text.trim()); setText(""); setAnnouncement("Сообщение отправлено."); }
    catch (err) { setSendError(err.message || "Не удалось отправить сообщение. Текст сохранён в поле."); }
    finally { pending.current = false; setSending(false); }
  }

  return <WorkflowGate {...{ user, authReady, ready, error, refresh }} next={`/requests/${params.id}`}>
    {!request ? <section className="max-w-3xl mx-auto px-4 py-16"><h1 className="font-head font-extrabold text-4xl">{t("Заявка недоступна")}</h1><p className="text-ink/65 mt-4">{t("Проверьте ссылку и аккаунт. Заявку могут открыть только её участники.")}</p><Link href="/requests" className="btn bg-y inline-block mt-6">{t("К моим заявкам ↗")}</Link></section> : <section className="max-w-6xl mx-auto px-4 py-8 md:py-12">
      <Link href="/requests" className="text-sm font-semibold underline underline-offset-4">{t("← Все заявки")}</Link>
      <div className="flex flex-wrap items-start justify-between gap-5 mt-6"><div className="min-w-0 flex-1"><span className="lbl text-acc">{t("Ваш обмен навыками")}</span><h1 className="font-head font-extrabold text-4xl md:text-5xl mt-3 break-words">{request.title}</h1></div><RequestStatus status={request.status} /></div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-7 mt-8 items-start">
        <div className="min-w-0 grid gap-7">
          <section className="border-2 border-ink bg-card p-5 sm:p-6 shs" aria-labelledby="request-summary-title">
            <h2 id="request-summary-title" className="font-head font-extrabold text-2xl">{t("Детали занятия")}</h2>
            <dl className="grid sm:grid-cols-2 gap-5 mt-5 text-sm">
              <div><dt className="lbl text-ink/60">{t("Заказчик")}</dt><dd className="font-semibold break-words mt-1">{request.customer.name}</dd><dd className="text-xs text-ink/60 break-all mt-1">{request.customer.email}</dd></div>
              <div><dt className="lbl text-ink/60">{t("Исполнитель")}</dt><dd className="font-semibold break-words mt-1">{request.provider.name}</dd><dd className="text-xs text-ink/60 break-all mt-1">{request.provider.email}</dd></div>
              <div><dt className="lbl text-ink/60">{t("Дата и время")}</dt><dd className="font-semibold mt-1"><time dateTime={request.scheduledAt}>{requestDate(request.scheduledAt, locale)}</time></dd></div>
              <div><dt className="lbl text-ink/60">{t("Длительность и стоимость")}</dt><dd className="font-mono font-bold text-xl mt-1">{request.minutes} {t("мин")}</dd></div>
            </dl>
            <p className="text-xs text-ink/60 mt-4">{t("Время отображается в часовом поясе вашего устройства.")}</p>
            <p className="border-2 border-ink bg-bg p-4 text-sm leading-relaxed mt-5" role="status">{t(STATUS_HINTS[request.status])}</p>
            <RequestActions key={request.id} request={request} email={user.email} />
            <Link href={`/offers/${request.offerId}`} className="inline-block text-sm font-semibold underline underline-offset-4 mt-5">{t("Открыть предложение ↗")}</Link>
          </section>
          <section className="border-2 border-ink bg-card shs" aria-labelledby="request-chat-title">
            <div className="p-5 sm:p-6 border-b-2 border-ink"><h2 id="request-chat-title" className="font-head font-extrabold text-2xl">{t("Чат по заявке")}</h2><p className="text-sm text-ink/65 mt-2">{t("Обсудите ожидания, место встречи и материалы для занятия.")}</p></div>
            <div ref={chatList} className="max-h-[480px] min-h-48 overflow-y-auto p-4 sm:p-6" role="log" aria-label={t("Сообщения по заявке")} aria-live="polite" aria-relevant="additions">
              {messages.length ? <ol className="space-y-4">{messages.map((message) => {
                const own = message.authorEmail === user.email;
                const seen = message.readBy?.some((email) => email !== message.authorEmail);
                return <li key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}><article className={`border-2 border-ink p-3 sm:p-4 max-w-[92%] sm:max-w-[85%] min-w-0 ${own ? "bg-lb text-k" : "bg-bg"}`}>
                  <p className="text-xs font-bold break-words">{own ? t("Вы") : message.authorName}</p><p className="whitespace-pre-wrap break-words text-sm leading-relaxed mt-2">{message.text}</p><p className="text-xs opacity-65 mt-3"><time dateTime={message.createdAt}>{requestDate(message.createdAt, locale)}</time>{own && <span> · {t(seen ? "Прочитано" : "Отправлено")}</span>}</p>
                </article></li>;
              })}</ol> : <div className="text-center py-7"><p className="font-head font-extrabold text-xl">{t("Начните разговор")}</p><p className="text-sm text-ink/65 mt-2">{t("Представьтесь и расскажите, какую помощь хотите получить.")}</p></div>}
            </div>
            {readError && <div className="px-5 pb-4"><p role="alert" className="text-sm">{t(readError)}</p><button type="button" className="underline text-sm mt-2" onClick={() => markRequestRead(request.id).then(() => setReadError("")).catch((err) => setReadError(err.message))}>{t("Повторить")}</button></div>}
            <form onSubmit={submit} className="border-t-2 border-ink p-4 sm:p-6" aria-busy={sending}>
              <label htmlFor="request-message" className="font-semibold text-sm">{t("Ваше сообщение")}</label>
              <textarea id="request-message" className="fld mt-2 resize-y" rows={3} maxLength={2000} value={text} onChange={(event) => { setText(event.target.value); setSendError(""); setAnnouncement(""); }} disabled={sending} placeholder={t("Напишите участнику…")} aria-describedby="message-limit" required />
              <div className="flex flex-wrap items-center justify-between gap-3 mt-3"><p id="message-limit" className="text-xs text-ink/60">{t("{count} / {max} символов", { count: text.length, max: 2000 })}</p><button type="submit" disabled={sending || !text.trim()} className="btn bg-y disabled:opacity-50">{t(sending ? "Отправляем…" : "Отправить сообщение ↗")}</button></div>
              {sendError && <p role="alert" className="border-2 border-ink bg-co text-k p-3 mt-3 text-sm">{t(sendError)}</p>}<p role="status" className="text-sm mt-2">{t(announcement)}</p>
            </form>
          </section>
        </div>
        <aside className="border-2 border-ink bg-card p-5 sm:p-6 min-w-0" aria-labelledby="request-history-title"><h2 id="request-history-title" className="font-head font-extrabold text-2xl">{t("История заявки")}</h2><ol className="mt-5 space-y-5">{request.history.map((event, index) => {
          const author = [request.customer, request.provider].find((participant) => participant.email === event.by);
          return <li key={`${event.createdAt}:${index}`} className="border-l-2 border-ink pl-4"><RequestStatus status={event.status} /><p className="text-sm font-semibold break-words mt-2">{author?.name || event.by}</p><time dateTime={event.createdAt} className="text-xs text-ink/60 mt-1 block">{requestDate(event.createdAt, locale)}</time></li>;
        })}</ol><Link href="/wallet" className="inline-block text-sm underline underline-offset-4 mt-7">{t("Открыть кошелёк ↗")}</Link></aside>
      </div>
    </section>}
  </WorkflowGate>;
}
