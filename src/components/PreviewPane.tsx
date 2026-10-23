import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { renderMarkdown } from "../lib/markdown";
import { openExternal } from "../lib/platform";
import { useAppStore } from "../store/useAppStore";

interface PreviewPaneProps {
  content: string;
  gotoLine: number | null;
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function PreviewPane({ content, gotoLine }: PreviewPaneProps) {
  const debouncedContent = useDebouncedValue(content, 90);
  const html = useMemo(
    () => renderMarkdown(debouncedContent),
    [debouncedContent],
  );
  const surfaceRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    surfaceRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || gotoLine == null) {
      return;
    }
    const anchors = Array.from(
      surface.querySelectorAll<HTMLElement>("[data-source-line]"),
    );
    let target: HTMLElement | undefined;
    for (const anchor of anchors) {
      const line = Number(anchor.dataset.sourceLine);
      if (line <= gotoLine) {
        target = anchor;
      } else {
        break;
      }
    }
    target?.scrollIntoView({ block: "start" });
    useAppStore.getState().clearGotoLine();
  }, [gotoLine, html]);

  function handleLink(event: MouseEvent<HTMLElement>): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const anchor = target.closest("a");
    if (!anchor) {
      return;
    }
    const href = anchor.getAttribute("href") ?? "";
    if (!href) {
      return;
    }
    event.preventDefault();

    if (href.startsWith("#")) {
      let id = href.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch {
        // Keep the raw fragment when it is not percent-encoded.
      }
      const heading = Array.from(
        surfaceRef.current?.querySelectorAll<HTMLElement>("[id]") ?? [],
      ).find((element) => element.id === id);
      heading?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }

    if (/^(https?:|mailto:)/i.test(href)) {
      void openExternal(href).catch((error) => {
        useAppStore
          .getState()
          .showToast(`Could not open link: ${messageFor(error)}`, "error");
      });
      return;
    }

    useAppStore
      .getState()
      .showToast("Local file links will open in a future milestone.", "info");
  }

  return (
    <section
      className="preview-surface"
      ref={surfaceRef}
      tabIndex={-1}
      aria-label="Rendered document"
      onClick={handleLink}
      onAuxClick={handleLink}
    >
      <article
        className="markdown-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}
