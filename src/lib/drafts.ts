import type { DocumentDraft, LineEnding } from "../types";

const DRAFT_KEY = "marksi-recovery-draft";

function isLineEnding(value: unknown): value is LineEnding {
  return value === "LF" || value === "CRLF";
}

export function loadDraft(storageKey = DRAFT_KEY): DocumentDraft | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<DocumentDraft>;
    if (
      typeof parsed.content !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.savedContent !== "string" ||
      typeof parsed.updatedAt !== "number" ||
      !isLineEnding(parsed.lineEnding)
    ) {
      window.localStorage.removeItem(storageKey);
      return null;
    }
    if (parsed.content === parsed.savedContent) {
      window.localStorage.removeItem(storageKey);
      return null;
    }
    return {
      path: typeof parsed.path === "string" ? parsed.path : null,
      name: parsed.name,
      content: parsed.content,
      savedContent: parsed.savedContent,
      encoding:
        typeof parsed.encoding === "string" ? parsed.encoding : "UTF-8",
      lineEnding: parsed.lineEnding,
      hasBom: Boolean(parsed.hasBom),
      modifiedMs:
        typeof parsed.modifiedMs === "number" ? parsed.modifiedMs : null,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function saveDraft(
  draft: DocumentDraft,
  storageKey = DRAFT_KEY,
): boolean {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(storageKey = DRAFT_KEY): void {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Storage may be unavailable in private or restricted contexts.
  }
}
