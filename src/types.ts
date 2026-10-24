import type { ShortcutId } from "./lib/shortcuts";

export type LineEnding = "LF" | "CRLF";

export type SidebarTab = "files" | "outline" | "search";

export type SearchScope = "document" | "workspace";

export type Theme = "light" | "dark" | "sepia" | "contrast" | "system";

export type Language = "zh-CN" | "en";

export type ViewMode = "source" | "preview" | "reading";

export type CopyFormat = "markdown" | "html" | "text";

export type ToastTone = "info" | "success" | "error";

export type ExportProfileId = "document" | "print" | "minimal" | "custom";

export type ExportPageSize = "a4" | "letter" | "legal";

export type ExportOrientation = "portrait" | "landscape";

export type ExportMargin = "normal" | "narrow" | "wide";

export interface ExportOptions {
  profile: ExportProfileId;
  useFrontMatter: boolean;
  includeMetadataTags: boolean;
  includeDocumentInfo: boolean;
  pageSize: ExportPageSize;
  orientation: ExportOrientation;
  margin: ExportMargin;
  header: string;
  footer: string;
}

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

export interface HistoryEntry {
  id: string;
  name: string;
  savedAt: number;
  size: number;
  encoding: string;
  lineEnding: LineEnding;
  preview: string;
}

export interface HistorySnapshot {
  id: string;
  savedAt: number;
  encoding: string;
  lineEnding: LineEnding;
  content: string;
}

export interface PinnedEntry {
  path: string;
  name: string;
  isDir: boolean;
}

export interface FileOperationResult {
  path: string;
  name: string;
  size: number;
  modifiedMs: number | null;
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

export interface ImageAsset {
  path: string;
  relativePath: string;
  name: string;
  size: number;
}

export interface AppSettings {
  language: Language;
  editorFontSize: number;
  contentWidth: number;
  zoomLevel: number;
  spellcheck: boolean;
  autoSave: boolean;
  autoSaveDelayMs: number;
  imageAssetFolder: string;
  focusMode: boolean;
  typewriterMode: boolean;
  readOnlyMode: boolean;
  autoPair: boolean;
  smartPunctuation: boolean;
  emojiAutocomplete: boolean;
  strictMode: boolean;
  exportOptions: ExportOptions;
  customExportProgram: string;
  customExportArgs: string;
  pandocPath: string;
  loadRemoteImages: boolean;
  imageRootPath: string;
  imageRootUrl: string;
  flatFileList: boolean;
  localHistory: boolean;
  largeFileOptimizations: boolean;
  shortcuts: Record<ShortcutId, string>;
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
