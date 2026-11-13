export type LinkTarget =
  | { kind: "external"; url: string }
  | { kind: "anchor"; id: string }
  | { kind: "local"; href: string }
  | { kind: "unsupported"; href: string };

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const EXTERNAL_SCHEME = /^(https?:|mailto:)/i;
const LOCAL_LINK_EXTENSIONS = new Set([
  "md",
  "markdown",
  "mdown",
  "mkd",
  "mdwn",
  "mmd",
  "mdx",
  "txt",
  "text",
]);

function documentDirectory(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  if (index < 0) {
    return "";
  }
  return normalized.slice(0, index);
}

export interface ResolvedLocalLink {
  path: string;
  fragment: string | null;
}

/**
 * Resolves a relative Markdown/text link against the current document folder,
 * preserving an optional `#fragment` for heading navigation.
 */
export function resolveLocalLink(
  href: string,
  documentPath: string | null,
): ResolvedLocalLink | null {
  if (!documentPath) {
    return null;
  }
  let value = href.trim();
  if (!value) {
    return null;
  }
  let fragment: string | null = null;
  const hash = value.indexOf("#");
  if (hash >= 0) {
    fragment = value.slice(hash + 1);
    value = value.slice(0, hash);
    try {
      fragment = decodeURIComponent(fragment);
    } catch {
      // Keep the raw fragment when it is not percent-encoded.
    }
  }
  const query = value.indexOf("?");
  if (query >= 0) {
    value = value.slice(0, query);
  }
  if (!value) {
    return null;
  }
  try {
    value = decodeURI(value);
  } catch {
    // Keep the original value when it is not percent-encoded.
  }
  const normalized = value.replace(/\\/g, "/");
  if (
    normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    /^[A-Za-z]:\//.test(normalized) ||
    SCHEME.test(normalized)
  ) {
    return null;
  }
  const name = normalized.split("/").pop() ?? "";
  const extension = name.includes(".")
    ? name.slice(name.lastIndexOf(".") + 1).toLowerCase()
    : "";
  if (!LOCAL_LINK_EXTENSIONS.has(extension)) {
    return null;
  }
  const base = documentDirectory(documentPath).replace(/\/+$/, "");
  return {
    path: base ? `${base}/${normalized}` : normalized,
    fragment: fragment?.trim() ? fragment : null,
  };
}

/**
 * Resolves the path portion of a local link. Kept for callers that do not need
 * the fragment.
 */
export function resolveLocalLinkPath(
  href: string,
  documentPath: string | null,
): string | null {
  return resolveLocalLink(href, documentPath)?.path ?? null;
}

/**
 * Finds the heading line matching a fragment, preferring an exact ID and then
 * a case-insensitive match.
 */
export function headingAnchorLine(
  anchors: readonly { id: string; line: number }[],
  fragment: string,
): number | null {
  const wanted = fragment.trim();
  if (!wanted) {
    return null;
  }
  const exact = anchors.find((anchor) => anchor.id === wanted);
  if (exact) {
    return exact.line;
  }
  const folded = anchors.find(
    (anchor) => anchor.id.toLowerCase() === wanted.toLowerCase(),
  );
  return folded?.line ?? null;
}

/**
 * Classifies a Markdown link destination without activating it. Only the
 * schemes already supported by the reading view are opened externally;
 * fragment links stay in the document and local/unsupported targets are not
 * handed to the operating system.
 */
export function classifyLinkTarget(href: string): LinkTarget {
  const value = href.trim();
  if (value.startsWith("#")) {
    let id = value.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {
      // Keep the raw fragment when it is not percent-encoded.
    }
    return { kind: "anchor", id };
  }
  if (EXTERNAL_SCHEME.test(value)) {
    return { kind: "external", url: value };
  }
  if (SCHEME.test(value)) {
    return { kind: "unsupported", href: value };
  }
  return { kind: "local", href: value };
}

/**
 * Normalizes a reference label such as `[Docs]` or `[docs][]` for comparison
 * with a link-reference definition. Labels are case-insensitive and collapse
 * internal whitespace.
 */
export function normalizeReferenceLabel(value: string): string {
  const trimmed = value.trim();
  const bracketed = /^\[([^\]]*)\]/.exec(trimmed);
  return (bracketed ? bracketed[1] : trimmed)
    .replace(/\s+/g, " ")
    .toLowerCase();
}
