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
- About dialog close behavior and display of the `0.38` product version.
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
- System appearance: emulated dark and light system preferences update the
  resolved theme live, an explicit Dark choice ignores the system preference,
  the five theme options are present, and system mode can be restored.
- Additional themes: selecting Sepia applies its documented background and
  theme-color, and selecting High contrast applies its black/white token pair
  and theme-color.
- Application shortcuts: rebind Toggle sidebar to Ctrl+Alt+N, verify the label
  and persistence across a full reload, reject Ctrl+O as a conflict, reset the
  defaults, and trigger the custom binding to hide the sidebar.
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
- Remote image opt-in: placeholders remain while disabled, enabling replaces
  them with a cached data URL, and disabling restores placeholders. The E2E
  loader is a test seam; real fetching is covered by Rust WinHTTP tests.
- Image root path: a document in a subfolder resolves `/icon.png` from the
  configured root, while the source Markdown remains unchanged.
- Image root URL: a missing local relative image falls back to the configured
  URL base through the remote cache, and disabling remote loading restores the
  placeholder.
- Flat file list: a nested workspace fixture shows only folders in tree mode,
  then exposes top-level and nested files with relative paths when enabled,
  with no folder rows.
- Pinned locations: a file and a folder are pinned from the row menu, the file
  pin opens the document, the folder pin switches the workspace, both survive a
  full reload, and unpinning removes them. Renaming or deleting a pinned file
  updates or removes the pin.
- Workspace file actions: an invalid rename is blocked without touching disk;
  then rename preserves content and retargets the open document, duplicate
  creates numbered copies, move relocates a file into an existing folder,
  delete removes a file, and deleting the open document returns the editor to
  a clean blank state. Renaming a document with history moves its snapshots to
  the new path.
- Local history: saving a changed document records the previous and current
  text, the dialog lists both, restoring the older snapshot changes only the
  editor and leaves it dirty, and clearing removes every snapshot for that
  document.
- Explicit encoding reopen: a GB18030 fixture is reopened as UTF-8 (wrong text,
  file bytes unchanged) and then as GB18030 (correct Chinese text, clean
  document); an edit saved afterwards keeps the exact GB18030 bytes.
- Large-file mode: a fixture over 500,000 characters opens with the status
  badge, no live-preview decorations, and the Source label; disabling the
  preference restores live preview, and re-enabling it restores the mode. The
  Windows dev WebView opened the fixture in 353 ms during the latest run;
  repeated runs ranged from 196 to 444 ms.
- Window flags: View > Toggle fullscreen and F11 both enter and leave real
  window fullscreen, and Always on top toggles the native flag while the
  in-app state follows it.
- Window frame memory: set and persist a known window frame, move to different
  bounds, restore from memory, and compare the real Tauri outer position and
  content size; clearing removes the stored frame. The test also asserts that a
  restored frame is not minimized. Offscreen and oversized-frame clamping is
  covered by Vitest rather than by moving the real window offscreen.
- Native title bar: toggle the setting, wait for the real Tauri
  `isDecorated()` value, and verify the custom window buttons and drag region
  disappear while the native title includes `MarkSI`; toggling back restores the
  three custom controls and an undecorated window. A manual graceful restart
  with the setting enabled confirmed that the window reopened decorated and the
  custom controls stayed hidden. The saved value is applied before window-frame
  restoration so content height is not reduced on every start.
- Session memory: open a document, attach its workspace folder, switch to source
  view, and wait for the path-only session record; clear the editor and restore
  the session, then verify the document content, workspace file list, and view
  mode. Disabling Restore last session clears the stored record.
- Advanced JSON settings: open the JSON editor from Preferences, confirm it
  starts from current values, reject malformed JSON without changing settings,
  apply valid font/width/folder/flat-list values, ignore out-of-range and unknown
  keys with warnings, and reload the applied JSON.
- Custom CSS themes: write local `.css` files into the app data themes folder,
  select one from Preferences, and verify its variables and typography apply;
  select a second theme with a remote `url()` and verify the loaded style removes
  the remote URL. Selecting a missing theme removes the injected style.
- IME composition: send real `compositionstart`/`compositionupdate` events with
  Chinese text, verify the committed text appears exactly once, then compose
  `*`, `"`, and `:sm` and verify auto-pair, smart quotes, and emoji completion
  stay inactive. A synthetic composing shortcut is ignored while the same
  non-composing shortcut toggles the sidebar; full-width Chinese punctuation is
  inserted literally.
