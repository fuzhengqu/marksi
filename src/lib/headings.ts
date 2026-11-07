/**
 * Maps Markdown heading syntax-tree nodes to their visual level. Both ATX and
 * Setext headings share the same hierarchy in the editable live preview.
 */
const HEADING_LEVELS: Record<string, number> = {
  ATXHeading1: 1,
  ATXHeading2: 2,
  ATXHeading3: 3,
  ATXHeading4: 4,
  ATXHeading5: 5,
  ATXHeading6: 6,
  SetextHeading1: 1,
  SetextHeading2: 2,
};

export function headingLevelForNode(nodeName: string): number | null {
  return HEADING_LEVELS[nodeName] ?? null;
}

export function headingClassForNode(nodeName: string): string | null {
  const level = headingLevelForNode(nodeName);
  return level === null ? null : `cm-live-heading cm-live-h${level}`;
}
