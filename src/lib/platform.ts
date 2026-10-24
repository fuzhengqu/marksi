import type {
  DocumentPayload,
  FileEntry,
  FileMeta,
  FileOperationResult,
  HistoryEntry,
  HistorySnapshot,
  ImageAsset,
  LineEnding,
  WorkspaceFile,
  WorkspaceSearchMatch,
} from "../types";
import type { WindowFrame, WorkArea } from "./windowFrame";
import { APP_SEMVER } from "./version";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function fileName(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.split("/").pop() || path;
}

function detectLineEnding(text: string): LineEnding {
  const crlf = (text.match(/\r\n/g) || []).length;
  const lf = (text.match(/\n/g) || []).length - crlf;
  return crlf > 0 && crlf >= lf ? "CRLF" : "LF";
}

function normalizeContent(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export interface SaveDialogOptions {
  defaultPath?: string;
  filters: Array<{ name: string; extensions: string[] }>;
}

export type TestSaveDialog = (
  options: SaveDialogOptions,
) => Promise<string | null>;

export interface OpenDialogOptions {
  filters: Array<{ name: string; extensions: string[] }>;
  multiple?: boolean;
  directory?: boolean;
}

export type TestOpenDialog = (
  options: OpenDialogOptions,
) => Promise<string | null>;

export type TestRemoteImageLoader = (url: string) => Promise<string>;

let testSaveDialog: TestSaveDialog | null = null;
let testOpenDialog: TestOpenDialog | null = null;
let testRemoteImageLoader: TestRemoteImageLoader | null = null;

/**
 * Lets the E2E suite observe and answer the save dialog without opening a
 * native window. The setter is inert in production builds.
 */
export function setSaveDialogForTests(dialog: TestSaveDialog | null): void {
  if (import.meta.env.DEV) {
    testSaveDialog = dialog;
  }
}

export function setOpenDialogForTests(dialog: TestOpenDialog | null): void {
  if (import.meta.env.DEV) {
    testOpenDialog = dialog;
  }
}

export function setRemoteImageLoaderForTests(
  loader: TestRemoteImageLoader | null,
): void {
  if (import.meta.env.DEV) {
    testRemoteImageLoader = loader;
  }
}

async function pickBrowserFile(accept = ".md,.markdown,.mdown,.mkd,.mdwn,.mmd,.txt,text/markdown,text/plain"): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    input.addEventListener("change", () => {
      resolve(input.files?.[0] ?? null);
      input.remove();
    });
    input.addEventListener("cancel", () => {
      resolve(null);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  });
}

async function browserDocument(file: File): Promise<DocumentPayload> {
  const text = await file.text();
  const lineEnding = detectLineEnding(text);
  return {
    path: file.name,
    content: normalizeContent(text),
    encoding: "UTF-8",
    lineEnding,
    hasBom: false,
    hadErrors: false,
    size: file.size,
    modifiedMs: file.lastModified || null,
  };
}

export async function takeStartupFile(): Promise<string | null> {
  if (!isTauri()) {
    return null;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string | null>("take_startup_file");
}

export async function openDocument(): Promise<DocumentPayload | null> {
  if (!isTauri()) {
    const file = await pickBrowserFile();
    return file ? browserDocument(file) : null;
  }

  const { open } = await import("@tauri-apps/plugin-dialog");
  const { invoke } = await import("@tauri-apps/api/core");
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [
      {
        name: "Markdown",
        extensions: ["md", "markdown", "mdown", "mkd", "mdwn", "mmd", "txt"],
      },
      { name: "All files", extensions: ["*"] },
    ],
  });

  if (!selected || Array.isArray(selected)) {
    return null;
  }

  return invoke<DocumentPayload>("read_document", { path: selected });
}

