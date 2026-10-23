import { describe, expect, it } from "vitest";
import {
  buildMetaTags,
  documentInfoMarkup,
} from "../src/lib/exportMetadata";

const metadata = {
  author: "Ada <script>alert(1)</script>",
  date: "2026-10-23",
  description: "A <short> note",
  keywords: "one, two",
  tags: "[alpha, beta]",
  title: "Front Title",
};

describe("buildMetaTags", () => {
  it("escapes metadata and keeps only supported tags", () => {
    expect(buildMetaTags(metadata, true)).toBe(
      [
        '<meta name="author" content="Ada &lt;script&gt;alert(1)&lt;/script&gt;">',
        '<meta name="description" content="A &lt;short&gt; note">',
        '<meta name="keywords" content="one, two">',
      ].join("\n"),
    );
  });

  it("returns nothing when disabled or empty", () => {
    expect(buildMetaTags(metadata, false)).toBe("");
    expect(buildMetaTags({}, true)).toBe("");
  });

  it("falls back to summary for the description tag", () => {
    expect(buildMetaTags({ summary: "Short" }, true)).toBe(
      '<meta name="description" content="Short">',
    );
  });
});

describe("documentInfoMarkup", () => {
  it("renders localized, escaped entries", () => {
    const html = documentInfoMarkup(metadata, "zh-CN", true);
    expect(html).toContain('class="document-info"');
    expect(html).toContain('aria-label="文档信息"');
    expect(html).toContain("<dt>作者</dt>");
    expect(html).toContain(
      "<dd>Ada &lt;script&gt;alert(1)&lt;/script&gt;</dd>",
    );
    expect(html).toContain("<dt>日期</dt>");
    expect(html).toContain("<dt>标签</dt>");
    expect(html).toContain("<dt>关键词</dt>");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("uses English labels and summary fallback", () => {
    const html = documentInfoMarkup(
      { summary: "Short", author: "Ada" },
      "en",
      true,
    );
    expect(html).toContain('aria-label="Document information"');
    expect(html).toContain("<dt>Author</dt>");
    expect(html).toContain("<dt>Summary</dt>");
    expect(html).toContain("<dd>Short</dd>");
  });

  it("returns nothing when disabled or without usable metadata", () => {
    expect(documentInfoMarkup(metadata, "en", false)).toBe("");
    expect(documentInfoMarkup({ title: "Only a title" }, "en", true)).toBe("");
  });
});
