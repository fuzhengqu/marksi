import { normalizeExportOptions } from "./exportOptions";
import { normalizeRelativeFolder } from "./fileOps";
import { normalizeShortcuts } from "./shortcuts";
import { clampZoom, ZOOM_MAX, ZOOM_MIN } from "./zoom";
import type { AppSettings, Language } from "../types";

const BOOLEAN_KEYS = [
  "spellcheck",
  "autoSave",
  "focusMode",
  "typewriterMode",
  "readOnlyMode",
  "autoPair",
  "smartPunctuation",
  "emojiAutocomplete",
  "strictMode",
  "loadRemoteImages",
  "flatFileList",
  "localHistory",
  "largeFileOptimizations",
  "nativeTitleBar",
  "rememberWindowFrame",
  "restoreSession",
] as const;

const AUTO_SAVE_DELAYS = [800, 1500, 3000, 5000];
const SETTING_KEYS = new Set([
  "language",
  "editorFontSize",
  "contentWidth",
  "zoomLevel",
  "spellcheck",
  "autoSave",
  "autoSaveDelayMs",
  "imageAssetFolder",
  "focusMode",
  "typewriterMode",
  "readOnlyMode",
  "autoPair",
  "smartPunctuation",
  "emojiAutocomplete",
  "strictMode",
  "exportOptions",
  "customExportProgram",
  "customExportArgs",
  "pandocPath",
  "loadRemoteImages",
  "imageRootPath",
  "imageRootUrl",
  "flatFileList",
  "localHistory",
  "largeFileOptimizations",
  "nativeTitleBar",
  "rememberWindowFrame",
  "restoreSession",
  "customTheme",
  "shortcuts",
]);

export interface SettingsParseResult {
  settings: AppSettings;
  warnings: string[];
}

function cleanText(value: unknown, fallback: string, limit: number): string {
  if (typeof value !== "string") {
    return fallback;
  }
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .slice(0, limit);
}

function integerInRange(
  value: unknown,
  min: number,
  max: number,
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    return null;
  }
  return value;
}

export function serializeSettings(settings: AppSettings): string {
  return JSON.stringify(settings, null, 2);
}

export function parseSettingsJson(
  text: string,
  current: AppSettings,
): SettingsParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(
      `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Settings must be a JSON object.");
  }

  const input = parsed as Record<string, unknown>;
  const warnings: string[] = [];
  for (const key of Object.keys(input)) {
    if (!SETTING_KEYS.has(key)) {
      warnings.push(`Unknown setting ignored: ${key}`);
    }
  }

  const settings: AppSettings = { ...current };

  if (input.language !== undefined) {
    if (input.language === "zh-CN" || input.language === "en") {
      settings.language = input.language as Language;
    } else {
      warnings.push("language must be \"zh-CN\" or \"en\".");
    }
  }

  if (input.editorFontSize !== undefined) {
    const value = integerInRange(input.editorFontSize, 14, 22);
    if (value === null) {
      warnings.push("editorFontSize must be an integer from 14 to 22.");
    } else {
      settings.editorFontSize = value;
    }
  }

  if (input.contentWidth !== undefined) {
    const value = integerInRange(input.contentWidth, 680, 1100);
    if (value === null) {
      warnings.push("contentWidth must be an integer from 680 to 1100.");
    } else {
      settings.contentWidth = value;
    }
  }

  if (input.zoomLevel !== undefined) {
    if (typeof input.zoomLevel !== "number" || !Number.isFinite(input.zoomLevel)) {
      warnings.push("zoomLevel must be a number.");
    } else {
      const zoom = clampZoom(input.zoomLevel);
      if (zoom !== Math.round(input.zoomLevel * 100) / 100) {
        warnings.push(
          `zoomLevel was clamped to ${ZOOM_MIN}–${ZOOM_MAX}.`,
        );
      }
      settings.zoomLevel = zoom;
    }
  }

  for (const key of BOOLEAN_KEYS) {
    const value = input[key];
    if (value === undefined) {
      continue;
    }
    if (typeof value === "boolean") {
      settings[key] = value;
    } else {
      warnings.push(`${key} must be true or false.`);
    }
  }

  if (input.autoSaveDelayMs !== undefined) {
    if (
      typeof input.autoSaveDelayMs !== "number" ||
      !AUTO_SAVE_DELAYS.includes(input.autoSaveDelayMs)
    ) {
      warnings.push(
        `autoSaveDelayMs must be one of ${AUTO_SAVE_DELAYS.join(", ")}.`,
      );
    } else {
      settings.autoSaveDelayMs = input.autoSaveDelayMs;
    }
  }

  if (input.imageAssetFolder !== undefined) {
    const folder =
      typeof input.imageAssetFolder === "string"
        ? normalizeRelativeFolder(input.imageAssetFolder)
        : null;
    if (!folder || folder.length > 120) {
      warnings.push(
        "imageAssetFolder must be a non-empty relative folder inside the document.",
      );
    } else {
      settings.imageAssetFolder = folder;
    }
  }

  if (input.customExportProgram !== undefined) {
    settings.customExportProgram = cleanText(
      input.customExportProgram,
      current.customExportProgram,
      1_000,
    );
  }

  if (input.customExportArgs !== undefined) {
    settings.customExportArgs = cleanText(
      input.customExportArgs,
      current.customExportArgs,
      4_000,
    );
  }

  if (input.pandocPath !== undefined) {
    settings.pandocPath = cleanText(
      input.pandocPath,
      current.pandocPath,
      1_000,
    );
  }

  if (input.imageRootPath !== undefined) {
    settings.imageRootPath = cleanText(
      input.imageRootPath,
      current.imageRootPath,
      1_000,
    );
  }

  if (input.imageRootUrl !== undefined) {
    settings.imageRootUrl = cleanText(
      input.imageRootUrl,
      current.imageRootUrl,
      2_000,
    );
  }

  if (input.customTheme !== undefined) {
    if (
      typeof input.customTheme === "string" &&
      input.customTheme.length <= 128 &&
      !/[\u0000-\u001f\u007f]/.test(input.customTheme) &&
      (input.customTheme === "" || /\.css$/i.test(input.customTheme))
    ) {
      settings.customTheme = input.customTheme;
    } else {
      warnings.push(
        "customTheme must be an empty string or a .css file name.",
      );
    }
  }

  if (input.exportOptions !== undefined) {
    if (
      input.exportOptions &&
      typeof input.exportOptions === "object" &&
      !Array.isArray(input.exportOptions)
    ) {
      settings.exportOptions = normalizeExportOptions({
        ...current.exportOptions,
        ...(input.exportOptions as Record<string, unknown>),
      });
    } else {
      warnings.push("exportOptions must be a JSON object.");
    }
  }

  if (input.shortcuts !== undefined) {
    if (input.shortcuts && typeof input.shortcuts === "object") {
      settings.shortcuts = normalizeShortcuts(input.shortcuts);
    } else {
      warnings.push("shortcuts must be a JSON object.");
    }
  }

  return { settings, warnings };
}
