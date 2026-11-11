import { describe, expect, it } from "vitest";
import {
  INTL_LOCALES,
  LANGUAGE_LABELS,
  LANGUAGES,
  detectLanguage,
  documentLanguage,
  intlLocale,
  isLanguage,
  normalizeLanguage,
  untitledName,
} from "../src/lib/language";

describe("language metadata", () => {
  it("lists the three interface languages in display order", () => {
    expect(LANGUAGES).toEqual(["zh-Hans", "zh-Hant", "en"]);
    expect(LANGUAGE_LABELS["zh-Hans"]).toBe("简体中文");
    expect(LANGUAGE_LABELS["zh-Hant"]).toBe("繁體中文");
    expect(LANGUAGE_LABELS.en).toBe("English");
  });

  it("maps languages to Intl locales", () => {
    expect(intlLocale("zh-Hans")).toBe("zh-CN");
    expect(intlLocale("zh-Hant")).toBe("zh-TW");
    expect(intlLocale("en")).toBe("en");
    expect(INTL_LOCALES["zh-Hant"]).toBe("zh-TW");
  });

  it("names new documents per language", () => {
    expect(untitledName("zh-Hans")).toBe("未命名.md");
    expect(untitledName("zh-Hant")).toBe("未命名.md");
    expect(untitledName("en")).toBe("Untitled.md");
  });

  it("recognizes supported languages", () => {
    expect(isLanguage("zh-Hans")).toBe(true);
    expect(isLanguage("zh-Hant")).toBe(true);
    expect(isLanguage("en")).toBe(true);
    expect(isLanguage("zh-CN")).toBe(false);
    expect(isLanguage(null)).toBe(false);
  });

  it("emits a valid HTML lang value", () => {
    expect(documentLanguage("zh-Hans")).toBe("zh-Hans");
    expect(documentLanguage("zh-Hant")).toBe("zh-Hant");
    expect(documentLanguage("en")).toBe("en");
    expect(documentLanguage("zh-CN" as never)).toBe("zh-Hans");
  });
});

describe("normalizeLanguage", () => {
  it("keeps legacy settings working", () => {
    expect(normalizeLanguage("zh-CN")).toBe("zh-Hans");
    expect(normalizeLanguage("zh-TW")).toBe("zh-Hant");
  });
});

describe("detectLanguage", () => {
  it("maps the first supported system locale", () => {
    expect(detectLanguage(["en-US"])).toBe("en");
    expect(detectLanguage(["zh-CN"])).toBe("zh-Hans");
    expect(detectLanguage(["zh-TW"])).toBe("zh-Hant");
    expect(detectLanguage(["zh-HK"])).toBe("zh-Hant");
    expect(detectLanguage(["fr-FR", "en-GB"])).toBe("en");
    expect(detectLanguage("en-GB")).toBe("en");
  });

  it("falls back to Simplified Chinese for unsupported or empty input", () => {
    expect(detectLanguage(["fr-FR"])).toBe("zh-Hans");
    expect(detectLanguage([])).toBe("zh-Hans");
    expect(detectLanguage(null)).toBe("zh-Hans");
    expect(detectLanguage(undefined)).toBe("zh-Hans");
  });
});
