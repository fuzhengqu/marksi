import type { DocumentPayload, FileEntry, FileMeta, LineEnding } from "../types";

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

export async function listDirectory(path: string): Promise<FileEntry[]> {
  if (!isTauri()) {
    return [];
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<FileEntry[]>("list_directory", { path });
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
    const selected = await save({
      defaultPath: doc.path ?? doc.name ?? "Untitled.md",
      filters: [
        { name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd", "mdwn", "mmd"] },
        { name: "Text", extensions: ["txt"] },
        { name: "All files", extensions: ["*"] },
      ],
    });
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

export async function getAppVersion(): Promise<string> {
  if (!isTauri()) {
    return "0.1.0";
  }
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string>("app_version");
  } catch {
    return "0.1.0";
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

export { fileName };
