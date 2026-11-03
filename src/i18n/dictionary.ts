import { normalizeLanguage } from "../lib/language";
import type { Language } from "../types";
import { zhHans, zhHansSearchPhrases } from "./locales/zh-Hans";
import { zhHant, zhHantSearchPhrases } from "./locales/zh-Hant";

export type Replacements = Record<string, string | number>;

const DICTIONARIES: Record<Language, Record<string, string>> = {
  en: {},
  "zh-Hans": zhHans,
  "zh-Hant": zhHant,
};

const SEARCH_PHRASES: Record<Language, Record<string, string>> = {
  en: {},
  "zh-Hans": zhHansSearchPhrases,
  "zh-Hant": zhHantSearchPhrases,
};

/**
 * Lookup chains, most specific first. English is the source language, so an
 * untranslated key falls through to the key itself. Traditional Chinese falls
 * back to Simplified Chinese before English.
 */
const FALLBACKS: Record<Language, Language[]> = {
  en: ["en"],
  "zh-Hans": ["zh-Hans"],
  "zh-Hant": ["zh-Hant", "zh-Hans"],
};

function resolveLanguage(language: Language): Language {
  return normalizeLanguage(language) ?? "zh-Hans";
}

export function translate(
  language: Language,
  text: string,
  replacements?: Replacements,
): string {
  const chain = FALLBACKS[resolveLanguage(language)];
  let template = text;
  for (const candidate of chain) {
    const value = DICTIONARIES[candidate][text];
    if (value !== undefined) {
      template = value;
      break;
    }
  }
  if (!replacements) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = replacements[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

const phraseCache = new Map<Language, Record<string, string>>();

export function searchPhrases(language: Language): Record<string, string> {
  const resolved = resolveLanguage(language);
  const cached = phraseCache.get(resolved);
  if (cached) {
    return cached;
  }
  const merged: Record<string, string> = {};
  for (const candidate of [...FALLBACKS[resolved]].reverse()) {
    Object.assign(merged, SEARCH_PHRASES[candidate]);
  }
  phraseCache.set(resolved, merged);
  return merged;
}
