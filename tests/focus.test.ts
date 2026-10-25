import { describe, expect, it } from "vitest";
import { nextFocusTarget } from "../src/lib/focus";

function fakeElements(count: number): HTMLElement[] {
  return Array.from({ length: count }, () => ({}) as HTMLElement);
}

describe("modal focus order", () => {
  it("returns null for an empty modal", () => {
    expect(nextFocusTarget([], null, false)).toBeNull();
  });

  it("enters at the first or last element when focus escaped", () => {
    const items = fakeElements(3);
    expect(nextFocusTarget(items, null, false)).toBe(items[0]);
    expect(nextFocusTarget(items, null, true)).toBe(items[2]);
    expect(nextFocusTarget(items, {} as HTMLElement, false)).toBe(items[0]);
  });

  it("wraps forward and backward", () => {
    const items = fakeElements(3);
    expect(nextFocusTarget(items, items[0], false)).toBe(items[1]);
    expect(nextFocusTarget(items, items[2], false)).toBe(items[0]);
    expect(nextFocusTarget(items, items[0], true)).toBe(items[2]);
    expect(nextFocusTarget(items, items[2], true)).toBe(items[1]);
  });
});
