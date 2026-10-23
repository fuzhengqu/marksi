import { describe, expect, it } from "vitest";
import {
  expandCommandArguments,
  parentDirectory,
  parseCommandArguments,
} from "../src/lib/customExport";

describe("parseCommandArguments", () => {
  it("keeps one trimmed argument per non-empty line", () => {
    expect(
      parseCommandArguments(" {input}\n\n-o\n  {input}.pdf \r\n"),
    ).toEqual(["{input}", "-o", "{input}.pdf"]);
    expect(parseCommandArguments("   \n\n")).toEqual([]);
  });
});

describe("expandCommandArguments", () => {
  const values = {
    input: "D:\\docs\\note.html",
    document: "D:\\docs\\note.md",
    title: "A note",
  };

  it("replaces all supported placeholders without splitting", () => {
    expect(
      expandCommandArguments(
        ["{input}", "--title={title}", "{document}", "literal"],
        values,
      ),
    ).toEqual([
      "D:\\docs\\note.html",
      "--title=A note",
      "D:\\docs\\note.md",
      "literal",
    ]);
  });

  it("leaves unknown placeholders alone", () => {
    expect(expandCommandArguments(["{output}"], values)).toEqual([
      "{output}",
    ]);
  });
});

describe("parentDirectory", () => {
  it("handles Windows, POSIX, and relative paths", () => {
    expect(parentDirectory("D:\\docs\\note.html")).toBe("D:\\docs");
    expect(parentDirectory("D:\\note.html")).toBe("D:\\");
    expect(parentDirectory("/docs/note.html")).toBe("/docs");
    expect(parentDirectory("/note.html")).toBe("/");
    expect(parentDirectory("docs/note.html")).toBe("docs");
    expect(parentDirectory("note.html")).toBeNull();
  });
});
