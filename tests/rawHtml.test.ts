import { describe, expect, it } from "vitest";
import { renderMarkdownHtml } from "../src/lib/markdown";

const source =
  '<div class="evil"><strong>Safe</strong><script>alert(1)</script></div>';

describe("raw HTML rendering", () => {
  it("escapes raw HTML by default", () => {
    const html = renderMarkdownHtml(source);
    expect(html).toContain("&lt;div");
    expect(html).not.toContain("<strong>Safe</strong>");
  });

  it("passes enabled raw HTML through the sanitizer hook", () => {
    const html = renderMarkdownHtml(source, {
      rawHtml: true,
      sanitizeRawHtml: (value) =>
        value.replace(/<script[\s\S]*?<\/script>/gi, ""),
    });
    expect(html).toContain('<div class="evil">');
    expect(html).toContain("<strong>Safe</strong>");
    expect(html).not.toContain("<script>");
  });

  it("escapes enabled raw HTML when no sanitizer is supplied", () => {
    const html = renderMarkdownHtml(source, { rawHtml: true });
    expect(html).toContain("&lt;div");
    expect(html).not.toContain("<strong>Safe</strong>");
  });
});
