"use client";
import { useState } from "react";
import OfferCard from "@/components/OfferCard";
import OpenModalButton from "@/components/OpenModalButton";
import { useOffers } from "@/components/OffersContext";
import { CATS } from "@/components/data";
import { useLanguage } from "@/components/LanguageContext";

const fieldCls = "fld !text-k !bg-[#fffdf6]";

export default function FindClient({ initialCat }) {
  const { t } = useLanguage();
  const { all, ready, error } = useOffers();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(initialCat);
  const [fmt, setFmt] = useState("");
  const [city, setCity] = useState("");
  const [sort, setSort] = useState("new");

  let list = all.filter(
    (o) =>
      (!cat || o.cat === cat) &&
      (!fmt || o.f === fmt) &&
      (!city || (o.city || "").toLowerCase().includes(city.toLowerCase())) &&
      `${o.t} ${o.d}`.toLowerCase().includes(q.toLowerCase())
  );
  if (sort === "min") list = [...list].sort((a, b) => a.v - b.v);

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
        <input className={fieldCls} placeholder={t("Поиск по названию или описанию")} aria-label={t("Поиск")} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={fieldCls} aria-label={t("Категория")} value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">{t("Все категории")}</option>
          {CATS.map((c) => <option key={c[0]} value={c[0]}>{t(c[0])}</option>)}
        </select>
        <select className={fieldCls} aria-label={t("Формат")} value={fmt} onChange={(e) => setFmt(e.target.value)}>
          <option value="">{t("Любой формат")}</option><option value="Онлайн">{t("Онлайн")}</option><option value="Офлайн">{t("Офлайн")}</option>
        </select>
        <input className={fieldCls} placeholder={t("Город")} aria-label={t("Город")} value={city} onChange={(e) => setCity(e.target.value)} />
        <select className={fieldCls} aria-label={t("Сортировка")} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="new">{t("Сначала новые")}</option><option value="min">{t("Меньше времени")}</option>
        </select>
      </div>

      {error && <p role="alert" className="bg-co text-k border-2 border-ink p-3 mt-6">{t(error)}</p>}
      <p className="mt-6 text-sm text-ink/70" role="status">{ready ? t("Найдено предложений: {count}", { count: list.length }) : t("Загружаем услуги…")}</p>
      {list.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7 mt-4">
          {list.map((o) => <OfferCard key={o.id} o={o} />)}
        </div>
      ) : (
        <div className="mt-4 border-2 border-dashed border-ink p-10 text-center text-ink/70">
          {t("Ничего не нашлось. Попробуйте другую категорию или сбросьте город.")}
        </div>
      )}
    </div>
  );
}
