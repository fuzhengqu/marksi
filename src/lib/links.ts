export type LinkTarget =
  | { kind: "external"; url: string }
  | { kind: "anchor"; id: string }
  | { kind: "local"; href: string }
  | { kind: "unsupported"; href: string };

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const EXTERNAL_SCHEME = /^(https?:|mailto:)/i;

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
