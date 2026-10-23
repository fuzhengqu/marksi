import { describe, expect, it } from "vitest";
import {
  PANDOC_FORMATS,
  pandocExportName,
  pandocExportPath,
  pandocFormatInfo,
  pandocImportName,
} from "../src/lib/pandoc";

describe("pandoc formats", () => {
  it("maps every supported format to a unique extension", () => {
    const extensions = PANDOC_FORMATS.map((format) => format.extension);
    expect(new Set(extensions).size).toBe(extensions.length);
    expect(pandocFormatInfo("latex").extension).toBe("tex");
    expect(pandocFormatInfo("rtf").extension).toBe("rtf");
  });
});

describe("pandoc import names", () => {
  it("uses the source filename with a Markdown extension", () => {
    expect(pandocImportName("D:\\docs\\report.docx")).toBe("report.md");
    expect(pandocImportName("/docs/report.epub")).toBe("report.md");
    expect(pandocImportName("")).toBe("Imported.md");
  });
});

describe("pandoc export names", () => {
  it("uses the selected extension and preserves the folder", () => {
    expect(pandocExportName("notes.md", "docx")).toBe("notes.docx");
    expect(pandocExportName("notes", "epub")).toBe("notes.epub");
    expect(pandocExportName("notes.md", "latex")).toBe("notes.tex");
    expect(
      pandocExportPath("D:\\docs\\notes.md", "notes.md", "docx"),
    ).toBe("D:\\docs\\notes.docx");
    expect(
      pandocExportPath("/docs/notes.md", "notes.md", "odt"),
    ).toBe("/docs/notes.odt");
    expect(pandocExportPath(null, "notes.md", "rtf")).toBe("notes.rtf");
  });
});
