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

The E2E suite creates temporary fixtures under `.tmp/e2e-fixtures`, removes and
recreates that directory at the start, resets the running app between checks,
and removes the fixtures at the end. It does not modify user documents. The CDP
endpoint is resolved through `localhost`, so the same harness works when
WebView2 binds the debugging port to IPv4 or IPv6 only.

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

Image resizing supports width, height, and contain/cover fit from the reading
view. Drag resizing in the text-first live-preview surface and image HTML blocks
are not implemented or claimed. The editable live preview renders local images
inline but does not expose resize handles there; clicking an image returns to
its Markdown source. Automated coverage of image sizing uses local fixture
assets; native image picker and OS file dialogs remain in the manual release
checklist.

## Current automated coverage

The E2E suite currently covers:

- Chinese-first boot directly into the editor, document title, empty prompt,
  focus, and preview default.
- Sidebar workspace actions and absence of the old footer.
- Compact menu-bar replacement, category bar, blank-click close, File contents,
  Quit placement, and absent menu footer.
- About dialog close behavior and display of the product version.
- New-document transition, focus, and toast.
- New-document save dialog default names from the first H1 and the untitled
  fallback. The test suite replaces only the native dialog boundary so the
  complete save/write flow still runs.
- Opening a Markdown fixture in editable live preview.
- Live-preview editing, hidden inactive markers, and source retention.
- Live-preview inline images: a local image with a width attribute renders as a
  data URL on an inactive line, clicking it reveals the Markdown source and
  focuses that line, and a remote image stays an inert placeholder until remote
  loading is explicitly enabled.
- Live-preview task checkboxes: unchecked and checked GFM markers render with
  the correct accessible state, pointer and Space activation rewrite only the
  marker, the localized label is present, and a task marker inside a code fence
  stays literal.
- Live-preview heading hierarchy: ATX levels shrink toward body text, H1 is
  bold, sizes stay within the reading-view scale without compounding with
  syntax highlighting, Setext and block-quoted headings receive their level, a
  code-fence line stays unstyled, and the active heading line reveals its
  source marker and loses its heading class.
- Live-preview block quotes and horizontal rules: inactive quote lines hide
  their markers, show an accent rule, background, and deeper nested
  indentation; inactive rules render as a divider and reveal their Markdown
  source when activated; quote and rule markers inside a code fence stay
  literal.
- Live-preview code blocks: inactive fenced code shows a card background,
  hides both fences, and replaces the opening fence with its language badge;
  code content stays literal, inline code is unaffected, the active fence
  reveals its source while keeping the card, and clicking the badge reveals
  the opening fence.
- Live-preview tables: an inactive top-level table renders one read-only table
  widget with headers, both body rows, inline emphasis, center/right column
  alignment, cell borders, and a striped fill; the Markdown pipes stay hidden,
  a fenced table stays literal inside its code card, clicking the widget
  reveals the source, moving away restores the widget, and the document text is
  unchanged.
- Live-preview front matter: an inactive leading YAML block renders one card
  with a YAML badge and metadata rows in source order; the YAML stays hidden,
  only a body `---` rule renders as a divider, clicking the card reveals the
  original YAML without heading styling, moving away restores the card, and the
  document text is unchanged.
- Live-preview math: inactive inline `$...$` and whole-line display `$$...$$`
  render one KaTeX widget each, the delimiters stay hidden, clicking either
  widget reveals its source, moving away restores the widgets, math inside
  inline code and fenced code stays literal, and the document text is
  unchanged.
- Live-preview Mermaid: an inactive top-level `mermaid` fence renders one
  sanitized SVG card while the source stays hidden, a `text` fence keeps its
  code card, the diagram contains no script or `foreignObject`, clicking the
  card reveals the fence, moving away restores the diagram, and the document
  text is unchanged.
- Live-preview GitHub alerts: note and warning blocks style every line with the
  matching accent and one title label each, inactive `[!NOTE]` markers stay
  hidden, an ordinary quote keeps quote styling without an alert class,
  clicking a label reveals its marker, moving away restores the labels, and the
  document text is unchanged.
- Live-preview links: Ctrl+Click on an inline link and a reference-style link
  passes the resolved URL to the injected opener, a `javascript:` link never
  reaches the opener, ordinary clicks still edit, and the document text stays
  unchanged.
- Live-preview anchor links: Ctrl+Click on a `#fragment` link moves the caret to
  the matching ATX or Setext heading line, including duplicate heading suffixes,
  and the document text stays unchanged.
- Live-preview footnotes: inactive `[^1]` and `[^note]` references render two
  superscript badges with hidden delimiters, Ctrl+Click moves the caret to each
  definition line, and the document text stays unchanged.
- Live-preview unordered lists: inactive `-`, `*`, and `+` markers become five
  accent bullets across plain, nested, task, and quoted lists; task checkboxes
  remain interactive, clicking a bullet reveals the source marker, and the
  document text stays unchanged.
