"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import { useLanguage } from "@/components/LanguageContext";
import { clearProfileDraft, profileFields, readProfileDraft, writeProfileDraft } from "@/lib/profile-draft.mjs";
import LoadingState from "@/components/LoadingState";

export default function ProfilePage() {
  const { t } = useLanguage();
  const { user, ready, updateProfile } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [about, setAbout] = useState("");
  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState("");
  const [avatar, setAvatar] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [saved, setSaved] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const [draftError, setDraftError] = useState(false);
  const fileReader = useRef(null);
  const current = { name, city, about, skills, avatar };
  const dirty = saved !== null && (JSON.stringify(current) !== saved || Boolean(skillInput.trim()));

  function change(setter, value) {
    setter(value);
    setMessage("");
    setError("");
  }

  useEffect(() => {
    if (!ready) return;
    if (!user) { router.replace("/login?next=/profile"); return; }
    const baseline = profileFields(user);
    let draft = null;
    try { draft = readProfileDraft(sessionStorage, user); } catch { setDraftError(true); }
    const values = draft || baseline;
    setName(values.name);
    setCity(values.city);
    setAbout(values.about);
    setSkills(values.skills);
    setSkillInput(draft?.skillInput || "");
    setAvatar(values.avatar);
    setSaved(JSON.stringify(baseline));
    setRestored(Boolean(draft));
  }, [ready, user, router]);

  useEffect(() => {
    if (!user || saved === null || saved !== JSON.stringify(profileFields(user))) return;
    try {
      if (dirty) writeProfileDraft(sessionStorage, user, { name, city, about, skills, avatar, skillInput });
      else clearProfileDraft(sessionStorage, user.email);
      setDraftError(false);
    } catch {
      setDraftError(true);
    }
  }, [user, saved, dirty, name, city, about, skills, avatar, skillInput]);

  useEffect(() => () => fileReader.current?.abort(), []);

  function discardChanges() {
    fileReader.current?.abort();
    setPhotoBusy(false);
    const values = profileFields(user);
    setName(values.name); setCity(values.city); setAbout(values.about);
    setSkills(values.skills); setAvatar(values.avatar); setSkillInput("");
    setSaved(JSON.stringify(values));
    setRestored(false); setMessage(""); setError(""); setFieldErrors({});
    try { clearProfileDraft(sessionStorage, user.email); setDraftError(false); } catch { setDraftError(true); }
  }

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event) => { event.preventDefault(); event.returnValue = ""; };
    const onLink = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest?.("a[href]");
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (destination.href === window.location.href || (destination.pathname === window.location.pathname && destination.search === window.location.search && destination.hash)) return;
      if (!window.confirm(t("В профиле есть несохранённые изменения. Уйти без сохранения?"))) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onLink, true);
    };
  }, [dirty, t]);

  function nextSkills() {
    const value = skillInput.trim();
    if (!value) return skills;
    if (skills.some((skill) => skill.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      setFieldErrors((previous) => ({ ...previous, skills: "Такой навык уже добавлен." }));
      return null;
    }
    if (skills.length >= 12) {
      setFieldErrors((previous) => ({ ...previous, skills: "Можно добавить не больше 12 навыков. Удалите один, чтобы добавить новый." }));
      return null;
    }
    return [...skills, value];
  }

  function addSkill() {
    const next = nextSkills();
    if (!next) return;
    change(setSkills, next);
    setSkillInput("");
    setFieldErrors((previous) => ({ ...previous, skills: "" }));
  }

  function selectPhoto(event) {
    const file = event.target.files?.[0];
    setError("");
    setMessage("");
    setFieldErrors((previous) => ({ ...previous, photo: "" }));
    if (!file) return;
    if (!file.type.startsWith("image/")) { setFieldErrors((previous) => ({ ...previous, photo: "Выберите файл изображения." })); return; }
    if (file.size > 1024 * 1024) { setFieldErrors((previous) => ({ ...previous, photo: "Размер фотографии не должен превышать 1 МБ." })); return; }
    fileReader.current?.abort();
    const reader = new FileReader();
    fileReader.current = reader;
    setPhotoBusy(true);
    reader.onload = () => { change(setAvatar, String(reader.result)); setPhotoBusy(false); };
    reader.onerror = () => { setFieldErrors((previous) => ({ ...previous, photo: "Не удалось загрузить фотографию." })); setPhotoBusy(false); };
    reader.readAsDataURL(file);
  }

  function save(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (photoBusy) return;
    if (name.trim().length < 2 || name.trim().length > 50) { setFieldErrors((previous) => ({ ...previous, name: "Имя должно содержать от 2 до 50 символов." })); event.currentTarget.elements.namedItem("name")?.focus(); return; }
    const next = nextSkills();
    if (!next) { event.currentTarget.elements.namedItem("skill")?.focus(); return; }
    try {
      const changes = {
        name: name.trim(), city: city.trim(), about: about.trim(), skills: next, avatar,
      };
      updateProfile(changes);
      try { clearProfileDraft(sessionStorage, user.email); } catch { /* The saved baseline prevents restoring a stale draft. */ }
      setSaved(JSON.stringify(changes));
      setSkillInput("");
      setFieldErrors({});
      setMessage("Изменения сохранены.");
      setRestored(false);
    } catch (saveError) {
      setError(saveError.message || "Не удалось сохранить профиль.");
    }
  }

  if (!ready || !user) return <section className="max-w-3xl mx-auto px-4 py-16"><LoadingState label="Загрузка профиля…" /></section>;

  return (
    <section className="max-w-4xl mx-auto px-4 py-10 md:py-16">
      <div className="mb-8">
        <p className="lbl text-ink/60">{t("Ваш аккаунт")}</p>
        <h1 className="font-head font-extrabold text-4xl mt-2">{t("Мой профиль")}</h1>
        <p className="text-ink/65 mt-2">{t("Добавьте информацию о себе, чтобы другим участникам было проще с вами познакомиться.")}</p>
      </div>
      <form onSubmit={save} noValidate className="grid md:grid-cols-[220px_1fr] gap-6 items-start">
        <aside className="bg-card border-2 border-ink p-5 sh">
          <div className="w-36 h-36 mx-auto border-2 border-ink bg-pu grid place-items-center overflow-hidden text-4xl font-bold">
            {avatar ? <img src={avatar} alt={t("Фото профиля")} className="w-full h-full object-cover" /> : name.slice(0, 2).toUpperCase()}
          </div>
          <label className="btn bg-y block text-center mt-5 cursor-pointer">{t("Загрузить фото")}<input type="file" accept="image/*" className="sr-only" onChange={selectPhoto} aria-invalid={Boolean(fieldErrors.photo)} aria-describedby={fieldErrors.photo ? "profile-photo-error" : undefined} /></label>
          {avatar && <button type="button" className="w-full mt-3 text-sm underline disabled:opacity-50" disabled={photoBusy} onClick={() => change(setAvatar, "")}>{t("Удалить фото")}</button>}
          <p className="text-xs text-ink/60 mt-3 text-center">{t("Изображение до 1 МБ")}</p>
          {fieldErrors.photo && <p id="profile-photo-error" role="alert" className="text-sm text-red-700 mt-3">{t(fieldErrors.photo)}</p>}
        </aside>

        <div className="bg-card border-2 border-ink p-5 md:p-7 sh">
          {restored && <p role="status" className="border-2 border-ink bg-lb text-k p-3 text-sm mb-5">{t("Восстановлены несохранённые изменения профиля в этой вкладке.")}</p>}
          <div className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-semibold">{t("Имя")}<input name="name" className="fld" value={name} onChange={(event) => { change(setName, event.target.value); setFieldErrors((previous) => ({ ...previous, name: "" })); }} required minLength={2} maxLength={50} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "profile-name-error" : undefined} />{fieldErrors.name && <span id="profile-name-error" role="alert" className="text-sm font-normal text-red-700">{t(fieldErrors.name)}</span>}</label>
            <label className="grid gap-1.5 text-sm font-semibold">{t("Электронная почта")}<input className="fld opacity-70" value={user.email} readOnly /><span className="text-xs text-ink/60">{t("Адрес почты нельзя изменить.")}</span></label>
            <label className="grid gap-1.5 text-sm font-semibold">{t("Город")}<input className="fld" value={city} onChange={(event) => change(setCity, event.target.value)} placeholder={t("Например, Алматы")} maxLength={80} /></label>
            <label className="grid gap-1.5 text-sm font-semibold">{t("О себе")}<textarea className="fld min-h-28 resize-y" value={about} onChange={(event) => change(setAbout, event.target.value)} placeholder={t("Расскажите, чем занимаетесь и что вам интересно…")} maxLength={500} aria-describedby="profile-about-count" /><span id="profile-about-count" className="text-xs text-ink/60">{t("{count} / {max} символов", { count: about.length, max: 500 })}</span></label>
            <div className="grid gap-2 text-sm font-semibold">
              <label htmlFor="profile-skill">{t("Навыки")}</label>
              {skills.length > 0 && <ul className="flex flex-wrap gap-2" aria-label={t("Добавленные навыки")}>
                {skills.map((skill, index) => <li key={`${skill}:${index}`} className="inline-flex items-center gap-2 border-2 border-ink bg-lb text-k px-2 py-1 break-words max-w-full"><span className="min-w-0 break-words">{skill}</span><button type="button" className="shrink-0 px-1 font-bold" aria-label={t("Удалить навык: {skill}", { skill })} onClick={() => { change(setSkills, skills.filter((_, i) => i !== index)); setFieldErrors((previous) => ({ ...previous, skills: "" })); }}>×</button></li>)}
              </ul>}
              <div className="flex gap-2">
                <input id="profile-skill" name="skill" className="fld min-w-0" value={skillInput} onChange={(event) => { change(setSkillInput, event.target.value); setFieldErrors((previous) => ({ ...previous, skills: "" })); }} placeholder={t("Например, веб-дизайн")} maxLength={80} aria-invalid={Boolean(fieldErrors.skills)} aria-describedby={`profile-skills-help${fieldErrors.skills ? " profile-skills-error" : ""}`} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addSkill(); } }} />
                <button type="button" className="btn bg-y shrink-0 disabled:opacity-50" disabled={!skillInput.trim()} onClick={addSkill}>{t("Добавить")}</button>
              </div>
              <p id="profile-skills-help" className="text-xs font-normal text-ink/60">{t("{count} / {max} навыков. Введите навык и нажмите Enter или «Добавить».", { count: skills.length, max: 12 })}</p>
              {fieldErrors.skills && <p id="profile-skills-error" role="alert" className="text-sm font-normal text-red-700">{t(fieldErrors.skills)}</p>}
            </div>
          </div>
          {error && <p role="alert" className="border-2 border-red-700 bg-red-50 text-red-800 p-3 text-sm mt-5">{t(error)}</p>}
          {message && <p role="status" className="border-2 border-green-700 bg-green-50 text-green-900 p-3 text-sm mt-5">{t(message)}</p>}
          {dirty && <p role="status" className="text-sm text-ink/70 mt-5">{t("Есть несохранённые изменения.")}</p>}
          {draftError && <p role="alert" className="text-sm text-red-700 mt-3">{t("Не удалось сохранить черновик профиля в этой вкладке. Сохраните изменения перед выходом.")}</p>}
          <button className="btn bg-y mt-6 disabled:opacity-50" type="submit" disabled={photoBusy}>{t(photoBusy ? "Подождите…" : "Сохранить изменения")}</button>
          {dirty && <button type="button" className="mt-6 ml-4 text-sm font-semibold underline underline-offset-2" onClick={discardChanges}>{t("Отменить изменения")}</button>}
        </div>
      </form>
    </section>
  );
}
