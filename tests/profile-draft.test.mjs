import test from "node:test";
import assert from "node:assert/strict";
import { clearProfileDraft, profileDraftKey, profileFields, readProfileDraft, writeProfileDraft } from "../lib/profile-draft.mjs";

const user = { email: "one@example.com", name: "Anna", about: "Saved biography", skills: ["Figma"] };
const memory = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
};

test("profile draft restores unsaved fields and unfinished skill input for the same saved baseline", () => {
  const storage = memory();
  const values = { ...profileFields(user), about: "Unsaved biography", skillInput: "React" };
  writeProfileDraft(storage, user, values);
  assert.deepEqual(readProfileDraft(storage, user), values);
  assert.deepEqual(readProfileDraft(storage, { ...user }), values);
});

test("profile drafts are isolated by email and ignored when the saved profile changes", () => {
  const storage = memory();
  writeProfileDraft(storage, user, { ...profileFields(user), name: "Draft", skillInput: "" });
  assert.equal(readProfileDraft(storage, { ...user, email: "two@example.com" }), null);
  assert.equal(readProfileDraft(storage, { ...user, about: "Saved elsewhere" }), null);
  assert.equal(readProfileDraft(storage, { ...user, skills: ["React"] }), null);
  clearProfileDraft(storage, user.email);
  assert.equal(readProfileDraft(storage, user), null);
});

test("corrupted and malformed profile drafts are ignored safely", () => {
  const storage = memory();
  storage.setItem(profileDraftKey(user.email), "{");
  assert.equal(readProfileDraft(storage, user), null);
  writeProfileDraft(storage, user, { ...profileFields(user), skills: "invalid", skillInput: "" });
  assert.equal(readProfileDraft(storage, user), null);
});
