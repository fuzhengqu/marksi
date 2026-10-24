const TEXT_EXTENSIONS = [
  "md",
  "markdown",
  "mdown",
  "mkd",
  "mdwn",
  "mmd",
  "mdx",
  "txt",
  "text",
];

const MAX_NAME_CHARS = 200;

const RESERVED_DEVICE_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export type FileOperationKind = "rename" | "duplicate" | "move" | "delete";

export interface FileOperationTarget {
  name: string;
  path: string;
}

export function isSupportedTextFile(name: string): boolean {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) {
    return false;
  }
  return TEXT_EXTENSIONS.includes(name.slice(dot + 1).toLowerCase());
}

export function validateFileName(input: string): string | null {
  const name = input.trim();
  if (!name || name === "." || name === "..") {
    return "Enter a file name.";
  }
  if ([...name].length > MAX_NAME_CHARS) {
    return `File names cannot exceed ${MAX_NAME_CHARS} characters.`;
  }
  if (name.includes("/") || name.includes("\\")) {
    return "File names cannot contain / or \\.";
  }
  if (/[\u0000-\u001f<>:"|?*]/.test(name)) {
    return 'File names cannot contain control characters or < > : " | ? *.';
  }
  if (name.endsWith(".") || name.endsWith(" ")) {
    return "File names cannot end with a dot or a space.";
  }
  if (!isSupportedTextFile(name)) {
    return "Use a supported Markdown or text file extension.";
  }
  const stem = name.replace(/\.[^.]*$/, "").replace(/[. ]+$/, "");
  if (RESERVED_DEVICE_NAMES.test(stem)) {
    return "That file name is reserved by the operating system.";
  }
  return null;
}

/**
 * Returns a workspace-relative folder path, an empty string for the root, or
 * null when the input tries to escape the workspace.
 */
export function normalizeRelativeFolder(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }
  if (/^[a-zA-Z]:/.test(trimmed) || /[\u0000-\u001f]/.test(trimmed)) {
    return null;
  }
  const segments = trimmed.replace(/\\/g, "/").split("/");
  const cleaned: string[] = [];
  for (const segment of segments) {
    const value = segment.trim();
    if (!value || value === ".") {
      continue;
    }
    if (value === ".." || value.includes(":")) {
      return null;
    }
    cleaned.push(value);
  }
  return cleaned.join("/");
}

export function relativeFolder(workspacePath: string, filePath: string): string {
  const normalizedRoot = workspacePath.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedFile = filePath.replace(/\\/g, "/");
  const prefix = normalizedRoot.toLowerCase();
  if (!normalizedFile.toLowerCase().startsWith(`${prefix}/`)) {
    return "";
  }
  const relative = normalizedFile.slice(normalizedRoot.length + 1);
  const slash = relative.lastIndexOf("/");
  return slash < 0 ? "" : relative.slice(0, slash);
}

export function copyName(name: string, existing: Iterable<string>): string {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  const taken = new Set(
    [...existing].map((value) => value.toLowerCase()),
  );
  for (let index = 1; index <= 999; index += 1) {
    const suffix = index === 1 ? " copy" : ` copy ${index}`;
    const candidate = `${stem}${suffix}${extension}`;
    if (!taken.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return `${stem} copy${extension}`;
}

export function sameFilePath(left: string | null, right: string | null): boolean {
  if (!left || !right) {
    return left === right;
  }
  return (
    left.replace(/^\\\\\?\\/, "").replace(/\//g, "\\").toLowerCase() ===
    right.replace(/^\\\\\?\\/, "").replace(/\//g, "\\").toLowerCase()
  );
}
