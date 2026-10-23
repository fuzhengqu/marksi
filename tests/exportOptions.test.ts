import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPORT_OPTIONS,
  EXPORT_PROFILE_PRESETS,
  buildPageCss,
  exportProfileOptions,
  normalizeExportOptions,
} from "../src/lib/exportOptions";

describe("normalizeExportOptions", () => {
  it("returns the document preset for missing or invalid input", () => {
    expect(normalizeExportOptions(undefined)).toEqual(DEFAULT_EXPORT_OPTIONS);
    expect(
      normalizeExportOptions({
        profile: "unknown",
        pageSize: "a0",
        orientation: "diagonal",
        margin: "huge",
        useFrontMatter: "yes",
      }),
    ).toMatchObject({
      profile: "document",
      pageSize: "a4",
      orientation: "portrait",
      margin: "normal",
      useFrontMatter: true,
    });
  });

  it("keeps a named preset when every value matches", () => {
    expect(normalizeExportOptions(EXPORT_PROFILE_PRESETS.print)).toEqual(
      EXPORT_PROFILE_PRESETS.print,
    );
    expect(normalizeExportOptions(EXPORT_PROFILE_PRESETS.minimal)).toEqual(
      EXPORT_PROFILE_PRESETS.minimal,
    );
  });

  it("demotes a mismatched named preset to custom", () => {
    expect(
      normalizeExportOptions({
        ...EXPORT_PROFILE_PRESETS.document,
        margin: "wide",
      }),
    ).toMatchObject({ profile: "custom", margin: "wide" });
  });

  it("strips control characters and limits header/footer length", () => {
    const options = normalizeExportOptions({
      header: `A\nB\tC${"x".repeat(300)}`,
      footer: "{page}\r\n{pages}",
    });
    expect(options.header.startsWith("A B C")).toBe(true);
    expect(options.header.length).toBe(120);
    expect(options.footer).toBe("{page}  {pages}");
  });
});

describe("exportProfileOptions", () => {
  it("returns independent preset copies", () => {
    const first = exportProfileOptions("print");
    const second = exportProfileOptions("print");
    second.footer = "changed";
    expect(first.footer).toBe("{page} / {pages}");
    expect(first).not.toBe(second);
  });
});

describe("buildPageCss", () => {
  it("writes paper size, orientation, and margins", () => {
    const css = buildPageCss(
      {
        ...EXPORT_PROFILE_PRESETS.document,
        pageSize: "letter",
        orientation: "landscape",
        margin: "wide",
      },
      "Notes",
    );
    expect(css).toContain("size: Letter landscape;");
    expect(css).toContain("margin: 26mm 24mm;");
  });

  it("renders header and footer tokens as CSS content", () => {
    const css = buildPageCss(
      {
        ...EXPORT_PROFILE_PRESETS.print,
        header: "{title} · Draft",
        footer: "Page {page} of {pages}",
      },
      'A "quoted" \\ title',
    );
    expect(css).toContain('content: "A \\"quoted\\" \\\\ title" "· Draft";');
    expect(css).toContain(
      'content: "Page" counter(page) "of" counter(pages);',
    );
    expect(css).toContain("@top-center");
    expect(css).toContain("@bottom-center");
  });

  it("omits margin boxes when header and footer are empty", () => {
    const css = buildPageCss(DEFAULT_EXPORT_OPTIONS, "Notes");
    expect(css).not.toContain("@top-center");
    expect(css).not.toContain("@bottom-center");
    expect(css).toContain("size: A4 portrait;");
  });
});
