"use client";
import Link from "next/link";
import { useAuth } from "./AuthContext";
import { useOffers } from "./OffersContext";
import FavoriteButton from "./FavoriteButton";
import Art from "./Art";
import { useLanguage } from "./LanguageContext";

export default function OfferCard({ o }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { openModal } = useOffers();
  const own = user?.email === o.email;
  return (
    <article className="relative bg-card text-ink border-2 border-ink sh flex flex-col">
      <Link href={`/offers/${o.id}`} className="absolute inset-0 z-[1]" aria-label={t("Подробнее: {title}", { title: o.t })} />
      <div>
        <Art cat={o.cat} />
        <div className="absolute right-3 top-3 z-10"><FavoriteButton offer={o} compact /></div>
      </div>
      <div className="p-5">
        <div className="flex justify-between lbl"><span>{t(o.cat)}</span><span>◷ {o.min} {t("мин")}</span></div>
        <h3 className="font-head font-extrabold text-2xl leading-tight mt-3">{o.t}</h3>
        <p className="mt-2 text-sm text-ink/70">{o.d}</p>
        <div className="flex gap-2 mt-4">
          <span className="lbl bg-lb text-k border border-ink px-2 py-1">{t(o.f)}</span>
          <span className="lbl bg-lb text-k border border-ink px-2 py-1">{t(o.l)}</span>
        </div>
        <div className="flex justify-between items-center border-t-2 border-ink mt-5 pt-4 text-sm font-semibold">
          <span className="flex items-center gap-2">
            <span className="w-7 h-7 bg-pu text-k border-2 border-ink grid place-items-center lbl">{o.i}</span>{o.n}
          </span>
          <span>★ {t("Новый")}</span>
        </div>
        <p className="bg-y text-k border-2 border-ink p-2.5 mt-4 text-center text-sm font-bold">{t(own ? "Подробнее об услуге ↗" : "Подробнее и оплата ↗")}</p>
        {own && <button type="button" onClick={() => openModal(o)} className="relative z-10 border-2 border-ink w-full mt-3 px-3 py-2 text-sm font-bold">{t("Редактировать")}</button>}
      </div>
    </article>
  );
}
