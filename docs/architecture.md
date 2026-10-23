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
state whose document is that text. Preview rendering is derived from the same
source through markdown-it and sanitized with DOMPurify; CodeMirror's Lezer tree
powers editing syntax and decorations. No HTML-to-Markdown round trip is used
for editing.

When a document is opened:

1. Rust reads bytes, detects BOM/encoding, and decodes to a UTF-8 string.
2. Line endings are normalized to LF for the editor; the original EOL is stored.
3. The frontend receives `{ content, encoding, lineEnding, hasBom, ... }`.
4. On save, Rust restores the requested EOL and encoding, then writes atomically.

This keeps edits lossless for the syntax that MarkSI understands and makes
source mode and live preview operate on the same text.

## Local persistence

Settings (including writing-mode, typing, and interface-zoom preferences),
theme, recent files, and sidebar state are kept in WebView `localStorage`
through the Zustand store's `persist` middleware. Persisted
settings are merged with current defaults so older profiles gain new fields
without losing saved preferences. The recovery draft is a separate,
version-tolerant record under `marksi-recovery-draft`. It is written 700 ms
after the last edit when the document is dirty and is removed as soon as the
document is clean again.

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

## Local images and assets

The image pipeline lives in Rust. `import_image_asset` canonicalizes the
document and source paths, checks the extension and 25 MB limit, creates the
document-relative asset folder, and copies the file with a collision-safe name.
If the source is already inside the asset folder, its existing path is reused.
`save_image_data` decodes clipboard bytes and writes them through the same
atomic-write helper. The asset folder setting must be a relative path and cannot
contain parent traversal or a drive prefix.

Preview never loads local files directly. `read_image_data_url` validates and
reads the asset, then returns a data URL that the sanitized preview displays.
Remote images are intentionally replaced by labelled placeholders in preview;
exported HTML keeps their original URL. Missing local assets also degrade to
placeholders. The preview lightbox is a frontend-only zoom surface and does not
modify the document.

## Extended Markdown

`src/lib/markdown.ts` owns the single markdown-it pipeline. Footnote, highlight,
subscript, superscript, and GitHub-alert behavior comes from small MIT-licensed
`@mdit` plugins. The pipeline remains HTML-disabled: raw HTML is escaped before
sanitization, and DOMPurify is the final boundary.

Heading IDs are generated during the core pass from the heading's plain inline
text, with duplicate suffixes. A later core rule replaces a `[TOC]` paragraph
with a generated contents block built from those IDs. This keeps heading links
and the table of contents stable even when headings contain links, code, or
inline math.

YAML front matter is recognized only at the first line and is hidden from the
rendered body. `src/lib/frontMatter.ts` extracts a tolerant subset of scalar
metadata and folded indented values; HTML export uses `title`, `author`,
`description`, `keywords`, and `tags` for document metadata.

Math runs through KaTeX with trust and HTML extensions disabled. Preview renders
KaTeX HTML with the bundled KaTeX CSS and fonts. HTML export instead renders
MathML, wrapped in a centered display block, so a standalone export does not
depend on local font files. Both output modes pass through DOMPurify with the
HTML and MathML profiles enabled. Link reference definitions are handled by
markdown-it itself.

Mermaid fences become a placeholder plus a collapsed source disclosure during
synchronous Markdown rendering. `src/lib/mermaid.ts` lazy-loads Mermaid only
when a placeholder exists, initializes it with strict security, HTML labels
disabled, bounded text/edges, and theme variables derived from the MarkSI
palette, then replaces the placeholder with sanitized SVG. A per-element render
token prevents stale asynchronous results from overwriting a newer theme or
document. The preview calls the same renderer after each HTML or theme change;
HTML export and rich clipboard copy render detached markup before serializing.
Failures keep the source open and show a concise error instead of breaking the
rest of the document. Plain-text copy intentionally keeps the source text.

## Editor view modes

Writing modes are frontend-only and never change the document.
`src/editor/viewModes.ts` provides two CodeMirror extensions:

- Focus mode builds line decorations for the visible viewport and marks every
  line outside the blank-line-delimited block around the selection. A line
  class dims those lines, while the active block keeps full contrast.
- Typewriter mode listens for selection and document changes, then scrolls the
  active line toward the vertical center using `coordsAtPos`. The scroll is
  applied directly instead of dispatching a transaction, avoiding update loops,
  and composition input is left alone.

`EditorPane` installs each extension through a `Compartment`, so toggling a
preference reconfigures the live editor without replacing the document or undo
history. Read-only mode uses `EditorView.editable.of(false)` plus application
guards around formatting and image insertion. Search, selection, copy, export,
and print remain available. The three mode flags live in `AppSettings` and are
persisted with the rest of the preferences.

## Typing assistance

`src/editor/smartTyping.ts` installs a single high-precedence input handler for
auto-pairing, smart punctuation, and the emoji colon trigger. The handler
returns a small edit plan rather than dispatching ad hoc changes; the same plan
functions are unit-tested with a real Markdown syntax tree. This keeps the
interaction rules independent of the WebView and makes the literal-context
boundaries explicit.

Auto pair uses CodeMirror's `closeBrackets` for brackets and quotes, plus a
Markdown-aware handler for `*`, `_`, `~`, `=`, `$`, and backticks. The handler
leaves block-leading markers literal, promotes a single empty pair to a double
pair, skips existing closing runs, avoids splitting snake_case identifiers, and
suppresses marker pairing inside code, link destinations, and front matter.

