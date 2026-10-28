"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOffers } from "./OffersContext";
import { CATS } from "./data";

export default function NewOfferModal() {
  const { add, closeModal } = useOffers();
  const router = useRouter();

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && closeModal();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeModal]);

  function submit(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    add({
      cat: f.cat || "Другое", t: f.t, d: f.d || "Описание пока не добавлено.",
      f: f.f, l: f.l, min: `${f.m1}–${f.m2}`, n: "Айару Кайрат", i: "АК", city: f.city, v: +f.m2,
    });
    closeModal();
    router.push("/services");
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 overflow-y-auto p-4" role="dialog" aria-modal="true"
         onClick={(e) => e.target === e.currentTarget && closeModal()}>
      <form onSubmit={submit} className="relative bg-card text-ink border-2 border-ink max-w-xl mx-auto my-6 p-6" style={{ boxShadow: "10px 10px 0 #3346e0" }}>
        <div className="flex justify-between items-start gap-4">
          <h2 className="font-head font-extrabold text-3xl tracking-tight">Новое предложение</h2>
          <button type="button" onClick={closeModal} aria-label="Закрыть" className="w-9 h-9 bg-co text-k border-2 border-ink font-bold">×</button>
        </div>
        <p className="mt-3 text-ink/70">Поделитесь навыком, который поможет другому человеку.</p>

        <label className="lbl block mt-5 mb-1" htmlFor="t">Название</label>
        <input id="t" name="t" className="fld" placeholder="Например, основы Figma" required autoFocus />

        <label className="lbl block mt-4 mb-1" htmlFor="d">Описание</label>
        <textarea id="d" name="d" rows={4} className="fld" placeholder="Расскажите, чему научите и как пройдёт встреча" />

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div><label className="lbl block mb-1" htmlFor="cat">Категория</label>
            <select id="cat" name="cat" className="fld"><option value="">Выберите</option>{CATS.map((c) => <option key={c[0]}>{c[0]}</option>)}</select></div>
          <div><label className="lbl block mb-1" htmlFor="l">Уровень</label>
            <select id="l" name="l" className="fld"><option>Начинающий</option><option>Средний</option><option>Продвинутый</option></select></div>
          <div><label className="lbl block mb-1" htmlFor="f">Формат</label>
            <select id="f" name="f" className="fld"><option>Онлайн</option><option>Офлайн</option></select></div>
          <div><label className="lbl block mb-1" htmlFor="city">Город для офлайн встреч</label>
            <input id="city" name="city" className="fld" placeholder="Алматы" /></div>
          <div><label className="lbl block mb-1" htmlFor="m1">От, минут</label>
            <select id="m1" name="m1" className="fld"><option>30</option><option>60</option></select></div>
          <div><label className="lbl block mb-1" htmlFor="m2">До, минут</label>
            <select id="m2" name="m2" className="fld" defaultValue="120"><option>60</option><option>120</option><option>180</option></select></div>
        </div>

        <label className="lbl block mt-4 mb-1" htmlFor="lg">Язык общения</label>
        <input id="lg" name="lg" className="fld" defaultValue="Русский" />
        <button className="btn bg-b text-white w-full mt-5">Опубликовать предложение</button>
      </form>
    </div>
  );
}
