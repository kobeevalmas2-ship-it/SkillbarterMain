"use client";

import { useLanguage } from "@/components/LanguageContext";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { safeAuthNext } from "@/lib/auth-navigation.mjs";

export default function LoginPage() {
  const { t } = useLanguage();
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();
  const form = useRef(null);

  function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const nextErrors = {};
    if (isRegister && (values.name.trim().length < 2 || values.name.trim().length > 50)) nextErrors.name = "Имя должно содержать от 2 до 50 символов.";
    if (!event.currentTarget.elements.namedItem("email").validity.valid) nextErrors.email = "Введите корректный адрес электронной почты.";
    if (values.password.length < 6) nextErrors.password = "Пароль должен содержать не менее 6 символов.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      form.current?.elements.namedItem(Object.keys(nextErrors)[0])?.focus();
      return;
    }
    setBusy(true);
    try {
      if (isRegister) register(values);
      else login(values);
      router.push(safeAuthNext(new URLSearchParams(window.location.search).get("next")));
    } catch (err) {
      const message = err.message || "Что-то пошло не так. Попробуйте ещё раз.";
      if (message === "Этот адрес электронной почты уже зарегистрирован. Войдите в аккаунт.") {
        setErrors({ email: message });
        form.current?.elements.namedItem("email")?.focus();
      } else if (message === "Неверный адрес электронной почты или пароль.") {
        setErrors({ password: message });
        form.current?.elements.namedItem("password")?.focus();
      } else setError(message);
      setBusy(false);
    }
  }

  const fieldError = (name) => errors[name] ? <span id={`login-${name}-error`} role="alert" className="text-sm font-normal text-red-700">{t(errors[name])}</span> : null;
  const accessibility = (name) => ({ "aria-invalid": Boolean(errors[name]), "aria-describedby": errors[name] ? `login-${name}-error${name === "password" && isRegister ? " password-help" : ""}` : name === "password" && isRegister ? "password-help" : undefined });

  return (
    <section className="max-w-6xl mx-auto px-4 py-12 md:py-20">
      <div className="max-w-md mx-auto bg-card border-2 border-ink p-6 md:p-8 sh">
        <Link href="/" className="lbl text-ink/60 hover:text-ink">{t("← На главную")}</Link>
        <h1 className="font-head font-extrabold text-4xl mt-5">{t(isRegister ? "Регистрация" : "Добро пожаловать!")}</h1>
        <p className="mt-2 text-ink/65">{t(isRegister ? "Присоединяйтесь к сообществу SkillBarter." : "Войдите в аккаунт.")}</p>
        <form ref={form} onSubmit={submit} noValidate aria-busy={busy} className="grid gap-4 mt-7" onChange={(event) => {
          setError("");
          const name = event.target.name;
          setErrors((current) => {
            const next = { ...current };
            delete next[name];
            if (["email", "password"].includes(name) && next.password === "Неверный адрес электронной почты или пароль.") delete next.password;
            return next;
          });
        }}>
          {isRegister && <label className="grid gap-1.5 text-sm font-semibold">{t("Имя")}<input className="fld" name="name" autoComplete="name" placeholder={t("Например, Анна")} required minLength={2} maxLength={50} disabled={busy} {...accessibility("name")} />{fieldError("name")}</label>}
          <label className="grid gap-1.5 text-sm font-semibold">{t("Электронная почта")}<input className="fld" name="email" type="email" autoComplete="email" placeholder="you@example.com" required disabled={busy} {...accessibility("email")} />{fieldError("email")}</label>
          <div className="grid gap-1.5 text-sm font-semibold">
            <label htmlFor="login-password">{t("Пароль")}</label>
            <div className="flex border-2 border-ink bg-card">
              <input id="login-password" className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-normal" name="password" type={showPassword ? "text" : "password"} autoComplete={isRegister ? "new-password" : "current-password"} required minLength={6} disabled={busy} {...accessibility("password")} />
              <button type="button" className="px-3 text-xs underline underline-offset-2" aria-pressed={showPassword} aria-controls="login-password" disabled={busy} onClick={() => setShowPassword((value) => !value)}>{t(showPassword ? "Скрыть пароль" : "Показать пароль")}</button>
            </div>
            {isRegister && <p id="password-help" className="text-xs font-normal text-ink/65">{t("Используйте не менее 6 символов. Лучше выбрать уникальный пароль.")}</p>}
            {fieldError("password")}
          </div>
          {error && <p role="alert" className="border-2 border-red-700 bg-red-50 text-red-800 p-3 text-sm">{t(error)}</p>}
          <button className="btn bg-y mt-1 disabled:opacity-50" type="submit" disabled={busy}>{t(busy ? "Подождите…" : isRegister ? "Зарегистрироваться" : "Войти")}</button>
        </form>
        <p className="mt-6 text-sm text-center">{t(isRegister ? "Уже есть аккаунт?" : "Нет аккаунта?")}{" "}
          <button className="font-bold underline underline-offset-2" type="button" disabled={busy} onClick={() => { setIsRegister(!isRegister); setShowPassword(false); setErrors({}); setError(""); }}>{t(isRegister ? "Войти" : "Зарегистрироваться")}</button>
        </p>
      </div>
    </section>
  );
}
