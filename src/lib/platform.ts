import type {
  DocumentPayload,
  FileEntry,
  FileMeta,
  ImageAsset,
  LineEnding,
  WorkspaceFile,
  WorkspaceSearchMatch,
} from "../types";
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

let testSaveDialog: TestSaveDialog | null = null;

/**
 * Lets the E2E suite observe and answer the save dialog without opening a
 * native window. The setter is inert in production builds.
 */
export function setSaveDialogForTests(dialog: TestSaveDialog | null): void {
  if (import.meta.env.DEV) {
    testSaveDialog = dialog;
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

async function chooseExportPath(
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
  const selected = await chooseExportPath(defaultPath, [
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
  const selected = await chooseExportPath(defaultPath, [
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

export async function closeApplication(): Promise<void> {
  if (!isTauri()) {
    window.close();
    return;
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
}

export { fileName };
