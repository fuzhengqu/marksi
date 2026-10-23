import { useEffect, useState, type ReactNode } from "react";
import {
  AlignVerticalJustifyCenter,
  Bold,
  Check,
  ClipboardType,
  Code2,
  Copy,
  Eye,
  FileCode2,
  FilePlus2,
  FileText,
  Focus,
  FolderOpen,
  FolderX,
  Image as ImageIcon,
  Info,
  Italic,
  Link2,
  Lock,
  Moon,
  PanelLeft,
  PenLine,
  Printer,
  RotateCcw,
  Save,
  SaveAll,
  Search,
  Settings,
  Strikethrough,
  Sun,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { EditorCommand } from "../editor/format";
import { useT } from "../i18n";
import { getAppVersion } from "../lib/platform";
import { ZOOM_MAX, ZOOM_MIN } from "../lib/zoom";
import { useAppStore } from "../store/useAppStore";
import type { CopyFormat } from "../types";

type MenuSection = "file" | "format" | "view" | "copy" | "export" | "help";

const menuSections: Array<{ id: MenuSection; label: string }> = [
  { id: "file", label: "File" },
  { id: "format", label: "Format" },
  { id: "view", label: "View" },
  { id: "copy", label: "Copy" },
  { id: "export", label: "Export" },
  { id: "help", label: "Help" },
];

interface MenuOverlayProps {
  onNew: () => void;
  onOpen: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportHtml: () => void;
  onPrint: () => void;
  onCopy: (format: CopyFormat) => void;
  onToggleView: () => void;
  onFormat: (command: EditorCommand) => void;
  onInsertImage: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onCloseWorkspace: () => void;
  onQuickOpen: () => void;
  onSearchWorkspace: () => void;
  onOpenSettings: () => void;
}

export function MenuOverlay({
  onNew,
  onOpen,
  onOpenFolder,
  onSave,
  onSaveAs,
  onExportHtml,
  onPrint,
  onCopy,
  onToggleView,
  onFormat,
  onInsertImage,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onCloseWorkspace,
  onQuickOpen,
  onSearchWorkspace,
  onOpenSettings,
}: MenuOverlayProps) {
  const t = useT();
  const open = useAppStore((state) => state.menuOpen);
  const setOpen = useAppStore((state) => state.setMenuOpen);
  const theme = useAppStore((state) => state.theme);
  const viewMode = useAppStore((state) => state.viewMode);
  const workspace = useAppStore((state) => state.workspace);
  const settings = useAppStore((state) => state.settings);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [section, setSection] = useState<MenuSection>("file");

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    setSection("file");
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  if (!open) {
    return (
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    );
  }

  function run(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <>
      <div className="menu-scrim" onMouseDown={() => setOpen(false)} aria-hidden="true" />
      <div className="menu-panel" role="dialog" aria-label={t("Menu")}>
        <div className="menu-tabs" role="tablist" aria-label={t("Menu")}>
          {menuSections.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={section === item.id}
              className={`menu-tab ${section === item.id ? "is-active" : ""}`}
              onClick={() => setSection(item.id)}
            >
              {t(item.label)}
            </button>
          ))}
        </div>

        <div className="menu-content">
          {section === "file" ? (
            <>
              <MenuItem
                icon={<FilePlus2 size={16} strokeWidth={1.8} />}
                label={t("New document")}
                shortcut="Ctrl N"
                onClick={() => run(onNew)}
              />
              <MenuItem
                icon={<FolderOpen size={16} strokeWidth={1.8} />}
                label={t("Open file…")}
                shortcut="Ctrl O"
                onClick={() => run(onOpen)}
              />
              <MenuItem
                icon={<FolderOpen size={16} strokeWidth={1.8} />}
                label={t("Open folder…")}
                shortcut="Ctrl ⇧ O"
                onClick={() => run(onOpenFolder)}
              />
              <MenuItem
                icon={<Search size={16} strokeWidth={1.8} />}
                label={t("Quick open…")}
                shortcut="Ctrl P"
                onClick={() => run(onQuickOpen)}
              />
              <MenuItem
                icon={<Search size={16} strokeWidth={1.8} />}
                label={t("Search in folder…")}
                shortcut="Ctrl ⇧ F"
                onClick={() => run(onSearchWorkspace)}
              />
              {workspace ? (
                <MenuItem
                  icon={<FolderX size={16} strokeWidth={1.8} />}
                  label={t("Close folder")}
                  onClick={() => run(onCloseWorkspace)}
                />
              ) : null}
              <div className="menu-separator" />
              <MenuItem
                icon={<Save size={16} strokeWidth={1.8} />}
                label={t("Save")}
                shortcut="Ctrl S"
                onClick={() => run(onSave)}
              />
              <MenuItem
                icon={<SaveAll size={16} strokeWidth={1.8} />}
                label={t("Save as…")}
                shortcut="Ctrl ⇧ S"
                onClick={() => run(onSaveAs)}
              />
            </>
          ) : null}

          {section === "format" ? (
            <>
              <MenuItem
                icon={<Bold size={16} strokeWidth={1.8} />}
                label={t("Bold")}
                shortcut="Ctrl B"
                disabled={settings.readOnlyMode}
                onClick={() => run(() => onFormat("bold"))}
              />
              <MenuItem
                icon={<Italic size={16} strokeWidth={1.8} />}
                label={t("Italic")}
                shortcut="Ctrl I"
                disabled={settings.readOnlyMode}
                onClick={() => run(() => onFormat("italic"))}
              />
              <MenuItem
                icon={<Strikethrough size={16} strokeWidth={1.8} />}
                label={t("Strikethrough")}
                shortcut="Ctrl ⇧ X"
                disabled={settings.readOnlyMode}
                onClick={() => run(() => onFormat("strikethrough"))}
              />
              <MenuItem
                icon={<Code2 size={16} strokeWidth={1.8} />}
                label={t("Inline code")}
                shortcut="Ctrl `"
                disabled={settings.readOnlyMode}
                onClick={() => run(() => onFormat("inline-code"))}
              />
              <MenuItem
                icon={<Link2 size={16} strokeWidth={1.8} />}
                label={t("Link")}
                shortcut="Ctrl K"
                disabled={settings.readOnlyMode}
                onClick={() => run(() => onFormat("link"))}
              />
              <MenuItem
                icon={<ImageIcon size={16} strokeWidth={1.8} />}
                label={t("Image…")}
                shortcut="Ctrl ⇧ I"
                disabled={settings.readOnlyMode}
                onClick={() => run(onInsertImage)}
              />
            </>
          ) : null}

          {section === "view" ? (
            <>
              <MenuItem
                icon={
                  viewMode === "source" ? (
                    <Eye size={16} strokeWidth={1.8} />
                  ) : (
                    <PenLine size={16} strokeWidth={1.8} />
                  )
                }
                label={
                  viewMode === "source" ? t("Preview mode") : t("Source mode")
                }
                shortcut="Ctrl /"
                onClick={() => run(onToggleView)}
              />
              <MenuItem
                icon={<Eye size={16} strokeWidth={1.8} />}
                label={t("Reading view")}
                checked={viewMode === "reading"}
                onClick={() =>
                  run(() => useAppStore.getState().setViewMode("reading"))
                }
              />
              <MenuItem
                icon={<PanelLeft size={16} strokeWidth={1.8} />}
                label={t("Toggle sidebar")}
                shortcut="Ctrl ⇧ B"
                onClick={() => run(toggleSidebar)}
              />
              <MenuItem
                icon={
                  theme === "light" ? (
                    <Moon size={16} strokeWidth={1.8} />
                  ) : (
                    <Sun size={16} strokeWidth={1.8} />
                  )
                }
                label={
                  theme === "light"
                    ? t("Dark appearance")
                    : t("Light appearance")
                }
                onClick={() => run(toggleTheme)}
              />
              <MenuItem
                icon={<Focus size={16} strokeWidth={1.8} />}
                label={t("Focus mode")}
                shortcut="Ctrl Alt F"
                checked={settings.focusMode}
                onClick={() =>
                  run(() => updateSettings({ focusMode: !settings.focusMode }))
                }
              />
              <MenuItem
                icon={
                  <AlignVerticalJustifyCenter size={16} strokeWidth={1.8} />
                }
                label={t("Typewriter mode")}
                shortcut="Ctrl Alt T"
                checked={settings.typewriterMode}
                onClick={() =>
                  run(() =>
                    updateSettings({
                      typewriterMode: !settings.typewriterMode,
                    }),
                  )
                }
              />
              <MenuItem
                icon={<Lock size={16} strokeWidth={1.8} />}
                label={t("Read-only mode")}
                shortcut="Ctrl Alt R"
                checked={settings.readOnlyMode}
                onClick={() =>
                  run(() =>
                    updateSettings({ readOnlyMode: !settings.readOnlyMode }),
                  )
                }
              />
              <div className="menu-separator" />
              <MenuItem
                icon={<ZoomIn size={16} strokeWidth={1.8} />}
                label={t("Zoom in")}
                shortcut="Ctrl +"
                disabled={settings.zoomLevel >= ZOOM_MAX - 0.001}
                onClick={() => run(onZoomIn)}
              />
              <MenuItem
                icon={<ZoomOut size={16} strokeWidth={1.8} />}
                label={t("Zoom out")}
                shortcut="Ctrl -"
                disabled={settings.zoomLevel <= ZOOM_MIN + 0.001}
                onClick={() => run(onZoomOut)}
              />
              <MenuItem
                icon={<RotateCcw size={16} strokeWidth={1.8} />}
                label={t("Actual size")}
                shortcut="Ctrl 0"
                disabled={Math.abs(settings.zoomLevel - 1) < 0.001}
                onClick={() => run(onResetZoom)}
              />
            </>
          ) : null}

          {section === "copy" ? (
            <>
              <MenuItem
                icon={<Copy size={16} strokeWidth={1.8} />}
                label={t("Copy as Markdown")}
                shortcut="Ctrl Alt C"
                onClick={() => run(() => onCopy("markdown"))}
              />
              <MenuItem
                icon={<ClipboardType size={16} strokeWidth={1.8} />}
                label={t("Copy as HTML")}
                shortcut="Ctrl Alt H"
                onClick={() => run(() => onCopy("html"))}
              />
              <MenuItem
                icon={<FileText size={16} strokeWidth={1.8} />}
                label={t("Copy as plain text")}
                shortcut="Ctrl Alt P"
                onClick={() => run(() => onCopy("text"))}
              />
            </>
          ) : null}

          {section === "export" ? (
            <>
              <MenuItem
                icon={<FileCode2 size={16} strokeWidth={1.8} />}
                label={t("HTML document…")}
                onClick={() => run(onExportHtml)}
              />
              <MenuItem
                icon={<Printer size={16} strokeWidth={1.8} />}
                label={t("Print / Save as PDF")}
                onClick={() => run(onPrint)}
              />
            </>
          ) : null}

          {section === "help" ? (
            <>
              <MenuItem
                icon={<Settings size={16} strokeWidth={1.8} />}
                label={t("Preferences…")}
                shortcut="Ctrl ,"
                onClick={() => run(onOpenSettings)}
              />
              <MenuItem
                icon={<Info size={16} strokeWidth={1.8} />}
                label={t("About MarkSI")}
                onClick={() => {
                  setOpen(false);
                  setAboutOpen(true);
                }}
              />
            </>
          ) : null}
        </div>

        <div className="menu-footer">
          <span className="menu-footer-mark">M</span>
          <span>{t("MarkSI · MIT licensed")}</span>
          <Check size={13} strokeWidth={1.8} />
        </div>
      </div>

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  );
}

