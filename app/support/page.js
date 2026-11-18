"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useLanguage } from "@/components/LanguageContext";
import { useSupport } from "@/components/SupportContext";
import { SUPPORT_STATUSES, SupportGate, SupportStatus, supportDate } from "@/components/SupportPanel";

const STATUS_STYLE = { open: "bg-lb", reviewing: "bg-pu", resolved: "bg-y", rejected: "bg-co" };

export default function SupportPage() {
  const { t, locale } = useLanguage();
  const { user, ready: authReady, isAdmin } = useAuth();
  const { cases = [], ready, error, refresh, unreadCount = 0 } = useSupport();
  const [filter, setFilter] = useState("all");
  const sorted = [...cases].sort((a, b) => Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt));
  const list = sorted.filter((item) => filter === "all" || item.status === filter);
  const activeCount = cases.filter((item) => ["open", "reviewing"].includes(item.status)).length;
  const latest = sorted[0];

  return <SupportGate {...{ user, authReady, ready, error, refresh }}>
    <section className="max-w-5xl mx-auto px-4 py-7 md:py-10">
      <div className="flex flex-wrap justify-between gap-4 items-start"><div><span className="lbl text-acc">{t("СЛУЖБА ПОДДЕРЖКИ")}</span><h1 className="font-head font-extrabold text-3xl sm:text-5xl mt-2">{t("Мои обращения")}</h1><p className="text-sm text-ink/60 mt-2">{t("Все вопросы и ответы — в одном месте.")}</p></div>{isAdmin && <Link href="/admin" className="btn bg-pu">{t("Панель администратора →")}</Link>}</div>
      <div className="grid sm:grid-cols-3 gap-3 mt-6">
        <div className="border-2 border-ink bg-lb p-4"><span className="text-2xl" aria-hidden="true">◷</span><p className="text-xs font-bold mt-2">{t("Ожидают решения")}</p><p className="font-head font-extrabold text-3xl mt-1">{activeCount}</p></div>
        <div className="border-2 border-ink bg-y p-4"><span className="text-2xl" aria-hidden="true">✉</span><p className="text-xs font-bold mt-2">{t("Всего обращений")}</p><p className="font-head font-extrabold text-3xl mt-1">{cases.length}</p></div>
        <div className="border-2 border-ink bg-card p-4"><span className="text-2xl" aria-hidden="true">●</span><p className="text-xs font-bold mt-2">{t("Новые сообщения")}</p><p className="font-head font-extrabold text-3xl mt-1">{unreadCount}</p></div>
      </div>
      {latest && <Link href={`/support/${latest.id}`} className="group flex items-center justify-between gap-4 border-2 border-ink bg-ink text-white p-4 mt-4 hover:bg-acc transition-colors"><div className="min-w-0"><span className="lbl text-y">{t("Продолжить переписку")}</span><p className="font-bold mt-1 truncate">{latest.title}</p><p className="text-xs text-white/65 mt-1">{t("Обновлено: {date}", { date: supportDate(latest.updatedAt || latest.createdAt, locale) })}</p></div><span aria-hidden="true" className="text-2xl shrink-0">→</span></Link>}
      <div role="group" aria-label={t("Фильтр обращений")} className="flex flex-wrap gap-2 mt-6">{[["all", "Все"], ...Object.entries(SUPPORT_STATUSES)].map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`border-2 border-ink px-3 py-2 text-xs font-bold ${filter === value ? "bg-ink text-white" : "bg-card"}`}>{t(label)} <span className="opacity-70">{value === "all" ? cases.length : cases.filter((item) => item.status === value).length}</span></button>)}</div>
      {list.length ? <ul className="grid sm:grid-cols-2 gap-3 mt-4">{list.map((item) => <li key={item.id}><Link href={`/support/${item.id}`} className="group block h-full border-2 border-ink bg-card p-4 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--sh)] transition-all"><div className="flex justify-between items-center gap-3"><SupportStatus status={item.status} /><time className="text-[11px] text-ink/55 text-right" dateTime={item.updatedAt || item.createdAt}>{supportDate(item.updatedAt || item.createdAt, locale)}</time></div><h2 className="font-head font-extrabold text-lg leading-snug mt-3 break-words group-hover:text-acc">{item.title}</h2><p className="text-xs text-ink/60 mt-2 line-clamp-2">{item.text}</p><div className="flex justify-between items-center gap-2 border-t border-ink/15 mt-3 pt-3"><span className="text-[11px] text-ink/55">{t("Заявка #{id}", { id: item.requestId.slice(0, 6) })}</span><span className="text-xs font-bold">{t("Открыть чат →")}</span></div></Link></li>)}</ul> : <div className="border-2 border-dashed border-ink p-8 mt-4 text-center bg-card"><span aria-hidden="true" className="inline-grid place-items-center w-12 h-12 border-2 border-ink bg-y text-2xl">✉</span><h2 className="font-head font-extrabold text-xl mt-3">{t(cases.length ? "Нет обращений с таким статусом" : "Пока нет обращений")}</h2><p className="text-sm text-ink/60 mt-2">{t(cases.length ? "Попробуйте выбрать другой фильтр." : "Если возникнет проблема, откройте заявку и свяжитесь с поддержкой.")}</p>{cases.length ? <button type="button" onClick={() => setFilter("all")} className="btn bg-y mt-4">{t("Показать все")}</button> : <Link href="/requests" className="btn bg-y inline-block mt-4">{t("Мои заявки →")}</Link>}</div>}
    </section>
  </SupportGate>;
}
