"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api.mjs";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState("");
  const sequence = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const result = await apiRequest("/api/auth");
      if (current !== sequence.current) return;
      setUser((previous) => JSON.stringify(previous) === JSON.stringify(result.user) ? previous : result.user);
      setConfigured(result.configured !== false);
      setError(result.configured === false ? "Supabase ещё не настроен. Укажите параметры подключения на сервере." : "");
    } catch (err) {
      if (current === sequence.current) setError(err.message);
    } finally {
      if (current === sequence.current) setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    return () => { sequence.current += 1; window.removeEventListener("focus", refresh); };
  }, [refresh]);

  async function authenticate(action, values) {
    sequence.current += 1;
    const result = await apiRequest("/api/auth", { method: "POST", body: { action, values } });
    sequence.current += 1;
    setUser(result.user);
    setError("");
    setReady(true);
    return result.user;
  }

  async function updateProfile(changes) {
    const result = await apiRequest("/api/auth", { method: "PATCH", body: changes, headers: { "X-Skillbarter-Actor": user?.id || "" } });
    sequence.current += 1;
    setUser(result.user);
    setError("");
    return result.user;
  }

  async function logout() {
    try {
      await apiRequest("/api/auth", { method: "DELETE", headers: { "X-Skillbarter-Actor": user?.id || "" } });
      sequence.current += 1;
      setUser(null);
      setError("");
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  return <AuthContext.Provider value={{ user, ready, configured, error, refresh,
    register: (values) => authenticate("register", values), login: (values) => authenticate("login", values),
    logout, updateProfile, isAdmin: user?.role === "admin" }}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
