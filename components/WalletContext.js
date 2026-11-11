"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { WALLET_KEY, DEMO_PARTICIPANTS, balanceFor, createTransfer, emptyLedger, ensureAccount, historyFor, normalizeEmail, readLedger } from "@/lib/wallet.mjs";
import { allOffers, readCatalog, serviceQuote } from "@/lib/catalog.mjs";
import { OFFERS } from "./data";
import { availableBalanceFor, readActivity, reservedFor } from "@/lib/requests.mjs";

const WalletContext = createContext(null);

// Web Locks serialize read/check/write across tabs of this local demo.
function withWalletLock(action) {
  if (navigator.locks) return navigator.locks.request(WALLET_KEY, action);
  return Promise.reject(new Error("Для операций с кошельком откройте сайт в современном браузере через localhost или HTTPS."));
}

function readParticipants(ledger) {
  const registered = JSON.parse(localStorage.getItem("skillbarter-users") || "[]");
  return [...new Map([...DEMO_PARTICIPANTS, ...ledger.accounts, ...registered].map((account) => [
    normalizeEmail(account.email), { name: account.name, email: normalizeEmail(account.email) },
  ])).values()];
}

export function WalletProvider({ children }) {
  const { user, ready: authReady } = useAuth();
  const [snapshot, setSnapshot] = useState({ ledger: emptyLedger(), participants: [], owner: null });
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!user) {
      setSnapshot({ ledger: emptyLedger(), participants: [], owner: null });
      setError("");
      return;
    }
    try {
      await withWalletLock(() => {
        const previous = readLedger(localStorage);
        readActivity(previous);
        const ledger = ensureAccount(previous, user);
        const participants = readParticipants(ledger);
        if (ledger !== previous) localStorage.setItem(WALLET_KEY, JSON.stringify(ledger));
        setSnapshot({ ledger, participants, owner: user.email });
        setError("");
      });
    } catch (err) {
      setError(err.message || "Не удалось открыть кошелёк. Разрешите сохранение данных в браузере.");
    }
  }, [user]);

  useEffect(() => {
    if (!authReady) return;
    refresh();
    const onStorage = (event) => {
      if (!event.key || [WALLET_KEY, "skillbarter-users"].includes(event.key)) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
    };
  }, [authReady, refresh]);

  const mutateLedger = useCallback(async (update) => {
    if (!user) throw new Error("Войдите в аккаунт для перевода.");
    return withWalletLock(() => {
      const session = JSON.parse(localStorage.getItem("skillbarter-session") || "null");
      if (session?.email !== user.email) throw new Error("Аккаунт изменился. Обновите страницу и войдите снова.");
      const previous = readLedger(localStorage);
      readActivity(previous);
      const next = update(ensureAccount(previous, user));
      readActivity(next);
      if (next !== previous) {
        const participants = readParticipants(next);
        // Requests, messages, reservations and both balances commit in one write.
        localStorage.setItem(WALLET_KEY, JSON.stringify(next));
        setSnapshot({ ledger: next, participants, owner: user.email });
      }
      setError("");
      return next;
    });
  }, [user]);

  async function transfer(values) {
    const next = await mutateLedger((current) => {
      if (values.offerId) {
        const offer = allOffers(readCatalog(localStorage), OFFERS).find((item) => item.id === values.offerId);
        const quote = serviceQuote(offer, values.minutes);
        if (quote.to !== values.to || quote.note !== values.note || values.type !== "service") throw new Error("Условия услуги изменились. Обновите страницу и проверьте оплату.");
      }
      let ledger = current;
      const participants = readParticipants(ledger);
      const recipient = participants.find((account) => account.email === normalizeEmail(values.to));
      if (!recipient) throw new Error("Участник с такой почтой не найден. Выберите получателя из списка.");
      ledger = ensureAccount(ledger, recipient);
      if (!ledger.transactions.some((tx) => tx.id === values.id) && values.minutes > availableBalanceFor(ledger, user.email)) {
        throw new Error("Часть минут зарезервирована для занятий. Уменьшите сумму перевода.");
      }
      ledger = createTransfer(ledger, { ...values, from: user.email });
      return ledger;
    });
    return next.transactions.find((tx) => tx.id === values.id);
  }

  const ready = authReady && (!user || snapshot.owner === user.email) && !error;
  const ledger = snapshot.owner === user?.email ? snapshot.ledger : emptyLedger();
  return <WalletContext.Provider value={{ ready, error, refresh, transfer, mutateLedger, ledger,
    balance: user ? availableBalanceFor(ledger, user.email) : 0,
    totalBalance: user ? balanceFor(ledger, user.email) : 0,
    reserved: user ? reservedFor(ledger, user.email) : 0,
    history: user ? historyFor(ledger, user.email) : [],
    participants: snapshot.participants.filter((account) => account.email !== user?.email),
  }}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  return useContext(WalletContext);
}
