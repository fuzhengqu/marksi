import { fenceLanguageLabel } from "./blocks";
import { extractFrontMatter } from "./frontMatter";
import { collectFencedCodeBlocks } from "./textRanges";

/** Documents larger than this keep Mermaid source visible to protect typing. */
export const MERMAID_PREVIEW_MAX_CHARS = 300_000;

/** Upper bound on rendered Mermaid diagrams in one editor state. */
export const MERMAID_PREVIEW_MAX_DIAGRAMS = 20;

export interface MermaidBlock {
  /** Start of the opening fence line. */
  from: number;
  /** End of the closing fence line. */
  to: number;
  /** Diagram source without the surrounding fences. */
  content: string;
}

/**
 * Returns how many Mermaid widgets may render for a document of the given
 * length. Large documents fall back to source so decoration rebuilds stay
 * bounded.
 */
export function mermaidPreviewLimit(documentLength: number): number {
  return documentLength > MERMAID_PREVIEW_MAX_CHARS
    ? 0
    : MERMAID_PREVIEW_MAX_DIAGRAMS;
}

/**
 * Returns true when a fenced-code info string selects Mermaid. The first token
 * is used, so titles and attribute-only info strings such as `{.mermaid}` are
 * accepted while `mermaidjs` and other languages are not.
 */
export function isMermaidFenceInfo(info: string): boolean {
  return fenceLanguageLabel(info).toLowerCase() === "mermaid";
}

/**
 * Finds top-level Mermaid fenced blocks outside YAML front matter. The scanner
 * accepts up to three leading spaces like CommonMark fences, so diagrams inside
 * block quotes or list items keep their normal code-card source.
 */
export function findMermaidBlocks(source: string): MermaidBlock[] {
  const frontMatter = extractFrontMatter(source);
  const frontMatterEnd = frontMatter ? frontMatter.block.length : 0;
  const blocks: MermaidBlock[] = [];

  for (const fence of collectFencedCodeBlocks(source)) {
    if (fence.start < frontMatterEnd || !isMermaidFenceInfo(fence.info)) {
      continue;
    }
    const content = source
      .slice(fence.contentStart, fence.contentEnd)
      .replace(/\r\n/g, "\n");
    if (content.trim().length === 0) {
      continue;
    }
    blocks.push({ from: fence.start, to: fence.end, content });
  }

  return blocks;
}
