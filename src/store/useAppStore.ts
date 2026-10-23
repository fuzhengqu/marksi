import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  CursorPosition,
  DocumentPayload,
  FileEntry,
  FileMeta,
  LineEnding,
  RecentFile,
  SidebarTab,
  Theme,
  ToastMessage,
  ToastTone,
  ViewMode,
} from "../types";
import { fileName } from "../lib/platform";

interface DocumentState {
  path: string | null;
  name: string;
  content: string;
  savedContent: string;
  encoding: string;
  lineEnding: LineEnding;
  hasBom: boolean;
  hadErrors: boolean;
  dirty: boolean;
  loading: boolean;
}

interface WorkspaceState {
  path: string;
  entries: FileEntry[];
  loading: boolean;
}

interface AppStore {
  doc: DocumentState;
  recent: RecentFile[];
  workspace: WorkspaceState | null;
  sidebarTab: SidebarTab;
  sidebarOpen: boolean;
  theme: Theme;
  viewMode: ViewMode;
  menuOpen: boolean;
  cursor: CursorPosition;
  toast: ToastMessage | null;
  gotoLine: number | null;

  newDocument: () => void;
  setLoadedDocument: (payload: DocumentPayload) => void;
  setContent: (content: string) => void;
  markSaved: (meta: FileMeta) => void;
  setLoading: (loading: boolean) => void;

  setSidebarTab: (tab: SidebarTab) => void;
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
  setMenuOpen: (open: boolean) => void;
  setCursor: (cursor: CursorPosition) => void;
  requestGotoLine: (line: number) => void;
  clearGotoLine: () => void;
  showToast: (message: string, tone?: ToastTone) => void;
  dismissToast: () => void;

  addRecent: (path: string) => void;
  clearRecent: () => void;
  setWorkspace: (path: string, entries: FileEntry[]) => void;
  setWorkspaceLoading: (loading: boolean) => void;
  clearWorkspace: () => void;
}

const emptyDocument: DocumentState = {
  path: null,
  name: "Untitled.md",
  content: "",
  savedContent: "",
  encoding: "UTF-8",
  lineEnding: "LF",
  hasBom: false,
  hadErrors: false,
  dirty: false,
  loading: false,
};

function pathKey(path: string): string {
  return path.replace(/^\\\\\?\\/, "").replace(/\//g, "\\").toLowerCase();
}

function recentEntry(path: string): RecentFile {
  return {
    path,
    name: fileName(path),
    lastOpened: Date.now(),
  };
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      doc: { ...emptyDocument },
      recent: [],
      workspace: null,
      sidebarTab: "files",
      sidebarOpen: true,
      theme: "light",
      viewMode: "source",
      menuOpen: false,
      cursor: { line: 1, column: 1 },
      toast: null,
      gotoLine: null,

      newDocument: () =>
        set({
          doc: { ...emptyDocument },
          cursor: { line: 1, column: 1 },
          viewMode: "source",
          menuOpen: false,
        }),

      setLoadedDocument: (payload) => {
        const name = fileName(payload.path);
        set((state) => {
          const nextRecent = [
            recentEntry(payload.path),
            ...state.recent.filter((entry) => pathKey(entry.path) !== pathKey(payload.path)),
          ].slice(0, 12);

          return {
            doc: {
              path: payload.path,
              name,
              content: payload.content,
              savedContent: payload.content,
              encoding: payload.encoding,
              lineEnding: payload.lineEnding,
              hasBom: payload.hasBom,
              hadErrors: payload.hadErrors,
              dirty: false,
              loading: false,
            },
            recent: nextRecent,
            cursor: { line: 1, column: 1 },
            menuOpen: false,
          };
        });

        if (payload.hadErrors) {
          get().showToast(
            "This file contains characters that could not be decoded cleanly.",
            "error",
          );
        }
      },

      setContent: (content) =>
        set((state) => ({
          doc: {
            ...state.doc,
            content,
            dirty: content !== state.doc.savedContent,
          },
        })),

      markSaved: (meta) =>
        set((state) => ({
          doc: {
            ...state.doc,
            path: meta.path,
            name: fileName(meta.path),
            savedContent: state.doc.content,
            dirty: false,
            loading: false,
          },
          recent: [
            recentEntry(meta.path),
            ...state.recent.filter((entry) => pathKey(entry.path) !== pathKey(meta.path)),
          ].slice(0, 12),
        })),

      setLoading: (loading) =>
        set((state) => ({ doc: { ...state.doc, loading } })),

      setSidebarTab: (sidebarTab) => set({ sidebarTab, sidebarOpen: true }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
      setViewMode: (viewMode) => set({ viewMode }),
      toggleViewMode: () =>
        set((state) => ({
          viewMode: state.viewMode === "source" ? "preview" : "source",
        })),
      setMenuOpen: (menuOpen) => set({ menuOpen }),
      setCursor: (cursor) => set({ cursor }),
      requestGotoLine: (line) => set({ gotoLine: line }),
      clearGotoLine: () => set({ gotoLine: null }),

      showToast: (message, tone = "info") =>
        set({ toast: { id: Date.now(), message, tone } }),
      dismissToast: () => set({ toast: null }),

      addRecent: (path) =>
        set((state) => ({
          recent: [
            recentEntry(path),
            ...state.recent.filter((entry) => pathKey(entry.path) !== pathKey(path)),
          ].slice(0, 12),
        })),

      clearRecent: () => set({ recent: [] }),

      setWorkspace: (path, entries) =>
        set({
          workspace: { path, entries, loading: false },
          sidebarTab: "files",
          sidebarOpen: true,
        }),

      setWorkspaceLoading: (loading) =>
        set((state) =>
          state.workspace
            ? { workspace: { ...state.workspace, loading } }
            : { workspace: { path: "", entries: [], loading } },
        ),

      clearWorkspace: () => set({ workspace: null }),
    }),
    {
      name: "marksi-preferences",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        recent: state.recent,
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
      }),
    },
  ),
);
