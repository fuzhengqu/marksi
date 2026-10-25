export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => {
    if (
      element.hasAttribute("disabled") ||
      element.getAttribute("aria-hidden") === "true" ||
      element.tabIndex < 0
    ) {
      return false;
    }
    return element.getClientRects().length > 0;
  });
}

/**
 * Returns the element that Tab or Shift+Tab should focus inside a modal.
 * When focus has escaped, it re-enters at the appropriate end.
 */
export function nextFocusTarget(
  elements: HTMLElement[],
  current: HTMLElement | null,
  shift: boolean,
): HTMLElement | null {
  if (elements.length === 0) {
    return null;
  }
  const index = current ? elements.indexOf(current) : -1;
  if (index < 0) {
    return shift ? elements[elements.length - 1] : elements[0];
  }
  const next = shift ? index - 1 : index + 1;
  if (next < 0) {
    return elements[elements.length - 1];
  }
  if (next >= elements.length) {
    return elements[0];
  }
  return elements[next];
}
