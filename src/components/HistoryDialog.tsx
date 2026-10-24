import { useEffect, useState } from "react";
import {
  History,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useT } from "../i18n";
import { encodingDisplayName } from "../lib/encodings";
import { formatSnapshotSize, snapshotTime } from "../lib/history";
import {
  clearHistory,
  deleteHistorySnapshot,
  listHistory,
  readHistory,
} from "../lib/platform";
import { useAppStore } from "../store/useAppStore";
import type { HistoryEntry, HistorySnapshot } from "../types";

interface HistoryDialogProps {
  open: boolean;
  onClose: () => void;
}

export function HistoryDialog({ open, onClose }: HistoryDialogProps) {
  const t = useT();
  const docPath = useAppStore((state) => state.doc.path);
  const docName = useAppStore((state) => state.doc.name);
  const language = useAppStore((state) => state.settings.language);
  const readOnly = useAppStore((state) => state.settings.readOnlyMode);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<HistorySnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  async function reload(preferred?: string): Promise<void> {
    if (!docPath) {
      setEntries([]);
      setSelected(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const items = await listHistory(docPath);
      setEntries(items);
      setSelected(
        preferred && items.some((item) => item.id === preferred)
          ? preferred
          : (items[0]?.id ?? null),
      );
    } catch (cause) {
      setEntries([]);
      setSelected(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    setConfirmClear(false);
    setSnapshot(null);
    void reload();
    // Reload only when the dialog opens or the target document changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, docPath]);

  useEffect(() => {
    if (!open || !docPath || !selected) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    setSnapshot(null);
    void readHistory(docPath, selected)
      .then((value) => {
        if (!cancelled) {
          setSnapshot(value);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [docPath, open, selected]);

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

  async function removeSelected(): Promise<void> {
    if (!docPath || !selected) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteHistorySnapshot(docPath, selected);
      await reload();
      useAppStore
        .getState()
        .showToast(t("Snapshot deleted."), "success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function clearAll(): Promise<void> {
    if (!docPath) {
      return;
    }
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await clearHistory(docPath);
      setEntries([]);
      setSelected(null);
      setSnapshot(null);
      setConfirmClear(false);
      useAppStore
        .getState()
        .showToast(t("Local history cleared."), "success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  function restore(): void {
    if (!snapshot || readOnly) {
      return;
    }
    const state = useAppStore.getState();
    state.setContent(snapshot.content);
    state.setViewMode("preview");
    state.showToast(
      t("Restored a saved version. Save to keep it."),
      "success",
    );
    onClose();
  }

  if (!open) {
    return null;
  }

  const selectedEntry =
    entries.find((entry) => entry.id === selected) ?? null;

  return (
    <div className="modal-scrim">
      <div
        className="history-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
      >
        <header className="history-header">
          <span className="settings-mark" aria-hidden="true">
            <History size={17} strokeWidth={1.8} />
          </span>
          <div className="history-heading">
            <h2 id="history-title">{t("Local history")}</h2>
            <p title={docPath ?? docName}>
              {docPath ? docName : t("This document has no file yet.")}
            </p>
          </div>
          <button
            className="modal-close"
            onClick={onClose}
            disabled={busy}
            title={t("Close")}
            aria-label={t("Close")}
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </header>

        {loading ? (
          <div className="history-loading">
            <Loader2 size={16} className="spin" />
            <span>{t("Loading history…")}</span>
          </div>
        ) : !docPath ? (
          <div className="history-empty">
            <History size={24} strokeWidth={1.4} />
            <p>{t("Open a saved document to view its local history.")}</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="history-empty">
            <History size={24} strokeWidth={1.4} />
            <p>{t("No saved versions yet.")}</p>
            <small>{t("Save the document to create a local snapshot.")}</small>
          </div>
        ) : (
          <div className="history-body">
            <div className="history-list">
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  className={`history-item ${
                    selected === entry.id ? "is-active" : ""
                  }`}
                  aria-pressed={selected === entry.id}
                  onClick={() => setSelected(entry.id)}
                >
                  <span className="history-item-time">
                    {snapshotTime(entry.savedAt, language)}
                  </span>
                  <span className="history-item-preview">
                    {entry.preview || t("Empty document")}
                  </span>
                  <small>
                    {formatSnapshotSize(entry.size)} ·{" "}
                    {encodingDisplayName(entry.encoding)} · {entry.lineEnding}
                  </small>
                </button>
              ))}
            </div>

            <div className="history-detail">
              {selectedEntry ? (
                <>
                  <div className="history-detail-head">
                    <strong>
                      {snapshotTime(selectedEntry.savedAt, language)}
                    </strong>
                    <span>
                      {formatSnapshotSize(selectedEntry.size)} ·{" "}
                      {encodingDisplayName(selectedEntry.encoding)} ·{" "}
                      {selectedEntry.lineEnding}
                    </span>
                  </div>
                  <pre className="history-content">
                    {snapshot?.content ?? selectedEntry.preview}
                  </pre>
                  <div className="history-detail-actions">
                    <button
                      className="button button-quiet history-delete"
                      onClick={() => void removeSelected()}
                      disabled={busy}
                    >
                      <Trash2 size={14} strokeWidth={1.8} />
                      {t("Delete snapshot")}
                    </button>
                    <button
                      className="button button-primary history-restore"
                      onClick={restore}
                      disabled={busy || !snapshot || readOnly}
                      title={
                        readOnly ? t("Read-only mode is on.") : undefined
                      }
                    >
                      <RotateCcw size={14} strokeWidth={1.8} />
                      {t("Restore this version")}
                    </button>
                  </div>
                </>
              ) : (
                <div className="history-empty compact">
                  <p>{t("Choose a saved version to preview it.")}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {error ? <p className="history-error">{error}</p> : null}
        {confirmClear ? (
          <p className="history-confirm-note">
            {t("All saved versions for this document will be removed.")}
          </p>
        ) : null}

        <footer className="history-footer">
          <span className="history-privacy">
            <ShieldCheck size={13} strokeWidth={1.8} />
            {t(
              "Snapshots stay in this app's local data folder. They are never uploaded.",
            )}
          </span>
          <div className="history-footer-actions">
            {entries.length > 0 ? (
              <button
                className={`button ${
                  confirmClear ? "button-danger" : "button-quiet"
                } history-clear`}
                onClick={() => void clearAll()}
                disabled={busy}
              >
                {confirmClear ? t("Confirm clear") : t("Clear all")}
              </button>
            ) : null}
            <button className="button button-quiet" onClick={onClose}>
              {t("Close")}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
