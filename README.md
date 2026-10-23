# MarkSI

**A focused Markdown studio for Windows and Linux.**

MarkSI is a free, open-source Markdown editor built with Rust and Tauri. It is
designed around a calm, single-document writing surface: a slim title bar, a
collapsible file/outline/search sidebar, a centered source editor, and a quiet
status bar.

> Status: early MVP (M1). The desktop shell, source editor, file open/save,
> encoding-aware IO, workspace browser, outline, search, and light/dark themes are
> implemented. Live preview, formatting shortcuts, find/replace UI, and export
> follow in M2. See `docs/feature-parity.md` for the roadmap.

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
- Rust core for file IO, encoding detection, and platform integration

## What works in M1

- Native open, save, save-as, open-folder, and recent-file flows.
- UTF-8, UTF-16, and legacy encoding detection with BOM and CRLF/LF preservation.
- Atomic saves that do not truncate the existing file on failure.
- Markdown source editing with CodeMirror 6, syntax highlighting, line wrapping,
  undo/redo, bracket matching, and inline search.
- File tree, document outline navigation, in-document search, and recent files.
- Original light and dark themes, custom title bar, window controls, and close
  protection for unsaved changes.
- Browser preview fallback for UI work (native file system features require Tauri).

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
cargo test --manifest-path src-tauri/Cargo.toml
```

For UI inspection against the running desktop webview, start the app with
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222` and use
`node scripts/cdp-eval.mjs "<expression>"` or
`node scripts/cdp-screenshot.mjs <output.png>`. These helpers are development
tools only and are not part of the packaged app.

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
