"use client";

import { useLanguage } from "@/components/LanguageContext";

import { useEffect, useState } from "react";
import LoadingState from "./LoadingState";

const STORAGE_KEY = "skillbarter-reviews";

function readReviews() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  if (!Array.isArray(saved)) throw new Error("Invalid reviews");
  return saved.filter((review) => review && typeof review.id === "string" && typeof review.name === "string" && typeof review.text === "string" && Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5 && typeof review.date === "string" && Number.isFinite(Date.parse(review.date)));
}

export default function Reviews() {
  const { t, locale } = useLanguage();
  const [reviews, setReviews] = useState([]);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try { setReviews(readReviews()); }
    catch { setError("Не удалось загрузить сохранённые отзывы."); }
    setReady(true);
  }, []);

  function submitReview(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const text = String(data.get("text") || "").trim();
    const rating = Number(data.get("rating"));
    if (!name || name.length > 60 || text.length < 10 || text.length > 1000 || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      setError("Укажите имя, оценку и отзыв от 10 до 1000 символов.");
      return;
    }
    try {
      const next = [{ id: crypto.randomUUID(), name, text, rating, date: new Date().toISOString() }, ...readReviews()];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setReviews(next);
      form.reset();
      setMessage("Спасибо! Ваш отзыв сохранён в этом браузере.");
    } catch {
      setError("Не удалось сохранить отзыв. Проверьте доступ к хранилищу браузера и попробуйте снова.");
    }
  }

  const average = reviews.length ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : null;

  return (
    <section id="reviews" aria-labelledby="reviews-title" className="border-t-2 border-ink scroll-mt-44">
      <div className="max-w-6xl mx-auto px-4 py-14">
        <span className="lbl bg-y text-k border-2 border-ink px-2 py-1 inline-block">{t("Обратная связь")}</span>
        <div className="flex flex-wrap items-end justify-between gap-4 mt-5">
          <div>
            <h2 id="reviews-title" className="font-head font-extrabold text-4xl md:text-5xl tracking-tight">{t("Отзывы о SkillBarter")}</h2>
            <p className="mt-3 text-ink/70">{t("Расскажите, как прошёл ваш обмен навыками.")}</p>
          </div>
          {average && <p className="bg-y text-k border-2 border-ink px-4 py-3 shs"><span aria-hidden="true">★ </span><b>{average} / 5</b><span className="block text-sm">{t("Всего отзывов:")} {reviews.length}</span></p>}
        </div>
        <div className="grid lg:grid-cols-2 gap-8 mt-8 items-start">
          <div className="space-y-5" aria-busy={!ready}>
            {!ready ? <LoadingState label="Загружаем отзывы…" /> : reviews.length ? reviews.map((review) => (
              <article key={review.id} className="bg-card border-2 border-ink p-5 shs">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="w-11 h-11 shrink-0 bg-pu text-k border-2 border-ink grid place-items-center font-bold">{review.name.slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0"><h3 className="font-head font-extrabold break-words">{review.name}</h3><time className="text-sm text-ink/60" dateTime={review.date}>{new Date(review.date).toLocaleDateString(locale)}</time></div>
                </div>
                <p className="mt-4 text-acc tracking-widest" aria-label={t("Оценка: {rating} из 5", { rating: review.rating })}><span aria-hidden="true">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span></p>
                <p className="mt-3 whitespace-pre-wrap break-words">{review.text}</p>
              </article>
            )) : <div className="bg-card border-2 border-ink p-6 shs"><h3 className="font-head font-extrabold text-2xl">{t("Первый отзыв — за вами")}</h3><p className="mt-3 text-ink/70">{t("Поделитесь впечатлениями: что получилось и что можно улучшить?")}</p></div>}
          </div>
          <form onSubmit={submitReview} className="bg-card border-2 border-ink p-5 sm:p-7 sh">
            <h3 className="font-head font-extrabold text-2xl">{t("Оставить отзыв")}</h3>
            <p id="review-storage-note" className="mt-2 text-sm text-ink/60">{t("Отзывы хранятся только в этом браузере и не видны другим посетителям.")}</p>
            <label htmlFor="review-name" className="block mt-6 mb-2 font-semibold">{t("Ваше имя")}</label>
            <input id="review-name" name="name" autoComplete="name" required maxLength={60} className="fld" placeholder={t("Как к вам обращаться?")} />
            <label htmlFor="review-rating" className="block mt-5 mb-2 font-semibold">{t("Оценка")}</label>
            <select id="review-rating" name="rating" required defaultValue="5" className="fld">
              <option value="5">{t("5 — Отлично")}</option><option value="4">{t("4 — Хорошо")}</option><option value="3">{t("3 — Нормально")}</option><option value="2">{t("2 — Могло быть лучше")}</option><option value="1">{t("1 — Плохо")}</option>
            </select>
            <label htmlFor="review-text" className="block mt-5 mb-2 font-semibold">{t("Ваш отзыв")}</label>
            <textarea id="review-text" name="text" required minLength={10} maxLength={1000} rows={5} className="fld resize-y" placeholder={t("Что вам запомнилось в обмене навыками?")} aria-describedby="review-text-hint review-storage-note" />
            <p id="review-text-hint" className="mt-1 text-sm text-ink/60">{t("От 10 до 1000 символов.")}</p>
            <button type="submit" disabled={!ready} className="btn bg-b !text-white mt-5 disabled:opacity-50">{t("Добавить отзыв ↗")}</button>
            <p role="status" className="mt-3 text-sm">{t(message)}</p>
            {error && <p role="alert" className="mt-3 text-sm font-semibold">{t(error)}</p>}
          </form>
        </div>
      </div>
    </section>
  );
}
