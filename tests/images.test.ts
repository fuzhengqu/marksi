import { describe, expect, it } from "vitest";
import {
  altTextFromFileName,
  buildImageMarkdown,
  classifyImageSource,
  directoryName,
  extensionForImageMime,
  isImagePath,
  pastedImageName,
  resolveImageRootPath,
  resolveLocalImagePath,
  resolveImageRootUrl,
  resolveRootImagePath,
} from "../src/lib/images";

describe("image helpers", () => {
  it("recognizes supported image extensions", () => {
    expect(isImagePath("photo.PNG")).toBe(true);
    expect(isImagePath("C:\\docs\\photo.jpeg")).toBe(true);
    expect(isImagePath("diagram.svg")).toBe(true);
    expect(isImagePath("notes.md")).toBe(false);
    expect(isImagePath("archive.png.zip")).toBe(false);
  });

  it("classifies data, remote, local, and unsafe image sources", () => {
    expect(classifyImageSource("data:image/png;base64,abc").kind).toBe("data");
    expect(classifyImageSource("https://example.com/a.png").kind).toBe("remote");
    expect(classifyImageSource("//example.com/a.png").kind).toBe("remote");
    expect(classifyImageSource("assets/a.png").kind).toBe("local");
    expect(classifyImageSource("C:\\docs\\a.png").kind).toBe("local");
    expect(classifyImageSource("javascript:alert(1)").kind).toBe("unsafe");
  });

  it("resolves relative image paths against a Windows or POSIX base", () => {
    expect(resolveLocalImagePath("assets/a.png", "C:\\docs")).toBe(
      "C:/docs/assets/a.png",
    );
    expect(resolveLocalImagePath("/assets/a.png", "C:\\docs")).toBe(
      "C:/docs/assets/a.png",
    );
    expect(resolveLocalImagePath("assets/a.png", "/home/me/docs")).toBe(
      "/home/me/docs/assets/a.png",
    );
    expect(resolveLocalImagePath("C:\\pictures\\a.png", "C:\\docs")).toBe(
      "C:/pictures/a.png",
    );
    expect(resolveLocalImagePath("https://example.com/a.png", "C:\\docs")).toBe(
      null,
    );
    expect(resolveLocalImagePath("assets/a.png", null)).toBe(null);
  });

  it("resolves an optional image root path", () => {
    expect(
      resolveImageRootPath("../shared", "C:\\work\\notes", null),
    ).toBe("C:/work/notes/../shared");
    expect(
      resolveImageRootPath("assets", null, "/home/me/docs/note.md"),
    ).toBe("/home/me/docs/assets");
    expect(resolveImageRootPath("/srv/shared", null, null)).toBe(
      "/srv/shared",
    );
    expect(resolveImageRootPath("", "C:\\work", null)).toBe(null);
    expect(resolveImageRootPath("assets", null, null)).toBe(null);
  });

  it("maps root-relative and fallback image paths", () => {
    expect(resolveRootImagePath("/assets/a.png", "C:/site")).toBe(
      "C:/site/assets/a.png",
    );
    expect(resolveRootImagePath("assets/a.png", "C:/site")).toBe(
      "C:/site/assets/a.png",
    );
    expect(resolveRootImagePath("C:\\pictures\\a.png", "C:/site")).toBe(
      "C:/pictures/a.png",
    );
    expect(resolveRootImagePath("https://example.com/a.png", "C:/site")).toBe(
      null,
    );
    expect(resolveRootImagePath("assets/a.png", null)).toBe(null);
  });

  it("resolves relative images against an optional root URL", () => {
    expect(
      resolveImageRootUrl("https://example.com/assets", "cover.png"),
    ).toBe("https://example.com/assets/cover.png");
    expect(
      resolveImageRootUrl("https://example.com/assets/", "/icons/cover.png"),
    ).toBe("https://example.com/assets/icons/cover.png");
    expect(
      resolveImageRootUrl("https://example.com/assets/", "https://x/a.png"),
    ).toBe(null);
    expect(
      resolveImageRootUrl("file:///tmp", "cover.png"),
    ).toBe(null);
    expect(resolveImageRootUrl("https://example.com/", "C:\\a.png")).toBe(
      null,
    );
  });

  it("converts an image to Markdown with an escaped destination", () => {
    expect(buildImageMarkdown("My photo", "assets/my photo(1).png")).toBe(
      "![My photo](assets/my%20photo%281%29.png)",
    );
    expect(buildImageMarkdown("[cover]", "assets/a.png")).toBe(
      "![\\[cover\\]](assets/a.png)",
    );
    expect(buildImageMarkdown("", "assets/a.png")).toBe(
      "![Image](assets/a.png)",
    );
  });

  it("derives display metadata", () => {
    expect(directoryName("C:\\docs\\note.md")).toBe("C:/docs");
    expect(directoryName("/home/me/note.md")).toBe("/home/me");
    expect(directoryName("note.md")).toBe("");
    expect(altTextFromFileName("my-cover_photo.png")).toBe("my cover photo");
    expect(extensionForImageMime("image/jpeg")).toBe("jpg");
    expect(pastedImageName("image/jpeg", Date.UTC(2026, 9, 23, 1, 2, 3))).toBe(
      "pasted-20261023010203.jpg",
    );
  });
});
