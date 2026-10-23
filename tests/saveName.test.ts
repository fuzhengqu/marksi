import { describe, expect, it } from "vitest";
import {
  defaultSaveName,
  firstLevelHeading,
  resolveSaveName,
  sanitizeFileStem,
} from "../src/lib/saveName";

describe("firstLevelHeading", () => {
  it("finds the first level-one ATX heading, not a level-two heading", () => {
    expect(firstLevelHeading("## Section\n\n# Project title\n\n# Later")).toBe(
      "Project title",
    );
  });

  it("strips inline Markdown and optional closing hashes from the heading", () => {
    expect(
      firstLevelHeading("# **Release** [notes](https://example.com) `v1` ###"),
    ).toBe("Release notes v1");
    expect(firstLevelHeading("# Title#")).toBe("Title#");
  });

  it("supports setext level-one headings", () => {
    expect(firstLevelHeading("Project title\n===\n\nBody")).toBe(
      "Project title",
    );
    expect(firstLevelHeading("Project title\n---\n\nBody")).toBeNull();
  });

  it("ignores YAML front matter, fenced code, and indented code", () => {
    const source = [
      "---",
      "# metadata",
      "---",
      "",
      "```markdown",
      "# code example",
      "```",
      "",
      "    # indented code",
      "",
      "# Real title",
    ].join("\n");
    expect(firstLevelHeading(source)).toBe("Real title");
  });

  it("ignores headings inside blockquotes and lists", () => {
    expect(firstLevelHeading("> # quoted\n\n- # listed\n\n## Subheading")).toBe(
      null,
    );
  });

  it("continues after an empty level-one heading", () => {
    expect(firstLevelHeading("#\n\n# Actual title")).toBe("Actual title");
  });
});

describe("sanitizeFileStem", () => {
  it("replaces invalid filename characters", () => {
    expect(sanitizeFileStem('Roadmap: "Q4" / draft?')).toBe(
      "Roadmap Q4 draft",
    );
  });

  it("removes leading and trailing dots and whitespace", () => {
    expect(sanitizeFileStem("  .notes.  ")).toBe("notes");
    expect(sanitizeFileStem("...")).toBe("");
  });

  it("prefixes Windows reserved device names", () => {
    expect(sanitizeFileStem("CON")).toBe("_CON");
    expect(sanitizeFileStem("LPT1")).toBe("_LPT1");
    expect(sanitizeFileStem("console")).toBe("console");
  });

  it("bounds very long titles", () => {
    expect(Array.from(sanitizeFileStem("x".repeat(300)))).toHaveLength(120);
  });
});

describe("defaultSaveName", () => {
  it("uses the first level-one heading with a Markdown extension", () => {
    expect(defaultSaveName("# 项目计划\n\n正文", "未命名.md")).toBe(
      "项目计划.md",
    );
  });

  it("preserves an extension already present in the heading", () => {
    expect(defaultSaveName("# README.md", "未命名.md")).toBe("README.md");
    expect(defaultSaveName("# notes.markdown", "未命名.md")).toBe(
      "notes.markdown",
    );
  });

  it("falls back to the existing untitled name when there is no H1", () => {
    expect(defaultSaveName("## Only a subheading\n\nText", "未命名.md")).toBe(
      "未命名.md",
    );
    expect(defaultSaveName("Text only", "Untitled.md")).toBe("Untitled.md");
  });

  it("falls back when the heading has no usable filename characters", () => {
    expect(defaultSaveName("# ???", "未命名.md")).toBe("未命名.md");
  });
});

describe("resolveSaveName", () => {
  it("uses the heading for a new document", () => {
    expect(resolveSaveName("# New title", "未命名.md", null)).toBe(
      "New title.md",
    );
  });

  it("keeps the current filename for an existing document", () => {
    expect(resolveSaveName("# New title", "old.md", "C:\\docs\\old.md")).toBe(
      "old.md",
    );
  });
});
