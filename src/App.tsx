import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { DraftRecovery } from "./components/DraftRecovery";
import { EditorPane } from "./components/EditorPane";
import { EncodingDialog } from "./components/EncodingDialog";
import { ExportDialog } from "./components/ExportDialog";
import { HistoryDialog } from "./components/HistoryDialog";
import { MenuOverlay } from "./components/MenuOverlay";
import { PandocDialog } from "./components/PandocDialog";
import { QuickOpen } from "./components/QuickOpen";
import { SettingsDialog } from "./components/SettingsDialog";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { TitleBar } from "./components/TitleBar";
import { Toast } from "./components/Toast";

import {
  dispatchEditorCommand,
  dispatchEditorImageResize,
  dispatchEditorInsert,
  dispatchEditorSearch,
  EDITOR_PASTE_IMAGE_EVENT,
} from "./editor/bridge";
import type { EditorCommand } from "./editor/format";
import {
  expandCommandArguments,
  parentDirectory,
  parseCommandArguments,
} from "./lib/customExport";
import { clearDraft, loadDraft, saveDraft } from "./lib/drafts";
import { encodingDisplayName } from "./lib/encodings";
import { buildPageCss, normalizeExportOptions } from "./lib/exportOptions";
import {
  resolveTheme,
  themeColor,
  useSystemDark,
} from "./lib/theme";
import { isLargeDocument } from "./lib/largeFile";
import { isImeKeyEvent } from "./lib/ime";
import { shortcutForEvent } from "./lib/shortcuts";
import { frontMatterTitle } from "./lib/frontMatter";
import { pandocImportName } from "./lib/pandoc";
import { resolveSaveName } from "./lib/saveName";
import {
  clearSession,
  loadSession,
  navigationType,
  saveSession,
  shouldRestoreSession,
  type SessionSnapshot,
} from "./lib/session";
import { tNow, useT } from "./i18n";
import { clampZoom, stepZoom } from "./lib/zoom";
import {
  altTextFromFileName,
  buildImageMarkdown,
  fileToBase64,
  isImagePath,
  pastedImageName,
} from "./lib/images";
import {
  findCustomTheme,
  sanitizeCustomCss,
} from "./lib/customThemes";
import {
  applyWindowFrame,
  clearHistory,
  customThemesFolder,
  fileName,
  getFileModifiedMs,
  importImageAsset,
  isAlwaysOnTop,
  isFullscreen,
  isTauri,
  isWindowMinimized,
  listCustomThemes,
  listDirectory,
  openDocument,
  openFolder,
  pandocImport,
  pandocVersion,
  pickImageFile,
  pickPandocImportFile,
  readDocument,
  readDocumentWithEncoding,
  readWindowFrame,
  recordHistory,
  relocateHistory,
  runExportCommand,
  saveDocument,
  saveHtmlFile,
  saveImageData,
  savePngFile,
  setAlwaysOnTop,
  setFullscreen,
  takeStartupFile,
  windowWorkAreas,
} from "./lib/platform";
import {
  clearWindowFrame,
  fitWindowFrame,
  loadWindowFrame,
  saveWindowFrame,
  type WindowFrame,
} from "./lib/windowFrame";
import { useAppStore } from "./store/useAppStore";
import type {
  AppSettings,
  CopyFormat,
  DocumentDraft,
  ExportOptions,
  FileMeta,
  ImageAsset,
} from "./types";

const PreviewPane = lazy(() =>
  import("./components/PreviewPane").then((module) => ({
    default: module.PreviewPane,
  })),
);

