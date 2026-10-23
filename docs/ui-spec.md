# MarkSI UI specification (M4/M5)

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

MarkSI uses a content-first, quiet information architecture. Its palette,
iconography, spacing, and motion are designed for this project.

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

- UI: `Segoe UI Variable`, `Segoe UI`, Microsoft YaHei UI, Noto Sans CJK SC,
  PingFang SC, system-ui, sans-serif.
- Editor: same family, 16px by default, line-height 1.7. The preference range
  is 14–22px.
- Interface language: Chinese (`zh-CN`) by default, English available. The
  preference applies immediately to menus, dialogs, sidebar, status bar, and
  editor search.
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
- Saving a new document suggests its first level-one heading as the filename,
  with invalid filesystem characters replaced and a `.md` extension added when
  needed. If the document has no level-one heading, the existing
  `未命名.md` / `Untitled.md` name is kept. Existing documents keep their
  current filename in Save As.
- `Ctrl+F`: find panel.
- `Ctrl+H`: find and replace.
- `Ctrl+P`: quick open across recent files and the workspace.
- `Ctrl+Shift+F`: focus workspace search.
- `Ctrl+,`: open preferences.
- `Ctrl+Shift+B`: toggle the sidebar.
- `Ctrl+/`: toggle source and editable live preview.
- View > Reading view opens the fully rendered, read-only surface. The status
  bar returns to source from reading mode.
- `Ctrl+B` / `Ctrl+I` / `Ctrl+K`: bold / italic / link.
- `Ctrl+Shift+I`: insert a local image.
- `Ctrl+Alt+F` / `Ctrl+Alt+T` / `Ctrl+Alt+R`: focus / typewriter /
  read-only mode.
- `Ctrl+Alt+C` / `Ctrl+Alt+H` / `Ctrl+Alt+P`: copy the document as Markdown /
  HTML / plain text.
- `Ctrl+=` / `Ctrl+-` / `Ctrl+0`: zoom the interface in, out, or reset to
  100%.
- Hamburger reveals a compact single-row menu bar. File takes over the hamburger’s
  position, followed by Edit, Format, View, and Help; the hamburger is hidden
  while the bar is open. The category row is the only thing shown on first
  click; clicking a category opens its dropdown, and moving across categories
  switches the dropdown while it is open. Clicking blank space closes the bar
  and restores the hamburger. Escape also closes it. Export, Preferences, and
  Quit MarkSI are File items; Edit contains the copy actions. The menu has no
  per-dropdown footer. About uses only its top-right close button.
- Sidebar tabs are keyboard reachable and preserve state. An empty workspace
  shows four actions above Recent files: Open file, Open folder, Quick open,
  and New document. There is no footer action row.
- Recent rows keep their remove `×` hidden until the row is hovered or the
  button receives keyboard focus. The button removes only that row. File >
  Clear recent files removes the entire list and leaves the empty-state copy.
- MarkSI boots directly into the editable live-preview surface. There is no
  full-screen welcome page; an empty document shows the editor prompt and is
  ready for typing immediately.
- New document clears the editor, focuses the blank editor, and shows a
  confirmation toast so the transition is unambiguous.
- About displays the product version, starting at `0.01`. Each bug-fix or
  feature release increments it by exactly `0.01`; versions never skip.
- Unsaved changes are always visible via a dot next to the title.
- The initial empty untitled document uses the normal editor surface; typing,
  opening a file, or choosing New document replaces the empty state directly.
- Preferences apply immediately and are persisted locally. Reset restores the
  documented defaults.
- Recovery is always user-confirmed: MarkSI never silently overwrites an
  unsaved buffer at startup.
- A clean document reloads when its file changes externally; a dirty document
  keeps local edits and raises a conflict toast.
- Toast messages are transient, non-blocking, and never contain document text.

## View modes

- Opened documents and new blank documents start in live preview.
- Source mode always shows the canonical Markdown source.
- Live preview keeps the same CodeMirror editing surface. Formatting
  punctuation (`#`, emphasis marks, link destinations, and inline-code ticks)
  is hidden on inactive lines; the active line reveals its source markers.
  Editing, selections, undo history, find/replace, and save operate on the
  original Markdown text.
- Reading view renders the full sanitized document with images, tables, code
  fences, Mermaid diagrams, and math. It is read-only; the status bar returns
  to source, and the View menu can open it from any mode.
- Live preview is intentionally text-first: rendering complex blocks inline is
  an ongoing M5/M6 polish area, while the reading view remains the complete
  rendered representation.

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

## Markdown strictness

- Strict mode is on by default and requires whitespace after ATX heading
  markers (`### Title`). It can be disabled in Preferences > Markdown.
- With strict mode off, compact headings such as `###Title` render as headings
  in reading view, export, copy, and the outline. The canonical Markdown source
  is never rewritten.
- Fenced code, front matter, and indented code keep their literal markers in
  both modes.

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

- Edit > Copy copies the whole document, not just the current selection.
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

