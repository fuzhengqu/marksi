import { describe, expect, it } from "vitest";
import {
  normalizeFootnoteLabel,
  scanFootnotes,
} from "../src/lib/footnotes";

describe("normalizeFootnoteLabel", () => {
  it("trims and lowercases labels", () => {
    expect(normalizeFootnoteLabel("  Note ")).toBe("note");
  });
});

describe("scanFootnotes", () => {
  it("finds references and definitions with source offsets", () => {
    const source = [
      "# Notes",
      "",
      "Text[^1] and [^note].",
      "",
      "[^1]: First footnote.",
      "[^note]: Second footnote.",
    ].join("\n");

    const scan = scanFootnotes(source);
    expect(scan.references.map((reference) => reference.label)).toEqual([
      "1",
      "note",
    ]);
    expect(source.slice(scan.references[0].from, scan.references[0].to)).toBe(
      "[^1]",
    );
    expect(scan.definitions).toEqual([
      { label: "1", line: 5, from: source.indexOf("[^1]:") },
      { label: "note", line: 6, from: source.indexOf("[^note]:") },
    ]);
  });

  it("matches labels case-insensitively and keeps the first definition", () => {
    const source = [
      "Text[^Note].",
      "",
      "[^note]: First.",
      "[^NOTE]: Second.",
    ].join("\n");

    const scan = scanFootnotes(source);
    expect(scan.references[0].label).toBe("note");
    expect(scan.definitions).toEqual([
      { label: "note", line: 3, from: source.indexOf("[^note]:") },
    ]);
  });

  it("ignores front matter, fenced code, and inline code", () => {
    const source = [
      "---",
      "note: [^front]",
      "---",
      "",
      "`[^inline]` and [^real].",
      "",
      "```md",
      "[^fenced]: Not a definition",
      "```",
      "",
      "[^real]: Real definition.",
    ].join("\n");

    const scan = scanFootnotes(source);
    expect(scan.references).toEqual([
      {
        label: "real",
        from: source.indexOf("[^real]."),
        to: source.indexOf("[^real].") + "[^real]".length,
      },
    ]);
    expect(scan.definitions).toEqual([
      { label: "real", line: 11, from: source.indexOf("[^real]:") },
    ]);
  });

  it("accepts up to three leading spaces on definitions", () => {
    const source = [
      "Text[^a].",
      "   [^a]: Three spaces.",
      "    [^b]: Four spaces is code.",
    ].join("\n");

    const scan = scanFootnotes(source);
    expect(scan.definitions).toEqual([
      { label: "a", line: 2, from: source.indexOf("[^a]:") },
    ]);
    expect(scan.references.map((reference) => reference.label)).toEqual([
      "a",
      "b",
    ]);
  });
});
