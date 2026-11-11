"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useLanguage } from "@/components/LanguageContext";
import { useRequests } from "@/components/RequestsContext";
import { useWallet } from "@/components/WalletContext";
import { RequestCard, WorkflowGate, requestDate } from "@/components/RequestUI";

function notificationText(notification, t) {
  return t(notification.text, { ...notification.values, ...(notification.values?.status ? { status: t(notification.values.status) } : {}) });
}

export default function DayPage() {
  const { t, locale } = useLanguage();
  const { user, ready: authReady } = useAuth();
  const { requests = [], notifications = [], unreadCount, unreadMessages, ready, error, refresh } = useRequests();
  const { balance, reserved = 0, ready: walletReady, error: walletError, refresh: refreshWallet } = useWallet();
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const pending = requests.filter((request) => request.status === "pending" && request.provider.email === user?.email);
  const confirmations = requests.filter((request) => request.status === "awaiting_confirmation" && request.customer.email === user?.email);
  const upcoming = requests.filter((request) => ["accepted", "in_progress", "awaiting_confirmation"].includes(request.status)).sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
  const today = now ? upcoming.filter((request) => new Date(request.scheduledAt).toDateString() === now.toDateString()) : [];
  const attention = [...confirmations, ...pending].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const recentNotifications = [...notifications].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 3);

  return <WorkflowGate user={user} authReady={authReady} ready={ready && walletReady} error={error || walletError} refresh={() => { refresh(); refreshWallet(); }} next="/day">
    <section className="max-w-6xl mx-auto px-4 py-10 md:py-14">
      <div className="flex flex-wrap justify-between items-end gap-5"><div>
        <span className="lbl text-acc">{t("Ваш день в SkillBarter")}</span><h1 className="font-head font-extrabold text-4xl md:text-6xl mt-3">{t("Мой день")}</h1>
        <p className="text-lg mt-4 break-words">{t("Здравствуйте, {name}!", { name: user?.name })}</p>
        {now && <p className="text-sm text-ink/60 mt-2"><time dateTime={now.toISOString()}>{new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(now)}</time></p>}
      </div><Link href="/find" className="btn bg-y">{t("Найти помощь ↗")}</Link></div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5 mt-8">
        <Link href="/wallet" className="block border-2 border-ink bg-y text-k p-5 shs"><span className="lbl">{t("Доступно для обмена")}</span><p className="font-head font-extrabold text-4xl mt-4">{balance?.toLocaleString(locale)} <span className="text-lg">{t("мин")}</span></p><p className="text-xs mt-3">{t("Зарезервировано: {minutes} мин", { minutes: reserved })}</p></Link>
        <Link href="/requests" className="block border-2 border-ink bg-lb text-k p-5 shs"><span className="lbl">{t("Занятий сегодня")}</span><p className="font-head font-extrabold text-4xl mt-4">{today.length}</p><p className="text-xs mt-3">{t("Согласованные встречи на сегодня")}</p></Link>
        <Link href="/requests" className="block border-2 border-ink bg-pu text-k p-5 shs"><span className="lbl">{t("Ждут вашего решения")}</span><p className="font-head font-extrabold text-4xl mt-4">{attention.length}</p><p className="text-xs mt-3">{t("Новые заявки и подтверждения занятий")}</p></Link>
        <Link href="/notifications" className="block border-2 border-ink bg-co text-k p-5 shs"><span className="lbl">{t("Новые уведомления")}</span><p className="font-head font-extrabold text-4xl mt-4">{unreadCount}</p><p className="text-xs mt-3">{t("Непрочитанных сообщений: {count}", { count: unreadMessages })}</p></Link>
      </div>

      <div className="flex flex-wrap gap-3 mt-7" aria-label={t("Быстрые действия")}>
        {[["/requests", "Мои заявки"], ["/services", "Мои услуги"], ["/profile", "Мой профиль"], ["/wallet", "Кошелёк"]].map(([href, label]) => <Link key={href} href={href} className="border-2 border-ink bg-card px-4 py-2 text-sm font-semibold">{t(label)} ↗</Link>)}
      </div>

      {attention.length > 0 && <section aria-labelledby="day-attention-title" className="mt-10"><div className="flex flex-wrap justify-between items-baseline gap-3"><h2 id="day-attention-title" className="font-head font-extrabold text-3xl">{t("Нужно ваше внимание")}</h2><Link href="/requests" className="text-sm underline underline-offset-4">{t("Все заявки ↗")}</Link></div><div className="grid lg:grid-cols-2 gap-6 mt-5">{attention.slice(0, 4).map((request) => <RequestCard key={request.id} request={request} email={user.email} showActions />)}</div></section>}

      <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-8 mt-10 items-start">
        <section className="min-w-0" aria-labelledby="day-upcoming-title"><div className="flex flex-wrap justify-between gap-3 items-baseline"><h2 id="day-upcoming-title" className="font-head font-extrabold text-3xl">{t("Ближайшие занятия")}</h2><Link href="/requests" className="text-sm underline underline-offset-4">{t("Все заявки ↗")}</Link></div>
          {upcoming.length ? <div className="grid gap-5 mt-5">{upcoming.slice(0, 4).map((request) => <RequestCard key={request.id} request={request} email={user.email} />)}</div> : <div className="border-2 border-dashed border-ink p-7 mt-5"><h3 className="font-head font-extrabold text-2xl">{t("Пока всё свободно")}</h3><p className="text-sm text-ink/65 mt-3">{t("Выберите навык, который хотите освоить, и договоритесь о первом занятии.")}</p><Link href="/find" className="btn bg-y inline-block mt-5">{t("Выбрать навык ↗")}</Link></div>}
        </section>
        <section className="border-2 border-ink bg-card p-5 sm:p-6 min-w-0" aria-labelledby="day-updates-title"><h2 id="day-updates-title" className="font-head font-extrabold text-2xl">{t("Последние события")}</h2>
          {recentNotifications.length ? <ul className="divide-y-2 divide-ink mt-3">{recentNotifications.map((notification) => <li key={notification.id} className="py-4"><Link href={`/requests/${notification.requestId}`} className="font-semibold text-sm break-words underline-offset-4 hover:underline">{!notification.readAt && <span aria-label={t("Непрочитано")} className="inline-block w-2 h-2 bg-acc mr-2" />}{notificationText(notification, t)}</Link><time className="block text-xs text-ink/60 mt-2" dateTime={notification.createdAt}>{requestDate(notification.createdAt, locale)}</time></li>)}</ul> : <p className="text-sm text-ink/65 mt-4">{t("Здесь появятся новости о ваших заявках и сообщениях.")}</p>}
          <Link href="/notifications" className="inline-block text-sm font-semibold underline underline-offset-4 mt-5">{t("Все уведомления ↗")}</Link>
        </section>
      </div>
    </section>
  </WorkflowGate>;
}