## Export

- File > Export... opens a compact dialog with Document, Print, Minimal, and
  Custom profiles. Choosing a preset fills the controls; editing any control
  switches the profile to Custom and persists the resulting options.
- Front matter controls whether YAML metadata supplies the HTML title, whether
  author/description/keywords meta tags are emitted, and whether a sanitized
  metadata panel appears above the exported body. Metadata values are escaped;
  front matter itself is never rendered as document content.
- Page setup controls paper size, orientation, margins, and optional header and
  footer templates. Templates accept `{title}`, `{page}`, and `{pages}`. The
  dialog shows the token help inline.
- Export HTML writes a standalone file through the native save dialog. Print /
  PDF switches to reading view, injects the same `@page` rules, waits for
  Mermaid rendering, and opens the system print dialog.
- Image (PNG)... in the File menu switches to reading view, waits for images,
  fonts, and Mermaid, then captures the full rendered document using the current
  theme. Canvas size is bounded; very long documents are rejected rather than
  silently producing an unreadable or blank image. The native save dialog uses a
  `.png` filter.
- Preferences can store a custom export executable and one argument per line.
  When configured, the dialog shows a Custom export action. It saves the HTML
  first, expands `{input}`, `{document}`, and `{title}` per argument, then runs
  the executable directly in the export folder. There is no shell, output is
  discarded, and a non-zero exit code is shown as an error toast. Without a
  configured program the action is disabled and the dialog explains why.
- The operating system print dialog may add or override headers and footers.
  CSS margin-box support varies by print engine; the exported HTML remains valid
  when a margin box is ignored.
- Empty documents show an inline note and disable both export actions.

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
- Right-click a loaded image for a compact action menu: View image, Fit:
  contain, Fit: cover, Original size, and local-file actions (Copy image path,
  Open image, Reveal in folder). Fit and reset actions are hidden in read-only
  mode. The menu stays inside the viewport, follows the shared menu-item visual
  language, and dismisses on Escape, outside click, scroll, or resize.
  Placeholders and remote images do not open it.
- Image dimensions are written in the canonical source as width, optional
  height, and optional fit attributes:
  `![alt](image.png){width=320 height=180 fit=contain}`. The attribute block
  must follow the image immediately; resizing normalizes a spaced block onto
  the image. Width-only images preserve their aspect ratio. Fit modes fill
  missing dimensions from the current rendered size and use `object-fit`
  contain or cover; Original size removes width, height, and fit.
- Loaded images in reading view reveal a width handle at the right edge and a
  height handle at the bottom edge on hover or keyboard focus when read-only
  mode is off. Drag the width handle horizontally or use Left/Right; drag the
  height handle vertically or use Up/Down. Both dimensions are bounded to
  24–1600 px and the source is updated when the gesture ends as one undoable
  editor transaction. Explicit width and height are independent; resizing one
  does not silently remove the other.
- Handles are omitted in read-only mode and for footnote images; placeholders
  and remote images are not resizable. Resizing is the only source-editing
  affordance in reading view; text remains read-only.
- Width, height, and fit attributes are preserved through reading view, HTML
  export, rich clipboard HTML, and print. The lightbox remains a viewing surface
  and never edits the Markdown source or copies an asset.

## Mermaid diagrams

- A fenced block with the `mermaid` language renders as a diagram in preview.
  The source disclosure below the diagram stays collapsed by default and opens
  automatically when rendering fails.
- The Mermaid runtime is loaded lazily on the first diagram, not at application
  startup. Theme changes re-render diagrams with the light or dark palette.
- Diagrams are centered in a bordered surface and may scroll horizontally when
  wide. The preview never executes diagram click directives.
- Syntax errors show a concise, wrapped message and keep the source visible.
  Invalid diagrams do not affect the rest of the preview.
- HTML export, rich HTML copy, and print include the rendered SVG. Plain-text
  copy keeps the Mermaid source rather than an empty placeholder.

## Extended Markdown

- YAML front matter is recognized only at the top of a document and is hidden
  from preview. The source remains visible and editable in the editor. HTML
  export can read `title`, `author`, `date`, `description`, `keywords`, and
  `tags` for document metadata; the export dialog can disable all front matter
  use or enable a visible document-info panel.
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
- Mermaid uses strict security and disables HTML labels. Its SVG is sanitized
  with a dedicated profile; scripts and foreign objects are rejected.
- Raw HTML stays escaped and inert. Unsafe link destinations are not activated,
  and math rendering does not enable KaTeX HTML or trust extensions.

## Distinctive choices

- A serif-friendly wordmark and a green-teal accent rather than a blue accent.
- A quiet, warm paper light theme and a blue-graphite dark theme.
- Outline and file tree share a compact, low-contrast rail.
- The status bar is an information line, not a control strip; actions live in
  the menu and keyboard shortcuts.
- Lucide icons plus a MarkSI monogram; no third-party icon font is bundled.
