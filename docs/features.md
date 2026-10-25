# MarkSI feature inventory

Status values: `todo`, `wip`, `done`, `deferred`, `not-applicable`.

This is a living feature inventory, not a schedule. Milestone scope, ordering,
and exit criteria are defined in [`docs/roadmap.md`](roadmap.md). A feature is
not `done` until its implementation and required tests are complete and the
full verification gate passes.

This is a living checklist. It is intentionally broader than the current MVP so
that design decisions do not paint us into a corner.

## Shell and window

| Feature | Status | Milestone |
|---|---|---|
| Custom title bar with drag region | done | M1 |
| Minimize / maximize / close controls | done | M1 |
| Native title bar option | todo | M6 |
| Multiple document windows | todo | M6 |
| Fullscreen / always on top | done | M6 |
| Window size/position/session restore | done | M6 |
| Light / dark appearance | done | M1 |
| System appearance following | done | M6 |
| Zoom in/out/reset | done | M4 |
| Windows 11 snap layouts support | todo | M6 |
| Single instance / file forwarding | todo | M6 |
| CLI file open | done | M6 |

System theme mode follows `prefers-color-scheme` live, including while the app
is open. Preferences and the title-bar toggle can still force Light or Dark;
the resolved appearance is used for the editor, preview, Mermaid diagrams,
clipboard HTML, and window chrome metadata. The choice is persisted.

Five appearances are available: System, Light, Dark, Sepia, and High contrast.
Each built-in theme supplies its own background, text, accent, selection,
border, search-match, table-stripe, and syntax colors. The status of the title
toggle always reflects the resolved dark/light family, and the theme selector
is a compact select in Preferences.

Preferences > Keyboard shortcuts lists application commands by group. Clicking
Change captures the next Ctrl/Alt combination, rejects conflicts with another
command, supports Backspace/Delete to unbind, and Escape to cancel. Bindings are
stored locally, apply immediately, and update the File/View menu labels. Reset
shortcuts restores the defaults. Editor formatting keys remain on their standard
CodeMirror bindings.

Preferences > Advanced can show and edit the stored preferences as JSON. The
editor starts from the current settings, applies known keys only, and reports
unknown keys or invalid values without changing the accepted fields. Numeric
ranges, language codes, automatic-save delays, image folders, export options, and
shortcut maps are validated locally. Copy and Reload current assist manual
backup; there is no network or file access in this flow.

Preferences > Appearance can load a local CSS theme from the application data
`themes` folder. The folder is created on demand, contains at most 50 `.css`
files of up to 256 KB each, and can be opened from Preferences. Selecting a theme
applies it to the whole interface and persists the file name. Reload themes
picks up edits without a restart. Before applying, MarkSI removes `@import`
rules, every non-data `url()`, quoted absolute URLs, and legacy script-capable
declarations so a theme cannot trigger network loads.

`npm run release:checksums` scans `src-tauri/target/release/bundle` recursively
and writes `SHA256SUMS.txt` with uppercase SHA-256 digests and relative paths.
The Release packages workflow builds unsigned Windows and Linux artifacts on
manual dispatch or version tags, writes the same checksum file, and uploads only
final installers (MSI, NSIS, deb, rpm, AppImage). It produced deb, rpm, and
AppImage packages on Ubuntu and MSI/NSIS packages on Windows. Code signing is
not configured.

The release executable accepts one supported Markdown/text path as its first
non-flag argument and opens it at startup. Windows installers register Markdown
extensions (`md`, `markdown`, `mdown`, `mkd`, `mdwn`, `mmd`, `mdx`) with the
application. A second instance is still launched for each file because single
instance forwarding is not implemented yet.

View > Toggle fullscreen (F11) switches the native window state, and Always on
top keeps MarkSI above other windows. Both expose a check mark while active and
reset to normal window mode when toggled off.

When Remember window size and position is enabled, MarkSI restores the last
normal window bounds and maximized state at startup. Saved bounds are checked
against the current monitor work areas; windows that are fully or mostly
offscreen return to the nearest usable display. Minimized state is never saved,
and restoring a frame brings a minimized window back into view.

