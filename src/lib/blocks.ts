/**
 * Block-level classes for the editable live preview. Quote depth is clamped so
 * deeply nested quotes stay readable and the generated class list stays stable.
 */
export const MAX_QUOTE_DEPTH = 3;

export function quoteClassForDepth(depth: number): string {
  const clamped = Math.min(
    Math.max(1, Math.trunc(Number.isFinite(depth) ? depth : 1)),
    MAX_QUOTE_DEPTH,
  );
  return `cm-live-quote cm-live-quote-${clamped}`;
}

/**
 * Returns the one-based quote depth for a node given its ancestor names. The
 * node itself is not included in `ancestorNames`.
 */
export function blockquoteDepth(ancestorNames: readonly string[]): number {
  let depth = 1;
  for (const name of ancestorNames) {
    if (name === "Blockquote") {
      depth += 1;
    }
  }
  return depth;
}

export const MAX_FENCE_LABEL_LENGTH = 24;

/** True for the single-character markers of unordered Markdown lists. */
export function isUnorderedListMarker(value: string): boolean {
  return value === "-" || value === "*" || value === "+";
}

/**
 * Returns the visible ordered-list label for an item. Markdown only uses the
 * first number in a list; following items advance sequentially and keep the
 * source delimiter (`.` or `)`).
 */
export function orderedListNumberLabel(
  start: number,
  index: number,
  marker: string,
): string {
  const first =
    Number.isFinite(start) && start > 0 ? Math.trunc(start) : 1;
  const step = Number.isFinite(index) && index > 0 ? Math.trunc(index) : 0;
  return `${first + step}${marker.endsWith(")") ? ")" : "."}`;
}

/**
 * Turns a fenced-code info string into a short language label. The first token
 * is used so attributes and titles do not leak into the badge; attribute-only
 * info strings such as `{.ts}` still yield `ts`.
 */
export function fenceLanguageLabel(info: string): string {
  const token = info.trim().split(/\s+/)[0] ?? "";
  const label = token.replace(/^\{\.?/, "").replace(/\}$/, "");
  return (label || "code").slice(0, MAX_FENCE_LABEL_LENGTH);
}
