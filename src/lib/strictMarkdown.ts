import { extractFrontMatter } from "./frontMatter";

/**
 * Adds the whitespace required by strict ATX headings when the user disables
 * strict mode. The canonical Markdown source is not modified; this only
 * normalizes the rendering input. Fenced code and front matter are untouched.
 */
export function normalizeLaxHeadings(source: string): string {
  const frontMatter = extractFrontMatter(source);
  const body = frontMatter ? source.slice(frontMatter.block.length) : source;
  const lines = body.split("\n");
  let fence: { character: string; length: number } | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (fence) {
      const closing = new RegExp(
        `^ {0,3}\\${fence.character}{${fence.length},}[ \\t]*\\r?$`,
      );
      if (closing.test(line)) {
        fence = null;
      }
      continue;
    }

    const opening = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (opening) {
      fence = { character: opening[1][0], length: opening[1].length };
      continue;
    }

    const lineEnding = line.endsWith("\r") ? "\r" : "";
    const lineBody = lineEnding ? line.slice(0, -1) : line;
    const compactHeading = /^( {0,3})(#{1,6})([^#\s].*)$/.exec(lineBody);
    if (compactHeading) {
      lines[index] = `${compactHeading[1]}${compactHeading[2]} ${compactHeading[3]}${lineEnding}`;
    }
  }

  const normalizedBody = lines.join("\n");
  return frontMatter
    ? `${frontMatter.block}${normalizedBody}`
    : normalizedBody;
}

interface LaxListItem {
  originalIndent: number;
  targetIndent: number;
  contentIndent: number;
  orderedStart: number | null;
}

function parseListMarker(
  line: string,
): {
  originalIndent: number;
  marker: string;
  gap: number;
  start: number | null;
  hasContent: boolean;
} | null {
  const match = /^( *)([-+*]|\d{1,9}[.)])([ \t]+|$)/.exec(line);
  if (!match || match[1].includes("\t")) {
    return null;
  }

  const marker = match[2];
  const markerStart = match[1].length + marker.length;
  const rest = match[3] ?? "";
  if (rest.includes("\t")) {
    return null;
  }

  const hasContent = markerStart + rest.length < line.length;
  const rawGap = rest.length;
  const gap = !hasContent || rawGap > 4 ? 1 : rawGap;
  const orderedStart = /^\d/.test(marker)
    ? Number.parseInt(marker, 10)
    : null;

  return {
    originalIndent: match[1].length,
    marker,
    gap,
    start: orderedStart,
    hasContent,
  };
}

/**
 * Normalizes under-indented child list markers when strict mode is disabled.
 * Only list-marker lines are padded; text, fences, code, quotes, and front
 * matter are preserved. The source line count never changes.
 */
export function normalizeLaxLists(source: string): string {
  const frontMatter = extractFrontMatter(source);
  const body = frontMatter ? source.slice(frontMatter.block.length) : source;
  const lines = body.split("\n");
  const stack: LaxListItem[] = [];
  let fence: { character: string; length: number; indent: number } | null =
    null;
  let mathBlock = false;
  let blank = true;
  let paragraphOpen = false;

  for (let index = 0; index < lines.length; index += 1) {
    const original = lines[index];
    const lineEnding = original.endsWith("\r") ? "\r" : "";
    const line = lineEnding ? original.slice(0, -1) : original;
    const top = stack[stack.length - 1];
    const contentLimit = top ? top.contentIndent : 3;

    if (fence) {
      const closing = /^( *)(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (
        closing &&
        closing[2][0] === fence.character &&
        closing[2].length >= fence.length &&
        closing[1].length <= fence.indent + 3
      ) {
        fence = null;
      }
      blank = false;
      paragraphOpen = false;
      continue;
    }

    if (mathBlock) {
      if (/^ *\$\$[ \t]*$/.test(line)) {
        mathBlock = false;
        blank = false;
      }
      continue;
    }

    if (line.trim() === "") {
      blank = true;
      paragraphOpen = false;
      continue;
    }

    const leading = /^[ \t]*/.exec(line)?.[0] ?? "";
    const indent = leading.length;

    if (/^ {0,3}>/.test(line)) {
      if (!stack.length || indent < contentLimit) {
        stack.length = 0;
      }
      blank = false;
      paragraphOpen = false;
      continue;
    }

    const fenceOpen = /^( *)(`{3,}|~{3,})(.*)$/.exec(line);
    if (fenceOpen && indent <= contentLimit + 3) {
      if (!stack.length || indent < contentLimit) {
        stack.length = 0;
      }
      fence = {
        character: fenceOpen[2][0],
        length: fenceOpen[2].length,
        indent,
      };
      blank = false;
      paragraphOpen = false;
      continue;
    }

    if (/^ *\$\$[ \t]*$/.test(line) && indent <= contentLimit + 3) {
      if (!stack.length || indent < contentLimit) {
        stack.length = 0;
      }
      mathBlock = true;
      blank = false;
      paragraphOpen = false;
      continue;
    }

    const blockStart =
      /^ {0,3}#{1,6}(?:[ \t]|$)/.test(line) ||
      /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(
        line,
      ) ||
      /^ {0,3}\[\^[^\]]+\]:/.test(line);
    if (blockStart) {
      if (!stack.length || indent < contentLimit) {
        stack.length = 0;
      }
      blank = false;
      paragraphOpen = false;
      continue;
    }

    if (leading.includes("\t")) {
      blank = false;
      paragraphOpen = true;
      continue;
    }

    const marker = parseListMarker(line);
    if (!marker) {
      if (blank && stack.length && indent < contentLimit) {
        stack.length = 0;
      }
      blank = false;
      paragraphOpen = true;
      continue;
    }

    while (stack.length && marker.originalIndent < stack[stack.length - 1].originalIndent) {
      stack.pop();
    }

    let parent = stack[stack.length - 1];
    let targetIndent = marker.originalIndent;
    if (
      parent &&
      marker.originalIndent === parent.originalIndent
    ) {
      targetIndent = parent.targetIndent;
      stack.pop();
      parent = stack[stack.length - 1];
    } else if (parent && marker.originalIndent < parent.contentIndent) {
      if (marker.start !== null && marker.start !== 1 && !blank) {
        blank = false;
        continue;
      }
      targetIndent = parent.contentIndent;
    }

    if (!parent && marker.originalIndent > 3) {
      blank = false;
      continue;
    }
    if (
      parent &&
      marker.originalIndent > parent.contentIndent &&
      marker.originalIndent - parent.contentIndent >= 4
    ) {
      blank = false;
      continue;
    }

    if (targetIndent > marker.originalIndent) {
      lines[index] =
        " ".repeat(targetIndent - marker.originalIndent) + original;
    }

    const markerWidth = marker.marker.length;
    stack.push({
      originalIndent: marker.originalIndent,
      targetIndent,
      contentIndent: targetIndent + markerWidth + marker.gap,
      orderedStart: marker.start,
    });
    blank = false;
    paragraphOpen = marker.hasContent;
  }

  const normalizedBody = lines.join("\n");
  return frontMatter
    ? `${frontMatter.block}${normalizedBody}`
    : normalizedBody;
}

/** Applies all strict-mode normalizations to a rendering-only copy. */
export function normalizeLaxMarkdown(source: string): string {
  return normalizeLaxLists(normalizeLaxHeadings(source));
}
