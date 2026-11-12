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
  /** One-based source line of the definition. */
  line: number;
  from: number;
}

export interface FootnoteScan {
  references: FootnoteReference[];
  definitions: FootnoteDefinition[];
}

/** Footnote labels are matched case-insensitively after trimming. */
export function normalizeFootnoteLabel(label: string): string {
  return label.trim().toLowerCase();
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
  const pattern = /\[\^([^\]\n]+)\]/g;
  let lineStart = 0;
  let lineNumber = 1;

  while (lineStart <= source.length) {
    let lineEnd = source.indexOf("\n", lineStart);
    if (lineEnd < 0) {
      lineEnd = source.length;
    }
    const line = source.slice(lineStart, lineEnd).replace(/\r$/, "");
    if (
      lineStart >= frontMatterEnd &&
      !isIgnored(fenced, lineStart)
    ) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(line))) {
        const from = lineStart + match.index;
        const to = from + match[0].length;
        if (isIgnored(inline, from)) {
          continue;
        }
        const label = normalizeFootnoteLabel(match[1]);
        if (!label) {
          continue;
        }
        const before = line.slice(0, match.index);
        const after = line[match.index + match[0].length];
        if (after === ":" && /^ {0,3}$/.test(before)) {
          if (!definitions.has(label)) {
            definitions.set(label, { label, line: lineNumber, from });
          }
          continue;
        }
        references.push({ label, from, to });
      }
    }

    if (lineEnd === source.length) {
      break;
    }
    lineStart = lineEnd + 1;
    lineNumber += 1;
  }

  return {
    references,
    definitions: [...definitions.values()],
  };
}
