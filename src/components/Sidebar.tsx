import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  File,
  FileText,
  Folder,
  FolderInput,
  FolderOpen,
  Heading,
  List,
  Loader2,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { extractOutline } from "../editor/analyze";
import { normalizeLaxMarkdown } from "../lib/strictMarkdown";
import { useT } from "../i18n";
import {
  deleteWorkspaceFile,
  duplicateWorkspaceFile,
  fileName,
  isTauri,
  listDirectory,
  listWorkspaceFiles,
  moveWorkspaceFile,
  renameWorkspaceFile,
  searchWorkspace,
} from "../lib/platform";
import {
  isSupportedTextFile,
  normalizeRelativeFolder,
  relativeFolder,
  sameFilePath,
  validateFileName,
  type FileOperationKind,
  type FileOperationTarget,
} from "../lib/fileOps";
import { isPinned } from "../lib/pins";
import { useFocusTrap } from "../lib/useFocusTrap";
import { useAppStore } from "../store/useAppStore";
import type {
  FileEntry,
  SearchScope,
  SidebarTab,
  WorkspaceFile,
  WorkspaceSearchMatch,
} from "../types";

interface SidebarProps {
  onOpenFile: (path: string) => void;
  onOpenFileAtLine: (path: string, line: number) => void;
  onOpenFileDialog: () => void;
  onOpenFolder: () => void;
  onOpenFolderPath: (path: string) => void;
  onNewFile: () => void;
  onQuickOpen: () => void;
  onRefreshWorkspace: () => void;
  onFilesChanged: (
    oldPath: string | null,
    newPath: string | null,
  ) => void;
}

const tabs: Array<{ id: SidebarTab; label: string; icon: typeof Folder }> = [
  { id: "files", label: "Files", icon: Folder },
  { id: "outline", label: "Outline", icon: List },
  { id: "search", label: "Search", icon: Search },
];

