import { extractFrontMatter } from "./frontMatter";

export const IMAGE_WIDTH_MIN = 24;
export const IMAGE_WIDTH_MAX = 1600;
export const IMAGE_HEIGHT_MIN = 24;
export const IMAGE_HEIGHT_MAX = 1600;

interface TextRange {
  start: number;
  end: number;
}

interface ImageOccurrence {
  from: number;
  to: number;
  attrsFrom: number | null;
  attrsTo: number | null;
  alt: string;
}

function normalizeAlt(alt: string): string {
  return alt.trim() || "Image";
}

function isEscaped(source: string, index: number): boolean {
  let slashes = 0;
  for (
    let cursor = index - 1;
    cursor >= 0 && source[cursor] === "\\";
    cursor -= 1
  ) {
    slashes += 1;
  }
  return slashes % 2 === 1;
}

function mergeRanges(ranges: TextRange[]): TextRange[] {
  const ordered = ranges
    .filter((range) => range.end > range.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: TextRange[] = [];
  for (const range of ordered) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function isIgnored(ranges: TextRange[], index: number): boolean {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const range = ranges[middle];
    if (index < range.start) {
      high = middle - 1;
    } else if (index >= range.end) {
      low = middle + 1;
    } else {
      return true;
    }
  }
  return false;
}

function collectFencedCodeRanges(source: string): TextRange[] {
  const ranges: TextRange[] = [];
  let lineStart = 0;
  let openFence: { character: string; length: number; start: number } | null =
    null;

  while (lineStart <= source.length) {
    let lineEnd = source.indexOf("\n", lineStart);
    if (lineEnd < 0) {
      lineEnd = source.length;
    }
    const line = source.slice(lineStart, lineEnd).replace(/\r$/, "");

    if (openFence) {
      const closingPattern = new RegExp(
        `^ {0,3}\\${openFence.character}{${openFence.length},}[ \\t]*$`,
      );
      if (closingPattern.test(line)) {
        ranges.push({ start: openFence.start, end: lineEnd });
        openFence = null;
      }
    } else {
      const opening = /^ {0,3}(`{3,}|~{3,})/.exec(line);
      if (opening) {
        openFence = {
          character: opening[1][0],
          length: opening[1].length,
          start: lineStart,
        };
      }
    }

    if (lineEnd === source.length) {
      break;
    }
    lineStart = lineEnd + 1;
  }

  if (openFence) {
    ranges.push({ start: openFence.start, end: source.length });
  }
  return ranges;
}

function collectInlineCodeRanges(
  source: string,
  fencedRanges: TextRange[],
): TextRange[] {
  const ranges: TextRange[] = [];
  let lineStart = 0;

  while (lineStart <= source.length) {
    let lineEnd = source.indexOf("\n", lineStart);
    if (lineEnd < 0) {
      lineEnd = source.length;
    }
    if (isIgnored(fencedRanges, lineStart)) {
      if (lineEnd === source.length) {
        break;
      }
      lineStart = lineEnd + 1;
      continue;
    }

    let cursor = lineStart;
    while (cursor < lineEnd) {
      if (source[cursor] !== "`" || isEscaped(source, cursor)) {
        cursor += 1;
        continue;
      }
      let openerLength = 1;
      while (source[cursor + openerLength] === "`") {
        openerLength += 1;
      }

      let closing = cursor + openerLength;
      let foundEnd = -1;
      while (closing < lineEnd) {
        if (source[closing] !== "`") {
          closing += 1;
          continue;
        }
        let closerLength = 1;
        while (source[closing + closerLength] === "`") {
          closerLength += 1;
        }
        if (closerLength === openerLength) {
          foundEnd = closing + closerLength;
          break;
        }
        closing += closerLength;
      }

      if (foundEnd >= 0) {
        ranges.push({ start: cursor, end: foundEnd });
        cursor = foundEnd;
      } else {
        cursor += openerLength;
      }
    }

    if (lineEnd === source.length) {
      break;
    }
    lineStart = lineEnd + 1;
  }

  return ranges;
}

function collectFootnoteRanges(
  source: string,
  ignored: TextRange[],
): TextRange[] {
  const ranges: TextRange[] = [];
  let lineStart = 0;
  let footnoteStart: number | null = null;

  while (lineStart <= source.length) {
    let lineEnd = source.indexOf("\n", lineStart);
    if (lineEnd < 0) {
      lineEnd = source.length;
    }
    const line = source.slice(lineStart, lineEnd).replace(/\r$/, "");
    const blank = line.trim() === "";
    const indented = /^(?: {4}|\t)/.test(line);

    if (footnoteStart !== null && !blank && !indented) {
      ranges.push({ start: footnoteStart, end: lineStart });
      footnoteStart = null;
    }

    if (
      footnoteStart === null &&
      !isIgnored(ignored, lineStart) &&
      /^ {0,3}\[\^[^\]\n]+\]:/.test(line)
    ) {
      footnoteStart = lineStart;
    }

    if (lineEnd === source.length) {
      break;
    }
    lineStart = lineEnd + 1;
  }

  if (footnoteStart !== null) {
    ranges.push({ start: footnoteStart, end: source.length });
  }
  return ranges;
}

function normalizeReferenceLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

function collectReferenceDefinitions(
  source: string,
  ignored: TextRange[],
): { labels: Set<string>; ranges: TextRange[] } {
  const labels = new Set<string>();
  const ranges: TextRange[] = [];
  let lineStart = 0;

  while (lineStart <= source.length) {
    let lineEnd = source.indexOf("\n", lineStart);
    if (lineEnd < 0) {
      lineEnd = source.length;
    }
    if (!isIgnored(ignored, lineStart)) {
      const line = source.slice(lineStart, lineEnd).replace(/\r$/, "");
      const match = /^ {0,3}\[([^\]\n]+)\]:[ \t]*(?:<[^>\n]*>|\S+)/.exec(line);
      if (match && !match[1].startsWith("^")) {
        labels.add(normalizeReferenceLabel(match[1]));
        ranges.push({ start: lineStart, end: lineEnd });
      }
    }

    if (lineEnd === source.length) {
      break;
    }
    lineStart = lineEnd + 1;
  }

  return { labels, ranges };
}

function findClosingParen(source: string, start: number): number {
  let depth = 0;
  let quote: '"' | "'" | null = null;
  for (let cursor = start; cursor < source.length; cursor += 1) {
    const character = source[cursor];
    if (character === "\\") {
      cursor += 1;
      continue;
    }
    if (character === "\n") {
      break;
    }
    if (quote) {
      if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      if (depth === 0) {
        return cursor;
      }
      depth -= 1;
    }
  }
  return -1;
}

function findClosingBracket(source: string, start: number): number {
  for (let cursor = start; cursor < source.length; cursor += 1) {
    const character = source[cursor];
    if (character === "\\") {
      cursor += 1;
      continue;
    }
    if (character === "\n") {
      return -1;
    }
    if (character === "]") {
      return cursor;
    }
  }
  return -1;
}

/**
 * Locates Markdown image spans and an optional immediately following attribute
 * block. This is intentionally a source scanner rather than an HTML converter:
 * image dimensions must be written back to the canonical Markdown text.
 *
 * Fenced code, inline code, and reference definitions are skipped so a source
 * image inside code can never shift the index of a rendered image. Reference
 * images are included in document order, matching markdown-it's render order
 * for normal documents.
 */