export async function readDocument(path: string): Promise<DocumentPayload> {
  if (!isTauri()) {
    throw new Error("Opening a path is only available in the desktop app.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<DocumentPayload>("read_document", { path });
}

export async function readDocumentWithEncoding(
  path: string,
  encoding: string,
): Promise<DocumentPayload> {
  if (!isTauri()) {
    throw new Error("Encoding selection is only available in the desktop app.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<DocumentPayload>("read_document_with_encoding", {
    path,
    encoding,
  });
}

export async function openFolder(): Promise<string | null> {
  if (!isTauri()) {
    return null;
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({ multiple: false, directory: true });
  return typeof selected === "string" ? selected : null;
}

export async function pickImageFile(): Promise<string | null> {
  if (!isTauri()) {
    return null;
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [
      {
        name: "Images",
        extensions: [
          "png",
          "jpg",
          "jpeg",
          "gif",
          "webp",
          "bmp",
          "svg",
          "avif",
          "ico",
        ],
      },
      { name: "All files", extensions: ["*"] },
    ],
  });
  return typeof selected === "string" ? selected : null;
}

export async function importImageAsset(
  documentPath: string,
  sourcePath: string,
  folder: string,
): Promise<ImageAsset> {
  if (!isTauri()) {
    throw new Error("Local images are only available in the desktop app.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ImageAsset>("import_image_asset", {
    documentPath,
    sourcePath,
    folder,
  });
}

export async function saveImageData(
  documentPath: string,
  fileName: string,
  folder: string,
  dataBase64: string,
): Promise<ImageAsset> {
  if (!isTauri()) {
    throw new Error("Pasted images are only available in the desktop app.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ImageAsset>("save_image_data", {
    documentPath,
    fileName,
    folder,
    dataBase64,
  });
}

export async function readImageDataUrl(path: string): Promise<string> {
  if (!isTauri()) {
    throw new Error("Local image previews are only available in the desktop app.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("read_image_data_url", { path });
}

export async function listDirectory(path: string): Promise<FileEntry[]> {
  if (!isTauri()) {
    return [];
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<FileEntry[]>("list_directory", { path });
}

export async function listWorkspaceFiles(
  root: string,
  limit = 2_000,
): Promise<WorkspaceFile[]> {
  if (!isTauri()) {
    return [];
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<WorkspaceFile[]>("list_workspace_files", { root, limit });
}

export async function renameWorkspaceFile(
  root: string,
  path: string,
  newName: string,
): Promise<FileOperationResult> {
  if (!isTauri()) {
    throw new Error("File operations are only available in the desktop app.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<FileOperationResult>("rename_workspace_file", {
    root,
    path,
    newName,
  });
}

export async function duplicateWorkspaceFile(
  root: string,
  path: string,
): Promise<FileOperationResult> {
  if (!isTauri()) {
    throw new Error("File operations are only available in the desktop app.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<FileOperationResult>("duplicate_workspace_file", { root, path });
}

export async function moveWorkspaceFile(
  root: string,
  path: string,
  targetFolder: string,
): Promise<FileOperationResult> {
  if (!isTauri()) {
    throw new Error("File operations are only available in the desktop app.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<FileOperationResult>("move_workspace_file", {
    root,
    path,
    targetFolder,
  });
}

export async function deleteWorkspaceFile(
  root: string,
  path: string,
): Promise<void> {
  if (!isTauri()) {
    throw new Error("File operations are only available in the desktop app.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("delete_workspace_file", { root, path });
}

export async function recordHistory(
  path: string,
  name: string,
  content: string,
  encoding: string,
  lineEnding: string,
): Promise<HistoryEntry | null> {
  if (!isTauri()) {
    return null;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<HistoryEntry | null>("record_history", {
    path,
    name,
    content,
    encoding,
    lineEnding,
  });
}

export async function listHistory(path: string): Promise<HistoryEntry[]> {
  if (!isTauri()) {
    return [];
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<HistoryEntry[]>("list_history", { path });
}

export async function readHistory(
  path: string,
  id: string,
): Promise<HistorySnapshot> {
  if (!isTauri()) {
    throw new Error("Local history is only available in the desktop app.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<HistorySnapshot>("read_history", { path, id });
}

export async function deleteHistorySnapshot(
  path: string,
  id: string,
): Promise<void> {
  if (!isTauri()) {
    throw new Error("Local history is only available in the desktop app.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("delete_history", { path, id });
}

export async function clearHistory(path: string): Promise<number> {
  if (!isTauri()) {
    return 0;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<number>("clear_history", { path });
}

export async function relocateHistory(
  oldPath: string,
  newPath: string,
): Promise<number> {
  if (!isTauri()) {
    return 0;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<number>("relocate_history", { oldPath, newPath });
}

export async function searchWorkspace(
  root: string,
  query: string,
  caseSensitive = false,
  maxResults = 200,
): Promise<WorkspaceSearchMatch[]> {
  if (!isTauri()) {
    return [];
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<WorkspaceSearchMatch[]>("search_workspace", {
    root,
    query,
    caseSensitive,
    maxResults,
  });
}

export async function getFileModifiedMs(path: string): Promise<number | null> {
  if (!isTauri()) {
    return null;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<number | null>("file_modified_ms", { path });
}

export async function saveDocument(
  doc: {
    path: string | null;
    name: string;
    content: string;
    encoding: string;
    lineEnding: LineEnding;
    hasBom: boolean;
  },
  saveAs: boolean,
): Promise<FileMeta | null> {
  if (!isTauri()) {
    const blob = new Blob([doc.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = doc.name || "Untitled.md";
    anchor.click();
    URL.revokeObjectURL(url);
    return {
      path: doc.name || "Untitled.md",
      size: blob.size,
      modifiedMs: Date.now(),
    };
  }

  const { save } = await import("@tauri-apps/plugin-dialog");
  const { invoke } = await import("@tauri-apps/api/core");

  let path = doc.path;
  if (saveAs || !path) {
    const options: SaveDialogOptions = {
      defaultPath: doc.path ?? doc.name ?? "Untitled.md",
      filters: [
        { name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd", "mdwn", "mmd"] },
        { name: "Text", extensions: ["txt"] },
        { name: "All files", extensions: ["*"] },
      ],
    };
    const selected =
      import.meta.env.DEV && testSaveDialog
        ? await testSaveDialog(options)
        : await save(options);
    if (!selected) {
      return null;
    }
    path = selected;
  }

  return invoke<FileMeta>("write_document", {
    path,
    content: doc.content,
    encoding: doc.encoding,
    lineEnding: doc.lineEnding,
    hasBom: doc.hasBom,
  });
}

export async function chooseExportSavePath(
  defaultPath: string,
  filters: Array<{ name: string; extensions: string[] }>,
): Promise<string | null> {
  if (testSaveDialog) {
    return testSaveDialog({ defaultPath, filters });
  }
  const { save } = await import("@tauri-apps/plugin-dialog");
  return save({ defaultPath, filters });
}

export async function saveHtmlFile(
  defaultPath: string,
  html: string,
): Promise<FileMeta | null> {
  if (!isTauri()) {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName(defaultPath) || "document.html";
    anchor.click();
    URL.revokeObjectURL(url);
    return {
      path: anchor.download,
      size: blob.size,
      modifiedMs: Date.now(),
    };
  }

  const { invoke } = await import("@tauri-apps/api/core");
  const selected = await chooseExportSavePath(defaultPath, [
    { name: "HTML document", extensions: ["html", "htm"] },
  ]);
  if (!selected) {
    return null;
  }
  return invoke<FileMeta>("write_export", {
    path: selected,
    content: html,
  });
}

function base64Bytes(dataBase64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(dataBase64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function savePngFile(
  defaultPath: string,
  dataBase64: string,
): Promise<FileMeta | null> {
  if (!isTauri()) {
    const blob = new Blob([base64Bytes(dataBase64)], { type: "image/png" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName(defaultPath) || "document.png";
    anchor.click();
    URL.revokeObjectURL(url);
    return {
      path: anchor.download,
      size: blob.size,
      modifiedMs: Date.now(),
    };
  }

  const { invoke } = await import("@tauri-apps/api/core");
  const selected = await chooseExportSavePath(defaultPath, [
    { name: "PNG image", extensions: ["png"] },
  ]);
  if (!selected) {
    return null;
  }
  return invoke<FileMeta>("write_export_binary", {
    path: selected,
    dataBase64,
  });
}

export async function runExportCommand(
  program: string,
  args: string[],
  workingDirectory: string | null,
): Promise<number> {
  if (!isTauri()) {
    throw new Error(
      "Custom export commands are only available in the desktop app.",
    );
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<number>("run_export_command", {
    program,
    args,
    workingDirectory,
  });
}

export interface PandocExportRequest {
  program: string;
  content: string;
  documentPath: string | null;
  outputPath: string;
  format: string;
}

export interface PandocExportResult {
  path: string;
  size: number;
}

export async function pandocVersion(program: string): Promise<string> {
  if (!isTauri()) {
    throw new Error("Pandoc is only available in the desktop app.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("pandoc_version", { program });
}

export async function pandocExport(
  request: PandocExportRequest,
): Promise<PandocExportResult> {
  if (!isTauri()) {
    throw new Error("Pandoc is only available in the desktop app.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<PandocExportResult>("pandoc_export", {
    program: request.program,
    content: request.content,
    documentPath: request.documentPath,
    outputPath: request.outputPath,
    format: request.format,
  });
}

export interface PandocImportResult {
  content: string;
  mediaCount: number;
}

const PANDOC_IMPORT_FILTERS = [
  {
    name: "Pandoc documents",
    extensions: ["docx", "odt", "epub", "rtf", "html", "htm"],
  },
];

export async function pickPandocImportFile(): Promise<string | null> {
  if (!isTauri()) {
    throw new Error("Pandoc is only available in the desktop app.");
  }
  if (testOpenDialog) {
    return testOpenDialog({
      filters: PANDOC_IMPORT_FILTERS,
      multiple: false,
      directory: false,
    });
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    multiple: false,
    directory: false,
    filters: PANDOC_IMPORT_FILTERS,
  });
  return typeof selected === "string" ? selected : null;
}

export async function pandocImport(
  program: string,
  inputPath: string,
): Promise<PandocImportResult> {
  if (!isTauri()) {
    throw new Error("Pandoc is only available in the desktop app.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<PandocImportResult>("pandoc_import", {
    program,
    inputPath,
  });
}

export async function remoteImageDataUrl(url: string): Promise<string> {
  if (import.meta.env.DEV && testRemoteImageLoader) {
    return testRemoteImageLoader(url);
  }
  if (!isTauri()) {
    throw new Error(
      "Remote images are only available in the desktop app.",
    );
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("remote_image_data_url", { url });
}

export async function clearRemoteImageCache(): Promise<number> {
  if (!isTauri()) {
    return 0;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<number>("clear_remote_image_cache");
}

export async function getAppVersion(): Promise<string> {
  if (!isTauri()) {
    return APP_SEMVER;
  }
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string>("app_version");
  } catch {
    return APP_SEMVER;
  }
}

export async function openExternal(url: string): Promise<void> {
  if (!isTauri()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl(url);
}

export async function openLocalPath(path: string): Promise<void> {
  if (!isTauri()) {
    throw new Error("Local files are available in the desktop app.");
  }
  const { openPath } = await import("@tauri-apps/plugin-opener");
  await openPath(path);
}

export async function revealLocalPath(path: string): Promise<void> {
  if (!isTauri()) {
    throw new Error("Local files are available in the desktop app.");
  }
  const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
  await revealItemInDir(path);
}

export async function isFullscreen(): Promise<boolean> {
  if (!isTauri()) {
    return Boolean(document.fullscreenElement);
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow().isFullscreen();
}

export async function setFullscreen(fullscreen: boolean): Promise<void> {
  if (!isTauri()) {
    if (fullscreen) {
      await document.documentElement.requestFullscreen();
    } else if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    return;
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setFullscreen(fullscreen);
}

export async function isAlwaysOnTop(): Promise<boolean> {
  if (!isTauri()) {
    return false;
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow().isAlwaysOnTop();
}

export async function setAlwaysOnTop(alwaysOnTop: boolean): Promise<void> {
  if (!isTauri()) {
    throw new Error("Always on top is only available in the desktop app.");
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setAlwaysOnTop(alwaysOnTop);
}

export async function readWindowFrame(): Promise<WindowFrame> {
  if (!isTauri()) {
    throw new Error("Window memory is only available in the desktop app.");
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const window = getCurrentWindow();
  const [position, size, maximized] = await Promise.all([
    window.outerPosition(),
    window.innerSize(),
    window.isMaximized(),
  ]);
  return {
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
    maximized,
  };
}

export async function windowWorkAreas(): Promise<WorkArea[]> {
  if (!isTauri()) {
    return [];
  }
  const { availableMonitors } = await import("@tauri-apps/api/window");
  const monitors = await availableMonitors();
  return monitors.map((monitor) => ({
    x: monitor.workArea.position.x,
    y: monitor.workArea.position.y,
    width: monitor.workArea.size.width,
    height: monitor.workArea.size.height,
  }));
}

export async function applyWindowFrame(frame: WindowFrame): Promise<void> {
  if (!isTauri()) {
    throw new Error("Window memory is only available in the desktop app.");
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const { PhysicalPosition, PhysicalSize } = await import(
    "@tauri-apps/api/dpi"
  );
  const window = getCurrentWindow();
  if (await window.isMaximized()) {
    await window.unmaximize();
  }
  await window.setSize(new PhysicalSize(frame.width, frame.height));
  await window.setPosition(new PhysicalPosition(frame.x, frame.y));
  if (frame.maximized) {
    await window.maximize();
  }
}

export async function closeApplication(): Promise<void> {
  if (!isTauri()) {
    window.close();
    return;
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
}

export { fileName };
