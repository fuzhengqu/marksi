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
| Fullscreen / always on top | todo | M6 |
| Window size/position/session restore | todo | M6 |
| Light / dark appearance | done | M1 |
| System appearance following | todo | M6 |
| Zoom in/out/reset | done | M4 |
| Windows 11 snap layouts support | todo | M6 |
| Single instance / file forwarding | todo | M6 |
| CLI file open | todo | M6 |

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
| Flat file list | todo | M4 |
| File operations (rename/duplicate/move/delete) | todo | M4 |
| External change detection | done | M3 |
| Autosave and draft recovery | done | M3 |
| Local history / snapshots | todo | M4 |
| Quick open | done | M3 |
| Pinned locations | todo | M4 |
| Workspace full-text search | done | M3 |
| File encoding reopen | todo | M4 |
| Large file mode | todo | M4 |
| File associations / installer integration | todo | M6 |

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
| IME / CJK input coverage | todo | M7 |
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
| Lax list continuation/quote indentation | todo | M5 |

Raw HTML preview remains deferred by design. MarkSI keeps raw HTML escaped and
inert in both preview and export; enabling it would weaken the current
sanitization boundary and is not planned unless that safety requirement changes.

Strict mode controls ATX heading spacing and nested list marker indentation.
MarkSI defaults to strict mode; disabling it makes compact headings such as
`###Title` render as headings and pads under-indented nested list markers to
their parent content indent. The v1 lax-list pass covers nested `-`, `+`, `*`,
`1.`, and `1)` markers, including after blank lines. It deliberately leaves
lazy continuation paragraphs, quote-block lists, tab-indented markers, and
fully lax continuation blocks to the future continuation/quote item above.

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
| Remote image cache | todo | M5 |
| Root URL / uploader path mode | todo | M5 |
| Uploader integration (PicGo/PicList/custom) | todo | M5 |

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
| Export image | todo | M5 |
| Copy as Markdown / HTML / plain text | done | M4 |
| Pandoc import/export | todo | M5 |
| Export profiles | done | M5 |
| Custom export command | todo | M5 |
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

## Appearance and settings

| Feature | Status | Milestone |
|---|---|---|
| Design tokens | done | M1 |
| Built-in light/dark themes | done | M1 |
| Additional built-in themes | todo | M6 |
| User CSS/theme folder | todo | M6 |
| Settings shell | done | M2/M3 |
| Editor text size and column width | done | M3 |
| Shortcut editor | todo | M6 |
| Advanced JSON settings | todo | M6 |
| Chinese default / English language switch | done | M5 |
| Version display and one-step bump | done | M5 |
| i18n framework (en, zh-Hans, zh-Hant first) | wip | M6 |
| RTL and accessibility pass | todo | M7 |
| No telemetry / no account | done | M0 |
| No activation / no paid gates | done | M0 |

## Platform and release

| Feature | Status | Milestone |
|---|---|---|
| Windows 11 installer (NSIS/MSI) | todo | M6 |
| Linux deb/rpm/AppImage | todo | M6 |
| Flatpak packaging | todo | M7 |
| Signed releases / checksums | todo | M6 |
| Auto-update | todo | M6 |
| Third-party license notices | wip | M0 |
| Publication audit CI (Linux) | done | M0 |
| Full build/test CI (Windows + Linux) | todo | M0 |
| E2E tests | done | M0 |
| Golden Markdown tests | todo | M2 |

## Explicit non-goals

- Proprietary activation, license server, account system, or update entitlement.
- Third-party branding, icons, themes, translations, or proprietary assets.
- Bundling GPL Pandoc; Pandoc is optional and externally installed.
- Cloud sync in v1.
- Executing arbitrary scripts embedded in Markdown by default.
