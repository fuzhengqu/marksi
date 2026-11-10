import { describe, expect, it } from "vitest";
import { renderMarkdownHtml } from "../src/lib/markdown";
import {
  TABLE_PREVIEW_MAX_CHARS,
  TABLE_PREVIEW_MAX_TABLES,
  tableIsActive,
  tablePreviewLimit,
} from "../src/lib/tables";

describe("table preview helpers", () => {
  it("allows table widgets for ordinary documents", () => {
    expect(tablePreviewLimit(0)).toBe(TABLE_PREVIEW_MAX_TABLES);
    expect(tablePreviewLimit(TABLE_PREVIEW_MAX_CHARS)).toBe(
      TABLE_PREVIEW_MAX_TABLES,
    );
  });

  it("falls back to source for very large documents", () => {
    expect(tablePreviewLimit(TABLE_PREVIEW_MAX_CHARS + 1)).toBe(0);
  });

  it("marks a table active when a cursor or selection overlaps it", () => {
    expect(tableIsActive([{ from: 2, to: 2 }], 10, 40)).toBe(false);
    expect(tableIsActive([{ from: 10, to: 10 }], 10, 40)).toBe(true);
    expect(tableIsActive([{ from: 40, to: 40 }], 10, 40)).toBe(true);
    expect(tableIsActive([{ from: 0, to: 12 }], 10, 40)).toBe(true);
    expect(tableIsActive([{ from: 39, to: 60 }], 10, 40)).toBe(true);
  });
});

describe("table preview rendering", () => {
  it("keeps alignment and inline formatting inside cells", () => {
    const html = renderMarkdownHtml(
      [
        "| Name | Qty | Price |",
        "| :--- | :---: | ---: |",
        "| **Apple** | `2` | $1.50 |",
        "",
      ].join("\n"),
    );
    expect(html).toContain("<table ");
    expect(html).toContain('style="text-align:left"');
    expect(html).toContain('style="text-align:center"');
    expect(html).toContain('style="text-align:right"');
    expect(html).toContain("<strong>Apple</strong>");
    expect(html).toContain("<code>2</code>");
  });

  it("does not render executable markup in cells", () => {
    const html = renderMarkdownHtml(
      ["| Value |", "| --- |", "| <script>alert(1)</script> |", ""].join(
        "\n",
      ),
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("keeps remote images inert inside table cells", () => {
    const html = renderMarkdownHtml(
      [
        "| Image |",
        "| --- |",
        "| ![remote](https://example.com/picture.png) |",
        "",
      ].join("\n"),
    );
    expect(html).toContain("data-marksi-remote-src");
    expect(html).not.toContain('<img src="https://example.com/picture.png"');
  });
});
