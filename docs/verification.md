# Verification and delivery gate

MarkSI uses a repeatable test gate before a change is considered complete. A
feature is not “done” because it works once by hand; it needs automated coverage
for every path that can reasonably be automated, plus a clean full regression
run.

## Required checks

Run from the repository root:

```bash
npm run typecheck
npm test
npm run build

cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml

npm run test:e2e
```

`npm run test:e2e` drives the real Tauri WebView through Chrome DevTools
Protocol. It needs a running development app with remote debugging enabled:

```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222"
npm run tauri:dev
```

Then, in another terminal:

```powershell
npm run test:e2e
```

For a different dev origin/CDP port, set:

```powershell
$env:MARKSI_E2E_ORIGIN = "localhost:1420"
$env:MARKSI_CDP_PORT = "9222"
```

The E2E suite creates temporary fixtures under `.tmp/e2e-fixtures`, resets the
running app between checks, and removes the fixtures at the end. It does not
modify user documents.

## Definition of done

A change is deliverable only when all of these are true:

1. Pure logic and parsing changes have Vitest coverage.
2. Rust file/workspace/image behavior has Rust tests.
3. UI flows touched by the change have an E2E check, not just a screenshot.
4. Every regression fixed during development has a test that would have caught
   it.
5. `npm run typecheck`, `npm test`, `npm run build`, Rust format/tests, and
   `npm run test:e2e` all pass.
6. The running app is reset to a clean state and the user document hash is
   checked when the task touched files.
7. Known limitations are recorded rather than presented as verified.

## Current automated coverage

The E2E suite currently covers:

- Chinese-first boot, document title, welcome screen, and preview default.
- Sidebar workspace actions and absence of the old footer.
- IDEA-style menu replacement, category bar, blank-click close, File contents,
  Quit placement, and absent menu footer.
- About dialog close behavior.
- New-document transition, welcome dismissal, focus, and toast.
- Opening a Markdown fixture in editable live preview.
- Live-preview editing, hidden inactive markers, and source retention.
- Chinese CodeMirror search panel and Escape dismissal.
- Source / live-preview / reading mode transitions.
- Chinese settings, language switch to English and back.
- Mermaid rendering in reading mode, including SVG sanitization checks.
- Auto pairing, smart punctuation, and emoji completion.
- Local image context menu and lightbox action.
- Zoom shortcut and reset behavior.
- Final cleanup and removal of fixture paths from recent files.

Vitest covers formatting, smart typing, emoji catalogs, i18n, zoom math,
front-matter parsing, image helpers, quick-open ranking, and analysis helpers.
Rust tests cover encoding/BOM/CRLF round trips, atomic writes, image import and
data URLs, workspace listing/search, and file timestamps.

## Limits and native-dialog checks

Some operating-system dialogs cannot be driven reliably through CDP alone:
native open/save/folder/image pickers, print/PDF dialogs, drag-and-drop from the
OS shell, external browser launches, and the final Quit action. Their underlying
file and image logic is covered by Rust tests and by dev-hook/E2E flows where
possible. Before a release build, the native-dialog checklist must still be
exercised on Windows and Linux.

No finite test suite can prove the absence of every bug. The gate guarantees
that all listed automated paths pass and that no known reproducible failure is
being delivered. “Zero known failures” is the release standard; “mathematically
zero defects” is not a claim that can be honestly made.

## Bug workflow

1. Reproduce the bug with a failing automated check when possible.
2. Fix the smallest responsible path.
3. Re-run the focused check and the full gate.
4. Keep the regression check in the repository.
5. Do not start the next feature while the gate is red.
