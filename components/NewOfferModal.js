"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOffers } from "./OffersContext";
import { CATS } from "./data";
import { useLanguage } from "./LanguageContext";

export default function NewOfferModal({ offer }) {
  const { t } = useLanguage();
  const { add, update, closeModal } = useOffers();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const form = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    form.current?.querySelector("input")?.focus();
    const onKey = (e) => {
      if (e.key === "Escape" && !pending.current) closeModal();
      if (e.key !== "Tab") return;
      const fields = [...form.current.querySelectorAll("button, input, textarea, select")].filter((field) => !field.disabled);
      const first = fields[0], last = fields[fields.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [closeModal]);

  async function submit(e) {
    e.preventDefault();
    if (pending.current) return;
    const f = Object.fromEntries(new FormData(e.currentTarget));
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      if (offer) await update(offer.id, f);
      else {
        const id = await add(f);
        router.push(`/offers/${id}`);
      }
      closeModal();
    } catch (err) {
      setError(err.message || "Не удалось сохранить услугу.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 overflow-y-auto p-4" role="dialog" aria-modal="true" aria-labelledby="offer-editor-title"
         onClick={(e) => e.target === e.currentTarget && !pending.current && closeModal()}>
      <form ref={form} onSubmit={submit} aria-busy={busy} className="relative bg-card text-ink border-2 border-ink max-w-xl mx-auto my-6 p-5 sm:p-6" style={{ boxShadow: "6px 6px 0 #3346e0" }}>
        <div className="flex justify-between items-start gap-4">
          <h2 id="offer-editor-title" className="font-head font-extrabold text-3xl tracking-tight">{t(offer ? "Редактировать услугу" : "Новое предложение")}</h2>
          <button type="button" onClick={closeModal} disabled={busy} aria-label={t("Закрыть")} className="shrink-0 w-9 h-9 bg-co text-k border-2 border-ink font-bold">×</button>
        </div>
        <p className="mt-3 text-ink/70">{t("Поделитесь навыком, который поможет другому человеку.")}</p>

        <label className="lbl block mt-5 mb-1" htmlFor="t">{t("Название")}</label>
        <input id="t" name="t" className="fld" placeholder={t("Например, основы Figma")} defaultValue={offer?.t || ""} required minLength={3} maxLength={120} disabled={busy} />

        <label className="lbl block mt-4 mb-1" htmlFor="d">{t("Описание")}</label>
        <textarea id="d" name="d" rows={4} className="fld" placeholder={t("Расскажите, чему научите и как пройдёт встреча")} defaultValue={offer?.d || ""} required minLength={10} maxLength={3000} disabled={busy} />

        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div><label className="lbl block mb-1" htmlFor="cat">{t("Категория")}</label>
            <select id="cat" name="cat" className="fld" defaultValue={offer?.cat || ""} required disabled={busy}><option value="">{t("Выберите")}</option>{CATS.map((c) => <option key={c[0]} value={c[0]}>{t(c[0])}</option>)}</select></div>
          <div><label className="lbl block mb-1" htmlFor="l">{t("Уровень")}</label>
            <select id="l" name="l" className="fld" defaultValue={offer?.l || "Начинающий"} disabled={busy}>{["Начинающий", "Средний", "Продвинутый"].map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></div>
          <div><label className="lbl block mb-1" htmlFor="f">{t("Формат")}</label>
            <select id="f" name="f" className="fld" defaultValue={offer?.f || "Онлайн"} disabled={busy}>{["Онлайн", "Офлайн"].map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></div>
          <div><label className="lbl block mb-1" htmlFor="city">{t("Город для офлайн встреч")}</label>
            <input id="city" name="city" className="fld" placeholder={t("Алматы")} defaultValue={offer?.city || ""} maxLength={80} disabled={busy} /></div>
          <div><label className="lbl block mb-1" htmlFor="m1">{t("От, минут")}</label>
            <input id="m1" name="m1" type="number" min="15" max="480" step="1" required defaultValue={offer?.m1 || 30} className="fld" disabled={busy} /></div>
          <div><label className="lbl block mb-1" htmlFor="m2">{t("До, минут")}</label>
            <input id="m2" name="m2" type="number" min="15" max="480" step="1" required defaultValue={offer?.m2 || 120} className="fld" disabled={busy} /></div>
        </div>

        <label className="lbl block mt-4 mb-1" htmlFor="lg">{t("Язык общения")}</label>
        <input id="lg" name="lg" className="fld" defaultValue={offer?.lg || "Русский"} required maxLength={80} disabled={busy} />
        {error && <p role="alert" className="bg-co text-k border-2 border-ink p-3 mt-4 text-sm">{t(error)}</p>}
        <button disabled={busy} className="btn bg-b !text-white w-full mt-5 disabled:opacity-50">{t(busy ? "Сохраняем…" : offer ? "Сохранить изменения" : "Опубликовать предложение")}</button>
        <button type="button" disabled={busy} onClick={closeModal} className="w-full mt-4 underline text-sm underline-offset-4">{t("Отмена")}</button>
      </form>
    </div>
  );
}
