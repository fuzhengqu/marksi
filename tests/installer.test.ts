import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const config = JSON.parse(
  readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"),
);

function bitmapSize(relativePath: string): { width: number; height: number } {
  const data = readFileSync(
    new URL(`../src-tauri/${relativePath}`, import.meta.url),
  );
  expect(data.subarray(0, 2).toString("ascii")).toBe("BM");
  return {
    width: data.readUInt32LE(18),
    height: data.readUInt32LE(22),
  };
}

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

  it("keeps the existing MIT license file", () => {
    expect(config.bundle.licenseFile).toBe("../LICENSE");
  });

  it("publishes product and project metadata", () => {
    expect(config.bundle.publisher).toBe("MarkSI contributors");
    expect(config.bundle.homepage).toBe(
      "https://github.com/fuzhengqu/marksi",
    );
    expect(config.bundle.copyright).toContain("MarkSI contributors");
  });

  it("uses branded NSIS installer art", () => {
    const nsis = config.bundle.windows.nsis;
    expect(nsis.installerIcon).toBe("icons/icon.ico");
    expect(nsis.uninstallerIcon).toBe("icons/icon.ico");
    expect(nsis.startMenuFolder).toBe("MarkSI");
    expect(bitmapSize(nsis.headerImage)).toEqual({
      width: 150,
      height: 57,
    });
    expect(bitmapSize(nsis.uninstallerHeaderImage)).toEqual({
      width: 150,
      height: 57,
    });
    expect(bitmapSize(nsis.sidebarImage)).toEqual({
      width: 164,
      height: 314,
    });
  });

  it("uses branded WiX banner and dialog art", () => {
    const wix = config.bundle.windows.wix;
    expect(bitmapSize(wix.bannerPath)).toEqual({ width: 493, height: 58 });
    expect(bitmapSize(wix.dialogImagePath)).toEqual({
      width: 493,
      height: 312,
    });
  });
});