export function Sidebar({
  onOpenFile,
  onOpenFileAtLine,
  onOpenFileDialog,
  onOpenFolder,
  onOpenFolderPath,
  onNewFile,
  onQuickOpen,
  onRefreshWorkspace,
  onFilesChanged,
}: SidebarProps) {
  const t = useT();
  const doc = useAppStore((state) => state.doc);
  const recent = useAppStore((state) => state.recent);
  const workspace = useAppStore((state) => state.workspace);
  const sidebarTab = useAppStore((state) => state.sidebarTab);
  const setSidebarTab = useAppStore((state) => state.setSidebarTab);
  const requestGotoLine = useAppStore((state) => state.requestGotoLine);
  const showToast = useAppStore((state) => state.showToast);

  const strictMode = useAppStore((state) => state.settings.strictMode);
  const outline = useMemo(
    () =>
      extractOutline(
        strictMode ? doc.content : normalizeLaxMarkdown(doc.content),
      ),
    [doc.content, strictMode],
  );

  function onTabKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    id: SidebarTab,
  ): void {
    const index = tabs.findIndex((tab) => tab.id === id);
    let next = index;
    if (event.key === "ArrowRight") {
      next = (index + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      next = (index - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = tabs.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    setSidebarTab(tabs[next].id);
    window.requestAnimationFrame(() => {
      document.getElementById(`sidebar-tab-${tabs[next].id}`)?.focus();
    });
  }

  return (
    <aside className="sidebar">
      <div
        className="sidebar-tabs"
        role="tablist"
        aria-label={t("Sidebar panels")}
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`sidebar-tab-${id}`}
            role="tab"
            aria-selected={sidebarTab === id}
            aria-controls={`sidebar-panel-${id}`}
            tabIndex={sidebarTab === id ? 0 : -1}
            className={`sidebar-tab ${sidebarTab === id ? "is-active" : ""}`}
            onClick={() => setSidebarTab(id)}
            onKeyDown={(event) => onTabKeyDown(event, id)}
            title={t(label)}
          >
            <Icon size={15} strokeWidth={1.8} />
            <span>{t(label)}</span>
          </button>
        ))}
      </div>

      <div
        className="sidebar-content"
        id={`sidebar-panel-${sidebarTab}`}
        role="tabpanel"
        aria-labelledby={`sidebar-tab-${sidebarTab}`}
        tabIndex={-1}
      >
        {sidebarTab === "files" ? (
          <FilesPanel
            onNewFile={onNewFile}
            onOpenFile={onOpenFile}
            onOpenFileDialog={onOpenFileDialog}
            onOpenFolder={onOpenFolder}
            onOpenFolderPath={onOpenFolderPath}
            onQuickOpen={onQuickOpen}
            onRefreshWorkspace={onRefreshWorkspace}
            onFilesChanged={onFilesChanged}
            onShowToast={showToast}
            recent={recent}
            workspace={workspace}
          />
        ) : null}

        {sidebarTab === "outline" ? (
          <div className="panel-scroll">
            <div className="panel-heading">
              <span>{t("Outline")}</span>
              <span className="panel-count">{outline.length}</span>
            </div>
            {outline.length === 0 ? (
              <div className="empty-panel">
                <Heading size={22} strokeWidth={1.3} />
                <p>{t("Headings appear here as you write.")}</p>
              </div>
            ) : (
              <div className="outline-list">
                {outline.map((item, index) => (
                  <button
                    key={`${item.line}-${index}`}
                    className="outline-item"
                    style={{ paddingLeft: 10 + (item.level - 1) * 14 }}
                    onClick={() => requestGotoLine(item.line)}
                    title={t("Line {line}", { line: item.line })}
                  >
                    <span className="outline-marker">H{item.level}</span>
                    <span className="outline-text">
                      {item.text || t("Untitled heading")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {sidebarTab === "search" ? (
          <SearchPanel
            content={doc.content}
            workspace={workspace}
            onSelect={(line) => requestGotoLine(line)}
            onOpenFile={onOpenFileAtLine}
          />
        ) : null}
      </div>

    </aside>
  );
}

type FileMenuAction = FileOperationKind | "pin";

interface FilesPanelProps {
  recent: Array<{ path: string; name: string }>;
  workspace: { path: string; entries: FileEntry[]; loading: boolean } | null;
  onNewFile: () => void;
  onOpenFile: (path: string) => void;
  onOpenFileDialog: () => void;
  onOpenFolder: () => void;
  onOpenFolderPath: (path: string) => void;
  onQuickOpen: () => void;
  onRefreshWorkspace: () => void;
  onFilesChanged: (
    oldPath: string | null,
    newPath: string | null,
  ) => void;
  onShowToast: (message: string, tone?: "info" | "success" | "error") => void;
}

function FilesPanel({
  recent,
  workspace,
  onNewFile,
  onOpenFile,
  onOpenFileDialog,
  onOpenFolder,
  onOpenFolderPath,
  onQuickOpen,
  onRefreshWorkspace,
  onFilesChanged,
  onShowToast,
}: FilesPanelProps) {
  const t = useT();
  const removeRecent = useAppStore((state) => state.removeRecent);
  const pinned = useAppStore((state) => state.pinned);
  const togglePinned = useAppStore((state) => state.togglePinned);
  const removePinned = useAppStore((state) => state.removePinned);
  const flatFileList = useAppStore(
    (state) => state.settings.flatFileList,
  );
  const [operation, setOperation] = useState<{
    kind: FileOperationKind;
    entry: FileOperationTarget;
  } | null>(null);
  const [menu, setMenu] = useState<FileOperationTarget | null>(null);
  const [treeVersion, setTreeVersion] = useState(0);

  useEffect(() => {
    if (!menu) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (
        target.closest(".file-actions-menu") ||
        target.closest(".file-row-actions")
      ) {
        return;
      }
      setMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(null);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menu]);

  function toggleMenu(entry: FileOperationTarget): void {
    setMenu((current) =>
      current?.path === entry.path ? null : entry,
    );
  }

  function chooseAction(
    kind: FileMenuAction,
    entry: FileOperationTarget,
  ): void {
    setMenu(null);
    if (kind === "pin") {
      const wasPinned = isPinned(pinned, entry.path);
      togglePinned({
        path: entry.path,
        name: entry.name,
        isDir: Boolean(entry.isDir),
      });
      onShowToast(
        wasPinned ? t("Unpinned from sidebar.") : t("Pinned to sidebar."),
        "success",
      );
      return;
    }
    setOperation({ kind, entry });
  }

  function completeOperation(
    oldPath: string | null,
    newPath: string | null,
  ): void {
    setOperation(null);
    setTreeVersion((value) => value + 1);
    onFilesChanged(oldPath, newPath);
  }

  return (
    <div className="panel-scroll">
      {pinned.length > 0 ? (
        <div className="pinned-section">
          <div className="panel-subheading">{t("Pinned")}</div>
          <div className="recent-list">
            {pinned.map((item) => (
              <div key={item.path} className="recent-item">
                <button
                  className="recent-open"
                  title={item.path}
                  onClick={() =>
                    item.isDir
                      ? onOpenFolderPath(item.path)
                      : onOpenFile(item.path)
                  }
                >
                  {item.isDir ? (
                    <Folder size={14} strokeWidth={1.7} />
                  ) : (
                    <FileText size={14} strokeWidth={1.7} />
                  )}
                  <span className="recent-name">{item.name}</span>
                </button>
                <button
                  className="recent-remove"
                  title={t("Unpin from sidebar")}
                  aria-label={t("Unpin from sidebar")}
                  onClick={() => removePinned(item.path)}
                >
                  <X size={12} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="panel-heading">
        <span>{workspace ? fileName(workspace.path) : t("Workspace")}</span>
        {workspace ? (
          <button
            className="mini-button"
            title={t("Refresh folder")}
            aria-label={t("Refresh folder")}
            onClick={onRefreshWorkspace}
          >
            <RefreshCw size={13} strokeWidth={1.8} />
          </button>
        ) : null}
      </div>

      {workspace ? (
        workspace.loading ? (
          <div className="panel-loading">
            <Loader2 size={15} className="spin" />
            <span>{t("Reading folder…")}</span>
          </div>
        ) : flatFileList ? (
          <FlatFileList
            key={`flat-${treeVersion}`}
            workspacePath={workspace.path}
            refreshKey={workspace.entries}
            activeMenuPath={menu?.path ?? null}
            onOpenFile={onOpenFile}
            onShowToast={onShowToast}
            onToggleMenu={toggleMenu}
            onChooseAction={chooseAction}
          />
        ) : workspace.entries.length === 0 ? (
          <div className="empty-panel compact">
            <FolderOpen size={22} strokeWidth={1.3} />
            <p>{t("This folder has no visible files.")}</p>
          </div>
        ) : (
          <div className="file-tree" key={`tree-${treeVersion}`}>
            {workspace.entries.map((entry) => (
              <FileTreeNode
                key={entry.path}
                entry={entry}
                depth={0}
                activeMenuPath={menu?.path ?? null}
                onOpenFile={onOpenFile}
                onShowToast={onShowToast}
                onToggleMenu={toggleMenu}
                onChooseAction={chooseAction}
              />
            ))}
          </div>
        )
      ) : (
        <div className="workspace-empty">
          <div className="workspace-empty-actions">
            <button className="button button-quiet" onClick={onOpenFileDialog}>
              {t("Open file")}
            </button>
            <button className="button button-quiet" onClick={onOpenFolder}>
              {t("Open folder")}
            </button>
            <button className="button button-quiet" onClick={onQuickOpen}>
              {t("Quick open")}
            </button>
            <button className="button button-quiet" onClick={onNewFile}>
              {t("New document")}
            </button>
          </div>

          <div className="panel-subheading">{t("Recent files")}</div>
          {recent.length === 0 ? (
            <div className="recent-empty">{t("No recent documents yet.")}</div>
          ) : (
            <div className="recent-list">
              {recent.slice(0, 8).map((item) => (
                <div key={item.path} className="recent-item">
                  <button
                    className="recent-open"
                    onClick={() => onOpenFile(item.path)}
                    title={item.path}
                  >
                    <FileText size={14} strokeWidth={1.7} />
                    <span className="recent-name">{item.name}</span>
                  </button>
                  <button
                    className="recent-remove"
                    onClick={() => removeRecent(item.path)}
                    title={t("Remove from recent")}
                    aria-label={t("Remove from recent")}
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {operation && workspace ? (
        <FileOperationDialog
          key={`${operation.kind}-${operation.entry.path}`}
          operation={operation}
          workspacePath={workspace.path}
          onClose={() => setOperation(null)}
          onComplete={completeOperation}
          onShowToast={onShowToast}
        />
      ) : null}
    </div>
  );
}

interface FlatFileListProps {
  workspacePath: string;
  refreshKey: FileEntry[];
  activeMenuPath: string | null;
  onOpenFile: (path: string) => void;
  onShowToast: (message: string, tone?: "info" | "success" | "error") => void;
  onToggleMenu: (entry: FileOperationTarget) => void;
  onChooseAction: (
    kind: FileMenuAction,
    entry: FileOperationTarget,
  ) => void;
}

function FlatFileList({
  workspacePath,
  refreshKey,
  activeMenuPath,
  onOpenFile,
  onShowToast,
  onToggleMenu,
  onChooseAction,
}: FlatFileListProps) {
  const t = useT();
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listWorkspaceFiles(workspacePath)
      .then((entries) => {
        if (!cancelled) {
          setFiles(entries);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          const message =
            cause instanceof Error ? cause.message : String(cause);
          setFiles([]);
          setError(message);
          onShowToast(message, "error");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [onShowToast, refreshKey, workspacePath]);

  if (loading) {
    return (
      <div className="panel-loading">
        <Loader2 size={15} className="spin" />
        <span>{t("Reading folder…")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-panel compact">
        <FolderOpen size={22} strokeWidth={1.3} />
        <p>{error}</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="empty-panel compact">
        <FolderOpen size={22} strokeWidth={1.3} />
        <p>{t("This folder has no visible files.")}</p>
      </div>
    );
  }

  return (
    <div className="file-tree flat-file-list">
      {files.map((file) => (
        <div key={file.path} className="file-row-wrap">
          <button
            className="file-row"
            onClick={() => onOpenFile(file.path)}
            title={file.path}
          >
            <FileText size={15} strokeWidth={1.7} />
            <span className="file-name">{file.name}</span>
            <small className="file-relative">{file.relativePath}</small>
          </button>
          <button
            className="file-row-actions"
            aria-label={t("File actions")}
            aria-haspopup="menu"
            aria-expanded={activeMenuPath === file.path}
            title={t("File actions")}
            onClick={() => onToggleMenu(file)}
          >
            <MoreHorizontal size={14} strokeWidth={1.9} />
          </button>
          {activeMenuPath === file.path ? (
            <FileActionsMenu target={file} onChoose={onChooseAction} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

interface FileTreeNodeProps {
  entry: FileEntry;
  depth: number;
  activeMenuPath: string | null;
  onOpenFile: (path: string) => void;
  onShowToast: (message: string, tone?: "info" | "success" | "error") => void;
  onToggleMenu: (entry: FileOperationTarget) => void;
  onChooseAction: (
    kind: FileMenuAction,
    entry: FileOperationTarget,
  ) => void;
}

function FileTreeNode({
  entry,
  depth,
  activeMenuPath,
  onOpenFile,
  onShowToast,
  onToggleMenu,
  onChooseAction,
}: FileTreeNodeProps) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const indent = 10 + depth * 14;

  async function toggle() {
    if (!entry.isDir) {
      onOpenFile(entry.path);
      return;
    }

    if (!expanded && children === null) {
      if (!isTauri()) {
        onShowToast(t("Folder expansion is available in the desktop app."), "info");
        return;
      }
      setLoading(true);
      try {
        const entries = await listDirectory(entry.path);
        setChildren(entries);
      } catch (error) {
        onShowToast(error instanceof Error ? error.message : String(error), "error");
      } finally {
        setLoading(false);
      }
    }

    setExpanded((value) => !value);
  }

  const isMarkdown = /\.(md|markdown|mdown|mkd|mdwn|mmd)$/i.test(entry.name);

  return (
    <div className="file-node">
      <div className="file-row-wrap">
        <button
          className={`file-row ${entry.isDir ? "is-folder" : ""}`}
          style={{ paddingLeft: indent }}
          onClick={() => void toggle()}
          title={entry.path}
        >
          <span className="file-chevron">
            {entry.isDir ? (
              loading ? (
                <Loader2 size={12} className="spin" />
              ) : expanded ? (
                <ChevronDown size={13} />
              ) : (
                <ChevronRight size={13} />
              )
            ) : null}
          </span>
          {entry.isDir ? (
            expanded ? (
              <FolderOpen size={15} strokeWidth={1.7} />
            ) : (
              <Folder size={15} strokeWidth={1.7} />
            )
          ) : isMarkdown ? (
            <FileText size={15} strokeWidth={1.7} />
          ) : (
            <File size={15} strokeWidth={1.7} />
          )}
          <span className="file-name">{entry.name}</span>
        </button>
        {entry.isDir || isSupportedTextFile(entry.name) ? (
          <button
            className="file-row-actions"
            aria-label={t("File actions")}
            aria-haspopup="menu"
            aria-expanded={activeMenuPath === entry.path}
            title={t("File actions")}
            onClick={() => onToggleMenu(entry)}
          >
            <MoreHorizontal size={14} strokeWidth={1.9} />
          </button>
        ) : null}
        {activeMenuPath === entry.path ? (
          <FileActionsMenu target={entry} onChoose={onChooseAction} />
        ) : null}
      </div>

      {entry.isDir && expanded && children
        ? children.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              activeMenuPath={activeMenuPath}
              onOpenFile={onOpenFile}
              onShowToast={onShowToast}
              onToggleMenu={onToggleMenu}
              onChooseAction={onChooseAction}
            />
          ))
        : null}
    </div>
  );
}

function FileActionsMenu({
  target,
  onChoose,
}: {
  target: FileOperationTarget;
  onChoose: (
    kind: FileMenuAction,
    entry: FileOperationTarget,
  ) => void;
}) {
  const t = useT();
  const pinned = useAppStore((state) => state.pinned);
  const pinnedHere = isPinned(pinned, target.path);
  const actions: Array<{
    kind: FileOperationKind;
    label: string;
    icon: typeof Pencil;
    danger?: boolean;
  }> = [
    { kind: "rename", label: "Rename", icon: Pencil },
    { kind: "duplicate", label: "Duplicate", icon: Copy },
    { kind: "move", label: "Move to folder…", icon: FolderInput },
    { kind: "delete", label: "Delete", icon: Trash2, danger: true },
  ];
  return (
    <div className="file-actions-menu" role="menu" aria-label={t("File actions")}>
      <div className="file-actions-title">{target.name}</div>
      <button
        type="button"
        role="menuitem"
        className="file-action"
        data-action="pin"
        onClick={() => onChoose("pin", target)}
      >
        {pinnedHere ? (
          <PinOff size={14} strokeWidth={1.8} />
        ) : (
          <Pin size={14} strokeWidth={1.8} />
        )}
        <span>
          {t(pinnedHere ? "Unpin from sidebar" : "Pin to sidebar")}
        </span>
      </button>
      {target.isDir ? null : (
        <>
          <div className="file-actions-separator" />
          {actions.map(({ kind, label, icon: Icon, danger }) => (
            <button
              key={kind}
              type="button"
              role="menuitem"
              className={`file-action ${danger ? "is-danger" : ""}`}
              data-action={kind}
              onClick={() => onChoose(kind, target)}
            >
              <Icon size={14} strokeWidth={1.8} />
              <span>{t(label)}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}

function FileOperationDialog({
  operation,
  workspacePath,
  onClose,
  onComplete,
  onShowToast,
}: {
  operation: { kind: FileOperationKind; entry: FileOperationTarget };
  workspacePath: string;
  onClose: () => void;
  onComplete: (oldPath: string | null, newPath: string | null) => void;
  onShowToast: (message: string, tone?: "info" | "success" | "error") => void;
}) {
  const t = useT();
  const { kind, entry } = operation;
  const dialogRef = useRef<HTMLFormElement | null>(null);
  useFocusTrap(true, dialogRef);
  const docPath = useAppStore((state) => state.doc.path);
  const docDirty = useAppStore((state) => state.doc.dirty);
  const [value, setValue] = useState(() => {
    if (kind === "rename") {
      return entry.name;
    }
    if (kind === "move") {
      return relativeFolder(workspacePath, entry.path);
    }
    return "";
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  const validation =
    kind === "rename"
      ? validateFileName(value)
      : kind === "move" && normalizeRelativeFolder(value) === null
        ? "Choose a folder inside the workspace."
        : null;
  const deletingOpenDocument =
    kind === "delete" && sameFilePath(docPath, entry.path);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (kind === "delete") {
        cancelRef.current?.focus();
      } else {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }, 20);
    return () => window.clearTimeout(timer);
  }, [kind]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (busy || validation) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (kind === "delete") {
        await deleteWorkspaceFile(workspacePath, entry.path);
        onShowToast(t("Deleted {name}", { name: entry.name }), "success");
        onComplete(entry.path, null);
        return;
      }

      let result;
      if (kind === "rename") {
        result = await renameWorkspaceFile(
          workspacePath,
          entry.path,
          value.trim(),
        );
        onShowToast(
          t("Renamed to {name}", { name: result.name }),
          "success",
        );
      } else if (kind === "duplicate") {
        result = await duplicateWorkspaceFile(workspacePath, entry.path);
        onShowToast(t("Created {name}", { name: result.name }), "success");
      } else {
        const folder = normalizeRelativeFolder(value);
        result = await moveWorkspaceFile(
          workspacePath,
          entry.path,
          folder ?? "",
        );
        onShowToast(t("Moved to {name}", { name: result.name }), "success");
      }

      onComplete(
        kind === "duplicate" ? null : entry.path,
        result.path,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  const title =
    kind === "rename"
      ? "Rename file"
      : kind === "duplicate"
        ? "Duplicate file"
        : kind === "move"
          ? "Move file"
          : "Delete file";
  const Icon =
    kind === "rename"
      ? Pencil
      : kind === "duplicate"
        ? Copy
        : kind === "move"
          ? FolderInput
          : Trash2;

  return (
    <div
      className="modal-scrim file-op-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <form
        ref={dialogRef}
        className="file-op-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-op-title"
        tabIndex={-1}
        onSubmit={(event) => void submit(event)}
      >
        <header className="file-op-header">
          <span
            className={`settings-mark ${kind === "delete" ? "is-danger" : ""}`}
            aria-hidden="true"
          >
            <Icon size={17} strokeWidth={1.8} />
          </span>
          <div className="file-op-heading">
            <h2 id="file-op-title">{t(title)}</h2>
            <p title={entry.path}>{entry.path}</p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={busy}
            title={t("Close")}
            aria-label={t("Close")}
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </header>

        <div className="file-op-body">
          {kind === "rename" || kind === "move" ? (
            <label className="file-op-field">
              <span>
                {kind === "rename"
                  ? t("New name")
                  : t("Destination folder")}
              </span>
              <input
                ref={inputRef}
                className="file-op-input"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={
                  kind === "rename" ? "note.md" : t("Leave empty for the workspace root")
                }
                spellCheck={false}
                disabled={busy}
              />
              <small>
                {kind === "rename"
                  ? t("Use a supported Markdown or text file extension.")
                  : t(
                      "Relative to the workspace root. Leave empty for the root.",
                    )}
              </small>
            </label>
          ) : null}

          {kind === "duplicate" ? (
            <p className="file-op-copy">
              {t("A copy of “{name}” will be created in the same folder.", {
                name: entry.name,
              })}
            </p>
          ) : null}

          {kind === "delete" ? (
            <div className="file-op-copy">
              <p>
                {t("Delete “{name}”? This cannot be undone.", {
                  name: entry.name,
                })}
              </p>
              {deletingOpenDocument ? (
                <p className="file-op-warning">
                  {docDirty
                    ? t(
                        "The open document will close and unsaved changes will be lost.",
                      )
                    : t("The open document will close.")}
                </p>
              ) : null}
            </div>
          ) : null}

          {validation && kind === "rename" ? (
            <p className="file-op-error">{t(validation)}</p>
          ) : null}
          {validation && kind === "move" ? (
            <p className="file-op-error">{t(validation)}</p>
          ) : null}
          {error ? <p className="file-op-error">{error}</p> : null}
        </div>

        <footer className="file-op-footer">
          <button
            ref={cancelRef}
            type="button"
            className="button button-quiet file-op-cancel"
            onClick={onClose}
            disabled={busy}
          >
            {t("Cancel")}
          </button>
          <button
            type="submit"
            className={`button file-op-confirm ${
              kind === "delete" ? "button-danger" : "button-primary"
            }`}
            disabled={busy || Boolean(validation)}
          >
            {busy
              ? t("Working…")
              : kind === "rename"
                ? t("Rename")
                : kind === "duplicate"
                  ? t("Create copy")
                  : kind === "move"
                    ? t("Move")
                    : t("Delete")}
          </button>
        </footer>
      </form>
    </div>
  );
}

interface SearchPanelProps {
  content: string;
  workspace: { path: string; entries: FileEntry[]; loading: boolean } | null;
  onSelect: (line: number) => void;
  onOpenFile: (path: string, line: number) => void;
}

function SearchPanel({
  content,
  workspace,
  onSelect,
  onOpenFile,
}: SearchPanelProps) {
  const t = useT();
  const searchScope = useAppStore((state) => state.searchScope);
  const setSearchScope = useAppStore((state) => state.setSearchScope);
  const showToast = useAppStore((state) => state.showToast);
  const [term, setTerm] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [workspaceResults, setWorkspaceResults] = useState<
    WorkspaceSearchMatch[]
  >([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!workspace && searchScope === "workspace") {
      setSearchScope("document");
    }
  }, [searchScope, setSearchScope, workspace]);

  const documentResults = useMemo(() => {
    const query = caseSensitive ? term.trim() : term.trim().toLowerCase();
    if (!query) {
      return [];
    }
    return content
      .split(/\r?\n/)
      .map((line, index) => ({ line, number: index + 1 }))
      .filter((entry) => {
        const source = caseSensitive ? entry.line : entry.line.toLowerCase();
        return source.includes(query);
      })
      .slice(0, 200);
  }, [caseSensitive, content, term]);

  useEffect(() => {
    const query = term.trim();
    if (
      searchScope !== "workspace" ||
      !workspace ||
      !query ||
      !isTauri()
    ) {
      setWorkspaceResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void searchWorkspace(workspace.path, query, caseSensitive)
        .then((matches) => {
          if (!cancelled) {
            setWorkspaceResults(matches);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setWorkspaceResults([]);
            showToast(
              error instanceof Error ? error.message : String(error),
              "error",
            );
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [caseSensitive, searchScope, showToast, term, workspace]);

  const hasQuery = term.trim().length > 0;
  const isWorkspaceSearch = searchScope === "workspace";
  const resultCount = isWorkspaceSearch
    ? workspaceResults.length
    : documentResults.length;

  return (
    <div className="panel-scroll">
      <div className="panel-heading">
        <span>{t("Search")}</span>
        {hasQuery ? <span className="panel-count">{resultCount}</span> : null}
      </div>

      <div
        className="search-scope"
        role="group"
        aria-label={t("Search scope")}
      >
        {(
          [
            { id: "document", label: "Document" },
            { id: "workspace", label: "Folder" },
          ] as Array<{ id: SearchScope; label: string }>
        ).map((scope) => (
          <button
            key={scope.id}
            className={searchScope === scope.id ? "is-active" : ""}
            onClick={() => setSearchScope(scope.id)}
            disabled={scope.id === "workspace" && !workspace}
            title={
              scope.id === "workspace" && !workspace
                ? t("Open a folder to search it")
                : undefined
            }
          >
            {t(scope.label)}
          </button>
        ))}
      </div>

      <label className="search-box">
        <Search size={14} strokeWidth={1.8} />
        <input
          ref={inputRef}
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={
            isWorkspaceSearch
              ? t("Search this folder…")
              : t("Find in document…")
          }
          aria-label={
            isWorkspaceSearch ? t("Search workspace") : t("Search in document")
          }
        />
        <button
          type="button"
          className={`search-case ${caseSensitive ? "is-active" : ""}`}
          aria-pressed={caseSensitive}
          title={t("Match case")}
          onClick={() => setCaseSensitive((value) => !value)}
        >
          Aa
        </button>
      </label>

      {loading ? (
        <div className="panel-loading">
          <Loader2 size={14} className="spin" />
          <span>{t("Searching folder…")}</span>
        </div>
      ) : null}

      {hasQuery ? (
        isWorkspaceSearch ? (
          workspaceResults.length === 0 && !loading ? (
            <div className="recent-empty">
              {t("No matches in this folder.")}
            </div>
          ) : (
            <div className="search-results">
              {workspaceResults.map((result) => (
                <button
                  key={`${result.path}:${result.line}:${result.column}`}
                  className="search-result search-result-workspace"
                  onClick={() => onOpenFile(result.path, result.line)}
                  title={`${result.path}:${result.line}`}
                >
                  <span className="search-line">{result.line}</span>
                  <span className="search-result-copy">
                    <span className="search-result-heading">
                      <span>{result.name}</span>
                      <span className="search-result-path">
                        {result.relativePath}
                      </span>
                    </span>
                    <span className="search-text">
                      {result.preview || " "}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )
        ) : documentResults.length === 0 ? (
          <div className="recent-empty">{t("No matches.")}</div>
        ) : (
          <div className="search-results">
            {documentResults.map((result) => (
              <button
                key={result.number}
                className="search-result"
                onClick={() => onSelect(result.number)}
                title={t("Line {line}", { line: result.number })}
              >
                <span className="search-line">{result.number}</span>
                <span className="search-text">{result.line.trim() || " "}</span>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="empty-panel compact">
          <Search size={22} strokeWidth={1.3} />
          <p>
            {isWorkspaceSearch
              ? t("Search every Markdown and text file in the open folder.")
              : t(
                  "Search the current document. Use Ctrl+Shift+F to search the whole folder.",
                )}
          </p>
        </div>
      )}
    </div>
  );
}