- Keyboard accessibility: the skip link is the first app element, becomes
  visible on focus, and moves focus into the editor. Sidebar tabs expose tab and
  panel relationships, ArrowRight moves focus and selection, Settings traps Tab
  inside the dialog, Escape closes it and restores focus to the trigger, the
  toast is a polite atomic status region, and reduced-motion emulation removes
  transitions.
- Text direction: an Arabic document with English YAML metadata and a fenced
  code block opens with `dir="rtl"` in both the editor content and reading view,
  right-aligned body text, and a code block forced to LTR and left alignment.
  Forcing LTR updates both surfaces, forcing RTL overrides plain English text,
  and returning to Automatic restores the detected direction. The Settings
  select exposes Automatic, Left to right, and Right to left in Chinese.
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
extraction/sanitization, image helpers including document/root path and root
URL resolution, image-source scanning
and width/height/fit handling, export profiles and page CSS, metadata escaping,
custom-export argument parsing/expansion, PNG naming and capture-scale limits,
Pandoc format metadata plus export/import filenames, minimal text-change
calculation, quick-open ranking, and analysis helpers.

Golden Markdown fixtures under `tests/fixtures/markdown/` pair 18 hand-written
sources with their exact rendered HTML. They cover ATX/setext headings and
duplicate IDs, emphasis nesting, tight/loose/nested lists, blockquotes, fenced
and indented code with highlighting, inline/reference/autolink links, image
placeholders and unsafe sources, aligned tables, strikethrough and autolink
literals, hard/backslash breaks, escaped raw HTML, footnotes, alerts, TOC,
front matter, punctuation escapes, lax heading/list normalization, and
CJK/emoji/bidirectional text. Structural tests add KaTeX HTML/MathML output and
invalid-math fallback. The fixtures intentionally include `data-source-line` and
heading IDs, so source-map changes are reviewable too. A real-WebView E2E check
then renders representative structures through DOMPurify and verifies no
script/event-handler/javascript-URL survives, task checkboxes, table wrappers,
footnote output, external-link hardening, and an unchanged source buffer.

Rust tests cover encoding/BOM/CRLF round trips, explicit GB18030 and UTF-8 BOM
reopening, unknown-encoding rejection, atomic text and binary writes,
local-history recording/deduplication/retention, path-hash isolation, snapshot
relocation and clearing, workspace file rename/duplicate/move/delete with path
and collision validation,
image import and data URLs, recursive workspace listing/search, file timestamps,
custom-command validation, successful/non-zero execution, missing executables,
working-directory handling, Pandoc argument construction, format allowlisting,
bounded process-output capture, media path validation, percent-decoded paths,
media embedding limits, remote URL/private-address validation, image sniffing,
cache round trips/clearing, and a real local WinHTTP fetch.

## Command line and file associations

Rust tests cover startup-argument parsing: the first existing supported file is
selected, flags, `--`, folders, missing paths, and unsupported extensions are
ignored. The release executable was launched with a Markdown path and inspected
through CDP: the title was `cli-open.md` and the editor contained
`# CLI Open` with the expected body text. The startup file is consumed once,
and a pending recovered draft takes precedence.

Windows installers register the Markdown extensions listed in
`tauri.conf.json`. Installing, verifying Explorer double-click behavior, and
uninstalling the association remain manual release checks. Opening a second file
starts a second process because single-instance forwarding is not implemented.

## Release packaging

`scripts/checksums.mjs` has Vitest coverage for recursive artifact discovery,
extension filtering, uppercase SHA-256 output, relative paths, and the
no-artifacts error. Running `npm run release:checksums` against the local bundle
tree produced six entries for historical MSI and NSIS artifacts, including
`MarkSI_0.25.0_x64_en-US.msi` and its setup executable.

`.github/workflows/release-package.yml` builds unsigned bundles on
`windows-latest` and `ubuntu-latest` when dispatched manually or when a `v*` tag
is pushed, writes `SHA256SUMS.txt`, and uploads only final installers and the
checksum file for 14 days. The 0.37 run completed for both platforms and produced:

- `MarkSI_0.37.0_x64_en-US.msi` (6.91 MiB), SHA256
  `0F4E17BDD6094DFCF63AF18F703B5D236CFBF929B0FC5295C008138D08E69F79`
- `MarkSI_0.37.0_x64-setup.exe` (5.64 MiB), SHA256
  `B7B5071E371679E400A381BFB33CCA76522F39A4F4FC925CC1D9D0E92738FE28`
- `MarkSI_0.37.0_amd64.deb` (8.14 MiB), SHA256
  `2447E340750BB9ADA5787F0119AEC0ADBD29EE48F2B24BF944C8693C85649341`
- `MarkSI-0.37.0-1.x86_64.rpm` (8.14 MiB), SHA256
  `C990508638FBBE512A23A7719754A9F431BF7AD3F9AACFFFE31E12BC9C68AF39`
