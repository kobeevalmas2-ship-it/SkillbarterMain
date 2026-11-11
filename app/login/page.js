"use client";

import { useLanguage } from "@/components/LanguageContext";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthContext";

export default function LoginPage() {
  const { t } = useLanguage();
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
      setError(err.message || "Что-то пошло не так. Попробуйте ещё раз.");
      setBusy(false);
    }
  }

  return (
    <section className="max-w-6xl mx-auto px-4 py-12 md:py-20">
      <div className="max-w-md mx-auto bg-card border-2 border-ink p-6 md:p-8 sh">
        <Link href="/" className="lbl text-ink/60 hover:text-ink">{t("← На главную")}</Link>
        <h1 className="font-head font-extrabold text-4xl mt-5">{t(isRegister ? "Регистрация" : "Добро пожаловать!")}</h1>
        <p className="mt-2 text-ink/65">{t(isRegister ? "Присоединяйтесь к сообществу SkillBarter." : "Войдите в аккаунт.")}</p>
        <form onSubmit={submit} className="grid gap-4 mt-7">
          {isRegister && <label className="grid gap-1.5 text-sm font-semibold">{t("Имя")}<input className="fld" name="name" autoComplete="name" placeholder={t("Например, Анна")} required minLength={2} maxLength={50} /></label>}
          <label className="grid gap-1.5 text-sm font-semibold">{t("Электронная почта")}<input className="fld" name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
          <label className="grid gap-1.5 text-sm font-semibold">{t("Пароль")}<input className="fld" name="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} placeholder={t("Не менее 6 символов")} required minLength={6} /></label>
          {error && <p role="alert" className="border-2 border-red-700 bg-red-50 text-red-800 p-3 text-sm">{t(error)}</p>}
          <button className="btn bg-y mt-1" type="submit" disabled={busy}>{t(busy ? "Подождите…" : isRegister ? "Зарегистрироваться" : "Войти")}</button>
        </form>
        <p className="mt-6 text-sm text-center">{t(isRegister ? "Уже есть аккаунт?" : "Нет аккаунта?")}{" "}
          <button className="font-bold underline underline-offset-2" type="button" onClick={() => { setIsRegister(!isRegister); setError(""); }}>{t(isRegister ? "Войти" : "Зарегистрироваться")}</button>
        </p>
      </div>
    </section>
  );
}