- Live-preview ordered lists: a list starting at `3.` renders six sequential
  labels (`3.` through `7.`, including its task items), a separate `1)` list
  keeps its parenthesis delimiter, inactive source numbers stay hidden, task
  checkboxes remain interactive, clicking a number reveals its marker, and the
  document text stays unchanged.
- Chinese CodeMirror search panel and Escape dismissal.
- Source / live-preview / reading mode transitions, and reading content staying
  clear of the overlay sidebar at narrow window widths.
- Strict mode on/off behavior for compact ATX headings, lax nested list marker
  indentation, under-indented continuation paragraphs, and quoted lists,
  including the Preferences toggle.
- Chinese settings, the three-language switch (Simplified, Traditional, English),
  localized placeholder and untitled names, persisted choice, and return to
  Simplified Chinese.
- First-run language: with saved preferences cleared and the system locale
  emulated as `en-US`, the app boots in English, sets the document language,
  and persists the detected choice; the original preferences and locale are
  restored afterward.
- Windows installer configuration: one NSIS installer includes English,
  Simplified Chinese, and Traditional Chinese, while the WiX MSI remains a
  single `en-US` installer.
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
  badge, no live-preview decorations, and the Source label. Switching to
  reading view shows a labelled confirmation panel with the exact character
  count and no rendered body; confirming renders the heading, adds the
  `is-large-document` class, and computes `content-visibility: auto` for the
  rendered block. Returning to source leaves the buffer unchanged. Disabling
  the preference restores live preview, and re-enabling it restores the mode.
  The Windows dev WebView opened the fixture in 208 ms during the latest run;
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
- Multiple document windows: press `Ctrl+Shift+N`, wait for two live WebView
  windows, and connect to the new CDP target. The test verifies its `?window=`
  identity, an empty document and workspace, and that a main-window recovery
  draft is neither shown nor consumed. Editing the secondary window writes only
  its own `marksi-recovery-draft:editor-*` key and leaves the main draft
  untouched. Making it clean and closing it returns the window count to one and
  removes the CDP target. Closing a dirty secondary window shows the native
  unsaved-changes prompt; that prompt itself remains a manual check.
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

Vitest covers formatting, smart typing, emoji catalogs, i18n dictionary parity
and interpolation, legacy language-tag normalization, Traditional Chinese
fallback and search phrases, localized history/document-info labels, version
display formatting, zoom math, strict-heading and lax-list normalization
(including continuations, quotes, code safety, and CRLF), front-matter parsing,
save-name extraction/sanitization, image helpers including document/root path
and root URL resolution, image-source scanning
and width/height/fit handling, export profiles and page CSS, metadata escaping,
custom-export argument parsing/expansion, PNG naming and capture-scale limits,
Pandoc format metadata plus export/import filenames, minimal text-change
calculation, quick-open ranking, installer language configuration, MSI
artifact-name normalization, link-target classification, heading-anchor
extraction, footnote scanning, list-marker detection and numbering, and analysis
helpers.

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

`scripts/artifact-names.mjs` has Vitest coverage for stripping the WiX language
suffix from Tauri MSI names, preserving unrelated names, replacing stale files,
and idempotent reruns. The release workflow runs `npm run release:normalize` on
Windows before checksums, so current artifacts use the language-neutral
`MarkSI_<version>_x64.msi` name. The installer UI itself remains `en-US`.

`.github/workflows/release-package.yml` builds unsigned bundles on
`windows-latest` and `ubuntu-latest` when dispatched manually or when a `v*` tag
is pushed, writes `SHA256SUMS.txt`, and uploads only final installers and the
checksum file for 14 days. The 0.41 run completed for both platforms and produced:

- `MarkSI_0.41.0_x64_en-US.msi` (6.92 MiB), SHA256
  `8E34A3DF60C21D16802287F441890F0C2C53AD8604F437103D38B61C1FE8182A`
- `MarkSI_0.41.0_x64-setup.exe` (5.65 MiB), SHA256
  `2C466F2F273C9E6B378F846AA8AF5C16D3D30B1033C3BFFE5813D269AA279574`
- `MarkSI_0.41.0_amd64.deb` (8.15 MiB), SHA256
  `06439773793362452AA070D41B5C269BF3A8DBD99FF6126036E1C5C3D4A0C2F7`
- `MarkSI-0.41.0-1.x86_64.rpm` (8.15 MiB), SHA256
  `1A91F247F75EC7B03DAFE1A4DCBCDFEB842DB8FF89C8F22CEE6529ACD942C2F8`
- `MarkSI_0.41.0_amd64.AppImage` (82.88 MiB), SHA256
  `D254441123B458A9DA42930C232F7997AB1320ED4D05E3CBE96AA2DDD31FD3B4`
- `MarkSI_0.41.0_x86_64.flatpak` (6.04 MiB), SHA256
  `5DE9329CA670C65162B59EAB9E045F30313F87BBB928F2E98AA6FA624485D06E`

