import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  APP_SEMVER,
  APP_VERSION_CODE,
  displayVersion,
  versionCodeFor,
} from "../src/lib/version";

const packageMetadata = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

describe("displayVersion", () => {
  it("maps technical release versions to the two-part product format", () => {
    expect(displayVersion("0.1.0")).toBe("0.01");
    expect(displayVersion("0.2.0")).toBe("0.02");
    expect(displayVersion("0.10.0")).toBe("0.10");
    expect(displayVersion("0.61.0")).toBe("0.61");
    expect(displayVersion("1.0.0")).toBe("1.00");
    expect(displayVersion("1.1.0")).toBe("1.01");
    expect(displayVersion("1.10.0")).toBe("1.10");
  });

  it("shows the current package version and version code", () => {
    expect(APP_SEMVER).toBe(packageMetadata.version);
    expect(APP_VERSION_CODE).toBe(packageMetadata.versionCode);
    expect(APP_VERSION_CODE).toBe(versionCodeFor(APP_SEMVER));
    expect(displayVersion()).toBe(displayVersion(APP_SEMVER));
    expect(displayVersion()).toMatch(/^\d+\.\d{2}$/);
  });

  it("does not hide unexpected patch versions", () => {
    expect(displayVersion("0.1.1")).toBe("0.1.1");
  });
});

describe("versionCodeFor", () => {
  it("increases monotonically across normal and milestone releases", () => {
    expect(versionCodeFor("0.1.0")).toBe(1);
    expect(versionCodeFor("0.10.0")).toBe(10);
    expect(versionCodeFor("0.61.0")).toBe(61);
    expect(versionCodeFor("0.99.0")).toBe(99);
    expect(versionCodeFor("1.0.0")).toBe(100);
    expect(versionCodeFor("1.1.0")).toBe(101);
  });

  it("rejects malformed versions", () => {
    expect(() => versionCodeFor("0.61")).toThrow("release version");
    expect(() => versionCodeFor("0.100.0")).toThrow("1.0.0");
  });
});
