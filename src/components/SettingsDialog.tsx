import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Braces,
  FileJson,
  Focus,
  Image as ImageIcon,
  Keyboard,
  Palette,
  RotateCcw,
  Save,
  Settings,
  Terminal,
  Type,
  X,
} from "lucide-react";
import { useT } from "../i18n";
import type { CustomTheme } from "../lib/customThemes";
import {
  clearRemoteImageCache,
  listCustomThemes,
  openCustomThemesFolder,
  pandocVersion,
} from "../lib/platform";
import {
  parseSettingsJson,
  serializeSettings,
} from "../lib/settingsJson";
import { useFocusTrap } from "../lib/useFocusTrap";
import { ZOOM_MAX, ZOOM_MIN, zoomPercent } from "../lib/zoom";
import { useAppStore } from "../store/useAppStore";
import type { AppSettings, Language, Theme } from "../types";
import { ShortcutEditor } from "./ShortcutEditor";
import { Toggle } from "./Toggle";

export function SettingsDialog() {
  const t = useT();
  const open = useAppStore((state) => state.settingsOpen);
  const settings = useAppStore((state) => state.settings);
  const theme = useAppStore((state) => state.theme);
  const setOpen = useAppStore((state) => state.setSettingsOpen);
  const setTheme = useAppStore((state) => state.setTheme);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const resetSettings = useAppStore((state) => state.resetSettings);
  const [pandocDetected, setPandocDetected] = useState<string | null>(null);
  const [pandocError, setPandocError] = useState<string | null>(null);
  const [pandocDetecting, setPandocDetecting] = useState(false);
  const [clearingRemoteCache, setClearingRemoteCache] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonWarnings, setJsonWarnings] = useState<string[]>([]);
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
  const [themesLoading, setThemesLoading] = useState(false);
  const [themesError, setThemesError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(open, dialogRef);

  async function loadThemes(): Promise<void> {
    setThemesLoading(true);
    setThemesError(null);
    try {
      setCustomThemes(await listCustomThemes());
    } catch (error) {
      setCustomThemes([]);
      setThemesError(error instanceof Error ? error.message : String(error));
    } finally {
      setThemesLoading(false);
    }
  }

  async function reloadThemes(): Promise<void> {
    await loadThemes();
    window.dispatchEvent(new Event("marksi:themes-changed"));
  }

  async function openThemesFolder(): Promise<void> {
    try {
      await openCustomThemesFolder();
    } catch (error) {
      useAppStore
        .getState()
        .showToast(
          error instanceof Error ? error.message : String(error),
          "error",
        );
    }
  }

  useEffect(() => {
    if (open) {
      void loadThemes();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  if (!open) {
    return null;
  }

  function update<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) {
    updateSettings({ [key]: value } as Pick<AppSettings, K>);
  }

  function toggleJson(): void {
    if (jsonOpen) {
      setJsonOpen(false);
      return;
    }
    setJsonText(serializeSettings(useAppStore.getState().settings));
    setJsonError(null);
    setJsonWarnings([]);
    setJsonOpen(true);
  }

  function reloadJson(): void {
    setJsonText(serializeSettings(useAppStore.getState().settings));
    setJsonError(null);
    setJsonWarnings([]);
  }

  function applyJson(): void {
    try {
      const result = parseSettingsJson(
        jsonText,
        useAppStore.getState().settings,
      );
      updateSettings(result.settings);
      setJsonText(serializeSettings(result.settings));
      setJsonWarnings(result.warnings);
      setJsonError(null);
      useAppStore
        .getState()
        .showToast(t("Settings applied."), "success");
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : String(error));
      setJsonWarnings([]);
    }
  }

  async function copyJson(): Promise<void> {
    try {
      await navigator.clipboard.writeText(jsonText);
      useAppStore
        .getState()
        .showToast(t("Settings JSON copied."), "success");
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : String(error));
    }
  }

  async function clearRemoteCache(): Promise<void> {
    setClearingRemoteCache(true);
    try {
      const count = await clearRemoteImageCache();
      useAppStore
        .getState()
        .showToast(
          count > 0
            ? t("Cleared {count} cached images.", { count })
            : t("Remote image cache is already empty."),
          "success",
        );
    } catch (error) {
      useAppStore
        .getState()
        .showToast(
          error instanceof Error ? error.message : String(error),
          "error",
        );
    } finally {
      setClearingRemoteCache(false);
    }
  }

  async function detectPandoc(): Promise<void> {
    setPandocDetecting(true);
    setPandocDetected(null);
    setPandocError(null);
    try {
      setPandocDetected(await pandocVersion(settings.pandocPath));
    } catch (error) {
      setPandocError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setPandocDetecting(false);
    }
  }

  return (
    <div className="modal-scrim" onMouseDown={() => setOpen(false)}>
      <div
        ref={dialogRef}
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="settings-header">
          <span className="settings-mark" aria-hidden="true">
            <Settings size={17} strokeWidth={1.8} />
          </span>
          <div>
            <h2 id="settings-title">{t("Preferences")}</h2>
            <p>{t("Changes apply immediately and stay on this device.")}</p>
          </div>
          <button
            className="modal-close settings-close"
            onClick={() => setOpen(false)}
            aria-label={t("Close preferences")}
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </header>

        <div className="settings-body">
          <section className="settings-section">
            <div className="settings-section-heading">
              <Type size={15} strokeWidth={1.8} />
              <span>{t("Appearance")}</span>
            </div>

            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Theme")}</span>
                <small>
                  {t("Follow the operating system or choose a fixed appearance.")}
                </small>
              </div>
              <select
                className="settings-select theme-select"
                value={theme}
                aria-label={t("Theme")}
                onChange={(event) => setTheme(event.target.value as Theme)}
              >
                <option value="system">{t("System")}</option>
                <option value="light">{t("Light")}</option>
                <option value="dark">{t("Dark")}</option>
                <option value="sepia">{t("Sepia")}</option>
                <option value="contrast">{t("High contrast")}</option>
              </select>
            </div>

            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Custom CSS theme")}</span>
                <small>
                  {t("Load a local .css file from the themes folder.")}
                </small>
              </div>
              <select
                className="settings-select custom-theme-select"
                value={settings.customTheme}
                aria-label={t("Custom CSS theme")}
                onChange={(event) =>
                  update("customTheme", event.target.value)
                }
              >
                <option value="">{t("None")}</option>
                {customThemes.map((theme) => (
                  <option key={theme.name} value={theme.name}>
                    {theme.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="custom-theme-actions">
              <button
                className="button button-quiet"
                onClick={() => void reloadThemes()}
                disabled={themesLoading}
              >
                <RotateCcw size={13} strokeWidth={1.8} />
                {themesLoading ? t("Loading themes…") : t("Reload themes")}
              </button>
              <button
                className="button button-quiet custom-themes-folder"
                onClick={() => void openThemesFolder()}
              >
                <Palette size={13} strokeWidth={1.8} />
                {t("Open themes folder")}
              </button>
            </div>
            {themesError ? (
              <p className="settings-json-error">{themesError}</p>
            ) : null}
            {settings.customTheme &&
            !themesLoading &&
            !customThemes.some((theme) => theme.name === settings.customTheme) ? (
              <p className="settings-json-error">
                {t("Theme file not found: {name}", {
                  name: settings.customTheme,
                })}
              </p>
            ) : null}
            <p className="settings-note">
              {t(
                "Remote @import rules and every non-data url() are removed before a theme is applied. Only load CSS files that you trust.",
              )}
            </p>

            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Language")}</span>
                <small>{t("Interface language")}</small>
              </div>
              <div
                className="segmented-control"
                role="group"
                aria-label={t("Language")}
              >
                {(["zh-CN", "en"] as Language[]).map((value) => (
                  <button
                    key={value}
                    className={settings.language === value ? "is-active" : ""}
                    onClick={() => update("language", value)}
                  >
                    {value === "zh-CN" ? "中文" : "English"}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Editor text size")}</span>
                <small>{settings.editorFontSize}px</small>
              </div>
              <input
                className="settings-range"
                type="range"
                min={14}
                max={22}
                step={1}
                value={settings.editorFontSize}
                onChange={(event) =>
                  update("editorFontSize", Number(event.target.value))
                }
                aria-label={t("Editor text size")}
              />
            </div>

            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Interface zoom")}</span>
                <small>
                  {zoomPercent(settings.zoomLevel)}% · {t("Scale the whole window.")}
                </small>
              </div>
              <input
                className="settings-range"
                type="range"
                min={Math.round(ZOOM_MIN * 100)}
                max={Math.round(ZOOM_MAX * 100)}
                step={10}
                value={zoomPercent(settings.zoomLevel)}
                onChange={(event) =>
                  update("zoomLevel", Number(event.target.value) / 100)
                }
                aria-label={t("Interface zoom")}
              />
            </div>

            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Writing column")}</span>
                <small>{settings.contentWidth}px</small>
              </div>
              <input
                className="settings-range"
                type="range"
                min={680}
                max={1100}
                step={20}
                value={settings.contentWidth}
                onChange={(event) =>
                  update("contentWidth", Number(event.target.value))
                }
                aria-label={t("Writing column width")}
              />
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <Type size={15} strokeWidth={1.8} />
              <span>{t("Editor")}</span>
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Spell check")}</span>
                <small>{t("Use the operating system dictionary while writing.")}</small>
              </div>
              <Toggle
                label={t("Spell check")}
                checked={settings.spellcheck}
                onChange={(value) => update("spellcheck", value)}
              />
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Auto pair")}</span>
                <small>
                  {t("Close brackets, quotes, and Markdown markers as you type.")}
                </small>
              </div>
              <Toggle
                label={t("Auto pair brackets and Markdown markers")}
                checked={settings.autoPair}
                onChange={(value) => update("autoPair", value)}
              />
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Smart punctuation")}</span>
                <small>{t("Use curly quotes, dashes, and ellipses in prose.")}</small>
              </div>
              <Toggle
                label={t("Smart punctuation")}
                checked={settings.smartPunctuation}
                onChange={(value) => update("smartPunctuation", value)}
              />
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Emoji autocomplete")}</span>
                <small>{t("Suggest emoji when you type a colon alias.")}</small>
              </div>
              <Toggle
                label={t("Emoji autocomplete")}
                checked={settings.emojiAutocomplete}
                onChange={(value) => update("emojiAutocomplete", value)}
              />
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Large-file optimizations")}</span>
                <small>
                  {t(
                    "Documents over 500,000 characters disable live preview decorations, spell check, and emoji suggestions.",
                  )}
                </small>
              </div>
              <Toggle
                label={t("Large-file optimizations")}
                checked={settings.largeFileOptimizations}
                onChange={(value) =>
                  update("largeFileOptimizations", value)
                }
              />
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <Keyboard size={15} strokeWidth={1.8} />
              <span>{t("Keyboard shortcuts")}</span>
            </div>
            <p className="settings-note">
              {t(
                "Custom shortcuts cover application commands; editor formatting keeps its standard keys.",
              )}
            </p>
            <ShortcutEditor />
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <Braces size={15} strokeWidth={1.8} />
              <span>{t("Markdown")}</span>
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Strict mode")}</span>
                <small>
                  {t(
                    "Require whitespace after ATX heading markers and use strict list indentation. Disable for compact headings such as ###Title and lax nested lists.",
                  )}
                </small>
              </div>
              <Toggle
                label={t("Strict mode")}
                checked={settings.strictMode}
                onChange={(value) => update("strictMode", value)}
              />
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <Focus size={15} strokeWidth={1.8} />
              <span>{t("Writing")}</span>
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Focus mode")}</span>
                <small>{t("Dim everything except the current paragraph.")}</small>
              </div>
              <Toggle
                label={t("Focus mode")}
                checked={settings.focusMode}
                onChange={(value) => update("focusMode", value)}
              />
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Typewriter mode")}</span>
                <small>
                  {t("Keep the line you are writing vertically centered.")}
                </small>
              </div>
              <Toggle
                label={t("Typewriter mode")}
                checked={settings.typewriterMode}
                onChange={(value) => update("typewriterMode", value)}
              />
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Read-only mode")}</span>
                <small>
                  {t("Read, search, copy, and export without editing.")}
                </small>
              </div>
              <Toggle
                label={t("Read-only mode")}
                checked={settings.readOnlyMode}
                onChange={(value) => update("readOnlyMode", value)}
              />
            </div>
            <p className="settings-note">
              {t(
                "These modes also live in the View menu. Focus, typewriter, and read-only use Ctrl Alt F, Ctrl Alt T, and Ctrl Alt R.",
              )}
            </p>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <ImageIcon size={15} strokeWidth={1.8} />
              <span>{t("Images")}</span>
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Asset folder")}</span>
                <small>{t("Relative to the document folder.")}</small>
              </div>
              <input
                className="settings-text"
                type="text"
                value={settings.imageAssetFolder}
                placeholder="assets"
                spellCheck={false}
                onChange={(event) =>
                  update("imageAssetFolder", event.target.value)
                }
                aria-label={t("Image asset folder")}
              />
            </div>
            <p className="settings-note">
              {t(
                "Inserted, dropped, and pasted images are copied into this folder. Use a relative path such as assets or media/images.",
              )}
            </p>
            <div className="settings-row settings-row-stacked">
              <div className="settings-copy">
                <span>{t("Image root path")}</span>
                <small>
                  {t(
                    "Optional folder for /-relative images and as a fallback when an image is not next to the document.",
                  )}
                </small>
              </div>
              <input
                className="settings-text"
                type="text"
                value={settings.imageRootPath}
                placeholder="../shared"
                maxLength={4096}
                spellCheck={false}
                onChange={(event) =>
                  update("imageRootPath", event.target.value)
                }
                aria-label={t("Image root path")}
              />
            </div>
            <p className="settings-note">
              {t(
                "Use an absolute folder or a path relative to the workspace or document folder. The canonical Markdown is not changed.",
              )}
            </p>
            <div className="settings-row settings-row-stacked">
              <div className="settings-copy">
                <span>{t("Image root URL")}</span>
                <small>
                  {t(
                    "Optional web base for relative images when remote loading is enabled.",
                  )}
                </small>
              </div>
              <input
                className="settings-text"
                type="text"
                value={settings.imageRootUrl}
                placeholder="https://example.com/assets/"
                maxLength={4096}
                spellCheck={false}
                onChange={(event) =>
                  update("imageRootUrl", event.target.value)
                }
                aria-label={t("Image root URL")}
              />
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Load remote images")}</span>
                <small>
                  {t(
                    "Download remote images only after you enable this. Images are cached locally.",
                  )}
                </small>
              </div>
              <Toggle
                label={t("Load remote images")}
                checked={settings.loadRemoteImages}
                onChange={(value) => update("loadRemoteImages", value)}
              />
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Remote image cache")}</span>
                <small>
                  {t("Cached images stay on this device.")}
                </small>
              </div>
              <button
                className="button"
                onClick={() => void clearRemoteCache()}
                disabled={clearingRemoteCache}
              >
                {clearingRemoteCache
                  ? t("Clearing…")
                  : t("Clear cache")}
              </button>
            </div>
            <p className="settings-note">
              {t(
                "Remote requests go directly to the image host. Localhost, private addresses, redirects, non-image responses, and files over 10 MB are blocked. MarkSI never uploads images.",
              )}
            </p>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <Save size={15} strokeWidth={1.8} />
              <span>{t("Files")}</span>
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Auto save")}</span>
                <small>{t("Save named documents automatically after a pause.")}</small>
              </div>
              <Toggle
                label={t("Auto save")}
                checked={settings.autoSave}
                onChange={(value) => update("autoSave", value)}
              />
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Auto-save pause")}</span>
                <small>{t("How long to wait after the last edit.")}</small>
              </div>
              <select
                className="settings-select"
                value={settings.autoSaveDelayMs}
                disabled={!settings.autoSave}
                onChange={(event) =>
                  update("autoSaveDelayMs", Number(event.target.value))
                }
                aria-label={t("Auto-save pause")}
              >
                <option value={800}>{t("0.8 seconds")}</option>
                <option value={1500}>{t("1.5 seconds")}</option>
                <option value={3000}>{t("3 seconds")}</option>
                <option value={5000}>{t("5 seconds")}</option>
              </select>
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Flat file list")}</span>
                <small>
                  {t(
                    "Show every workspace file without expanding folders.",
                  )}
                </small>
              </div>
              <Toggle
                label={t("Flat file list")}
                checked={settings.flatFileList}
                onChange={(value) => update("flatFileList", value)}
              />
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Remember window size and position")}</span>
                <small>
                  {t(
                    "Restore the last window bounds when the app starts. Offscreen windows return to the nearest monitor.",
                  )}
                </small>
              </div>
              <Toggle
                label={t("Remember window size and position")}
                checked={settings.rememberWindowFrame}
                onChange={(value) => update("rememberWindowFrame", value)}
              />
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Restore last session")}</span>
                <small>
                  {t(
                    "Reopen the last document and folder at startup. A recovered draft or command-line file takes precedence.",
                  )}
                </small>
              </div>
              <Toggle
                label={t("Restore last session")}
                checked={settings.restoreSession}
                onChange={(value) => update("restoreSession", value)}
              />
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Local history")}</span>
                <small>
                  {t("Keep a capped set of snapshots when you save.")}
                </small>
              </div>
              <Toggle
                label={t("Local history")}
                checked={settings.localHistory}
                onChange={(value) => update("localHistory", value)}
              />
            </div>
            <p className="settings-note">
              {t(
                "Unsaved drafts are always kept locally for crash recovery. MarkSI never sends document content anywhere.",
              )}
            </p>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <Terminal size={15} strokeWidth={1.8} />
              <span>{t("Custom export")}</span>
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Program")}</span>
                <small>{t("Executable to run after HTML export.")}</small>
              </div>
              <input
                className="settings-text"
                type="text"
                value={settings.customExportProgram}
                placeholder="pandoc"
                maxLength={1024}
                spellCheck={false}
                onChange={(event) =>
                  update("customExportProgram", event.target.value)
                }
                aria-label={t("Program")}
              />
            </div>
            <div className="settings-row settings-row-stacked">
              <div className="settings-copy">
                <span>{t("Arguments")}</span>
                <small>{t("One argument per line.")}</small>
              </div>
              <textarea
                className="settings-textarea"
                value={settings.customExportArgs}
                placeholder={"{input}\n-o\n{input}.pdf"}
                maxLength={32_768}
                spellCheck={false}
                onChange={(event) =>
                  update("customExportArgs", event.target.value)
                }
                aria-label={t("Arguments")}
              />
            </div>
            <p className="settings-note">
              {t(
                "Placeholders: {input}, {document}, {title}. The HTML file is written first; the command runs without a shell in the exported file's folder, and a non-zero exit code is reported.",
              )}
            </p>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <BookOpen size={15} strokeWidth={1.8} />
              <span>{t("Pandoc")}</span>
            </div>
            <div className="settings-row settings-row-stacked">
              <div className="settings-copy">
                <span>{t("Pandoc executable")}</span>
                <small>
                  {t("Leave empty to use pandoc from PATH.")}
                </small>
              </div>
              <div className="pandoc-path-row">
                <input
                  className="settings-text pandoc-path"
                  type="text"
                  value={settings.pandocPath}
                  placeholder="pandoc"
                  maxLength={4096}
                  spellCheck={false}
                  onChange={(event) => {
                    setPandocDetected(null);
                    setPandocError(null);
                    update("pandocPath", event.target.value);
                  }}
                  aria-label={t("Pandoc executable")}
                />
                <button
                  className="button"
                  onClick={() => void detectPandoc()}
                  disabled={pandocDetecting}
                >
                  {pandocDetecting ? t("Checking…") : t("Detect")}
                </button>
              </div>
            </div>
            <p
              className="settings-note"
              title={pandocError ?? undefined}
            >
              {pandocDetecting
                ? t("Checking Pandoc…")
                : pandocDetected
                  ? t("Detected: {version}", { version: pandocDetected })
                  : pandocError
                    ? t("Pandoc error: {error}", {
                        error: pandocError.slice(0, 300),
                      })
                    : t(
                        "Pandoc is not bundled. Install it separately or set its executable path.",
                      )}
            </p>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <FileJson size={15} strokeWidth={1.8} />
              <span>{t("Advanced")}</span>
            </div>
            <p className="settings-note">
              {t(
                "Edit the raw preferences as JSON. Only known settings are applied; invalid values are ignored with a warning.",
              )}
            </p>
            <button
              className="button button-quiet settings-json-open"
              onClick={toggleJson}
            >
              {jsonOpen ? t("Hide settings JSON") : t("Edit settings JSON")}
            </button>
            {jsonOpen ? (
              <div className="settings-json">
                <textarea
                  className="settings-textarea settings-json-text"
                  value={jsonText}
                  spellCheck={false}
                  onChange={(event) => setJsonText(event.target.value)}
                  aria-label={t("Settings JSON")}
                />
                {jsonError ? (
                  <p className="settings-json-error">{jsonError}</p>
                ) : null}
                {jsonWarnings.length > 0 ? (
                  <div className="settings-json-warnings">
                    {jsonWarnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                ) : null}
                <div className="settings-json-actions">
                  <button className="button button-quiet" onClick={reloadJson}>
                    {t("Reload current")}
                  </button>
                  <button
                    className="button button-quiet"
                    onClick={() => void copyJson()}
                  >
                    {t("Copy JSON")}
                  </button>
                  <button
                    className="button button-primary settings-json-apply"
                    onClick={applyJson}
                  >
                    {t("Apply JSON")}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <footer className="settings-footer">
          <button
            className="button button-quiet"
            onClick={resetSettings}
            title={t("Restore default preferences")}
          >
            <RotateCcw size={14} strokeWidth={1.8} />
            {t("Reset")}
          </button>
          <button
            className="button button-primary"
            onClick={() => setOpen(false)}
          >
            {t("Done")}
          </button>
        </footer>
      </div>
    </div>
  );
}
