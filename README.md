# MarkSI

**A focused Markdown studio for Windows and Linux.**

MarkSI is a free, open-source Markdown editor built with Rust and Tauri. It is
designed around a calm, single-document writing surface: a slim title bar, a
collapsible file/outline/search sidebar, a centered source editor, and a quiet
status bar.

> Status: MVP (M4). The desktop shell, source editor, file open/save,
> encoding-aware IO, workspace browser, outline, search, themes, rendered
> preview, extended Markdown, local image assets, formatting commands,
> find/replace, HTML/PDF export, preferences, quick open, workspace full-text
> search, autosave, crash recovery, and external-change detection are
> implemented. See `docs/feature-parity.md` for the roadmap.

## Principles

- **Markdown is the source of truth.** MarkSI never rewrites your document
  through a lossy rich-text serializer.
- **Free and open source.** MIT licensed, no activation, no account, no
  telemetry, no paid feature gates.
- **Local first.** Files stay on your machine. Network access is only used for
  explicit actions such as opening a link or downloading an image.
- **Calm by default.** The interface gets out of the way; chrome is minimal and
  keyboard-first.

## Stack

- [Tauri 2](https://tauri.app/) — Rust application shell
- [React 19](https://react.dev/) + TypeScript + Vite
- [CodeMirror 6](https://codemirror.net/) — editor foundation
- [markdown-it](https://github.com/markdown-it/markdown-it) + [DOMPurify](https://github.com/cure53/DOMPurify) — sanitized Markdown rendering
- [KaTeX](https://katex.org/) — inline and display math
- [highlight.js](https://highlightjs.org/) — curated code highlighting
- Rust core for file IO, encoding detection, and platform integration

## What works

M1 established the desktop foundation:

- Native open, save, save-as, open-folder, and recent-file flows.
- UTF-8, UTF-16, and legacy encoding detection with BOM and CRLF/LF preservation.
- Atomic saves that do not truncate the existing file on failure.
- Markdown source editing with CodeMirror 6, syntax highlighting, line wrapping,
  undo/redo, bracket matching, and inline search.
- File tree, document outline navigation, in-document search, and recent files.
- Original light and dark themes, custom title bar, window controls, and close
  protection for unsaved changes.
- Browser preview fallback for UI work (native file system features require Tauri).

M2 adds the reading and formatting workflow:

- Source and rendered preview modes, toggled with `Ctrl+/` or the status bar.
  Switching modes keeps the CodeMirror document and undo history in place.
- Sanitized CommonMark/GFM rendering with tables, task lists, strikethrough,
  autolinks, heading anchors, and lazy-loaded syntax highlighting for common
  languages.
- Formatting for bold, italic, strikethrough, inline code, links, and heading
  levels through shortcuts and the application menu.
- Source find/replace with `Ctrl+F` and `Ctrl+H`.
- Standalone HTML export using the same sanitized renderer, plus print and
  save-as-PDF through the system print dialog.
- Automatic layout and print styles for light, dark, and narrow windows.

M3 adds the workspace and reliability layer:

- Preferences for theme, editor text size, writing-column width, spell check,
  opt-in autosave, and the autosave pause. Preferences persist locally and apply
  immediately.
- Quick open (`Ctrl+P`) across recent files and the current workspace, with
  fuzzy ranking, path context, and arrow-key navigation.
- Workspace full-text search with optional case matching, line/column results,
  match previews, and open-at-line navigation. The Rust indexer skips hidden
  folders, dependency/build output, and common VCS folders.
- Autosave for named documents, disabled by default. Unsaved work is always
  mirrored to a local recovery draft; after an unexpected exit, MarkSI offers to
  recover or discard it on the next launch.
- External-change detection through lightweight modification-time polling.
  Clean documents reload automatically; dirty documents show a conflict warning
  and keep the local edits.
- Spell-check control for the source editor.
- Workspace indexing, search, and modification-time queries run in Rust instead
  of scanning the WebView.

M4 adds the local image workflow:

- Insert an image from disk with `Ctrl+Shift+I` or the application menu. The
  file is copied into a document-relative asset folder with a collision-safe
  name.
- Drag and drop image files onto the window, or paste an image from the
  clipboard; both flows use the same asset pipeline.
- Configure the asset folder under Preferences > Images. Absolute paths and
  paths that traverse outside the document folder are rejected.
- Preview local PNG, JPEG, GIF, WebP, BMP, SVG, AVIF, and ICO images up to 25 MB.
  Rust reads the asset and supplies a data URL to the WebView.
- Click a rendered image to open the lightbox. Zoom from 50% to 400% with the
  toolbar, `+`, `-`, and `0`; `Esc` closes it.
- Missing local images and remote images render as labelled placeholders in
  preview. HTML export keeps relative asset paths and remote URLs.

M4 also adds extended Markdown:

- Footnotes with `[^label]` definitions, inline `^[note]` notes, repeated
  references, and backlinks.
- `[TOC]` expands to a linked contents block generated from the document
  headings. Headings receive stable, duplicate-safe anchors.
- YAML front matter at the very top of a document is hidden from preview. Its
  `title`, `author`, `description`, `keywords`, and `tags` fields become
  metadata in standalone HTML exports.
- GitHub-style alerts (`> [!NOTE]`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`)
  render as labeled callouts.
- `==highlight==`, `~subscript~`, and `^superscript^` render with theme-aware
  styles.
- Inline `$...$` and display `$$...$$` math render through KaTeX. Preview uses
  KaTeX HTML and bundled fonts; HTML export uses MathML so the exported file
  does not depend on local font assets.
- Link reference definitions such as `[label]: https://example.com` work across
  the document.

Raw HTML remains escaped and inert, unsafe URLs are rejected, and remote images
are never fetched by the preview renderer. Math rendering disables KaTeX's
trust and HTML-extension features. Draft recovery stores its snapshot in
WebView `localStorage` and never transmits document content.

## Development

### Prerequisites

- Node.js 22+ and npm
- Rust stable (MSVC toolchain on Windows)
- Windows: Visual Studio 2022 Build Tools with the **Desktop development with
  C++** workload and Windows SDK
- Linux: WebKitGTK 4.1 and the usual Tauri Linux dependencies

### Run

```bash
npm install
npm run tauri:dev
```

For UI-only work in a browser:

```bash
npm run dev
```

The browser build falls back to a local file picker; native dialog and file
system integration require Tauri.

### Build

```bash
npm run tauri:build
```

### Checks

```bash
npm run typecheck
npm test
npm run build
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

For UI inspection against the running desktop webview, start the app with
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222` and use
`node scripts/cdp-eval.mjs "<expression>"` or
`node scripts/cdp-screenshot.mjs <output.png>`. If port 9222 is unavailable on
your machine, choose another port and point the helpers at it with
`MARKSI_CDP_PORT=9223`. These helpers are development tools only and are not part
of the packaged app.

## Project layout

```text
src/                 React application
src/components/      Shell, sidebar, editor, status bar, dialogs
src/editor/          CodeMirror setup, theme, Markdown helpers
src/lib/             Tauri and browser platform adapters
src/store/           Application state
src-tauri/           Rust/Tauri application
docs/                Product and engineering notes
```

## License

MIT. See [LICENSE](LICENSE).

MarkSI is an independent project. It is not affiliated with any other
editor. Third-party dependencies keep their own licenses.
