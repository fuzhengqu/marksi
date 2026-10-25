import { useEffect, useRef, useState } from "react";
import { BookOpen, FileOutput, X } from "lucide-react";
import { useT } from "../i18n";
import {
  chooseExportSavePath,
  pandocExport,
  pandocVersion,
} from "../lib/platform";
import {
  PANDOC_FORMATS,
  pandocExportPath,
  pandocFormatInfo,
  type PandocFormat,
} from "../lib/pandoc";
import { useFocusTrap } from "../lib/useFocusTrap";
import { useAppStore } from "../store/useAppStore";

interface PandocDialogProps {
  open: boolean;
  hasContent: boolean;
  onClose: () => void;
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function PandocDialog({
  open,
  hasContent,
  onClose,
}: PandocDialogProps) {
  const t = useT();
  const settings = useAppStore((state) => state.settings);
  const [format, setFormat] = useState<PandocFormat>("docx");
  const [detected, setDetected] = useState<string | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const wasOpen = useRef(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(open, dialogRef);

  useEffect(() => {
    if (!open) {
      wasOpen.current = false;
      return;
    }
    if (wasOpen.current) {
      return;
    }
    wasOpen.current = true;
    setFormat("docx");
    setBusy(false);
    setDetected(null);
    setDetectError(null);
    setDetecting(true);
    let cancelled = false;
    void pandocVersion(settings.pandocPath)
      .then((version) => {
        if (!cancelled) {
          setDetected(version);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setDetectError(messageFor(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetecting(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, settings.pandocPath]);

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

  if (!open) {
    return null;
  }

  const formatInfo = pandocFormatInfo(format);

  async function handleExport(): Promise<void> {
    const state = useAppStore.getState();
    if (!state.doc.content.trim()) {
      onClose();
      return;
    }
    const selected = await chooseExportSavePath(
      pandocExportPath(state.doc.path, state.doc.name, format),
      [
        {
          name: t(formatInfo.filterName),
          extensions: [formatInfo.extension],
        },
      ],
    );
    if (!selected) {
      return;
    }

    setBusy(true);
    try {
      const result = await pandocExport({
        program: settings.pandocPath,
        content: state.doc.content,
        documentPath: state.doc.path,
        outputPath: selected,
        format,
      });
      useAppStore
        .getState()
        .showToast(
          t("Exported {name}", {
            name: result.path.split(/[\\/]/).pop() ?? result.path,
          }),
          "success",
        );
      onClose();
    } catch (error) {
      useAppStore.getState().showToast(messageFor(error), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-scrim" onMouseDown={() => !busy && onClose()}>
      <div
        ref={dialogRef}
        className="settings-dialog pandoc-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pandoc-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="settings-header">
          <span className="settings-mark" aria-hidden="true">
            <BookOpen size={17} strokeWidth={1.8} />
          </span>
          <div>
            <h2 id="pandoc-title">{t("Export with Pandoc")}</h2>
            <p>{t("Convert the current Markdown with an external Pandoc.")}</p>
          </div>
          <button
            className="modal-close settings-close"
            onClick={onClose}
            disabled={busy}
            aria-label={t("Close Pandoc dialog")}
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </header>

        <div className="settings-body">
          <section className="settings-section">
            <div className="settings-section-heading">
              <BookOpen size={15} strokeWidth={1.8} />
              <span>{t("Pandoc")}</span>
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Status")}</span>
                <small>
                  {detecting
                    ? t("Checking Pandoc…")
                    : detected
                      ? t("Detected: {version}", { version: detected })
                      : t(
                          "Pandoc was not found. Set its path in Preferences.",
                        )}
                </small>
              </div>
              <span
                className={`pandoc-status ${detected ? "is-ready" : ""}`}
                title={detectError ?? undefined}
              >
                {detected ? t("Ready") : detecting ? "…" : t("Unavailable")}
              </span>
            </div>
            {detectError ? (
              <p className="settings-note pandoc-error" title={detectError}>
                {t("Pandoc error: {error}", {
                  error: detectError.slice(0, 300),
                })}
              </p>
            ) : null}
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <FileOutput size={15} strokeWidth={1.8} />
              <span>{t("Output")}</span>
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Format")}</span>
                <small>{t("Written by Pandoc, then saved atomically.")}</small>
              </div>
              <select
                className="settings-select pandoc-format"
                value={format}
                onChange={(event) =>
                  setFormat(event.target.value as PandocFormat)
                }
                aria-label={t("Format")}
              >
                {PANDOC_FORMATS.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {t(entry.label)}
                  </option>
                ))}
              </select>
            </div>
            <p className="settings-note">
              {t(
                "Pandoc is not bundled. It runs as an external program and may fetch remote images referenced by the document. Save the document first if it uses relative local images.",
              )}
            </p>
          </section>

          {!hasContent ? (
            <p className="settings-note export-empty-note">
              {t("Add some content before exporting.")}
            </p>
          ) : null}
        </div>

        <footer className="settings-footer export-footer">
          <button
            className="button button-quiet"
            onClick={onClose}
            disabled={busy}
          >
            {t("Cancel")}
          </button>
          <div className="export-actions">
            <button
              className="button button-primary"
              onClick={() => void handleExport()}
              disabled={busy || !detected || !hasContent}
            >
              <FileOutput size={14} strokeWidth={1.8} />
              {busy ? t("Exporting…") : t("Export")}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
