import { describe, expect, it } from "vitest";
import { rangeIsActive } from "../src/lib/selection";

describe("rangeIsActive", () => {
  it("detects cursors and selections that overlap the range", () => {
    expect(rangeIsActive([{ from: 0, to: 0 }], 1, 5)).toBe(false);
    expect(rangeIsActive([{ from: 1, to: 1 }], 1, 5)).toBe(true);
    expect(rangeIsActive([{ from: 5, to: 5 }], 1, 5)).toBe(true);
    expect(rangeIsActive([{ from: 0, to: 3 }], 1, 5)).toBe(true);
    expect(rangeIsActive([{ from: 4, to: 9 }], 1, 5)).toBe(true);
  });

  it("returns false for an empty range set", () => {
    expect(rangeIsActive([], 0, 10)).toBe(false);
  });
});
