import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import {
  extractOutline,
  getCursorPosition,
  getTextStats,
  stripInlineMarkdown,
} from "../src/editor/analyze";

describe("extractOutline", () => {
  it("finds ATX headings and ignores headings inside fenced code", () => {
    const markdown = [
      "# Title",
      "",
      "```md",
      "# Not a heading",
      "```",
      "",
      "## A **strong** section",
      "### `code`",
    ].join("\n");

    expect(extractOutline(markdown)).toEqual([
      { level: 1, text: "Title", line: 1 },
      { level: 2, text: "A strong section", line: 7 },
      { level: 3, text: "code", line: 8 },
    ]);
  });

  it("supports tilde fences and heading closing marks", () => {
    const markdown = ["~~~", "## hidden", "~~~", "## visible ##"].join("\n");
    expect(extractOutline(markdown)).toEqual([
      { level: 2, text: "visible", line: 4 },
    ]);
  });
});

describe("stripInlineMarkdown", () => {
  it("removes common inline markers without flattening the words", () => {
    expect(
      stripInlineMarkdown(
        "A [link](https://example.com), [reference][id], and `code` and **bold**",
      ),
    ).toBe("A link, reference, and code and bold");
  });
});

describe("getTextStats", () => {
  it("counts CJK characters and Latin words", () => {
    const stats = getTextStats("Hello world\n你好世界");
    expect(stats.words).toBe(6);
    expect(stats.lines).toBe(2);
    expect(stats.chars).toBeGreaterThan(0);
  });

  it("returns zero lines for an empty document", () => {
    expect(getTextStats("").lines).toBe(0);
    expect(getTextStats("").words).toBe(0);
  });
});

describe("getCursorPosition", () => {
  it("reports one-based line and column positions", () => {
    const state = EditorState.create({
      doc: "first\nsecond\nthird",
      selection: { anchor: 9 },
    });
    expect(getCursorPosition(state)).toEqual({ line: 2, column: 4 });
  });
});
