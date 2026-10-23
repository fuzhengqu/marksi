import { describe, expect, it } from "vitest";
import { minimalTextChange } from "../src/lib/textChange";

describe("minimalTextChange", () => {
  it("returns no change for equal strings", () => {
    expect(minimalTextChange("same", "same")).toBeNull();
  });

  it("isolates an inserted attribute", () => {
    expect(
      minimalTextChange("![alt](image.png)", "![alt](image.png){width=320}"),
    ).toEqual({
      from: 17,
      to: 17,
      insert: "{width=320}",
    });
  });

  it("isolates a changed width and preserves the surrounding text", () => {
    const before = "before ![alt](image.png){width=120} after";
    const after = "before ![alt](image.png){width=480} after";
    expect(minimalTextChange(before, after)).toEqual({
      from: 31,
      to: 33,
      insert: "48",
    });
  });

  it("handles deletions at the start and end", () => {
    expect(minimalTextChange("abcXYZ", "abc")).toEqual({
      from: 3,
      to: 6,
      insert: "",
    });
    expect(minimalTextChange("XYZabc", "abc")).toEqual({
      from: 0,
      to: 3,
      insert: "",
    });
  });

  it("handles completely unrelated text", () => {
    expect(minimalTextChange("abc", "xyz")).toEqual({
      from: 0,
      to: 3,
      insert: "xyz",
    });
  });
});
