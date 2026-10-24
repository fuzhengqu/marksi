# MarkSI

**A local-first Markdown editor for Windows and Linux.**

[简体中文](README.md) | **English**

MarkSI is a free, open-source Markdown editor built with Rust and Tauri. It offers
source, editable live preview, and reading views, plus workspace search, local
images, math, and Mermaid diagrams — with your documents kept on your machine.

> Early development: features and file formats may change. Packaged installers
> are not yet available; build from source.

## Features

- **Writing views**: source, editable live preview, and reading view; focus,
  typewriter, and read-only modes; auto-pairing, smart punctuation, emoji
  completion, and find/replace.
- **Markdown**: CommonMark/GFM, tables, task lists, footnotes, table of contents,
  YAML front matter, callouts, syntax highlighting, KaTeX math, Mermaid
  diagrams, and strict/lax heading, nested-list, continuation, and quoted-list
  indentation.
- **Files and workspace**: open, save, save as, folder workspace, recent files,
  outline, quick open, full-text search, an optional flat file list, pinned
  files and folders, workspace rename, duplicate, move, and delete, plus local
  history snapshots that can be previewed and restored; preserves encoding and
  line endings.
- **Images**: insert, drag and drop, or paste; document-relative assets and an
  optional root path; lightbox; width and height resizing; contain/cover fit and
  original-size reset.
- **Export and copy**: standalone HTML with document, print, minimal, or custom
  profiles; front matter metadata and page setup controls; print or save as PDF
  through the system print dialog; an optional user-configured export command
  that runs without a shell; PNG image export; optional Pandoc export to DOCX,
  ODT, EPUB, LaTeX, or RTF and import from DOCX, ODT, EPUB, RTF, or HTML
  (Pandoc is not bundled); copy as Markdown, HTML, or plain text.
- **Reliability**: optional autosave for named documents, unsaved-work recovery,
  and external-change notices.
- **Interface**: Chinese and English, built-in light and dark themes, and
  interface zoom.
- **Privacy**: no account and no telemetry; documents stay on your machine; raw
  HTML is not executed; remote images are off by default, cached locally only
  when enabled, and can be cleared at any time; images are never uploaded.

## Requirements

- **Runtime**: Windows 11 (WebView2), or Linux (WebKitGTK 4.1).
- **Build**: Node.js 22.12+, npm, and Rust stable. On Windows, Visual Studio 2022
  Build Tools with the "Desktop development with C++" workload and the Windows
  SDK. On Linux, the usual Tauri dependencies.

## Install and run

Only source builds are available at this time:

```bash
npm install
npm run tauri:dev
```

Build a release:

```bash
npm run tauri:build
```

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