When Restore last session is enabled, the last document and workspace folder
reopen at startup with the previous view mode. Only file paths are stored, never
document content. A pending recovered draft or a command-line file takes
precedence, and missing paths are skipped.

## Files and workspace

| Feature | Status | Milestone |
|---|---|---|
| New / open / save / save as | done | M1 |
| New-document save name from first H1 | done | M5 |
| Encoding detection and preservation | done | M1 |
| Line ending detection and preservation | done | M1 |
| Atomic save | done | M1 |
| Recent files | done | M1 |
| Open folder | done | M1 |
| Drag/drop file or folder to open | done | M1 |
| Unsaved-change close protection | done | M1 |
| File tree with lazy expansion | done | M1/M3 |
| Flat file list | done | M4 |
| File operations (rename/duplicate/move/delete) | done | M4 |
| External change detection | done | M3 |
| Autosave and draft recovery | done | M3 |
| Local history / snapshots | done | M4 |
| Quick open | done | M3 |
| Pinned locations | done | M4 |
| Workspace full-text search | done | M3 |
| File encoding reopen | done | M4 |
| Large file mode | done | M4 |
| File associations / installer integration | done | M6 |

The optional flat file list recursively scans the open workspace through the
existing workspace-file command and renders files with their relative paths.
It never changes folder expansion state in the tree view and is off by default.

Supported workspace files expose an action menu for rename, duplicate, move,
and delete. Operations stay inside the open workspace, reject traversal,
unexpected overwrites, reserved names, and unsupported extensions, and update
the open document path and recent entries after a rename or move. Delete is
permanent and requires confirmation; it closes the open document when that file
is removed.

Local history keeps up to 40 snapshots per saved document in the application
data folder. A save records the previous and current text when they differ;
identical snapshots are skipped and each snapshot is limited to 4 MB. File >
Local history previews, restores, deletes, and clears saved versions. Restoring
only places the text in the editor as an unsaved change. Rename and move migrate
the document's snapshots, and deleting a workspace file removes them through the
sidebar. Snapshots are plaintext and never leave the device.

Files and folders can be pinned from the sidebar action menu and appear in a
Pinned section above the workspace. Pinned files open directly, pinned folders
switch the workspace, and entries persist in local storage across restarts.
Renaming, moving, or deleting a pinned file updates or removes the matching pin.
Missing pinned paths remain listed and show an error when opened.

File > Reopen with encoding decodes the current file with Auto-detect, UTF-8,
UTF-16 LE/BE, GB18030, GBK/GB2312, Big5, Shift_JIS, EUC-JP, EUC-KR,
Windows-1252, or ISO-8859-1. Reopening never writes the file; it replaces the
editor buffer with a clean document that keeps the selected encoding for the
next save. Existing BOMs are reported, and unrepresentable characters are still
rejected on save.

Large-file mode activates at 500,000 characters when enabled in Preferences.
It turns off live-preview decorations, spell check, and emoji suggestions while
keeping source editing and the view toggle available. The status bar shows a
Large file mode badge and labels the editing view as Source. Reading view and
export remain available but are not optimized by this mode.

IME composition is handled without interfering with the document: auto-pair,
smart punctuation, and emoji completion stay inactive while Chinese, Japanese,
or Korean candidates are being composed, and application shortcuts ignore
composition events and Chromium's `keyCode 229`. Committed Chinese text and
full-width punctuation are inserted exactly once. This is verified through real
WebView composition events, not only synthetic unit tests.

## Editor

| Feature | Status | Milestone |
|---|---|---|
| Markdown source editor | done | M1 |
| Syntax highlighting | done | M1 |
| Live preview / hybrid rendering | wip | M2/M5 |
| Editable source-based live preview | done | M5 |
| Reading view (rendered, read-only) | done | M5 |
| Source mode toggle | done | M2 |
| Formatting shortcuts | done | M2 |
| Undo / redo | done | M1 |
| Find and replace | done | M1/M2 |
| Outline panel | done | M1 |
| Word / character / line count | done | M1 |
| Focus mode | done | M4 |
| Typewriter mode | done | M4 |
| Read-only mode | done | M4 |
| Auto pair brackets and Markdown markers | done | M4 |
| Smart punctuation | done | M4 |
| Spellcheck | done | M3 |
| Emoji autocomplete | done | M4 |
| IME / CJK input coverage | done | M7 |
| Large-document performance mode | todo | M7 |

