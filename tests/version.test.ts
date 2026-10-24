import { describe, expect, it } from "vitest";
import { APP_SEMVER, displayVersion } from "../src/lib/version";

describe("displayVersion", () => {
  it("maps technical release versions to the product display format", () => {
    expect(displayVersion("0.1.0")).toBe("0.01");
    expect(displayVersion("0.2.0")).toBe("0.02");
    expect(displayVersion("0.10.0")).toBe("0.10");
  });

  it("shows the current package version as 0.24", () => {
    expect(APP_SEMVER).toBe("0.24.0");
    expect(displayVersion()).toBe("0.24");
  });

  it("does not hide unexpected versions", () => {
    expect(displayVersion("0.1.1")).toBe("0.1.1");
    expect(displayVersion("1.0.0")).toBe("1.0.0");
  });
});
