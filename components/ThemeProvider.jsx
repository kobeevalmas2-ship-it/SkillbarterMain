"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);
const THEME_KEY = "skillbarter-theme";
const THEMES = ["light", "dark", "system"];
const normalizeTheme = (value) => THEMES.includes(value) ? value : "system";

export function ThemeProvider({ children, initialTheme = "system" }) {
  const [theme, setCurrentTheme] = useState(() => normalizeTheme(initialTheme));

  const setTheme = useCallback((value) => {
    const selected = normalizeTheme(value);
    setCurrentTheme(selected);
    document.documentElement.dataset.theme = selected;
    try { localStorage.setItem(THEME_KEY, selected); } catch {}
    try { document.cookie = `${THEME_KEY}=${selected}; Path=/; Max-Age=31536000; SameSite=Lax`; } catch {}
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (THEMES.includes(saved)) setTheme(saved);
    } catch {}
    const onStorage = (event) => {
      if (event.key === THEME_KEY || event.key === null) setTheme(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [setTheme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
