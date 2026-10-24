import { describe, expect, it } from "vitest";
import {
  copyName,
  isSupportedTextFile,
  normalizeRelativeFolder,
  relativeFolder,
  sameFilePath,
  validateFileName,
} from "../src/lib/fileOps";

describe("file operations", () => {
  it("accepts supported text files and rejects other extensions", () => {
    expect(isSupportedTextFile("note.md")).toBe(true);
    expect(isSupportedTextFile("NOTE.MARKDOWN")).toBe(true);
    expect(isSupportedTextFile("note.txt")).toBe(true);
    expect(isSupportedTextFile("image.png")).toBe(false);
    expect(isSupportedTextFile("note")).toBe(false);
    expect(isSupportedTextFile(".md")).toBe(false);
  });

  it("validates names with the same rules as the Rust command", () => {
    expect(validateFileName("note.md")).toBeNull();
    expect(validateFileName("  笔记 2.md  ")).toBeNull();
    expect(validateFileName("")).toContain("Enter");
    expect(validateFileName("..")).toContain("Enter");
    expect(validateFileName("a/b.md")).toContain("/");
    expect(validateFileName("bad:name.md")).toContain("<");
    expect(validateFileName("image.png")).toContain("extension");
    expect(validateFileName("name.md.")).toContain("dot");
    expect(validateFileName("CON.md")).toContain("reserved");
    expect(validateFileName(`${"a".repeat(201)}.md`)).toContain("200");
  });

  it("normalizes relative folders and rejects escapes", () => {
    expect(normalizeRelativeFolder("")).toBe("");
    expect(normalizeRelativeFolder("  ")).toBe("");
    expect(normalizeRelativeFolder("notes")).toBe("notes");
    expect(normalizeRelativeFolder("notes\\daily")).toBe("notes/daily");
    expect(normalizeRelativeFolder("/notes//daily/")).toBe("notes/daily");
    expect(normalizeRelativeFolder("../outside")).toBeNull();
    expect(normalizeRelativeFolder("notes/../outside")).toBeNull();
    expect(normalizeRelativeFolder("C:\\notes")).toBeNull();
    expect(normalizeRelativeFolder("notes:streams")).toBeNull();
  });

  it("finds the containing folder without escaping the workspace", () => {
    expect(relativeFolder("C:\\Docs", "C:\\Docs\\note.md")).toBe("");
    expect(relativeFolder("C:\\Docs", "C:\\Docs\\notes\\note.md")).toBe(
      "notes",
    );
    expect(relativeFolder("C:\\Docs", "C:\\Other\\note.md")).toBe("");
    expect(relativeFolder("/home/me/docs", "/home/me/docs/a/b.md")).toBe("a");
  });

  it("suggests numbered copy names case-insensitively", () => {
    expect(copyName("note.md", [])).toBe("note copy.md");
    expect(copyName("note.md", ["note copy.md"])).toBe("note copy 2.md");
    expect(copyName("note", ["note copy"])).toBe("note copy 2");
    expect(copyName("NOTE.md", ["note copy.md"])).toBe("NOTE copy 2.md");
  });

  it("compares Windows paths without case or separator differences", () => {
    expect(sameFilePath("C:\\Docs\\Note.md", "c:/docs/note.md")).toBe(true);
    expect(sameFilePath("C:\\Docs\\Note.md", "C:\\Docs\\Other.md")).toBe(false);
    expect(sameFilePath(null, null)).toBe(true);
    expect(sameFilePath(null, "C:\\Docs\\Note.md")).toBe(false);
  });
});
