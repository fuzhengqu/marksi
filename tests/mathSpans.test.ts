import { describe, expect, it } from "vitest";
import {
  MATH_PREVIEW_MAX_CHARS,
  MATH_PREVIEW_MAX_SPANS,
  findMathSpans,
  mathPreviewLimit,
} from "../src/lib/mathSpans";

describe("mathPreviewLimit", () => {
  it("allows math widgets for ordinary documents", () => {
    expect(mathPreviewLimit(0)).toBe(MATH_PREVIEW_MAX_SPANS);
    expect(mathPreviewLimit(MATH_PREVIEW_MAX_CHARS)).toBe(
      MATH_PREVIEW_MAX_SPANS,
    );
  });

  it("falls back to source for very large documents", () => {
    expect(mathPreviewLimit(MATH_PREVIEW_MAX_CHARS + 1)).toBe(0);
  });
});

describe("findMathSpans", () => {
  it("finds inline math and keeps the content without delimiters", () => {
    expect(findMathSpans("Energy is $E = mc^2$ today.")).toEqual([
      { from: 10, to: 20, content: "E = mc^2", display: false },
    ]);
  });

  it("finds multiple inline spans", () => {
    expect(findMathSpans("$a$ and $b$")).toEqual([
      { from: 0, to: 3, content: "a", display: false },
      { from: 8, to: 11, content: "b", display: false },
    ]);
  });

  it("finds single-line and multi-line display math", () => {
    expect(findMathSpans("Before\n$$x + y$$\nAfter")).toEqual([
      { from: 7, to: 16, content: "x + y", display: true },
    ]);
    expect(findMathSpans("$$\na + b\n$$")).toEqual([
      { from: 0, to: 11, content: "\na + b\n", display: true },
    ]);
  });

  it("ignores math inside fenced and inline code", () => {
    expect(findMathSpans("```\n$x$\n```\n")).toEqual([]);
    expect(findMathSpans("Use `$x$` literally.")).toEqual([]);
  });

  it("ignores escaped dollars and currency amounts", () => {
    expect(findMathSpans("\\$x$")).toEqual([]);
    expect(findMathSpans("$5 and $10")).toEqual([]);
    expect(findMathSpans("Costs $5,000 and $6,000.")).toEqual([]);
  });

  it("requires non-empty content without edge whitespace", () => {
    expect(findMathSpans("$ x $")).toEqual([]);
    expect(findMathSpans("$$$$")).toEqual([]);
    expect(findMathSpans("$$  $$")).toEqual([]);
  });

  it("skips front matter and caller-supplied ranges", () => {
    const source = "---\ntitle: $x$\n---\nBody $y$";
    expect(findMathSpans(source)).toEqual([
      { from: 24, to: 27, content: "y", display: false },
    ]);
    expect(
      findMathSpans("See [docs](https://example.com/$x$).", [
        { start: 11, end: 34 },
      ]),
    ).toEqual([]);
  });
});
