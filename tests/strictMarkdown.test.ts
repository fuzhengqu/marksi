import { describe, expect, it } from "vitest";
import { normalizeLaxHeadings } from "../src/lib/strictMarkdown";

describe("normalizeLaxHeadings", () => {
  it("adds the missing ATX heading space", () => {
    expect(normalizeLaxHeadings("###Project\n\nBody")).toBe(
      "### Project\n\nBody",
    );
    expect(normalizeLaxHeadings("#标题")).toBe("# 标题");
  });

  it("leaves strict headings and non-heading markers unchanged", () => {
    const source = ["# Title", "#hashtag", "\\#escaped", "  ##Nested?"].join(
      "\n",
    );
    expect(normalizeLaxHeadings(source)).toBe(
      ["# Title", "# hashtag", "\\#escaped", "  ## Nested?"].join("\n"),
    );
  });

  it("does not touch fenced code, front matter, or indented code", () => {
    const source = [
      "---",
      "title: #NotAHeading",
      "---",
      "",
      "```md",
      "###InsideFence",
      "```",
      "",
      "    ###IndentedCode",
    ].join("\n");
    expect(normalizeLaxHeadings(source)).toBe(source);
  });

  it("preserves CRLF line endings", () => {
    expect(normalizeLaxHeadings("###Header\r\nBody")).toBe(
      "### Header\r\nBody",
    );
  });
});