- `MarkSI_0.37.0_amd64.AppImage` (82.85 MiB), SHA256
  `700814C04262A0C1DCAFE126DB2BC6B1992B88C7B455FEE69D897A820ACBAB58`

The downloaded artifacts were re-hashed locally; all five matched their
`SHA256SUMS.txt` entries, and the archive contained no AppImage `AppDir` tree or
deb staging tarballs. Each platform artifact also contained a
`THIRD_PARTY_NOTICES.md` generated for that target: Windows reported 241 Rust
crates and 90 license texts, Linux reported 316 and 98. Adding the notices file
changed the upload artifact layout to retain the full
`src-tauri/target/release/bundle` prefix; checksum paths inside the file are
still relative to the bundle root. The first 0.31 packaging run exposed two
upload and checksum defects, which were fixed before 0.32. The workflow does not
sign, publish a release, or install the artifacts.

## Third-party notices

`scripts/notices.mjs` reads production packages from `package-lock.json` and
resolves Rust crates with `cargo tree` for an explicit target. It writes exact
versions, declared licenses, real copyright lines, and deduplicated license
texts to `THIRD_PARTY_NOTICES.md`. The Windows development run covered 198 npm
packages, 241 Windows-target Rust crates, and 90 distinct license texts; one
package had no cached license file and is listed explicitly instead of being
silently omitted. Vitest covers license-expression normalization, copyright
filtering (including Apache clause text that must not be treated as a notice),
license-body preservation, family detection, shared-text deduplication, cargo
tree parsing, and deterministic rendering. `npm run notices:check` confirms the
committed file is current on Windows. The About dialog exposes the generated
text in an expandable, scrollable section; the E2E gate expands it and checks
that npm and Rust tables and a license body are present. The release workflow
runs `cargo fetch --locked`, regenerates the notices for each runner target, and
uploads the generated file with the installers. The committed file is the
Windows-target snapshot; Linux-only crate notices exist in the Linux artifact
and are not represented by the repository copy. This is an engineering
inventory, not a legal opinion, and unusual license terms still need review.

## Continuous integration

`.github/workflows/build-test.yml` runs a Windows and Ubuntu matrix on pushes
and pull requests. Each job installs Node.js 22 and Rust stable, caches the
Cargo registry, runs `npm ci`, typecheck, Vitest, the frontend build,
`cargo fmt --check`, and `cargo test`. The Windows job also runs
`npm run notices:check` after the Rust cache is populated. The existing
publication-audit workflow remains separate. The real-WebView E2E suite is not
run in CI because it needs a desktop WebView session and CDP; it remains part of
the local release gate. The matrix does not build installers, sign artifacts, or
test auto-update.

## Windows packaging

`npm run tauri:build` completed with exit code 0 for version 0.25.0 and produced:

- `MarkSI_0.25.0_x64_en-US.msi` (6.85 MiB), SHA256
  `A2B243695230A93AD014AC34206FB94CEBDF2067FB98E6F5D30166558B082C46`
- `MarkSI_0.25.0_x64-setup.exe` (5.58 MiB), SHA256
  `13D220B7FCCF9A7C6576B032AC1B37754AE4775483E966D57F89B34FB7B9E72C`

The configuration includes Markdown file associations. Both artifacts report
`NotSigned` through Authenticode. The release executable
started and remained alive during a short smoke run. The installer itself was
not executed in this automated gate; installing, uninstalling, upgrading, and
SmartScreen presentation remain manual release checks. Checksums change on
every rebuild. The bundle identifier ends in `.app`, which Tauri warns about for
macOS; changing it would move the application data folder, so it is intentionally
kept for now.

## Limits and native-dialog checks

