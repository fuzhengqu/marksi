import { useEffect, type RefObject } from "react";
import { focusableElements, nextFocusTarget } from "./focus";

export function useFocusTrap(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!open) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const timer = window.setTimeout(() => {
      const items = focusableElements(container);
      (items[0] ?? container).focus({ preventScroll: true });
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }
      const currentContainer = containerRef.current;
      if (!currentContainer) {
        return;
      }
      const items = focusableElements(currentContainer);
      if (items.length === 0) {
        event.preventDefault();
        currentContainer.focus({ preventScroll: true });
        return;
      }
      const current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const target = nextFocusTarget(items, current, event.shiftKey);
      if (target) {
        event.preventDefault();
        target.focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown, true);
      if (previous?.isConnected) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [open, containerRef]);
}
