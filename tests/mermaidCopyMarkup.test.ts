import { describe, expect, it } from "vitest";
import { renderMarkdownHtml } from "../src/lib/markdown";

const fence = [
  "```mermaid",
  "graph TD",
  "  A --> B",
  "```",
  "",
].join("\n");

describe("reading-view Mermaid source copy markup", () => {
  it("localizes the source summary and adds a copy button", () => {
    const html = renderMarkdownHtml(fence, {
      mermaidSourceLabel: "Mermaid 源码",
      mermaidCopyLabel: "复制源码",
    });
    expect(html).toContain("<span>Mermaid 源码</span>");
    expect(html).toContain('class="mermaid-copy-button"');
    expect(html).toContain('aria-label="复制源码"');
    expect(html).toContain(">复制源码</button>");
  });

  it("keeps default, export, and clipboard markup static", () => {
    expect(renderMarkdownHtml(fence)).toContain("Mermaid source");
    expect(renderMarkdownHtml(fence)).not.toContain("mermaid-copy-button");
    expect(
      renderMarkdownHtml(fence, {
        imageMode: "export",
        mermaidSourceLabel: "Mermaid 源码",
        mermaidCopyLabel: "复制源码",
      }),
    ).not.toContain("mermaid-copy-button");
  });

  it("escapes the source and copy labels", () => {
    const html = renderMarkdownHtml(fence, {
      mermaidSourceLabel: 'Mermaid "source"',
      mermaidCopyLabel: "Copy <source>",
    });
    expect(html).toContain("Mermaid &quot;source&quot;");
    expect(html).toContain("Copy &lt;source&gt;");
    expect(html).not.toContain("<source>");
  });
});
