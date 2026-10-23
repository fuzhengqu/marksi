import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { DraftRecovery } from "./components/DraftRecovery";
import { EditorPane } from "./components/EditorPane";
import { MenuOverlay } from "./components/MenuOverlay";
import { QuickOpen } from "./components/QuickOpen";
import { SettingsDialog } from "./components/SettingsDialog";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { TitleBar } from "./components/TitleBar";
import { Toast } from "./components/Toast";
import { Welcome } from "./components/Welcome";
import { dispatchEditorCommand, dispatchEditorSearch } from "./editor/bridge";
import type { EditorCommand } from "./editor/format";
import { clearDraft, loadDraft, saveDraft } from "./lib/drafts";
import {
  fileName,
  getFileModifiedMs,
  isTauri,
  listDirectory,
  openDocument,
  openFolder,
  readDocument,
  saveDocument,
  saveHtmlFile,
} from "./lib/platform";
import { useAppStore } from "./store/useAppStore";
import type { AppSettings, DocumentDraft } from "./types";

const PreviewPane = lazy(() =>
  import("./components/PreviewPane").then((module) => ({
    default: module.PreviewPane,
  })),
);

function errorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function samePath(left: string | null, right: string | null): boolean {
  if (!left || !right) {
    return false;
  }
  return left.replace(/\\/g, "/").toLowerCase() ===
    right.replace(/\\/g, "/").toLowerCase();
}

