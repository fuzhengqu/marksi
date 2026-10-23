import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, FileText, Loader2, Search } from "lucide-react";
import { isTauri, listWorkspaceFiles } from "../lib/platform";
import { rankQuickOpen, type QuickOpenItem } from "../lib/quickOpen";
import { useAppStore } from "../store/useAppStore";

interface QuickOpenProps {
  onOpen: (path: string) => void;
}

export function QuickOpen({ onOpen }: QuickOpenProps) {
  const open = useAppStore((state) => state.quickOpen);
  const recent = useAppStore((state) => state.recent);
  const workspace = useAppStore((state) => state.workspace);
  const setQuickOpen = useAppStore((state) => state.setQuickOpen);
  const showToast = useAppStore((state) => state.showToast);
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<QuickOpenItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuery("");
    setActiveIndex(0);
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    const recentItems: QuickOpenItem[] = recent.map((item) => ({
      path: item.path,
      name: item.name,
      recent: true,
    }));
    const known = new Set(
      recentItems.map((item) => item.path.replace(/\\/g, "/").toLowerCase()),
    );

    if (!workspace || !isTauri()) {
      setFiles(recentItems);
      return;
    }

    setLoading(true);
    void listWorkspaceFiles(workspace.path)
      .then((entries) => {
        if (cancelled) {
          return;
        }
        const workspaceItems = entries
          .filter((entry) => {
            const key = entry.path.replace(/\\/g, "/").toLowerCase();
            return !known.has(key);
          })
          .map((entry) => ({
            path: entry.path,
            name: entry.name,
            relativePath: entry.relativePath,
          }));
        setFiles([...recentItems, ...workspaceItems]);
      })
      .catch((error) => {
        if (!cancelled) {
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

    return () => {
      cancelled = true;
    };
  }, [open, recent, showToast, workspace]);

  const results = useMemo(
    () => rankQuickOpen(files, query),
    [files, query],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) {
    return null;
  }

  function choose(index: number) {
    const item = results[index];
    if (!item) {
      return;
    }
    setQuickOpen(false);
    onOpen(item.path);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setQuickOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) =>
        results.length === 0 ? 0 : (index + 1) % results.length,
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        results.length === 0
          ? 0
          : (index - 1 + results.length) % results.length,
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      choose(activeIndex);
    }
  }

  return (
    <div
      className="quick-open-scrim"
      onMouseDown={() => setQuickOpen(false)}
      role="presentation"
    >
      <div
        className="quick-open"
        role="dialog"
        aria-modal="true"
        aria-label="Quick open"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="quick-open-search">
          <Search size={17} strokeWidth={1.9} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search files by name or path…"
            aria-label="Search files"
            autoComplete="off"
            spellCheck={false}
          />
          {loading ? (
            <Loader2 size={15} className="spin" aria-label="Loading files" />
          ) : (
            <span className="quick-open-count">{results.length}</span>
          )}
        </div>

        <div className="quick-open-results" role="listbox" aria-label="Files">
          {results.length === 0 ? (
            <div className="quick-open-empty">
              <FileText size={22} strokeWidth={1.3} />
              <p>
                {files.length === 0
                  ? "Open a folder to search your workspace."
                  : "No matching files."}
              </p>
            </div>
          ) : (
            results.map((item, index) => (
              <button
                key={item.path}
                className={`quick-open-item ${index === activeIndex ? "is-active" : ""}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(index)}
                title={item.path}
              >
                <span className="quick-open-icon">
                  <FileText size={16} strokeWidth={1.8} />
                </span>
                <span className="quick-open-copy">
                  <span className="quick-open-name">{item.name}</span>
                  <span className="quick-open-path">
                    {item.relativePath ?? item.path}
                  </span>
                </span>
                {item.recent ? (
                  <span className="quick-open-badge">recent</span>
                ) : null}
              </button>
            ))
          )}
        </div>

        <div className="quick-open-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>Enter</kbd> open
          </span>
          <span>
            <CornerDownLeft size={11} strokeWidth={1.8} /> Esc close
          </span>
        </div>
      </div>
    </div>
  );
}
