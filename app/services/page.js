"use client";
import OfferCard from "@/components/OfferCard";
import OpenModalButton from "@/components/OpenModalButton";
import { useOffers } from "@/components/OffersContext";
import { useAuth } from "@/components/AuthContext";
import Link from "next/link";

export default function ServicesPage() {
  const { mine, ready, error } = useOffers();
  const { user, ready: authReady } = useAuth();
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div>
          <span className="lbl bg-y text-k border-2 border-ink px-2 py-1 inline-block">Делитесь опытом</span>
          <h1 className="font-head font-extrabold text-4xl md:text-6xl tracking-tight mt-4">Мои услуги</h1>
          <p className="mt-2 text-ink/60">Управляйте тем, чему готовы научить других.</p>
        </div>
        <OpenModalButton>+ Новая услуга</OpenModalButton>
      </div>

      <div className="mt-8">
        {!ready || !authReady ? <p role="status">Загружаем услуги…</p> : !user ? <div className="bg-card border-2 border-ink p-8">
          <h2 className="font-head font-extrabold text-2xl">Войдите, чтобы управлять своими услугами</h2>
          <Link href="/login?next=/services" className="btn bg-y inline-block mt-5">Войти в аккаунт ↗</Link>
        </div> : error ? <p role="alert" className="bg-co text-k border-2 border-ink p-4">{error}</p> : mine.length ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
            {mine.map((o) => <OfferCard key={o.id} o={o} />)}
          </div>
        ) : (
          <div className="border-2 border-dashed border-ink p-14 text-center">
            <div className="font-head font-extrabold text-2xl">Пока нет услуг</div>
            <p className="mt-2 text-ink/70">Нажмите «Новая услуга» и расскажите, чему можете научить.</p>
          </div>
        )}
      </div>
    </div>
  );
}
