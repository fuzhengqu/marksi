# MarkSI

**A focused Markdown studio for Windows and Linux.**

[简体中文](README.md) | **English**

MarkSI is a free, open-source Markdown editor built with Rust and Tauri. It is
designed around a calm, single-document writing surface: a slim title bar, a
collapsible file/outline/search sidebar, a centered source editor, and a quiet
status bar.

> Status: MVP (M4, M5 in progress). The desktop shell, source editor, editable
> live preview, reading view, bilingual Chinese/English interface, file
> open/save, encoding-aware IO, workspace browser, outline, search, themes,
> extended Markdown, Mermaid diagrams, local image assets, image resizing,
> formatting commands, find/replace, HTML/PDF export, writing modes, smart
> typing, interface zoom,
> document copy actions, preferences, quick open, workspace full-text search,
> autosave, crash recovery, and external-change detection are implemented. See
> `docs/feature-parity.md` for the roadmap.

## Versioning

The product display version starts at **0.01** and increases by exactly one
step for each bug-fix or feature release: `0.02`, `0.03`, and so on. Versions
must not be skipped. npm, Cargo, and Tauri require semver, so the technical
release `0.1.0` maps to the product version `0.01`, `0.2.0` maps to `0.02`, and
the About dialog displays the product version.

Before a release, run:

```bash
npm run version:bump
```

