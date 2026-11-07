/**
 * Task list marker helpers for the editable live preview. A marker is exactly
 * three characters: `[ ]`, `[x]`, or `[X]`. Keeping the source range fixed makes
 * the checkbox toggle a single undoable edit.
 */
export function isTaskMarker(value: string): boolean {
  return /^\[[ xX]\]$/.test(value);
}

export function taskMarkerChecked(value: string): boolean {
  return /^\[[xX]\]$/.test(value);
}

export function toggleTaskMarker(value: string): string | null {
  if (!isTaskMarker(value)) {
    return null;
  }
  return taskMarkerChecked(value) ? "[ ]" : "[x]";
}
