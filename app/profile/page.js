"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";

export default function ProfilePage() {
  const { user, ready, updateProfile } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [about, setAbout] = useState("");
  const [skills, setSkills] = useState("");
  const [avatar, setAvatar] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready) return;
    if (!user) { router.replace("/login?next=/profile"); return; }
    setName(user.name || "");
    setCity(user.city || "");
    setAbout(user.about || "");
    setSkills(Array.isArray(user.skills) ? user.skills.join(", ") : "");
    setAvatar(user.avatar || "");
  }, [ready, user, router]);

  function selectPhoto(event) {
    const file = event.target.files?.[0];
    setError("");
    setMessage("");
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Выберите файл изображения."); return; }
    if (file.size > 1024 * 1024) { setError("Размер фотографии не должен превышать 1 МБ."); return; }
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.onerror = () => setError("Не удалось загрузить фотографию.");
    reader.readAsDataURL(file);
  }

  function save(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (name.trim().length < 2) { setError("Имя должно содержать не менее 2 символов."); return; }
    try {
      updateProfile({
        name: name.trim(), city: city.trim(), about: about.trim(), avatar,
        skills: skills.split(",").map((skill) => skill.trim()).filter(Boolean).slice(0, 12),
      });
      setMessage("Изменения сохранены.");
    } catch (saveError) {
      setError(saveError.message || "Не удалось сохранить профиль.");
    }
  }

  if (!ready || !user) return <section className="max-w-3xl mx-auto px-4 py-16"><p>Загрузка профиля…</p></section>;

  return (
    <section className="max-w-4xl mx-auto px-4 py-10 md:py-16">
      <div className="mb-8">
        <p className="lbl text-ink/60">ВАШ АККАУНТ</p>
        <h1 className="font-head font-extrabold text-4xl mt-2">Мой профиль</h1>
        <p className="text-ink/65 mt-2">Добавьте информацию о себе, чтобы другим участникам было проще с вами познакомиться.</p>
      </div>
      <form onSubmit={save} className="grid md:grid-cols-[220px_1fr] gap-6 items-start">
        <aside className="bg-card border-2 border-ink p-5 sh">
          <div className="w-36 h-36 mx-auto border-2 border-ink bg-pu grid place-items-center overflow-hidden text-4xl font-bold">
            {avatar ? <img src={avatar} alt="Фото профиля" className="w-full h-full object-cover" /> : name.slice(0, 2).toUpperCase()}
          </div>
          <label className="btn bg-y block text-center mt-5 cursor-pointer">Загрузить фото<input type="file" accept="image/*" className="sr-only" onChange={selectPhoto} /></label>
          {avatar && <button type="button" className="w-full mt-3 text-sm underline" onClick={() => setAvatar("")}>Удалить фото</button>}
          <p className="text-xs text-ink/60 mt-3 text-center">Изображение до 1 МБ</p>
        </aside>

        <div className="bg-card border-2 border-ink p-5 md:p-7 sh">
          <div className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-semibold">Имя<input className="fld" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={50} /></label>
            <label className="grid gap-1.5 text-sm font-semibold">Электронная почта<input className="fld opacity-70" value={user.email} readOnly /><span className="text-xs text-ink/60">Адрес почты нельзя изменить.</span></label>
            <label className="grid gap-1.5 text-sm font-semibold">Город<input className="fld" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Например, Алматы" maxLength={80} /></label>
            <label className="grid gap-1.5 text-sm font-semibold">О себе<textarea className="fld min-h-28 resize-y" value={about} onChange={(event) => setAbout(event.target.value)} placeholder="Расскажите, чем занимаетесь и что вам интересно…" maxLength={500} /><span className="text-xs text-ink/60">До 500 символов</span></label>
            <label className="grid gap-1.5 text-sm font-semibold">Навыки<input className="fld" value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="Дизайн, английский, программирование" /></label>
          </div>
          {error && <p role="alert" className="border-2 border-red-700 bg-red-50 text-red-800 p-3 text-sm mt-5">{error}</p>}
          {message && <p role="status" className="border-2 border-green-700 bg-green-50 text-green-900 p-3 text-sm mt-5">{message}</p>}
          <button className="btn bg-y mt-6" type="submit">Сохранить изменения</button>
        </div>
      </form>
    </section>
  );
}
