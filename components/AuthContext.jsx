"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { ensureAdminAccount, isAdminActor, profileFromAccount, registeredAccount, restoreSessionProfile, startAccountSession, updateAccountProfile } from "@/lib/admin-auth.mjs";

const AuthContext = createContext(null);
const USERS_KEY = "skillbarter-users";
const SESSION_KEY = "skillbarter-session";

function readUsers() {
  const previous = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  const users = ensureAdminAccount(previous);
  if (users !== previous) localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return users;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function restoreSession() {
      try {
        const users = readUsers();
        const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
        setUser(restoreSessionProfile(users, session));
      } catch {
        setUser(null);
      }
      setReady(true);
    }
    restoreSession();
    const onStorage = (event) => {
      if (!event.key || event.key === SESSION_KEY || event.key === USERS_KEY) restoreSession();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function register(values) {
    const users = readUsers();
    const account = registeredAccount(values, crypto.randomUUID());
    if (users.some((item) => item.email.trim().toLowerCase() === account.email)) {
      throw new Error("Этот адрес электронной почты уже зарегистрирован. Войдите в аккаунт.");
    }
    localStorage.setItem(USERS_KEY, JSON.stringify([...users, account]));
    const profile = profileFromAccount(account);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...profile, token: account.sessionToken }));
    setUser(profile);
    return profile;
  }

  function login(values) {
    const result = startAccountSession(readUsers(), values, crypto.randomUUID());
    localStorage.setItem(USERS_KEY, JSON.stringify(result.users));
    localStorage.setItem(SESSION_KEY, JSON.stringify(result.session));
    setUser(result.profile);
    return result.profile;
  }

  function updateProfile(changes) {
    if (!user) throw new Error("Войдите в аккаунт.");
    const users = readUsers();
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    const current = restoreSessionProfile(users, session);
    if (current?.email !== user.email) throw new Error("Аккаунт изменился. Обновите страницу и войдите снова.");
    const account = users.find((item) => item.email.trim().toLowerCase() === user.email);
    const updated = updateAccountProfile(account, changes);
    const profile = profileFromAccount(updated);
    localStorage.setItem(USERS_KEY, JSON.stringify(users.map((item) => item === account ? updated : item)));
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...profile, token: updated.sessionToken }));
    setUser(profile);
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, ready, register, login, logout, updateProfile, isAdmin: isAdminActor(user) }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
