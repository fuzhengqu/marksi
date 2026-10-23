export interface TextChange {
  from: number;
  to: number;
  insert: string;
}

/**
 * Returns the smallest replacement that turns `before` into `after`. A null
 * result means the strings are already equal.
 */
export function minimalTextChange(
  before: string,
  after: string,
): TextChange | null {
  if (before === after) {
    return null;
  }

  const limit = Math.min(before.length, after.length);
  let prefix = 0;
  while (prefix < limit && before[prefix] === after[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < limit - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  return {
    from: prefix,
    to: before.length - suffix,
    insert: after.slice(prefix, after.length - suffix),
  };
}
