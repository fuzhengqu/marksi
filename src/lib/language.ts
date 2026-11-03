import type { Language } from "../types";

/**
 * Interface languages in display order. `zh-Hans` and `zh-Hant` are script
 * subtags so the same Chinese text can be rendered in either script.
 */
export const LANGUAGES: Language[] = ["zh-Hans", "zh-Hant", "en"];

export const LANGUAGE_LABELS: Record<Language, string> = {
  "zh-Hans": "简体中文",
  "zh-Hant": "繁體中文",
  en: "English",
};

/** Locale identifiers for `Intl` formatters. */
export const INTL_LOCALES: Record<Language, string> = {
  "zh-Hans": "zh-CN",
  "zh-Hant": "zh-TW",
  en: "en",
};

export function isLanguage(value: unknown): value is Language {
  return value === "zh-Hans" || value === "zh-Hant" || value === "en";
}

/**
 * Maps persisted and legacy language tags to a supported language. Older
 * MarkSI releases stored `zh-CN`; exported settings may contain either the
 * legacy tags or full BCP-47 tags such as `zh-Hant-TW`.
 */
export function normalizeLanguage(value: unknown): Language | null {
  if (typeof value !== "string") {
    return null;
  }
  const tag = value.trim().replace(/_/g, "-").toLowerCase();
  if (tag === "en" || tag.startsWith("en-")) {
    return "en";
  }
  if (tag === "zh" || tag.startsWith("zh-")) {
    const traditional =
      /(^|-)hant(-|$)/.test(tag) || /^zh-(tw|hk|mo)(-|$)/.test(tag);
    return traditional ? "zh-Hant" : "zh-Hans";
  }
  return null;
}

export function intlLocale(language: Language): string {
  return INTL_LOCALES[language] ?? INTL_LOCALES["zh-Hans"];
}

export function untitledName(language: Language): string {
  return language === "en" ? "Untitled.md" : "未命名.md";
}

/** Value for the exported HTML `lang` attribute. */
export function documentLanguage(language: Language): string {
  return isLanguage(language) ? language : "zh-Hans";
}
