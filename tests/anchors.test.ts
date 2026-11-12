import { describe, expect, it } from "vitest";
import { headingAnchors } from "../src/lib/markdown";

describe("headingAnchors", () => {
  it("returns ATX and Setext heading lines with reading-view IDs", () => {
    const source = [
      "# Intro",
      "",
      "## Intro",
      "",
      "Setext One",
      "==========",
      "",
      "Setext Two",
      "----------",
      "",
      "## **Bold** `code` [link](https://example.com)",
    ].join("\n");

    expect(headingAnchors(source)).toEqual([
      { id: "intro", line: 1 },
      { id: "intro-1", line: 3 },
      { id: "setext-one", line: 5 },
      { id: "setext-two", line: 8 },
      { id: "bold-code-link", line: 11 },
    ]);
  });

  it("ignores front matter, fenced code, and heading-like code lines", () => {
    const source = [
      "---",
      "title: Intentional",
      "---",
      "",
      "```md",
      "# Not a heading",
      "```",
      "",
      "# Real",
    ].join("\n");

    expect(headingAnchors(source)).toEqual([{ id: "real", line: 9 }]);
  });

  it("handles compact headings when strict mode is disabled", () => {
    expect(headingAnchors("#Compact", true)).toEqual([]);
    expect(headingAnchors("#Compact", false)).toEqual([
      { id: "compact", line: 1 },
    ]);
  });
});
