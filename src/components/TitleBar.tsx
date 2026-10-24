import { useEffect, useState } from "react";
import {
  Copy,
  Menu,
  Minus,
  Moon,
  Square,
  Sun,
  X,
} from "lucide-react";
import { useT } from "../i18n";
import { isTauri } from "../lib/platform";
import { resolveTheme, useSystemDark } from "../lib/theme";
import { useAppStore } from "../store/useAppStore";

export function TitleBar() {
  const t = useT();
  const doc = useAppStore((state) => state.doc);
  const theme = useAppStore((state) => state.theme);
  const systemDark = useSystemDark();
  const resolvedTheme = resolveTheme(theme, systemDark);
  const menuOpen = useAppStore((state) => state.menuOpen);
  const setMenuOpen = useAppStore((state) => state.setMenuOpen);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const [maximized, setMaximized] = useState(false);
  const native = isTauri();

  useEffect(() => {
    if (!native) {
      return;
    }
    let mounted = true;
    let unlistenResize: (() => void) | undefined;
    void (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const appWindow = getCurrentWindow();
        const sync = async () => {
          const value = await appWindow.isMaximized();
          if (mounted) {
            setMaximized(value);
          }
        };
        await sync();
        unlistenResize = await appWindow.onResized(() => {
          void sync();
        });
      } catch {
        // The window API is unavailable in browser previews.
      }
    })();
    return () => {
      mounted = false;
      unlistenResize?.();
    };
  }, [native]);

  async function minimize() {
    if (!native) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().minimize();
  }

  async function toggleMaximize() {
    if (!native) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().toggleMaximize();
    setMaximized((value) => !value);
  }

  async function close() {
    if (!native) return;
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  }

  return (
    <header
      className={`titlebar ${menuOpen ? "is-menu-open" : ""}`}
      data-tauri-drag-region="deep"
    >
      <div className="titlebar-left">
        <button
          className={`icon-button menu-button ${menuOpen ? "is-active" : ""}`}
          aria-label={t("Open menu")}
          title={t("Menu")}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Menu size={17} strokeWidth={1.8} />
        </button>
        <div className="brand" aria-label="MarkSI">
          <span className="brand-mark">M</span>
          <span className="brand-word">
            Mark<span>SI</span>
          </span>
        </div>
      </div>

      <div className="titlebar-center">
        <span className="document-title" title={doc.path ?? doc.name}>
          {doc.name}
        </span>
        {doc.dirty ? (
          <span className="dirty-dot" title={t("Unsaved changes")} />
        ) : null}
      </div>

      <div className="titlebar-right">
        <button
          className="icon-button"
          aria-label={
            resolvedTheme === "light"
              ? t("Switch to dark theme")
              : t("Switch to light theme")
          }
          title={
            resolvedTheme === "light" ? t("Dark theme") : t("Light theme")
          }
          onClick={toggleTheme}
        >
          {resolvedTheme === "light" ? (
            <Moon size={16} strokeWidth={1.8} />
          ) : (
            <Sun size={16} strokeWidth={1.8} />
          )}
        </button>

        {native ? (
          <div className="window-controls">
            <button
              className="window-button"
              aria-label={t("Minimize")}
              title={t("Minimize")}
              onClick={minimize}
            >
              <Minus size={15} strokeWidth={1.8} />
            </button>
            <button
              className="window-button"
              aria-label={maximized ? t("Restore") : t("Maximize")}
              title={maximized ? t("Restore") : t("Maximize")}
              onClick={toggleMaximize}
            >
              {maximized ? (
                <Copy size={13} strokeWidth={1.6} />
              ) : (
                <Square size={13} strokeWidth={1.6} />
              )}
            </button>
            <button
              className="window-button window-close"
              aria-label={t("Close")}
              title={t("Close")}
              onClick={close}
            >
              <X size={16} strokeWidth={1.8} />
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
