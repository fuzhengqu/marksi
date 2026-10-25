import { useRef } from "react";
import { History, ShieldCheck } from "lucide-react";
import { useT } from "../i18n";
import { useFocusTrap } from "../lib/useFocusTrap";
import type { DocumentDraft } from "../types";

interface DraftRecoveryProps {
  draft: DocumentDraft;
  onRecover: () => void;
  onDiscard: () => void;
}

function preview(draft: DocumentDraft, emptyText: string): string {
  const text = draft.content.trim();
  if (!text) {
    return emptyText;
  }
  return text.length > 420 ? `${text.slice(0, 420)}…` : text;
}

export function DraftRecovery({
  draft,
  onRecover,
  onDiscard,
}: DraftRecoveryProps) {
  const t = useT();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(true, dialogRef);
  return (
    <div className="modal-scrim draft-scrim">
      <div
        ref={dialogRef}
        className="draft-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-title"
        tabIndex={-1}
      >
        <div className="draft-icon" aria-hidden="true">
          <History size={22} strokeWidth={1.6} />
        </div>
        <h2 id="draft-title">{t("Recover unsaved draft?")}</h2>
        <p className="draft-copy">
          {t(
            "MarkSI found edits that were not written to a file before the last session ended.",
          )}
        </p>

        <div className="draft-meta">
          <span className="draft-name" title={draft.path ?? draft.name}>
            {draft.name}
          </span>
          <span>
            {new Date(draft.updatedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </div>

        <pre className="draft-preview">
          {preview(draft, t("The recovered draft is empty."))}
        </pre>

        <div className="draft-privacy">
          <ShieldCheck size={13} strokeWidth={1.8} />
          <span>{t("Stored only on this device.")}</span>
        </div>

        <div className="draft-actions">
          <button className="button button-quiet" onClick={onDiscard}>
            {t("Discard draft")}
          </button>
          <button className="button button-primary" onClick={onRecover}>
            {t("Recover draft")}
          </button>
        </div>
      </div>
    </div>
  );
}
