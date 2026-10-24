import { useEffect, useState } from "react";
import type { Theme } from "../types";

export type ResolvedTheme = "light" | "dark";

export const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";

export function normalizeTheme(value: unknown): Theme {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system";
}

export function resolveTheme(
  theme: Theme,
  systemDark: boolean,
): ResolvedTheme {
  if (theme === "system") {
    return systemDark ? "dark" : "light";
  }
  return theme;
}

export function nextTheme(
  theme: Theme,
  systemDark: boolean,
): ResolvedTheme {
  return resolveTheme(theme, systemDark) === "light" ? "dark" : "light";
}

export function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia(SYSTEM_THEME_QUERY).matches;
}

export function useSystemDark(): boolean {
  const [dark, setDark] = useState(systemPrefersDark);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const query = window.matchMedia(SYSTEM_THEME_QUERY);
    const update = (event: MediaQueryListEvent) => setDark(event.matches);
    setDark(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return dark;
}
