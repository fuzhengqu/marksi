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
import { useAppStore } from "../store/useAppStore";
import type { AppSettings, Theme } from "../types";

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
            <h2 id="settings-title">Preferences</h2>
            <p>Changes apply immediately and stay on this device.</p>
          </div>
          <button
            className="modal-close settings-close"
            onClick={() => setOpen(false)}
            aria-label="Close preferences"
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </header>

        <div className="settings-body">
          <section className="settings-section">
            <div className="settings-section-heading">
              <Type size={15} strokeWidth={1.8} />
              <span>Appearance</span>
            </div>

            <div className="settings-row">
              <div className="settings-copy">
                <span>Theme</span>
                <small>Choose the writing environment.</small>
              </div>
              <div className="segmented-control" role="group" aria-label="Theme">
                {(["light", "dark"] as Theme[]).map((value) => (
                  <button
                    key={value}
                    className={theme === value ? "is-active" : ""}
                    onClick={() => setTheme(value)}
                  >
                    {value === "light" ? "Light" : "Dark"}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-copy">
                <span>Editor text size</span>
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
                aria-label="Editor text size"
              />
            </div>

            <div className="settings-row">
              <div className="settings-copy">
                <span>Writing column</span>
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
                aria-label="Writing column width"
              />
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <Type size={15} strokeWidth={1.8} />
              <span>Editor</span>
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>Spell check</span>
                <small>Use the operating system dictionary while writing.</small>
              </div>
              <Toggle
                label="Spell check"
                checked={settings.spellcheck}
                onChange={(value) => update("spellcheck", value)}
              />
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <Focus size={15} strokeWidth={1.8} />
              <span>Writing</span>
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>Focus mode</span>
                <small>Dim everything except the current paragraph.</small>
              </div>
              <Toggle
                label="Focus mode"
                checked={settings.focusMode}
                onChange={(value) => update("focusMode", value)}
              />
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>Typewriter mode</span>
                <small>Keep the line you are writing vertically centered.</small>
              </div>
              <Toggle
                label="Typewriter mode"
                checked={settings.typewriterMode}
                onChange={(value) => update("typewriterMode", value)}
              />
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>Read-only mode</span>
                <small>Read, search, copy, and export without editing.</small>
              </div>
              <Toggle
                label="Read-only mode"
                checked={settings.readOnlyMode}
                onChange={(value) => update("readOnlyMode", value)}
              />
            </div>
            <p className="settings-note">
              These modes also live in the View menu. Focus, typewriter, and
              read-only use <code>Ctrl Alt F</code>, <code>Ctrl Alt T</code>, and{" "}
              <code>Ctrl Alt R</code>.
            </p>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <ImageIcon size={15} strokeWidth={1.8} />
              <span>Images</span>
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>Asset folder</span>
                <small>Relative to the document folder.</small>
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
                aria-label="Image asset folder"
              />
            </div>
            <p className="settings-note">
              Inserted, dropped, and pasted images are copied into this folder.
              Use a relative path such as <code>assets</code> or{" "}
              <code>media/images</code>.
            </p>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <Save size={15} strokeWidth={1.8} />
              <span>Files</span>
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>Auto save</span>
                <small>Save named documents automatically after a pause.</small>
              </div>
              <Toggle
                label="Auto save"
                checked={settings.autoSave}
                onChange={(value) => update("autoSave", value)}
              />
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>Auto-save pause</span>
                <small>How long to wait after the last edit.</small>
              </div>
              <select
                className="settings-select"
                value={settings.autoSaveDelayMs}
                disabled={!settings.autoSave}
                onChange={(event) =>
                  update("autoSaveDelayMs", Number(event.target.value))
                }
                aria-label="Auto-save pause"
              >
                <option value={800}>0.8 seconds</option>
                <option value={1500}>1.5 seconds</option>
                <option value={3000}>3 seconds</option>
                <option value={5000}>5 seconds</option>
              </select>
            </div>
            <p className="settings-note">
              Unsaved drafts are always kept locally for crash recovery. MarkSI
              never sends document content anywhere.
            </p>
          </section>
        </div>

        <footer className="settings-footer">
          <button
            className="button button-quiet"
            onClick={resetSettings}
            title="Restore default preferences"
          >
            <RotateCcw size={14} strokeWidth={1.8} />
            Reset
          </button>
          <button
            className="button button-primary"
            onClick={() => setOpen(false)}
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
