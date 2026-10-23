import { describe, expect, it } from "vitest";
import MarkdownIt from "markdown-it";
import {
  normalizeLaxHeadings,
  normalizeLaxLists,
  normalizeLaxMarkdown,
} from "../src/lib/strictMarkdown";

function levels(source: string): number[] {
  return new MarkdownIt()
    .parse(source, {})
    .filter((token) => token.type === "list_item_open")
    .map((token) => token.level);
}

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

describe("normalizeLaxLists", () => {
  it("pads under-indented ordered child items to the parent content indent", () => {
    expect(normalizeLaxLists("10. aaa\n  1. ccc")).toBe(
      "10. aaa\n    1. ccc",
    );
    expect(normalizeLaxLists("10. aaa\n 1. ccc")).toBe(
      "10. aaa\n    1. ccc",
    );
    const alreadyNested = `10. aaa\n${" ".repeat(4)}1. ccc`;
    expect(normalizeLaxLists(alreadyNested)).toBe(alreadyNested);
  });

  it("pads unordered and mixed child items", () => {
    expect(normalizeLaxLists("- aaa\n - bbb")).toBe("- aaa\n  - bbb");
    expect(normalizeLaxLists("10. aaa\n   - bbb")).toBe(
      "10. aaa\n    - bbb",
    );
    expect(normalizeLaxLists("1. aaa\n  - bbb")).toBe(
      "1. aaa\n   - bbb",
    );
  });

  it("pads under-indented continuation text", () => {
    expect(normalizeLaxLists("10. aaa\n   bbb")).toBe(
      "10. aaa\n    bbb",
    );
    expect(normalizeLaxLists("1. aaa\n\n  bbb")).toBe(
      "1. aaa\n\n   bbb",
    );
    const source = ["1. aaa", "  bbb", "10. ccc", "   ddd"].join("\n");
    expect(normalizeLaxLists(source)).toBe(
      ["1. aaa", "   bbb", "10. ccc", "    ddd"].join("\n"),
    );
    expect(normalizeLaxLists("1. aaa\n\nbbb")).toBe("1. aaa\n\nbbb");
    expect(normalizeLaxLists("1. aaa\n\n    indented")).toBe(
      "1. aaa\n\n    indented",
    );
  });

  it("normalizes after blank lines and handles nested groups", () => {
    const source = [
      "10. a",
      "  1. b",
      "  2. c",
      "    - d",
    ].join("\n");
    expect(normalizeLaxLists(source)).toBe(
      ["10. a", "    1. b", "    2. c", "       - d"].join("\n"),
    );
    expect(normalizeLaxLists("10. aaa\n\n  1. ccc")).toBe(
      "10. aaa\n\n    1. ccc",
    );
    expect(normalizeLaxLists("1. aaa\n\n  2. ccc")).toBe(
      "1. aaa\n\n   2. ccc",
    );
  });

  it("does not touch fences, front matter, or indented code", () => {
    const source = [
      "---",
      "list: - fake",
      "---",
      "",
      "```md",
      "10. aaa",
      " 1. bbb",
      "```",
      "",
      "    - indented",
    ].join("\n");
    expect(normalizeLaxLists(source)).toBe(source);
  });

  it("normalizes list markers and continuations inside quotes", () => {
    expect(normalizeLaxLists("> 10. quote\n>  1. child")).toBe(
      "> 10. quote\n>     1. child",
    );
    expect(normalizeLaxLists("> 10. quote\n>   bbb")).toBe(
      "> 10. quote\n>     bbb",
    );
    expect(
      normalizeLaxLists("> > 10. quote\n> >   1. child"),
    ).toBe("> > 10. quote\n> >     1. child");
    const fenced = "> ```md\n> 10. aaa\n>  1. bbb\n> ```";
    expect(normalizeLaxLists(fenced)).toBe(fenced);
  });

  it("does not normalize an ordered child that cannot interrupt a paragraph", () => {
    expect(normalizeLaxLists("10. aaa\n  2. ccc")).toBe(
      "10. aaa\n  2. ccc",
    );
    expect(normalizeLaxLists("paragraph\n  2. ccc")).toBe(
      "paragraph\n  2. ccc",
    );
  });

  it("preserves CRLF while padding child list markers", () => {
    expect(normalizeLaxLists("10. aaa\r\n  1. ccc")).toBe(
      "10. aaa\r\n    1. ccc",
    );
    expect(normalizeLaxLists("> 10. aaa\r\n>  1. ccc")).toBe(
      "> 10. aaa\r\n>     1. ccc",
    );
  });

  it("is idempotent", () => {
    const source = "10. a\n  1. b\n    - c\n  continuation\n\n> 10. q\n>  1. c";
    const once = normalizeLaxMarkdown(source);
    expect(normalizeLaxMarkdown(once)).toBe(once);
  });
});

describe("normalizeLaxMarkdown", () => {
  it("combines compact headings and lax lists", () => {
    const source = "###Project\n\n10. aaa\n  1. ccc";
    const normalized = normalizeLaxMarkdown(source);
    expect(normalized).toBe("### Project\n\n10. aaa\n    1. ccc");
    expect(levels(normalized)).toEqual([1, 3]);
  });

  it("nests quoted lists and under-indented continuations", () => {
    const quoted = "> 10. quote\n>  1. child";
    const html = new MarkdownIt().render(normalizeLaxMarkdown(quoted));
    expect(html).toContain("<blockquote>");
    expect((html.match(/<ol/g) ?? []).length).toBe(2);

    const continuation = "10. parent\n   continuation";
    expect(new MarkdownIt().render(normalizeLaxMarkdown(continuation))).toContain(
      "continuation",
    );
  });

  it("changes render structure while keeping code fences literal", () => {
    const lax = "10. aaa\n  1. ccc";
    expect(levels(lax)).toEqual([1, 1]);
    expect(levels(normalizeLaxMarkdown(lax))).toEqual([1, 3]);

    const fenced = "```md\n10. aaa\n  1. ccc\n```";
    expect(normalizeLaxMarkdown(fenced)).toBe(fenced);
  });
});
