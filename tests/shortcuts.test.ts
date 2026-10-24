import { describe, expect, it } from "vitest";
import {
  conflictLabel,
  DEFAULT_SHORTCUTS,
  eventToShortcut,
  isValidBinding,
  normalizeShortcuts,
  SHORTCUT_DEFINITIONS,
  shortcutForEvent,
} from "../src/lib/shortcuts";

const base = {
  ctrlKey: true,
  metaKey: false,
  altKey: false,
  shiftKey: false,
};

describe("shortcut bindings", () => {
  it("uses unique default bindings", () => {
    const bindings = SHORTCUT_DEFINITIONS.map(
      (definition) => definition.defaultBinding,
    );
    expect(new Set(bindings).size).toBe(bindings.length);
    expect(DEFAULT_SHORTCUTS.new).toBe("Ctrl+N");
  });

  it("normalizes keyboard events", () => {
    expect(eventToShortcut({ ...base, key: "n" })).toBe("Ctrl+N");
    expect(
      eventToShortcut({ ...base, key: "N", shiftKey: true }),
    ).toBe("Ctrl+Shift+N");
    expect(
      eventToShortcut({ ...base, key: "+", altKey: true }),
    ).toBe("Ctrl+Alt+=");
    expect(eventToShortcut({ ...base, key: "/" })).toBe("Ctrl+/");
    expect(eventToShortcut({ ...base, key: " ", shiftKey: true })).toBe(
      "Ctrl+Shift+Space",
    );
    expect(
      eventToShortcut({ ...base, ctrlKey: false, metaKey: false, key: "n" }),
    ).toBeNull();
    expect(eventToShortcut({ ...base, key: "Control" })).toBeNull();
  });

  it("validates persisted binding shapes", () => {
    expect(isValidBinding("")).toBe(true);
    expect(isValidBinding("Ctrl+Alt+Shift+N")).toBe(true);
    expect(isValidBinding("Ctrl+/")).toBe(true);
    expect(isValidBinding("Shift+N")).toBe(false);
    expect(isValidBinding("Ctrl+Ctrl+N")).toBe(false);
    expect(isValidBinding("Ctrl+")).toBe(false);
  });

  it("repairs malformed and duplicate persisted maps", () => {
    const normalized = normalizeShortcuts({
      new: "Shift+N",
      open: "Ctrl+S",
      save: "Ctrl+S",
    });
    expect(normalized.new).toBe("Ctrl+N");
    expect(normalized.open).toBe("Ctrl+S");
    expect(normalized.save).toBe("");
    expect(normalizeShortcuts(null)).toEqual(DEFAULT_SHORTCUTS);
  });

  it("matches commands and reports conflicts", () => {
    expect(shortcutForEvent(DEFAULT_SHORTCUTS, { ...base, key: "n" })).toBe(
      "new",
    );
    expect(
      shortcutForEvent(DEFAULT_SHORTCUTS, { ...base, key: "x" }),
    ).toBeNull();
    expect(
      conflictLabel(DEFAULT_SHORTCUTS, "new", "Ctrl+O"),
    ).toBe("Open file");
    expect(conflictLabel(DEFAULT_SHORTCUTS, "new", "Ctrl+Alt+X")).toBeNull();
    expect(conflictLabel(DEFAULT_SHORTCUTS, "new", "")).toBeNull();
  });
});
