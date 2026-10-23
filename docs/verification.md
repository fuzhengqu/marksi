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

Image resizing supports width and height but not fit modes such as contain or
cover. Drag resizing in the text-first live-preview surface and image HTML blocks
are not implemented or claimed. Automated coverage of image sizing uses local
fixture assets; native image picker and OS file dialogs remain in the manual
release checklist.

## Current automated coverage

The E2E suite currently covers:

- Chinese-first boot directly into the editor, document title, empty prompt,
  focus, and preview default.
- Sidebar workspace actions and absence of the old footer.
- Compact menu-bar replacement, category bar, blank-click close, File contents,
  Quit placement, and absent menu footer.
- About dialog close behavior and display of the `0.10` product version.
- New-document transition, focus, and toast.
- New-document save dialog default names from the first H1 and the untitled
  fallback. The test suite replaces only the native dialog boundary so the
  complete save/write flow still runs.
- Opening a Markdown fixture in editable live preview.
- Live-preview editing, hidden inactive markers, and source retention.
- Chinese CodeMirror search panel and Escape dismissal.
- Source / live-preview / reading mode transitions.
- Strict mode on/off behavior for compact ATX headings, lax nested list marker
  indentation, under-indented continuation paragraphs, and quoted lists,
  including the Preferences toggle.
- Chinese settings, language switch to English and back.
- Export dialog profile switching, front matter toggles, page setup, and the
  real HTML write. The test replaces only the native save-dialog boundary and
  verifies escaped metadata, localized document info, `@page` size/margins,
  header/footer tokens, persisted options, and source retention.
- Custom export with a configured executable: HTML save, placeholder expansion,
  execution in the export folder, marker-file verification, success toast, and
  source retention. The test uses the platform shell only as a controlled test
  program; MarkSI itself launches executors without a shell.
- PNG image export from the reading view: signature and IHDR dimensions, decoded
  pixel diversity (not a blank canvas), native save-dialog filter, source
  retention, and reading-view transition.
- Pandoc export with the portable Pandoc 3.12.1 executable: version detection,
  real DOCX conversion, ZIP signature and `word/document.xml`, save-dialog
  filter, source retention, and persisted executable path. The check runs only
  when `.tmp/pandoc/portable/pandoc-3.12.1/pandoc.exe` is present and is skipped
  otherwise; the manual checklist covers a fresh external install.
- Pandoc import of a real DOCX containing a local image: conversion, image
  data-URL embedding, unsaved dirty document state, source name, import filter,
  and rendered image in reading view.
- Pandoc detection from Preferences, including the reported version.
- Mermaid rendering in reading mode, including SVG sanitization checks.
- Auto pairing, smart punctuation, and emoji completion.
- Local image context menu and lightbox action.
- Image width/height attributes, width and height drag handles, contain/cover
  fit controls with original-size reset, reference-style image drag, undo/redo
  of resize transactions, code-fence safety, and read-only suppression of
  resize handles.
- Recent-file hover remove button and File > Clear recent files.
- Zoom shortcut and reset behavior.
- Final cleanup and removal of fixture paths from recent files.
- Version consistency across npm, Cargo, Tauri, and lockfiles, plus rejection of
  skipped release steps during the publication audit.

Vitest covers formatting, smart typing, emoji catalogs, i18n, version display
formatting, zoom math, strict-heading and lax-list normalization (including
continuations, quotes, code safety, and CRLF), front-matter parsing, save-name
extraction/sanitization, image helpers, image-source scanning
and width/height/fit handling, export profiles and page CSS, metadata escaping,
custom-export argument parsing/expansion, PNG naming and capture-scale limits,
Pandoc format metadata plus export/import filenames, minimal text-change
calculation, quick-open ranking, and analysis helpers.
Rust tests cover encoding/BOM/CRLF round trips, atomic text and binary writes,
image import and data URLs, workspace listing/search, file timestamps,
custom-command validation, successful/non-zero execution, missing executables,
working-directory handling, Pandoc argument construction, format allowlisting,
bounded process-output capture, media path validation, percent-decoded paths,
and media embedding limits.

## Limits and native-dialog checks

Some operating-system dialogs cannot be driven reliably through CDP alone:
native open/save/folder/image pickers, print/PDF dialogs, drag-and-drop from the
OS shell, external browser launches, and the final Quit action. Their underlying
file and image logic is covered by Rust tests and by dev-hook/E2E flows where
possible. GitHub Actions currently runs the publication audit only; the full
Windows/Linux build-and-test CI matrix remains open under M0. The save-name E2E replaces the native dialog boundary and verifies the
default filename plus the real write; the exact native dialog text remains a
manual release check. Before a release build, the native-dialog checklist must still be
exercised on Windows and Linux. Print/PDF pagination, including CSS margin-box
headers and footers, depends on the platform print engine; automated tests cover
the generated CSS, not the final paginated output. The native print preview must
be checked manually on each supported platform. Custom export runs only
user-configured external programs; MarkSI does not bundle or verify those tools,
so their output remains the user's responsibility. The 60-second timeout covers
the launched process; child processes it starts may outlive it and are outside
MarkSI's control. Only configure trusted executables. PNG capture depends on the
WebView canvas/SVG pipeline; documents that exceed the readable canvas scale are
rejected, and very large documents should be checked manually before release.
Pandoc is not bundled, is GPL-2.0-or-later as a separate program, and may fetch
remote images referenced by the document. The real Pandoc E2E uses a portable
executable under `.tmp`; on a fresh machine install Pandoc separately and run the
manual DOCX/EPUB check. Imported images are inlined as data URLs, which can make
the Markdown source large; very large imported documents should be checked
manually for memory and save-size behavior. PDF import/export is not offered
because it requires an additional PDF engine.

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
