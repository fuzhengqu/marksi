import { describe, expect, it } from "vitest";
import {
  extractFrontMatter,
  frontMatterLineCount,
  frontMatterSummary,
  frontMatterTitle,
  parseFrontMatterMetadata,
} from "../src/lib/frontMatter";

function lineReader(source: string) {
  const lines = source.split(/\r?\n/);
  return (lineNumber: number) => lines[lineNumber - 1] ?? "";
}

describe("extractFrontMatter", () => {
  it("removes leading YAML metadata and keeps the Markdown body", () => {
    const source = [
      "---",
      "title: Extended Markdown",
      'author: "Ada Lovelace"',
      "tags: [markdown, notes]",
      "---",
      "",
      "# Body",
    ].join("\n");

    const frontMatter = extractFrontMatter(source);
    expect(frontMatter).not.toBeNull();
    expect(frontMatter?.lineCount).toBe(5);
    expect(frontMatter?.body).toBe("\n# Body");
    expect(frontMatter?.metadata).toEqual({
      author: "Ada Lovelace",
      tags: "[markdown, notes]",
      title: "Extended Markdown",
    });
  });

  it("supports CRLF and an empty metadata block", () => {
    const source = "---\r\n---\r\n# Title";
    const frontMatter = extractFrontMatter(source);

    expect(frontMatter?.lineCount).toBe(2);
    expect(frontMatter?.body).toBe("# Title");
    expect(frontMatter?.metadata).toEqual({});
  });

  it("does not treat an unclosed or non-leading delimiter as front matter", () => {
    expect(extractFrontMatter("---\ntitle: Never closed")).toBeNull();
    expect(extractFrontMatter("# Heading\n\n---\ntitle: Later")).toBeNull();
  });

  it("supports a dot closing delimiter", () => {
    const frontMatter = extractFrontMatter("---\ntitle: Dot\n...\nBody");
    expect(frontMatter?.metadata.title).toBe("Dot");
    expect(frontMatter?.body).toBe("Body");
  });
});

describe("frontMatterTitle", () => {
  it("returns a trimmed title or null", () => {
    expect(frontMatterTitle("---\ntitle:  Notes  \n---\nBody")).toBe("Notes");
    expect(frontMatterTitle("---\ntitle:   \n---\nBody")).toBeNull();
    expect(frontMatterTitle("# No front matter")).toBeNull();
  });
});

describe("parseFrontMatterMetadata", () => {
  it("keeps folded indented lines with their key", () => {
    expect(
      parseFrontMatterMetadata(
        ["description: First line", "  continues here", "draft: false"].join(
          "\n",
        ),
      ),
    ).toEqual({
      draft: "false",
      description: "First line continues here",
    });
  });

  it("ignores comments and blank lines", () => {
    expect(
      parseFrontMatterMetadata("# comment\n\ntitle: 'A title'"),
    ).toEqual({ title: "A title" });
  });
});

describe("frontMatterLineCount", () => {
  it("returns the closing delimiter line of a leading block", () => {
    const source = ["---", "title: Notes", "tags: [a]", "---", "Body"].join(
      "\n",
    );
    expect(frontMatterLineCount(5, lineReader(source))).toBe(4);
  });

  it("accepts a BOM, CRLF input, and a dot closing delimiter", () => {
    const source = "\uFEFF---\r\ntitle: Notes\r\n...\r\nBody";
    expect(frontMatterLineCount(4, lineReader(source))).toBe(3);
  });

  it("accepts trailing spaces on delimiters", () => {
    const source = ["---   ", "title: Notes", "---\t", "Body"].join("\n");
    expect(frontMatterLineCount(4, lineReader(source))).toBe(3);
  });

  it("rejects blocks that do not start at the first line or never close", () => {
    expect(frontMatterLineCount(3, lineReader("# Body\n---\ntitle: x"))).toBe(
      0,
    );
    expect(frontMatterLineCount(3, lineReader("---\ntitle: x\nBody"))).toBe(0);
    expect(frontMatterLineCount(1, lineReader("---"))).toBe(0);
    expect(frontMatterLineCount(0, lineReader(""))).toBe(0);
  });

  it("stops at the first closing delimiter", () => {
    const source = ["---", "---", "---", "Body"].join("\n");
    expect(frontMatterLineCount(4, lineReader(source))).toBe(2);
  });

  it("requires a bare delimiter line", () => {
    expect(
      frontMatterLineCount(3, lineReader("---\ntitle: x\n--- trailing")),
    ).toBe(0);
  });
});

describe("frontMatterSummary", () => {
  const source = [
    "---",
    "title: Notes",
    "author: Ada",
    "tags: [markdown]",
    "empty:",
    "---",
    "Body",
  ].join("\n");

  it("lists non-empty metadata in source order", () => {
    expect(frontMatterSummary(source)).toEqual([
      { key: "title", value: "Notes" },
      { key: "author", value: "Ada" },
      { key: "tags", value: "[markdown]" },
    ]);
  });

  it("caps entries and returns nothing without front matter", () => {
    expect(frontMatterSummary(source, 2)).toEqual([
      { key: "title", value: "Notes" },
      { key: "author", value: "Ada" },
    ]);
    expect(frontMatterSummary(source, 0)).toEqual([]);
    expect(frontMatterSummary("# Body")).toEqual([]);
  });
});
