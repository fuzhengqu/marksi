import { describe, expect, it } from "vitest";
import {
  MAX_FENCE_LABEL_LENGTH,
  MAX_QUOTE_DEPTH,
  blockquoteDepth,
  fenceLanguageLabel,
  isUnorderedListMarker,
  orderedListNumberLabel,
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

  it("recognizes only unordered list markers", () => {
    expect(isUnorderedListMarker("-")).toBe(true);
    expect(isUnorderedListMarker("*")).toBe(true);
    expect(isUnorderedListMarker("+")).toBe(true);
    expect(isUnorderedListMarker("1.")).toBe(false);
    expect(isUnorderedListMarker("1)")).toBe(false);
    expect(isUnorderedListMarker("")).toBe(false);
  });

  it("advances ordered list labels from the first source number", () => {
    expect(orderedListNumberLabel(3, 0, "3.")).toBe("3.");
    expect(orderedListNumberLabel(3, 1, "7.")).toBe("4.");
    expect(orderedListNumberLabel(1, 0, "1)")).toBe("1)");
    expect(orderedListNumberLabel(0, 2, "x.")).toBe("3.");
  });
});
