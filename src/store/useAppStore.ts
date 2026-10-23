import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_EXPORT_OPTIONS,
  normalizeExportOptions,
} from "../lib/exportOptions";
import type {
  AppSettings,
  CursorPosition,
  DocumentDraft,
  DocumentPayload,
  FileEntry,
  FileMeta,
  LineEnding,
  RecentFile,
  SearchScope,
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
  modifiedMs: number | null;
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
  settings: AppSettings;
  settingsOpen: boolean;
  quickOpen: boolean;
  searchScope: SearchScope;

  newDocument: () => void;
  setImportedDocument: (name: string, content: string) => void;
  setLoadedDocument: (payload: DocumentPayload) => void;
  setContent: (content: string) => void;
  markSaved: (meta: FileMeta, savedContent?: string) => void;
  restoreDraft: (draft: DocumentDraft) => void;
  setModifiedMs: (modifiedMs: number | null) => void;
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
  setSettingsOpen: (open: boolean) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  resetSettings: () => void;
  setQuickOpen: (open: boolean) => void;
  setSearchScope: (scope: SearchScope) => void;
  showToast: (message: string, tone?: ToastTone) => void;
  dismissToast: () => void;

  addRecent: (path: string) => void;
  removeRecent: (path: string) => void;
  clearRecent: () => void;
  setWorkspace: (path: string, entries: FileEntry[]) => void;
  setWorkspaceLoading: (loading: boolean) => void;
  clearWorkspace: () => void;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: "zh-CN",
  editorFontSize: 16,
  contentWidth: 860,
  zoomLevel: 1,
  spellcheck: true,
  autoSave: false,
  autoSaveDelayMs: 1_500,
  imageAssetFolder: "assets",
  focusMode: false,
  typewriterMode: false,
  readOnlyMode: false,
  autoPair: true,
  smartPunctuation: false,
  emojiAutocomplete: true,
  strictMode: true,
  exportOptions: { ...DEFAULT_EXPORT_OPTIONS },
  customExportProgram: "",
  customExportArgs: "",
  pandocPath: "",
  loadRemoteImages: false,
  imageRootPath: "",
  imageRootUrl: "",
};

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
  modifiedMs: null,
};

function pathKey(path: string): string {
  return path.replace(/^\\\\\?\\/, "").replace(/\//g, "\\").toLowerCase();
}

function persistedString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
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
      viewMode: "preview",
      menuOpen: false,
      cursor: { line: 1, column: 1 },
      toast: null,
      gotoLine: null,
      settings: { ...DEFAULT_SETTINGS },
      settingsOpen: false,
      quickOpen: false,
      searchScope: "document",

      newDocument: () =>
        set((state) => ({
          doc: {
            ...emptyDocument,
            name:
              state.settings.language === "zh-CN"
                ? "未命名.md"
                : "Untitled.md",
          },
          cursor: { line: 1, column: 1 },
          viewMode: "preview",
          menuOpen: false,
        })),

      setImportedDocument: (name, content) =>
        set({
          doc: {
            ...emptyDocument,
            name,
            content,
            dirty: true,
          },
          cursor: { line: 1, column: 1 },
          viewMode: "preview",
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
              modifiedMs: payload.modifiedMs,
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

      markSaved: (meta, savedContent) =>
        set((state) => {
          const persistedContent = savedContent ?? state.doc.content;
          return {
            doc: {
              ...state.doc,
              path: meta.path,
              name: fileName(meta.path),
              savedContent: persistedContent,
              dirty: state.doc.content !== persistedContent,
              loading: false,
              modifiedMs: meta.modifiedMs,
            },
            recent: [
              recentEntry(meta.path),
              ...state.recent.filter(
                (entry) => pathKey(entry.path) !== pathKey(meta.path),
              ),
            ].slice(0, 12),
          };
        }),

      restoreDraft: (draft) =>
        set({
          doc: {
            path: draft.path,
            name: draft.name,
            content: draft.content,
            savedContent: draft.savedContent,
            encoding: draft.encoding,
            lineEnding: draft.lineEnding,
            hasBom: draft.hasBom,
            hadErrors: false,
            dirty: draft.content !== draft.savedContent,
            loading: false,
            modifiedMs: draft.modifiedMs,
          },
          cursor: { line: 1, column: 1 },
          viewMode: "preview",
          menuOpen: false,
        }),

      setModifiedMs: (modifiedMs) =>
        set((state) => ({ doc: { ...state.doc, modifiedMs } })),

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

      setSettingsOpen: (settingsOpen) => set({ settingsOpen, menuOpen: false }),
      updateSettings: (patch) =>
        set((state) => ({
          settings: { ...state.settings, ...patch },
        })),
      resetSettings: () => set({ settings: { ...DEFAULT_SETTINGS } }),
      setQuickOpen: (quickOpen) => set({ quickOpen, menuOpen: false }),
      setSearchScope: (searchScope) => set({ searchScope }),

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

      removeRecent: (path) =>
        set((state) => ({
          recent: state.recent.filter(
            (entry) => pathKey(entry.path) !== pathKey(path),
          ),
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
        settings: state.settings,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<
          Pick<AppStore, "recent" | "theme" | "sidebarOpen" | "settings">
        >;
        return {
          ...current,
          ...saved,
          settings: {
            ...DEFAULT_SETTINGS,
            ...(saved.settings ?? {}),
            exportOptions: normalizeExportOptions(
              saved.settings?.exportOptions,
            ),
            customExportProgram: persistedString(
              saved.settings?.customExportProgram,
              1024,
            ),
            customExportArgs: persistedString(
              saved.settings?.customExportArgs,
              32_768,
            ),
            pandocPath: persistedString(
              saved.settings?.pandocPath,
              4096,
            ),
            loadRemoteImages:
              typeof saved.settings?.loadRemoteImages === "boolean"
                ? saved.settings.loadRemoteImages
                : false,
            imageRootPath: persistedString(
              saved.settings?.imageRootPath,
              4096,
            ),
            imageRootUrl: persistedString(
              saved.settings?.imageRootUrl,
              4096,
            ),
          },
        };
      },
    },
  ),
);
