/** Documents larger than this keep table source visible to protect typing. */
export const TABLE_PREVIEW_MAX_CHARS = 300_000;

/** Upper bound on rendered table widgets in one editor state. */
export const TABLE_PREVIEW_MAX_TABLES = 80;

/**
 * Returns how many table widgets may render for a document of the given
 * length. Large documents fall back to source so decoration rebuilds stay
 * bounded.
 */
export function tablePreviewLimit(documentLength: number): number {
  return documentLength > TABLE_PREVIEW_MAX_CHARS ? 0 : TABLE_PREVIEW_MAX_TABLES;
}

/**
 * A table is active when any selection range overlaps its full-line range.
 * Active tables reveal their Markdown source for editing.
 */
export function tableIsActive(
  ranges: readonly { from: number; to: number }[],
  from: number,
  to: number,
): boolean {
  return ranges.some((range) => range.from <= to && range.to >= from);
}
