export interface TextRange {
  start: number;
  end: number;
}

export function isEscaped(source: string, index: number): boolean {
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

export function mergeRanges(ranges: TextRange[]): TextRange[] {
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

export function isIgnored(ranges: TextRange[], index: number): boolean {
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

export function collectFencedCodeRanges(source: string): TextRange[] {
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

export function collectInlineCodeRanges(
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
