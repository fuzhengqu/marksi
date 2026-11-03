import { translate } from "../i18n/dictionary";
import type { Language } from "../types";
import { intlLocale } from "./language";

export function formatSnapshotSize(bytes: number): string {
  const safe = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (safe < 1024) {
    return `${Math.round(safe)} B`;
  }
  if (safe < 1024 * 1024) {
    return `${(safe / 1024).toFixed(1)} KB`;
  }
  return `${(safe / (1024 * 1024)).toFixed(1)} MB`;
}

export function snapshotTime(savedAt: number, language: Language): string {
  if (!Number.isFinite(savedAt) || savedAt <= 0) {
    return translate(language, "Unknown time");
  }
  return new Date(savedAt).toLocaleString(intlLocale(language), {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
