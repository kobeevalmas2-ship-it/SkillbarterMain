"use client";
import Link from "next/link";
import { useAuth } from "./AuthContext";
import { useOffers } from "./OffersContext";
import FavoriteButton from "./FavoriteButton";
import Art from "./Art";
import { useLanguage } from "./LanguageContext";
import { catalogReturnHref } from "@/lib/search-filters.mjs";

export default function OfferCard({ o, returnTo }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { openModal } = useOffers();
  const own = user?.email === o.email;
  const catalogLink = catalogReturnHref(returnTo);
  const href = `/offers/${o.id}${catalogLink ? `?returnTo=${encodeURIComponent(catalogLink)}` : ""}`;
  const duration = o.m1 === o.m2 ? String(o.m1) : `${o.m1}–${o.m2}`;
  return (
    <article className="relative bg-card text-ink border-2 border-ink sh flex flex-col">
      <Link href={href} className="absolute inset-0 z-[1]" aria-label={t("Подробнее: {title}", { title: o.t })} />
      <div>
        <Art cat={o.cat} />
        <div className="absolute right-3 top-3 z-10"><FavoriteButton offer={o} compact /></div>
      </div>
      <div className="p-5 flex flex-col flex-1 min-w-0">
        <div className="lbl">{t(o.cat)}</div>
        <h3 className="font-head font-extrabold text-2xl leading-tight mt-3 line-clamp-2 break-words">{o.t}</h3>
        <p className="mt-2 text-sm text-ink/70 line-clamp-3 break-words">{o.d}</p>
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="lbl bg-lb text-k border border-ink px-2 py-1">{t(o.f)}</span>
          <span className="lbl bg-lb text-k border border-ink px-2 py-1">{t(o.l)}</span>
        </div>
        {o.f === "Офлайн" && <p className="mt-3 text-sm font-semibold break-words">{t("Город: {city}", { city: o.city })}</p>}
        <div className="mt-auto pt-5">
          <dl className="border-t-2 border-ink pt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="lbl text-ink/60">{t("Длительность")}</dt><dd className="font-bold mt-1">{duration} {t("мин")}</dd></div>
            <div><dt className="lbl text-ink/60">{t("Стоимость")}</dt><dd className="font-bold mt-1">{t("{minutes} мин со счёта", { minutes: duration })}</dd></div>
          </dl>
          <p className="text-xs text-ink/65 mt-2">{t("1 минута помощи = 1 минута баланса")}</p>
          <div className="flex justify-between items-center gap-2 border-t-2 border-ink mt-4 pt-4 text-sm font-semibold">
            <span className="flex items-center gap-2 min-w-0">
              <span className="shrink-0 w-7 h-7 bg-pu text-k border-2 border-ink grid place-items-center lbl">{o.i}</span><span className="break-words min-w-0">{o.n}</span>
            </span>
            <span className="shrink-0">★ {t("Новый")}</span>
          </div>
          <p className="bg-y text-k border-2 border-ink p-2.5 mt-4 text-center text-sm font-bold">{t(own ? "Подробнее об услуге ↗" : "Подробнее и заявка ↗")}</p>
          {own && <button type="button" onClick={() => openModal(o)} className="relative z-10 border-2 border-ink w-full mt-3 px-3 py-2 text-sm font-bold">{t("Редактировать")}</button>}
        </div>
      </div>
    </article>
  );
}
