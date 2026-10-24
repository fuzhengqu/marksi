import type { ViewMode } from "../types";

export interface SessionSnapshot {
  documentPath: string | null;
  workspacePath: string | null;
  viewMode: ViewMode;
}

export const SESSION_KEY = "marksi.session.v1";

function pathValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function viewModeValue(value: unknown): ViewMode {
  return value === "source" || value === "reading" ? value : "preview";
}

export function normalizeSession(value: unknown): SessionSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const documentPath = pathValue(record.documentPath);
  const workspacePath = pathValue(record.workspacePath);
  if (!documentPath && !workspacePath) {
    return null;
  }
  return {
    documentPath,
    workspacePath,
    viewMode: viewModeValue(record.viewMode),
  };
}

export function shouldRestoreSession(options: {
  enabled: boolean;
  navigationType: string | null;
  hasDraft: boolean;
  hasStartupFile: boolean;
  hasOpenDocument: boolean;
}): boolean {
  return (
    options.enabled &&
    options.navigationType !== "reload" &&
    !options.hasDraft &&
    !options.hasStartupFile &&
    !options.hasOpenDocument
  );
}

export function loadSession(): SessionSnapshot | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? normalizeSession(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: SessionSnapshot): void {
  try {
    if (!session.documentPath && !session.workspacePath) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Session memory is optional and must never block editing.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore storage errors.
  }
}

export function navigationType(): string | null {
  try {
    if (typeof performance === "undefined") {
      return null;
    }
    const entry = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined;
    return entry?.type ?? null;
  } catch {
    return null;
  }
}
