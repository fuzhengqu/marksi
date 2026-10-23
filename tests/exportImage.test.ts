import { describe, expect, it } from "vitest";
import {
  imageCaptureScale,
  imageExportName,
  imageExportPath,
} from "../src/lib/exportImage";

describe("image export names", () => {
  it("uses a PNG extension and preserves the folder", () => {
    expect(imageExportName("notes.md")).toBe("notes.png");
    expect(imageExportName("notes")).toBe("notes.png");
    expect(imageExportPath("D:\\docs\\notes.md", "notes.md")).toBe(
      "D:\\docs\\notes.png",
    );
    expect(imageExportPath("/docs/notes.md", "notes.md")).toBe(
      "/docs/notes.png",
    );
    expect(imageExportPath(null, "notes.md")).toBe("notes.png");
  });
});

describe("imageCaptureScale", () => {
  it("uses the preferred pixel ratio for normal documents", () => {
    expect(imageCaptureScale(860, 1200)).toBe(2);
  });

  it("shrinks long documents to the canvas dimension limit", () => {
    expect(imageCaptureScale(860, 20_000)).toBe(0.8);
  });

  it("shrinks wide documents to the canvas dimension limit", () => {
    expect(imageCaptureScale(10_000, 1_000)).toBe(1.6);
  });

  it("shrinks very large documents to the canvas area limit", () => {
    const scale = imageCaptureScale(8_000, 8_000);
    expect(scale).toBeCloseTo(Math.sqrt(80_000_000 / 64_000_000), 6);
  });

  it("returns a scale that the caller can reject as unreadable", () => {
    expect(imageCaptureScale(800, 100_000)).toBeLessThan(0.25);
    expect(imageCaptureScale(0, 0)).toBe(1);
  });
});
