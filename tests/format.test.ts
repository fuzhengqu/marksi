import { describe, expect, it } from "vitest";
import {
  editForCommand,
  insertLink,
  setHeadingLevel,
  toggleInline,
} from "../src/editor/format";

describe("toggleInline", () => {
  it("wraps a selection and keeps the text selected", () => {
    expect(toggleInline("Hello world", 0, 5, "**")).toEqual({
      from: 0,
      to: 5,
      insert: "**Hello**",
      selectionFrom: 2,
      selectionTo: 7,
    });
  });

  it("unwraps markers included in the selection", () => {
    expect(toggleInline("**Hello** world", 0, 9, "**")).toEqual({
      from: 0,
      to: 9,
      insert: "Hello",
      selectionFrom: 0,
      selectionTo: 5,
    });
  });

  it("removes markers immediately outside the selection", () => {
    expect(toggleInline("**Hello**", 2, 7, "**")).toEqual({
      from: 0,
      to: 9,
      insert: "Hello",
      selectionFrom: 0,
      selectionTo: 5,
    });
  });

  it("inserts an empty pair for a collapsed cursor", () => {
    expect(toggleInline("", 0, 0, "*")).toEqual({
      from: 0,
      to: 0,
      insert: "**",
      selectionFrom: 1,
      selectionTo: 1,
    });
  });
});

describe("insertLink", () => {
  it("wraps selected text and selects the URL placeholder", () => {
    expect(insertLink("MarkSI", 0, 6)).toEqual({
      from: 0,
      to: 6,
      insert: "[MarkSI](url)",
      selectionFrom: 9,
      selectionTo: 12,
    });
  });

  it("selects the label placeholder when nothing is selected", () => {
    expect(insertLink("", 0, 0)).toEqual({
      from: 0,
      to: 0,
      insert: "[link text](url)",
      selectionFrom: 1,
      selectionTo: 10,
    });
  });
});

describe("setHeadingLevel", () => {
  it("adds a heading marker and keeps the cursor in place", () => {
    expect(setHeadingLevel("Title\nBody", 0, 0, 2)).toEqual({
      from: 0,
      to: 5,
      insert: "## Title",
      selectionFrom: 3,
      selectionTo: 3,
    });
  });

  it("changes an existing heading level", () => {
    expect(setHeadingLevel("## Title", 3, 3, 1)).toEqual({
      from: 0,
      to: 8,
      insert: "# Title",
      selectionFrom: 2,
      selectionTo: 2,
    });
  });

  it("removes every heading marker in a multi-line selection", () => {
    expect(setHeadingLevel("# One\n## Two", 0, 12, 0)).toEqual({
      from: 0,
      to: 12,
      insert: "One\nTwo",
      selectionFrom: 0,
      selectionTo: 7,
    });
  });

  it("creates a heading marker on an empty line", () => {
    expect(setHeadingLevel("", 0, 0, 1)).toEqual({
      from: 0,
      to: 0,
      insert: "# ",
      selectionFrom: 2,
      selectionTo: 2,
    });
  });
});

describe("editForCommand", () => {
  it("routes each formatting command to the expected edit", () => {
    expect(editForCommand("bold", "x", 0, 1).insert).toBe("**x**");
    expect(editForCommand("italic", "x", 0, 1).insert).toBe("*x*");
    expect(editForCommand("strikethrough", "x", 0, 1).insert).toBe("~~x~~");
    expect(editForCommand("inline-code", "x", 0, 1).insert).toBe("`x`");
    expect(editForCommand("link", "x", 0, 1).insert).toBe("[x](url)");
  });
});
