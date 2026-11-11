"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import OfferCard from "@/components/OfferCard";
import OpenModalButton from "@/components/OpenModalButton";
import { useOffers } from "@/components/OffersContext";
import { CATS } from "@/components/data";
import { useLanguage } from "@/components/LanguageContext";
import { EMPTY_FILTERS, readSearchFilters, findHref, filterOffers } from "@/lib/search-filters.mjs";

const fieldCls = "fld !text-k !bg-[#fffdf6]";

export default function FindClient({ initialFilters }) {
  const { t } = useLanguage();
  const { all, ready, error } = useOffers();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(initialFilters);
  const { q, cat, fmt, city, sort } = filters;
  const urlQuery = searchParams.toString();

  // Native history updates are integrated with Next's router. Back/Forward restores
  // the fields without navigating on every keystroke or remounting the inputs.
  useEffect(() => {
    // A delayed router transition must not overwrite newer input already in the URL.
    if (new URLSearchParams(window.location.search).toString() === urlQuery) {
      setFilters(readSearchFilters(new URLSearchParams(urlQuery)));
    }
  }, [urlQuery]);

  function changeFilter(key, value, replace = false) {
    const next = key ? { ...filters, [key]: value } : { ...EMPTY_FILTERS };
    setFilters(next);
    const href = findHref(next);
    if (href !== `${window.location.pathname}${window.location.search}`) {
      window.history[replace ? "replaceState" : "pushState"](null, "", href);
    }
  }

  const list = filterOffers(all, filters);
  const returnTo = findHref(filters);
  const activeFilters = [
    q && ["q", t("Поиск: {query}", { query: q })],
    cat && ["cat", t(cat)],
    fmt && ["fmt", t(fmt)],
    city && ["city", t("Город: {city}", { city })],
    sort !== "new" && ["sort", t("Меньше времени")],
  ].filter(Boolean);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div>
          <h1 className="font-head font-extrabold text-4xl md:text-6xl tracking-tight">{t("Найдите свой навык")}</h1>
          <p className="mt-2 text-ink/60">{t("Время — общая валюта. Выбирайте то, что вам интересно.")}</p>
        </div>
        <OpenModalButton>{t("+ Предложить навык")}</OpenModalButton>
      </div>

      <div className="mt-8 bg-y text-k border-2 border-ink p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        <input className={fieldCls} placeholder={t("Поиск по названию или описанию")} aria-label={t("Поиск")} value={q} maxLength={200} onChange={(e) => changeFilter("q", e.target.value, true)} />
        <select className={fieldCls} aria-label={t("Категория")} value={cat} onChange={(e) => changeFilter("cat", e.target.value)}>
          <option value="">{t("Все категории")}</option>
          {CATS.map((c) => <option key={c[0]} value={c[0]}>{t(c[0])}</option>)}
        </select>
        <select className={fieldCls} aria-label={t("Формат")} value={fmt} onChange={(e) => changeFilter("fmt", e.target.value)}>
          <option value="">{t("Любой формат")}</option><option value="Онлайн">{t("Онлайн")}</option><option value="Офлайн">{t("Офлайн")}</option>
        </select>
        <input className={fieldCls} placeholder={t("Город")} aria-label={t("Город")} value={city} maxLength={80} onChange={(e) => changeFilter("city", e.target.value, true)} />
        <select className={fieldCls} aria-label={t("Сортировка")} value={sort} onChange={(e) => changeFilter("sort", e.target.value)}>
          <option value="new">{t("Сначала новые")}</option><option value="min">{t("Меньше времени")}</option>
        </select>
      </div>

      {activeFilters.length > 0 && <div className="flex flex-wrap items-center gap-2 mt-4" role="group" aria-label={t("Выбранные условия")}>
        {activeFilters.map(([key, label]) => <button key={key} type="button"
          onClick={() => changeFilter(key, key === "sort" ? "new" : "")}
          aria-label={t("Убрать условие: {label}", { label })}
          className="inline-flex max-w-full items-center gap-2 bg-card border-2 border-ink px-3 py-2 text-sm font-semibold">
          <span className="break-words min-w-0">{label}</span><span aria-hidden="true">×</span>
        </button>)}
        <button type="button" onClick={() => changeFilter()} className="px-3 py-2 text-sm font-semibold underline underline-offset-4">{t("Сбросить фильтры")}</button>
      </div>}

      {error && <p role="alert" className="bg-co text-k border-2 border-ink p-3 mt-6">{t(error)}</p>}
      <p className="mt-6 text-sm text-ink/70" role="status">{ready ? t("Найдено предложений: {count}", { count: list.length }) : t("Загружаем услуги…")}</p>
      {list.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7 mt-4">
          {list.map((o) => <OfferCard key={o.id} o={o} returnTo={returnTo} />)}
        </div>
      ) : (
        <div className="mt-4 border-2 border-dashed border-ink p-10 text-center text-ink/70">
          {t("Ничего не нашлось. Попробуйте другую категорию или сбросьте город.")}
          {activeFilters.length > 0 && <button type="button" onClick={() => changeFilter()} className="btn bg-y block mx-auto mt-5">{t("Сбросить фильтры")}</button>}
        </div>
      )}
    </div>
  );
}
