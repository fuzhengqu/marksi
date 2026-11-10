/** True when any selection range overlaps the inclusive [from, to] range. */
export function rangeIsActive(
  ranges: readonly { from: number; to: number }[],
  from: number,
  to: number,
): boolean {
  return ranges.some((range) => range.from <= to && range.to >= from);
}
