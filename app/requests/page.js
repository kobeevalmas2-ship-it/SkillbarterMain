"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useLanguage } from "@/components/LanguageContext";
import { useRequests } from "@/components/RequestsContext";
import { RequestCard, WorkflowGate } from "@/components/RequestUI";
import { REQUEST_STATUS_LABELS } from "@/lib/requests.mjs";

export default function RequestsPage() {
  const { t } = useLanguage();
  const { user, ready: authReady } = useAuth();
  const { requests = [], ready, error, refresh, unreadMessages } = useRequests();
  const [direction, setDirection] = useState("all");
  const [status, setStatus] = useState("all");
  const list = requests.filter((request) =>
    (direction === "all" || (direction === "incoming" ? request.provider.email === user?.email : request.customer.email === user?.email)) &&
    (status === "all" || request.status === status)
  ).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  return <WorkflowGate {...{ user, authReady, ready, error, refresh }} next="/requests">
    <section className="max-w-6xl mx-auto px-4 py-10 md:py-14">
      <div className="flex flex-wrap justify-between items-end gap-5">
        <div><span className="lbl text-acc">{t("От знакомства до результата")}</span><h1 className="font-head font-extrabold text-4xl md:text-6xl mt-3">{t("Мои заявки")}</h1><p className="text-ink/65 mt-3 max-w-2xl">{t("Согласуйте занятие, следите за его статусом и общайтесь с участником в чате.")}</p></div>
        <Link href="/find" className="btn bg-y">{t("Найти помощь ↗")}</Link>
      </div>
      {unreadMessages > 0 && <p className="mt-6 border-2 border-ink bg-lb text-k p-3 text-sm" role="status">{t("Непрочитанных сообщений: {count}", { count: unreadMessages })}</p>}
      <div className="flex flex-wrap justify-between gap-4 items-center border-2 border-ink bg-card p-4 mt-8">
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("Направление заявок")}>
          {[["all", "Все заявки"], ["incoming", "Входящие"], ["outgoing", "Исходящие"]].map(([value, label]) => <button key={value} type="button" aria-pressed={direction === value} onClick={() => setDirection(value)} className={`border-2 border-ink px-3 py-2 text-sm font-bold ${direction === value ? "bg-y text-k" : "bg-card"}`}>{t(label)}</button>)}
        </div>
        <label className="flex items-center gap-3 text-sm font-semibold">{t("Статус")}
          <select className="fld !w-auto max-w-full" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">{t("Все статусы")}</option>{Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select>
        </label>
      </div>
      <p className="mt-5 text-sm text-ink/60" role="status">{t("Найдено заявок: {count}", { count: list.length })}</p>
      {list.length ? <div className="grid lg:grid-cols-2 gap-6 mt-4">{list.map((request) => <RequestCard key={request.id} request={request} email={user.email} showActions />)}</div> : <div className="border-2 border-dashed border-ink p-8 sm:p-12 text-center mt-4">
        <span aria-hidden="true" className="text-4xl">↔</span><h2 className="font-head font-extrabold text-2xl mt-4">{t(requests.length ? "Под эти условия заявок нет" : "Первый обмен ещё впереди")}</h2>
        <p className="text-ink/65 mt-3">{t(requests.length ? "Выберите другое направление или статус." : "Откройте услугу в каталоге и отправьте заявку на занятие.")}</p>
        {requests.length ? <button type="button" onClick={() => { setDirection("all"); setStatus("all"); }} className="btn bg-y mt-6">{t("Сбросить фильтры")}</button> : <Link href="/find" className="btn bg-y inline-block mt-6">{t("Перейти в каталог ↗")}</Link>}
      </div>}
    </section>
  </WorkflowGate>;
}
