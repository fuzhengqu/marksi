import { extractFrontMatter } from "./frontMatter";
import {
  collectFencedCodeRanges,
  collectInlineCodeRanges,
  isEscaped,
  isIgnored,
  mergeRanges,
  type TextRange,
} from "./textRanges";

/** Documents larger than this keep math source visible to protect typing. */
export const MATH_PREVIEW_MAX_CHARS = 300_000;

/** Upper bound on rendered math widgets in one editor state. */
export const MATH_PREVIEW_MAX_SPANS = 200;

export interface MathSpan {
  from: number;
  to: number;
  content: string;
  display: boolean;
}

/**
 * Returns how many math widgets may render for a document of the given
 * length. Large documents fall back to source so decoration rebuilds stay
 * bounded.
 */
export function mathPreviewLimit(documentLength: number): number {
  return documentLength > MATH_PREVIEW_MAX_CHARS ? 0 : MATH_PREVIEW_MAX_SPANS;
}

function collectIgnoredRanges(
  source: string,
  extra: readonly TextRange[],
): TextRange[] {
  const frontMatter = extractFrontMatter(source);
  const fenced = collectFencedCodeRanges(source);
  const base = mergeRanges([
    ...(frontMatter ? [{ start: 0, end: frontMatter.block.length }] : []),
    ...fenced,
    ...extra,
  ]);
  return mergeRanges([...base, ...collectInlineCodeRanges(source, base)]);
}

function closingDoubleDollar(
  source: string,
  start: number,
  ignored: TextRange[],
): number {
  for (let cursor = start; cursor < source.length - 1; cursor += 1) {
    if (
      source[cursor] === "$" &&
      source[cursor + 1] === "$" &&
      !isEscaped(source, cursor) &&
      !isIgnored(ignored, cursor)
    ) {
      return cursor;
    }
  }
  return -1;
}

function closingDollarOnLine(
  source: string,
  start: number,
  lineEnd: number,
  ignored: TextRange[],
): number {
  for (let cursor = start; cursor < lineEnd; cursor += 1) {
    if (
      source[cursor] !== "$" ||
      isEscaped(source, cursor) ||
      isIgnored(ignored, cursor)
    ) {
      continue;
    }
    if (source[cursor + 1] === "$") {
      cursor += 1;
      continue;
    }
    return cursor;
  }
  return -1;
}

/**
 * Finds inline `$...$` and display `$$...$$` spans outside front matter,
 * fenced code, inline code, and caller-supplied ignored ranges such as link
 * destinations. Inline spans stay on one line; display spans may span lines.
 */
export function findMathSpans(
  source: string,
  extraIgnored: readonly TextRange[] = [],
): MathSpan[] {
  const ignored = collectIgnoredRanges(source, extraIgnored);
  const spans: MathSpan[] = [];
  let cursor = 0;

  while (cursor < source.length) {
    if (
      source[cursor] !== "$" ||
      isEscaped(source, cursor) ||
      isIgnored(ignored, cursor)
    ) {
      cursor += 1;
      continue;
    }

    let openerLength = 1;
    while (source[cursor + openerLength] === "$") {
      openerLength += 1;
    }

    if (openerLength >= 2) {
      const close = closingDoubleDollar(source, cursor + 2, ignored);
      if (close >= 0) {
        const content = source.slice(cursor + 2, close);
        if (content.trim().length > 0) {
          spans.push({
            from: cursor,
            to: close + 2,
            content,
            display: true,
          });
          cursor = close + 2;
          continue;
        }
      }
      cursor += openerLength;
      continue;
    }

    const lineEnd = source.indexOf("\n", cursor);
    const endOfLine = lineEnd < 0 ? source.length : lineEnd;
    const close = closingDollarOnLine(
      source,
      cursor + 1,
      endOfLine,
      ignored,
    );
    if (close < 0) {
      cursor += 1;
      continue;
    }

    const content = source.slice(cursor + 1, close);
    const after = source[close + 1] ?? "";
    if (
      content.trim().length === 0 ||
      /^\s/.test(content) ||
      /\s$/.test(content) ||
      /\d/.test(after)
    ) {
      cursor = close + 1;
      continue;
    }

    spans.push({
      from: cursor,
      to: close + 1,
      content,
      display: false,
    });
    cursor = close + 1;
  }

  return spans;
}
