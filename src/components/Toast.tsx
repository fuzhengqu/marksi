import { useEffect } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useAppStore } from "../store/useAppStore";

export function Toast() {
  const toast = useAppStore((state) => state.toast);
  const dismissToast = useAppStore((state) => state.dismissToast);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => dismissToast(), 4200);
    return () => window.clearTimeout(timer);
  }, [toast, dismissToast]);

  if (!toast) {
    return null;
  }

  const Icon =
    toast.tone === "error" ? AlertCircle : toast.tone === "success" ? CheckCircle2 : Info;

  return (
    <div className={`toast toast-${toast.tone}`} role="status" aria-live="polite">
      <Icon size={16} strokeWidth={1.9} />
      <span>{toast.message}</span>
      <button className="toast-close" onClick={dismissToast} aria-label="Dismiss notification">
        <X size={13} strokeWidth={1.9} />
      </button>
    </div>
  );
}
