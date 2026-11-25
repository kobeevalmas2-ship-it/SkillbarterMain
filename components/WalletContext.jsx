"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { balanceFor, emptyLedger, historyFor } from "@/lib/wallet.mjs";
import { emptyCatalog } from "@/lib/catalog.mjs";
import { availableBalanceFor, reservedFor } from "@/lib/requests.mjs";
import { apiRequest } from "@/lib/api.mjs";

const WalletContext = createContext(null);
const emptySnapshot = () => ({ ledger: emptyLedger(), participants: [], catalog: emptyCatalog(), reviews: [], busyIntervals: [] });

export function WalletProvider({ children }) {
  const { user, ready: authReady, refresh: refreshAuth } = useAuth();
  const owner = user?.id || user?.email || null;
  const [snapshot, setSnapshot] = useState(() => ({ ...emptySnapshot(), owner: undefined, loaded: false }));
  const [error, setError] = useState("");
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  const sequence = useRef(0);
  const pending = useRef(0);
  const queue = useRef(Promise.resolve());

  const refresh = useCallback(async () => {
    if (!authReady || pending.current) return;
    const current = ++sequence.current;
    try {
      const result = await apiRequest("/api/state");
      if (currentOwner.current !== owner || sequence.current !== current || pending.current) return;
      if (result.actorId !== owner) {
        setSnapshot({ ...emptySnapshot(), owner: undefined, loaded: false });
        setError("Аккаунт изменился. Обновляем данные.");
        await refreshAuth();
        return;
      }
      setSnapshot({ ...emptySnapshot(), ...result, owner, loaded: true });
      setError("");
    } catch (err) {
      if (currentOwner.current !== owner || sequence.current !== current) return;
      setError(err.message);
      setSnapshot((previous) => ({ ...(previous.owner === owner ? previous : emptySnapshot()), owner, loaded: true }));
    }
  }, [authReady, owner, refreshAuth]);

  useEffect(() => {
    sequence.current += 1;
    setError("");
    if (!authReady) return;
    if (pending.current) queue.current.finally(refresh).catch(() => {});
    else refresh();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => { sequence.current += 1; window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [authReady, refresh]);

  const mutate = useCallback((action, values = {}, id) => {
    if (!user) return Promise.reject(new Error("Войдите в аккаунт."));
    pending.current += 1;
    sequence.current += 1;
    const operation = queue.current.catch(() => {}).then(async () => {
      if (currentOwner.current !== owner) throw new Error("Аккаунт изменился. Повторите действие.");
      const result = await apiRequest("/api/state", { method: "POST", body: { action, values, id, expectedActorId: user.id } });
      if (currentOwner.current !== owner) throw new Error("Аккаунт изменился. Обновите страницу.");
      if (result.actorId !== owner) {
        setSnapshot({ ...emptySnapshot(), owner: undefined, loaded: false });
        await refreshAuth();
        throw new Error("Аккаунт изменился. Повторите действие.");
      }
      setSnapshot({ ...emptySnapshot(), ...result, owner, loaded: true });
      setError("");
      return result;
    }).finally(() => { pending.current -= 1; });
    queue.current = operation;
    return operation;
  }, [owner, user, refreshAuth]);

  const transfer = useCallback(async (values) => {
    const result = await mutate("wallet.transfer", values, values.id);
    return result.ledger.transactions.find((transaction) => transaction.id === values.id);
  }, [mutate]);

  const data = snapshot.owner === owner ? snapshot : emptySnapshot();
  const { ledger } = data;
  const ready = authReady && snapshot.owner === owner && snapshot.loaded;
  return <WalletContext.Provider value={{ ...data, ready, error, refresh, transfer, mutate,
    balance: user ? availableBalanceFor(ledger, user.email) : 0,
    totalBalance: user ? balanceFor(ledger, user.email) : 0,
    reserved: user ? reservedFor(ledger, user.email) : 0,
    history: user ? historyFor(ledger, user.email) : [],
    participants: data.participants.filter((account) => account.email !== user?.email),
  }}>{children}</WalletContext.Provider>;
}

export function useWallet() { return useContext(WalletContext); }
