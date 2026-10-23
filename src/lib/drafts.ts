import type { DocumentDraft, LineEnding } from "../types";

const DRAFT_KEY = "marksi-recovery-draft";

function isLineEnding(value: unknown): value is LineEnding {
  return value === "LF" || value === "CRLF";
}

export function loadDraft(): DocumentDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
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
      window.localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    if (parsed.content === parsed.savedContent) {
      window.localStorage.removeItem(DRAFT_KEY);
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

export function saveDraft(draft: DocumentDraft): boolean {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage may be unavailable in private or restricted contexts.
  }
}
