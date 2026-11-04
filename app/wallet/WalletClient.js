"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useWallet } from "@/components/WalletContext";
import { normalizeEmail } from "@/lib/wallet.mjs";

const FILTERS = [["all", "Все операции"], ["incoming", "Поступления"], ["outgoing", "Списания"]];
const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" });

export default function WalletClient(props) {
  const { user, ready: authReady } = useAuth();
  const { ready, error, refresh } = useWallet();
  if (!authReady) return <div className="max-w-6xl mx-auto px-4 py-14" role="status">Загружаем кошелёк…</div>;
  if (!user) {
    const params = new URLSearchParams({ recipient: props.initialRecipient, minutes: props.initialMinutes, service: props.initialService });
    return <section className="max-w-2xl mx-auto px-4 py-16">
      <div className="bg-card border-2 border-ink p-8 sh">
        <span className="lbl">Время — ваша валюта</span>
        <h1 className="font-head font-extrabold text-4xl mt-4">Ваш кошелёк времени</h1>
        <p className="text-ink/70 mt-4 mb-7">Войдите или зарегистрируйтесь, чтобы получить 120 стартовых минут, оплачивать помощь и видеть историю транзакций.</p>
        <Link href={`/login?next=${encodeURIComponent(`/wallet?${params}`)}`} className="btn bg-y inline-block">Войти в аккаунт ↗</Link>
      </div>
    </section>;
  }
  if (error) return <div className="max-w-6xl mx-auto px-4 py-14">
    <p role="alert" className="border-2 border-ink bg-co text-k p-4">{error}</p>
    <button onClick={refresh} className="btn bg-y mt-4">Попробовать снова</button>
  </div>;
  if (!ready) return <div className="max-w-6xl mx-auto px-4 py-14" role="status">Загружаем кошелёк…</div>;
  return <WalletDashboard key={user.email} {...props} user={user} />;
}

