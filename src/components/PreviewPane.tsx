import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from "react";
import {
  Copy,
  ExternalLink,
  Eye,
  FolderOpen,
  Minus,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { useT } from "../i18n";
import { clampImageHeight, clampImageWidth } from "../lib/imageSize";
import { directoryName, resolveLocalImagePath } from "../lib/images";
import { renderMarkdown } from "../lib/markdown";
import { renderMermaidDiagrams } from "../lib/mermaid";
import {
  isTauri,
  openExternal,
  openLocalPath,
  readImageDataUrl,
  revealLocalPath,
} from "../lib/platform";
import { useAppStore } from "../store/useAppStore";
import type { Theme } from "../types";

interface PreviewPaneProps {
  content: string;
  documentPath: string | null;
  workspacePath: string | null;
  gotoLine: number | null;
  theme: Theme;
  onResizeImage: (
    imageIndex: number,
    width: number | null,
    height: number | null,
    alt: string,
  ) => void;
}

interface LightboxImage {
  src: string;
  alt: string;
}

interface ImageContextMenu {
  x: number;
  y: number;
  src: string;
  alt: string;
  path: string | null;
}

const imageCache = new Map<string, Promise<string>>();
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

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

function loadCachedImage(path: string): Promise<string> {
  let request = imageCache.get(path);
  if (!request) {
    request = readImageDataUrl(path);
    imageCache.set(path, request);
    void request.catch(() => imageCache.delete(path));
  }
  return request;
}

function replaceWithImagePlaceholder(
  image: HTMLImageElement,
  detail: string,
): void {
  const document = image.ownerDocument;
  const placeholder = document.createElement("span");
  placeholder.className = "image-placeholder";
  placeholder.setAttribute("role", "img");
  placeholder.setAttribute("aria-label", image.alt || "Image");
  placeholder.title = detail;

  const mark = document.createElement("span");
  mark.className = "image-placeholder-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "IMG";

  const copy = document.createElement("span");
  copy.className = "image-placeholder-copy";
  const label = document.createElement("span");
  label.textContent = image.alt || "Image";
  const detailNode = document.createElement("small");
  detailNode.className = "image-placeholder-url";
  detailNode.textContent = detail;
  copy.append(label, detailNode);
  placeholder.append(mark, copy);
  const frame = image.closest(".markdown-image-frame");
  if (frame) {
    frame.replaceWith(placeholder);
  } else {
    image.replaceWith(placeholder);
  }
}

export function PreviewPane({
  content,
  documentPath,
  workspacePath,
  gotoLine,
  theme,
  onResizeImage,
}: PreviewPaneProps) {
  const t = useT();
  const debouncedContent = useDebouncedValue(content, 90);
  const readOnlyMode = useAppStore((state) => state.settings.readOnlyMode);
  const strictMode = useAppStore((state) => state.settings.strictMode);
  const resizeLabel = t("Resize image");
  const heightResizeLabel = t("Resize image height");
  const html = useMemo(
    () =>
      renderMarkdown(debouncedContent, {
        imageResizeLabel: resizeLabel,
        imageHeightResizeLabel: heightResizeLabel,
        imageResizable: !readOnlyMode,
        strictMode,
      }),
    [
      debouncedContent,
      heightResizeLabel,
      readOnlyMode,
      resizeLabel,
      strictMode,
    ],
  );
  const surfaceRef = useRef<HTMLElement | null>(null);
  const [lightbox, setLightbox] = useState<LightboxImage | null>(null);
  const [contextMenu, setContextMenu] = useState<ImageContextMenu | null>(null);
  const [zoom, setZoom] = useState(1);
  const baseDirectory = useMemo(
    () =>
      documentPath ? directoryName(documentPath) : (workspacePath ?? null),
    [documentPath, workspacePath],
  );

  useEffect(() => {
    imageCache.clear();
  }, [documentPath]);

  useEffect(() => {
    surfaceRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }
    let cancelled = false;
    const images = Array.from(
      surface.querySelectorAll<HTMLImageElement>("img[data-marksi-src]"),
    );

    images.forEach((image) => {
      const raw = image.dataset.marksiSrc ?? "";
      if (!isTauri()) {
        replaceWithImagePlaceholder(
          image,
          "Local images are available in the desktop app.",
        );
        return;
      }

      const resolved = resolveLocalImagePath(raw, baseDirectory);
      if (!resolved) {
        replaceWithImagePlaceholder(image, raw || "Image path is not local.");
        return;
      }

      void loadCachedImage(resolved)
        .then((source) => {
          if (cancelled || !image.isConnected) {
            return;
          }
          image.src = source;
          image.dataset.marksiImage = "true";
          image.dataset.marksiResolved = resolved;
          image.classList.remove("is-loading");
          image.classList.add("is-loaded");
          if (!image.title) {
            image.title = resolved;
          }
        })
        .catch((error) => {
          if (!cancelled && image.isConnected) {
            replaceWithImagePlaceholder(
              image,
              `Could not load ${resolved}: ${messageFor(error)}`,
            );
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [baseDirectory, html]);

  useEffect(() => {
    setContextMenu(null);
  }, [html]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }
    void renderMermaidDiagrams(surface, theme);
  }, [html, theme]);

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

  useEffect(() => {
    if (!lightbox) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightbox(null);
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setZoom((value) => Math.min(MAX_ZOOM, value + 0.25));
      } else if (event.key === "-") {
        event.preventDefault();
        setZoom((value) => Math.max(MIN_ZOOM, value - 0.25));
      } else if (event.key === "0") {
        event.preventDefault();
        setZoom(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    const dismiss = () => setContextMenu(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismiss();
      }
    };
    window.addEventListener("mousedown", dismiss);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      window.removeEventListener("mousedown", dismiss);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [contextMenu]);

  function openLightbox(src: string, alt: string): void {
    setZoom(1);
    setLightbox({ src, alt });
  }

  function handleResizeStart(event: MouseEvent<HTMLElement>): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const handle = target.closest(".image-resize-handle");
    if (!(handle instanceof HTMLElement)) {
      return;
    }
    const frame = handle.closest(".markdown-image-frame");
    const image = frame?.querySelector("img.markdown-image");
    if (!(image instanceof HTMLImageElement)) {
      return;
    }
    const imageIndex = Number(handle.dataset.imageIndex);
    if (!Number.isInteger(imageIndex)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const axis = handle.dataset.axis === "height" ? "height" : "width";
    const startX = event.clientX;
    const startY = event.clientY;
    const rect = image.getBoundingClientRect();
    const startSize = axis === "width" ? rect.width : rect.height;
    if (startSize < 1) {
      return;
    }
    let nextSize = startSize;
    const onMove = (moveEvent: globalThis.MouseEvent) => {
      if (axis === "width") {
        nextSize = clampImageWidth(startSize + moveEvent.clientX - startX);
        image.style.width = `${nextSize}px`;
        image.style.height = "auto";
      } else {
        nextSize = clampImageHeight(startSize + moveEvent.clientY - startY);
        image.style.height = `${nextSize}px`;
      }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.classList.remove("is-resizing-image");
      delete document.body.dataset.resizeAxis;
      onResizeImage(
        imageIndex,
        axis === "width" ? nextSize : null,
        axis === "height" ? nextSize : null,
        image.alt,
      );
    };
    document.body.classList.add("is-resizing-image");
    document.body.dataset.resizeAxis = axis;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleResizeKey(event: ReactKeyboardEvent<HTMLElement>): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const handle = target.closest(".image-resize-handle");
    if (!(handle instanceof HTMLElement)) {
      return;
    }
    const axis = handle.dataset.axis === "height" ? "height" : "width";
    const keys =
      axis === "width"
        ? ["ArrowLeft", "ArrowRight"]
        : ["ArrowUp", "ArrowDown"];
    if (!keys.includes(event.key)) {
      return;
    }
    const frame = handle.closest(".markdown-image-frame");
    const image = frame?.querySelector("img.markdown-image");
    const imageIndex = Number(handle.dataset.imageIndex);
    if (!(image instanceof HTMLImageElement) || !Number.isInteger(imageIndex)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const direction =
      event.key === "ArrowLeft" || event.key === "ArrowUp" ? -20 : 20;
    const rect = image.getBoundingClientRect();
    onResizeImage(
      imageIndex,
      axis === "width" ? clampImageWidth(rect.width + direction) : null,
      axis === "height" ? clampImageHeight(rect.height + direction) : null,
      image.alt,
    );
  }

  function copyImagePath(path: string): void {
    setContextMenu(null);
    void import("../lib/clipboardText")
      .then(({ copyText }) => copyText(path))
      .then(() => {
        useAppStore.getState().showToast(t("Copied image path."), "success");
      })
      .catch((error) => {
        useAppStore
          .getState()
          .showToast(
            t("Could not copy image path: {error}", {
              error: messageFor(error),
            }),
            "error",
          );
      });
  }

  function openImage(path: string): void {
    setContextMenu(null);
    void openLocalPath(path).catch((error) => {
      useAppStore
        .getState()
        .showToast(
          t("Could not open image: {error}", { error: messageFor(error) }),
          "error",
        );
    });
  }

  function revealImage(path: string): void {
    setContextMenu(null);
    void revealLocalPath(path).catch((error) => {
      useAppStore
        .getState()
        .showToast(
          t("Could not reveal image: {error}", { error: messageFor(error) }),
          "error",
        );
    });
  }

  function handleContextMenu(event: MouseEvent<HTMLElement>): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const image = target.closest("img.markdown-image");
    if (
      !(image instanceof HTMLImageElement) ||
      image.dataset.marksiImage !== "true" ||
      !image.src
    ) {
      return;
    }

    event.preventDefault();
    const path = image.dataset.marksiResolved ?? image.dataset.marksiSrc ?? null;
    const width = 228;
    const height = 176;
    setContextMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8)),
      src: image.src,
      alt: image.alt || t("Image"),
      path,
    });
  }

  function handleClick(event: MouseEvent<HTMLElement>): void {
    if (event.button !== 0) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const image = target.closest("img.markdown-image");
    if (
      image instanceof HTMLImageElement &&
      image.dataset.marksiImage === "true" &&
      image.src
    ) {
      event.preventDefault();
      openLightbox(image.src, image.alt || t("Image"));
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
          .showToast(
            t("Could not open link: {error}", { error: messageFor(error) }),
            "error",
          );
      });
      return;
    }

    useAppStore
      .getState()
      .showToast(
        t("Local file links will open in a future milestone."),
        "info",
      );
  }

  return (
    <>
      <section
        className="preview-surface"
        ref={surfaceRef}
        tabIndex={-1}
        aria-label={t("Rendered document")}
        onClick={handleClick}
        onAuxClick={handleClick}
        onMouseDown={handleResizeStart}
        onKeyDown={handleResizeKey}
        onContextMenu={handleContextMenu}
      >
        <article
          className="markdown-body"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </section>

      {contextMenu ? (
        <div
          className="image-context-menu"
          role="menu"
          aria-label={t("Image actions")}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={() => {
              setContextMenu(null);
              openLightbox(contextMenu.src, contextMenu.alt);
            }}
          >
            <span className="menu-item-icon">
              <Eye size={15} strokeWidth={1.8} />
            </span>
            <span className="menu-item-label">{t("View image")}</span>
          </button>
          {contextMenu.path &&
          !contextMenu.path.startsWith("data:") ? (
            <>
              <button
                type="button"
                className="menu-item"
                role="menuitem"
                onClick={() => copyImagePath(contextMenu.path!)}
              >
                <span className="menu-item-icon">
                  <Copy size={15} strokeWidth={1.8} />
                </span>
                <span className="menu-item-label">{t("Copy image path")}</span>
              </button>
              <div className="menu-separator" />
              <button
                type="button"
                className="menu-item"
                role="menuitem"
                onClick={() => openImage(contextMenu.path!)}
              >
                <span className="menu-item-icon">
                  <ExternalLink size={15} strokeWidth={1.8} />
                </span>
                <span className="menu-item-label">{t("Open image")}</span>
              </button>
              <button
                type="button"
                className="menu-item"
                role="menuitem"
                onClick={() => revealImage(contextMenu.path!)}
              >
                <span className="menu-item-icon">
                  <FolderOpen size={15} strokeWidth={1.8} />
                </span>
                <span className="menu-item-label">{t("Reveal in folder")}</span>
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {lightbox ? (
        <div
          className="image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.alt}
          onMouseDown={() => setLightbox(null)}
        >
          <div
            className="image-lightbox-toolbar"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <span className="image-lightbox-alt" title={lightbox.alt}>
              {lightbox.alt}
            </span>
            <div className="image-lightbox-actions">
              <button
                type="button"
                className="image-lightbox-button"
                onClick={() =>
                  setZoom((value) => Math.max(MIN_ZOOM, value - 0.25))
                }
                aria-label={t("Zoom out")}
                title={t("Zoom out (-)")}
              >
                <Minus size={16} strokeWidth={1.8} />
              </button>
              <span className="image-lightbox-zoom">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                className="image-lightbox-button"
                onClick={() =>
                  setZoom((value) => Math.min(MAX_ZOOM, value + 0.25))
                }
                aria-label={t("Zoom in")}
                title={t("Zoom in (+)")}
              >
                <Plus size={16} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                className="image-lightbox-button"
                onClick={() => setZoom(1)}
                aria-label={t("Reset zoom")}
                title={t("Reset zoom (0)")}
              >
                <RotateCcw size={15} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                className="image-lightbox-button image-lightbox-close"
                onClick={() => setLightbox(null)}
                aria-label={t("Close image preview")}
                title="Close (Esc)"
              >
                <X size={17} strokeWidth={1.8} />
              </button>
            </div>
          </div>
          <div
            className="image-lightbox-stage"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <img
              className="image-lightbox-image"
              src={lightbox.src}
              alt={lightbox.alt}
              style={{ transform: `scale(${zoom})` }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