The 0.42 run repeated the same package set. The downloaded artifacts were
re-hashed locally and all six matched the uploaded `SHA256SUMS.txt` entries:

- `MarkSI_0.42.0_x64_en-US.msi` (6.93 MiB), SHA256
  `0C3DF1FC949CA8F294AD3772055E78614EA4F481CB26FC45F022EC563A3B42F5`
- `MarkSI_0.42.0_x64-setup.exe` (5.65 MiB), SHA256
  `1904C9A3395B7DB24CA5057E8C04CE875D65C653CF37F27907E5CCFD9214FC34`
- `MarkSI_0.42.0_amd64.deb` (8.15 MiB), SHA256
  `56413AB27ABAE492F3DE2CDA063CBA3B6F3019FDB8A0FA62C9AADA9E25E4DE51`
- `MarkSI-0.42.0-1.x86_64.rpm` (8.16 MiB), SHA256
  `469AB665A052CFF3B5E0185D05E7CED3F9257A0178D6CB18047AC139D72443B0`
- `MarkSI_0.42.0_amd64.AppImage` (82.88 MiB), SHA256
  `2FD93F565E49385BEA01C473A7566C7CDBD81274FCEBF2BE83511CAA221213F9`
- `MarkSI_0.42.0_x86_64.flatpak` (6.04 MiB), SHA256
  `A23959F82FF8E75491FB5FD769F550B6DAD46DB1D500F7DB0A77FAE363F5D24F`

The 0.43 run repeated the same package set. The downloaded artifacts were
re-hashed locally and all six matched the uploaded `SHA256SUMS.txt` entries:

- `MarkSI_0.43.0_x64_en-US.msi` (6.93 MiB), SHA256
  `811F745F02A8AEA39A14D4EE1F7C69A968942CE6DFE6532B8ADE1300BBC5D323`
- `MarkSI_0.43.0_x64-setup.exe` (5.65 MiB), SHA256
  `0109ECCA52474927AC73BC5842F8AC07FCA5B41B75F49B4A7F00C86FB8CD358D`
- `MarkSI_0.43.0_amd64.deb` (8.15 MiB), SHA256
  `87C070FE1059FA409F27945CCA7141A95AF5187EF787EEA3C06C4BD92E86F8C0`
- `MarkSI-0.43.0-1.x86_64.rpm` (8.16 MiB), SHA256
  `22CAB206FD3ED741A4F0CC2C047DCC5D3CD7948C19C259CACA1BFD8226F4AC4E`
- `MarkSI_0.43.0_amd64.AppImage` (82.87 MiB), SHA256
  `57509A2CC0680DD1EA6C98290F74C5DA7DE45EFA2D21FBCB8ECED6E93ECBF456`
- `MarkSI_0.43.0_x86_64.flatpak` (6.05 MiB), SHA256
  `F6770E5BACF1FDF4339029313A5A0837C59C9B86DB0876C065B63CC4F3B546AB`

The 0.44 run repeated the same package set. The downloaded artifacts were
re-hashed locally and all six matched the uploaded `SHA256SUMS.txt` entries:

- `MarkSI_0.44.0_x64_en-US.msi` (6.93 MiB), SHA256
  `B4C3D63D0BA09251BEFCE939D48DF405C6A86B059ABD4612F836339025CFC506`
- `MarkSI_0.44.0_x64-setup.exe` (5.65 MiB), SHA256
  `A6059FFBBA261D667681386746F50C253F317F39E3BC3E4706672E90CD0FCA28`
- `MarkSI_0.44.0_amd64.deb` (8.15 MiB), SHA256
  `359B5136A8DE13E792375AF13A7EA4A581210CA99A31EF1D5D428029EF32B0E1`
- `MarkSI-0.44.0-1.x86_64.rpm` (8.16 MiB), SHA256
  `99B0B8FC5AC6760684F6E5602D50022389C6AF34962B3545FAADB9261E8C0389`
- `MarkSI_0.44.0_amd64.AppImage` (82.88 MiB), SHA256
  `4FEDF2DB1ACB829D2FB340B5314D3CC50765CD58238A0E4755AAB2375AA6B24E`
- `MarkSI_0.44.0_x86_64.flatpak` (6.05 MiB), SHA256
  `C350334DD2B9AB037B05385B2FAAB493AC463FF122E6CF7B6B0C1D729568D233`

The 0.45 run repeated the same package set. The downloaded artifacts were
re-hashed locally and all six matched the uploaded `SHA256SUMS.txt` entries:

- `MarkSI_0.45.0_x64_en-US.msi` (6.93 MiB), SHA256
  `D3E877DCE32089C14FC92CD5AD9977727217354DE2029A342F0F195D0B309D24`
- `MarkSI_0.45.0_x64-setup.exe` (5.65 MiB), SHA256
  `1ACB9E8134A20BF26DA56EEED9430E67307FEDB5B8FDE5ACD57574F4000AFDA3`
