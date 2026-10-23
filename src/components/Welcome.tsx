import { ArrowUpRight, FilePlus2, FolderOpen, Sparkles } from "lucide-react";
import { useT } from "../i18n";
import type { RecentFile } from "../types";

interface WelcomeProps {
  recent: RecentFile[];
  onNew: () => void;
  onOpen: () => void;
  onOpenFolder: () => void;
  onOpenRecent: (path: string) => void;
}

export function Welcome({ recent, onNew, onOpen, onOpenFolder, onOpenRecent }: WelcomeProps) {
  const t = useT();
  return (
    <section className="welcome" aria-label={t("Welcome to MarkSI")}>
      <div className="welcome-inner">
        <div className="welcome-mark" aria-hidden="true">
          M
        </div>
        <div className="welcome-eyebrow">
          <Sparkles size={13} strokeWidth={1.8} />
          <span>{t("Local-first Markdown studio")}</span>
        </div>
        <h1>{t("Write in the quiet.")}</h1>
        <p className="welcome-lede">
          {t(
            "MarkSI keeps your Markdown plain, your files local, and the interface out of the way. Start with a blank page or pick up where you left off.",
          )}
        </p>

        <div className="welcome-actions">
          <button className="button button-primary" onClick={onNew}>
            <FilePlus2 size={16} strokeWidth={1.8} />
            {t("New document")}
          </button>
          <button className="button" onClick={onOpen}>
            {t("Open file")}
          </button>
          <button className="button button-quiet" onClick={onOpenFolder}>
            <FolderOpen size={15} strokeWidth={1.8} />
            {t("Open folder")}
          </button>
        </div>

        {recent.length > 0 ? (
          <div className="welcome-recent">
            <div className="welcome-recent-heading">{t("Recent")}</div>
            <div className="welcome-recent-list">
              {recent.slice(0, 4).map((item) => (
                <button
                  key={item.path}
                  className="welcome-recent-item"
                  onClick={() => onOpenRecent(item.path)}
                  title={item.path}
                >
                  <span className="welcome-recent-name">{item.name}</span>
                  <ArrowUpRight size={13} strokeWidth={1.8} />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="welcome-hints">
          <span><kbd>Ctrl</kbd><kbd>O</kbd> {t("open")}</span>
          <span><kbd>Ctrl</kbd><kbd>N</kbd> {t("new")}</span>
          <span><kbd>Ctrl</kbd><kbd>S</kbd> {t("save")}</span>
        </div>

        <div className="welcome-foot">
          {t("MIT licensed · no account · no telemetry")}
        </div>
      </div>
    </section>
  );
}
