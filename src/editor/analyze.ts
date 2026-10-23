import type { EditorState } from "@codemirror/state";
import type { CursorPosition, OutlineItem, TextStats } from "../types";

const CJK_RANGE =
  /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g;
const WORD_RANGE = /[A-Za-z0-9_]+(?:['’\-][A-Za-z0-9_]+)*/g;

export function stripInlineMarkdown(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~]{1,3}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\\([\\`*{}[\]()#+\-.!_>])/g, "$1")
    .trim();
}

export function extractOutline(markdown: string): OutlineItem[] {
  const lines = markdown.split(/\r?\n/);
  const outline: OutlineItem[] = [];
  let fence: { marker: string; length: number } | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);

    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      const length = fenceMatch[1].length;
      if (!fence) {
        fence = { marker, length };
      } else if (marker === fence.marker && length >= fence.length) {
        fence = null;
      }
      continue;
    }

    if (fence) {
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      outline.push({
        level: heading[1].length,
        text: stripInlineMarkdown(heading[2]),
        line: index + 1,
      });
    }
  }

  return outline;
}

export function getTextStats(text: string): TextStats {
  const normalized = text.replace(/\r\n/g, "\n");
  const chars = Array.from(normalized).length;
  const charsNoSpaces = Array.from(normalized.replace(/\s/g, "")).length;
  const lines = normalized.length === 0 ? 0 : normalized.split("\n").length;

  const cjkCount = normalized.match(CJK_RANGE)?.length ?? 0;
  const withoutCjk = normalized.replace(CJK_RANGE, " ");
  const latinCount = withoutCjk.match(WORD_RANGE)?.length ?? 0;

  return {
    words: cjkCount + latinCount,
    chars,
    charsNoSpaces,
    lines,
  };
}

export function getCursorPosition(state: EditorState): CursorPosition {
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  return {
    line: line.number,
    column: head - line.from + 1,
  };
}

export function lineRangeForMarkdownLine(state: EditorState, lineNumber: number) {
  const safeLine = Math.min(Math.max(1, lineNumber), state.doc.lines);
  const line = state.doc.line(safeLine);
  return { from: line.from, to: line.to };
}