- `MarkSI_0.45.0_amd64.deb` (8.15 MiB), SHA256
  `EA6C1262A555742D1A68E5B188674F52B74210163253D51E15C5C1756C214CFA`
- `MarkSI-0.45.0-1.x86_64.rpm` (8.16 MiB), SHA256
  `4D2996FB42E9BE7C086807201F5C2A7C2E189B765B47002D13DD23ACADEB933F`
- `MarkSI_0.45.0_amd64.AppImage` (82.88 MiB), SHA256
  `2CC495615FF597FD4DBF4376712AD6AAE004C6FAB22D365080A99E7E5CFB255B`
- `MarkSI_0.45.0_x86_64.flatpak` (6.05 MiB), SHA256
  `CAF26D578A4BB800B6436E890018ECACBFFD1AB8DD1DD14206942928658434F4`

The 0.46 run repeated the same package set. The downloaded artifacts were
re-hashed locally and all six matched the uploaded `SHA256SUMS.txt` entries:

- `MarkSI_0.46.0_x64_en-US.msi` (6.93 MiB), SHA256
  `F3BE59343FDE7188D29D4594EEBC30D12423E8957EDC2BF4A4385598B02BB131`
- `MarkSI_0.46.0_x64-setup.exe` (5.65 MiB), SHA256
  `87337682730674627523FB2D1BD1AC79C7CBCDFCF27B1D338D9B9D16D997BEFE`
- `MarkSI_0.46.0_amd64.deb` (8.15 MiB), SHA256
  `40827A5434896546849665BB6B0B2EE8A10D999D2F76B43B13D0602045799168`
- `MarkSI-0.46.0-1.x86_64.rpm` (8.16 MiB), SHA256
  `17D875AD30D64AE5E371685F50BB5BFDADD2D81DB6C81D1FFF3D9A9771060351`
- `MarkSI_0.46.0_amd64.AppImage` (82.88 MiB), SHA256
  `4B8B9F22AD7B2C5B4386AD648505BCEC00FB58F292163A9649D7DE0C55963A51`
- `MarkSI_0.46.0_x86_64.flatpak` (6.05 MiB), SHA256
  `BDBDE66798B96185C5C346E4BD470F7BB100AD9EA3D2BB9055C5255FE5709153`

The 0.47 run repeated the same package set. The downloaded artifacts were
re-hashed locally and all six matched the uploaded `SHA256SUMS.txt` entries:

- `MarkSI_0.47.0_x64_en-US.msi` (6.93 MiB), SHA256
  `4F8265FDDA549132DD8F3AE9E97DF17420E2C1EB57749A3089492BE7DA2F5BF7`
- `MarkSI_0.47.0_x64-setup.exe` (5.65 MiB), SHA256
  `6E9BED797D37787847080EEBC697ECDF1A7867B3EC3FB754F4F17C8F24D0D2BA`
- `MarkSI_0.47.0_amd64.deb` (8.15 MiB), SHA256
  `FC31229C172675C2EA305B7F89EB6B693D3900B03D59F7AAE00E74F444486235`
- `MarkSI-0.47.0-1.x86_64.rpm` (8.16 MiB), SHA256
  `5B9AE8CA35A0C8685E6FBE11795732AC5FF0B419D7DC6C938440947A5BD31BE0`
- `MarkSI_0.47.0_amd64.AppImage` (82.88 MiB), SHA256
  `E17FA6478BB386C61B6BA1B9ADF0AEC73485FE08B4E09AFDB00E2502CB0AC8FA`
- `MarkSI_0.47.0_x86_64.flatpak` (6.05 MiB), SHA256
  `7511746B4C169BEF58552173E84718A8954385E7A610FC52E3315438D06AB05B`

The 0.48 run repeated the same package set. The downloaded artifacts were
re-hashed locally and all six matched the uploaded `SHA256SUMS.txt` entries:

- `MarkSI_0.48.0_x64_en-US.msi` (6.93 MiB), SHA256
  `29FAB999F80EA004CD53AEA354159631679D1426A85FFEECB7321A88D5A52D85`
- `MarkSI_0.48.0_x64-setup.exe` (5.65 MiB), SHA256
  `8069DC5B99BF40C9D12799EB7DA63333687EBF1E6E18DABB62697BC343F95DDB`
- `MarkSI_0.48.0_amd64.deb` (8.15 MiB), SHA256
  `F1856841EEF54B78DDA16DE15A4DCE4A6430EF402087C1C623571E9176B44D0F`
- `MarkSI-0.48.0-1.x86_64.rpm` (8.16 MiB), SHA256
  `6BCF30CB6A200FE0D7B27B621FD818128AA7094D2F04E5940950490A0230A012`
- `MarkSI_0.48.0_amd64.AppImage` (87.50 MiB), SHA256
  `4B24CDEF2378DB6EC09BF816D799223F70EFEB62CBA41F6A22F3A19ACBF8FBDF`
