import { describe, expect, it } from "vitest";
import {
  parseSettingsJson,
  serializeSettings,
} from "../src/lib/settingsJson";
import { DEFAULT_SETTINGS } from "../src/store/useAppStore";

describe("advanced settings JSON", () => {
  it("round-trips the current settings", () => {
    const text = serializeSettings(DEFAULT_SETTINGS);
    const result = parseSettingsJson(text, DEFAULT_SETTINGS);
    expect(result.settings).toEqual(DEFAULT_SETTINGS);
    expect(result.warnings).toEqual([]);
  });

  it("applies valid partial updates and ignores unknown keys", () => {
    const result = parseSettingsJson(
      JSON.stringify({
        language: "en",
        editorFontSize: 18,
        contentWidth: 900,
        autoSaveDelayMs: 3000,
        imageAssetFolder: "media/images",
        flatFileList: true,
        loadRemoteImages: true,
        nativeTitleBar: true,
        theme: "dark",
      }),
      DEFAULT_SETTINGS,
    );
    expect(result.settings.language).toBe("en");
    expect(result.settings.editorFontSize).toBe(18);
    expect(result.settings.contentWidth).toBe(900);
    expect(result.settings.autoSaveDelayMs).toBe(3000);
    expect(result.settings.imageAssetFolder).toBe("media/images");
    expect(result.settings.flatFileList).toBe(true);
    expect(result.settings.loadRemoteImages).toBe(true);
    expect(result.settings.nativeTitleBar).toBe(true);
    expect(result.warnings).toContain("Unknown setting ignored: theme");
  });

  it("keeps current values and warns for invalid fields", () => {
    const result = parseSettingsJson(
      JSON.stringify({
        language: "fr",
        editorFontSize: 40,
        contentWidth: 500,
        zoomLevel: 4,
        autoSaveDelayMs: 123,
        imageAssetFolder: "../outside",
        spellcheck: "yes",
        exportOptions: [],
        shortcuts: "Ctrl+N",
      }),
      DEFAULT_SETTINGS,
    );
    expect(result.settings.language).toBe(DEFAULT_SETTINGS.language);
    expect(result.settings.editorFontSize).toBe(DEFAULT_SETTINGS.editorFontSize);
    expect(result.settings.contentWidth).toBe(DEFAULT_SETTINGS.contentWidth);
    expect(result.settings.zoomLevel).toBe(1.6);
    expect(result.settings.autoSaveDelayMs).toBe(
      DEFAULT_SETTINGS.autoSaveDelayMs,
    );
    expect(result.settings.imageAssetFolder).toBe(
      DEFAULT_SETTINGS.imageAssetFolder,
    );
    expect(result.settings.spellcheck).toBe(DEFAULT_SETTINGS.spellcheck);
    expect(result.settings.exportOptions).toEqual(
      DEFAULT_SETTINGS.exportOptions,
    );
    expect(result.settings.shortcuts).toEqual(DEFAULT_SETTINGS.shortcuts);
    expect(result.warnings.length).toBeGreaterThanOrEqual(9);
    expect(result.warnings.some((warning) => warning.includes("zoomLevel"))).toBe(
      true,
    );
  });

  it("normalizes export options and shortcuts", () => {
    const result = parseSettingsJson(
      JSON.stringify({
        exportOptions: { profile: "custom", header: "{title}" },
        shortcuts: { save: "Ctrl+Alt+S", open: "Ctrl+Alt+O" },
      }),
      DEFAULT_SETTINGS,
    );
    expect(result.settings.exportOptions.profile).toBe("custom");
    expect(result.settings.exportOptions.header).toBe("{title}");
    expect(result.settings.shortcuts.save).toBe("Ctrl+Alt+S");
    expect(result.settings.shortcuts.open).toBe("Ctrl+Alt+O");
  });

  it("rejects malformed documents before touching settings", () => {
    expect(() => parseSettingsJson("{", DEFAULT_SETTINGS)).toThrow(
      "Invalid JSON",
    );
    expect(() => parseSettingsJson("[]", DEFAULT_SETTINGS)).toThrow(
      "JSON object",
    );
    expect(() => parseSettingsJson("null", DEFAULT_SETTINGS)).toThrow(
      "JSON object",
    );
  });
});
