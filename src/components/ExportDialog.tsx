import { useEffect, useRef, useState } from "react";
import {
  FileDown,
  FileText,
  LayoutTemplate,
  Printer,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useT } from "../i18n";
import {
  exportProfileOptions,
  normalizeExportOptions,
} from "../lib/exportOptions";
import { useAppStore } from "../store/useAppStore";
import type {
  ExportMargin,
  ExportOptions,
  ExportOrientation,
  ExportPageSize,
  ExportProfileId,
} from "../types";
import { Toggle } from "./Toggle";

interface ExportDialogProps {
  open: boolean;
  hasContent: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => Promise<boolean>;
  onPrint: (options: ExportOptions) => void;
}

const PROFILE_DESCRIPTIONS: Record<ExportProfileId, string> = {
  document:
    "Balanced HTML with front matter metadata and no headers or footers.",
  print:
    "A4 portrait with the document title and page numbers in the margins.",
  minimal:
    "Clean HTML without front matter metadata and with narrow margins.",
  custom: "Your own combination of metadata and page settings.",
};

export function ExportDialog({
  open,
  hasContent,
  onClose,
  onExport,
  onPrint,
}: ExportDialogProps) {
  const t = useT();
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const [draft, setDraft] = useState<ExportOptions>(() =>
    normalizeExportOptions(settings.exportOptions),
  );
  const [busy, setBusy] = useState(false);
  const profileRef = useRef<HTMLSelectElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setDraft(normalizeExportOptions(settings.exportOptions));
      setBusy(false);
      const focusTimer = window.setTimeout(
        () => profileRef.current?.focus(),
        20,
      );
      wasOpen.current = true;
      return () => window.clearTimeout(focusTimer);
    }
    wasOpen.current = open;
  }, [open, settings.exportOptions]);

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

  function update(patch: Partial<ExportOptions>): void {
    setDraft((current) =>
      normalizeExportOptions({ ...current, ...patch, profile: "custom" }),
    );
  }

  function chooseProfile(profile: ExportProfileId): void {
    if (profile === "custom") {
      setDraft((current) => ({ ...current, profile: "custom" }));
      return;
    }
    setDraft(exportProfileOptions(profile));
  }

  function commit(): void {
    updateSettings({ exportOptions: draft });
  }

  async function handleExport(): Promise<void> {
    commit();
    setBusy(true);
    try {
      if (await onExport(draft)) {
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  function handlePrint(): void {
    commit();
    onPrint(draft);
    onClose();
  }

  const metadataDisabled = !draft.useFrontMatter;

  return (
    <div className="modal-scrim" onMouseDown={() => !busy && onClose()}>
      <div
        className="settings-dialog export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="settings-header">
          <span className="settings-mark" aria-hidden="true">
            <FileDown size={17} strokeWidth={1.8} />
          </span>
          <div>
            <h2 id="export-title">{t("Export document")}</h2>
            <p>{t("Choose a profile, metadata, and page setup.")}</p>
          </div>
          <button
            className="modal-close settings-close"
            onClick={onClose}
            disabled={busy}
            aria-label={t("Close export dialog")}
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </header>

        <div className="settings-body">
          <section className="settings-section">
            <div className="settings-section-heading">
              <LayoutTemplate size={15} strokeWidth={1.8} />
              <span>{t("Profile")}</span>
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Export profile")}</span>
                <small>{t(PROFILE_DESCRIPTIONS[draft.profile])}</small>
              </div>
              <select
                ref={profileRef}
                className="settings-select export-profile-select"
                value={draft.profile}
                onChange={(event) =>
                  chooseProfile(event.target.value as ExportProfileId)
                }
                aria-label={t("Export profile")}
              >
                <option value="document">{t("Document")}</option>
                <option value="print">{t("Print")}</option>
                <option value="minimal">{t("Minimal")}</option>
                <option value="custom">{t("Custom")}</option>
              </select>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <FileText size={15} strokeWidth={1.8} />
              <span>{t("Metadata")}</span>
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Use front matter")}</span>
                <small>
                  {t(
                    "Read the title, author, date, and tags from YAML front matter.",
                  )}
                </small>
              </div>
              <Toggle
                label={t("Use front matter")}
                checked={draft.useFrontMatter}
                onChange={(value) => update({ useFrontMatter: value })}
              />
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Metadata tags")}</span>
                <small>
                  {t(
                    "Add author, description, and keywords tags to the HTML head.",
                  )}
                </small>
              </div>
              <Toggle
                label={t("Metadata tags")}
                checked={draft.includeMetadataTags}
                disabled={metadataDisabled}
                onChange={(value) =>
                  update({ includeMetadataTags: value })
                }
              />
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Document info panel")}</span>
                <small>
                  {t(
                    "Show author, date, summary, tags, and keywords above the document.",
                  )}
                </small>
              </div>
              <Toggle
                label={t("Document info panel")}
                checked={draft.includeDocumentInfo}
                disabled={metadataDisabled}
                onChange={(value) =>
                  update({ includeDocumentInfo: value })
                }
              />
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-heading">
              <SlidersHorizontal size={15} strokeWidth={1.8} />
              <span>{t("Page setup")}</span>
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Paper size")}</span>
                <small>{t("Used when printing or saving as PDF.")}</small>
              </div>
              <select
                className="settings-select"
                value={draft.pageSize}
                onChange={(event) =>
                  update({ pageSize: event.target.value as ExportPageSize })
                }
                aria-label={t("Paper size")}
              >
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
                <option value="legal">Legal</option>
              </select>
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Orientation")}</span>
                <small>{t("Portrait or landscape pages.")}</small>
              </div>
              <select
                className="settings-select"
                value={draft.orientation}
                onChange={(event) =>
                  update({
                    orientation: event.target.value as ExportOrientation,
                  })
                }
                aria-label={t("Orientation")}
              >
                <option value="portrait">{t("Portrait")}</option>
                <option value="landscape">{t("Landscape")}</option>
              </select>
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <span>{t("Margins")}</span>
                <small>{t("Page margins for print and PDF output.")}</small>
              </div>
              <select
                className="settings-select"
                value={draft.margin}
                onChange={(event) =>
                  update({ margin: event.target.value as ExportMargin })
                }
                aria-label={t("Margins")}
              >
                <option value="normal">{t("Normal")}</option>
                <option value="narrow">{t("Narrow")}</option>
                <option value="wide">{t("Wide")}</option>
              </select>
            </div>
            <div className="settings-row export-template-row">
              <div className="settings-copy">
                <span>{t("Header")}</span>
                <small>{t("Optional text for the top page margin.")}</small>
              </div>
              <input
                className="settings-text export-template"
                type="text"
                value={draft.header}
                placeholder="{title}"
                spellCheck={false}
                onChange={(event) => update({ header: event.target.value })}
                aria-label={t("Header")}
              />
            </div>
            <div className="settings-row export-template-row">
              <div className="settings-copy">
                <span>{t("Footer")}</span>
                <small>{t("Optional text for the bottom page margin.")}</small>
              </div>
              <input
                className="settings-text export-template"
                type="text"
                value={draft.footer}
                placeholder="{page} / {pages}"
                spellCheck={false}
                onChange={(event) => update({ footer: event.target.value })}
                aria-label={t("Footer")}
              />
            </div>
            <p className="settings-note">
              {t(
                "Header and footer tokens: {title}, {page}, {pages}. Paper size and margins apply to the exported HTML and the system print dialog; the print dialog may add its own header and footer.",
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
              className="button"
              onClick={handlePrint}
              disabled={busy || !hasContent}
            >
              <Printer size={14} strokeWidth={1.8} />
              {t("Print / PDF")}
            </button>
            <button
              className="button button-primary"
              onClick={() => void handleExport()}
              disabled={busy || !hasContent}
            >
              <FileDown size={14} strokeWidth={1.8} />
              {busy ? t("Exporting…") : t("Export HTML")}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
