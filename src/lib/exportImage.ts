const MAX_CANVAS_DIMENSION = 16_000;
const MAX_CANVAS_PIXELS = 80_000_000;
const MIN_CAPTURE_SCALE = 0.25;
const DEFAULT_CAPTURE_SCALE = 2;

export interface ImageCapture {
  blob: Blob;
  width: number;
  height: number;
  pixelRatio: number;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = String(reader.result ?? "");
      const separator = result.indexOf(",");
      resolve(separator >= 0 ? result.slice(separator + 1) : "");
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("Cannot read the image data."));
    });
    reader.readAsDataURL(blob);
  });
}

export function imageExportName(documentName: string): string {
  const base = documentName.replace(/\.[^.\\/]+$/, "").trim() || "Untitled";
  return `${base}.png`;
}

export function imageExportPath(
  documentPath: string | null,
  documentName: string,
): string {
  const fileName = imageExportName(documentName);
  if (!documentPath) {
    return fileName;
  }
  const separator = Math.max(
    documentPath.lastIndexOf("/"),
    documentPath.lastIndexOf("\\"),
  );
  return separator >= 0
    ? `${documentPath.slice(0, separator + 1)}${fileName}`
    : fileName;
}

/**
 * Chooses a pixel ratio that respects both canvas dimension and area limits.
 * The caller rejects documents below the minimum readable scale instead of
 * silently producing an unreadable image.
 */
export function imageCaptureScale(
  width: number,
  height: number,
  preferred = DEFAULT_CAPTURE_SCALE,
): number {
  if (!(width > 0) || !(height > 0)) {
    return 1;
  }
  const byDimension =
    MAX_CANVAS_DIMENSION / Math.max(width, height);
  const byPixels = Math.sqrt(MAX_CANVAS_PIXELS / (width * height));
  return Math.min(preferred, byDimension, byPixels);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function waitForElement(
  selector: string,
  timeoutMs: number,
): Promise<HTMLElement> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) {
      return element;
    }
    await sleep(80);
  }
  throw new Error("The reading view is not ready yet.");
}

async function waitForContent(element: HTMLElement): Promise<void> {
  const hydrationDeadline = Date.now() + 5_000;
  while (
    element.querySelector(
      'img.is-loading, img[data-marksi-src]:not([src])',
    ) &&
    Date.now() < hydrationDeadline
  ) {
    await sleep(50);
  }

  const images = Array.from(element.querySelectorAll("img"));
  await Promise.all(
    images.map(async (image) => {
      if (image.complete && image.naturalWidth > 0) {
        return;
      }
      try {
        await Promise.race([image.decode(), sleep(4_000)]);
      } catch {
        // A failed image is rendered as a placeholder by the preview.
      }
    }),
  );

  const deadline = Date.now() + 8_000;
  while (
    element.querySelector('.mermaid-diagram[aria-busy="true"]') &&
    Date.now() < deadline
  ) {
    await sleep(80);
  }
  if (document.fonts?.ready) {
    await document.fonts.ready.catch(() => undefined);
  }
  await new Promise<void>((resolve) =>
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => resolve()),
    ),
  );
}

export async function captureReadingView(): Promise<ImageCapture> {
  const element = await waitForElement(".markdown-body", 8_000);
  await waitForContent(element);

  const rect = element.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(element.scrollHeight));
  const pixelRatio = imageCaptureScale(width, height);
  if (pixelRatio < MIN_CAPTURE_SCALE) {
    throw new Error(
      "The document is too long to export as a single image.",
    );
  }

  const elementBackground = getComputedStyle(element).backgroundColor;
  const bodyBackground = getComputedStyle(document.body).backgroundColor;
  const backgroundColor =
    elementBackground && elementBackground !== "rgba(0, 0, 0, 0)"
      ? elementBackground
      : bodyBackground || "#ffffff";
  const needsWebFonts = Boolean(element.querySelector(".katex"));

  const { toBlob } = await import("html-to-image");
  let blob: Blob | null = null;
  try {
    blob = await toBlob(element, {
      width,
      height,
      pixelRatio,
      backgroundColor,
      cacheBust: false,
      skipAutoScale: true,
      // The app otherwise embeds every KaTeX face even when the document has
      // no math, producing multi-megabyte SVG data URLs that WebView2 may fail
      // to decode. System UI fonts do not need embedding.
      skipFonts: !needsWebFonts,
    });
  } catch (error) {
    console.error("MarkSI image export failed", error);
    throw new Error("The document could not be rendered as an image.");
  }
  if (!blob) {
    throw new Error("The document could not be rendered as an image.");
  }
  return { blob, width, height, pixelRatio };
}
