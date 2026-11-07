import { describe, expect, it } from "vitest";
import {
  headingClassForNode,
  headingLevelForNode,
} from "../src/lib/headings";

describe("live preview heading hierarchy", () => {
  it("maps ATX headings to levels one through six", () => {
    expect(headingLevelForNode("ATXHeading1")).toBe(1);
    expect(headingLevelForNode("ATXHeading2")).toBe(2);
    expect(headingLevelForNode("ATXHeading3")).toBe(3);
    expect(headingLevelForNode("ATXHeading4")).toBe(4);
    expect(headingLevelForNode("ATXHeading5")).toBe(5);
    expect(headingLevelForNode("ATXHeading6")).toBe(6);
  });

  it("maps Setext headings to levels one and two", () => {
    expect(headingLevelForNode("SetextHeading1")).toBe(1);
    expect(headingLevelForNode("SetextHeading2")).toBe(2);
  });

  it("ignores non-heading nodes", () => {
    expect(headingLevelForNode("Paragraph")).toBeNull();
    expect(headingLevelForNode("HeaderMark")).toBeNull();
    expect(headingClassForNode("FencedCode")).toBeNull();
  });

  it("builds stable line classes", () => {
    expect(headingClassForNode("ATXHeading2")).toBe(
      "cm-live-heading cm-live-h2",
    );
    expect(headingClassForNode("SetextHeading1")).toBe(
      "cm-live-heading cm-live-h1",
    );
  });
});
