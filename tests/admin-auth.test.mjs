import test from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_EMAIL, ADMIN_PASSWORD, adminAccount, ensureAdminAccount, isAdminActor,
  profileFromAccount, registeredAccount, restoreSessionProfile, startAccountSession, updateAccountProfile,
} from "../lib/admin-auth.mjs";

const oldUser = { name: "Алия", email: "aliya@example.com", password: "Lesson123!", city: "Алматы", skills: ["JavaScript"] };

test("the built-in support administrator is added once without overwriting existing user data", () => {
  const original = [{ ...oldUser }];
  const before = JSON.stringify(original);
  const seeded = ensureAdminAccount(original);
  assert.equal(JSON.stringify(original), before);
  assert.deepEqual(seeded[0], oldUser);
  assert.deepEqual(seeded[1], adminAccount);
  assert.equal(ensureAdminAccount(seeded), seeded);
  const customized = [{ ...adminAccount, name: "Служба поддержки", password: "ChangedPassword!" }, oldUser];
  assert.equal(ensureAdminAccount(customized), customized);
  assert.equal(customized[0].password, "ChangedPassword!");
});

test("the reserved legacy account becomes the administrator while retaining its existing credentials and profile", () => {
  const existing = [{ ...oldUser, email: ` ${ADMIN_EMAIL.toUpperCase()} `, role: "user", about: "Существующий профиль" }];
  const before = JSON.stringify(existing);
  const migrated = ensureAdminAccount(existing);
  assert.equal(JSON.stringify(existing), before);
  assert.equal(migrated[0].email, ADMIN_EMAIL);
  assert.equal(migrated[0].role, "admin");
  assert.equal(migrated[0].password, oldUser.password);
  assert.equal(migrated[0].name, oldUser.name);
  assert.equal(migrated[0].about, existing[0].about);
  assert.deepEqual(migrated[0].skills, oldUser.skills);
  assert.equal(isAdminActor(profileFromAccount(migrated[0])), true);
  assert.equal(ensureAdminAccount(migrated), migrated);
  assert.throws(() => startAccountSession(migrated, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }, "admin-token"));
  assert.equal(startAccountSession(migrated, { email: ADMIN_EMAIL, password: oldUser.password }, "old-token").profile.role, "admin");
  assert.equal(restoreSessionProfile(migrated, { email: ADMIN_EMAIL, role: "user" }), null);
});

test("seeding always makes the canonical support administrator available", () => {
  for (const users of [[], [{ ...oldUser }], [{ ...oldUser, email: ADMIN_EMAIL }], [{ ...adminAccount }], [{ ...adminAccount, email: ADMIN_EMAIL.toUpperCase() }]]) {
    assert.ok(ensureAdminAccount(users).some(isAdminActor));
  }
});

test("public registration assigns only the user role and protects the reserved administrator address", () => {
  const created = registeredAccount({ ...oldUser, email: "  NEW@EXAMPLE.COM ", role: "admin", sessionToken: "injected" }, "real-token");
  assert.equal(created.email, "new@example.com");
  assert.equal(created.role, "user");
  assert.equal(created.sessionToken, "real-token");
  assert.throws(() => registeredAccount({ ...oldUser, email: ` ${ADMIN_EMAIL.toUpperCase()} ` }, "token"), /зарезервирован/);
  assert.equal(isAdminActor(created), false);
  assert.equal(isAdminActor({ ...created, role: "admin" }), false);
  assert.equal(isAdminActor({ email: ADMIN_EMAIL, role: "user" }), false);
  assert.equal(isAdminActor(adminAccount), true);
});

test("authentication returns a verified role and requires an administrator session token on restore", () => {
  const users = ensureAdminAccount([{ ...oldUser }]);
  const result = startAccountSession(users, { email: ADMIN_EMAIL.toUpperCase(), password: ADMIN_PASSWORD }, "verified-token");
  assert.equal(result.profile.role, "admin");
  assert.equal(result.profile.password, undefined);
  assert.equal(result.profile.sessionToken, undefined);
  assert.deepEqual(restoreSessionProfile(result.users, result.session), result.profile);
  assert.equal(restoreSessionProfile(result.users, { email: ADMIN_EMAIL, role: "admin" }), null);
  assert.equal(restoreSessionProfile(result.users, { ...result.session, token: "forged" }), null);
  assert.equal(restoreSessionProfile(result.users, { ...result.session, email: oldUser.email, role: "admin" }), null);
  assert.equal(restoreSessionProfile(users, { ...oldUser, role: "admin" }).role, "user", "legacy regular sessions keep working without accepting their role claim");
  assert.throws(() => startAccountSession(users, { email: ADMIN_EMAIL, password: "wrong-password" }, "token"));
});

test("profile editing cannot replace account identity, password, session token or role", () => {
  const account = registeredAccount(oldUser, "user-token");
  const updated = updateAccountProfile(account, {
    name: "  Алия К.  ", city: "Астана", about: "Помогаю изучать JavaScript.", skills: ["JavaScript", "React"], avatar: "data:image/png;base64,abc",
    email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: "admin", sessionToken: "forged", unknown: "ignored",
  });
  assert.equal(updated.name, "Алия К.");
  assert.equal(updated.email, oldUser.email);
  assert.equal(updated.password, oldUser.password);
  assert.equal(updated.role, "user");
  assert.equal(updated.sessionToken, "user-token");
  assert.equal(updated.unknown, undefined);
  assert.deepEqual(updated.skills, ["JavaScript", "React"]);
  assert.equal(updateAccountProfile(adminAccount, { role: "user", email: "other@example.com", name: "Поддержка" }).role, "admin");
  assert.throws(() => updateAccountProfile(account, { skills: "not-an-array" }));
});

test("malformed account storage is reported without replacing it with a seeded empty list", () => {
  for (const users of [null, {}, [{ email: "broken@example.com" }], [null]]) assert.throws(() => ensureAdminAccount(users));
});
