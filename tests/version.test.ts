import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_SEMVER, displayVersion } from "../src/lib/version";

const packageVersion = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;

describe("displayVersion", () => {
  it("maps technical release versions to the product display format", () => {
    expect(displayVersion("0.1.0")).toBe("0.01");
    expect(displayVersion("0.2.0")).toBe("0.02");
    expect(displayVersion("0.10.0")).toBe("0.10");
  });

  it("shows the current package version", () => {
    expect(APP_SEMVER).toBe(packageVersion);
    expect(displayVersion()).toBe(
      packageVersion.replace(/^0\.(\d+)\.0$/, "0.$1"),
    );
    expect(displayVersion()).not.toMatch(/\.0$/);
  });

  it("does not hide unexpected versions", () => {
    expect(displayVersion("0.1.1")).toBe("0.1.1");
    expect(displayVersion("1.0.0")).toBe("1.0.0");
  });
});
