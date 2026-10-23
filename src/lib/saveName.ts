import { stripInlineMarkdown } from "../editor/analyze";
import { extractFrontMatter } from "./frontMatter";

const MARKDOWN_EXTENSION = /\.(?:md|markdown|mdown|mkd|mdwn|mmd|txt)$/i;
const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const MAX_STEM_LENGTH = 120;

function headingText(value: string): string {
  return stripInlineMarkdown(value).replace(/\s+/g, " ").trim();
}

/**
 * Finds the first level-one heading in the document body. ATX headings
 * (`# Title`) and setext headings (`Title` followed by `===`) are supported.
 * Fenced code and YAML front matter are ignored because they are not rendered
 * as document headings.
 */
export function firstLevelHeading(markdown: string): string | null {
  const source = markdown.replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "");
  const frontMatter = extractFrontMatter(source);
  const body = frontMatter ? source.slice(frontMatter.block.length) : source;
  const lines = body.split("\n");
  let fence: { character: string; length: number } | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (fence) {
      const closing = new RegExp(
        `^ {0,3}\\${fence.character}{${fence.length},}[ \\t]*$`,
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

    const atx = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/.exec(line);
    if (atx) {
      if (atx[1].length === 1) {
        const raw = (atx[2] ?? "").replace(/[ \t]+#+[ \t]*$/, "");
        const text = headingText(raw);
        if (text) {
          return text;
        }
      }
      continue;
    }

    if (
      index + 1 < lines.length &&
      /^ {0,3}\S/.test(line) &&
      /^ {0,3}=+[ \t]*$/.test(lines[index + 1])
    ) {
      const candidate = line.replace(/^ {0,3}/, "").trim();
      if (
        candidate &&
        !/^(?:[>#]|[-+*]\s|\d+[.)]\s)/.test(candidate)
      ) {
        const text = headingText(candidate);
        if (text) {
          return text;
        }
      }
    }
  }

  return null;
}

/**
 * Makes a title safe as a cross-platform filename stem. Invalid path
 * characters become spaces, Windows device names are prefixed, and the stem is
 * bounded so the resulting filename stays practical in a save dialog.
 */
export function sanitizeFileStem(title: string): string {
  const cleaned = title
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .trim();
  const bounded = Array.from(cleaned)
    .slice(0, MAX_STEM_LENGTH)
    .join("")
    .trim();
  if (!bounded) {
    return "";
  }

  const stem = bounded.replace(/\.[^.]+$/, "");
  if (WINDOWS_RESERVED_NAME.test(stem)) {
    return `_${bounded}`;
  }
  return bounded;
}

export function defaultSaveName(
  markdown: string,
  fallbackName: string,
): string {
  const heading = firstLevelHeading(markdown);
  const stem = heading ? sanitizeFileStem(heading) : "";
  if (!stem) {
    return fallbackName;
  }
  return MARKDOWN_EXTENSION.test(stem) ? stem : `${stem}.md`;
}

export function resolveSaveName(
  markdown: string,
  currentName: string,
  currentPath: string | null,
): string {
  return currentPath ? currentName : defaultSaveName(markdown, currentName);
}
