import { describe, expect, it } from "vitest";
import { renderMarkdownHtml } from "../src/lib/markdown";

const fence = ["```ts", "const answer = 42;", "```", ""].join("\n");
const emptyFence = ["```ts", "```", ""].join("\n");

describe("reading-view code copy markup", () => {
  it("adds a labeled copy button when requested", () => {
    const html = renderMarkdownHtml(fence, { codeCopyLabel: "复制代码" });
    expect(html).toContain('class="code-block-head has-copy"');
    expect(html).toContain('class="code-copy-button"');
    expect(html).toContain('aria-label="复制代码"');
    expect(html).toContain(">复制代码</button>");
    expect(html).not.toContain("disabled");
  });

  it("keeps default, export, and clipboard markup static", () => {
    expect(renderMarkdownHtml(fence)).not.toContain("code-copy-button");
    expect(
      renderMarkdownHtml(fence, {
        imageMode: "export",
        codeCopyLabel: "Copy code",
      }),
    ).not.toContain("code-copy-button");
  });

  it("disables copy for an empty block", () => {
    const html = renderMarkdownHtml(emptyFence, {
      codeCopyLabel: "Copy code",
    });
    expect(html).toContain('<button type="button" class="code-copy-button"');
    expect(html).toContain("disabled>Copy code</button>");
  });

  it("escapes the copied label", () => {
    const html = renderMarkdownHtml(fence, {
      codeCopyLabel: 'Copy "code" <now>',
    });
    expect(html).toContain("&quot;code&quot; &lt;now&gt;");
    expect(html).not.toContain("<now>");
  });
});
