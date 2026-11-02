const EDITOR_WINDOW_PATTERN = /^editor-\d+$/;
const MAIN_WINDOW_KEY = "main";
const DRAFT_KEY = "marksi-recovery-draft";

export function windowKeyFromLocation(search: string): string {
  const value = new URLSearchParams(search).get("window");
  return value && EDITOR_WINDOW_PATTERN.test(value)
    ? value
    : MAIN_WINDOW_KEY;
}

export function isMainWindow(windowKey: string): boolean {
  return windowKey === MAIN_WINDOW_KEY;
}

export function draftStorageKey(windowKey: string): string {
  return isMainWindow(windowKey)
    ? DRAFT_KEY
    : `${DRAFT_KEY}:${windowKey}`;
}