function WalletDashboard({ user, initialRecipient, initialMinutes, initialService }) {
  const { balance, history, participants, transfer } = useWallet();
  const [recipient, setRecipient] = useState(normalizeEmail(initialRecipient));
  const [minutes, setMinutes] = useState(initialMinutes);
  const [note, setNote] = useState(initialService);
  const [isService, setIsService] = useState(Boolean(initialService));
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(10);

  function participantName(email) {
    return participants.find((account) => account.email === email)?.name || email;
  }

  function prepare(event) {
    event.preventDefault();
    setError("");
    setSuccess(null);
    const amount = Number(minutes);
    if (!participants.some((account) => account.email === recipient)) return setError("Выберите участника из списка.");
    if (!Number.isSafeInteger(amount) || amount <= 0) return setError("Введите целое количество минут больше нуля.");
    if (amount > balance) return setError("Недостаточно минут на балансе.");
    setReview({ id: crypto.randomUUID(), to: recipient, minutes: amount, note: note.trim(), type: isService ? "service" : "transfer" });
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
      setRecipient("");
      setMinutes("60");
      setNote("");
      setIsService(false);
      setFilter("all");
      setQuery("");
      setVisibleCount(10);
    } catch (err) {
      setError(err.message || "Не удалось сохранить перевод. Попробуйте снова.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const earned = history.filter((tx) => tx.to === user.email && tx.type !== "bonus").reduce((total, tx) => total + tx.minutes, 0);
  const spent = history.filter((tx) => tx.from === user.email).reduce((total, tx) => total + tx.minutes, 0);
  const filtered = history.filter((tx) => {
    const incoming = tx.to === user.email;
    const counterpart = incoming ? tx.from : tx.to;
    return (filter === "all" || (filter === "incoming" ? incoming : !incoming)) &&
      `${tx.note} ${tx.id} ${counterpart || "SkillBarter"} ${counterpart ? participantName(counterpart) : "Стартовый бонус"}`.toLowerCase().includes(query.trim().toLowerCase());
  });

  return <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
    <span className="lbl bg-y text-k border-2 border-ink px-2 py-1 inline-block">Знания превращаются во время</span>
    <h1 className="font-head font-extrabold text-4xl md:text-6xl tracking-tight mt-4">Кошелёк времени</h1>
    <p className="text-ink/65 mt-3">Получайте минуты за помощь и тратьте их на новые навыки. 1 минута помощи = 1 минута на балансе.</p>

    <div className="grid md:grid-cols-[1.4fr_1fr_1fr] gap-5 mt-8">
      <div className="bg-y text-k border-2 border-ink p-6 sh">
        <p className="lbl">Доступно для обмена</p>
        <p className="font-head font-extrabold text-5xl mt-3">{balance.toLocaleString("ru-RU")} <span className="text-xl">мин</span></p>
        <p className="text-sm mt-3">{Math.floor(balance / 60)} ч {balance % 60} мин вашего времени</p>
      </div>
      <div className="bg-lb text-k border-2 border-ink p-6">
        <p className="lbl">Получено от участников ↙</p>
        <p className="font-head font-extrabold text-4xl mt-4">+{earned.toLocaleString("ru-RU")} <span className="text-lg">мин</span></p>
        <p className="text-sm mt-3">Без учёта стартового бонуса</p>
      </div>
      <div className="bg-pu text-k border-2 border-ink p-6">
        <p className="lbl">Передано участникам ↗</p>
        <p className="font-head font-extrabold text-4xl mt-4">−{spent.toLocaleString("ru-RU")} <span className="text-lg">мин</span></p>
        <p className="text-sm mt-3">Оплата услуг и переводы</p>
      </div>
    </div>

    <div className="grid lg:grid-cols-[340px_minmax(0,1fr)] gap-7 mt-9 items-start">
      <section className="bg-card border-2 border-ink p-5 sm:p-6 shs" aria-labelledby="transfer-title">
        <span className="lbl text-acc">01 / Передать время</span>
        <h2 id="transfer-title" className="font-head font-extrabold text-2xl mt-2">{review ? "Проверьте перевод" : isService ? "Оплатить услугу" : "Перевести минуты"}</h2>
        <p className="text-sm text-ink/65 mt-2">{review ? "После подтверждения минуты сразу поступят получателю." : "Поблагодарите участника за помощь."}</p>
        <form onSubmit={review ? confirm : prepare} className="grid gap-4 mt-5" aria-busy={busy}>
          {review ? <dl className="border-2 border-ink p-4 space-y-4 break-words">
            <div><dt className="lbl text-ink/60">Получатель</dt><dd className="font-bold mt-1">{participantName(review.to)}</dd><dd className="text-xs text-ink/65 mt-1">{review.to}</dd></div>
            <div><dt className="lbl text-ink/60">Сумма</dt><dd className="font-mono font-bold text-3xl mt-1">{review.minutes} мин</dd></div>
            <div><dt className="lbl text-ink/60">Назначение</dt><dd className="text-sm mt-1">{review.note || "Перевод минут"}</dd></div>
            <div><dt className="lbl text-ink/60">Останется на балансе</dt><dd className="font-bold mt-1">{balance - review.minutes} мин</dd></div>
          </dl> : <>
            <label className="grid gap-2 text-sm font-semibold">Получатель
              <select className="fld" value={recipient} onChange={(event) => setRecipient(event.target.value)} required>
                <option value="" disabled>Выберите участника</option>
                {participants.map((account) => <option key={account.email} value={account.email}>{account.name} · {account.email}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">Количество минут
              <input className="fld font-mono" type="number" inputMode="numeric" min="1" step="1" max={balance} value={minutes} onChange={(event) => setMinutes(event.target.value)} required />
            </label>
            <div className="flex gap-2" aria-label="Быстрый выбор суммы">
              {[30, 60, 120].map((amount) => <button key={amount} type="button" onClick={() => setMinutes(String(amount))} disabled={amount > balance} className={`border-2 border-ink px-3 py-1 text-sm font-mono disabled:opacity-40 ${Number(minutes) === amount ? "bg-y text-k" : "bg-card"}`}>{amount}</button>)}
            </div>
            <label className="grid gap-2 text-sm font-semibold">Назначение <span className="font-normal text-ink/60 text-xs">Необязательно · до 200 символов</span>
              <textarea rows={3} className="fld resize-y" maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Например, за занятие английским" />
            </label>
          </>}
          {error && <p role="alert" className="border-2 border-ink bg-co text-k text-sm p-3">{error}</p>}
          <button className="btn bg-b !text-white disabled:opacity-50" type="submit" disabled={busy || (!review && balance <= 0)}>{busy ? "Переводим…" : review ? `Подтвердить · ${review.minutes} мин ↗` : "Продолжить ↗"}</button>
          {review && <button type="button" className="underline text-sm underline-offset-4 disabled:opacity-50" disabled={busy} onClick={() => { setReview(null); setError(""); }}>Изменить перевод</button>}
          {balance <= 0 && !review && <p className="text-sm text-ink/65">Минуты закончились. Предложите свою помощь, чтобы получить время от других участников.</p>}
        </form>
        <div role="status" aria-live="polite">
          {success && <p className="mt-4 border-2 border-ink bg-lb text-k p-3 text-sm break-words"><b>Перевод выполнен!</b><br />{success.minutes} мин → {participantName(success.to)}. Операция сохранена в истории.</p>}
        </div>
        <p className="border-t-2 border-ink pt-4 mt-5 text-xs text-ink/60 leading-relaxed">Участники с почтой @skillbarter.local — демонстрационные авторы услуг. Для перевода знакомому он должен зарегистрироваться в этом браузере.</p>
      </section>

      <section className="min-w-0" aria-labelledby="history-title">
        <div className="flex flex-wrap justify-between gap-2 items-baseline">
          <div><span className="lbl text-acc">02 / Движение времени</span><h2 id="history-title" className="font-head font-extrabold text-3xl mt-2">История транзакций</h2></div>
          <span className="lbl text-ink/60">Операций: {history.length}</span>
        </div>
        <div className="flex flex-wrap gap-2 mt-5" aria-label="Фильтр операций">
          {FILTERS.map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => { setFilter(value); setVisibleCount(10); }} className={`border-2 border-ink px-3 py-2 text-sm font-semibold ${filter === value ? "bg-y text-k shs" : "bg-card"}`}>{label}</button>)}
        </div>
        <input type="search" className="fld mt-4" aria-label="Поиск по истории транзакций" placeholder="Участник, назначение или номер операции" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(10); }} />
        <p className="text-xs text-ink/60 my-3" role="status">Найдено: {filtered.length}</p>
        {filtered.length ? <ul className="border-2 border-ink bg-card divide-y-2 divide-ink">
          {filtered.slice(0, visibleCount).map((tx) => {
            const incoming = tx.to === user.email;
            const counterpart = incoming ? tx.from : tx.to;
            return <li key={tx.id} className="p-4 sm:p-5">
              <div className="flex gap-3 sm:gap-4 items-start">
                <span aria-hidden="true" className={`shrink-0 w-10 h-10 border-2 border-ink grid place-items-center text-xl text-k ${tx.type === "bonus" ? "bg-y" : incoming ? "bg-lb" : "bg-pu"}`}>{tx.type === "bonus" ? "✦" : incoming ? "↙" : "↗"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                    <h3 className="font-bold break-words">{tx.type === "bonus" ? "Стартовый бонус" : tx.type === "service" ? "Оплата услуги" : incoming ? "Входящий перевод" : "Исходящий перевод"}</h3>
                    <p className="font-mono font-bold whitespace-nowrap">{incoming ? "+" : "−"}{tx.minutes} мин</p>
                  </div>
                  <p className="text-sm mt-1 break-words">{counterpart ? `${incoming ? "От" : "Кому"}: ${participantName(counterpart)}` : "Добро пожаловать в SkillBarter"}</p>
                  {counterpart && <p className="text-xs text-ink/55 break-all mt-1">{counterpart}</p>}
                  <p className="text-sm text-ink/65 mt-2 break-words">{tx.offerId ? <Link href={`/offers/${tx.offerId}`} className="underline underline-offset-4">{tx.note}</Link> : tx.note || "Перевод минут"}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink/60 mt-3"><time dateTime={tx.createdAt}>{dateFormat.format(new Date(tx.createdAt))}</time><span>✓ Выполнено</span></div>
                  <details className="mt-2 text-xs text-ink/55"><summary className="cursor-pointer">Номер операции</summary><p className="font-mono break-all mt-1 select-all">{tx.id}</p></details>
                </div>
              </div>
            </li>;
          })}
        </ul> : <div className="border-2 border-dashed border-ink p-8 text-center"><p className="font-head font-extrabold text-xl">Операций не найдено</p><p className="text-sm text-ink/65 mt-2">Попробуйте другой фильтр или измените запрос.</p></div>}
        {filtered.length > visibleCount && <button type="button" className="btn bg-y mt-4" onClick={() => setVisibleCount((count) => count + 10)}>Показать ещё</button>}
        <Link href="/find" className="inline-block font-semibold text-sm underline underline-offset-4 mt-6">Найти помощь и потратить минуты ↗</Link>
      </section>
    </div>
    <p className="text-xs text-ink/55 border-t-2 border-ink mt-10 pt-4">Демонстрационный кошелёк: баланс и история хранятся только в этом браузере и не синхронизируются между устройствами.</p>
  </div>;
}
