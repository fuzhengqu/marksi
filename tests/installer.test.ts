import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = JSON.parse(
  readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"),
);

describe("Windows installer packaging", () => {
  it("ships one NSIS installer with all three interface languages", () => {
    expect(config.bundle.windows.nsis.languages).toEqual([
      "English",
      "SimpChinese",
      "TradChinese",
    ]);
    expect(config.bundle.windows.nsis.displayLanguageSelector).not.toBe(true);
  });

  it("keeps a single en-US WiX MSI instead of per-language MSIs", () => {
    expect(config.bundle.windows.wix?.language ?? "en-US").toBe("en-US");
  });
});
