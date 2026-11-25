"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOffers } from "./OffersContext";
import { useAuth } from "./AuthContext";
import { CATS } from "./data";
import { useLanguage } from "./LanguageContext";
import Art from "./Art";
import { clearOfferDraft, offerEditorChanged, offerEditorValues, readOfferDraft, validateOfferEditor, writeOfferDraft } from "@/lib/offer-draft.mjs";

export default function NewOfferModal({ offer }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { add, update, closeModal } = useOffers();
  const initial = useRef(offerEditorValues(offer));
  const [values, setValues] = useState(initial.current);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [busy, setBusy] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState("");
  const [draftWarning, setDraftWarning] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [preview, setPreview] = useState(false);
  const pending = useRef(false);
  const dirty = useRef(false);
  const form = useRef(null);
  const confirmation = useRef(null);
  const closeTrigger = useRef(null);
  const requestCloseRef = useRef(null);
  const previewHeading = useRef(null);
  const previousPreview = useRef(false);
  const router = useRouter();
  const disabled = busy || !draftReady || confirmClose || Boolean(savedId);
  const previewDuration = Number(values.m1) === Number(values.m2) ? String(Number(values.m1)) : `${Number(values.m1)}–${Number(values.m2)}`;

  useEffect(() => {
    try {
      const draft = readOfferDraft(localStorage, user.email, offer?.id);
      if (draft && offerEditorChanged(initial.current, draft)) {
        setValues(draft);
        dirty.current = true;
        setDraftStatus("Черновик восстановлен. Можно продолжить заполнение.");
      }
    } catch (err) {
      setDraftWarning(err.message === "Не удалось восстановить черновик. Проверьте заполнение формы."
        ? err.message : "Не удалось открыть черновик. Автосохранение может быть недоступно.");
    }
    setDraftReady(true);
  }, [user.email, offer?.id]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (pending.current) return;
        if (confirmation.current) {
          setConfirmClose(false);
        } else requestCloseRef.current?.();
      }
      if (e.key !== "Tab") return;
      const root = confirmation.current || form.current;
      const fields = [...root.querySelectorAll("button, input, textarea, select")].filter((field) => !field.disabled && !field.closest("fieldset:disabled"));
      const first = fields[0], last = fields[fields.length - 1];
      if (!first) { e.preventDefault(); return; }
      if (!root.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    const onUnload = (event) => {
      if (!dirty.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    if (draftReady) form.current?.querySelector("input")?.focus();
  }, [draftReady]);

  useEffect(() => {
    if (confirmClose) confirmation.current?.querySelector("button")?.focus();
    else if (closeTrigger.current?.isConnected) closeTrigger.current.focus();
  }, [confirmClose]);

  useEffect(() => {
    if (preview) previewHeading.current?.focus();
    else if (previousPreview.current) form.current?.querySelector("input")?.focus();
    previousPreview.current = preview;
  }, [preview]);

  function requestClose() {
    if (pending.current || confirmClose) return;
    if (!dirty.current) { closeModal(); return; }
    closeTrigger.current = document.activeElement;
    setConfirmClose(true);
  }
  requestCloseRef.current = requestClose;

  function change(event) {
    const next = { ...values, [event.target.name]: event.target.value };
    setValues(next);
    setError("");
    setErrors(validateOfferEditor(next));
    dirty.current = offerEditorChanged(initial.current, next);
    try {
      if (dirty.current) writeOfferDraft(localStorage, user.email, offer?.id, next);
      else clearOfferDraft(localStorage, user.email, offer?.id);
      setDraftWarning("");
      setDraftStatus(dirty.current ? "Черновик сохранён в этом браузере." : "");
    } catch {
      setDraftStatus("");
      setDraftWarning("Не удалось сохранить черновик. Не закрывайте форму, чтобы не потерять изменения.");
    }
  }

  function blur(event) {
    setTouched((current) => ({ ...current, [event.target.name]: true }));
    setErrors(validateOfferEditor(values));
  }

  function fieldProps(name, description) {
    const invalid = Boolean(touched[name] && errors[name]);
    return {
      id: `offer-${name}`, name, value: values[name], onChange: change, onBlur: blur, disabled: disabled || preview,
      "aria-invalid": invalid || undefined,
      "aria-describedby": [description, invalid && `offer-${name}-error`].filter(Boolean).join(" ") || undefined,
    };
  }

  function fieldError(name) {
    return touched[name] && errors[name]
      ? <p id={`offer-${name}-error`} className="mt-1 text-sm text-red-700" role="alert">{t(errors[name])}</p> : null;
  }

  function finish(id) {
    closeModal();
    if (!offer) router.push(`/offers/${id}`);
  }

  async function submit(e) {
    e.preventDefault();
    if (pending.current || savedId || confirmClose) return;
    const validation = validateOfferEditor(values);
    setErrors(validation);
    setTouched(Object.fromEntries(Object.keys(values).map((name) => [name, true])));
    if (Object.keys(validation).length) {
      form.current.elements.namedItem(Object.keys(validation)[0])?.focus();
      return;
    }
    if (!preview) { setPreview(true); setError(""); return; }
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const fields = { ...values, city: values.f === "Офлайн" ? values.city : "" };
      let id = offer?.id;
      if (offer) await update(id, fields);
      else id = await add(fields);
      dirty.current = false;
      try { clearOfferDraft(localStorage, user.email, offer?.id); }
      catch {
        setSavedId(id);
        setError("Услуга сохранена, но не удалось удалить черновик из браузера.");
        return;
      }
      finish(id);
    } catch (err) {
      setError(err.message || "Не удалось сохранить услугу.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 overflow-y-auto p-4" role="dialog" aria-modal="true" aria-labelledby="offer-editor-title"
         onClick={(e) => e.target === e.currentTarget && requestClose()}>
      <form ref={form} noValidate onSubmit={submit} aria-busy={busy} className="relative bg-card text-ink border-2 border-ink max-w-xl mx-auto my-6 p-5 sm:p-6" style={{ boxShadow: "6px 6px 0 #3346e0" }}>
        <div className="flex justify-between items-start gap-4">
          <h2 ref={previewHeading} tabIndex={-1} id="offer-editor-title" className="font-head font-extrabold text-3xl tracking-tight">{t(preview ? "Предпросмотр предложения" : offer ? "Редактировать услугу" : "Новое предложение")}</h2>
          <button type="button" onClick={requestClose} disabled={busy || confirmClose} aria-label={t("Закрыть")} className="shrink-0 w-11 h-11 bg-co text-k border-2 border-ink font-bold">×</button>
        </div>
        <p className="mt-3 text-ink/70">{t(preview ? offer ? "Так будет выглядеть обновлённое предложение. Изменения вступят в силу после сохранения." : "Так участники увидят ваше предложение. Оно появится в каталоге только после публикации." : "Поделитесь навыком, помогите вырасти другому человеку.")}</p>
        {!preview && <p className="mt-2 text-sm text-ink/65">{t("Черновик сохраняется автоматически только в этом браузере.")}</p>}
        <div role="status" aria-live="polite" className="mt-2 text-sm text-ink/70">
          {draftWarning ? t(draftWarning) : draftStatus ? t(draftStatus) : null}
        </div>

        {confirmClose && <div ref={confirmation} role="alertdialog" aria-modal="true" aria-labelledby="close-editor-title" aria-describedby="close-editor-description" className="border-2 border-ink bg-y text-k p-4 mt-5">
          <h3 id="close-editor-title" className="font-bold">{t("Закрыть форму?")}</h3>
          <p id="close-editor-description" className="text-sm mt-2">{t(draftWarning
            ? "Черновик не сохранён. При закрытии последние изменения могут потеряться."
            : "Изменения ещё не опубликованы. Черновик останется в этом браузере.")}</p>
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button type="button" onClick={() => setConfirmClose(false)} className="btn bg-card">{t("Продолжить редактирование")}</button>
            <button type="button" onClick={closeModal} className="border-2 border-ink px-3 py-2 text-sm font-bold">{t(draftWarning ? "Закрыть без сохранения" : "Закрыть, сохранив черновик")}</button>
          </div>
        </div>}

        {preview && <article aria-label={t("Предпросмотр предложения")} className="mt-6 border-2 border-ink bg-card overflow-hidden">
          <Art cat={values.cat} className="h-36" />
          <div className="p-5 min-w-0">
            <p className="lbl text-ink/60">{t(offer ? "Изменения ещё не сохранены" : "Предложение ещё не опубликовано")}</p>
            <p className="lbl mt-4">{t(values.cat)}</p>
            <h3 className="font-head font-extrabold text-3xl mt-2 break-words">{values.t.trim()}</h3>
            <p className="text-sm text-ink/75 leading-relaxed whitespace-pre-wrap break-words mt-4">{values.d.trim()}</p>
            <dl className="grid sm:grid-cols-2 gap-4 mt-6 border-t-2 border-ink pt-4 text-sm">
              {[
                ["Формат", t(values.f)],
                ["Уровень подготовки", t(values.l)],
                ["Длительность", `${previewDuration} ${t("мин")}`],
                ["Стоимость", t("{minutes} мин со счёта", { minutes: previewDuration })],
                ["Язык общения", t(values.lg)],
                ...(values.f === "Офлайн" ? [["Город", values.city.trim()]] : []),
              ].map(([label, value]) => <div key={label}><dt className="lbl text-ink/60">{t(label)}</dt><dd className="font-semibold mt-1 break-words">{value}</dd></div>)}
            </dl>
            <p className="border-2 border-ink bg-y text-k p-3 mt-5 text-sm font-semibold">{t("1 минута помощи = 1 минута баланса")}</p>
            <div className="flex gap-3 items-center mt-5 border-t-2 border-ink pt-4">
              <span className="shrink-0 w-10 h-10 border-2 border-ink bg-pu text-k grid place-items-center overflow-hidden text-sm font-bold">
                {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : user.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="font-semibold break-words min-w-0">{offer?.n || user.name}</span>
            </div>
          </div>
        </article>}

        <fieldset disabled={disabled || preview} hidden={preview}>
          <label className="lbl block mt-5 mb-1" htmlFor="offer-t">{t("Название")}</label>
          <input {...fieldProps("t")} className="fld" placeholder={t("Например, основы Figma")} required minLength={3} maxLength={120} />
          {fieldError("t")}

          <label className="lbl block mt-4 mb-1" htmlFor="offer-d">{t("Описание")}</label>
          <textarea {...fieldProps("d", "offer-description-help")} rows={4} className="fld" placeholder={t("Расскажите, чему учите и как пройдёт обмен")} required minLength={10} maxLength={3000} />
          <p id="offer-description-help" className="mt-1 text-xs text-ink/65">{t("От 10 до 3000 символов. Введено: {count}.", { count: values.d.length })}</p>
          {fieldError("d")}

          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div><label className="lbl block mb-1" htmlFor="offer-cat">{t("Категория")}</label>
              <select {...fieldProps("cat")} className="fld" required><option value="">{t("Выберите")}</option>{CATS.map((c) => <option key={c[0]} value={c[0]}>{t(c[0])}</option>)}</select>{fieldError("cat")}</div>
            <div><label className="lbl block mb-1" htmlFor="offer-l">{t("Уровень")}</label>
              <select {...fieldProps("l")} className="fld">{["Начинающий", "Средний", "Продвинутый"].map((value) => <option key={value} value={value}>{t(value)}</option>)}</select>{fieldError("l")}</div>
            <div><label className="lbl block mb-1" htmlFor="offer-f">{t("Формат")}</label>
              <select {...fieldProps("f")} className="fld">{["Онлайн", "Офлайн"].map((value) => <option key={value} value={value}>{t(value)}</option>)}</select>{fieldError("f")}</div>
            {values.f === "Офлайн" && <div><label className="lbl block mb-1" htmlFor="offer-city">{t("Город для офлайн встреч")}</label>
              <input {...fieldProps("city")} className="fld" placeholder={t("Алматы")} maxLength={80} required />{fieldError("city")}</div>}
          </div>

          <p id="offer-duration-help" className="mt-5 text-sm text-ink/70">{t("1 минута помощи = 1 минута на балансе. Укажите длительность от 15 до 480 минут.")}</p>
          <div className="grid sm:grid-cols-2 gap-4 mt-3">
            <div><label className="lbl block mb-1" htmlFor="offer-m1">{t("От, минут")}</label>
              <input {...fieldProps("m1", "offer-duration-help")} type="number" inputMode="numeric" min="15" max="480" step="1" required className="fld" />{fieldError("m1")}</div>
            <div><label className="lbl block mb-1" htmlFor="offer-m2">{t("До, минут")}</label>
              <input {...fieldProps("m2", "offer-duration-help")} type="number" inputMode="numeric" min="15" max="480" step="1" required className="fld" />{fieldError("m2")}</div>
          </div>

          <label className="lbl block mt-4 mb-1" htmlFor="offer-lg">{t("Язык общения")}</label>
          <input {...fieldProps("lg")} className="fld" required maxLength={80} />{fieldError("lg")}
        </fieldset>
        {error && <p role={savedId ? "status" : "alert"} className="bg-co text-k border-2 border-ink p-3 mt-4 text-sm">{t(error)}</p>}
        {savedId ? <button type="button" className="btn bg-y w-full mt-5" onClick={() => finish(savedId)}>{t("Готово")}</button> : <>
          <button type="submit" disabled={disabled} className="btn bg-b !text-white w-full mt-5 disabled:opacity-50">{t(busy ? "Сохраняем…" : preview ? offer ? "Подтвердить и сохранить" : "Подтвердить и опубликовать" : "Предпросмотр")}</button>
          {preview && <button type="button" disabled={busy || confirmClose} onClick={() => setPreview(false)} className="btn bg-card !text-ink w-full mt-3 disabled:opacity-50">{t("Вернуться к редактированию")}</button>}
          <button type="button" disabled={busy || confirmClose} onClick={requestClose} className="w-full mt-4 underline text-sm underline-offset-4">{t("Отмена")}</button>
        </>}
      </form>
    </div>
  );
}
