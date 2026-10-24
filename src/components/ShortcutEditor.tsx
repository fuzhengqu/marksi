import { useEffect, useState } from "react";
import { useT } from "../i18n";
import {
  conflictLabel,
  DEFAULT_SHORTCUTS,
  eventToShortcut,
  SHORTCUT_DEFINITIONS,
  SHORTCUT_GROUPS,
  type ShortcutId,
} from "../lib/shortcuts";
import { useAppStore } from "../store/useAppStore";

export function ShortcutEditor() {
  const t = useT();
  const shortcuts = useAppStore((state) => state.settings.shortcuts);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const setShortcutRecording = useAppStore(
    (state) => state.setShortcutRecording,
  );
  const [recording, setRecording] = useState<ShortcutId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setShortcutRecording(recording !== null);
    return () => setShortcutRecording(false);
  }, [recording, setShortcutRecording]);

  useEffect(() => {
    if (!recording) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setRecording(null);
        setError(null);
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        const state = useAppStore.getState();
        state.updateSettings({
          shortcuts: { ...state.settings.shortcuts, [recording]: "" },
        });
        setRecording(null);
        setError(null);
        return;
      }
      const binding = eventToShortcut(event);
      if (!binding) {
        setError(t("Use Ctrl or Alt with another key."));
        return;
      }
      const conflict = conflictLabel(shortcuts, recording, binding);
      if (conflict) {
        setError(t("Already used by {name}.", { name: t(conflict) }));
        return;
      }
      const state = useAppStore.getState();
      state.updateSettings({
        shortcuts: { ...state.settings.shortcuts, [recording]: binding },
      });
      setRecording(null);
      setError(null);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recording, shortcuts, t]);

  function resetAll(): void {
    setRecording(null);
    setError(null);
    useAppStore.getState().updateSettings({
      shortcuts: { ...DEFAULT_SHORTCUTS },
    });
  }

  return (
    <div className="shortcut-editor">
      {SHORTCUT_GROUPS.map((group) => (
        <div className="shortcut-group" key={group}>
          <div className="shortcut-group-title">{t(group)}</div>
          {SHORTCUT_DEFINITIONS.filter(
            (definition) => definition.group === group,
          ).map((definition) => (
            <div
              className="shortcut-row"
              data-shortcut={definition.id}
              key={definition.id}
            >
              <span className="shortcut-name">{t(definition.label)}</span>
              <kbd
                className={`shortcut-key ${
                  recording === definition.id ? "is-recording" : ""
                }`}
              >
                {recording === definition.id
                  ? t("Press keys…")
                  : shortcuts[definition.id] || t("Unassigned")}
              </kbd>
              <button
                type="button"
                className="button button-quiet shortcut-record"
                onClick={() => {
                  setRecording(definition.id);
                  setError(null);
                }}
                disabled={recording !== null && recording !== definition.id}
              >
                {recording === definition.id ? t("Press keys…") : t("Change")}
              </button>
            </div>
          ))}
        </div>
      ))}
      {error ? <p className="shortcut-error">{error}</p> : null}
      <div className="shortcut-footer">
        <span>{t("Press Escape to cancel.")}</span>
        <button
          type="button"
          className="button button-quiet reset-shortcuts"
          onClick={resetAll}
        >
          {t("Reset shortcuts")}
        </button>
      </div>
    </div>
  );
}