export default function App() {
  const doc = useAppStore((state) => state.doc);
  const recent = useAppStore((state) => state.recent);
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const theme = useAppStore((state) => state.theme);
  const viewMode = useAppStore((state) => state.viewMode);
  const gotoLine = useAppStore((state) => state.gotoLine);
  const settings = useAppStore((state) => state.settings);
  const [draftToRecover, setDraftToRecover] =
    useState<DocumentDraft | null>(() => loadDraft());
  const savingRef = useRef(false);

  const confirmDiscard = useCallback(async () => {
    const current = useAppStore.getState().doc;
    if (!current.dirty) {
      return true;
    }
    if (!isTauri()) {
      return window.confirm("You have unsaved changes. Discard them?");
    }
    try {
      const { ask } = await import("@tauri-apps/plugin-dialog");
      return await ask("You have unsaved changes. Discard them?", {
        title: "Unsaved changes",
        kind: "warning",
        okLabel: "Discard changes",
        cancelLabel: "Keep editing",
      });
    } catch {
      return window.confirm("You have unsaved changes. Discard them?");
    }
  }, []);

  const handleNew = useCallback(async () => {
    if (!(await confirmDiscard())) {
      return;
    }
    useAppStore.getState().newDocument();
  }, [confirmDiscard]);

  const handleOpen = useCallback(async () => {
    if (!(await confirmDiscard())) {
      return;
    }
    const state = useAppStore.getState();
    state.setLoading(true);
    try {
      const payload = await openDocument();
      if (payload) {
        useAppStore.getState().setLoadedDocument(payload);
      }
    } catch (error) {
      state.showToast(errorMessage(error), "error");
    } finally {
      useAppStore.getState().setLoading(false);
    }
  }, [confirmDiscard]);

  const handleOpenPath = useCallback(
    async (path: string, line?: number) => {
      const current = useAppStore.getState();
      if (samePath(current.doc.path, path)) {
        if (line != null) {
          current.requestGotoLine(line);
        }
        return;
      }
      if (!(await confirmDiscard())) {
        return;
      }
      const state = useAppStore.getState();
      if (!isTauri() && !/[\\/]/.test(path)) {
        try {
          const payload = await openDocument();
          if (payload) {
            useAppStore.getState().setLoadedDocument(payload);
            if (line != null) {
              useAppStore.getState().requestGotoLine(line);
            }
          }
        } catch (error) {
          state.showToast(errorMessage(error), "error");
        }
        return;
      }
      state.setLoading(true);
      try {
        const payload = await readDocument(path);
        useAppStore.getState().setLoadedDocument(payload);
        if (line != null) {
          useAppStore.getState().requestGotoLine(line);
          useAppStore.getState().setViewMode("source");
        }
      } catch (error) {
        state.showToast(errorMessage(error), "error");
      } finally {
        useAppStore.getState().setLoading(false);
      }
    },
    [confirmDiscard],
  );

  const handleOpenFolder = useCallback(async () => {
    if (!isTauri()) {
      useAppStore
        .getState()
        .showToast("Folder workspaces are available in the desktop app.", "info");
      return;
    }
    try {
      const path = await openFolder();
      if (!path) {
        return;
      }
      const entries = await listDirectory(path);
      useAppStore.getState().setWorkspace(path, entries);
    } catch (error) {
      useAppStore.getState().showToast(errorMessage(error), "error");
    }
  }, []);

  const handleRefreshWorkspace = useCallback(async () => {
    const state = useAppStore.getState();
    const current = state.workspace;
    if (!current) {
      return;
    }
    state.setWorkspaceLoading(true);
    try {
      const entries = await listDirectory(current.path);
      useAppStore.getState().setWorkspace(current.path, entries);
    } catch (error) {
      useAppStore.getState().setWorkspaceLoading(false);
      useAppStore.getState().showToast(errorMessage(error), "error");
    }
  }, []);

  const handleCloseWorkspace = useCallback(() => {
    useAppStore.getState().clearWorkspace();
  }, []);

  const saveCurrent = useCallback(
    async (saveAs: boolean, silent = false) => {
      const state = useAppStore.getState();
      const current = state.doc;
      const originalPath = current.path;
      const content = current.content;
      savingRef.current = true;
      try {
        const meta = await saveDocument(
          {
            path: current.path,
            name: current.name,
            content,
            encoding: current.encoding,
            lineEnding: current.lineEnding,
            hasBom: current.hasBom,
          },
          saveAs,
        );
        if (meta) {
          const latest = useAppStore.getState();
          const pathChanged =
            originalPath != null &&
            latest.doc.path != null &&
            !samePath(originalPath, latest.doc.path);
          if (!pathChanged) {
            latest.markSaved(meta, content);
            if (!silent) {
              latest.showToast(`Saved ${fileName(meta.path)}`, "success");
            }
          }
        }
      } catch (error) {
        useAppStore.getState().showToast(errorMessage(error), "error");
      } finally {
        savingRef.current = false;
      }
    },
    [],
  );

  const handleSave = useCallback(() => {
    void saveCurrent(false);
  }, [saveCurrent]);

  const handleSaveAs = useCallback(() => {
    void saveCurrent(true);
  }, [saveCurrent]);

  const handleExportHtml = useCallback(async () => {
    const state = useAppStore.getState();
    if (!state.doc.content.trim()) {
      state.showToast("There is nothing to export yet.", "info");
      return;
    }
    try {
      const { buildStandaloneHtml, htmlExportPath } = await import(
        "./lib/exportHtml"
      );
      const title = state.doc.name.replace(/\.[^.\\/]+$/, "") || "Untitled";
      const meta = await saveHtmlFile(
        htmlExportPath(state.doc.path, state.doc.name),
        buildStandaloneHtml({ title, content: state.doc.content }),
      );
      if (meta) {
        useAppStore
          .getState()
          .showToast(`Exported ${fileName(meta.path)}`, "success");
      }
    } catch (error) {
      useAppStore.getState().showToast(errorMessage(error), "error");
    }
  }, []);

  const handleToggleView = useCallback(() => {
    useAppStore.getState().toggleViewMode();
  }, []);

  const handleFormat = useCallback((command: EditorCommand) => {
    const state = useAppStore.getState();
    if (state.viewMode !== "source") {
      state.setViewMode("source");
    }
    window.requestAnimationFrame(() => dispatchEditorCommand(command));
  }, []);

  const handlePrint = useCallback(() => {
    const state = useAppStore.getState();
    if (!state.doc.content.trim()) {
      state.showToast("There is nothing to print yet.", "info");
      return;
    }
    if (state.viewMode !== "preview") {
      state.setViewMode("preview");
    }
    const started = Date.now();
    const printWhenReady = () => {
      if (
        document.querySelector(".markdown-body") ||
        Date.now() - started > 2500
      ) {
        window.print();
      } else {
        window.setTimeout(printWhenReady, 60);
      }
    };
    window.setTimeout(printWhenReady, 40);
  }, []);

  async function recoverDraft() {
    const pending = draftToRecover;
    if (!pending) {
      return;
    }
    setDraftToRecover(null);
    clearDraft();

    if (pending.path) {
      try {
        const payload = await readDocument(pending.path);
        const state = useAppStore.getState();
        state.setLoadedDocument(payload);
        state.setContent(pending.content);
        state.setViewMode("source");
        state.showToast("Draft recovered. Review it, then save.", "success");
        return;
      } catch {
        // The file may have moved; keep the recovered text as a local document.
      }
    }

    useAppStore.getState().restoreDraft(pending);
    useAppStore
      .getState()
      .showToast("Recovered unsaved draft. Save it to a file.", "success");
  }

  function discardDraft() {
    clearDraft();
    setDraftToRecover(null);
  }

  useEffect(() => {
    if (draftToRecover) {
      return;
    }
    if (!doc.dirty) {
      clearDraft();
      return;
    }
    const timer = window.setTimeout(() => {
      const latest = useAppStore.getState().doc;
      if (!latest.dirty) {
        clearDraft();
        return;
      }
      saveDraft({
        path: latest.path,
        name: latest.name,
        content: latest.content,
        savedContent: latest.savedContent,
        encoding: latest.encoding,
        lineEnding: latest.lineEnding,
        hasBom: latest.hasBom,
        modifiedMs: latest.modifiedMs,
        updatedAt: Date.now(),
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    doc.content,
    doc.dirty,
    doc.encoding,
    doc.hasBom,
    doc.lineEnding,
    doc.modifiedMs,
    doc.name,
    doc.path,
    doc.savedContent,
    draftToRecover,
  ]);

  useEffect(() => {
    if (
      !settings.autoSave ||
      !doc.path ||
      !doc.dirty ||
      draftToRecover
    ) {
      return;
    }
    const path = doc.path;
    const timer = window.setTimeout(() => {
      const latest = useAppStore.getState();
      if (
        latest.settings.autoSave &&
        latest.doc.dirty &&
        samePath(latest.doc.path, path)
      ) {
        void saveCurrent(false, true);
      }
    }, settings.autoSaveDelayMs);
    return () => window.clearTimeout(timer);
  }, [
    doc.content,
    doc.dirty,
    doc.path,
    draftToRecover,
    saveCurrent,
    settings.autoSave,
    settings.autoSaveDelayMs,
  ]);

  useEffect(() => {
    if (!isTauri() || !doc.path) {
      return;
    }
    let cancelled = false;
    let checking = false;
    const path = doc.path;

    const check = async () => {
      if (cancelled || checking || savingRef.current) {
        return;
      }
      const current = useAppStore.getState().doc;
      if (!samePath(current.path, path)) {
        return;
      }
      checking = true;
      try {
        const modified = await getFileModifiedMs(path);
        if (cancelled || modified == null) {
          return;
        }
        if (current.modifiedMs != null && modified === current.modifiedMs) {
          return;
        }

        if (current.dirty) {
          useAppStore.getState().setModifiedMs(modified);
          useAppStore
            .getState()
            .showToast(
              "This file changed on disk. Your unsaved edits are still here.",
              "info",
            );
          return;
        }

        const { ask } = await import("@tauri-apps/plugin-dialog");
        const reload = await ask("This file changed on disk. Reload it?", {
          title: "File changed",
          kind: "info",
          okLabel: "Reload",
          cancelLabel: "Keep current",
        });
        if (cancelled) {
          return;
        }
        if (!reload) {
          useAppStore.getState().setModifiedMs(modified);
          return;
        }
        const payload = await readDocument(path);
        const latest = useAppStore.getState();
        if (samePath(latest.doc.path, path) && !latest.doc.dirty) {
          latest.setLoadedDocument(payload);
          latest.showToast("Reloaded changes from disk.", "info");
        }
      } catch {
        // A missing or locked file should not interrupt editing.
      } finally {
        checking = false;
      }
    };

    const interval = window.setInterval(() => void check(), 2_500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [doc.path]);

  useEffect(() => {
    const root = document.documentElement;
    const size = Math.min(22, Math.max(14, settings.editorFontSize));
    const width = Math.min(1_100, Math.max(680, settings.contentWidth));
    root.style.setProperty("--editor-font-size", `${size}px`);
    root.style.setProperty("--content-width", `${width}px`);
  }, [settings.contentWidth, settings.editorFontSize]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", theme === "light" ? "#fbfbfa" : "#1d2024");
  }, [theme]);

  useEffect(() => {
    document.title = `${doc.dirty ? "• " : ""}${doc.name} — MarkSI`;
  }, [doc.name, doc.dirty]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (useAppStore.getState().doc.dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }
    let unlisten: (() => void) | undefined;
    let allowClose = false;
    void (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.onCloseRequested(async (event) => {
          if (allowClose || !useAppStore.getState().doc.dirty) {
            return;
          }
          event.preventDefault();
          try {
            const { ask } = await import("@tauri-apps/plugin-dialog");
            const discard = await ask(
              "You have unsaved changes. Close MarkSI without saving?",
              {
                title: "Unsaved changes",
                kind: "warning",
                okLabel: "Close without saving",
                cancelLabel: "Keep editing",
              },
            );
            if (discard) {
              allowClose = true;
              await appWindow.destroy();
            }
          } catch {
            // Keep the window open if the confirmation cannot be displayed.
          }
        });
      } catch {
        // Window close interception is a desktop enhancement, not a hard requirement.
      }
    })();
    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) {
        return;
      }
      const key = event.key.toLowerCase();

      if (key === "p" && !event.shiftKey) {
        event.preventDefault();
        const state = useAppStore.getState();
        state.setSettingsOpen(false);
        state.setQuickOpen(true);
        return;
      }

      if (key === "," || event.code === "Comma") {
        event.preventDefault();
        const state = useAppStore.getState();
        state.setQuickOpen(false);
        state.setSettingsOpen(true);
        return;
      }

      if (key === "f" && event.shiftKey) {
        event.preventDefault();
        const state = useAppStore.getState();
        state.setQuickOpen(false);
        state.setSidebarTab("search");
        if (state.workspace) {
          state.setSearchScope("workspace");
        } else {
          state.setSearchScope("document");
          state.showToast("Open a folder to search across files.", "info");
        }
        window.setTimeout(() => {
          document.querySelector<HTMLInputElement>(".search-box input")?.focus();
        }, 0);
        return;
      }

      if (event.code === "Slash" && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) {
          useAppStore.getState().toggleViewMode();
        }
        return;
      }

      if (key === "s") {
        event.preventDefault();
        void saveCurrent(event.shiftKey);
      } else if (key === "o") {
        event.preventDefault();
        if (event.shiftKey) {
          void handleOpenFolder();
        } else {
          void handleOpen();
        }
      } else if (key === "n") {
        event.preventDefault();
        void handleNew();
      } else if (key === "b" && event.shiftKey) {
        event.preventDefault();
        useAppStore.getState().toggleSidebar();
      } else if (key === "f" && !event.shiftKey) {
        if (useAppStore.getState().viewMode !== "source") {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        dispatchEditorSearch(false);
      } else if (key === "h" && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        const state = useAppStore.getState();
        if (state.viewMode !== "source") {
          state.setViewMode("source");
        }
        window.requestAnimationFrame(() => dispatchEditorSearch(true));
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [handleNew, handleOpen, handleOpenFolder, saveCurrent]);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
        unlisten = await getCurrentWebview().onDragDropEvent(async (event) => {
          if (event.payload.type !== "drop") {
            return;
          }
          const path = event.payload.paths[0];
          if (!path) {
            return;
          }
          try {
            const entries = await listDirectory(path);
            useAppStore.getState().setWorkspace(path, entries);
            return;
          } catch {
            // Dropped path is probably a file; try to read it below.
          }
          if (!/\.(md|markdown|mdown|mkd|mdwn|mmd|txt)$/i.test(path)) {
            useAppStore
              .getState()
              .showToast("Drop a Markdown or text file, or a folder.", "info");
            return;
          }
          void handleOpenPath(path);
        });
      } catch {
        // Drag and drop is a convenience; the rest of the editor still works.
      }
    })();
    return () => {
      unlisten?.();
    };
  }, [handleOpenPath]);

  const isEmpty = !doc.path && doc.content.trim().length === 0;

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }
    (window as unknown as Record<string, unknown>).__MARKSI_DEV__ = {
      openPath: handleOpenPath,
      open: handleOpen,
      openFolder: handleOpenFolder,
      closeWorkspace: handleCloseWorkspace,
      newDocument: handleNew,
      save: handleSave,
      saveAs: handleSaveAs,
      setContent: (content: string) => useAppStore.getState().setContent(content),
      getState: () => useAppStore.getState(),
      gotoLine: (line: number) => useAppStore.getState().requestGotoLine(line),
      toggleView: handleToggleView,
      setViewMode: (mode: "source" | "preview") =>
        useAppStore.getState().setViewMode(mode),
      format: handleFormat,
      exportHtml: handleExportHtml,
      print: handlePrint,
      openQuickOpen: () => useAppStore.getState().setQuickOpen(true),
      openSettings: () => useAppStore.getState().setSettingsOpen(true),
      setSettings: (patch: Partial<AppSettings>) =>
        useAppStore.getState().updateSettings(patch),
    };
  }, [
    handleNew,
    handleOpen,
    handleOpenFolder,
    handleOpenPath,
    handleSave,
    handleSaveAs,
    handleCloseWorkspace,
    handleToggleView,
    handleFormat,
    handleExportHtml,
    handlePrint,
  ]);

  return (
    <div className={`app-shell ${sidebarOpen ? "has-sidebar" : ""}`}>
      <TitleBar />
      <div className="workspace-shell">
        {sidebarOpen ? (
          <Sidebar
            onOpenFile={(path) => void handleOpenPath(path)}
            onOpenFileAtLine={(path, line) => void handleOpenPath(path, line)}
            onOpenFolder={() => void handleOpenFolder()}
            onNewFile={handleNew}
            onRefreshWorkspace={() => void handleRefreshWorkspace()}
          />
        ) : null}

        <main className={`document-area ${viewMode === "preview" ? "is-preview" : ""}`}>
          <EditorPane
            content={doc.content}
            documentKey={doc.path ?? "untitled"}
            gotoLine={gotoLine}
            active={viewMode === "source"}
            readOnly={viewMode === "preview"}
            spellcheck={settings.spellcheck}
          />
          {viewMode === "preview" ? (
            <Suspense
              fallback={
                <div className="preview-surface preview-loading" role="status">
                  Rendering preview…
                </div>
              }
            >
              <PreviewPane content={doc.content} gotoLine={gotoLine} />
            </Suspense>
          ) : null}
          {isEmpty ? (
            <Welcome
              recent={recent}
              onNew={handleNew}
              onOpen={() => void handleOpen()}
              onOpenFolder={() => void handleOpenFolder()}
              onOpenRecent={(path) => void handleOpenPath(path)}
            />
          ) : null}
          {doc.loading ? (
            <div className="loading-veil" aria-live="polite">
              <span>Opening document…</span>
            </div>
          ) : null}
        </main>
      </div>

      <StatusBar />
      <MenuOverlay
        onNew={handleNew}
        onOpen={() => void handleOpen()}
        onOpenFolder={() => void handleOpenFolder()}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onExportHtml={handleExportHtml}
        onPrint={handlePrint}
        onToggleView={handleToggleView}
        onFormat={handleFormat}
        onCloseWorkspace={handleCloseWorkspace}
        onQuickOpen={() => useAppStore.getState().setQuickOpen(true)}
        onSearchWorkspace={() => {
          const state = useAppStore.getState();
          state.setSidebarTab("search");
          if (state.workspace) {
            state.setSearchScope("workspace");
          } else {
            state.setSearchScope("document");
            state.showToast("Open a folder to search across files.", "info");
          }
        }}
        onOpenSettings={() => useAppStore.getState().setSettingsOpen(true)}
      />
      <QuickOpen onOpen={(path) => void handleOpenPath(path)} />
      <SettingsDialog />
      {draftToRecover ? (
        <DraftRecovery
          draft={draftToRecover}
          onRecover={() => void recoverDraft()}
          onDiscard={discardDraft}
        />
      ) : null}
      <Toast />
    </div>
  );
}
