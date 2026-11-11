export function profileFields(user) {
  return {
    name: user.name || "", city: user.city || "", about: user.about || "",
    skills: Array.isArray(user.skills) ? user.skills : [], avatar: user.avatar || "",
  };
}

export const profileDraftKey = (email) => `skillbarter-profile-draft-v1:${encodeURIComponent(email)}`;

export function readProfileDraft(storage, user) {
  try {
    const draft = JSON.parse(storage.getItem(profileDraftKey(user.email)) || "null");
    if (!draft || draft.owner !== user.email || draft.baseline !== JSON.stringify(profileFields(user))) return null;
    const values = draft.values;
    if (!values || !["name", "city", "about", "avatar", "skillInput"].every((key) => typeof values[key] === "string")) return null;
    if (!Array.isArray(values.skills) || values.skills.length > 12 || values.skills.some((skill) => typeof skill !== "string" || skill.length > 80)) return null;
    if (values.name.length > 50 || values.city.length > 80 || values.about.length > 500 || values.skillInput.length > 80 || values.avatar.length > 1500000) return null;
    return { ...profileFields(values), skillInput: values.skillInput };
  } catch {
    return null;
  }
}

export function writeProfileDraft(storage, user, values) {
  storage.setItem(profileDraftKey(user.email), JSON.stringify({ owner: user.email, baseline: JSON.stringify(profileFields(user)), values }));
}

export function clearProfileDraft(storage, email) {
  storage.removeItem(profileDraftKey(email));
}
