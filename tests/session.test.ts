import { describe, expect, it } from "vitest";
import {
  normalizeSession,
  shouldRestoreSession,
} from "../src/lib/session";

describe("session memory", () => {
  it("normalizes a saved document and workspace", () => {
    expect(
      normalizeSession({
        documentPath: " C:\\Docs\\note.md ",
        workspacePath: "C:\\Docs",
        viewMode: "source",
      }),
    ).toEqual({
      documentPath: "C:\\Docs\\note.md",
      workspacePath: "C:\\Docs",
      viewMode: "source",
    });
    expect(
      normalizeSession({
        documentPath: null,
        workspacePath: "C:\\Docs",
        viewMode: "reading",
      }),
    ).toMatchObject({ documentPath: null, viewMode: "reading" });
  });

  it("falls back to preview and rejects empty sessions", () => {
    expect(
      normalizeSession({ documentPath: "C:\\a.md", viewMode: "unknown" })
        ?.viewMode,
    ).toBe("preview");
    expect(normalizeSession({ documentPath: "  ", workspacePath: "" })).toBeNull();
    expect(normalizeSession(null)).toBeNull();
    expect(normalizeSession("session")).toBeNull();
  });

  it("restores only fresh, clean starts", () => {
    const base = {
      enabled: true,
      navigationType: "navigate",
      hasDraft: false,
      hasStartupFile: false,
      hasOpenDocument: false,
    };
    expect(shouldRestoreSession(base)).toBe(true);
    expect(shouldRestoreSession({ ...base, enabled: false })).toBe(false);
    expect(shouldRestoreSession({ ...base, navigationType: "reload" })).toBe(
      false,
    );
    expect(shouldRestoreSession({ ...base, hasDraft: true })).toBe(false);
    expect(shouldRestoreSession({ ...base, hasStartupFile: true })).toBe(false);
    expect(shouldRestoreSession({ ...base, hasOpenDocument: true })).toBe(
      false,
    );
    expect(
      shouldRestoreSession({ ...base, navigationType: null }),
    ).toBe(true);
  });
});
