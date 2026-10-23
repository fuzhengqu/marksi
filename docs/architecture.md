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
  workspace listing / search / watchers
  sessions / drafts / history
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

## Frontend boundaries

- `src/lib/platform.ts` is the only place that calls Tauri APIs for file IO.
  Browser builds use a file input/download fallback.
- `src/store/useAppStore.ts` owns document and shell state.
- `src/editor/` contains editor setup and Markdown analysis helpers.
- Components never call Rust file commands directly.

## Rust boundaries

- Every filesystem command canonicalizes paths and validates access.
- Writes use a temporary file in the destination directory followed by a
  replace/rename, so a failed write does not truncate the original.
- Binary/encoding handling lives in Rust, not in the WebView.
- No activation, account, or telemetry subsystem exists.

## Current M1 surface

Rust commands: `read_document`, `write_document`, `list_directory`, and
`app_version`. The frontend uses Tauri's dialog plugin for open/save/folder
dialogs and native confirmation prompts. Files can also be dropped onto the
window; a dropped folder becomes the workspace, and a supported text file opens
in the editor. Dirty documents are guarded by the window close handler.

The editor is intentionally source-first in M1. Live preview, formatting
commands, export, and richer document analysis are layered on top of the same
CodeMirror state in later milestones.

## Future modules

- `notify` file watcher with debounce and conflict detection.
- SQLite session/history store.
- `comrak` export pipeline and Pandoc adapter (Pandoc is invoked externally,
  never bundled).
- Mermaid/MathJax lazy rendering with a worker for heavy diagrams.
- Cross-platform print-to-PDF adapters.