Smart punctuation is off by default. It produces curly quotes and apostrophes,
en/em dashes, and ellipses, and declines to edit code, link destinations/titles,
indented code, front matter, unmatched inline-code spans, and line-leading
dash syntax. `isLiteralContext` combines the Lezer tree with inexpensive line
checks for constructs the parser cannot recognize while they are still being
typed.

Emoji completion is provided through editor language data, so the normal
autocompletion extension owns the popup and keyboard behavior. A colon typed in
prose schedules completion explicitly; the completion source matches the alias
prefix and replaces it with Unicode. `src/editor/emojis.ts` is a curated,
dependency-free alias catalog. The three typing preferences live in
`AppSettings` and are reconfigured through a dedicated compartment.

## Interface zoom

`src/lib/zoom.ts` owns the 80%–160% bounds, 10% steps, clamping, and percentage
formatting. App startup and preference changes call Tauri's
`getCurrentWebview().setZoom(scale)`; the capability set includes
`core:webview:allow-set-webview-zoom`. If the API is unavailable, the same
effect sets a CSS `zoom` property as a fallback. The View menu, keyboard, and
Preferences slider all update the persisted `zoomLevel` setting. Editor text
size and writing-column width remain independent preferences.

## Document copy

Copy actions operate on the entire document. `src/lib/clipboardText.ts` writes
plain text through `navigator.clipboard.writeText`, with a hidden-textarea and
`execCommand("copy")` fallback for restricted WebViews.

`src/lib/clipboard.ts` builds the rendered and text representations. It runs the
sanitized Markdown pipeline twice: once with MathML for rich HTML, and once with
KaTeX HTML for plain text. The text pass skips the hidden KaTeX MathML tree to
avoid duplicated formula text, then extracts block structure from the parsed
DOM, including headings, lists, tables, task state, code, and alerts. Clipboard
HTML is therefore the same sanitized HTML surface as export, not a second
renderer.

Rich writes use a `ClipboardItem` carrying both `text/html` and `text/plain`. If
the WebView rejects the write because the document is not focused or lacks
support, MarkSI falls back to a hidden contenteditable selection and
`execCommand("copy")`; the final fallback copies the HTML source as text. App
handlers own empty-document checks, menu wiring, keyboard shortcuts, and
success toasts.

## Frontend boundaries

- `src/lib/platform.ts` is the only place that calls Tauri APIs for file IO.
  Browser builds use a file input/download fallback.
- `src/lib/quickOpen.ts` is a pure ranking module; it has no DOM or Tauri
  dependencies and is covered by unit tests.
- `src/lib/images.ts` owns image classification, path resolution, Markdown
  generation, and filename helpers; it is covered by unit tests.
- `src/lib/frontMatter.ts` owns front-matter extraction and metadata parsing; it
  is covered by unit tests.
- `src/lib/drafts.ts` owns recovery-draft serialization and validation.
- `src/lib/zoom.ts` owns zoom bounds, stepping, clamping, and percentage
  formatting; it has no DOM or Tauri dependency.
- `src/lib/mermaid.ts` owns lazy Mermaid loading, theme variables, SVG
  sanitization, and diagram hydration for preview/export/clipboard markup.
- `src/lib/clipboardText.ts` owns plain-text clipboard writes and the legacy
  fallback.
- `src/lib/clipboard.ts` owns sanitized HTML/plain-text document
  representations and rich clipboard writes.
- `src/store/useAppStore.ts` owns document and shell state.
- `src/editor/` contains editor setup, view modes, smart typing, the emoji
  catalog, and Markdown analysis helpers.
- Components never call Rust file commands directly.

## Rust boundaries

- Every filesystem command canonicalizes paths and validates access.
- Writes use a temporary file in the destination directory followed by a
  replace/rename, so a failed write does not truncate the original.
- Binary/encoding handling lives in Rust, not in the WebView.
- Image imports are limited to supported formats and 25 MB, and asset folder
  settings reject absolute and parent-traversal paths.
- No activation, account, or telemetry subsystem exists.

## Current surface (M4/M5)

Document commands: `read_document`, `write_document`, `write_export`,
`list_directory`, and `app_version`. Workspace commands:
`list_workspace_files`, `search_workspace`, and `file_modified_ms`. Image
commands: `import_image_asset`, `save_image_data`, and `read_image_data_url`.

The frontend uses Tauri's dialog plugin for open/save/folder and image-picker
dialogs plus native confirmation prompts. Files can also be dropped onto the
window; a dropped folder becomes the workspace, a supported text file opens in
the editor, and an image is imported into the current document's asset folder.
Dirty documents are guarded by the window close handler. The preferences
dialog, quick-open overlay, workspace-search panel, toast surface, image
lightbox, and draft recovery modal are all React components driven by the same
store.

The editor remains source-first. Preview, formatting, export, search, and
workspace navigation are layered on top of the same CodeMirror state. Focus,
typewriter, and read-only modes reconfigure the live editor, while document copy
actions derive their output from the same sanitized renderer as preview and
export. The document text is never round-tripped through rendered HTML.

## Future modules

- Native file watcher with debounce, replacing the current mtime poll when a
  platform watcher is available.
- SQLite session/history store for multi-window restore and local snapshots.
- Shared export pipeline and Pandoc adapter (Pandoc is invoked externally,
  never bundled).
- PlantUML lazy rendering and a worker for unusually heavy diagrams.
- Remote image caching and optional uploader integrations.
- Cross-platform print-to-PDF adapters.
