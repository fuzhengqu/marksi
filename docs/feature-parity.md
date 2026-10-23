# MarkSI feature parity checklist

Status values: `todo`, `wip`, `done`, `deferred`, `not-applicable`.

This is a living checklist. It is intentionally broader than the current MVP so
that design decisions do not paint us into a corner.

## Shell and window

| Feature | Status | Milestone |
|---|---|---|
| Custom title bar with drag region | done | M1 |
| Minimize / maximize / close controls | done | M1 |
| Native title bar option | todo | M6 |
| Multiple document windows | todo | M3 |
| Fullscreen / always on top | todo | M6 |
| Window size/position/session restore | todo | M6 |
| Light / dark appearance | done | M1 |
| System appearance following | todo | M6 |
| Zoom in/out/reset | todo | M2 |
| Windows 11 snap layouts support | todo | M6 |
| Single instance / file forwarding | todo | M6 |
| CLI file open | todo | M6 |

## Files and workspace

| Feature | Status | Milestone |
|---|---|---|
| New / open / save / save as | done | M1 |
| Encoding detection and preservation | done | M1 |
| Line ending detection and preservation | done | M1 |
| Atomic save | done | M1 |
| Recent files | done | M1 |
| Open folder | done | M1 |
| Drag/drop file or folder to open | done | M1 |
| Unsaved-change close protection | done | M1 |
| File tree with lazy expansion | wip | M1/M3 |
| Flat file list | todo | M3 |
| File operations (rename/duplicate/move/delete) | todo | M3 |
| External change watcher | todo | M3 |
| Autosave and draft recovery | todo | M3 |
| Local history / snapshots | todo | M3 |
| Quick open | todo | M3 |
| Pinned locations | todo | M3 |
| Workspace full-text search | todo | M3 |
| File encoding reopen | todo | M3 |
| Large file mode | todo | M4 |
| File associations / installer integration | todo | M6 |

## Editor

| Feature | Status | Milestone |
|---|---|---|
| Markdown source editor | done | M1 |
| Syntax highlighting | done | M1 |
| Live preview / hybrid rendering | todo | M2 |
| Source mode toggle | todo | M2 |
| Formatting shortcuts | todo | M2 |
| Undo / redo | done | M1 |
| Find and replace | wip | M1/M2 |
| Outline panel | done | M1 |
| Word / character / line count | done | M1 |
| Focus mode | todo | M4 |
| Typewriter mode | todo | M4 |
| Read-only mode | todo | M4 |
| Auto pair brackets and Markdown markers | todo | M4 |
| Smart punctuation | todo | M4 |
| Spellcheck | todo | M4 |
| Emoji autocomplete | todo | M4 |
| IME / CJK input coverage | todo | M7 |
| Large-document performance mode | todo | M7 |

## Markdown

| Feature | Status | Milestone |
|---|---|---|
| CommonMark + GFM | wip | M2 |
| Tables | todo | M4 |
| Task lists | todo | M2 |
| Strikethrough | wip | M2 |
| Footnotes | todo | M4 |
| TOC | todo | M4 |
| YAML front matter | todo | M4 |
| Inline/block math | todo | M4 |
| Mermaid diagrams | todo | M4 |
| Code fences with language highlight | wip | M2 |
| GitHub alerts | todo | M4 |
| Highlight / sub / sup | todo | M4 |
| Raw HTML preview (sanitized) | todo | M4 |
| Link reference definitions | todo | M4 |
| Strict mode toggle | todo | M4 |

## Images

| Feature | Status | Milestone |
|---|---|---|
| Insert local image | todo | M4 |
| Drag/drop image | todo | M4 |
| Paste image from clipboard | todo | M4 |
| Copy/move image to asset folder | todo | M4 |
| Relative path / root URL | todo | M4 |
| Image zoom and context menu | todo | M4 |
| Remote image cache | todo | M4 |
| Uploader integration (PicGo/PicList/custom) | todo | M5 |

## Export and import

| Feature | Status | Milestone |
|---|---|---|
| Print | todo | M2 |
| Export HTML | todo | M2 |
| Export PDF | todo | M2 |
| Export image | todo | M5 |
| Copy as Markdown / HTML / plain text | todo | M4 |
| Pandoc import/export | todo | M5 |
| Export profiles | todo | M5 |
| Custom export command | todo | M5 |
| Front matter export options | todo | M5 |
| Page setup / headers / footers | todo | M5 |

## Appearance and settings

| Feature | Status | Milestone |
|---|---|---|
| Design tokens | done | M1 |
| Original light/dark themes | done | M1 |
| Additional built-in themes | todo | M6 |
| User CSS/theme folder | todo | M6 |
| Settings shell | todo | M2 |
| Shortcut editor | todo | M6 |
| Advanced JSON settings | todo | M6 |
| i18n framework (en, zh-Hans, zh-Hant first) | todo | M6 |
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
| Third-party license notices | todo | M0 |
| CI (Windows + Linux) | todo | M0 |
| E2E and golden Markdown tests | todo | M2 |

## Explicit non-goals

- Proprietary activation, license server, account system, or update entitlement.
- Third-party branding, icons, themes, translations, or proprietary assets.
- Bundling GPL Pandoc; Pandoc is optional and externally installed.
- Cloud sync in v1.
- Executing arbitrary scripts embedded in Markdown by default.