- `MarkSI_0.48.0_x86_64.flatpak` (6.04 MiB), SHA256
  `F26A72629C93AE54D029B96A618203A3EB6077DEF161CC4ACE61D1CFB8772A2A`

The 0.49 run repeated the same package set. The downloaded artifacts were
re-hashed locally and all six matched the uploaded `SHA256SUMS.txt` entries:

- `MarkSI_0.49.0_x64_en-US.msi` (6.93 MiB), SHA256
  `A3FBCFE319CCEC53B9A3FB6354D9E67E5886A4664256F3573135BF7B64404D65`
- `MarkSI_0.49.0_x64-setup.exe` (5.65 MiB), SHA256
  `DA46A2B472B7CC4CB89DE7931938DA937BC4E06EB51095CAF989BC49CE7133CC`
- `MarkSI_0.49.0_amd64.deb` (8.15 MiB), SHA256
  `76246DC3962B9CF428A07A8AB3CCC2A9605A0FE6CFD39879103588E253DABFD7`
- `MarkSI-0.49.0-1.x86_64.rpm` (8.16 MiB), SHA256
  `70B4F9BF0F23A4FF0AC539FF86AEF38BA5414C322792CF9D70B3EDE9173EB89C`
- `MarkSI_0.49.0_amd64.AppImage` (87.49 MiB), SHA256
  `F4F5BA2B2DCF68626A37AFF81D7263852070E7D65506D8F619CA25AF92EB5CCD`
- `MarkSI_0.49.0_x86_64.flatpak` (6.04 MiB), SHA256
  `2FC95DCC51BFEA621E9CCC279C47BA739483D53C7DE0E7BA51E76A529C8A5FCC`

The 0.50 run repeated the same package set. The downloaded artifacts were
re-hashed locally and all six matched the uploaded `SHA256SUMS.txt` entries:

- `MarkSI_0.50.0_x64_en-US.msi` (6.93 MiB), SHA256
  `83D170B0DFB90EAD7AA007B23859BE94B401819548912C98B7FCFCA3D95A65BF`
- `MarkSI_0.50.0_x64-setup.exe` (5.65 MiB), SHA256
  `F1D06D884C5D64185755C6DACF689E82C16D15F743C1A721BC5655B4B823CEAA`
- `MarkSI_0.50.0_amd64.deb` (8.15 MiB), SHA256
  `B67715AACBD03619F65AC33695F2F15ABB11E19050D158672F7CFCD0394191F2`
- `MarkSI-0.50.0-1.x86_64.rpm` (8.16 MiB), SHA256
  `AC4528639BC663176C9EE70B066FC52B802D7F683FF73A792E38CE0587EE8E64`
- `MarkSI_0.50.0_amd64.AppImage` (87.50 MiB), SHA256
  `69210B0CE2BCA07E092B2F17CA0B7538B8B3C941CD5B42026DC90036587C7457`
- `MarkSI_0.50.0_x86_64.flatpak` (6.04 MiB), SHA256
  `2762DE4C8030583D49832EECF4169BFFD41F327FCF08F2B41E899E61EF48C8A0`

The 0.51 run repeated the same package set. The downloaded artifacts were
re-hashed locally and all six matched the uploaded `SHA256SUMS.txt` entries:

- `MarkSI_0.51.0_x64_en-US.msi` (6.93 MiB), SHA256
  `4C7FDC1F9D84EA9A88EDBD9AA4CB6A43B4064A3DD61BE8B99BF542807BA39359`
- `MarkSI_0.51.0_x64-setup.exe` (5.66 MiB), SHA256
  `90ACEE30E737F358D78CFF6184DFF20BC60F2EA61D00C2358DC906454C19994C`
- `MarkSI_0.51.0_amd64.deb` (8.15 MiB), SHA256
  `C221A99DFB3022108E42AC5F2E5DBEBF281083A73E9EA46E10F35E950A949D40`
- `MarkSI-0.51.0-1.x86_64.rpm` (8.16 MiB), SHA256
  `C7056E666FF9D8A8B7D03D114BF946A81B0F355F3804E1EC89D0DED93323A0D5`
- `MarkSI_0.51.0_amd64.AppImage` (87.49 MiB), SHA256
  `16CECB04044C3AA598D82EDA59783D03A0F2F1BA6A8591C44E9B4653158129E3`
- `MarkSI_0.51.0_x86_64.flatpak` (6.05 MiB), SHA256
  `1FAE6717D48E778420E2517E2858E1155592662C42C1D388D2793A9BD3DCECBE`

The 0.52 run repeated the same package set. The downloaded artifacts were
re-hashed locally and all six matched the uploaded `SHA256SUMS.txt` entries:

- `MarkSI_0.52.0_x64_en-US.msi` (6.93 MiB), SHA256
  `D8E18C44AFA6F98B48A5EEEDBDE74CB1759530E850A0F009B81E5BB9062F81F1`
