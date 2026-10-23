# MarkSI architecture

## Goals

MarkSI is a local-first Markdown editor for Windows 11 and mainstream Linux
distributions. The product target is broad functional parity with a mature
desktop Markdown editor while keeping a distinct visual identity and a clean,
independently written codebase.

## Layers

```text
React UI (WebView2 / WebKitGTK)
  Title bar, sidebar, editor, status bar, dialogs
  CodeMirror 6 + Markdown extensions
        |
        | typed IPC commands/events
        v
Rust core (Tauri 2)
  document IO / encoding / line endings
  workspace listing / full-text search / mtime checks
  export / print / image pipeline
  platform integration
```

## Document model

The Markdown text is the canonical document. The editor keeps a CodeMirror
state whose document is that text. Rendering is derived from the Lezer Markdown
syntax tree; no HTML-to-Markdown round trip is used for editing.

When a document is opened:

1. Rust reads bytes, detects BOM/encoding, and decodes to a UTF-8 string.
2. Line endings are normalized to LF for the editor; the original EOL is stored.
3. The frontend receives `{ content, encoding, lineEnding, hasBom, ... }`.
4. On save, Rust restores the requested EOL and encoding, then writes atomically.

This keeps edits lossless for the syntax that MarkSI understands and makes
source mode and live preview operate on the same text.

## Local persistence

Settings, theme, recent files, sidebar state, and the last view mode are kept in
WebView `localStorage` through the Zustand store's `persist` middleware. The
recovery draft is a separate, version-tolerant record under
`marksi-recovery-draft`. It is written 700 ms after the last edit when the
document is dirty and is removed as soon as the document is clean again.

Autosave to disk is opt-in and only applies to named documents. It waits for the
configured pause (0.8–5 seconds), re-checks the live store before saving, and
therefore cannot mark newer edits as saved. Settings never leave the device.

## Workspace search and external changes

The Rust workspace module walks the open folder, filters supported text
extensions, skips hidden and dependency/build folders, and returns relative
paths, sizes, and modification times. A full-text query is evaluated line by
line, with optional case matching, a 4 MB per-file ceiling, and bounded result
counts. Match results carry a 1-based line and character column so quick open
and search can jump directly to the source position.

External changes are detected by polling the active document's modification time
every 2.5 seconds rather than installing a native watcher. A clean document is
re-read when its timestamp changes. A dirty document updates the remembered
timestamp and shows a conflict warning, preserving local edits until the user
saves or explicitly reloads.

## Frontend boundaries

- `src/lib/platform.ts` is the only place that calls Tauri APIs for file IO.
  Browser builds use a file input/download fallback.
- `src/lib/quickOpen.ts` is a pure ranking module; it has no DOM or Tauri
  dependencies and is covered by unit tests.
- `src/lib/drafts.ts` owns recovery-draft serialization and validation.
- `src/store/useAppStore.ts` owns document and shell state.
- `src/editor/` contains editor setup and Markdown analysis helpers.
- Components never call Rust file commands directly.

## Rust boundaries

- Every filesystem command canonicalizes paths and validates access.
- Writes use a temporary file in the destination directory followed by a
  replace/rename, so a failed write does not truncate the original.
- Binary/encoding handling lives in Rust, not in the WebView.
- No activation, account, or telemetry subsystem exists.

## Current surface (M3)

Document commands: `read_document`, `write_document`, `write_export`,
`list_directory`, and `app_version`. Workspace commands:
`list_workspace_files`, `search_workspace`, and `file_modified_ms`.

The frontend uses Tauri's dialog plugin for open/save/folder dialogs and native
confirmation prompts. Files can also be dropped onto the window; a dropped
folder becomes the workspace, and a supported text file opens in the editor.
Dirty documents are guarded by the window close handler. The preferences
dialog, quick-open overlay, workspace-search panel, toast surface, and draft
recovery modal are all React components driven by the same store.

The editor remains source-first. Preview, formatting, export, search, and
workspace navigation are layered on top of the same CodeMirror state. The
document text is never round-tripped through rendered HTML.

## Future modules

- Native file watcher with debounce, replacing the current mtime poll when a
  platform watcher is available.
- SQLite session/history store for multi-window restore and local snapshots.
- Shared export pipeline and Pandoc adapter (Pandoc is invoked externally,
  never bundled).
- Mermaid/MathJax lazy rendering with a worker for heavy diagrams.
- Local image/asset pipeline and cross-platform print-to-PDF adapters.
