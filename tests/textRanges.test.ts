import { describe, expect, it } from "vitest";
import {
  collectFencedCodeBlocks,
  collectFencedCodeRanges,
  collectInlineCodeRanges,
  isEscaped,
  isIgnored,
  mergeRanges,
} from "../src/lib/textRanges";

describe("mergeRanges and isIgnored", () => {
  it("merges overlapping and adjacent ranges", () => {
    expect(
      mergeRanges([
        { start: 5, end: 9 },
        { start: 1, end: 4 },
        { start: 3, end: 6 },
        { start: 10, end: 12 },
      ]),
    ).toEqual([
      { start: 1, end: 9 },
      { start: 10, end: 12 },
    ]);
  });

  it("reports only offsets inside a merged range", () => {
    const ranges = mergeRanges([
      { start: 2, end: 5 },
      { start: 8, end: 10 },
    ]);
    expect(isIgnored(ranges, 1)).toBe(false);
    expect(isIgnored(ranges, 2)).toBe(true);
    expect(isIgnored(ranges, 4)).toBe(true);
    expect(isIgnored(ranges, 5)).toBe(false);
    expect(isIgnored(ranges, 9)).toBe(true);
    expect(isIgnored(ranges, 10)).toBe(false);
  });
});

describe("isEscaped", () => {
  it("counts preceding backslashes", () => {
    expect(isEscaped("$x$", 0)).toBe(false);
    expect(isEscaped("\\$x$", 1)).toBe(true);
    expect(isEscaped("\\\\$x$", 2)).toBe(false);
  });
});

describe("collectFencedCodeBlocks", () => {
  it("returns line ranges, info strings, and content offsets", () => {
    const source = "Before\n```ts title\na\nb\n```\nAfter";
    expect(collectFencedCodeBlocks(source)).toEqual([
      {
        start: 7,
        end: 26,
        contentStart: 19,
        contentEnd: 23,
        info: "ts title",
      },
    ]);
    expect(source.slice(19, 23)).toBe("a\nb\n");
  });

  it("supports tilde fences and longer closing fences", () => {
    const source = "~~~~mermaid\ngraph TD\n~~~~~";
    expect(collectFencedCodeBlocks(source)).toEqual([
      {
        start: 0,
        end: source.length,
        contentStart: 12,
        contentEnd: 21,
        info: "mermaid",
      },
    ]);
    expect(source.slice(12, 21)).toBe("graph TD\n");
  });

  it("extends an unclosed fence to the end of the source", () => {
    const source = "```mermaid\ngraph TD";
    expect(collectFencedCodeBlocks(source)).toEqual([
      {
        start: 0,
        end: source.length,
        contentStart: 11,
        contentEnd: source.length,
        info: "mermaid",
      },
    ]);
  });

  it("keeps CRLF content offsets on the original source", () => {
    const source = "```mermaid\r\ngraph TD\r\n```";
    const [block] = collectFencedCodeBlocks(source);
    expect(block.contentStart).toBe(12);
    expect(block.contentEnd).toBe(22);
    expect(source.slice(block.contentStart, block.contentEnd)).toBe(
      "graph TD\r\n",
    );
  });

  it("matches the range-only helper", () => {
    const source = "```\na\n```\n\n~~~\nb\n~~~";
    expect(collectFencedCodeRanges(source)).toEqual(
      collectFencedCodeBlocks(source).map(({ start, end }) => ({ start, end })),
    );
  });
});

describe("collectInlineCodeRanges", () => {
  it("skips fences and pairs equal-length backtick runs", () => {
    const source = "`a` and ``b ` c``\n```\n`ignored`\n```\n";
    const fenced = collectFencedCodeRanges(source);
    expect(collectInlineCodeRanges(source, fenced)).toEqual([
      { start: 0, end: 3 },
      { start: 8, end: 17 },
    ]);
  });
});