async function captureHistory(
  path: string,
  previous: string,
  content: string,
  encoding: string,
  lineEnding: string,
): Promise<void> {
  const name = fileName(path);
  if (previous && previous !== content) {
    await recordHistory(path, name, previous, encoding, lineEnding);
  }
  await recordHistory(path, name, content, encoding, lineEnding);
}

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
  const t = useT();
  const doc = useAppStore((state) => state.doc);
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const theme = useAppStore((state) => state.theme);
  const systemDark = useSystemDark();
  const resolvedTheme = resolveTheme(theme, systemDark);
  const viewMode = useAppStore((state) => state.viewMode);
  const gotoLine = useAppStore((state) => state.gotoLine);
  const settings = useAppStore((state) => state.settings);
  const largeFile =
    settings.largeFileOptimizations && isLargeDocument(doc.content);
  const workspacePath = useAppStore((state) => state.workspace?.path ?? null);
  const [draftToRecover, setDraftToRecover] =
    useState<DocumentDraft | null>(() => loadDraft());
  const [exportOpen, setExportOpen] = useState(false);
  const [pandocOpen, setPandocOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [encodingOpen, setEncodingOpen] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [themeRevision, setThemeRevision] = useState(0);
  const savingRef = useRef(false);
  const bootStartedRef = useRef(false);
  const windowFrameRef = useRef<WindowFrame | null>(null);
  const restoringWindowRef = useRef(false);

  useEffect(() => {
    document.documentElement.lang = settings.language;
    const state = useAppStore.getState();
    if (state.doc.path || state.doc.dirty || state.doc.content) {
      return;
    }
    const name =
      settings.language === "zh-CN" ? "未命名.md" : "Untitled.md";
    if (state.doc.name !== name) {
      useAppStore.setState({ doc: { ...state.doc, name } });
    }
  }, [settings.language]);

  useEffect(() => {
    const zoom = clampZoom(settings.zoomLevel);
    let cancelled = false;

    if (!isTauri()) {
      document.documentElement.style.setProperty("zoom", String(zoom));
      return;
    }

    void import("@tauri-apps/api/webview")
      .then(({ getCurrentWebview }) => {
        if (!cancelled) {
          return getCurrentWebview().setZoom(zoom);
        }
      })
      .catch(() => {
        if (!cancelled) {
          document.documentElement.style.setProperty("zoom", String(zoom));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [settings.zoomLevel]);

  const adjustZoom = useCallback((direction: 1 | -1 | 0) => {
    const state = useAppStore.getState();
    const next =
      direction === 0 ? 1 : stepZoom(state.settings.zoomLevel, direction);
    if (next !== state.settings.zoomLevel) {
      state.updateSettings({ zoomLevel: next });
    }
  }, []);

  const confirmDiscard = useCallback(async () => {
    const current = useAppStore.getState().doc;
    if (!current.dirty) {
      return true;
    }
    if (!isTauri()) {
      return window.confirm(tNow("You have unsaved changes. Discard them?"));
    }
    try {
      const { ask } = await import("@tauri-apps/plugin-dialog");
      return await ask(tNow("You have unsaved changes. Discard them?"), {
        title: tNow("Unsaved changes"),
        kind: "warning",
        okLabel: tNow("Discard changes"),
        cancelLabel: tNow("Keep editing"),
      });
    } catch {
      return window.confirm(tNow("You have unsaved changes. Discard them?"));
    }
  }, []);

  const ensureEditable = useCallback((): boolean => {
    const state = useAppStore.getState();
    if (!state.settings.readOnlyMode) {
      return true;
    }
    state.showToast(
      tNow("Read-only mode is on. Turn it off from the View menu to edit."),
      "info",
    );
    return false;
  }, []);

  const handleNew = useCallback(async () => {
    if (!(await confirmDiscard())) {
      return;
    }
    useAppStore.getState().newDocument();
    useAppStore.getState().showToast(tNow("New blank document created."), "success");
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(".cm-content")?.focus();
    });
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
          useAppStore.getState().setViewMode("preview");
        }
      } catch (error) {
        state.showToast(errorMessage(error), "error");
      } finally {
        useAppStore.getState().setLoading(false);
      }
    },
    [confirmDiscard],
  );

  const applySavedSession = useCallback(
    async (saved: SessionSnapshot): Promise<boolean> => {
      let restored = false;
      if (saved.workspacePath) {
        try {
          const entries = await listDirectory(saved.workspacePath);
          useAppStore.getState().setWorkspace(saved.workspacePath, entries);
          restored = true;
        } catch {
          // A missing folder must not block the document or the rest of startup.
        }
      }
      if (saved.documentPath) {
        try {
          const payload = await readDocument(saved.documentPath);
          const state = useAppStore.getState();
          state.setLoadedDocument(payload);
          state.setViewMode(saved.viewMode);
          restored = true;
        } catch {
          // A missing or unreadable document is skipped.
        }
      }
      return restored;
    },
    [],
  );

  useEffect(() => {
    if (!isTauri() || draftToRecover || bootStartedRef.current) {
      return;
    }
    bootStartedRef.current = true;
    void (async () => {
      let startupPath: string | null = null;
      try {
        startupPath = await takeStartupFile();
      } catch {
        // A broken command line must not block startup.
      }
      const state = useAppStore.getState();
      const hasOpenDocument = Boolean(
        state.doc.path || state.doc.content || state.doc.dirty,
      );
      if (startupPath && !hasOpenDocument) {
        await handleOpenPath(startupPath);
        setSessionReady(true);
        return;
      }
      const saved = loadSession();
      if (
        saved &&
        shouldRestoreSession({
          enabled: state.settings.restoreSession,
          navigationType: navigationType(),
          hasDraft: false,
          hasStartupFile: Boolean(startupPath),
          hasOpenDocument,
        })
      ) {
        await applySavedSession(saved);
      }
      setSessionReady(true);
    })().catch(() => {
      setSessionReady(true);
    });
  }, [applySavedSession, draftToRecover, handleOpenPath]);

  useEffect(() => {
    if (!isTauri() || !sessionReady) {
      return;
    }
    if (!settings.restoreSession) {
      clearSession();
      return;
    }
    const timer = window.setTimeout(() => {
      saveSession({
        documentPath: doc.path,
        workspacePath: workspacePath ?? null,
        viewMode,
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [doc.path, sessionReady, settings.restoreSession, viewMode, workspacePath]);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      const next = !(await isFullscreen());
      await setFullscreen(next);
      useAppStore.getState().setFullscreen(next);
    } catch (error) {
      useAppStore.getState().showToast(errorMessage(error), "error");
    }
  }, []);

  const handleToggleAlwaysOnTop = useCallback(async () => {
    if (!isTauri()) {
      useAppStore
        .getState()
        .showToast(
          tNow("Always on top is only available in the desktop app."),
          "info",
        );
      return;
    }
    try {
      const next = !(await isAlwaysOnTop());
      await setAlwaysOnTop(next);
      useAppStore.getState().setAlwaysOnTop(next);
    } catch (error) {
      useAppStore.getState().showToast(errorMessage(error), "error");
    }
  }, []);

  const handleReopenWithEncoding = useCallback(
    async (encoding: string): Promise<boolean> => {
      const state = useAppStore.getState();
      const path = state.doc.path;
      if (!path) {
        return false;
      }
      if (!(await confirmDiscard())) {
        return false;
      }
      state.setLoading(true);
      try {
        const payload =
          encoding === "auto"
            ? await readDocument(path)
            : await readDocumentWithEncoding(path, encoding);
        useAppStore.getState().setLoadedDocument(payload);
        useAppStore
          .getState()
          .showToast(
            tNow("Reopened with {encoding}.", {
              encoding: encodingDisplayName(payload.encoding),
            }),
            "success",
          );
        return true;
      } catch (error) {
        useAppStore.getState().showToast(errorMessage(error), "error");
        return false;
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
        .showToast(
          tNow("Folder workspaces are available in the desktop app."),
          "info",
        );
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

  const handleOpenFolderPath = useCallback(async (path: string) => {
    try {
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

  const handleFilesChanged = useCallback(
    (oldPath: string | null, newPath: string | null) => {
      const state = useAppStore.getState();
      if (oldPath) {
        state.applyFileOperation(oldPath, newPath);
        if (newPath) {
          void relocateHistory(oldPath, newPath).catch(() => {});
        } else {
          void clearHistory(oldPath).catch(() => {});
        }
      }
      if (state.workspace) {
        void handleRefreshWorkspace();
      }
    },
    [handleRefreshWorkspace],
  );

  const handleCloseWorkspace = useCallback(() => {
    useAppStore.getState().clearWorkspace();
  }, []);

  const saveCurrent = useCallback(
    async (saveAs: boolean, silent = false): Promise<FileMeta | null> => {
      const state = useAppStore.getState();
      const current = state.doc;
      const originalPath = current.path;
      const content = current.content;
      const name = resolveSaveName(content, current.name, current.path);
      let meta: FileMeta | null = null;
      savingRef.current = true;
      try {
        meta = await saveDocument(
          {
            path: current.path,
            name,
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
              latest.showToast(
                tNow("Saved {name}", { name: fileName(meta.path) }),
                "success",
              );
            }
          }
          if (latest.settings.localHistory) {
            void captureHistory(
              meta.path,
              current.savedContent,
              content,
              current.encoding,
              current.lineEnding,
            ).catch(() => {
              // History is best-effort and must never block a save.
            });
          }
        }
      } catch (error) {
        useAppStore.getState().showToast(errorMessage(error), "error");
      } finally {
        savingRef.current = false;
      }
      return meta;
    },
    [],
  );

  const handleSave = useCallback(() => {
    void saveCurrent(false);
  }, [saveCurrent]);

  const handleSaveAs = useCallback(() => {
    void saveCurrent(true);
  }, [saveCurrent]);

  const exportHtmlFile = useCallback(
    async (options?: ExportOptions): Promise<FileMeta | null> => {
      const state = useAppStore.getState();
      if (!state.doc.content.trim()) {
        state.showToast(tNow("There is nothing to export yet."), "info");
        return null;
      }
      const exportOptions = normalizeExportOptions(
        options ?? state.settings.exportOptions,
      );
      state.updateSettings({ exportOptions });
      try {
        const { buildStandaloneHtml, htmlExportPath } = await import(
          "./lib/exportHtml"
        );
        const title =
          state.doc.name.replace(/\.[^.\\/]+$/, "") || tNow("Untitled");
        const html = await buildStandaloneHtml({
          title,
          content: state.doc.content,
          language: state.settings.language,
          strictMode: state.settings.strictMode,
          exportOptions,
        });
        const meta = await saveHtmlFile(
          htmlExportPath(state.doc.path, state.doc.name),
          html,
        );
        if (!meta) {
          return null;
        }
        useAppStore
          .getState()
          .showToast(
            tNow("Exported {name}", { name: fileName(meta.path) }),
            "success",
          );
        return meta;
      } catch (error) {
        useAppStore.getState().showToast(errorMessage(error), "error");
        return null;
      }
    },
    [],
  );

  const handleExportHtml = useCallback(
    async (options?: ExportOptions): Promise<boolean> =>
      Boolean(await exportHtmlFile(options)),
    [exportHtmlFile],
  );

  const handleCustomExport = useCallback(
    async (options?: ExportOptions): Promise<boolean> => {
      const state = useAppStore.getState();
      const program = state.settings.customExportProgram.trim();
      if (!program) {
        state.showToast(
          tNow("Configure a custom export command in Preferences first."),
          "info",
        );
        return false;
      }
      const args = parseCommandArguments(state.settings.customExportArgs);
      const meta = await exportHtmlFile(options);
      if (!meta) {
        return false;
      }
      const title =
        frontMatterTitle(state.doc.content) ??
        (state.doc.name.replace(/\.[^.\\/]+$/, "") || tNow("Untitled"));
      const expanded = expandCommandArguments(args, {
        input: meta.path,
        document: state.doc.path ?? "",
        title,
      });
      try {
        const code = await runExportCommand(
          program,
          expanded,
          parentDirectory(meta.path),
        );
        if (code !== 0) {
          useAppStore
            .getState()
            .showToast(
              tNow("Custom export command exited with code {code}.", {
                code,
              }),
              "error",
            );
          return false;
        }
        useAppStore
          .getState()
          .showToast(tNow("Custom export completed."), "success");
        return true;
      } catch (error) {
        useAppStore.getState().showToast(errorMessage(error), "error");
        return false;
      }
    },
    [exportHtmlFile],
  );

  const handleExportImage = useCallback(async (): Promise<boolean> => {
    const state = useAppStore.getState();
    if (!state.doc.content.trim()) {
      state.showToast(tNow("There is nothing to export yet."), "info");
      return false;
    }
    try {
      if (state.viewMode !== "reading") {
        state.setViewMode("reading");
      }
      const { blobToBase64, captureReadingView, imageExportPath } =
        await import("./lib/exportImage");
      const capture = await captureReadingView();
      const data = await blobToBase64(capture.blob);
      const meta = await savePngFile(
        imageExportPath(state.doc.path, state.doc.name),
        data,
      );
      if (!meta) {
        return false;
      }
      useAppStore
        .getState()
        .showToast(
          tNow("Exported {name}", { name: fileName(meta.path) }),
          "success",
        );
      return true;
    } catch (error) {
      useAppStore
        .getState()
        .showToast(tNow(errorMessage(error)), "error");
      return false;
    }
  }, []);

  const handleOpenExport = useCallback(() => {
    setExportOpen(true);
  }, []);

  const handleOpenPandoc = useCallback(() => {
    setPandocOpen(true);
  }, []);

  const handlePandocImport = useCallback(async () => {
    if (!(await confirmDiscard())) {
      return;
    }
    const state = useAppStore.getState();
    try {
      await pandocVersion(state.settings.pandocPath);
      const inputPath = await pickPandocImportFile();
      if (!inputPath) {
        return;
      }
      state.setLoading(true);
      const result = await pandocImport(
        state.settings.pandocPath,
        inputPath,
      );
      useAppStore
        .getState()
        .setImportedDocument(
          pandocImportName(inputPath),
          result.content,
        );
      useAppStore
        .getState()
        .showToast(
          result.mediaCount > 0
            ? tNow("Imported {name} with {count} embedded images.", {
                name: fileName(inputPath),
                count: result.mediaCount,
              })
            : tNow("Imported {name}", {
                name: fileName(inputPath),
              }),
          "success",
        );
    } catch (error) {
      useAppStore.getState().showToast(errorMessage(error), "error");
    } finally {
      useAppStore.getState().setLoading(false);
    }
  }, [confirmDiscard]);

  const handleCopyDocument = useCallback(async (format: CopyFormat) => {
    const state = useAppStore.getState();
    const content = state.doc.content;
    if (!content.trim()) {
      state.showToast(tNow("There is nothing to copy yet."), "info");
      return;
    }

    try {
      if (format === "markdown") {
        const { copyText } = await import("./lib/clipboardText");
        await copyText(content);
        useAppStore
          .getState()
          .showToast(tNow("Copied document as Markdown."), "success");
        return;
      }

      const { buildClipboardDocument, copyRichHtml } = await import(
        "./lib/clipboard"
      );
      const documentToCopy = await buildClipboardDocument(content, {
        theme: resolvedTheme,
        diagrams: format === "html",
        strictMode: state.settings.strictMode,
      });

      if (format === "html") {
        const mode = await copyRichHtml(documentToCopy);
        useAppStore
          .getState()
          .showToast(
            mode === "rich"
              ? tNow("Copied document as rich HTML.")
              : tNow("Copied HTML source."),
            "success",
          );
        return;
      }

      const { copyText } = await import("./lib/clipboardText");
      await copyText(documentToCopy.text);
      useAppStore
        .getState()
        .showToast(tNow("Copied document as plain text."), "success");
    } catch (error) {
      useAppStore.getState().showToast(errorMessage(error), "error");
    }
  }, []);

  const handleToggleView = useCallback(() => {
    const state = useAppStore.getState();
    state.setViewMode(state.viewMode === "source" ? "preview" : "source");
  }, []);

  const handleResizeImage = useCallback(
    (
      imageIndex: number,
      width: number | null,
      height: number | null,
      alt: string,
    ) => {
      const state = useAppStore.getState();
      if (state.settings.readOnlyMode) {
        return;
      }
      dispatchEditorImageResize({ imageIndex, width, height, alt });
    },
    [],
  );

  const handleFitImage = useCallback(
    (
      imageIndex: number,
      fit: "contain" | "cover",
      width: number,
      height: number,
      alt: string,
    ) => {
      const state = useAppStore.getState();
      if (state.settings.readOnlyMode) {
        return;
      }
      dispatchEditorImageResize({
        imageIndex,
        fit,
        width,
        height,
        alt,
      });
    },
    [],
  );

  const handleResetImage = useCallback((imageIndex: number, alt: string) => {
    const state = useAppStore.getState();
    if (state.settings.readOnlyMode) {
      return;
    }
    dispatchEditorImageResize({ imageIndex, reset: true, alt });
  }, []);

  const handleFormat = useCallback(
    (command: EditorCommand) => {
      if (!ensureEditable()) {
        return;
      }
      const state = useAppStore.getState();
      if (state.viewMode === "reading") {
        state.setViewMode("preview");
      }
      window.requestAnimationFrame(() => dispatchEditorCommand(command));
    },
    [ensureEditable],
  );

  const ensureImageTarget = useCallback(async (): Promise<{
    path: string;
    folder: string;
  } | null> => {
    let state = useAppStore.getState();
    if (!state.doc.path) {
      const saved = await saveCurrent(true, true);
      if (!saved) {
        useAppStore
          .getState()
          .showToast(
            tNow("Save the document before inserting a local image."),
            "info",
          );
        return null;
      }
      state = useAppStore.getState();
    }
    if (!state.doc.path) {
      return null;
    }
    return {
      path: state.doc.path,
      folder: state.settings.imageAssetFolder.trim() || "assets",
    };
  }, [saveCurrent]);

  const insertImageAsset = useCallback(
    (asset: ImageAsset) => {
      if (!ensureEditable()) {
        return;
      }
      const state = useAppStore.getState();
      const markdown = buildImageMarkdown(
        altTextFromFileName(asset.name),
        asset.relativePath,
      );
      if (state.viewMode === "reading") {
        state.setViewMode("preview");
      }
      window.requestAnimationFrame(() => dispatchEditorInsert(markdown, true));
      state.showToast(
        tNow("Inserted image {name}", { name: asset.name }),
        "success",
      );
    },
    [ensureEditable],
  );

  const handleInsertImage = useCallback(async () => {
    if (!ensureEditable()) {
      return;
    }
    if (!isTauri()) {
      useAppStore
        .getState()
        .showToast(
          tNow("Local images are available in the desktop app."),
          "info",
        );
      return;
    }
    const target = await ensureImageTarget();
    if (!target) {
      return;
    }
    try {
      const sourcePath = await pickImageFile();
      if (!sourcePath) {
        return;
      }
      const asset = await importImageAsset(
        target.path,
        sourcePath,
        target.folder,
      );
      insertImageAsset(asset);
    } catch (error) {
      useAppStore.getState().showToast(errorMessage(error), "error");
    }
  }, [ensureEditable, ensureImageTarget, insertImageAsset]);

  const handleInsertImagePath = useCallback(
    async (sourcePath: string) => {
      if (!ensureEditable()) {
        return;
      }
      if (!isTauri()) {
        useAppStore
          .getState()
          .showToast(
            tNow("Local images are available in the desktop app."),
            "info",
          );
        return;
      }
      const target = await ensureImageTarget();
      if (!target) {
        return;
      }
      try {
        const asset = await importImageAsset(
          target.path,
          sourcePath,
          target.folder,
        );
        insertImageAsset(asset);
      } catch (error) {
        useAppStore.getState().showToast(errorMessage(error), "error");
      }
    },
    [ensureEditable, ensureImageTarget, insertImageAsset],
  );

  const handlePasteImage = useCallback(
    async (file: File) => {
      if (!ensureEditable()) {
        return;
      }
      if (!isTauri()) {
        useAppStore
          .getState()
          .showToast(
            tNow("Pasted images are available in the desktop app."),
            "info",
          );
        return;
      }
      const target = await ensureImageTarget();
      if (!target) {
        return;
      }
      try {
        const dataBase64 = await fileToBase64(file);
        const asset = await saveImageData(
          target.path,
          pastedImageName(file.type),
          target.folder,
          dataBase64,
        );
        insertImageAsset(asset);
      } catch (error) {
        useAppStore.getState().showToast(errorMessage(error), "error");
      }
    },
    [ensureEditable, ensureImageTarget, insertImageAsset],
  );

  const handlePrint = useCallback((options?: ExportOptions) => {
    const state = useAppStore.getState();
    if (!state.doc.content.trim()) {
      state.showToast(tNow("There is nothing to print yet."), "info");
      return;
    }
    const exportOptions = normalizeExportOptions(
      options ?? state.settings.exportOptions,
    );
    state.updateSettings({ exportOptions });
    const title =
      frontMatterTitle(state.doc.content) ??
      (state.doc.name.replace(/\.[^.\\/]+$/, "") || tNow("Untitled"));
    document.getElementById("marksi-print-page")?.remove();
    const pageStyle = document.createElement("style");
    pageStyle.id = "marksi-print-page";
    pageStyle.textContent = buildPageCss(exportOptions, title);
    document.head.appendChild(pageStyle);
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      pageStyle.remove();
    };
    window.addEventListener("afterprint", cleanup, { once: true });
    window.setTimeout(cleanup, 60_000);

    if (state.viewMode !== "reading") {
      state.setViewMode("reading");
    }
    const started = Date.now();
    const printWhenReady = () => {
      const body = document.querySelector(".markdown-body");
      const diagramsPending = document.querySelector(
        '.mermaid-diagram[aria-busy="true"]',
      );
      if ((body && !diagramsPending) || Date.now() - started > 4000) {
        window.print();
      } else {
        window.setTimeout(printWhenReady, 80);
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
        state.setViewMode("preview");
        state.showToast(
          tNow("Draft recovered. Review it, then save."),
          "success",
        );
        return;
      } catch {
        // The file may have moved; keep the recovered text as a local document.
      }
    }

    useAppStore.getState().restoreDraft(pending);
    useAppStore
      .getState()
      .showToast(
        tNow("Recovered unsaved draft. Save it to a file."),
        "success",
      );
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
              tNow(
                "This file changed on disk. Your unsaved edits are still here.",
              ),
              "info",
            );
          return;
        }

        const { ask } = await import("@tauri-apps/plugin-dialog");
        const reload = await ask(
          tNow("This file changed on disk. Reload it?"),
          {
            title: tNow("File changed"),
            kind: "info",
            okLabel: tNow("Reload"),
            cancelLabel: tNow("Keep current"),
          },
        );
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
          latest.showToast(tNow("Reloaded changes from disk."), "info");
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
    if (!isTauri()) {
      return;
    }
    let cancelled = false;
    void Promise.all([isFullscreen(), isAlwaysOnTop()])
      .then(([nextFullscreen, nextAlwaysOnTop]) => {
        if (!cancelled) {
          useAppStore.getState().setFullscreen(nextFullscreen);
          useAppStore.getState().setAlwaysOnTop(nextAlwaysOnTop);
        }
      })
      .catch(() => {
        // Window flags are optional; the menu remains usable if querying fails.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }
    if (!settings.rememberWindowFrame) {
      clearWindowFrame();
      return;
    }
    let cancelled = false;
    let timer = 0;
    const unlisteners: Array<() => void> = [];

    async function capture() {
      if (cancelled || restoringWindowRef.current) {
        return;
      }
      try {
        if (await isWindowMinimized()) {
          return;
        }
        const frame = await readWindowFrame();
        if (frame.maximized && windowFrameRef.current) {
          saveWindowFrame({ ...windowFrameRef.current, maximized: true });
        } else {
          windowFrameRef.current = frame;
          saveWindowFrame(frame);
        }
      } catch {
        // Remembering the window is best-effort.
      }
    }

    function schedule() {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void capture(), 400);
    }

    async function setup() {
      restoringWindowRef.current = true;
      try {
        const saved = loadWindowFrame();
        if (saved) {
          const areas = await windowWorkAreas();
          const fitted = fitWindowFrame(saved, areas);
          windowFrameRef.current = { ...fitted, maximized: false };
          await applyWindowFrame(fitted);
        } else {
          windowFrameRef.current = await readWindowFrame();
        }
      } catch {
        // Keep the configured default window when restore fails.
      } finally {
        restoringWindowRef.current = false;
      }
      if (cancelled) {
        return;
      }
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const window = getCurrentWindow();
        unlisteners.push(
          await window.onResized(schedule),
          await window.onMoved(schedule),
        );
      } catch {
        // Geometry listeners are optional.
      }
    }

    void setup();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [settings.rememberWindowFrame]);

  useEffect(() => {
    const onReload = () => setThemeRevision((value) => value + 1);
    window.addEventListener("marksi:themes-changed", onReload);
    return () => window.removeEventListener("marksi:themes-changed", onReload);
  }, []);

  useEffect(() => {
    const styleID = "marksi-custom-theme";
    const existing = document.getElementById(styleID);
    if (!isTauri() || !settings.customTheme) {
      existing?.remove();
      return;
    }
    let cancelled = false;
    void listCustomThemes()
      .then((themes) => {
        if (cancelled) {
          return;
        }
        const theme = findCustomTheme(themes, settings.customTheme);
        if (!theme) {
          document.getElementById(styleID)?.remove();
          return;
        }
        const sanitized = sanitizeCustomCss(theme.css);
        let style = document.getElementById(styleID) as HTMLStyleElement | null;
        if (!style) {
          style = document.createElement("style");
          style.id = styleID;
          document.head.appendChild(style);
        }
        style.textContent = sanitized.css;
      })
      .catch(() => {
        document.getElementById(styleID)?.remove();
      });
    return () => {
      cancelled = true;
    };
  }, [settings.customTheme, themeRevision]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", themeColor(resolvedTheme));
  }, [resolvedTheme]);

  useEffect(() => {
    document.title = `${doc.dirty ? "• " : ""}${doc.name} — MarkSI`;
  }, [doc.name, doc.dirty]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      const state = useAppStore.getState();
      if (state.settings.restoreSession) {
        saveSession({
          documentPath: state.doc.path,
          workspacePath: state.workspace?.path ?? null,
          viewMode: state.viewMode,
        });
      }
      if (state.doc.dirty) {
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
              tNow(
                "You have unsaved changes. Close MarkSI without saving?",
              ),
              {
                title: tNow("Unsaved changes"),
                kind: "warning",
                okLabel: tNow("Close without saving"),
                cancelLabel: tNow("Keep editing"),
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
    const handler = (event: Event) => {
      const file = (event as CustomEvent<File>).detail;
      if (file instanceof File) {
        void handlePasteImage(file);
      }
    };
    window.addEventListener(EDITOR_PASTE_IMAGE_EVENT, handler);
    return () => window.removeEventListener(EDITOR_PASTE_IMAGE_EVENT, handler);
  }, [handlePasteImage]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isImeKeyEvent(event)) {
        return;
      }
      const state = useAppStore.getState();
      if (state.shortcutRecording) {
        return;
      }
      if (event.key === "F11") {
        event.preventDefault();
        event.stopPropagation();
        void handleToggleFullscreen();
        return;
      }
      const command = shortcutForEvent(state.settings.shortcuts, event);
      if (!command) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      switch (command) {
        case "new":
          void handleNew();
          break;
        case "open":
          void handleOpen();
          break;
        case "openFolder":
          void handleOpenFolder();
          break;
        case "save":
          void saveCurrent(false);
          break;
        case "saveAs":
          void saveCurrent(true);
          break;
        case "quickOpen":
          state.setSettingsOpen(false);
          state.setQuickOpen(true);
          break;
        case "searchWorkspace":
          state.setQuickOpen(false);
          state.setSidebarTab("search");
          if (state.workspace) {
            state.setSearchScope("workspace");
          } else {
            state.setSearchScope("document");
            state.showToast(
              tNow("Open a folder to search across files."),
              "info",
            );
          }
          window.setTimeout(() => {
            document
              .querySelector<HTMLInputElement>(".search-box input")
              ?.focus();
          }, 0);
          break;
        case "insertImage":
          void handleInsertImage();
          break;
        case "find":
        case "replace":
          if (state.viewMode === "reading") {
            state.setViewMode("preview");
          }
          window.requestAnimationFrame(() =>
            dispatchEditorSearch(command === "replace"),
          );
          break;
        case "copyMarkdown":
          void handleCopyDocument("markdown");
          break;
        case "copyHtml":
          void handleCopyDocument("html");
          break;
        case "copyText":
          void handleCopyDocument("text");
          break;
        case "toggleSidebar":
          state.toggleSidebar();
          break;
        case "toggleView":
          if (!event.repeat) {
            state.toggleViewMode();
          }
          break;
        case "zoomIn":
          adjustZoom(1);
          break;
        case "zoomOut":
          adjustZoom(-1);
          break;
        case "zoomReset":
          adjustZoom(0);
          break;
        case "settings":
          state.setQuickOpen(false);
          state.setSettingsOpen(true);
          break;
        case "focusMode":
          state.updateSettings({ focusMode: !state.settings.focusMode });
          break;
        case "typewriterMode":
          state.updateSettings({
            typewriterMode: !state.settings.typewriterMode,
          });
          break;
        case "readOnly":
          state.updateSettings({
            readOnlyMode: !state.settings.readOnlyMode,
          });
          break;
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [
    adjustZoom,
    handleCopyDocument,
    handleInsertImage,
    handleNew,
    handleOpen,
    handleOpenFolder,
    handleToggleFullscreen,
    saveCurrent,
  ]);

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
          if (isImagePath(path)) {
            void handleInsertImagePath(path);
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
              .showToast(
                tNow("Drop a Markdown or text file, or a folder."),
                "info",
              );
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
  }, [handleInsertImagePath, handleOpenPath]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }
    (window as unknown as Record<string, unknown>).__MARKSI_DEV__ = {
      openPath: handleOpenPath,
      open: handleOpen,
      openFolder: handleOpenFolder,
      openFolderPath: handleOpenFolderPath,
      closeWorkspace: handleCloseWorkspace,
      newDocument: handleNew,
      save: handleSave,
      saveAs: handleSaveAs,
      setContent: (content: string) => useAppStore.getState().setContent(content),
      getState: () => useAppStore.getState(),
      gotoLine: (line: number) => useAppStore.getState().requestGotoLine(line),
      toggleView: handleToggleView,
      setViewMode: (mode: "source" | "preview" | "reading") =>
        useAppStore.getState().setViewMode(mode),
      format: handleFormat,
      insertImage: handleInsertImage,
      insertImagePath: handleInsertImagePath,
      pasteImage: handlePasteImage,
      exportHtml: handleExportHtml,
      exportImage: handleExportImage,
      customExport: handleCustomExport,
      openExport: handleOpenExport,
      closeExport: () => setExportOpen(false),
      openPandoc: handleOpenPandoc,
      closePandoc: () => setPandocOpen(false),
      pandocImport: handlePandocImport,
      copyDocument: handleCopyDocument,
      print: handlePrint,
      openQuickOpen: () => useAppStore.getState().setQuickOpen(true),
      openSettings: () => useAppStore.getState().setSettingsOpen(true),
      openHistory: () => setHistoryOpen(true),
      closeHistory: () => setHistoryOpen(false),
      toggleFullscreen: handleToggleFullscreen,
      toggleAlwaysOnTop: handleToggleAlwaysOnTop,
      windowFlags: async () => ({
        fullscreen: await isFullscreen(),
        alwaysOnTop: await isAlwaysOnTop(),
        minimized: await isWindowMinimized(),
      }),
      setWindowFlags: async (fullscreen: boolean, alwaysOnTop: boolean) => {
        await setFullscreen(fullscreen);
        await setAlwaysOnTop(alwaysOnTop);
        useAppStore.getState().setFullscreen(fullscreen);
        useAppStore.getState().setAlwaysOnTop(alwaysOnTop);
      },
      windowFrame: () => readWindowFrame(),
      setWindowFrame: (frame: WindowFrame) => applyWindowFrame(frame),
      saveWindowFrameMemory: async () => {
        const frame = await readWindowFrame();
        saveWindowFrame(frame);
        return frame;
      },
      restoreWindowFrameMemory: async () => {
        const saved = loadWindowFrame();
        if (!saved) {
          return null;
        }
        const areas = await windowWorkAreas();
        const fitted = fitWindowFrame(saved, areas);
        await applyWindowFrame(fitted);
        return fitted;
      },
      clearWindowFrameMemory: () => clearWindowFrame(),
      savedSession: () => loadSession(),
      restoreSavedSession: async () => {
        const saved = loadSession();
        return saved ? applySavedSession(saved) : false;
      },
      clearSessionMemory: () => clearSession(),
      reloadCustomThemes: () =>
        window.dispatchEvent(new Event("marksi:themes-changed")),
      customThemesFolder: () => customThemesFolder(),
      openEncoding: () => setEncodingOpen(true),
      closeEncoding: () => setEncodingOpen(false),
      setSettings: (patch: Partial<AppSettings>) =>
        useAppStore.getState().updateSettings(patch),
    };
  }, [
    handleNew,
    handleOpen,
    handleOpenFolder,
    handleOpenFolderPath,
    handleOpenPath,
    handleToggleFullscreen,
    handleToggleAlwaysOnTop,
    applySavedSession,
    handleSave,
    handleSaveAs,
    handleCloseWorkspace,
    handleToggleView,
    handleFormat,
    handleInsertImage,
    handleInsertImagePath,
    handlePasteImage,
    handleExportHtml,
    handleExportImage,
    handleCustomExport,
    handleOpenExport,
    handleOpenPandoc,
    handlePandocImport,
    handleCopyDocument,
    handlePrint,
  ]);

  return (
    <div
      className={`app-shell ${sidebarOpen ? "has-sidebar" : ""}`}
      data-large-file={largeFile ? "true" : undefined}
    >
      <TitleBar />
      <div className="workspace-shell">
        {sidebarOpen ? (
          <Sidebar
            onOpenFile={(path) => void handleOpenPath(path)}
            onOpenFileAtLine={(path, line) => void handleOpenPath(path, line)}
            onOpenFileDialog={() => void handleOpen()}
            onOpenFolder={() => void handleOpenFolder()}
            onOpenFolderPath={(path) => void handleOpenFolderPath(path)}
            onNewFile={handleNew}
            onQuickOpen={() => useAppStore.getState().setQuickOpen(true)}
            onRefreshWorkspace={() => void handleRefreshWorkspace()}
            onFilesChanged={handleFilesChanged}
          />
        ) : null}

        <main
          className={`document-area ${viewMode === "reading" ? "is-preview" : ""} ${
            viewMode === "preview" ? "is-live-preview" : ""
          }`}
        >
          <EditorPane
            content={doc.content}
            documentKey={doc.path ?? "untitled"}
            gotoLine={gotoLine}
            active={viewMode !== "reading"}
            readOnly={viewMode === "reading" || settings.readOnlyMode}
            focusMode={settings.focusMode}
            typewriterMode={settings.typewriterMode}
            spellcheck={settings.spellcheck && !largeFile}
            autoPair={settings.autoPair}
            smartPunctuation={settings.smartPunctuation}
            emojiAutocomplete={settings.emojiAutocomplete && !largeFile}
            livePreviewMode={viewMode === "preview" && !largeFile}
            language={settings.language}
          />
          {viewMode === "reading" ? (
            <Suspense
              fallback={
                <div className="preview-surface preview-loading" role="status">
                  Rendering preview…
                </div>
              }
            >
              <PreviewPane
                content={doc.content}
                documentPath={doc.path}
                workspacePath={workspacePath}
                gotoLine={gotoLine}
                theme={resolvedTheme}
                onResizeImage={handleResizeImage}
                onFitImage={handleFitImage}
                onResetImage={handleResetImage}
              />
            </Suspense>
          ) : null}
          {doc.loading ? (
            <div className="loading-veil" aria-live="polite">
              <span>{t("Opening document…")}</span>
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
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenEncoding={() => setEncodingOpen(true)}
        onExport={handleOpenExport}
        onExportImage={() => void handleExportImage()}
        onPandocExport={handleOpenPandoc}
        onPandocImport={() => void handlePandocImport()}
        onPrint={handlePrint}
        onCopy={handleCopyDocument}
        onToggleView={handleToggleView}
        onFormat={handleFormat}
        onInsertImage={handleInsertImage}
        onToggleFullscreen={() => void handleToggleFullscreen()}
        onToggleAlwaysOnTop={() => void handleToggleAlwaysOnTop()}
        onZoomIn={() => adjustZoom(1)}
        onZoomOut={() => adjustZoom(-1)}
        onResetZoom={() => adjustZoom(0)}
        onCloseWorkspace={handleCloseWorkspace}
        onQuickOpen={() => useAppStore.getState().setQuickOpen(true)}
        onSearchWorkspace={() => {
          const state = useAppStore.getState();
          state.setSidebarTab("search");
          if (state.workspace) {
            state.setSearchScope("workspace");
          } else {
            state.setSearchScope("document");
            state.showToast(
              tNow("Open a folder to search across files."),
              "info",
            );
          }
        }}
        onOpenSettings={() => useAppStore.getState().setSettingsOpen(true)}
      />
      <QuickOpen onOpen={(path) => void handleOpenPath(path)} />
      <SettingsDialog />
      <ExportDialog
        open={exportOpen}
        hasContent={Boolean(doc.content.trim())}
        onClose={() => setExportOpen(false)}
        onExport={handleExportHtml}
        onCustomExport={handleCustomExport}
        onPrint={handlePrint}
      />
      <PandocDialog
        open={pandocOpen}
        hasContent={Boolean(doc.content.trim())}
        onClose={() => setPandocOpen(false)}
      />
      <HistoryDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
      <EncodingDialog
        open={encodingOpen}
        onClose={() => setEncodingOpen(false)}
        onReopen={handleReopenWithEncoding}
      />
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
