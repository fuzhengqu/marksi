# MarkSI UI specification (M1)

## Layout

```text
┌──────────────────────────────────────────────────────────────┐
│ ☰  MarkSI          document.md                  ◐   ─  □  ✕  │ 38px
├───────────────┬──────────────────────────────────────────────┤
│ Files Outline │                                              │
│ Search        │          # Heading                           │
│               │          paragraph text                      │
│  workspace    │          (max 860px, centered)               │
│  / file tree  │                                              │
│               │                                              │
│               │                                              │
├───────────────┴──────────────────────────────────────────────┤
│ Markdown · UTF-8 · LF          1,234 words · 5,678 chars     │ 30px
└──────────────────────────────────────────────────────────────┘
```

- Title bar: 38px, custom drag region, hamburger, wordmark, document title,
  theme toggle, window controls.
- Sidebar: 270px default, resizable later; tabs Files / Outline / Search.
- Editor: centered column, max-width 860px; the writing surface is quiet.
- Status bar: 30px; document facts on the left, counts on the right.
- No permanent toolbar in the first slice; the floating toolbar arrives with
  live preview in M2.

## Visual language

MarkSI borrows the calm information architecture of a focused writing app, not
its visual assets. The palette, iconography, spacing, and motion are original.

### Tokens

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#fbfbfa` | `#1d2024` |
| `--bg-elevated` | `#ffffff` | `#252930` |
| `--sidebar-bg` | `#f3f2ef` | `#191c20` |
| `--fg` | `#26282b` | `#e7e9ec` |
| `--fg-muted` | `#6f7378` | `#9aa0a8` |
| `--border` | `#e4e2dd` | `#30353c` |
| `--accent` | `#2f6f62` | `#78c6b5` |
| `--accent-soft` | `#e5f1ee` | `#1f3b36` |
| `--selection` | `#cfe7e2` | `#2e5a52` |
| `--danger` | `#b8473d` | `#f08a80` |

Typography:

- UI: `Segoe UI Variable`, `Segoe UI`, system-ui, sans-serif.
- Editor: same family, 16px, line-height 1.7.
- Code: `Cascadia Code`, `JetBrains Mono`, Consolas, monospace, 13.5px.

Spacing: 4 / 8 / 12 / 16 / 24 / 32. Radii: 6 / 10 / 14. Motion: 150–220ms
ease-out; honor `prefers-reduced-motion`.

## Interaction rules

- `Ctrl+N`: new document.
- `Ctrl+O`: open file.
- `Ctrl+Shift+O`: open folder.
- `Ctrl+S`: save.
- `Ctrl+Shift+S`: save as.
- `Ctrl+F`: find panel.
- `Ctrl+B` / `Ctrl+I` / `Ctrl+K`: bold / italic / link (M2).
- Hamburger opens an overlay menu; Escape closes it.
- Sidebar tabs are keyboard reachable and preserve state.
- Unsaved changes are always visible via a dot next to the title.
- The welcome surface appears only for an empty untitled document; typing
  dismisses it.

## Distinctive choices

- A serif-friendly wordmark and a green-teal accent rather than a blue accent.
- A quiet, warm paper light theme and a blue-graphite dark theme.
- Outline and file tree share a compact, low-contrast rail.
- The status bar is an information line, not a control strip; actions live in
  the menu and keyboard shortcuts.
- Original icons from Lucide plus a MarkSI monogram; no icon font copied from
  another editor.
