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
