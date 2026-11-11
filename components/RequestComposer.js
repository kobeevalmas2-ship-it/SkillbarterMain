"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { useLanguage } from "./LanguageContext";
import { useRequests } from "./RequestsContext";
import { useWallet } from "./WalletContext";
import LoadingState from "./LoadingState";

export default function RequestComposer({ offer, returnTo }) {
  const { t } = useLanguage();
  const { user, ready: authReady } = useAuth();
  const { createRequest, ready, error: loadError, refresh } = useRequests();
  const { balance } = useWallet();
  const router = useRouter();
  const [minutes, setMinutes] = useState(String(offer.m1));
  const [date, setDate] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState(null);
  const pending = useRef(false);
  const next = `/offers/${offer.id}${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;

  async function submit(event) {
    event.preventDefault();
    if (pending.current || createdId) return;
    setError("");
    const scheduled = new Date(date);
    if (!date || !Number.isFinite(scheduled.getTime()) || scheduled.getTime() <= Date.now()) { setError("Выберите дату и время в будущем."); return; }
    if (!Number.isSafeInteger(Number(minutes)) || Number(minutes) < offer.m1 || Number(minutes) > offer.m2) { setError("Выберите допустимую длительность занятия."); return; }
    pending.current = true;
    setBusy(true);
    try {
      const id = await createRequest({ offerId: offer.id, minutes: Number(minutes), scheduledAt: scheduled.toISOString(), message });
      setCreatedId(id);
      router.push(`/requests/${id}`);
    } catch (err) { setError(err.message || "Не удалось отправить заявку. Попробуйте снова."); }
    finally { pending.current = false; setBusy(false); }
  }

  return <section className="bg-card border-2 border-ink p-5 sm:p-6 sh" aria-labelledby="request-composer-title">
    <span className="lbl text-acc">{t("Занятие по договорённости")}</span>
    <h2 id="request-composer-title" className="font-head font-extrabold text-3xl mt-2">{t("Отправить заявку")}</h2>
    <p className="mt-3 text-sm text-ink/70">{t("Выберите время и обсудите детали с автором в чате заявки.")}</p>
    {!authReady ? <LoadingState label={t("Загружаем…")} /> : !user ? <div className="mt-5">
      <p className="text-sm mb-4">{t("Войдите, чтобы договориться о занятии.")}</p>
      <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn bg-y block text-center">{t("Войти и отправить заявку")}</Link>
    </div> : loadError ? <div className="mt-5"><p role="alert">{t(loadError)}</p><button type="button" onClick={refresh} className="btn bg-y mt-3">{t("Повторить загрузку")}</button></div>
      : !ready ? <LoadingState label={t("Загружаем баланс…")} /> : createdId ? <div role="status" className="mt-5 bg-lb text-k border-2 border-ink p-4">
        <p className="font-bold">{t("Заявка отправлена")}</p><Link href={`/requests/${createdId}`} className="underline inline-block mt-3">{t("Открыть заявку и чат")}</Link>
      </div> : <form onSubmit={submit} aria-busy={busy} className="grid gap-4 mt-5">
      <p className="bg-y text-k border-2 border-ink p-3 text-sm flex justify-between gap-2">{t("Свободно на балансе")}<b className="font-mono">{balance} {t("мин")}</b></p>
      <label className="grid gap-2 text-sm font-semibold">{t("Длительность занятия, минут")}
        <input type="number" inputMode="numeric" min={offer.m1} max={offer.m2} step="1" required className="fld" value={minutes} disabled={busy} onChange={(e) => { setMinutes(e.target.value); setError(""); }} />
      </label>
      <p className="text-xs text-ink/65">{t("Доступно от {min} до {max} минут.", { min: offer.m1, max: offer.m2 })}</p>
      <label className="grid gap-2 text-sm font-semibold">{t("Желаемые дата и время")}
        <input type="datetime-local" required className="fld min-w-0" value={date} disabled={busy} onChange={(e) => { setDate(e.target.value); setError(""); }} aria-describedby="request-time-help" />
      </label>
      <p id="request-time-help" className="text-xs text-ink/65">{t("Укажите время по часовому поясу вашего устройства.")}</p>
      <label className="grid gap-2 text-sm font-semibold">{t("Первое сообщение автору")}
        <textarea rows={3} maxLength={2000} className="fld resize-y" value={message} disabled={busy} onChange={(e) => setMessage(e.target.value)} placeholder={t("Расскажите, какую помощь хотите получить…")} />
      </label>
      <p className="text-xs text-ink/65">{t("Сообщение необязательно. Переписка сохранится внутри заявки.")}</p>
      {error && <p role="alert" className="bg-co text-k border-2 border-ink p-3 text-sm">{t(error)}</p>}
      {Number(minutes) > balance && <p className="text-sm text-ink/70">{t("Недостаточно свободных минут для заявки.")}</p>}
      <button type="submit" className="btn bg-b !text-white disabled:opacity-50" disabled={busy || Number(minutes) > balance}>{t(busy ? "Отправляем заявку…" : "Отправить заявку ↗")}</button>
      <p className="text-xs leading-relaxed text-ink/65">{t("Минуты резервируются, когда автор принимает заявку. Перевод происходит после вашего подтверждения выполненного занятия.")}</p>
    </form>}
  </section>;
}
