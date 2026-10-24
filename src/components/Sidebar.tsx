import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  File,
  FileText,
  Folder,
  FolderOpen,
  Heading,
  List,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { extractOutline } from "../editor/analyze";
import { normalizeLaxMarkdown } from "../lib/strictMarkdown";
import { useT } from "../i18n";
import {
  fileName,
  isTauri,
  listDirectory,
  listWorkspaceFiles,
  searchWorkspace,
} from "../lib/platform";
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
  onNewFile: () => void;
  onQuickOpen: () => void;
  onRefreshWorkspace: () => void;
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
  onNewFile,
  onQuickOpen,
  onRefreshWorkspace,
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
            role="tab"
            aria-selected={sidebarTab === id}
            className={`sidebar-tab ${sidebarTab === id ? "is-active" : ""}`}
            onClick={() => setSidebarTab(id)}
            title={t(label)}
          >
            <Icon size={15} strokeWidth={1.8} />
            <span>{t(label)}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-content">
        {sidebarTab === "files" ? (
          <FilesPanel
            onNewFile={onNewFile}
            onOpenFile={onOpenFile}
            onOpenFileDialog={onOpenFileDialog}
            onOpenFolder={onOpenFolder}
            onQuickOpen={onQuickOpen}
            onRefreshWorkspace={onRefreshWorkspace}
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

interface FilesPanelProps {
  recent: Array<{ path: string; name: string }>;
  workspace: { path: string; entries: FileEntry[]; loading: boolean } | null;
  onNewFile: () => void;
  onOpenFile: (path: string) => void;
  onOpenFileDialog: () => void;
  onOpenFolder: () => void;
  onQuickOpen: () => void;
  onRefreshWorkspace: () => void;
  onShowToast: (message: string, tone?: "info" | "success" | "error") => void;
}

function FilesPanel({
  recent,
  workspace,
  onNewFile,
  onOpenFile,
  onOpenFileDialog,
  onOpenFolder,
  onQuickOpen,
  onRefreshWorkspace,
  onShowToast,
}: FilesPanelProps) {
  const t = useT();
  const removeRecent = useAppStore((state) => state.removeRecent);
  const flatFileList = useAppStore(
    (state) => state.settings.flatFileList,
  );
  return (
    <div className="panel-scroll">
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
            workspacePath={workspace.path}
            refreshKey={workspace.entries}
            onOpenFile={onOpenFile}
            onShowToast={onShowToast}
          />
        ) : workspace.entries.length === 0 ? (
          <div className="empty-panel compact">
            <FolderOpen size={22} strokeWidth={1.3} />
            <p>{t("This folder has no visible files.")}</p>
          </div>
        ) : (
          <div className="file-tree">
            {workspace.entries.map((entry) => (
              <FileTreeNode
                key={entry.path}
                entry={entry}
                depth={0}
                onOpenFile={onOpenFile}
                onShowToast={onShowToast}
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
    </div>
  );
}

interface FlatFileListProps {
  workspacePath: string;
  refreshKey: FileEntry[];
  onOpenFile: (path: string) => void;
  onShowToast: (message: string, tone?: "info" | "success" | "error") => void;
}

function FlatFileList({
  workspacePath,
  refreshKey,
  onOpenFile,
  onShowToast,
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
        <button
          key={file.path}
          className="file-row"
          onClick={() => onOpenFile(file.path)}
          title={file.path}
        >
          <FileText size={15} strokeWidth={1.7} />
          <span className="file-name">{file.name}</span>
          <small className="file-relative">{file.relativePath}</small>
        </button>
      ))}
    </div>
  );
}

interface FileTreeNodeProps {
  entry: FileEntry;
  depth: number;
  onOpenFile: (path: string) => void;
  onShowToast: (message: string, tone?: "info" | "success" | "error") => void;
}

function FileTreeNode({ entry, depth, onOpenFile, onShowToast }: FileTreeNodeProps) {
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
    <div>
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

      {entry.isDir && expanded && children
        ? children.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              onOpenFile={onOpenFile}
              onShowToast={onShowToast}
            />
          ))
        : null}
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