- `MarkSI_0.52.0_x64-setup.exe` (5.65 MiB), SHA256
  `A5B4F7FDA5B9F6E07B89E1CB7CE76AB8C27A04B5C49CF2696AD23C433ADFD420`
- `MarkSI_0.52.0_amd64.deb` (8.15 MiB), SHA256
  `A154316B4E0E4B4C462F1166DCC7A34F2254CBAAA5091358ECB6ECF27809B527`
- `MarkSI-0.52.0-1.x86_64.rpm` (8.16 MiB), SHA256
  `A41B3F34E20870FCC007477B3E338295569E702E68833CDFF083D4EF6250A66F`
- `MarkSI_0.52.0_amd64.AppImage` (87.50 MiB), SHA256
  `A5559FD793AD576EA7C0EB4930DD2218B221D47DC03E5F95E7AFA48770B8BD94`
- `MarkSI_0.52.0_x86_64.flatpak` (6.05 MiB), SHA256
  `39C3A12A03DF86842B5AA2D052E6FEC2605757AB955B70AF29EA5DD1EC98D834`

The 0.53 run repeated the same package set. The downloaded artifacts were
re-hashed locally and all six matched the uploaded `SHA256SUMS.txt` entries:

- `MarkSI_0.53.0_x64_en-US.msi` (6.93 MiB), SHA256
  `FEEC888B54290B636248C84B476F3F88E4DDDCFFFA5A0685ACC455E6E32DC423`
- `MarkSI_0.53.0_x64-setup.exe` (5.65 MiB), SHA256
  `1D5347FA6E8F068BACC731D94A5F24BBE4253D7E3B234890C225D092D8F2B692`
- `MarkSI_0.53.0_amd64.deb` (8.15 MiB), SHA256
  `FE3D1E0EEDDCBAAFE1E539F35BD62FFB3D107B0A28AEA414E107B45BEA23CCE4`
- `MarkSI-0.53.0-1.x86_64.rpm` (8.16 MiB), SHA256
  `A02AA93837141550E9BB9BDD83FCA98E7692C662417BD7D3D3D30CA6BEB41711`
- `MarkSI_0.53.0_amd64.AppImage` (87.50 MiB), SHA256
  `F6E4C48B4B14A4D711587D83CAB34EB7BFCA1AE6F0C6FE2A3229274E5609B806`
- `MarkSI_0.53.0_x86_64.flatpak` (6.05 MiB), SHA256
  `83966D0620573CD19177A1A6AD56297189CC4FB9C3B4DEE0DD42416A78B89E4E`

The 0.54 run repeated the same package set. The downloaded artifacts were
re-hashed locally and all six matched the uploaded `SHA256SUMS.txt` entries:

- `MarkSI_0.54.0_x64_en-US.msi` (6.93 MiB), SHA256
  `AF853B80054BD5543D12D74F8DF33587D41010DF2EB723CBB0648A9E88EA52FC`
- `MarkSI_0.54.0_x64-setup.exe` (5.66 MiB), SHA256
  `40025EC3C38EA91BD8F9C1AC028646874288AF4734C3A4024C48F26AF251788F`
- `MarkSI_0.54.0_amd64.deb` (8.15 MiB), SHA256
  `12EA2DD45EAF3DA4E734DD60E00934A28A6F3C772412696D4247B58EBB09D825`
- `MarkSI-0.54.0-1.x86_64.rpm` (8.16 MiB), SHA256
  `0A2A0464952F8AF774B7FCB5FB6FE856086085DA10C19608E2031BFEDA39EF46`
- `MarkSI_0.54.0_amd64.AppImage` (87.50 MiB), SHA256
  `83DFE3E5283C82161E09946A459242A3FC781BCE6DFF8F66AC88703DF63A8AC5`
- `MarkSI_0.54.0_x86_64.flatpak` (6.05 MiB), SHA256
  `9C8BA81B9C8B3EFC42F5F0607B3E38BDE2E99D5425BF5AA983FF99A12160F967`

The 0.55 run repeated the same package set. The downloaded artifacts were
re-hashed locally and all six matched the uploaded `SHA256SUMS.txt` entries.
The MSI filename is language-neutral; the WiX installer UI is still `en-US`:

- `MarkSI_0.55.0_x64.msi` (6.93 MiB), SHA256
  `EF68A11CB158A72A504DD03B467F89A2B8B6085BD85B36B49BC9216D609C1C58`
- `MarkSI_0.55.0_x64-setup.exe` (5.66 MiB), SHA256
  `2E21F991BB16211841BF6D8ACEF1F14CB74E500C7B9219ADA2D4A88C1FA49684`
- `MarkSI_0.55.0_amd64.deb` (8.15 MiB), SHA256
  `AA8D1B7819324E37B29E22ED3D8776B78352582E2A7BFFCD00851D5045031C22`