interface MenuItemProps {
  icon: ReactNode;
  label: string;
  shortcut?: string;
  badge?: string;
  checked?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function MenuItem({
  icon,
  label,
  shortcut,
  badge,
  checked,
  disabled,
  onClick,
}: MenuItemProps) {
  return (
    <button
      className={`menu-item ${checked ? "is-checked" : ""}`}
      role={checked === undefined ? "menuitem" : "menuitemcheckbox"}
      aria-checked={checked}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="menu-item-icon">{icon}</span>
      <span className="menu-item-label">{label}</span>
      {badge ? <span className="menu-badge">{badge}</span> : null}
      {checked ? (
        <Check className="menu-item-check" size={13} strokeWidth={2} />
      ) : null}
      {shortcut ? <span className="menu-shortcut">{shortcut}</span> : null}
    </button>
  );
}

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

function AboutDialog({ open, onClose }: AboutDialogProps) {
  const t = useT();
  const [version, setVersion] = useState("0.1.0");

  useEffect(() => {
    if (!open) {
      return;
    }
    let mounted = true;
    void getAppVersion().then((value) => {
      if (mounted) {
        setVersion(value);
      }
    });
    return () => {
      mounted = false;
    };
  }, [open]);

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

  if (!open) {
    return null;
  }

  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div
        className="about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="modal-close"
          onClick={onClose}
          aria-label={t("Close about dialog")}
        >
          <X size={16} strokeWidth={1.8} />
        </button>
        <div className="about-mark">M</div>
        <h2 id="about-title">MarkSI</h2>
        <div className="about-version">
          {t("Version {version}", { version })}
        </div>
        <p className="about-copy">
          {t(
            "A focused, local-first Markdown studio for Windows and Linux. Your words stay in plain text and on your machine.",
          )}
        </p>
        <div className="about-meta">
          <span>{t("MIT license")}</span>
          <span>{t("No account")}</span>
          <span>{t("No telemetry")}</span>
        </div>
        <button className="button button-primary about-button" onClick={onClose}>
          {t("Close")}
        </button>
      </div>
    </div>
  );
}
