import { describe, expect, it } from "vitest";
import {
  draftStorageKey,
  isMainWindow,
  windowKeyFromLocation,
} from "../src/lib/windowIdentity";

describe("window identity", () => {
  it("recognizes editor window labels", () => {
    expect(windowKeyFromLocation("?window=editor-1700000000000")).toBe(
      "editor-1700000000000",
    );
    expect(windowKeyFromLocation("?foo=1&window=editor-2")).toBe("editor-2");
  });

  it("falls back to the main window for missing or unsafe values", () => {
    expect(windowKeyFromLocation("")).toBe("main");
    expect(windowKeyFromLocation("?window=main")).toBe("main");
    expect(windowKeyFromLocation("?window=editor-")).toBe("main");
    expect(windowKeyFromLocation("?window=editor-1x")).toBe("main");
    expect(windowKeyFromLocation("?window=../../etc")).toBe("main");
  });

  it("keeps drafts separate without breaking the main key", () => {
    expect(draftStorageKey("main")).toBe("marksi-recovery-draft");
    expect(draftStorageKey("editor-7")).toBe(
      "marksi-recovery-draft:editor-7",
    );
    expect(isMainWindow("main")).toBe(true);
    expect(isMainWindow("editor-7")).toBe(false);
  });
});