- `MarkSI-0.55.0-1.x86_64.rpm` (8.16 MiB), SHA256
  `5B0887FFD8694E0C95F6B74A70F29F1C54EAFB740DE84387264C38AAF98941B5`
- `MarkSI_0.55.0_amd64.AppImage` (87.50 MiB), SHA256
  `DDB33A939D02634B184823833D60E01630945D5E37766EB53410C5FFCD8F358F`
- `MarkSI_0.55.0_x86_64.flatpak` (6.05 MiB), SHA256
  `EB2891E5DB66AA2C5B05BC2583C056A9BDE442F03EA738037FC0126451B65344`

The 0.56 run repeated the same package set. The downloaded artifacts were
re-hashed locally and all six matched the uploaded `SHA256SUMS.txt` entries:

- `MarkSI_0.56.0_x64.msi` (6.93 MiB), SHA256
  `B84D3B165A0DDFBF91DFEC11123E90EBE80FC66D963DF568E4D7E7188FEAA305`
- `MarkSI_0.56.0_x64-setup.exe` (5.66 MiB), SHA256
  `2799405FA1A279411B9E6E37A2BD0861CA8BCFF72A62D15040302F5BE88AE961`
- `MarkSI_0.56.0_amd64.deb` (8.15 MiB), SHA256
  `07C37C8E9E55D7DFBA1420666706E0A9B8B0896C68C2066849073601EFC6D875`
- `MarkSI-0.56.0-1.x86_64.rpm` (8.16 MiB), SHA256
  `AF9555804F98B357675EF3204CE6698E5CF41257B5197A530357EA9F4DA2C9CE`
- `MarkSI_0.56.0_amd64.AppImage` (87.50 MiB), SHA256
  `0E8B310BC15FA1B284E3B5D5A658E47FEC40B632C9B71A10311EB2B3E9A454E4`
- `MarkSI_0.56.0_x86_64.flatpak` (6.05 MiB), SHA256
  `6253D3EA2394B9475B25823FE219396AF731B49FE25557852CDAE64AE507A127`

The 0.57 run repeated the same package set. The downloaded artifacts were
re-hashed locally and all six matched the uploaded `SHA256SUMS.txt` entries:

- `MarkSI_0.57.0_x64.msi` (6.93 MiB), SHA256
  `30A7645028C97255BB03C416CB379EED8F73765D54D14227C14B72EE3BFD581B`
- `MarkSI_0.57.0_x64-setup.exe` (5.66 MiB), SHA256
  `F83A761D6A428F858718260DD1AAB7E735B378FB78251B612668B53A68D51E00`
- `MarkSI_0.57.0_amd64.deb` (8.15 MiB), SHA256
  `D07292930EEAF28C9B725F140C445C7C7E5080CDCE3F61465FCF4EB5E3DB65E5`
- `MarkSI-0.57.0-1.x86_64.rpm` (8.16 MiB), SHA256
  `649074C336CEE7E4C61252951DB083FC42F8AC53861A751339EC2B64B794AACC`
- `MarkSI_0.57.0_amd64.AppImage` (87.49 MiB), SHA256
  `0C3429615B80187C05E857D5DD37817717BF4D2416B48FCC9B3CC6E83DE2F6B0`
- `MarkSI_0.57.0_x86_64.flatpak` (6.05 MiB), SHA256
  `2E85775E202D82214111A4C58F85560472638CEA4FC5EF9018451669D23DD72B`

The 0.58 run repeated the same package set. The downloaded artifacts were
re-hashed locally and all six matched the uploaded `SHA256SUMS.txt` entries:

- `MarkSI_0.58.0_x64.msi` (6.93 MiB), SHA256
  `08245CA5E06AEB5538431CA8C1ED77EE053D852F35F05059D9C77BEA31D13EE7`
- `MarkSI_0.58.0_x64-setup.exe` (5.66 MiB), SHA256
  `15373B73984F8866E005C0B1E8704B6718ABDB55F626DA2084E37A3E14364C6F`
- `MarkSI_0.58.0_amd64.deb` (8.15 MiB), SHA256
  `10622969CFE6CA90E841AB3AD1D169D944B095D3564B3FFEE930E1310A03763C`
- `MarkSI-0.58.0-1.x86_64.rpm` (8.16 MiB), SHA256
  `AF0845215B09AB9F47995E707CF93E06CB5B010027C24E67E6FF8ABD134CAB63`
- `MarkSI_0.58.0_amd64.AppImage` (87.50 MiB), SHA256
  `3D302062445DBCC468241CF8896D5267865F129FCC18F5ADB38CF3F7F051F47B`
- `MarkSI_0.58.0_x86_64.flatpak` (6.05 MiB), SHA256
  `EDA8E8316E4A4E6CF56ACA4A8FDBC57F1A67E1490CB9957D10DD073EC146ACB8`

The 0.59 run repeated the same package set. The downloaded artifacts were
re-hashed locally and all six matched the uploaded `SHA256SUMS.txt` entries:

