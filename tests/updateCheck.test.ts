import { describe, expect, it, afterEach } from "vitest";
import {
  checkForUpdate,
  isNewerRelease,
  parseProductVersion,
  parseRelease,
  setReleaseFetcher,
  type ReleaseInfo,
} from "../src/lib/updateCheck";

const release: ReleaseInfo = {
  tag: "v0.99",
  name: "MarkSI 0.99",
  url: "https://github.com/fuzhengqu/marksi/releases/tag/v0.99",
  notes: "Notes",
  publishedAt: "2026-11-15T00:00:00Z",
};

afterEach(() => {
  setReleaseFetcher(null);
});

describe("product version parsing", () => {
  it("accepts two-part and three-part release versions", () => {
    expect(parseProductVersion("0.68")).toBe(68);
    expect(parseProductVersion("v0.69")).toBe(69);
    expect(parseProductVersion("0.69.0")).toBe(69);
    expect(parseProductVersion("1.00")).toBe(100);
    expect(parseProductVersion("1.0.0")).toBe(100);
  });

  it("rejects invalid or patch release versions", () => {
    expect(parseProductVersion("0.100")).toBeNull();
    expect(parseProductVersion("v0.69.1")).toBeNull();
    expect(parseProductVersion("release")).toBeNull();
  });

  it("compares releases monotonically", () => {
    expect(isNewerRelease("0.68.0", "v0.69")).toBe(true);
    expect(isNewerRelease("0.69.0", "v0.69")).toBe(false);
    expect(isNewerRelease("0.99.0", "1.00")).toBe(true);
    expect(isNewerRelease("0.68.0", "invalid")).toBe(false);
  });
});

describe("release payload parsing", () => {
  it("keeps a safe GitHub release", () => {
    expect(
      parseRelease({
        tag_name: "v0.99",
        name: "MarkSI 0.99",
        html_url: "https://github.com/fuzhengqu/marksi/releases/tag/v0.99",
        body: "Notes",
        published_at: "2026-11-15T00:00:00Z",
        draft: false,
        prerelease: false,
      }),
    ).toEqual(release);
  });

  it("rejects drafts, prereleases, unsafe URLs, and missing tags", () => {
    const base = {
      tag_name: "v0.99",
      html_url: "https://github.com/fuzhengqu/marksi/releases/tag/v0.99",
    };
    expect(parseRelease({ ...base, draft: true })).toBeNull();
    expect(parseRelease({ ...base, prerelease: true })).toBeNull();
    expect(
      parseRelease({ ...base, html_url: "https://example.com/release" }),
    ).toBeNull();
    expect(parseRelease({ ...base, tag_name: "" })).toBeNull();
  });
});

describe("update checks", () => {
  it("reports an available update", async () => {
    setReleaseFetcher(async () => release);
    const result = await checkForUpdate("0.68.0");
    expect(result.status).toBe("available");
    if (result.status === "available") {
      expect(result.current).toBe("0.68");
      expect(result.release.tag).toBe("v0.99");
    }
  });

  it("reports the current version", async () => {
    setReleaseFetcher(async () => release);
    const result = await checkForUpdate("0.99.0");
    expect(result.status).toBe("current");
  });

  it("turns fetcher failures into an error state", async () => {
    setReleaseFetcher(async () => {
      throw new Error("offline");
    });
    const result = await checkForUpdate("0.68.0");
    expect(result).toMatchObject({
      status: "error",
      current: "0.68",
      message: "offline",
    });
  });
});
