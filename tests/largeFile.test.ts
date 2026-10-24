import { describe, expect, it } from "vitest";
import {
  isLargeDocument,
  LARGE_FILE_CHARS,
} from "../src/lib/largeFile";

describe("large file mode", () => {
  it("switches exactly at the documented threshold", () => {
    expect(isLargeDocument("a".repeat(LARGE_FILE_CHARS - 1))).toBe(false);
    expect(isLargeDocument("a".repeat(LARGE_FILE_CHARS))).toBe(true);
    expect(isLargeDocument("a".repeat(LARGE_FILE_CHARS + 1))).toBe(true);
  });

  it("supports an explicit threshold for focused checks", () => {
    expect(isLargeDocument("abcdef", 6)).toBe(true);
    expect(isLargeDocument("abcde", 6)).toBe(false);
  });
});
