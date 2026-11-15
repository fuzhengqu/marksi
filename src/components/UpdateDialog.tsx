import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  RefreshCw,
  X,
} from "lucide-react";
import { intlLocale, useT } from "../i18n";
import { openExternalLink } from "../lib/linkActions";
import {
  checkForUpdate,
  markUpdateChecked,
  type UpdateCheckResult,
} from "../lib/updateCheck";
import { useFocusTrap } from "../lib/useFocusTrap";
import { useAppStore } from "../store/useAppStore";

interface UpdateDialogProps {
  open: boolean;
  onClose: () => void;
}

export function UpdateDialog({ open, onClose }: UpdateDialogProps) {
  const t = useT();
  const language = useAppStore((state) => state.settings.language);
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(open, dialogRef);

  const runCheck = useCallback(async () => {
    setChecking(true);
    const next = await checkForUpdate();
    markUpdateChecked();
    setResult(next);
    setChecking(false);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    setResult(null);
    void runCheck();
  }, [open, runCheck]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  function openRelease(): void {
    if (result?.status !== "available") {
      return;
    }
    void openExternalLink(result.release.url).catch((error) => {
      useAppStore
        .getState()
        .showToast(
          t("Could not open link: {error}", {
            error: error instanceof Error ? error.message : String(error),
          }),
          "error",
        );
    });
  }

  if (!open) {
    return null;
  }

  const release =
    result?.status === "available" ? result.release : null;
  const version = release?.tag.replace(/^v/, "") ?? "";
  const published =
    release?.publishedAt &&
    !Number.isNaN(new Date(release.publishedAt).getTime())
      ? new Date(release.publishedAt).toLocaleDateString(intlLocale(language))
      : null;

  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div
        className="update-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-title"
        ref={dialogRef}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="modal-close"
          type="button"
          onClick={onClose}
          aria-label={t("Close update dialog")}
        >
          <X size={16} strokeWidth={1.8} />
        </button>
        <div className="update-dialog-mark" aria-hidden="true">
          <RefreshCw size={22} strokeWidth={1.8} />
        </div>
        <h2 id="update-title">{t("Check for updates")}</h2>

        {checking ? (
          <p className="update-status">{t("Checking for updates…")}</p>
        ) : result?.status === "available" ? (
          <>
            <p className="update-status update-status-available">
              {t("MarkSI {version} is available.", { version })}
            </p>
            <div className="update-meta">
              {t("You are using {current}.", { current: result.current })}
              {published ? ` · ${t("Published {date}", { date: published })}` : ""}
            </div>
            {release?.notes ? (
              <>
                <div className="update-notes-title">{t("Release notes")}</div>
                <pre className="update-notes">{release.notes.slice(0, 4000)}</pre>
              </>
            ) : null}
            <div className="update-actions">
              <button
                className="button button-primary"
                type="button"
                onClick={openRelease}
              >
                <Download size={15} strokeWidth={1.8} />
                {t("Open GitHub release")}
              </button>
              <button
                className="button button-quiet"
                type="button"
                onClick={onClose}
              >
                {t("Later")}
              </button>
            </div>
          </>
        ) : result?.status === "current" ? (
          <>
            <p className="update-status update-status-current">
              <CheckCircle2 size={17} strokeWidth={1.8} />
              {t("You are up to date.")}
            </p>
            <div className="update-meta">
              {t("Current version: {version}", { version: result.current })}
            </div>
            <div className="update-actions">
              <button
                className="button button-quiet"
                type="button"
                onClick={() => void runCheck()}
              >
                {t("Check again")}
              </button>
              <button
                className="button button-quiet"
                type="button"
                onClick={onClose}
              >
                {t("Close")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="update-status update-status-error">
              {t("Could not check for updates. Try again later.")}
            </p>
            <div className="update-meta">
              {t("Current version: {version}", {
                version: result?.current ?? "",
              })}
            </div>
            <div className="update-actions">
              <button
                className="button button-quiet"
                type="button"
                onClick={() => void runCheck()}
              >
                {t("Retry")}
              </button>
              <button
                className="button button-quiet"
                type="button"
                onClick={onClose}
              >
                {t("Close")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