export function findImageOccurrences(source: string): ImageOccurrence[] {
  const frontMatter = extractFrontMatter(source);
  const frontMatterRanges: TextRange[] = frontMatter
    ? [{ start: 0, end: frontMatter.block.length }]
    : [];
  const fencedRanges = collectFencedCodeRanges(source);
  let ignored = mergeRanges([...frontMatterRanges, ...fencedRanges]);
  const inlineRanges = collectInlineCodeRanges(source, ignored);
  ignored = mergeRanges([...ignored, ...inlineRanges]);
  const footnoteRanges = collectFootnoteRanges(source, ignored);
  ignored = mergeRanges([...ignored, ...footnoteRanges]);
  const references = collectReferenceDefinitions(source, ignored);
  ignored = mergeRanges([...ignored, ...references.ranges]);

  const occurrences: ImageOccurrence[] = [];
  for (let index = 0; index < source.length - 1; index += 1) {
    if (
      source[index] !== "!" ||
      source[index + 1] !== "[" ||
      isEscaped(source, index) ||
      isIgnored(ignored, index)
    ) {
      continue;
    }

    let depth = 0;
    let labelEnd = -1;
    for (let cursor = index + 2; cursor < source.length; cursor += 1) {
      const character = source[cursor];
      if (character === "\\") {
        cursor += 1;
        continue;
      }
      if (character === "[") {
        depth += 1;
      } else if (character === "]") {
        if (depth === 0) {
          labelEnd = cursor;
          break;
        }
        depth -= 1;
      }
    }
    if (labelEnd < 0) {
      continue;
    }

    const alt = source.slice(index + 2, labelEnd);
    const following = source[labelEnd + 1];
    let imageEnd = -1;

    if (following === "(") {
      const destinationEnd = findClosingParen(source, labelEnd + 2);
      if (destinationEnd >= 0) {
        imageEnd = destinationEnd + 1;
      }
    } else if (following === "[") {
      const referenceEnd = findClosingBracket(source, labelEnd + 2);
      if (referenceEnd >= 0) {
        const rawLabel = source.slice(labelEnd + 2, referenceEnd);
        const referenceLabel = rawLabel.trim() ? rawLabel : alt;
        if (references.labels.has(normalizeReferenceLabel(referenceLabel))) {
          imageEnd = referenceEnd + 1;
        }
      }
    } else if (references.labels.has(normalizeReferenceLabel(alt))) {
      // Shortcut reference image: ![alt] with a matching definition.
      imageEnd = labelEnd + 1;
    }

    if (imageEnd < 0) {
      continue;
    }

    let attrsFrom: number | null = null;
    let attrsTo: number | null = null;
    let attrsCursor = imageEnd;
    while (
      source[attrsCursor] === " " ||
      source[attrsCursor] === "\t"
    ) {
      attrsCursor += 1;
    }
    if (source[attrsCursor] === "{") {
      const close = source.indexOf("}", attrsCursor + 1);
      const newline = source.indexOf("\n", attrsCursor);
      if (close >= 0 && (newline < 0 || close < newline)) {
        attrsFrom = attrsCursor;
        attrsTo = close + 1;
      }
    }

    occurrences.push({
      from: index,
      to: imageEnd,
      attrsFrom,
      attrsTo,
      alt,
    });
    index = Math.max(imageEnd, attrsTo ?? imageEnd) - 1;
  }
  return occurrences;
}

export function clampImageWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return 0;
  }
  return Math.round(
    Math.min(IMAGE_WIDTH_MAX, Math.max(IMAGE_WIDTH_MIN, width)),
  );
}

export function clampImageHeight(height: number): number {
  if (!Number.isFinite(height)) {
    return 0;
  }
  return Math.round(
    Math.min(IMAGE_HEIGHT_MAX, Math.max(IMAGE_HEIGHT_MIN, height)),
  );
}

function targetOccurrence(
  source: string,
  imageIndex: number,
  expectedAlt?: string,
): ImageOccurrence | null {
  const occurrences = findImageOccurrences(source);
  let occurrence = occurrences[imageIndex];
  if (expectedAlt !== undefined) {
    const expected = normalizeAlt(expectedAlt);
    if (!occurrence || normalizeAlt(occurrence.alt) !== expected) {
      const matches = occurrences.filter(
        (candidate) => normalizeAlt(candidate.alt) === expected,
      );
      if (matches.length !== 1) {
        return null;
      }
      occurrence = matches[0];
    }
  }
  return occurrence ?? null;
}

