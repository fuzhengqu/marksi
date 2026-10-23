# MarkSI UI specification (M4)

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
- No permanent toolbar. Formatting and export live in the overlay menu,
  keyboard shortcuts, and the status bar.
- Overlays use a dimmed scrim and a centered surface with a strong title,
  keyboard dismissal, and no nested chrome. Preferences use grouped rows;
  quick open uses a single search field plus a keyboard-navigable result list;
  draft recovery uses a read-only preview and two explicit actions.

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
- Editor: same family, 16px by default, line-height 1.7. The preference range
  is 14–22px.
- Writing column: 860px by default. The preference range is 680–1100px.
- Interface zoom: 100% by default. The preference range is 80%–160% in 10%
  steps and scales the whole application surface.
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
- `Ctrl+H`: find and replace.
- `Ctrl+P`: quick open across recent files and the workspace.
- `Ctrl+Shift+F`: focus workspace search.
- `Ctrl+,`: open preferences.
- `Ctrl+Shift+B`: toggle the sidebar.
- `Ctrl+/`: toggle source and rendered preview.
- `Ctrl+B` / `Ctrl+I` / `Ctrl+K`: bold / italic / link.
- `Ctrl+Shift+I`: insert a local image.
- `Ctrl+Alt+F` / `Ctrl+Alt+T` / `Ctrl+Alt+R`: focus / typewriter /
  read-only mode.
- `Ctrl+Alt+C` / `Ctrl+Alt+H` / `Ctrl+Alt+P`: copy the document as Markdown /
  HTML / plain text.
- `Ctrl+=` / `Ctrl+-` / `Ctrl+0`: zoom the interface in, out, or reset to
  100%.
- Hamburger opens an overlay menu; Escape closes it.
- Sidebar tabs are keyboard reachable and preserve state.
- Unsaved changes are always visible via a dot next to the title.
- The welcome surface appears only for an empty untitled document; typing
  dismisses it.
- Preferences apply immediately and are persisted locally. Reset restores the
  documented defaults.
- Recovery is always user-confirmed: MarkSI never silently overwrites an
  unsaved buffer at startup.
- A clean document reloads when its file changes externally; a dirty document
  keeps local edits and raises a conflict toast.
- Toast messages are transient, non-blocking, and never contain document text.

## Writing modes

- Focus mode dims every line outside the current blank-line-delimited block.
  The active block stays at full contrast, including when it is a heading,
  list, quote, or code fence.
- Typewriter mode keeps the active line near the vertical center of the editor
  after cursor movement and typing. It does not add artificial whitespace or
  alter the document.
- Focus and typewriter affect the source editor only. They can be combined and
  are available from View, Preferences > Writing, and the keyboard.
- Read-only mode disables text input, formatting commands, and every image
  insertion path. Selection, find/replace, copy, export, and print remain
  available. The View items and Preferences show the current state, formatting
  items are disabled, and the status bar displays a Read only badge.
- Writing modes are persisted with the other preferences and restore on the
  next launch.

## Typing assistance

