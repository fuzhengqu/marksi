export type LineEnding = "LF" | "CRLF";

export type SidebarTab = "files" | "outline" | "search";

export type SearchScope = "document" | "workspace";

export type Theme = "light" | "dark";

export type ViewMode = "source" | "preview";

export type ToastTone = "info" | "success" | "error";

export interface DocumentPayload {
  path: string;
  content: string;
  encoding: string;
  lineEnding: LineEnding;
  hasBom: boolean;
  hadErrors: boolean;
  size: number;
  modifiedMs: number | null;
}

export interface FileMeta {
  path: string;
  size: number;
  modifiedMs: number | null;
}

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modifiedMs: number | null;
}

export interface RecentFile {
  path: string;
  name: string;
  lastOpened: number;
}

export interface CursorPosition {
  line: number;
  column: number;
}

export interface OutlineItem {
  level: number;
  text: string;
  line: number;
}

export interface TextStats {
  words: number;
  chars: number;
  charsNoSpaces: number;
  lines: number;
}

export interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

export interface WorkspaceFile {
  name: string;
  path: string;
  relativePath: string;
  size: number;
  modifiedMs: number | null;
}

export interface WorkspaceSearchMatch {
  path: string;
  name: string;
  relativePath: string;
  line: number;
  column: number;
  preview: string;
}

export interface AppSettings {
  editorFontSize: number;
  contentWidth: number;
  spellcheck: boolean;
  autoSave: boolean;
  autoSaveDelayMs: number;
}

export interface DocumentDraft {
  path: string | null;
  name: string;
  content: string;
  savedContent: string;
  encoding: string;
  lineEnding: LineEnding;
  hasBom: boolean;
  modifiedMs: number | null;
  updatedAt: number;
}
