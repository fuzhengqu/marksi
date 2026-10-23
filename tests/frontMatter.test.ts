import { describe, expect, it } from "vitest";
import {
  extractFrontMatter,
  frontMatterTitle,
  parseFrontMatterMetadata,
} from "../src/lib/frontMatter";

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
