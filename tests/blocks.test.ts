import { describe, expect, it } from "vitest";
import {
  MAX_FENCE_LABEL_LENGTH,
  MAX_QUOTE_DEPTH,
  blockquoteDepth,
  fenceLanguageLabel,
  quoteClassForDepth,
} from "../src/lib/blocks";

describe("live preview block helpers", () => {
  it("builds stable quote classes for each level", () => {
    expect(quoteClassForDepth(1)).toBe("cm-live-quote cm-live-quote-1");
    expect(quoteClassForDepth(2)).toBe("cm-live-quote cm-live-quote-2");
    expect(quoteClassForDepth(3)).toBe("cm-live-quote cm-live-quote-3");
  });

  it("clamps invalid and excessive quote depths", () => {
    expect(quoteClassForDepth(0)).toBe("cm-live-quote cm-live-quote-1");
    expect(quoteClassForDepth(-4)).toBe("cm-live-quote cm-live-quote-1");
    expect(quoteClassForDepth(Number.NaN)).toBe(
      "cm-live-quote cm-live-quote-1",
    );
    expect(quoteClassForDepth(MAX_QUOTE_DEPTH + 5)).toBe(
      `cm-live-quote cm-live-quote-${MAX_QUOTE_DEPTH}`,
    );
  });

  it("counts nested blockquote ancestors", () => {
    expect(blockquoteDepth([])).toBe(1);
    expect(blockquoteDepth(["Document", "Blockquote"])).toBe(2);
    expect(
      blockquoteDepth(["Document", "Blockquote", "ListItem", "Blockquote"]),
    ).toBe(3);
  });

  it("extracts a short language label from fence info", () => {
    expect(fenceLanguageLabel("ts")).toBe("ts");
    expect(fenceLanguageLabel("  python  ")).toBe("python");
    expect(fenceLanguageLabel("ts title=\"example\"")).toBe("ts");
    expect(fenceLanguageLabel("{.ts}")).toBe("ts");
    expect(fenceLanguageLabel("")).toBe("code");
    expect(fenceLanguageLabel("   ")).toBe("code");
  });

  it("caps long fence language labels", () => {
    const label = fenceLanguageLabel("x".repeat(MAX_FENCE_LABEL_LENGTH + 8));
    expect(label).toHaveLength(MAX_FENCE_LABEL_LENGTH);
  });
});
