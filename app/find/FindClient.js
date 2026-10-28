"use client";
import { useState } from "react";
import OfferCard from "@/components/OfferCard";
import OpenModalButton from "@/components/OpenModalButton";
import { useOffers } from "@/components/OffersContext";
import { CATS, OFFERS } from "@/components/data";

const fieldCls = "fld !text-k !bg-[#fffdf6]";

export default function FindClient({ initialCat }) {
  const { mine } = useOffers();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(initialCat);
  const [fmt, setFmt] = useState("");
  const [city, setCity] = useState("");
  const [sort, setSort] = useState("new");

  let list = [...mine, ...OFFERS].filter(
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
          <h1 className="font-head font-extrabold text-4xl md:text-6xl tracking-tight">Найдите свой навык</h1>
          <p className="mt-2 text-ink/60">Время — общая валюта. Выбирайте то, что вам интересно.</p>
        </div>
        <OpenModalButton>+ Предложить навык</OpenModalButton>
      </div>

      <div className="mt-8 bg-y text-k border-2 border-ink p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        <input className={fieldCls} placeholder="Поиск по названию или описанию" aria-label="Поиск" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={fieldCls} aria-label="Категория" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Все категории</option>
          {CATS.map((c) => <option key={c[0]}>{c[0]}</option>)}
        </select>
        <select className={fieldCls} aria-label="Формат" value={fmt} onChange={(e) => setFmt(e.target.value)}>
          <option value="">Любой формат</option><option>Онлайн</option><option>Офлайн</option>
        </select>
        <input className={fieldCls} placeholder="Город" aria-label="Город" value={city} onChange={(e) => setCity(e.target.value)} />
        <select className={fieldCls} aria-label="Сортировка" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="new">Сначала новые</option><option value="min">Меньше времени</option>
        </select>
      </div>

      <p className="mt-6 text-sm text-ink/70">Найдено предложений: {list.length}</p>
      {list.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7 mt-4">
          {list.map((o, i) => <OfferCard key={i} o={o} heart />)}
        </div>
      ) : (
        <div className="mt-4 border-2 border-dashed border-ink p-10 text-center text-ink/70">
          Ничего не нашлось. Попробуйте другую категорию или сбросьте город.
        </div>
      )}
    </div>
  );
}
