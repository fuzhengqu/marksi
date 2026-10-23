import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

export const markdownHighlightStyle = HighlightStyle.define([
  {
    tag: tags.heading1,
    fontSize: "1.9em",
    fontWeight: "700",
    lineHeight: "1.35",
    letterSpacing: "-0.025em",
  },
  {
    tag: tags.heading2,
    fontSize: "1.55em",
    fontWeight: "700",
    lineHeight: "1.4",
    letterSpacing: "-0.018em",
  },
  {
    tag: tags.heading3,
    fontSize: "1.3em",
    fontWeight: "650",
    lineHeight: "1.45",
  },
  {
    tag: tags.heading4,
    fontSize: "1.15em",
    fontWeight: "650",
  },
  {
    tag: tags.heading5,
    fontSize: "1.05em",
    fontWeight: "650",
  },
  {
    tag: tags.heading6,
    fontSize: "1em",
    fontWeight: "650",
    color: "var(--fg-muted)",
  },
  { tag: tags.strong, fontWeight: "680" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "var(--fg-muted)" },
  {
    tag: tags.link,
    color: "var(--accent)",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  },
  { tag: tags.url, color: "var(--fg-muted)" },
  {
    tag: tags.monospace,
    fontFamily: "var(--font-mono)",
    fontSize: "0.9em",
    color: "var(--syntax-code)",
  },
  { tag: [tags.meta, tags.comment], color: "var(--fg-faint)" },
  { tag: tags.quote, color: "var(--fg-muted)", fontStyle: "italic" },
  { tag: tags.list, color: "var(--accent)" },
  { tag: [tags.keyword, tags.operator], color: "var(--syntax-keyword)" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--syntax-string)" },
  { tag: [tags.number, tags.bool, tags.null], color: "var(--syntax-number)" },
  { tag: [tags.typeName, tags.className], color: "var(--syntax-type)" },
  {
    tag: [tags.function(tags.variableName), tags.definition(tags.variableName)],
    color: "var(--syntax-function)",
  },
  { tag: tags.variableName, color: "var(--syntax-variable)" },
  { tag: tags.invalid, color: "var(--danger)" },
]);

export const markEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "transparent",
    color: "var(--fg)",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-editor)",
    fontSize: "16px",
    lineHeight: "1.72",
    overflow: "auto",
  },
  ".cm-content": {
    padding: "48px 8px 180px",
    maxWidth: "var(--content-width)",
    margin: "0 auto",
    caretColor: "var(--accent)",
  },
  ".cm-line": {
    padding: "0 8px",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--selection)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--accent)",
    borderLeftWidth: "2px",
  },
  ".cm-placeholder": {
    color: "var(--fg-faint)",
    fontStyle: "normal",
  },
  ".cm-panels": {
    backgroundColor: "var(--bg-elevated)",
    color: "var(--fg)",
    borderColor: "var(--border)",
  },
  ".cm-panel.cm-search": {
    padding: "8px 12px",
    fontFamily: "var(--font-ui)",
    fontSize: "12px",
  },
  ".cm-panel.cm-search input, .cm-panel.cm-search button": {
    fontFamily: "var(--font-ui)",
    fontSize: "12px",
  },
  ".cm-searchMatch": {
    backgroundColor: "var(--search-match)",
    outline: "1px solid var(--accent)",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "var(--search-match-selected)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    color: "var(--fg)",
    borderRadius: "8px",
    boxShadow: "var(--shadow)",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "var(--accent-soft)",
    color: "var(--fg)",
  },
  ".cm-selectionMatch": {
    backgroundColor: "var(--selection)",
  },
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },
});

export const markdownSyntaxTheme = syntaxHighlighting(markdownHighlightStyle);
