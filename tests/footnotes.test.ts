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
      {
        label: "1",
        line: 5,
        endLine: 5,
        from: source.indexOf("[^1]:"),
        markerTo: source.indexOf("[^1]:") + "[^1]:".length,
        to: source.indexOf("First footnote.") + "First footnote.".length,
      },
      {
        label: "note",
        line: 6,
        endLine: 6,
        from: source.indexOf("[^note]:"),
        markerTo: source.indexOf("[^note]:") + "[^note]:".length,
        to:
          source.indexOf("Second footnote.") +
          "Second footnote.".length,
      },
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
      {
        label: "note",
        line: 3,
        endLine: 3,
        from: source.indexOf("[^note]:"),
        markerTo: source.indexOf("[^note]:") + "[^note]:".length,
        to: source.indexOf("First.") + "First.".length,
      },
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
      {
        label: "real",
        line: 11,
        endLine: 11,
        from: source.indexOf("[^real]:"),
        markerTo: source.indexOf("[^real]:") + "[^real]:".length,
        to:
          source.indexOf("Real definition.") +
          "Real definition.".length,
      },
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
      {
        label: "a",
        line: 2,
        endLine: 3,
        from: source.indexOf("[^a]:"),
        markerTo: source.indexOf("[^a]:") + "[^a]:".length,
        to:
          source.indexOf("Four spaces is code.") +
          "Four spaces is code.".length,
      },
    ]);
    expect(scan.references.map((reference) => reference.label)).toEqual([
      "a",
      "b",
    ]);
  });

  it("includes lazy and blank-line-indented continuations", () => {
    const source = [
      "Text[^a].",
      "",
      "[^a]: First line.",
      "Lazy continuation.",
      "",
      "    Second paragraph.",
      "",
      "After.",
    ].join("\n");

    const scan = scanFootnotes(source);
    expect(scan.definitions).toEqual([
      {
        label: "a",
        line: 3,
        endLine: 6,
        from: source.indexOf("[^a]:"),
        markerTo: source.indexOf("[^a]:") + "[^a]:".length,
        to:
          source.indexOf("Second paragraph.") +
          "Second paragraph.".length,
      },
    ]);
  });

  it("stops at another definition or a new block", () => {
    const source = [
      "Text[^a][^b].",
      "",
      "[^a]: First.",
      "[^b]: Second.",
      "# Heading",
      "",
      "After.",
    ].join("\n");

    const scan = scanFootnotes(source);
    expect(scan.definitions).toEqual([
      {
        label: "a",
        line: 3,
        endLine: 3,
        from: source.indexOf("[^a]:"),
        markerTo: source.indexOf("[^a]:") + "[^a]:".length,
        to: source.indexOf("First.") + "First.".length,
      },
      {
        label: "b",
        line: 4,
        endLine: 4,
        from: source.indexOf("[^b]:"),
        markerTo: source.indexOf("[^b]:") + "[^b]:".length,
        to: source.indexOf("Second.") + "Second.".length,
      },
    ]);
  });
});
