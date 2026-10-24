import { useEffect, useRef, useState } from "react";
import { FileText, RefreshCw, X } from "lucide-react";
import { useT } from "../i18n";
import {
  ENCODING_OPTIONS,
  encodingDisplayName,
  encodingOption,
} from "../lib/encodings";
import { useAppStore } from "../store/useAppStore";

interface EncodingDialogProps {
  open: boolean;
  onClose: () => void;
  onReopen: (encoding: string) => Promise<boolean>;
}

export function EncodingDialog({
  open,
  onClose,
  onReopen,
}: EncodingDialogProps) {
  const t = useT();
  const docPath = useAppStore((state) => state.doc.path);
  const docName = useAppStore((state) => state.doc.name);
  const encoding = useAppStore((state) => state.doc.encoding);
  const dirty = useAppStore((state) => state.doc.dirty);
  const current = encodingOption(encoding)?.value ?? "auto";
  const [selected, setSelected] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelected(current);
    setBusy(false);
    setError(null);
    const timer = window.setTimeout(() => firstRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [current, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose, open]);

  async function reopen(): Promise<void> {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (await onReopen(selected)) {
        onClose();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="modal-scrim">
      <form
        className="encoding-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="encoding-title"
        onSubmit={(event) => {
          event.preventDefault();
          void reopen();
        }}
      >
        <header className="file-op-header">
          <span className="settings-mark" aria-hidden="true">
            <FileText size={17} strokeWidth={1.8} />
          </span>
          <div className="file-op-heading">
            <h2 id="encoding-title">{t("Reopen with encoding")}</h2>
            <p title={docPath ?? docName}>{docPath ?? docName}</p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={busy}
            title={t("Close")}
            aria-label={t("Close")}
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </header>

        <div className="encoding-body">
          <p className="encoding-note">
            {t(
              "Choose how to decode this file. Reopening does not write the file.",
            )}
          </p>
          <p className="encoding-current">
            {t("Current encoding: {encoding}", {
              encoding: encodingDisplayName(encoding),
            })}
          </p>
          <div className="encoding-options" role="radiogroup">
            {ENCODING_OPTIONS.map((option, index) => (
              <label
                key={option.value}
                className={`encoding-option ${
                  selected === option.value ? "is-active" : ""
                }`}
              >
                <input
                  ref={index === 0 ? firstRef : undefined}
                  type="radio"
                  name="document-encoding"
                  value={option.value}
                  data-encoding={option.value}
                  checked={selected === option.value}
                  onChange={() => setSelected(option.value)}
                  disabled={busy}
                />
                <span>{t(option.label)}</span>
                {current === option.value ? (
                  <small>{t("Current")}</small>
                ) : null}
              </label>
            ))}
          </div>
          {dirty ? (
            <p className="encoding-warning">
              {t("Unsaved changes will be lost after confirmation.")}
            </p>
          ) : null}
          {error ? <p className="encoding-error">{error}</p> : null}
        </div>

        <footer className="file-op-footer">
          <button
            type="button"
            className="button button-quiet"
            onClick={onClose}
            disabled={busy}
          >
            {t("Cancel")}
          </button>
          <button
            type="submit"
            className="button button-primary encoding-reopen"
            disabled={busy || !docPath}
          >
            <RefreshCw size={14} strokeWidth={1.8} />
            {busy ? t("Working…") : t("Reopen")}
          </button>
        </footer>
      </form>
    </div>
  );
}
