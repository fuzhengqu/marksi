# Contributing to MarkSI

Thanks for helping improve MarkSI. This document is for developers; user-facing
documentation lives in the README.

## Setup

Prerequisites:

- Node.js 22.12+ and npm
- Rust stable
- Windows: Visual Studio 2022 Build Tools with the Desktop development with C++
  workload and the Windows SDK
- Linux: WebKitGTK 4.1 and the usual Tauri dependencies

Install dependencies and start the app:

```bash
npm install
npm run tauri:dev
```

## Verification gate

Every change must pass the complete gate before it is considered complete:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
npm run audit:public
```

The E2E suite drives the real Tauri WebView over CDP. Start the dev app with
remote debugging enabled, then run the suite with matching origin/port values:

```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222"
npm run tauri:dev
```

```powershell
$env:MARKSI_E2E_ORIGIN = "localhost:1420"
$env:MARKSI_CDP_PORT = "9222"
npm run test:e2e
```

The suite creates temporary fixtures under `.tmp/e2e-fixtures` and removes them
afterward. It does not modify user documents.

## Testing expectations

- Pure functions and parser changes need Vitest coverage.
- Filesystem, encoding, image, and workspace changes need Rust tests.
- User-visible flows need a real-WebView E2E check.
- Fixed bugs should get a regression test that would have caught them.
- Native OS dialogs, OS drag-and-drop, and final window quit are documented
  manual release checks in `docs/verification.md`.

## Publication audit

Run `npm run audit:public` before pushing. The audit covers the working tree,
all local commits, commit messages, credentials, tokens, private-key markers,
local user paths, forbidden branding/copying wording, secret file names, and
copyleft dependencies. It also verifies the bilingual README files and MIT
license.

Enable the repository hook once per clone:

```bash
git config core.hooksPath .githooks
```

GitHub Actions also runs the audit on every push and pull request.

## Versioning

Product versions start at `0.01` and increase by exactly one step for each
user-visible feature or bugfix release. npm, Cargo, and Tauri require semver, so
`0.1.0` displays as `0.01`, `0.2.0` as `0.02`, and so on. Run:

```bash
npm run version:bump
```

The command updates all manifests and lockfiles by one step. Do not skip a
version step. Documentation-only changes do not require a version bump.

## Project layout

```text
src/                 React application
src/components/      Shell, sidebar, editor, status bar, dialogs
src/editor/          CodeMirror setup, theme, Markdown helpers
src/lib/             Tauri and browser platform adapters
src/store/           Application state
src-tauri/           Rust/Tauri application
docs/                Engineering and product notes
```

## Pull requests

- Keep changes focused and explain user-visible behavior.
- Update tests and documentation with the implementation.
- Do not commit credentials, local paths, generated build output, or dependency
  folders.
- Keep the Markdown source as the canonical document model.
- Report security issues privately through GitHub Security Advisories.
