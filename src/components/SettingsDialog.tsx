import { useEffect } from "react";
import {
  Focus,
  Image as ImageIcon,
  RotateCcw,
  Save,
  Settings,
  Type,
  X,
} from "lucide-react";
import { useT } from "../i18n";
import { ZOOM_MAX, ZOOM_MIN, zoomPercent } from "../lib/zoom";
import { useAppStore } from "../store/useAppStore";
import type { AppSettings, Language, Theme } from "../types";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch ${checked ? "is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-knob" />
    </button>
  );
}

export function SettingsDialog() {
  const t = useT();
  const open = useAppStore((state) => state.settingsOpen);
  const settings = useAppStore((state) => state.settings);
  const theme = useAppStore((state) => state.theme);
  const setOpen = useAppStore((state) => state.setSettingsOpen);
  const setTheme = useAppStore((state) => state.setTheme);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const resetSettings = useAppStore((state) => state.resetSettings);

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

  return (
    <div className="modal-scrim" onMouseDown={() => setOpen(false)}>
      <div
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
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
                <small>{t("Choose the writing environment.")}</small>
              </div>
              <div
                className="segmented-control"
                role="group"
                aria-label={t("Theme")}
              >
                {(["light", "dark"] as Theme[]).map((value) => (
                  <button
                    key={value}
                    className={theme === value ? "is-active" : ""}
                    onClick={() => setTheme(value)}
                  >
                    {value === "light" ? t("Light") : t("Dark")}
                  </button>
                ))}
              </div>
            </div>

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
            <p className="settings-note">
              {t(
                "Unsaved drafts are always kept locally for crash recovery. MarkSI never sends document content anywhere.",
              )}
            </p>
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
