"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useLanguage } from "@/components/LanguageContext";
import { useRequests } from "@/components/RequestsContext";
import { WorkflowGate, requestDate } from "@/components/RequestUI";

export default function NotificationsPage() {
  const { t, locale } = useLanguage();
  const { user, ready: authReady } = useAuth();
  const { notifications = [], unreadCount, ready, error, refresh, markNotificationRead, markAllRead } = useRequests();
  const [filter, setFilter] = useState("unread");
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const list = notifications.filter((notification) => filter === "all" || !notification.readAt).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  async function mark(id) {
    if (pending.current) return;
    pending.current = true; setBusy(id || "all"); setActionError(""); setMessage("");
    try {
      if (id) await markNotificationRead(id);
      else await markAllRead();
      setMessage(id ? "Уведомление отмечено прочитанным." : "Все уведомления отмечены прочитанными.");
    } catch (err) { setActionError(err.message || "Не удалось обновить уведомления."); }
    finally { pending.current = false; setBusy(""); }
  }

  return <WorkflowGate {...{ user, authReady, ready, error, refresh }} next="/notifications">
    <section className="max-w-4xl mx-auto px-4 py-10 md:py-14">
      <span className="lbl text-acc">{t("Будьте в курсе обменов")}</span><h1 className="font-head font-extrabold text-4xl md:text-6xl mt-3 break-words">{t("Центр уведомлений")}</h1><p className="text-ink/65 mt-4">{t("Заявки, изменения статуса и новые сообщения собраны здесь.")}</p>
      <div className="flex flex-wrap justify-between gap-4 items-center mt-8"><div className="flex flex-wrap gap-2" role="group" aria-label={t("Фильтр уведомлений")}>
        {[["unread", "Непрочитанные"], ["all", "Все уведомления"]].map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`border-2 border-ink px-3 py-2 text-sm font-bold ${filter === value ? "bg-y text-k" : "bg-card"}`}>{t(label)}{value === "unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}</button>)}
      </div><button type="button" disabled={Boolean(busy) || !unreadCount} onClick={() => mark()} className="border-2 border-ink bg-card px-3 py-2 text-sm font-semibold disabled:opacity-50">{t(busy === "all" ? "Сохраняем…" : "Отметить всё прочитанным")}</button></div>
      {actionError && <p role="alert" className="border-2 border-ink bg-co text-k p-3 mt-5 text-sm">{t(actionError)}</p>}<p role="status" className="text-sm mt-4">{t(message)}</p>
      {list.length ? <ul className="grid gap-4 mt-4" aria-busy={Boolean(busy)}>{list.map((notification) => <li key={notification.id} className={`border-2 border-ink bg-card p-5 sm:p-6 ${!notification.readAt ? "shs" : ""}`}>
        <div className="flex gap-4 items-start"><span aria-hidden="true" className={`shrink-0 border-2 border-ink w-10 h-10 grid place-items-center text-k font-bold ${notification.type === "message" ? "bg-lb" : "bg-y"}`}>{notification.type === "message" ? "↔" : "!"}</span><div className="min-w-0 flex-1">
          <div className="flex flex-wrap justify-between gap-2 items-baseline"><span className="lbl text-ink/60">{t(notification.type === "message" ? "Новое сообщение" : notification.type === "status" ? "Статус заявки" : "Новая заявка")}</span>{!notification.readAt && <span className="lbl text-acc">{t("Непрочитано")}</span>}</div>
          <p className="font-semibold break-words mt-2">{t(notification.text, { ...notification.values, ...(notification.values?.status ? { status: t(notification.values.status) } : {}) })}</p><time className="block text-xs text-ink/60 mt-3" dateTime={notification.createdAt}>{requestDate(notification.createdAt, locale)}</time>
          <div className="flex flex-wrap gap-x-5 gap-y-3 mt-4"><Link href={`/requests/${notification.requestId}`} className="text-sm font-semibold underline underline-offset-4">{t("Открыть заявку ↗")}</Link>{!notification.readAt && <button type="button" disabled={Boolean(busy)} className="text-sm underline underline-offset-4 disabled:opacity-50" onClick={() => mark(notification.id)}>{t(busy === notification.id ? "Сохраняем…" : "Отметить прочитанным")}</button>}</div>
        </div></div>
      </li>)}</ul> : <div className="border-2 border-dashed border-ink p-8 sm:p-12 mt-4 text-center"><span aria-hidden="true" className="text-4xl">✓</span><h2 className="font-head font-extrabold text-2xl mt-4">{t(filter === "unread" ? "Вы всё прочитали" : "Пока нет уведомлений")}</h2><p className="text-sm text-ink/65 mt-3">{t(filter === "unread" ? "Новые события появятся здесь, когда участник ответит на заявку или напишет сообщение." : "Отправьте первую заявку, чтобы начать обмен навыками.")}</p><Link href="/day" className="btn bg-y inline-block mt-6">{t("В мой день ↗")}</Link></div>}
    </section>
  </WorkflowGate>;
}
