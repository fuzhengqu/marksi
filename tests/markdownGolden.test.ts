import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderMarkdownHtml } from "../src/lib/markdown";

const folder = join(process.cwd(), "tests", "fixtures", "markdown");
const fixtureNames = readdirSync(folder)
  .filter((file) => file.endsWith(".md"))
  .sort();

function normalize(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function read(name: string): string {
  return normalize(readFileSync(join(folder, name), "utf8"));
}

describe("golden Markdown fixtures", () => {
  it("keeps a source and expected file for every fixture", () => {
    const expectedNames = readdirSync(folder)
      .filter((file) => file.endsWith(".html"))
      .sort();
    expect(expectedNames).toEqual(
      fixtureNames.map((name) => name.replace(/\.md$/, ".html")),
    );
  });

  it.each(fixtureNames)("%s renders exactly", (name) => {
    const source = read(name);
    const expected = read(name.replace(/\.md$/, ".html"));
    const actual = renderMarkdownHtml(source, {
      strictMode: !name.endsWith(".lax.md"),
    });
    expect(actual).toBe(expected);
  });

  it("does not emit executable HTML for raw markup fixtures", () => {
    const rendered = renderMarkdownHtml(read("raw-html.md"));
    expect(rendered).not.toContain("<script");
    expect(rendered).not.toContain("<div");
    expect(rendered).toContain("&lt;script&gt;");
    expect(rendered).toContain("&lt;div onclick=&quot;x&quot;&gt;");
  });

  it("supports backslash and two-space hard breaks", () => {
    const backslash = renderMarkdownHtml("alpha\\\nbeta\n");
    expect(backslash).toContain("alpha<br>\nbeta");

    const spaces = renderMarkdownHtml("alpha  \nbeta\n");
    expect(spaces).toContain("alpha<br>\nbeta");
  });

  it("keeps CJK, emoji, and bidirectional text intact", () => {
    const rendered = renderMarkdownHtml(read("unicode.md"));
    expect(rendered).toContain("中文段落");
    expect(rendered).toContain("日本語のテキスト");
    expect(rendered).toContain("한국어");
    expect(rendered).toContain("👩‍💻");
    expect(rendered).toContain("مرحبا بالعالم");
    expect(rendered).toContain("עברית");
  });

  it("renders inline MathML and KaTeX output", () => {
    const inline = renderMarkdownHtml("$a+b$");
    expect(inline).toContain('class="katex"');
    expect(inline).toContain('aria-hidden="true"');

    const display = renderMarkdownHtml("$$\nE = mc^2\n$$");
    expect(display).toContain("katex-display");

    const mathml = renderMarkdownHtml("$a+b$", { mathOutput: "mathml" });
    expect(mathml).toContain("<math");
    expect(mathml).toContain("application/x-tex");
  });

  it("falls back without throwing on invalid math", () => {
    const rendered = renderMarkdownHtml("$\\frac{1}{$");
    expect(rendered.length).toBeGreaterThan(0);
  });

  it("only enables compact headings in lax mode", () => {
    const source = "#Compact heading\n";
    expect(renderMarkdownHtml(source)).toContain("<p");
    expect(renderMarkdownHtml(source, { strictMode: false })).toContain(
      '<h1 data-source-line="1" id="compact-heading">',
    );
  });
});
