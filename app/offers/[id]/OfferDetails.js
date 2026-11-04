"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthContext";
import { useOffers } from "@/components/OffersContext";
import Art from "@/components/Art";
import FavoriteButton from "@/components/FavoriteButton";
import ServiceCheckout from "@/components/ServiceCheckout";

export default function OfferDetails({ id }) {
  const { user, ready: authReady } = useAuth();
  const { all, ready, error, refresh, openModal } = useOffers();
  const offer = all.find((item) => item.id === id);
  if (!ready || !authReady) return <div className="max-w-6xl mx-auto px-4 py-14" role="status">Загружаем услугу…</div>;
  if (error) return <div className="max-w-6xl mx-auto px-4 py-14"><p role="alert">{error}</p><button onClick={refresh} className="btn bg-y mt-4">Повторить загрузку</button></div>;
  if (!offer) return <section className="max-w-3xl mx-auto px-4 py-20">
    <h1 className="font-head font-extrabold text-4xl">Услуга не найдена</h1>
    <p className="mt-4 text-ink/65">Проверьте ссылку или выберите другую услугу в каталоге.</p>
    <Link href="/find" className="btn bg-y inline-block mt-6">Перейти в каталог ↗</Link>
  </section>;
  const own = user?.email === offer.email;

  return <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
    <Link href={own ? "/services" : "/find"} className="text-sm font-semibold underline underline-offset-4">← {own ? "Мои услуги" : "Все услуги"}</Link>
    <div className="flex flex-wrap items-start justify-between gap-5 mt-7">
      <div className="min-w-0 flex-1 basis-64">
        <span className="lbl bg-y text-k border-2 border-ink px-2 py-1 inline-block">{offer.cat}</span>
        <h1 className="font-head font-extrabold text-4xl md:text-6xl tracking-tight mt-4 break-words">{offer.t}</h1>
      </div>
      <FavoriteButton offer={offer} />
    </div>
    <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-7 lg:gap-9 mt-8 items-start">
      <div className="min-w-0 grid gap-7">
        <section className="bg-card border-2 border-ink sh overflow-hidden">
          <Art cat={offer.cat} className="h-48 sm:h-64" />
          <div className="p-5 sm:p-7">
            <h2 className="font-head font-extrabold text-3xl">Об услуге</h2>
            <p className="mt-4 whitespace-pre-wrap break-words leading-relaxed text-ink/75">{offer.d}</p>
            <dl className="grid sm:grid-cols-2 gap-5 mt-7 border-t-2 border-ink pt-6">
              {[["Формат", offer.f], ["Длительность", `${offer.min} мин`], ["Уровень подготовки", offer.l], ["Язык общения", offer.lg], ["Место встречи", offer.f === "Онлайн" ? "Онлайн, по договорённости" : offer.city], ["Стоимость", "1 минута за 1 минуту помощи"]].map(([label, value]) =>
                <div key={label}><dt className="lbl text-ink/60">{label}</dt><dd className="font-semibold mt-2 break-words">{value}</dd></div>)}
            </dl>
          </div>
        </section>
        <section className="bg-lb text-k border-2 border-ink p-5 sm:p-7">
          <span className="lbl">Кто поможет</span>
          <div className="flex gap-4 items-center mt-4"><span className="shrink-0 w-14 h-14 bg-pu border-2 border-ink grid place-items-center font-head font-extrabold text-xl">{offer.i}</span>
            <div className="min-w-0"><h2 className="font-head font-extrabold text-2xl break-words">{offer.n}</h2><p className="text-sm mt-1 break-all">{offer.email}</p></div>
          </div>
          <p className="text-sm mt-4">{offer.f === "Онлайн" ? "Помощь онлайн — можно присоединиться из любого города." : `Очная встреча: ${offer.city}.`}</p>
        </section>
        <section className="border-2 border-ink bg-card p-5 sm:p-7">
          <h2 className="font-head font-extrabold text-2xl">Как договориться о занятии</h2>
          <ol className="list-decimal pl-5 mt-4 space-y-3 text-sm text-ink/75">
            <li>Свяжитесь с автором по указанной почте и обсудите, какую помощь хотите получить.</li>
            <li>Согласуйте время, формат и длительность занятия.</li>
            <li>Выберите длительность и подтвердите оплату на этой странице. Запись появится в истории кошелька.</li>
          </ol>
        </section>
      </div>
      <aside className="min-w-0 lg:sticky lg:top-24">
        {own ? <section className="bg-y text-k border-2 border-ink p-6 sh">
          <span className="lbl">Ваше предложение</span><h2 className="font-head font-extrabold text-3xl mt-3">Это ваша услуга</h2>
          <p className="text-sm mt-4">Вы можете изменить описание, формат, город и длительность. Обновления появятся в каталоге и в избранном участников.</p>
          <button type="button" onClick={() => openModal(offer)} className="btn bg-b !text-white w-full mt-6">Редактировать услугу</button>
          <Link href="/services" className="block mt-5 text-sm underline underline-offset-4">Все мои услуги ↗</Link>
        </section> : <ServiceCheckout key={`${offer.id}:${offer.updatedAt || ""}:${user?.email || "guest"}`} offer={offer} />}
      </aside>
    </div>
  </div>;
}