function updateDimensions(
  attrs: string,
  width: number | null | undefined,
  height: number | null | undefined,
): string {
  let updated = attrs;
  const values: Array<["width" | "height", number]> = [];
  if (width !== null && width !== undefined) {
    const clamped = clampImageWidth(width);
    if (clamped > 0) {
      values.push(["width", clamped]);
    }
  }
  if (height !== null && height !== undefined) {
    const clamped = clampImageHeight(height);
    if (clamped > 0) {
      values.push(["height", clamped]);
    }
  }

  for (const [name, value] of values) {
    const pattern = new RegExp(`(^|\\s)${name}\\s*=\\s*[^\\s}]+`, "i");
    if (pattern.test(updated)) {
      updated = updated.replace(pattern, `$1${name}=${value}`);
    } else {
      const trimmed = updated.trim();
      updated = `${trimmed ? `${trimmed} ` : ""}${name}=${value}`;
    }
  }
  return updated.trim();
}

/**
 * Sets width and/or height on the nth image, preserving other attributes.
 * Returns the original source when the image cannot be identified safely.
 */
export function setImageSize(
  source: string,
  imageIndex: number,
  width: number | null | undefined,
  height: number | null | undefined,
  expectedAlt?: string,
): string {
  const occurrence = targetOccurrence(source, imageIndex, expectedAlt);
  if (!occurrence) {
    return source;
  }
  const attrs =
    occurrence.attrsFrom !== null && occurrence.attrsTo !== null
      ? source.slice(occurrence.attrsFrom + 1, occurrence.attrsTo - 1)
      : "";
  const updated = updateDimensions(attrs, width, height);
  if (!updated) {
    return source;
  }

  // Remove whitespace between the image and its attribute block. markdown-it
  // would otherwise attach a spaced attribute block to the paragraph instead.
  return `${source.slice(0, occurrence.to)}{${updated}}${source.slice(
    occurrence.attrsTo ?? occurrence.to,
  )}`;
}

/**
 * Sets the pixel width of the nth image in the document, preserving any other
 * attributes. Returns the original source when the image index is out of range.
 */
export function setImageWidth(
  source: string,
  imageIndex: number,
  width: number,
  expectedAlt?: string,
): string {
  return setImageSize(source, imageIndex, width, null, expectedAlt);
}

export function setImageHeight(
  source: string,
  imageIndex: number,
  height: number,
  expectedAlt?: string,
): string {
  return setImageSize(source, imageIndex, null, height, expectedAlt);
}

/**
 * Removes width/height from the nth image while retaining unrelated attributes.
 */
export function clearImageSize(
  source: string,
  imageIndex: number,
  expectedAlt?: string,
): string {
  const occurrence = targetOccurrence(source, imageIndex, expectedAlt);
  if (!occurrence || occurrence.attrsFrom === null || occurrence.attrsTo === null) {
    return source;
  }
  const attrs = source.slice(occurrence.attrsFrom + 1, occurrence.attrsTo - 1);
  const remaining = attrs
    .replace(/(?:^|\s)(?:width|height)\s*=\s*[^\s}]+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!remaining) {
    return `${source.slice(0, occurrence.to)}${source.slice(occurrence.attrsTo)}`;
  }
  return `${source.slice(0, occurrence.to)}{${remaining}}${source.slice(
    occurrence.attrsTo,
  )}`;
}

function dimensionFromAttributes(
  attrs: string | null | undefined,
  name: "width" | "height",
  clamp: (value: number) => number,
): number | null {
  if (!attrs) {
    return null;
  }
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*([^\\s}]+)`, "i").exec(
    attrs,
  );
  if (!match) {
    return null;
  }
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? clamp(value) : null;
}

export function imageWidthFromAttributes(
  attrs: string | null | undefined,
): number | null {
  return dimensionFromAttributes(attrs, "width", clampImageWidth);
}

export function imageHeightFromAttributes(
  attrs: string | null | undefined,
): number | null {
  return dimensionFromAttributes(attrs, "height", clampImageHeight);
}
