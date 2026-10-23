import { useCallback, useEffect } from "react";
import { EditorPane } from "./components/EditorPane";
import { MenuOverlay } from "./components/MenuOverlay";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { TitleBar } from "./components/TitleBar";
import { Toast } from "./components/Toast";
import { Welcome } from "./components/Welcome";
import {
  fileName,
  isTauri,
  listDirectory,
  openDocument,
  openFolder,
  readDocument,
  saveDocument,
} from "./lib/platform";
import { useAppStore } from "./store/useAppStore";

function errorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export default function App() {
  const doc = useAppStore((state) => state.doc);
  const recent = useAppStore((state) => state.recent);
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const theme = useAppStore((state) => state.theme);
  const gotoLine = useAppStore((state) => state.gotoLine);

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
    async (path: string) => {
      if (!(await confirmDiscard())) {
        return;
      }
      const state = useAppStore.getState();
      if (!isTauri() && !/[\\/]/.test(path)) {
        try {
          const payload = await openDocument();
          if (payload) {
            useAppStore.getState().setLoadedDocument(payload);
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

  const saveCurrent = useCallback(async (saveAs: boolean) => {
    const state = useAppStore.getState();
    const current = state.doc;
    try {
      const meta = await saveDocument(
        {
          path: current.path,
          name: current.name,
          content: current.content,
          encoding: current.encoding,
          lineEnding: current.lineEnding,
          hasBom: current.hasBom,
        },
        saveAs,
      );
      if (meta) {
        useAppStore.getState().markSaved(meta);
        useAppStore
          .getState()
          .showToast(`Saved ${fileName(meta.path)}`, "success");
      }
    } catch (error) {
      useAppStore.getState().showToast(errorMessage(error), "error");
    }
  }, []);

  const handleSave = useCallback(() => {
    void saveCurrent(false);
  }, [saveCurrent]);

  const handleSaveAs = useCallback(() => {
    void saveCurrent(true);
  }, [saveCurrent]);

  const handleExportHtml = useCallback(() => {
    useAppStore
      .getState()
      .showToast("HTML export arrives with the rendering pipeline in M2.", "info");
  }, []);

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
        const editor = document.querySelector<HTMLElement>(".cm-content");
        if (!editor || !editor.contains(document.activeElement)) {
          event.preventDefault();
          editor?.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
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
    };
  }, [handleNew, handleOpen, handleOpenFolder, handleOpenPath, handleSave, handleSaveAs, handleCloseWorkspace]);

  return (
    <div className={`app-shell ${sidebarOpen ? "has-sidebar" : ""}`}>
      <TitleBar />
      <div className="workspace-shell">
        {sidebarOpen ? (
          <Sidebar
            onOpenFile={(path) => void handleOpenPath(path)}
            onOpenFolder={() => void handleOpenFolder()}
            onNewFile={handleNew}
            onRefreshWorkspace={() => void handleRefreshWorkspace()}
          />
        ) : null}

        <main className="document-area">
          <EditorPane
            content={doc.content}
            documentKey={doc.path ?? "untitled"}
            gotoLine={gotoLine}
          />
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
        onCloseWorkspace={handleCloseWorkspace}
      />
      <Toast />
    </div>
  );
}