- Auto pair closes `()`, `[]`, `{}`, quotes, and the Markdown markers `*`, `_`,
  `~`, `=`, `$`, and `` ` ``. Typing the same marker again promotes an empty
  single pair to a double pair, which makes `**bold**` and `~~strike~~` quick.
  Typing immediately before an existing closing run moves over it instead of
  duplicating it.
- Auto pair leaves block-leading markers alone. A line that starts with `*`, `-`,
  `_`, `=`, `$`, or a backtick keeps the literal marker so lists, rules, setext
  headings, fences, and display math can be typed normally. Inside code, link
  destinations, and front matter, marker pairing is suppressed.
- Smart punctuation is an opt-in preference and is off by default so Markdown
  syntax remains literal unless the writer asks for typographic input. When
  enabled it produces curly quotes, apostrophes, en/em dashes (`--`/`---`), and
  ellipses (`...`). It skips code, incomplete and complete link destinations and
  titles, YAML front matter, indented code, and line-leading dash syntax.
- Emoji autocomplete offers a curated set of common GitHub-style aliases after
  `:`. Accepting a suggestion replaces the alias with its Unicode emoji. The
  popup is suppressed in code, link destinations, and front matter; the
  preference can turn it off without affecting the rest of the editor.
- The three typing preferences apply immediately through editor compartments
  and persist locally.

## Interface zoom

- View > Zoom in, Zoom out, and Actual size mirror `Ctrl+=`, `Ctrl+-`, and
  `Ctrl+0`. The menu items disable at the 80% and 160% bounds, and Actual size
  disables at 100%.
- Preferences > Appearance exposes the same range as a slider. Zoom affects the
  whole window rather than only editor text; editor text size and writing-column
  width remain separate preferences.
- On Tauri the WebView zoom API is used; if it is unavailable, the frontend
  falls back to a CSS scale. The selected level persists across launches.

## Copy actions

- View > Copy copies the whole document, not just the current selection.
- Copy as Markdown writes the canonical source with platform-native line
  endings. Copy as plain text keeps headings, paragraphs, lists, tables, task
  state, blockquotes, code, alerts, and rendered math while omitting editor and
  preview labels such as footnote backreferences.
- Copy as HTML writes rich HTML derived from the same sanitized renderer used by
  preview and export, including MathML and document-relative image paths. If
  the WebView cannot write rich clipboard data, MarkSI falls back to selecting
  a hidden rendered copy and finally to copying the HTML source.
- Each action confirms success with a transient toast. Clipboard HTML never
  introduces raw HTML or remote asset fetches beyond the normal renderer.

## Images

- The menu exposes Image... under Format. Insertion uses the same flow as
  `Ctrl+Shift+I`, drag/drop, and clipboard paste.
- Inserted images are placed on their own block, with blank lines added at the
  caret when needed. The alt text is derived from the asset filename.
- Preferences > Images configures a document-relative asset folder. The default
  is `assets`; absolute paths and `..` traversal are rejected.
- Local images render inline in preview. Remote images, unsafe sources, and
  missing files render as labelled placeholders instead of making a network
  request.
- Clicking a rendered image opens a full-window lightbox over a dimmed scrim.
  The toolbar provides zoom out, zoom in, reset, and close. `+`, `-`, `0`, and
  `Esc` work from the keyboard. Zoom is bounded to 50%-400%.
- The lightbox is a viewing surface only; it never edits the Markdown source or
  copies an asset.

## Extended Markdown

- YAML front matter is recognized only at the top of a document and is hidden
  from preview. The source remains visible and editable in the editor. HTML
  export reads `title`, `author`, `description`, `keywords`, and `tags` for
  document metadata.
- A paragraph containing only `[TOC]` is replaced by a linked contents block
  built from the document headings. The block updates as headings change, and
  the placeholder disappears when there are no headings.
- Footnotes use `[^label]` definitions or inline `^[note]` syntax. Footnote
  links and backlinks scroll within preview.
- GitHub alerts use `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`,
  `> [!WARNING]`, or `> [!CAUTION]`. They render as labeled, theme-aware
  callouts.
- Inline `$...$` and display `$$...$$` math render with KaTeX in preview.
  Display formulas are centered and can scroll horizontally when wide.
- `==highlight==`, `~subscript~`, and `^superscript^` use the normal text color
  with subtle themed treatment.
- Link reference definitions work throughout the document.
- Raw HTML stays escaped and inert. Unsafe link destinations are not activated,
  and math rendering does not enable KaTeX HTML or trust extensions.

## Distinctive choices

- A serif-friendly wordmark and a green-teal accent rather than a blue accent.
- A quiet, warm paper light theme and a blue-graphite dark theme.
- Outline and file tree share a compact, low-contrast rail.
- The status bar is an information line, not a control strip; actions live in
  the menu and keyboard shortcuts.
- Original icons from Lucide plus a MarkSI monogram; no icon font copied from
  another editor.