Some operating-system dialogs cannot be driven reliably through CDP alone:
native open/save/folder/image pickers, print/PDF dialogs, drag-and-drop from the
OS shell, external browser launches, and the final Quit action. Their underlying
file and image logic is covered by Rust tests and by dev-hook/E2E flows where
possible. GitHub Actions runs the publication audit and a Windows/Linux
build-and-test matrix; the real-WebView E2E suite remains local because it needs
a desktop WebView session. The save-name E2E replaces the native dialog boundary and verifies the
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
Workspace file actions are limited to supported text files inside the open
workspace. Delete is permanent rather than a move to the operating-system trash,
so the confirmation dialog is the only safeguard; there is no operation journal
or undo. Rename, move, and duplicate reject collisions instead of overwriting.
Local history stores plaintext snapshots in the application data folder, capped
at 40 snapshots and 4 MB each per document. It is local-only but not encrypted,
so anyone with access to the user profile can read it. Snapshots for a document
are migrated on rename or move inside MarkSI and cleared when MarkSI deletes the
file; files moved or deleted outside MarkSI leave orphaned history because there
is no global purge UI yet. Pinned paths are stored without checking the
filesystem; a missing file or folder stays pinned and reports an error when
opened. Reopen with encoding offers a curated encoding list rather than
arbitrary labels; decoding is read-only, and saving into a legacy encoding
still fails when the text contains characters that encoding cannot represent.
- Window frame memory stores content-area bounds and outer position in local
  storage and restores them on the next start when enabled. Minimized windows
  are never recorded, and restoring a frame first unminimizes the native window.
  The automated E2E restores within one process. A manual graceful restart check
  set the window to 1100x720 at (150, 120), closed through the title-bar Close
  button, and confirmed the same frame after restart. Monitor hot-plug and
  mixed-DPI multi-monitor layouts remain manual release checks. A saved
  maximized state is restored by applying normal bounds and then maximizing.
- Session memory stores paths and a view mode in local storage, never document
  content. A manual graceful restart check reopened `session-restart.md` with
  its workspace folder and source view. Missing session paths are skipped
  independently so an unavailable folder does not hide an existing document.
  Force-terminating the process can lose recent WebView storage writes; use the
  normal Close action, which flushes them. System appearance follows the
WebView's `prefers-color-scheme` value. The E2E suite emulates that media
feature through CDP; the real Windows/Linux OS theme switch remains a manual
release check. Fullscreen and always-on-top are native window flags queried at
startup; the E2E suite verifies the real Tauri window,
but window-manager behavior such as macOS Spaces or Linux tiling is outside the
automated gate. Native title bar switching is verified on Windows WebView2.
Linux window-manager repaint timing, Snap Layouts availability, and mixed-DPI
frame changes remain manual release checks; the app falls back to the custom
frame if the platform rejects the decoration change. Custom shortcuts cover application
commands only; editor formatting keeps fixed CodeMirror bindings, global
OS-level hotkeys are not supported, captured bindings require Ctrl or Meta, and
duplicate bindings are rejected instead of swapped. IME coverage uses CDP
composition events in the Windows WebView; the real Microsoft Pinyin candidate
window, Japanese/Korean IMEs, dead keys, and Linux WebKitGTK composition remain
manual release checks. Accessibility coverage uses WebView2 keyboard events and
DOM/ARIA inspection; screen-reader sessions with NVDA, Narrator, or Orca,
operating-system high-contrast modes, complex bidi editing, and RTL application
chrome remain manual or unimplemented. Document-level RTL detection and code
isolation are covered by Vitest and the real-WebView E2E. Advanced settings JSON is
not a full configuration-file format: there is no import/export file or schema
version, unknown keys are ignored with a warning, and applying settings takes
effect immediately with no undo. Custom CSS themes are read only from the app
data themes folder and screened for remote URLs and imports, but the filter is
best-effort rather than a full CSS sandbox. A theme can still spoof the interface
or hide controls, so only load CSS files that you trust. Sepia and High contrast are CSS/theme
token sets and Mermaid palettes, not operating-system high-contrast API
integration; their visual contrast and platform rendering need a manual review
before release. Large-file mode compares JavaScript string length, so the 500,000 threshold is
in UTF-16 code units rather than bytes. It reduces editing decorations, spell
check, and emoji suggestions only; reading-view rendering, export, search, and
outline extraction still process the full document and may be slow for very
large files. The 196–444 ms range is from one Windows development machine and
varies with host load;
Linux WebKitGTK behavior remains a manual release check. Pandoc is not bundled, is GPL-2.0-or-later as a separate program, and may fetch
remote images referenced by the document. The real Pandoc E2E uses a portable
executable under `.tmp`; on a fresh machine install Pandoc separately and run the
manual DOCX/EPUB check. Image uploader integration is not implemented; the
feature is explicitly deferred pending a credentials and third-party network
review. Imported images are inlined as data URLs, which can make
the Markdown source large; very large imported documents should be checked
manually for memory and save-size behavior. PDF import/export is not offered
because it requires an additional PDF engine.

Remote image fetching is tested with a local WinHTTP server and a test seam for
the preview. Linux uses system curl, which must be installed separately; the
Linux path is covered by code review and manual checks. Redirects are
deliberately not followed. DNS is resolved and private answers are rejected, but
a hostile DNS service could still change answers between validation and the
request; the setting remains off by default. Cached responses have no TTL, so
users must clear the cache to refresh a changed remote image. The cache location
is the platform app cache directory, not the document folder.

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
