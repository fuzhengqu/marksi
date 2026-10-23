import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  FileCode2,
  FilePlus2,
  FolderOpen,
  FolderX,
  Info,
  Moon,
  PanelLeft,
  Save,
  SaveAll,
  Sun,
  X,
} from "lucide-react";
import { getAppVersion } from "../lib/platform";
import { useAppStore } from "../store/useAppStore";

interface MenuOverlayProps {
  onNew: () => void;
  onOpen: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExportHtml: () => void;
  onCloseWorkspace: () => void;
}

export function MenuOverlay({
  onNew,
  onOpen,
  onOpenFolder,
  onSave,
  onSaveAs,
  onExportHtml,
  onCloseWorkspace,
}: MenuOverlayProps) {
  const open = useAppStore((state) => state.menuOpen);
  const setOpen = useAppStore((state) => state.setMenuOpen);
  const theme = useAppStore((state) => state.theme);
  const workspace = useAppStore((state) => state.workspace);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const [aboutOpen, setAboutOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
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
      <div className="menu-panel" role="menu" aria-label="MarkSI menu">
        <div className="menu-section-label">File</div>
        <MenuItem
          icon={<FilePlus2 size={16} strokeWidth={1.8} />}
          label="New document"
          shortcut="Ctrl N"
          onClick={() => run(onNew)}
        />
        <MenuItem
          icon={<FolderOpen size={16} strokeWidth={1.8} />}
          label="Open file…"
          shortcut="Ctrl O"
          onClick={() => run(onOpen)}
        />
        <MenuItem
          icon={<FolderOpen size={16} strokeWidth={1.8} />}
          label="Open folder…"
          shortcut="Ctrl ⇧ O"
          onClick={() => run(onOpenFolder)}
        />
        {workspace ? (
          <MenuItem
            icon={<FolderX size={16} strokeWidth={1.8} />}
            label="Close folder"
            onClick={() => run(onCloseWorkspace)}
          />
        ) : null}
        <div className="menu-separator" />
        <MenuItem
          icon={<Save size={16} strokeWidth={1.8} />}
          label="Save"
          shortcut="Ctrl S"
          onClick={() => run(onSave)}
        />
        <MenuItem
          icon={<SaveAll size={16} strokeWidth={1.8} />}
          label="Save as…"
          shortcut="Ctrl ⇧ S"
          onClick={() => run(onSaveAs)}
        />

        <div className="menu-section-label">View</div>
        <MenuItem
          icon={<PanelLeft size={16} strokeWidth={1.8} />}
          label="Toggle sidebar"
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
          label={theme === "light" ? "Dark appearance" : "Light appearance"}
          onClick={() => run(toggleTheme)}
        />

        <div className="menu-section-label">Export</div>
        <MenuItem
          icon={<FileCode2 size={16} strokeWidth={1.8} />}
          label="HTML document"
          badge="Soon"
          onClick={() => run(onExportHtml)}
        />

        <div className="menu-separator" />
        <MenuItem
          icon={<Info size={16} strokeWidth={1.8} />}
          label="About MarkSI"
          onClick={() => {
            setOpen(false);
            setAboutOpen(true);
          }}
        />
        <div className="menu-footer">
          <span className="menu-footer-mark">M</span>
          <span>MarkSI · MIT licensed</span>
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
  onClick: () => void;
}

function MenuItem({ icon, label, shortcut, badge, onClick }: MenuItemProps) {
  return (
    <button className="menu-item" role="menuitem" onClick={onClick}>
      <span className="menu-item-icon">{icon}</span>
      <span className="menu-item-label">{label}</span>
      {badge ? <span className="menu-badge">{badge}</span> : null}
      {shortcut ? <span className="menu-shortcut">{shortcut}</span> : null}
    </button>
  );
}

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

function AboutDialog({ open, onClose }: AboutDialogProps) {
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
        <button className="modal-close" onClick={onClose} aria-label="Close about dialog">
          <X size={16} strokeWidth={1.8} />
        </button>
        <div className="about-mark">M</div>
        <h2 id="about-title">MarkSI</h2>
        <div className="about-version">Version {version}</div>
        <p className="about-copy">
          A focused, local-first Markdown studio for Windows and Linux. Your words
          stay in plain text and on your machine.
        </p>
        <div className="about-meta">
          <span>MIT license</span>
          <span>No account</span>
          <span>No telemetry</span>
        </div>
        <button className="button button-primary about-button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
