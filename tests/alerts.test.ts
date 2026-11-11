import { describe, expect, it } from "vitest";
import {
  ALERT_TITLES,
  alertClass,
  alertMarker,
} from "../src/lib/alerts";

describe("ALERT_TITLES", () => {
  it("exposes the five GitHub alert titles", () => {
    expect(ALERT_TITLES).toEqual({
      caution: "Caution",
      important: "Important",
      note: "Note",
      tip: "Tip",
      warning: "Warning",
    });
  });
});

describe("alertMarker", () => {
  it("parses every kind at the start of a block quote", () => {
    for (const kind of [
      "note",
      "tip",
      "important",
      "warning",
      "caution",
    ] as const) {
      const marker = alertMarker(`> [!${kind.toUpperCase()}]`);
      expect(marker).toEqual({
        kind,
        start: 2,
        end: 2 + `[!${kind.toUpperCase()}]`.length,
      });
    }
  });

  it("accepts up to three leading spaces, a missing post-quote space, and mixed case", () => {
    expect(alertMarker("  >[!tip]")).toEqual({
      kind: "tip",
      start: 3,
      end: 9,
    });
    expect(alertMarker("> [!NoTe] trailing")).toEqual({
      kind: "note",
      start: 2,
      end: 9,
    });
  });

  it("returns offsets inside a line with trailing content", () => {
    const line = "> [!WARNING] Danger";
    const marker = alertMarker(line);
    expect(marker).not.toBeNull();
    expect(line.slice(marker!.start, marker!.end)).toBe("[!WARNING]");
  });

  it("rejects inline, nested, indented, and near-match markers", () => {
    expect(alertMarker("plain text")).toBeNull();
    expect(alertMarker("> text [!NOTE]")).toBeNull();
    expect(alertMarker("> [!NOTE]text")).toBeNull();
    expect(alertMarker("> [!UNKNOWN]")).toBeNull();
    expect(alertMarker("> [!NOTE")).toBeNull();
    expect(alertMarker("> > [!NOTE]")).toBeNull();
    expect(alertMarker("    > [!NOTE]")).toBeNull();
  });

  it("tolerates a trailing carriage return", () => {
    expect(alertMarker("> [!NOTE]\r")?.kind).toBe("note");
  });
});

describe("alertClass", () => {
  it("returns the shared block class and the per-kind accent", () => {
    expect(alertClass("caution")).toBe("cm-live-alert cm-live-alert-caution");
  });
});
