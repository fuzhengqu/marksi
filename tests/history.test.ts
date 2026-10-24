import { describe, expect, it } from "vitest";
import { formatSnapshotSize, snapshotTime } from "../src/lib/history";

describe("history formatting", () => {
  it("formats snapshot sizes compactly", () => {
    expect(formatSnapshotSize(0)).toBe("0 B");
    expect(formatSnapshotSize(999)).toBe("999 B");
    expect(formatSnapshotSize(1536)).toBe("1.5 KB");
    expect(formatSnapshotSize(2.25 * 1024 * 1024)).toBe("2.3 MB");
    expect(formatSnapshotSize(Number.NaN)).toBe("0 B");
  });

  it("handles unknown snapshot times", () => {
    expect(snapshotTime(0, "en")).toBe("Unknown time");
    expect(snapshotTime(Number.NaN, "zh-CN")).toContain("未知");
  });
});