The command updates all manifests by one step and refuses malformed version
states. The publication audit also rejects version-file mismatches and skipped
steps.

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
- [markdown-it-attrs](https://github.com/arve0/markdown-it-attrs) — constrained image-width attributes
- [KaTeX](https://katex.org/) — inline and display math
- [Mermaid](https://mermaid.js.org/) — lazy-loaded diagrams in preview and export
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

- Source, editable live-preview, and reading modes. Opened documents and new
  blank documents start in editable live preview; `Ctrl+/` or the status bar
  toggles source and live preview, and View > Reading view opens the fully
  rendered, read-only surface. Switching modes keeps the CodeMirror document
  and undo history in place.
- The live preview keeps the CodeMirror document editable while hiding
  formatting punctuation on inactive lines. The active line shows its Markdown
  source, and images/links/emphasis remain based on the same canonical text.
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

- Preferences for language, theme, editor text size, writing-column width,
  spell check, opt-in autosave, and the autosave pause. Preferences persist
  locally and apply immediately.
- Chinese (`zh-CN`) is the default interface language; English is available in
  Preferences > Appearance. The choice applies to the application chrome,
  menus, dialogs, status bar, and editor search panel.
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
- Strict mode is enabled by default and requires whitespace after ATX heading
  markers. Disable it to accept compact headings such as `###Title`; fenced
  code, front matter, and source text remain unchanged.

M4 also adds writing modes and document copy actions:

- Focus mode dims everything except the current paragraph, and typewriter mode
  keeps the active line vertically centered while writing. Both are available
  from the View menu and Preferences.
- Read-only mode blocks edits, formatting, and image insertion while keeping
  selection, search, copy, export, and print available. The status bar shows a
  read-only badge.
- Copy the entire document from the Edit menu or keyboard as Markdown, rich
  HTML, or plain text. Markdown preserves the source apart from platform
  newline normalization; HTML is derived from the sanitized renderer with
  MathML; plain text keeps headings, paragraphs, lists, tables, task state, and
  code.
- Writing-mode preferences persist locally. Shortcuts: `Ctrl+Alt+F` focus,
  `Ctrl+Alt+T` typewriter, `Ctrl+Alt+R` read-only, `Ctrl+Alt+C` Markdown,
  `Ctrl+Alt+H` HTML, and `Ctrl+Alt+P` plain text.

M4 also adds typing assistance and interface zoom:

- Auto pair closes brackets, quotes, and Markdown emphasis markers. A second
  marker promotes a single pair to a double pair; typing before an existing
  closing run moves over it instead of duplicating it. Line-leading block
  syntax stays literal so lists, rules, fences, and front matter remain easy to
  type. The behavior can be disabled in Preferences.
- Opt-in smart punctuation converts quotes, apostrophes, double/triple
  hyphens, and three periods to curly quotes, en/em dashes, and ellipses. It
  skips code, link destinations and titles, YAML front matter, and
  line-leading Markdown syntax.
- Emoji autocomplete suggests common `:shortcode:` aliases and inserts the
  Unicode emoji directly. It is dependency-free, never changes the renderer,
  and can be disabled in Preferences.
- Interface zoom scales the whole window from 80% to 160% with `Ctrl+=`,
  `Ctrl+-`, `Ctrl+0`, the View menu, or Preferences > Appearance. The level
  persists across launches.

The interface and writing flow also include:

- An IDEA-style menu bar. The hamburger reveals File, Edit, Format, View, and
  Help in its own space: File takes over the hamburger position and the other
  labels follow to the right. Clicking a category opens that dropdown; moving
  across the bar switches categories while a dropdown is open. Clicking blank
  space closes the bar and restores the hamburger. Export, Preferences, and
  Quit live under File.
- The empty workspace exposes Open file, Open folder, Quick open, and New
  document above Recent files. The bottom action row is removed entirely.
- Recent file rows reveal a remove button on hover or keyboard focus; it removes
  only that entry. File > Clear recent files empties the whole list.
- MarkSI opens directly into the editable live-preview surface; there is no
  full-screen welcome page. An empty document keeps the editor prompt and is
  ready for typing immediately.
- New-document actions clear the editor, focus the blank editor, and show a
  confirmation toast so the transition is unambiguous.
- Saving a new document suggests its first level-one heading as the filename;
  documents without an H1 keep the localized untitled name. Existing documents
  retain their filename for Save As.
- A Chinese-first interface with an English option, and a live-preview editing
  mode that keeps Markdown source canonical.

M5 begins with Mermaid diagrams:

- Fenced code blocks with the `mermaid` language render as diagrams in preview.
  The diagram library is loaded lazily on first use, so documents without
  diagrams do not pay its startup cost.
- Diagrams follow the light and dark themes and re-render when the appearance
  changes. A collapsed source disclosure beneath each diagram keeps the
  fenced source available.
- Syntax errors show a concise error with the source expanded instead of
  breaking the preview.
- Standalone HTML export, rich HTML copy, and print keep rendered diagrams.
  Plain-text copy retains the Mermaid source.
- Mermaid runs with strict security, HTML labels disabled, and bounded text and
  edge counts. Its SVG output is sanitized with a dedicated SVG profile before
  insertion; scripts and foreign objects are rejected.

M5 also adds image context actions:

- Right-click a loaded local image to view it at full size, copy its absolute
  path, open it in the default application, or reveal it in the system file
  manager.
- The menu positions itself inside the window, closes on outside click,
  Escape, scroll, or resize, and never opens over placeholders or remote
  images.
- Local image actions use the resolved asset path; pasted data-URL images keep
  the lightbox action only.

M5 also adds image resizing:

- Image dimensions use the canonical Markdown form
  `![alt](image.png){width=320 height=180}`. Width and height are validated as
  24–1600 px; width-only images preserve their aspect ratio.
- In reading view, hover or focus a loaded image to reveal width and height
  handles. Drag horizontally or use Left/Right for width; drag vertically or
  use Up/Down for height. The source is updated only when the gesture ends, as
  one undoable editor transaction.
- Resizing is disabled in read-only mode, does not appear for footnote images,
  and is rejected when the source image cannot be identified unambiguously.
  Fenced code, inline code, YAML front matter, and reference definitions cannot
  shift the target image.
- HTML export, rich clipboard HTML, and print preserve width and height
  attributes.

Raw HTML remains escaped and inert, unsafe URLs are rejected, and remote images
are never fetched by the preview renderer. Math rendering disables KaTeX's
trust and HTML-extension features. Mermaid runs with strict security, no HTML
labels, bounded input, and a second SVG sanitization pass. Clipboard HTML is
produced by the same sanitized rendering pipeline. Draft recovery stores its snapshot in WebView
`localStorage` and never transmits document content.

## Development

### Prerequisites

- Node.js 22.12+ and npm
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
npm run test:e2e
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

`npm run test:e2e` requires a running dev app with remote debugging enabled. The
complete gate, coverage matrix, and known native-dialog limitations are
documented in [`docs/verification.md`](docs/verification.md).

For UI inspection against the running desktop webview, start the app with
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222` and use
`node scripts/cdp-eval.mjs "<expression>"` or
`node scripts/cdp-screenshot.mjs <output.png>`. If port 9222 is unavailable on
your machine, choose another port and point the helpers at it with
`MARKSI_CDP_PORT=9223`. These helpers are development tools only and are not part
of the packaged app.

## Publication audit

Run the public-repository audit before every push:

```bash
npm run audit:public
```

The audit scans the working tree, every reachable Git commit, and commit
messages for credentials and tokens, private-key markers, local user paths,
forbidden branding/copying wording, tracked secret files, and copyleft
dependencies. It also verifies that the Chinese and English README files exist
and that the project license is present.

Enable the repository hook once per clone so local pushes run the same check:

```bash
git config core.hooksPath .githooks
```

The GitHub Actions workflow also runs the audit on every push and pull request.

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

## Security and publication hygiene

No account credentials, API keys, private keys, local user paths, build output,
or dependency folders are committed. The public audit is a verification gate,
not a claim that arbitrary source code has no vulnerabilities. Report security
concerns privately to the repository owner rather than opening a public issue
with sensitive details.

## License

MIT. See [LICENSE](LICENSE).

MarkSI is an independent project. It is not affiliated with any other editor.
Third-party dependencies keep their own licenses. The repository does not
include proprietary third-party source code, themes, icons, translations, or
branding.