- `MarkSI_0.59.0_x64.msi` (6.93 MiB), SHA256
  `7D2807CC468F5C7D209D3551262FD81C592608C7FA8B030061227DC5EF375C9B`
- `MarkSI_0.59.0_x64-setup.exe` (5.66 MiB), SHA256
  `FC610DA5DBCBC5BB4EF785D6FC0BAE12340A7AD7910F3787D224407E674A019B`
- `MarkSI_0.59.0_amd64.deb` (8.15 MiB), SHA256
  `A4EF83936362E3C23CF3C359BAD357E1DDC9210522E68CA37723914A45F95343`
- `MarkSI-0.59.0-1.x86_64.rpm` (8.16 MiB), SHA256
  `45CC671E58833867BA8BA6A3A0DB3166BE282CA9EA466DD4DB156E3F4DFBDBB6`
- `MarkSI_0.59.0_amd64.AppImage` (87.50 MiB), SHA256
  `23337B89ECB502DB4A87EBCBABB29A89A7FD755EB6A2031C4B6BBDEDDDAE1097`
- `MarkSI_0.59.0_x86_64.flatpak` (6.05 MiB), SHA256
  `DF37AA6271A5F6F362CE906F1E197EAC2A59D97BF26B72487A135705461D5921`

The 0.54 NSIS setup is 0.01 MiB larger than 0.53, consistent with embedding the
Simplified and Traditional Chinese installer translations alongside English.
The MSI remains a single `en-US` installer; its application payload still
contains all three interface languages and does not select a separate English
build. From 0.55 onward the release workflow strips the generated WiX language
suffix, so the MSI path in `SHA256SUMS.txt` is `msi/MarkSI_<version>_x64.msi`.

The 0.48 AppImage is about 4.8 MiB larger than 0.47 while the deb, rpm, and
Flatpak sizes are unchanged, and the Windows artifact is the same size. The
growth is confined to the AppImage's bundled runtime libraries on the Linux
runner, not the application payload. The 0.49 through 0.59 AppImages are within
0.01 MiB of 0.48 and the other package sizes are unchanged, which confirms that
the earlier growth was a stable runner-runtime difference rather than
per-release payload growth.

For 0.41, the downloaded artifacts were re-hashed locally; all six matched their
`SHA256SUMS.txt` entries, and the archive contained no AppImage `AppDir` tree or
deb staging tarballs. The 0.42 through 0.59 archives were inspected the
same way and kept the same layout. Each platform artifact also contained a
`THIRD_PARTY_NOTICES.md` generated for that target: Windows reported 241 Rust
crates and 90 license texts, Linux reported 316 and 98. Adding the notices file
changed the upload artifact layout to retain the full
`src-tauri/target/release/bundle` prefix; checksum paths inside the file are
still relative to the bundle root. The first 0.31 packaging run exposed two
upload and checksum defects, which were fixed before 0.32. The workflow does not
sign, publish a release, or install the artifacts.

## Flatpak packaging

`flatpak/com.marksi.app.yml`, the desktop entry, and the AppStream metadata use
the `com.marksi.app` identifier and target the GNOME 51 runtime. The metadata
check runs on every platform and asserts the manifest command/runtime/permissions,
the desktop `Exec`/icon/MIME entry, the AppStream ID and launchable entry, and
that the latest `<release>` version matches `package.json`. The staging test
copies a stand-in binary and verifies all four staged icon sizes.

The Flatpak workflow runs on Ubuntu, builds the real Tauri release binary,
stages it, validates the AppStream file, builds an unsigned bundle with
`flatpak-builder`, installs it, and checks `/app/bin/marksi` plus the installed
desktop and metainfo files. It also runs `ldd` inside the sandbox and fails on
unresolved shared libraries. The release workflow builds the same bundle after
the Linux installers, adds it to the shared checksum file, and uploads it with
the Linux artifact. The 0.41 through 0.59 runs completed both paths and the
downloaded `.flatpak` matched its `SHA256SUMS.txt` entry in each run. `flatpak-builder` is Linux-only,
so the Windows development host runs the metadata and staging checks but cannot
build the bundle locally.

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
publication-audit workflow remains separate. A third workflow, Flatpak, builds
and installs the Flatpak bundle on Ubuntu. The real-WebView E2E suite is not
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
frame if the platform rejects the decoration change. Multiple windows are
verified through two live WebView2 CDP targets; Linux window-manager placement
and the native unsaved-changes prompt shown when closing a dirty secondary
window remain manual checks. Custom shortcuts cover application
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
check, and emoji suggestions; reading view waits for an explicit confirmation
before building the full DOM, but the confirmed render, print, PNG export,
search, export, and outline extraction still process the complete document and
may be slow for very large files. The confirmation is per reading-view visit and
resets after leaving reading mode. The 196–444 ms range is from one Windows
development machine and varies with host load;
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
