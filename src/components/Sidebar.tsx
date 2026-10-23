import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  File,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Heading,
  List,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { extractOutline } from "../editor/analyze";
import { fileName, isTauri, listDirectory } from "../lib/platform";
import { useAppStore } from "../store/useAppStore";
import type { FileEntry, SidebarTab } from "../types";

interface SidebarProps {
  onOpenFile: (path: string) => void;
  onOpenFolder: () => void;
  onNewFile: () => void;
  onRefreshWorkspace: () => void;
}

const tabs: Array<{ id: SidebarTab; label: string; icon: typeof Folder }> = [
  { id: "files", label: "Files", icon: Folder },
  { id: "outline", label: "Outline", icon: List },
  { id: "search", label: "Search", icon: Search },
];

export function Sidebar({
  onOpenFile,
  onOpenFolder,
  onNewFile,
  onRefreshWorkspace,
}: SidebarProps) {
  const doc = useAppStore((state) => state.doc);
  const recent = useAppStore((state) => state.recent);
  const workspace = useAppStore((state) => state.workspace);
  const sidebarTab = useAppStore((state) => state.sidebarTab);
  const setSidebarTab = useAppStore((state) => state.setSidebarTab);
  const requestGotoLine = useAppStore((state) => state.requestGotoLine);
  const showToast = useAppStore((state) => state.showToast);

  const outline = useMemo(() => extractOutline(doc.content), [doc.content]);

  return (
    <aside className="sidebar">
      <div className="sidebar-tabs" role="tablist" aria-label="Sidebar panels">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={sidebarTab === id}
            className={`sidebar-tab ${sidebarTab === id ? "is-active" : ""}`}
            onClick={() => setSidebarTab(id)}
            title={label}
          >
            <Icon size={15} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-content">
        {sidebarTab === "files" ? (
          <FilesPanel
            onOpenFile={onOpenFile}
            onOpenFolder={onOpenFolder}
            onRefreshWorkspace={onRefreshWorkspace}
            onShowToast={showToast}
            recent={recent}
            workspace={workspace}
          />
        ) : null}

        {sidebarTab === "outline" ? (
          <div className="panel-scroll">
            <div className="panel-heading">
              <span>Outline</span>
              <span className="panel-count">{outline.length}</span>
            </div>
            {outline.length === 0 ? (
              <div className="empty-panel">
                <Heading size={22} strokeWidth={1.3} />
                <p>Headings appear here as you write.</p>
              </div>
            ) : (
              <div className="outline-list">
                {outline.map((item, index) => (
                  <button
                    key={`${item.line}-${index}`}
                    className="outline-item"
                    style={{ paddingLeft: 10 + (item.level - 1) * 14 }}
                    onClick={() => requestGotoLine(item.line)}
                    title={`Line ${item.line}`}
                  >
                    <span className="outline-marker">H{item.level}</span>
                    <span className="outline-text">{item.text || "Untitled heading"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {sidebarTab === "search" ? (
          <SearchPanel
            content={doc.content}
            onSelect={(line) => requestGotoLine(line)}
          />
        ) : null}
      </div>

      <div className="sidebar-footer">
        <button className="sidebar-action" onClick={onOpenFolder} title="Open folder">
          <FolderPlus size={15} strokeWidth={1.8} />
          <span>Open folder</span>
        </button>
        <button className="sidebar-action sidebar-action-icon" onClick={onNewFile} title="New file">
          <FilePlus2 size={16} strokeWidth={1.8} />
        </button>
      </div>
    </aside>
  );
}

interface FilesPanelProps {
  recent: Array<{ path: string; name: string }>;
  workspace: { path: string; entries: FileEntry[]; loading: boolean } | null;
  onOpenFile: (path: string) => void;
  onOpenFolder: () => void;
  onRefreshWorkspace: () => void;
  onShowToast: (message: string, tone?: "info" | "success" | "error") => void;
}

function FilesPanel({
  recent,
  workspace,
  onOpenFile,
  onOpenFolder,
  onRefreshWorkspace,
  onShowToast,
}: FilesPanelProps) {
  return (
    <div className="panel-scroll">
      <div className="panel-heading">
        <span>{workspace ? fileName(workspace.path) : "Workspace"}</span>
        {workspace ? (
          <button
            className="mini-button"
            title="Refresh folder"
            aria-label="Refresh folder"
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
            <span>Reading folder…</span>
          </div>
        ) : workspace.entries.length === 0 ? (
          <div className="empty-panel compact">
            <FolderOpen size={22} strokeWidth={1.3} />
            <p>This folder has no visible files.</p>
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
          <div className="empty-panel compact">
            <FolderOpen size={24} strokeWidth={1.3} />
            <p>Open a folder to keep your Markdown files close.</p>
            <button className="button button-quiet" onClick={onOpenFolder}>
              Open folder
            </button>
          </div>

          <div className="panel-subheading">Recent files</div>
          {recent.length === 0 ? (
            <div className="recent-empty">No recent documents yet.</div>
          ) : (
            <div className="recent-list">
              {recent.slice(0, 8).map((item) => (
                <button
                  key={item.path}
                  className="recent-item"
                  onClick={() => onOpenFile(item.path)}
                  title={item.path}
                >
                  <FileText size={14} strokeWidth={1.7} />
                  <span className="recent-name">{item.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
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
        onShowToast("Folder expansion is available in the desktop app.", "info");
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
  onSelect: (line: number) => void;
}

function SearchPanel({ content, onSelect }: SearchPanelProps) {
  const [term, setTerm] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    const query = term.trim().toLowerCase();
    if (!query) {
      return [];
    }
    return content
      .split(/\r?\n/)
      .map((line, index) => ({ line, number: index + 1 }))
      .filter((entry) => entry.line.toLowerCase().includes(query))
      .slice(0, 100);
  }, [content, term]);

  return (
    <div className="panel-scroll">
      <div className="panel-heading">
        <span>Search in document</span>
      </div>
      <label className="search-box">
        <Search size={14} strokeWidth={1.8} />
        <input
          ref={inputRef}
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Find text…"
          aria-label="Search in document"
        />
      </label>

      {term.trim() ? (
        results.length === 0 ? (
          <div className="recent-empty">No matches.</div>
        ) : (
          <div className="search-results">
            {results.map((result) => (
              <button
                key={result.number}
                className="search-result"
                onClick={() => onSelect(result.number)}
                title={`Line ${result.number}`}
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
          <p>Search the current document. Global workspace search arrives in M3.</p>
        </div>
      )}
    </div>
  );
}