## Markdown

| Feature | Status | Milestone |
|---|---|---|
| CommonMark + GFM | wip | M2 |
| Tables | done | M2 |
| Task lists | done | M2 |
| Strikethrough | done | M2 |
| Footnotes | done | M4 |
| TOC | done | M4 |
| YAML front matter | done | M4 |
| Inline/block math | done | M4 |
| Mermaid diagrams | done | M5 |
| Code fences with language highlight | done | M2 |
| GitHub alerts | done | M4 |
| Highlight / sub / sup | done | M4 |
| Raw HTML preview (sanitized) | deferred | — |
| Link reference definitions | done | M4 |
| Strict mode toggle (headings and nested lists) | done | M5 |
| Lax list indentation (nested markers) | done | M5 |
| Lax list continuation/quote indentation | done | M5 |

Raw HTML preview remains deferred by design. MarkSI keeps raw HTML escaped and
inert in both preview and export; enabling it would weaken the current
sanitization boundary and is not planned unless that safety requirement changes.

Strict mode controls ATX heading spacing and lax list indentation. MarkSI
defaults to strict mode; disabling it makes compact headings such as
`###Title` render as headings and pads under-indented nested list markers and
continuation text to their parent content indent. It covers nested `-`, `+`,
`*`, `1.`, and `1)` markers, continuations before and after blank lines, CRLF,
and lists inside single- or multi-level blockquotes. Fenced and indented code
remain literal. Tab-indented list lines are preserved as written rather than
expanded. The canonical Markdown source is never rewritten.

## Images

| Feature | Status | Milestone |
|---|---|---|
| Insert local image | done | M4 |
| Drag/drop image | done | M4 |
| Paste image from clipboard | done | M4 |
| Copy image to document-relative asset folder | done | M4 |
| Configurable asset folder | done | M4 |
| Relative asset paths | done | M4 |
| Remote image placeholders in preview | done | M4 |
| Missing-image placeholders | done | M4 |
| Image lightbox and zoom | done | M4 |
| Image context menu | done | M5 |
| Image width resize (drag handle) | done | M5 |
| Image height resize (drag handle) | done | M5 |
| Image fit controls (contain/cover) | done | M5 |
| Remote image cache (opt-in) | done | M5 |
| Image root path mode | done | M5 |
| Image root URL mode | done | M5 |
| Uploader integration (PicGo/PicList/custom) | deferred | M5 |

Image resizing stores width and optional height in the canonical Markdown
attribute block. Width-only images preserve their aspect ratio; explicit height
is also supported. Contain/cover fit and original-size reset are available from
the image context menu and are preserved in HTML export and print.

## Export and import

| Feature | Status | Milestone |
|---|---|---|
| Print | done | M2 |
| Export HTML | done | M2 |
| Export PDF | done | M2 |
| Export image | done | M5 |
| Copy as Markdown / HTML / plain text | done | M4 |
| Pandoc export (DOCX/ODT/EPUB/LaTeX/RTF) | done | M5 |
| Pandoc import (DOCX/ODT/EPUB/RTF/HTML) | done | M5 |
| Export profiles | done | M5 |
| Custom export command | done | M5 |
| Front matter export options | done | M5 |
| Page setup / headers / footers | done | M5 |

The export dialog offers Document, Print, Minimal, and Custom profiles. It
controls whether YAML front matter supplies the HTML title, whether author,
description, and keywords meta tags are emitted, and whether a sanitized
metadata panel appears above the document. Page setup writes `@page` size,
orientation, margins, and optional header/footer margin boxes. Paper size and
margins affect both exported HTML and the system print dialog; the operating
system print dialog may add or override its own headers and footers, and CSS
margin-box support varies by print engine.

