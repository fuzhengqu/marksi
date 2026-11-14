import { extractFrontMatter } from "./frontMatter";
import {
  collectFencedCodeRanges,
  collectInlineCodeRanges,
  isIgnored,
} from "./textRanges";

export interface FootnoteReference {
  label: string;
  from: number;
  to: number;
}

export interface FootnoteDefinition {
  label: string;
  /** One-based source line of the definition marker. */
  line: number;
  /** One-based source line of the last content line. */
  endLine: number;
  /** Start of the `[^label]` marker. */
  from: number;
  /** End of the `]:` marker, exclusive. */
  markerTo: number;
  /** End of the definition block, excluding the trailing newline. */
  to: number;
}

export interface FootnoteScan {
  references: FootnoteReference[];
  definitions: FootnoteDefinition[];
}

interface SourceLine {
  number: number;
  /** Offset of the first character. */
  start: number;
  /** Offset after the last character, excluding the line break. */
  end: number;
  text: string;
}

const definitionLine = /^ {0,3}\[\^[^\]\n]+\]:/;
const blockStart = /^ {0,3}(?:#{1,6}(?:\s|$)|[-+*](?:\s|$)|\d{1,9}[.)](?:\s|$)|>|`{3,}|~{3,}|(?:-{3,}|\*{3,}|_{3,})\s*$)/;

/** Footnote labels are matched case-insensitively after trimming. */
export function normalizeFootnoteLabel(label: string): string {
  return label.trim().toLowerCase();
}

function sourceLines(source: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let start = 0;
  let number = 1;
  while (start <= source.length) {
    let lineBreak = source.indexOf("\n", start);
    if (lineBreak < 0) {
      lineBreak = source.length;
    }
    const text = source.slice(start, lineBreak).replace(/\r$/, "");
    lines.push({ number, start, end: start + text.length, text });
    if (lineBreak === source.length) {
      break;
    }
    start = lineBreak + 1;
    number += 1;
  }
  return lines;
}

/**
 * Finds the last line consumed by a definition. Unindented lines immediately
 * after the marker are lazy continuations; after a blank line, continuation
 * requires four spaces or a tab. New blocks and definitions end the range.
 */
function definitionEnd(lines: SourceLine[], index: number): number {
  let end = index;
  let cursor = index + 1;
  while (cursor < lines.length) {
    const text = lines[cursor].text;
    if (!text.trim()) {
      let next = cursor + 1;
      while (next < lines.length && !lines[next].text.trim()) {
        next += 1;
      }
      if (next >= lines.length || !/^(?: {4}|\t)/.test(lines[next].text)) {
        break;
      }
      end = next;
      cursor = next + 1;
      continue;
    }
    if (definitionLine.test(text) || blockStart.test(text)) {
      break;
    }
    end = cursor;
    cursor += 1;
  }
  return end;
}

/**
 * Scans footnote references and definitions outside YAML front matter, fenced
 * code, and inline code. Definitions must start a line with at most three
 * leading spaces; duplicate labels keep the first definition.
 */
export function scanFootnotes(source: string): FootnoteScan {
  const frontMatter = extractFrontMatter(source);
  const frontMatterEnd = frontMatter?.block.length ?? 0;
  const fenced = collectFencedCodeRanges(source);
  const inline = collectInlineCodeRanges(source, fenced);
  const definitions = new Map<string, FootnoteDefinition>();
  const references: FootnoteReference[] = [];
  const lines = sourceLines(source);
  const pattern = /\[\^([^\]\n]+)\]/g;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.start < frontMatterEnd || isIgnored(fenced, line.start)) {
      continue;
    }
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(line.text))) {
      const from = line.start + match.index;
      const to = from + match[0].length;
      if (isIgnored(inline, from)) {
        continue;
      }
      const label = normalizeFootnoteLabel(match[1]);
      if (!label) {
        continue;
      }
      const before = line.text.slice(0, match.index);
      const after = line.text[match.index + match[0].length];
      if (after === ":" && /^ {0,3}$/.test(before)) {
        if (!definitions.has(label)) {
          const last = lines[definitionEnd(lines, index)];
          definitions.set(label, {
            label,
            line: line.number,
            endLine: last.number,
            from,
            markerTo: to + 1,
            to: last.end,
          });
        }
        continue;
      }
      references.push({ label, from, to });
    }
  }

  return {
    references,
    definitions: [...definitions.values()],
  };
}
