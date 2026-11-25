"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";
import { useWallet } from "./WalletContext";
import { allOffers } from "@/lib/catalog.mjs";
import NewOfferModal from "./NewOfferModal";
import { consumeOfferCreationIntent } from "@/lib/auth-navigation.mjs";

const Ctx = createContext(null);
export const useOffers = () => useContext(Ctx);

export function OffersProvider({ children }) {
  const { user } = useAuth();
  const { catalog, ready, error, refresh, mutate } = useWallet();
  const router = useRouter();
  const pathname = usePathname();
  const [editor, setEditor] = useState(null);
  const closeModal = useCallback(() => setEditor(null), []);

  useEffect(() => { setEditor(null); }, [user?.email]);
  useEffect(() => {
    if (!user || pathname !== "/services") return;
    const returnTo = consumeOfferCreationIntent(window.location.href, true);
    if (returnTo === null) return;
    window.history.replaceState(window.history.state, "", returnTo);
    setEditor({ offer: null, owner: user.email });
  }, [pathname, user?.email]);

  async function add(values) {
    const id = crypto.randomUUID();
    await mutate("offer.add", values, id);
    return id;
  }

  async function update(id, values) { await mutate("offer.update", values, id); }

  function openModal(offer = null) {
    if (!user) { router.push(`/login?next=${encodeURIComponent("/services?create=1")}`); return; }
    if (offer && offer.email !== user.email) return;
    setEditor({ offer, owner: user.email });
  }

  const all = allOffers(catalog, []);
  const favoriteIds = catalog.favorites[user?.email] || [];
  return <Ctx.Provider value={{ all, ready, error, refresh, add, update, openModal, closeModal,
    mine: user ? all.filter((offer) => offer.email === user.email) : [],
    favoriteIds, favorites: all.filter((offer) => favoriteIds.includes(offer.id)),
    setFavorite: (id, selected) => mutate("favorite.set", { selected }, id),
  }}>
    {children}
    {editor && editor.owner === user?.email && <NewOfferModal key={editor.offer?.id || "new"} offer={editor.offer} />}
  </Ctx.Provider>;
}
