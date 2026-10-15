import { useState, useEffect } from "react";

const THEME_KEY = "chakki_theme";

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored !== null) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  return { isDark, toggleTheme };
}
