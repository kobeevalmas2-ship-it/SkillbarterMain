"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthContext";

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();

  function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const values = Object.fromEntries(data.entries());
      if (isRegister) register(values);
      else login(values);
      const next = new URLSearchParams(window.location.search).get("next");
      const safeNext = typeof next === "string" && /^\/(?:wallet|services|favorites|offers\/[a-zA-Z0-9-]+)(?:\?|$)/.test(next);
      router.push(safeNext ? next : "/");
    } catch (err) {
      setError(err.message || "Қате орын алды. Қайта көріңіз.");
      setBusy(false);
    }
  }

  return (
    <section className="max-w-6xl mx-auto px-4 py-12 md:py-20">
      <div className="max-w-md mx-auto bg-card border-2 border-ink p-6 md:p-8 sh">
        <Link href="/" className="lbl text-ink/60 hover:text-ink">← Басты бет</Link>
        <h1 className="font-head font-extrabold text-4xl mt-5">{isRegister ? "Тіркелу" : "Қош келдіңіз!"}</h1>
        <p className="mt-2 text-ink/65">{isRegister ? "SkillBarter қауымдастығына қосылыңыз." : "Аккаунтыңызға кіріңіз."}</p>
        <form onSubmit={submit} className="grid gap-4 mt-7">
          {isRegister && <label className="grid gap-1.5 text-sm font-semibold">Атыңыз<input className="fld" name="name" autoComplete="name" placeholder="Мысалы, Айару" required minLength={2} maxLength={50} /></label>}
          <label className="grid gap-1.5 text-sm font-semibold">Электрондық пошта<input className="fld" name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
          <label className="grid gap-1.5 text-sm font-semibold">Құпиясөз<input className="fld" name="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} placeholder="Кемінде 6 таңба" required minLength={6} /></label>
          {error && <p role="alert" className="border-2 border-red-700 bg-red-50 text-red-800 p-3 text-sm">{error}</p>}
          <button className="btn bg-y mt-1" type="submit" disabled={busy}>{busy ? "Күте тұрыңыз…" : isRegister ? "Тіркелу" : "Кіру"}</button>
        </form>
        <p className="mt-6 text-sm text-center">{isRegister ? "Аккаунтыңыз бар ма?" : "Аккаунтыңыз жоқ па?"}{" "}
          <button className="font-bold underline underline-offset-2" type="button" onClick={() => { setIsRegister(!isRegister); setError(""); }}>{isRegister ? "Кіру" : "Тіркелу"}</button>
        </p>
      </div>
    </section>
  );
}
