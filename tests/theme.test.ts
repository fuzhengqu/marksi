import { describe, expect, it } from "vitest";
import {
  isDarkAppearance,
  nextTheme,
  normalizeTheme,
  resolveTheme,
  themeColor,
} from "../src/lib/theme";

describe("theme modes", () => {
  it("resolves system mode from the current preference", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("toggles from the resolved appearance", () => {
    expect(nextTheme("system", true)).toBe("light");
    expect(nextTheme("system", false)).toBe("dark");
    expect(nextTheme("light", true)).toBe("dark");
    expect(nextTheme("dark", false)).toBe("light");
    expect(nextTheme("sepia", false)).toBe("dark");
    expect(nextTheme("contrast", true)).toBe("light");
  });

  it("classifies dark appearances and theme colors", () => {
    expect(isDarkAppearance("dark")).toBe(true);
    expect(isDarkAppearance("contrast")).toBe(true);
    expect(isDarkAppearance("sepia")).toBe(false);
    expect(themeColor("light")).toBe("#fbfbfa");
    expect(themeColor("dark")).toBe("#1d2024");
    expect(themeColor("sepia")).toBe("#f4ecd8");
    expect(themeColor("contrast")).toBe("#000000");
  });

  it("normalizes persisted and malformed values", () => {
    expect(normalizeTheme("system")).toBe("system");
    expect(normalizeTheme("dark")).toBe("dark");
    expect(normalizeTheme("light")).toBe("light");
    expect(normalizeTheme("sepia")).toBe("sepia");
    expect(normalizeTheme("contrast")).toBe("contrast");
    expect(normalizeTheme("solarized")).toBe("system");
    expect(normalizeTheme(null)).toBe("system");
  });
});
