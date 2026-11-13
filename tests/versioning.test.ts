import { describe, expect, it } from "vitest";
import {
  nextReleaseVersion,
  parseSemver,
  productVersion,
  releaseTag,
  versionCodeFor,
} from "../scripts/versioning.mjs";

describe("productVersion", () => {
  it("maps technical versions to two-part product names", () => {
    expect(productVersion("0.1.0")).toBe("0.01");
    expect(productVersion("0.61.0")).toBe("0.61");
    expect(productVersion("1.0.0")).toBe("1.00");
    expect(productVersion("1.1.0")).toBe("1.01");
    expect(productVersion("1.10.0")).toBe("1.10");
  });

  it("rejects 0.100-style versions", () => {
    expect(() => productVersion("0.100.0")).toThrow("1.0.0");
  });
});

describe("versionCodeFor", () => {
  it("increases monotonically across normal and milestone releases", () => {
    expect(versionCodeFor("0.1.0")).toBe(1);
    expect(versionCodeFor("0.9.0")).toBe(9);
    expect(versionCodeFor("0.10.0")).toBe(10);
    expect(versionCodeFor("0.61.0")).toBe(61);
    expect(versionCodeFor("0.99.0")).toBe(99);
    expect(versionCodeFor("1.0.0")).toBe(100);
    expect(versionCodeFor("1.1.0")).toBe(101);
    expect(versionCodeFor("1.99.0")).toBe(199);
  });
});

describe("releaseTag", () => {
  it("uses the two-part product version", () => {
    expect(releaseTag("0.61.0")).toBe("v0.61");
    expect(releaseTag("1.0.0")).toBe("v1.00");
  });
});

describe("nextReleaseVersion", () => {
  it("adds one minor step by default", () => {
    expect(nextReleaseVersion("0.61.0")).toBe("0.62.0");
    expect(nextReleaseVersion("1.0.0")).toBe("1.1.0");
  });

  it("moves 0.99.0 directly to 1.0.0", () => {
    expect(nextReleaseVersion("0.99.0")).toBe("1.0.0");
  });

  it("supports explicit milestone jumps in two- or three-part form", () => {
    expect(nextReleaseVersion("0.61.0", "0.70")).toBe("0.70.0");
    expect(nextReleaseVersion("0.20.0", "1.0.0")).toBe("1.0.0");
  });

  it("rejects 0.100.0, patch releases, and non-increasing targets", () => {
    expect(() => nextReleaseVersion("0.99.0", "0.100.0")).toThrow("1.0.0");
    expect(() => nextReleaseVersion("0.61.0", "0.61.1")).toThrow(".0");
    expect(() => nextReleaseVersion("0.61.0", "0.61")).toThrow("increase");
  });
});

describe("parseSemver", () => {
  it("rejects non-three-part values", () => {
    expect(() => parseSemver("0.61")).toThrow("three-part");
    expect(parseSemver("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
  });
});
