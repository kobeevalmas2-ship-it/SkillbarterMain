"use client";

import { useLanguage } from "@/components/LanguageContext";

import Link from "next/link";
import { useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { useWallet } from "./WalletContext";
import { serviceQuote } from "@/lib/catalog.mjs";
import { catalogReturnHref } from "@/lib/search-filters.mjs";

export default function ServiceCheckout({ offer, returnTo }) {
  const { t } = useLanguage();
  const { user, ready: authReady } = useAuth();
  const { balance, ready, error: walletError, refresh, transfer } = useWallet();
  const [minutes, setMinutes] = useState(String(offer.m1));
  const [review, setReview] = useState(null);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const amount = Number(minutes);
  const catalogLink = catalogReturnHref(returnTo);
  const nextHref = `/offers/${offer.id}${catalogLink ? `?returnTo=${encodeURIComponent(catalogLink)}` : ""}`;

  function prepare(event) {
    event.preventDefault();
    setError("");
    if (!Number.isSafeInteger(amount) || amount < offer.m1 || amount > offer.m2) {
      setError({ key: "Выберите длительность от {min} до {max} минут.", values: { min: offer.m1, max: offer.m2 } });
      return;
    }
    try {
      const quote = serviceQuote(offer, amount);
      if (amount > balance) throw new Error("Недостаточно минут на балансе. Выберите меньшую длительность.");
      setReview({ ...quote, id: crypto.randomUUID() });
    } catch (err) { setError(err.message); }
  }

  async function confirm(event) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const transaction = await transfer(review);
      setSuccess(transaction);
      setReview(null);
    } catch (err) { setError(err.message || "Не удалось провести оплату."); }
    finally { pending.current = false; setBusy(false); }
  }

  return <section className="bg-card border-2 border-ink p-5 sm:p-6 sh" aria-labelledby="checkout-title">
    <span className="lbl text-acc">{t("Обмен временем")}</span>
    <h2 id="checkout-title" className="font-head font-extrabold text-3xl mt-2">{t("Оплата услуги")}</h2>
    <p className="mt-3 text-sm text-ink/65">{t("1 минута занятия = 1 минута с вашего баланса.")}</p>
    {!authReady ? <p role="status" className="mt-5">{t("Загружаем…")}</p> : !user ? <div className="mt-5">
      <p className="text-sm mb-4">{t("Войдите, чтобы выбрать длительность и оплатить помощь.")}</p>
      <Link href={`/login?next=${encodeURIComponent(nextHref)}`} className="btn bg-y block text-center">{t("Войти и оплатить ↗")}</Link>
    </div> : walletError ? <div className="mt-5">
      <p role="alert" className="text-sm">{t(walletError)}</p>
      <button onClick={refresh} type="button" className="btn bg-y mt-4">{t("Повторить загрузку")}</button>
    </div> : !ready ? <p role="status" className="mt-5">{t("Загружаем баланс…")}</p> : success ? <div className="mt-5">
      <div role="status" className="bg-lb text-k border-2 border-ink p-4">
        <p className="font-bold text-xl">{t("Услуга оплачена!")}</p>
        <p className="text-sm mt-2">{t("{minutes} мин переведены участнику {name}.", { minutes: success.minutes, name: offer.n })}</p>
        <p className="text-sm mt-2">{t("Ваш баланс: {minutes} мин.", { minutes: balance })}</p>
      </div>
      <p className="mt-4 text-sm break-words">{offer.t}</p>
      <Link href="/wallet" className="inline-block mt-4 text-sm underline underline-offset-4">{t("Посмотреть запись в истории ↗")}</Link>
      <button type="button" className="btn bg-y w-full mt-5" onClick={() => { setSuccess(null); setMinutes(String(offer.m1)); }}>{t("Оплатить ещё одно занятие")}</button>
    </div> : <form onSubmit={review ? confirm : prepare} className="grid gap-4 mt-5" aria-busy={busy}>
      <p className="flex justify-between gap-3 border-2 border-ink bg-y text-k p-3 text-sm">{t("Ваш баланс")} <b className="font-mono whitespace-nowrap">{balance} {t("мин")}</b></p>
      {review ? <>
        <h3 className="font-bold text-lg">{t("Подтвердите оплату")}</h3>
        <dl className="grid gap-3 text-sm break-words">
          <div><dt className="text-ink/60">{t("Услуга")}</dt><dd className="font-bold">{review.note}</dd></div>
          <div><dt className="text-ink/60">{t("Получатель")}</dt><dd>{offer.n}</dd></div>
          <div><dt className="text-ink/60">{t("Длительность и стоимость")}</dt><dd className="font-mono font-bold text-2xl">{review.minutes} {t("мин")}</dd></div>
          <div><dt className="text-ink/60">{t("Баланс после оплаты")}</dt><dd className="font-bold">{balance - review.minutes} {t("мин")}</dd></div>
        </dl>
      </> : <>
        <label htmlFor="checkout-minutes" className="grid gap-2 text-sm font-semibold">{t("Длительность занятия, минут")}
          <input id="checkout-minutes" type="number" inputMode="numeric" min={offer.m1} max={offer.m2} step="1" required
            className="fld font-mono" value={minutes} onChange={(event) => { setMinutes(event.target.value); setError(""); }} />
        </label>
        <p className="text-xs text-ink/60">{t("Доступно от {min} до {max} минут.", { min: offer.m1, max: offer.m2 })}</p>
        <div className="flex flex-wrap gap-2">
          {[...new Set([offer.m1, 60, 120, offer.m2])].filter((value) => value >= offer.m1 && value <= offer.m2).sort((a, b) => a - b).map((value) =>
            <button key={value} type="button" onClick={() => { setMinutes(String(value)); setError(""); }}
              className={`border-2 border-ink px-3 py-1.5 text-sm font-mono ${amount === value ? "bg-y text-k" : "bg-card"}`}>{value}</button>)}
        </div>
        <p className="border-t-2 border-ink pt-4 flex flex-wrap justify-between items-baseline gap-2 font-bold">{t("К оплате")} <span className="font-mono text-3xl">{Number.isInteger(amount) && amount > 0 ? amount : "—"} {t("мин")}</span></p>
        {amount > balance && <p className="text-sm text-ink/70">{t("Недостаточно минут на балансе. Заработайте время, помогая другим участникам, или выберите меньшую длительность.")}</p>}
      </>}
      {error && <p role="alert" className="bg-co text-k border-2 border-ink p-3 text-sm">{t(error.key || error, error.values)}</p>}
      <button type="submit" disabled={busy || (!review && amount > balance)} className="btn bg-b !text-white disabled:opacity-50">{busy ? t("Оплачиваем…") : review ? t("Подтвердить оплату · {minutes} мин", { minutes: review.minutes }) : t("Оплатить минутами ↗")}</button>
      {review && <button type="button" disabled={busy} className="underline text-sm underline-offset-4" onClick={() => { setReview(null); setError(""); }}>{t("Изменить длительность")}</button>}
      <p className="text-xs leading-relaxed text-ink/55">{t("После подтверждения минуты сразу переводятся автору услуги. Сначала согласуйте с ним время и условия занятия.")}</p>
    </form>}
  </section>;
}
