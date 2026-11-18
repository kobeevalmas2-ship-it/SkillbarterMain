"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useLanguage } from "@/components/LanguageContext";
import { useSupport } from "@/components/SupportContext";
import { SUPPORT_STATUSES, SupportGate, SupportStatus, supportDate } from "@/components/SupportPanel";

export default function SupportPage() {
  const { t, locale } = useLanguage();
  const { user, ready: authReady, isAdmin } = useAuth();
  const { cases = [], ready, error, refresh } = useSupport();
  const [filter, setFilter] = useState("all");
  const sorted = [...cases].sort((a, b) => Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt));
  const list = sorted.filter((item) => filter === "all" || item.status === filter);
  const activeCount = cases.filter((item) => ["open", "reviewing"].includes(item.status)).length;

  return <SupportGate {...{ user, authReady, ready, error, refresh }}>
    <section className="max-w-5xl mx-auto px-4 py-10 md:py-14">
      <div className="flex flex-wrap justify-between gap-5 items-start"><div><span className="lbl text-acc">{t("Поможем разобраться")}</span><h1 className="font-head font-extrabold text-4xl md:text-6xl mt-3">{t("Мои обращения")}</h1><p className="text-ink/65 mt-4 max-w-2xl">{t("Следите за рассмотрением жалоб, общайтесь с поддержкой и смотрите решения по занятиям.")}</p></div>{isAdmin && <Link href="/admin" className="btn bg-pu">{t("Панель администратора ↗")}</Link>}</div>
      <div className="border-2 border-ink bg-lb text-k p-4 sm:p-5 mt-7 flex flex-wrap items-center justify-between gap-4"><p className="font-semibold">{t("Ожидают решения: {count}", { count: activeCount })}</p><p className="text-sm max-w-xl">{t("Новую жалобу можно отправить со страницы своей заявки, в том числе после завершения занятия.")}</p><Link href="/requests" className="text-sm font-bold underline underline-offset-4">{t("Перейти к заявкам ↗")}</Link></div>
      <div role="group" aria-label={t("Фильтр обращений")} className="flex flex-wrap gap-2 mt-7">{[["all", "Все обращения"], ...Object.entries(SUPPORT_STATUSES)].map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`border-2 border-ink px-3 py-2 text-sm font-bold ${filter === value ? "bg-y text-k" : "bg-card"}`}>{t(label)} <span className="text-xs">({value === "all" ? cases.length : cases.filter((item) => item.status === value).length})</span></button>)}</div>
      {list.length ? <ul className="grid gap-5 mt-6">{list.map((item) => <li key={item.id} className="border-2 border-ink bg-card p-5 sm:p-6 shs"><div className="flex flex-wrap gap-3 justify-between items-start"><SupportStatus status={item.status} /><time className="text-xs text-ink/60" dateTime={item.updatedAt || item.createdAt}>{supportDate(item.updatedAt || item.createdAt, locale)}</time></div><h2 className="font-head font-extrabold text-xl sm:text-2xl mt-4 break-words"><Link href={`/support/${item.id}`} className="hover:underline underline-offset-4">{item.title}</Link></h2><p className="text-sm text-ink/65 mt-2 break-words">{t("Обратился: {name}", { name: item.reporter?.name || item.reporter?.email })}</p><p className="text-sm mt-4 whitespace-pre-wrap break-words line-clamp-3">{item.text}</p><div className="flex flex-wrap gap-5 mt-5"><Link href={`/support/${item.id}`} className="text-sm font-bold underline underline-offset-4">{t("Переписка и решение ↗")}</Link><Link href={`/requests/${item.requestId}`} className="text-sm underline underline-offset-4">{t("Исходная заявка ↗")}</Link></div></li>)}</ul> : <div className="border-2 border-dashed border-ink p-8 sm:p-12 mt-6 text-center"><span aria-hidden="true" className="inline-grid place-items-center w-14 h-14 border-2 border-ink bg-y text-k text-3xl">?</span><h2 className="font-head font-extrabold text-2xl mt-5">{t(cases.length ? "Нет обращений с таким статусом" : "Пока нет обращений")}</h2><p className="text-sm text-ink/65 mt-3">{t(cases.length ? "Выберите другой фильтр, чтобы увидеть остальные обращения." : "Если с занятием возникнет проблема, откройте заявку и нажмите «Пожаловаться на занятие».")}</p>{cases.length ? <button type="button" onClick={() => setFilter("all")} className="btn bg-y mt-6">{t("Показать все обращения")}</button> : <Link href="/requests" className="btn bg-y inline-block mt-6">{t("Перейти к заявкам ↗")}</Link>}</div>}
    </section>
  </SupportGate>;
}
