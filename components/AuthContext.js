"use client";

import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);
const USERS_KEY = "skillbarter-users";
const SESSION_KEY = "skillbarter-session";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function restoreSession() {
      try {
        const session = localStorage.getItem(SESSION_KEY);
        setUser(session ? JSON.parse(session) : null);
      } catch {
        setUser(null);
      }
      setReady(true);
    }
    restoreSession();
    const onStorage = (event) => {
      if (!event.key || event.key === SESSION_KEY) restoreSession();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function register({ name, email, password }) {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    const normalizedEmail = email.trim().toLowerCase();
    if (users.some((item) => item.email === normalizedEmail)) {
      throw new Error("Бұл электрондық пошта тіркелген. Кіруді пайдаланыңыз.");
    }
    const account = { name: name.trim(), email: normalizedEmail, password };
    localStorage.setItem(USERS_KEY, JSON.stringify([...users, account]));
    const profile = { name: account.name, email: account.email };
    localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
    setUser(profile);
  }

  function login({ email, password }) {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    const account = users.find((item) => item.email === email.trim().toLowerCase() && item.password === password);
    if (!account) throw new Error("Электрондық пошта немесе құпиясөз қате.");
    const profile = { name: account.name, email: account.email };
    localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
    setUser(profile);
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, ready, register, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
