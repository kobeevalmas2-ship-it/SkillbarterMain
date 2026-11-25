"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthContext";
import { useOffers } from "@/components/OffersContext";
import OfferCard from "@/components/OfferCard";
import { useLanguage } from "@/components/LanguageContext";
import { OfferGridSkeleton } from "@/components/LoadingState";

export default function FavoritesPage() {
  const { t } = useLanguage();
  const { user, ready: authReady } = useAuth();
  const { favorites, ready, error } = useOffers();
  return <section className="max-w-6xl mx-auto px-4 py-10 md:py-14">
    <span className="lbl bg-pu text-k border-2 border-ink px-2 py-1 inline-block">{t("Сохраните на потом")}</span>
    <h1 className="font-head font-extrabold text-4xl md:text-6xl tracking-tight mt-4">{t("Избранное")}</h1>
    <p className="mt-3 text-ink/65">{t("Услуги, к которым хочется вернуться. Нажмите на сердечко в карточке, чтобы сохранить их здесь.")}</p>
    {!authReady || !ready ? <div className="mt-8"><OfferGridSkeleton label="Загружаем избранное…" count={3} /></div> : !user ? <div className="bg-card border-2 border-ink p-7 mt-8 shs">
      <h2 className="font-head font-extrabold text-2xl">{t("Войдите, чтобы сохранять услуги")}</h2>
      <p className="mt-3 text-ink/65">{t("У каждого участника свой список избранного.")}</p>
      <Link href="/login?next=/favorites" className="btn bg-y inline-block mt-5">{t("Войти в аккаунт ↗")}</Link>
    </div> : error ? <p role="alert" className="mt-8 bg-co text-k border-2 border-ink p-4">{t(error)}</p> : favorites.length ? <>
      <p className="text-sm text-ink/60 mt-7">{t("Сохранено услуг: {count}", { count: favorites.length })}</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7 mt-4">{favorites.map((offer) => <OfferCard key={offer.id} o={offer} />)}</div>
    </> : <div className="border-2 border-dashed border-ink p-8 sm:p-14 text-center mt-8">
      <span aria-hidden="true" className="text-5xl">♡</span><h2 className="font-head font-extrabold text-2xl mt-4">{t("Пока ничего не сохранено")}</h2>
      <p className="text-ink/65 mt-2">{t("Найдите интересную услугу и добавьте её в избранное.")}</p>
      <Link href="/find" className="btn bg-y inline-block mt-6">{t("Найти помощь ↗")}</Link>
    </div>}
  </section>;
}
