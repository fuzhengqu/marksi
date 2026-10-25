export interface ImeKeyEvent {
  isComposing?: boolean;
  key?: string;
  keyCode?: number;
}

/**
 * App-level shortcuts must not run while an IME is composing. Chromium also
 * reports keyCode 229 for the processing key on Windows IMEs, and some
 * WebViews expose `key` as "Process" without `isComposing`.
 */
export function isImeKeyEvent(event: ImeKeyEvent): boolean {
  return (
    event.isComposing === true ||
    event.keyCode === 229 ||
    event.key === "Process"
  );
}
