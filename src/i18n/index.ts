import { useCallback } from "react";
import { useAppStore } from "../store/useAppStore";
import { searchPhrases, translate } from "./dictionary";
import type { Replacements } from "./dictionary";

export { searchPhrases, translate };
export type { Replacements };
export {
  LANGUAGE_LABELS,
  LANGUAGES,
  documentLanguage,
  intlLocale,
  isLanguage,
  normalizeLanguage,
  untitledName,
} from "../lib/language";

export function useT() {
  const language = useAppStore((state) => state.settings.language);
  return useCallback(
    (text: string, replacements?: Replacements) =>
      translate(language, text, replacements),
    [language],
  );
}

export function tNow(text: string, replacements?: Replacements): string {
  return translate(
    useAppStore.getState().settings.language,
    text,
    replacements,
  );
}