Custom export is opt-in. The user configures an executable and one argument per
line in Preferences; after the HTML file is written, MarkSI expands `{input}`,
`{document}`, and `{title}`, runs the executable directly without a shell in the
export folder, and reports a non-zero exit code. Commands are limited to 64
arguments, 8 KiB per argument, and a 60-second timeout. The executable is never
bundled and nothing runs unless the user chooses the custom export action.

Image export captures the full reading view as a PNG using the current theme.
It waits for local images, fonts, and Mermaid rendering before capture, then
limits the canvas by dimension and total pixels so the browser can allocate it.
Documents below the minimum readable scale are rejected with a clear message
instead of producing an unreadable or blank file. Remote images remain
placeholders unless the user has explicitly enabled the remote cache; capture
never starts a new network request on its own.

Pandoc export is optional and works only with an externally installed Pandoc.
Preferences stores an optional executable path; empty means `pandoc` from PATH.
A detection probe shows the reported version before export. The export dialog
offers DOCX, ODT, EPUB, LaTeX, and RTF, writes the current Markdown to a
temporary source file, runs Pandoc with a fixed argument list and the document
folder as its resource path, then saves the result atomically. Pandoc is never
bundled or downloaded. It may fetch remote images referenced by the document,
so the UI states that explicitly; relative local images require a saved
document.

Remote image loading is opt-in and off by default. When enabled, http/https
images are fetched only on demand, validated as image data, capped at 10 MB,
and cached under the app cache folder. Localhost, private, link-local,
multicast, and credential-bearing URLs are rejected; redirects are not followed.
The Settings dialog can clear the cache. MarkSI never uploads images.

Image root path mode is local-only. Preferences can store an optional absolute
folder or a path relative to the workspace/document folder. Paths beginning
with `/` resolve from that root first; other relative paths try the document
folder first and fall back to the root. Absolute local paths are unchanged.

Image root URL mode is optional and works only when remote image loading is
enabled. A relative image first resolves against local document/root folders;
only if those reads fail is it resolved against the configured http/https base
and fetched through the same opt-in remote cache. The source Markdown remains
relative. Third-party uploaders are deferred until a separate credentials and
network review; MarkSI has no upload path.

Pandoc import accepts DOCX, ODT, EPUB, RTF, HTML, and HTM. It converts to Pandoc
Markdown in a temporary folder, embeds extracted images as data URLs in the new
document, and opens the result as an unsaved Markdown document named after the
source file. Only safe media paths inside the temporary media folder are
embedded; unknown formats and traversal paths remain untouched. The user must
save the imported document to choose its final location.

## Appearance and settings

| Feature | Status | Milestone |
|---|---|---|
| Design tokens | done | M1 |
| Built-in light/dark themes | done | M1 |
| Additional built-in themes | done | M6 |
| User CSS/theme folder | done | M6 |
| Settings shell | done | M2/M3 |
| Editor text size and column width | done | M3 |
| Shortcut editor | done | M6 |
| Advanced JSON settings | done | M6 |
| Chinese default / English language switch | done | M5 |
| Version display and one-step bump | done | M5 |
| i18n framework (en, zh-Hans, zh-Hant first) | wip | M6 |
| RTL and accessibility pass | todo | M7 |
| No telemetry / no account | done | M0 |
| No activation / no paid gates | done | M0 |

## Platform and release

| Feature | Status | Milestone |
|---|---|---|
| Windows 11 installer (NSIS/MSI) | done | M6 |
| Linux deb/rpm/AppImage | done | M6 |
| Flatpak packaging | todo | M7 |
| Signed releases / checksums | wip | M6 |
| Auto-update | todo | M6 |
| Third-party license notices | wip | M0 |
| Publication audit CI (Linux) | done | M0 |
| Full build/test CI (Windows + Linux) | done | M0 |
| E2E tests | done | M0 |
| Golden Markdown tests | todo | M2 |

## Explicit non-goals

- Proprietary activation, license server, account system, or update entitlement.
- Third-party branding, icons, themes, translations, or proprietary assets.
- Bundling GPL Pandoc; Pandoc is optional and externally installed.
- Cloud sync in v1.
- Executing arbitrary scripts embedded in Markdown by default.
