import { useMemo } from "react";
import { Eye, Lock, PenLine } from "lucide-react";
import { getTextStats } from "../editor/analyze";
import { useAppStore } from "../store/useAppStore";

export function StatusBar() {
  const doc = useAppStore((state) => state.doc);
  const cursor = useAppStore((state) => state.cursor);
  const viewMode = useAppStore((state) => state.viewMode);
  const readOnlyMode = useAppStore((state) => state.settings.readOnlyMode);
  const toggleViewMode = useAppStore((state) => state.toggleViewMode);
  const stats = useMemo(() => getTextStats(doc.content), [doc.content]);

  return (
    <footer className="statusbar">
      <div className="status-left">
        <span className="status-mode">Markdown</span>
        <span className="status-divider" aria-hidden="true" />
        {readOnlyMode ? (
          <span className="status-readonly" title="Read-only mode (Ctrl Alt R)">
            <Lock size={10} strokeWidth={2} />
            Read only
          </span>
        ) : null}
        <span title="Document encoding">
          {doc.encoding}
          {doc.hasBom ? " BOM" : ""}
        </span>
        <span title="Line endings">{doc.lineEnding}</span>
        {doc.hadErrors ? <span className="status-warning">decoded with replacements</span> : null}
      </div>

      <div className="status-right">
        <button
          className="status-view-toggle"
          onClick={toggleViewMode}
          title={
            viewMode === "source"
              ? "Preview rendered document (Ctrl /)"
              : "Edit Markdown source (Ctrl /)"
          }
          aria-label={
            viewMode === "source" ? "Switch to preview" : "Switch to source"
          }
        >
          {viewMode === "source" ? (
            <Eye size={12} strokeWidth={1.8} />
          ) : (
            <PenLine size={12} strokeWidth={1.8} />
          )}
          <span>{viewMode === "source" ? "Preview" : "Source"}</span>
        </button>
        <span>{stats.words.toLocaleString()} words</span>
        <span>{stats.chars.toLocaleString()} chars</span>
        <span className="status-cursor">
          Ln {cursor.line}, Col {cursor.column}
        </span>
      </div>
    </footer>
  );
}
