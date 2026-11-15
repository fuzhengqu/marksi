import { Download, X } from "lucide-react";
import { useT } from "../i18n";
import type { ReleaseInfo } from "../lib/updateCheck";

interface UpdateNoticeProps {
  release: ReleaseInfo;
  onView: () => void;
  onDismiss: () => void;
}

export function UpdateNotice({
  release,
  onView,
  onDismiss,
}: UpdateNoticeProps) {
  const t = useT();
  const version = release.tag.replace(/^v/, "");
  return (
    <div className="update-notice" role="status" aria-live="polite">
      <div className="update-notice-copy">
        <strong>{t("Update available")}</strong>
        <span>{t("MarkSI {version} is ready to download.", { version })}</span>
      </div>
      <button
        className="button button-primary"
        type="button"
        onClick={onView}
      >
        <Download size={14} strokeWidth={1.8} />
        {t("View update")}
      </button>
      <button
        className="update-notice-close"
        type="button"
        onClick={onDismiss}
        aria-label={t("Dismiss update")}
      >
        <X size={15} strokeWidth={1.8} />
      </button>
    </div>
  );
}
