"use client";
import { useState } from "react";
import Art from "./Art";

export default function OfferCard({ o, heart = false }) {
  const [liked, setLiked] = useState(false);
  return (
    <article className="bg-card text-ink border-2 border-ink sh">
      <div className="relative">
        <Art cat={o.cat} />
        {heart && (
          <button
            onClick={() => setLiked(!liked)}
            aria-label="В избранное"
            className={`absolute right-3 top-3 w-9 h-9 text-k border-2 border-ink grid place-items-center ${liked ? "bg-co" : "bg-white"}`}
          >
            {liked ? "♥" : "♡"}
          </button>
        )}
      </div>
      <div className="p-5">
        <div className="flex justify-between lbl"><span>{o.cat}</span><span>◷ {o.min} мин</span></div>
        <h3 className="font-head font-extrabold text-2xl leading-tight mt-3">{o.t}</h3>
        <p className="mt-2 text-sm text-ink/70">{o.d}</p>
        <div className="flex gap-2 mt-4">
          <span className="lbl bg-lb text-k border border-ink px-2 py-1">{o.f}</span>
          <span className="lbl bg-lb text-k border border-ink px-2 py-1">{o.l}</span>
        </div>
        <div className="flex justify-between items-center border-t-2 border-ink mt-5 pt-4 text-sm font-semibold">
          <span className="flex items-center gap-2">
            <span className="w-7 h-7 bg-pu text-k border-2 border-ink grid place-items-center lbl">{o.i}</span>{o.n}
          </span>
          <span>★ Новый</span>
        </div>
      </div>
    </article>
  );
}
