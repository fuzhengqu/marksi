import { describe, expect, it } from "vitest";
import {
  findCustomTheme,
  sanitizeCustomCss,
  type CustomTheme,
} from "../src/lib/customThemes";

describe("custom CSS themes", () => {
  it("keeps local variables and data URLs", () => {
    const result = sanitizeCustomCss(
      ":root { --accent: #123456; } .markdown-body { background-image: url(data:image/png;base64,AA==); }",
    );
    expect(result.blocked).toBe(0);
    expect(result.css).toContain("--accent: #123456");
    expect(result.css).toContain("url(data:image/png");
  });

  it("removes imports and every remote URL form", () => {
    const result = sanitizeCustomCss(`
      @import url("https://example.com/theme.css");
      @import "https://example.com/other.css";
      body {
        background: url(https://example.com/a.png);
        mask: url( '//example.com/b.svg' );
        cursor: url(file:///C:/secret.cur), auto;
        background-image: image-set("https://example.com/c.png" 1x);
      }
    `);
    expect(result.css).not.toContain("https://");
    expect(result.css).not.toContain("file:");
    expect(result.css).not.toContain("@import");
    expect(result.css).toContain("none");
    expect(result.blocked).toBe(6);
  });

  it("removes legacy script-capable declarations", () => {
    const result = sanitizeCustomCss(
      "a { behavior: url(x.htc); -moz-binding: url(x.xml); width: expression(alert(1)); }",
    );
    expect(result.css).not.toContain("expression(");
    expect(result.css).not.toContain("behavior:");
    expect(result.css).not.toContain("-moz-binding:");
    expect(result.blocked).toBe(5);
  });

  it("ignores commented-out attacks and handles comments inside selectors", () => {
    const result = sanitizeCustomCss(
      "/* url(https://example.com) */ body { color: red; }",
    );
    expect(result.css).not.toContain("https://");
    expect(result.blocked).toBe(0);
  });

  it("finds a theme by exact file name", () => {
    const themes: CustomTheme[] = [
      { name: "ocean.css", css: "body {}" },
      { name: "Ocean.css", css: "html {}" },
    ];
    expect(findCustomTheme(themes, "ocean.css")?.css).toBe("body {}");
    expect(findCustomTheme(themes, "missing.css")).toBeNull();
  });
});
