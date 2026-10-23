import { useMemo } from "react";
import { Eye, Lock, PenLine } from "lucide-react";
import { getTextStats } from "../editor/analyze";
import { useT } from "../i18n";
import { useAppStore } from "../store/useAppStore";

export function StatusBar() {
  const t = useT();
  const doc = useAppStore((state) => state.doc);
  const cursor = useAppStore((state) => state.cursor);
  const viewMode = useAppStore((state) => state.viewMode);
  const readOnlyMode = useAppStore((state) => state.settings.readOnlyMode);
  const toggleViewMode = useAppStore((state) => state.toggleViewMode);
  const setViewMode = useAppStore((state) => state.setViewMode);
  const stats = useMemo(() => getTextStats(doc.content), [doc.content]);

  return (
    <footer className="statusbar">
      <div className="status-left">
        <span className="status-mode">
          {viewMode === "preview"
            ? t("Live preview")
            : viewMode === "reading"
              ? t("Reading")
              : "Markdown"}
        </span>
        <span className="status-divider" aria-hidden="true" />
        {readOnlyMode ? (
          <span
            className="status-readonly"
            title={t("Read-only mode (Ctrl Alt R)")}
          >
            <Lock size={10} strokeWidth={2} />
            {t("Read only")}
          </span>
        ) : null}
        <span title={t("Document encoding")}>
          {doc.encoding}
          {doc.hasBom ? " BOM" : ""}
        </span>
        <span title={t("Line endings")}>{doc.lineEnding}</span>
        {doc.hadErrors ? (
          <span className="status-warning">
            {t("decoded with replacements")}
          </span>
        ) : null}
      </div>

      <div className="status-right">
        <button
          className="status-view-toggle"
          onClick={() =>
            viewMode === "reading" ? setViewMode("source") : toggleViewMode()
          }
          title={
            viewMode === "source"
              ? t("Preview rendered document (Ctrl /)")
              : t("Edit Markdown source (Ctrl /)")
          }
          aria-label={
            viewMode === "source" ? t("Switch to preview") : t("Switch to source")
          }
        >
          {viewMode === "source" ? (
            <Eye size={12} strokeWidth={1.8} />
          ) : (
            <PenLine size={12} strokeWidth={1.8} />
          )}
          <span>{viewMode === "source" ? t("Preview") : t("Source")}</span>
        </button>
        <span>{t("{count} words", { count: stats.words.toLocaleString() })}</span>
        <span>{t("{count} chars", { count: stats.chars.toLocaleString() })}</span>
        <span className="status-cursor">
          {t("Ln {line}, Col {column}", {
            line: cursor.line,
            column: cursor.column,
          })}
        </span>
      </div>
    </footer>
  );
}
