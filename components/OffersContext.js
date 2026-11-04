"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";
import { OFFERS } from "./data";
import { allOffers, CATALOG_KEY, emptyCatalog, readCatalog, saveOffer, setFavorite } from "@/lib/catalog.mjs";
import NewOfferModal from "./NewOfferModal";

const Ctx = createContext(null);
export const useOffers = () => useContext(Ctx);

export function OffersProvider({ children }) {
  const { user } = useAuth();
  const router = useRouter();
  const [catalog, setCatalog] = useState(emptyCatalog);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(null);
  const closeModal = useCallback(() => setEditor(null), []);

  useEffect(() => { setEditor(null); }, [user?.email]);

  const refresh = useCallback(() => {
    try {
      setCatalog(readCatalog(localStorage));
      setError("");
    } catch (err) {
      setError(err.message || "Не удалось открыть сохранённые услуги.");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onStorage = (event) => { if (!event.key || event.key === CATALOG_KEY) refresh(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  async function mutate(update) {
    if (!user) throw new Error("Войдите в аккаунт.");
    function save() {
      const session = JSON.parse(localStorage.getItem("skillbarter-session") || "null");
      if (session?.email !== user.email) throw new Error("Аккаунт изменился. Обновите страницу.");
      const next = update(readCatalog(localStorage));
      localStorage.setItem(CATALOG_KEY, JSON.stringify(next));
      setCatalog(next);
      setError("");
    }
    if (navigator.locks) await navigator.locks.request(CATALOG_KEY, save);
    else throw new Error("Откройте сайт через localhost или HTTPS в современном браузере.");
  }

  async function add(values) {
    const id = crypto.randomUUID();
    await mutate((current) => saveOffer(current, OFFERS, user, values, id));
    return id;
  }

  async function update(id, values) {
    await mutate((current) => saveOffer(current, OFFERS, user, values, id, true));
  }

  function openModal(offer = null) {
    if (!user) { router.push("/login?next=/services"); return; }
    if (offer && offer.email !== user.email) return;
    setEditor({ offer, owner: user.email });
  }

  const all = allOffers(catalog, OFFERS);
  const favoriteIds = catalog.favorites[user?.email] || [];
  return (
    <Ctx.Provider value={{ all, ready, error, refresh, add, update, openModal, closeModal,
      mine: user ? all.filter((offer) => offer.email === user.email) : [],
      favoriteIds, favorites: all.filter((offer) => favoriteIds.includes(offer.id)),
      setFavorite: (id, selected) => mutate((current) => setFavorite(current, user.email, id, selected, OFFERS)),
    }}>
      {children}
      {editor && editor.owner === user?.email && <NewOfferModal key={editor.offer?.id || "new"} offer={editor.offer} />}
    </Ctx.Provider>
  );
}
