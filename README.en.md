# MarkSI

**A local-first Markdown editor for Windows and Linux.**

[简体中文](README.md) | **English**

MarkSI is a free, open-source Markdown editor built with Rust and Tauri. It offers
source, editable live preview, and reading views, plus workspace search, local
images, math, and Mermaid diagrams — with your documents kept on your machine.

> Early development: features and file formats may change. No official download
> is published yet; a source build can produce unsigned Windows MSI/NSIS
> installers locally.

## Features

- **Writing views**: source, editable live preview, and reading view; focus,
  typewriter, and read-only modes; auto-pairing, smart punctuation, emoji
  completion, IME composition support, and find/replace; inline images, heading
  hierarchy, block quotes and rules, GitHub alert cards, code block cards with
  language badges and copy buttons, table rendering, front matter cards, math
  formulas, Mermaid diagrams with source-copy actions, unordered and ordered
  list markers, clickable task checkboxes, Ctrl+Click link opening or heading
  jumps, footnote reference jumps, footnote definition cards, local
  Markdown/text links with heading fragments in the live preview, and code-block
  copy buttons in the reading view. Automatic or explicit LTR/RTL document
  direction keeps code and math LTR.
- **Markdown**: CommonMark/GFM, tables, task lists, footnotes, table of contents,
  YAML front matter, callouts, syntax highlighting, KaTeX math, Mermaid
  diagrams, and strict/lax heading, nested-list, continuation, and quoted-list
  indentation.
- **Files and workspace**: open, save, save as, folder workspace, recent files,
  outline, quick open, full-text search, an optional flat file list, pinned
  files and folders, workspace rename, duplicate, move, and delete, plus local
  history snapshots that can be previewed and restored; preserves encoding and
  line endings, can reopen files as UTF-8, GB18030, GBK, Big5, and other
  encodings, restores the last document and folder at startup, and reduces
  live-preview work for large documents; large reading views show a character
  count and wait for confirmation before rendering.
- **Images**: insert, drag and drop, or paste; document-relative assets and an
  optional root path; lightbox; inline local images in the editable live
  preview with click-to-edit source; width and height resizing; contain/cover
  fit and original-size reset.
- **Export and copy**: standalone HTML with document, print, minimal, or custom
  profiles; front matter metadata and page setup controls; print or save as PDF
  through the system print dialog; an optional user-configured export command
  that runs without a shell; PNG image export; optional Pandoc export to DOCX,
  ODT, EPUB, LaTeX, or RTF and import from DOCX, ODT, EPUB, RTF, or HTML
  (Pandoc is not bundled); copy as Markdown, HTML, or plain text.
- **Reliability**: optional autosave for named documents, unsaved-work recovery,
  and external-change notices.
- **Interface**: Simplified Chinese, Traditional Chinese, and English; the
  first launch follows the system language and later launches remember the
  choice; system-following or fixed light/dark/
  sepia/high-contrast appearance, local CSS themes, customizable application
  shortcuts, advanced JSON settings, multiple document windows, fullscreen and
  always-on-top, keyboard-accessible dialogs and sidebar, an optional native
  title bar, and interface zoom.
- **Privacy**: no account and no telemetry; documents stay on your machine; raw
  HTML is not executed; remote images are off by default, cached locally only
  when enabled, and can be cleared at any time; images are never uploaded.

## Requirements

- **Runtime**: Windows 11 (WebView2), or Linux (WebKitGTK 4.1).
- **Build**: Node.js 22.12+, npm, and Rust stable. On Windows, Visual Studio 2022
  Build Tools with the "Desktop development with C++" workload and the Windows
  SDK. On Linux, the usual Tauri dependencies.

## Install and run

Official downloads are published on
[GitHub Releases](https://github.com/fuzhengqu/marksi/releases). Milestone
versions include installers and checksums; routine versions only create a
version tag. You can also run from source:

```bash
npm install
npm run tauri:dev
```

Build a release:

```bash
npm run tauri:build
```

On Windows this writes MSI and NSIS installers under
`src-tauri/target/release/bundle/`. The NSIS `setup.exe` is the recommended
single download: one file contains English, Simplified Chinese, and Traditional
Chinese installer translations and follows the operating-system language. The
MSI targets enterprise deployment; its filename is language-neutral
(`MarkSI_<version>_x64.msi`), its installer UI is `en-US`, and it installs the
same three-language application. The artifacts are currently unsigned, so
Windows may show a SmartScreen warning. After installation, open Markdown files
through the registered file association or run
`marksi path\to\note.md` from a terminal. Run `npm run release:checksums` to
write `SHA256SUMS.txt` beside the bundle tree.

On Linux the same directory receives deb, rpm, and AppImage bundles. Flatpak
metadata lives under `flatpak/`: run `npm run flatpak:stage`, then build with
`flatpak-builder`. The Flatpak workflow generates and inspects an unsigned
`.flatpak` bundle in CI.

## Development

Run `npm test` for unit tests. Please open an issue before larger changes; see
[CONTRIBUTING.md](CONTRIBUTING.md) for the full check workflow.

## Contributing

Issues and pull requests are welcome:
[Issues](https://github.com/fuzhengqu/marksi/issues).

## Security

Report vulnerabilities privately through
[GitHub Security Advisories](https://github.com/fuzhengqu/marksi/security/advisories/new).
Do not include sensitive details in a public issue. See [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Repository: <https://github.com/fuzhengqu/marksi>
