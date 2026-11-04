"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";
import { useOffers } from "./OffersContext";

export default function FavoriteButton({ offer, compact = false }) {
  const { user, ready: authReady } = useAuth();
  const { favoriteIds, setFavorite, ready } = useOffers();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const selected = favoriteIds.includes(offer.id);

  async function toggle() {
    if (!user) { router.push(`/login?next=${encodeURIComponent(`/offers/${offer.id}`)}`); return; }
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try { await setFavorite(offer.id, !selected); }
    catch (err) { setError(err.message || "Не удалось сохранить избранное."); }
    finally { pending.current = false; setBusy(false); }
  }

  return <div className="relative z-10">
    <button type="button" aria-label={selected ? "Убрать из избранного" : "Добавить в избранное"} aria-pressed={selected}
      disabled={!ready || !authReady || busy} onClick={toggle}
      className={`border-2 border-ink text-k font-bold disabled:opacity-50 ${selected ? "bg-co" : "bg-y"} ${compact ? "w-10 h-10 grid place-items-center text-xl" : "px-4 py-2.5"}`}>
      {selected ? "♥" : "♡"}{!compact && <span className="ml-2">{selected ? "В избранном" : "В избранное"}</span>}
    </button>
    {error && <p role="alert" className={`${compact ? "absolute top-12 right-0 w-56" : "mt-2"} bg-card border-2 border-ink p-2 text-xs text-ink`}>{error}</p>}
  </div>;
}
