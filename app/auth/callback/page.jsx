"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { useLanguage } from "@/components/LanguageContext";
import { EMAIL_CONFIRMATION_ERROR, parseEmailConfirmationHash } from "@/lib/auth-confirmation.mjs";
import { safeAuthNext } from "@/lib/auth-navigation.mjs";

export default function AuthCallbackPage() {
  const { t } = useLanguage();
  const { confirmEmail } = useAuth();
  const router = useRouter();
  const operation = useRef(null);
  const [error, setError] = useState(false);
  const [next, setNext] = useState("/day");

  useEffect(() => {
    if (!operation.current) {
      const hash = window.location.hash;
      const destination = safeAuthNext(new URLSearchParams(window.location.search).get("next") || "/day");
      // Clear the credentials before parsing, fetching or displaying any result.
      window.history.replaceState(window.history.state, "", window.location.pathname);
      setNext(destination);
      operation.current = (async () => {
        const tokens = parseEmailConfirmationHash(hash);
        const user = await confirmEmail(tokens);
        if (!user) throw new Error(EMAIL_CONFIRMATION_ERROR);
        return destination;
      })();
    }
    let active = true;
    operation.current.then((destination) => {
      if (active) router.replace(safeAuthNext(destination));
    }, () => {
      if (active) setError(true);
    });
    // Strict Mode attaches another listener to the same operation; it never posts twice.
    return () => { active = false; };
  }, [confirmEmail, router]);

  return <section className="max-w-2xl mx-auto px-4 py-14 md:py-20">
    <div className="border-2 border-ink bg-card p-6 sm:p-8 sh">
      <span className="lbl text-acc">{t("Подтверждение почты")}</span>
      <h1 className="font-head font-extrabold text-3xl sm:text-4xl mt-4">{t(error ? "Не удалось открыть ссылку" : "Завершаем подтверждение")}</h1>
      {error ? <>
        <p role="alert" className="text-sm text-ink/75 mt-5">{t(EMAIL_CONFIRMATION_ERROR)}</p>
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn bg-y inline-block mt-7">{t("Перейти ко входу")}</Link>
      </> : <p role="status" className="text-sm text-ink/70 mt-5">{t("Проверяем ссылку и открываем ваш аккаунт…")}</p>}
    </div>
  </section>;
}
