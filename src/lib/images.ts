export const IMAGE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "svg",
  "avif",
  "ico",
] as const;

export type ImageSourceKind = "data" | "remote" | "local" | "unsafe";

export interface ImageSource {
  kind: ImageSourceKind;
  value: string;
}

export function isImagePath(path: string): boolean {
  const clean = path.split(/[?#]/, 1)[0] ?? path;
  const match = /\.([a-z0-9]+)$/i.exec(clean);
  return match
    ? IMAGE_EXTENSIONS.includes(
        match[1].toLowerCase() as (typeof IMAGE_EXTENSIONS)[number],
      )
    : false;
}

export function fileNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.split("/").pop() || path;
}

export function directoryName(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  if (index < 0) {
    return "";
  }
  if (index === 2 && /^[A-Za-z]:\//.test(normalized)) {
    return normalized.slice(0, 3);
  }
  return normalized.slice(0, index);
}

function fileUrlToPath(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "file:") {
      return null;
    }
    let path = decodeURIComponent(url.pathname);
    if (/^\/[A-Za-z]:/.test(path)) {
      path = path.slice(1);
    }
    return path;
  } catch {
    return null;
  }
}

export function classifyImageSource(raw: string): ImageSource {
  const value = raw.trim();
  if (!value) {
    return { kind: "unsafe", value };
  }
  if (/^data:image\//i.test(value)) {
    return { kind: "data", value };
  }
  if (/^https?:\/\//i.test(value) || value.startsWith("//")) {
    return { kind: "remote", value };
  }
  if (/^file:\/\//i.test(value)) {
    const path = fileUrlToPath(value);
    return path
      ? { kind: "local", value: path }
      : { kind: "unsafe", value };
  }
  // A Windows drive path contains a colon but is not a URL scheme.
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value) && !/^[A-Za-z]:[\\/]/.test(value)) {
    return { kind: "unsafe", value };
  }
  return {
    kind: "local",
    value: (() => {
      try {
        return decodeURI(value);
      } catch {
        return value;
      }
    })(),
  };
}

export function resolveLocalImagePath(
  raw: string,
  baseDirectory: string | null,
): string | null {
  const source = classifyImageSource(raw);
  if (source.kind !== "local") {
    return null;
  }

  const value = source.value;
  const windowsBase = Boolean(baseDirectory && /^[A-Za-z]:[\\/]/.test(baseDirectory));
  if (/^[A-Za-z]:[\\/]/.test(value) || value.startsWith("\\\\")) {
    return value.replace(/\\/g, "/");
  }
  if (value.startsWith("/") && !windowsBase) {
    return value;
  }
  if (!baseDirectory) {
    return null;
  }

  const base = baseDirectory.replace(/\\/g, "/").replace(/\/+$/, "");
  const relative = windowsBase ? value.replace(/^\/+/, "") : value;
  return `${base}/${relative}`;
}

export function resolveImageRootPath(
  root: string,
  workspacePath: string | null,
  documentPath: string | null,
): string | null {
  const value = root.trim().replace(/\\/g, "/");
  if (!value) {
    return null;
  }
  if (/^[A-Za-z]:\//.test(value) || value.startsWith("//")) {
    return value.replace(/\/+$/, "");
  }
  if (value.startsWith("/")) {
    return value.replace(/\/+$/, "") || "/";
  }
  const base = workspacePath ?? (documentPath ? directoryName(documentPath) : null);
  if (!base) {
    return null;
  }
  return `${base.replace(/\\/g, "/").replace(/\/+$/, "")}/${value.replace(
    /^\/+/,
    "",
  )}`;
}

export function resolveRootImagePath(
  raw: string,
  rootDirectory: string | null,
): string | null {
  if (!rootDirectory) {
    return null;
  }
  const source = classifyImageSource(raw);
  if (source.kind !== "local") {
    return null;
  }
  const value = source.value.replace(/\\/g, "/");
  if (/^[A-Za-z]:\//.test(value) || value.startsWith("//")) {
    return value;
  }
  const relative = value.replace(/^\/+/, "");
  if (!relative) {
    return null;
  }
  return `${rootDirectory.replace(/\/+$/, "")}/${relative}`;
}

export function encodeMarkdownImagePath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) =>
      encodeURIComponent(segment).replace(/\(/g, "%28").replace(/\)/g, "%29"),
    )
    .join("/");
}

export function buildImageMarkdown(alt: string, path: string): string {
  const safeAlt =
    alt
      .replace(/[\r\n]+/g, " ")
      .replace(/\\/g, "")
      .replace(/[\[\]]/g, "\\$&")
      .trim() || "Image";
  return `![${safeAlt}](${encodeMarkdownImagePath(path)})`;
}

export function extensionForImageMime(mime: string): string {
  switch (mime.toLowerCase()) {
    case "image/jpeg":
      return "jpg";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    case "image/bmp":
      return "bmp";
    case "image/svg+xml":
      return "svg";
    case "image/avif":
      return "avif";
    case "image/x-icon":
    case "image/vnd.microsoft.icon":
      return "ico";
    default:
      return "png";
  }
}

export function pastedImageName(mime: string, timestamp = Date.now()): string {
  return `pasted-${new Date(timestamp)
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14)}.${extensionForImageMime(mime)}`;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("Could not read the image from the clipboard."));
    });
    reader.readAsDataURL(file);
  });
}

export function altTextFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Image";
}
