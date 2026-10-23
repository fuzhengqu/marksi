import { describe, expect, it } from "vitest";
import {
  htmlExportName,
  htmlExportPath,
} from "../src/lib/exportHtml";

describe("HTML export names", () => {
  it("replaces the Markdown extension and preserves the folder", () => {
    expect(htmlExportName("notes.md")).toBe("notes.html");
    expect(htmlExportName("notes")).toBe("notes.html");
    expect(htmlExportPath("D:\\docs\\notes.md", "notes.md")).toBe(
      "D:\\docs\\notes.html",
    );
    expect(htmlExportPath("/docs/notes.md", "notes.md")).toBe(
      "/docs/notes.html",
    );
    expect(htmlExportPath(null, "notes.md")).toBe("notes.html");
  });
});
