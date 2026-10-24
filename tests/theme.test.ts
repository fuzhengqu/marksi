import { describe, expect, it } from "vitest";
import {
  nextTheme,
  normalizeTheme,
  resolveTheme,
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
  });

  it("normalizes persisted and malformed values", () => {
    expect(normalizeTheme("system")).toBe("system");
    expect(normalizeTheme("dark")).toBe("dark");
    expect(normalizeTheme("light")).toBe("light");
    expect(normalizeTheme("sepia")).toBe("system");
    expect(normalizeTheme(null)).toBe("system");
  });
});
