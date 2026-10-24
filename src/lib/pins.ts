import type { PinnedEntry } from "../types";

export const MAX_PINNED = 20;

export function pinKey(path: string): string {
  return path.replace(/^\\\\\?\\/, "").replace(/\//g, "\\").toLowerCase();
}

export function isPinned(
  pinned: PinnedEntry[],
  path: string,
): boolean {
  const key = pinKey(path);
  return pinned.some((entry) => pinKey(entry.path) === key);
}

export function togglePin(
  pinned: PinnedEntry[],
  entry: PinnedEntry,
): PinnedEntry[] {
  const key = pinKey(entry.path);
  if (pinned.some((item) => pinKey(item.path) === key)) {
    return pinned.filter((item) => pinKey(item.path) !== key);
  }
  return [
    { path: entry.path, name: entry.name, isDir: entry.isDir },
    ...pinned.filter((item) => pinKey(item.path) !== key),
  ].slice(0, MAX_PINNED);
}

export function retargetPins(
  pinned: PinnedEntry[],
  oldPath: string,
  newPath: string | null,
): PinnedEntry[] {
  const key = pinKey(oldPath);
  if (!newPath) {
    return pinned.filter((entry) => pinKey(entry.path) !== key);
  }
  return pinned.map((entry) =>
    pinKey(entry.path) === key
      ? {
          ...entry,
          path: newPath,
          name: newPath.replace(/\\/g, "/").split("/").pop() || entry.name,
        }
      : entry,
  );
}

export function normalizePins(value: unknown): PinnedEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: PinnedEntry[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const record = item as Record<string, unknown>;
    const path = typeof record.path === "string" ? record.path.trim() : "";
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!path || !name) {
      continue;
    }
    const key = pinKey(path);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({
      path,
      name,
      isDir: record.isDir === true,
    });
    if (result.length >= MAX_PINNED) {
      break;
    }
  }
  return result;
}
