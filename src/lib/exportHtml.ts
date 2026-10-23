import { escapeHtml, renderMarkdown } from "./markdown";
import { extractFrontMatter } from "./frontMatter";
import { renderMermaidMarkup } from "./mermaid";
import type { Language } from "../types";

interface ExportDocumentOptions {
  title: string;
  content: string;
  language?: Language;
  strictMode?: boolean;
}

const documentStyles = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
html { background: #fbfbfa; }
body {
  margin: 0;
  padding: 64px 24px 96px;
  background: #fbfbfa;
  color: #26282b;
  font-family: "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif;
  font-size: 16px;
  line-height: 1.75;
  -webkit-font-smoothing: antialiased;
}
.markdown-body { max-width: 800px; margin: 0 auto; }
h1, h2, h3, h4, h5, h6 {
  margin: 1.8em 0 0.65em;
  color: #202326;
  line-height: 1.28;
  letter-spacing: -0.018em;
}
h1 {
  margin-top: 0.2em;
  padding-bottom: 0.32em;
  border-bottom: 1px solid #e4e2dd;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 2.25em;
  font-weight: 600;
  letter-spacing: -0.03em;
}
h2 { font-size: 1.58em; font-weight: 680; }
h3 { font-size: 1.3em; font-weight: 650; }
h4 { font-size: 1.13em; font-weight: 650; }
h5 { font-size: 1.02em; font-weight: 650; }
h6 { color: #6f7378; font-size: 0.96em; font-weight: 650; }
p { margin: 0.85em 0; }
a { color: #2f6f62; text-decoration: underline; text-underline-offset: 2px; }
strong { font-weight: 680; }
del { color: #6f7378; }
mark {
  padding: 0.05em 0.18em;
  border-radius: 3px;
  background: #fff0a8;
  color: inherit;
}
sub, sup { font-size: 0.75em; line-height: 0; }
sub { vertical-align: sub; }
sup { vertical-align: super; }
.math-error {
  color: #b8473d;
  font-family: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
}
.math-display, .katex-display {
  overflow-x: auto;
  overflow-y: hidden;
  margin: 1.35em 0;
  padding: 0.2em 0;
}
.math-display { text-align: center; }
.math-display .katex { display: block; }
.math-display math {
  width: fit-content;
  margin-left: auto;
  margin-right: auto;
}
math { font-size: 1.05em; }
.table-of-contents {
  margin: 1.5em 0;
  padding: 14px 18px;
  border: 1px solid #e4e2dd;
  border-radius: 9px;
  background: #f5f3ef;
}
.toc-title {
  margin-bottom: 0.55em;
  color: #6f7378;
  font-size: 0.72em;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.toc-list { margin: 0; padding: 0; list-style: none; }
.toc-list li { margin: 0.2em 0; }
.toc-list a { color: #26282b; text-decoration: none; }
.toc-list a:hover { color: #2f6f62; text-decoration: underline; }
.toc-level-2 { padding-left: 1.1em; }
.toc-level-3 { padding-left: 2.2em; }
.toc-level-4 { padding-left: 3.3em; }
.toc-level-5 { padding-left: 4.4em; }
.toc-level-6 { padding-left: 5.5em; }
.markdown-alert {
  margin: 1.35em 0;
  padding: 12px 16px 0.9em;
  border-left: 4px solid #3f7fbf;
  border-radius: 0 8px 8px 0;
  background: #eef4fb;
}
.markdown-alert > :last-child { margin-bottom: 0; }
.markdown-alert-title {
  margin: 0 0 0.4em;
  color: #3f7fbf;
  font-size: 0.82em;
  font-weight: 700;
  letter-spacing: 0.055em;
  text-transform: uppercase;
}
.markdown-alert-tip { border-left-color: #3f8a64; background: #eef7f1; }
.markdown-alert-tip .markdown-alert-title { color: #3f8a64; }
.markdown-alert-important { border-left-color: #7b64b6; background: #f3effa; }
.markdown-alert-important .markdown-alert-title { color: #7b64b6; }
.markdown-alert-warning { border-left-color: #a87a2d; background: #fbf5e8; }
.markdown-alert-warning .markdown-alert-title { color: #a87a2d; }
.markdown-alert-caution { border-left-color: #b25050; background: #fbeeee; }
.markdown-alert-caution .markdown-alert-title { color: #b25050; }
.footnotes-sep { margin-top: 2.6em; }
.footnotes {
  margin-top: 1.4em;
  color: #6f7378;
  font-size: 0.9em;
}
.footnotes-list { padding-left: 1.5em; }
.footnote-item { margin: 0.35em 0; }
.footnote-ref { font-size: 0.72em; line-height: 0; }
.footnote-ref a { text-decoration: none; }
.footnote-backref { text-decoration: none; }
hr { margin: 2.2em 0; border: 0; border-top: 1px solid #e4e2dd; }
blockquote {
  margin: 1.2em 0;
  padding: 0.1em 1.2em;
  border-left: 3px solid #2f6f62;
  color: #5f646a;
  font-style: italic;
}
ul, ol { padding-left: 1.65em; }
li { margin: 0.24em 0; }
li > p { margin: 0.35em 0; }
code {
  padding: 0.12em 0.35em;
  border-radius: 4px;
  background: #eaf1ef;
  color: #2f5d55;
  font-family: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
  font-size: 0.88em;
}
pre {
  overflow: auto;
  margin: 1.2em 0;
  padding: 18px 20px;
  border-radius: 10px;
  background: #20252a;
  color: #e6edf3;
  line-height: 1.62;
}
pre code { padding: 0; background: transparent; color: inherit; font-size: 0.88em; }
.code-block {
  overflow: hidden;
  margin: 1.3em 0;
  border: 1px solid #30373e;
  border-radius: 10px;
  background: #20252a;
}
.code-block-head {
  padding: 7px 14px;
  border-bottom: 1px solid #30373e;
  color: #8b959f;
  font-family: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.code-block pre { margin: 0; border-radius: 0; }
.mermaid-block { margin: 1.35em 0; }
.mermaid-diagram {
  display: flex;
  justify-content: center;
  overflow-x: auto;
  padding: 16px;
  border: 1px solid #e4e2dd;
  border-radius: 10px;
  background: #ffffff;
}
.mermaid-diagram svg { max-width: 100%; height: auto; }
.mermaid-source { margin-top: 7px; color: #6f7378; font-size: 0.78em; }
.mermaid-source summary { cursor: pointer; }
.mermaid-source pre { margin-top: 6px; }
.mermaid-error {
  padding: 14px;
  color: #b8473d;
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 0.82em;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.table-scroll { overflow-x: auto; margin: 1.25em 0; }
table { width: 100%; border-collapse: collapse; font-size: 0.94em; }
th, td { padding: 8px 11px; border: 1px solid #e4e2dd; text-align: left; vertical-align: top; }
th { background: #f3f2ef; font-weight: 650; }
tr:nth-child(even) td { background: #faf9f7; }
.contains-task-list { padding-left: 0.35em; list-style: none; }
.task-list-item { list-style: none; }
.task-checkbox {
  position: relative;
  width: 14px;
  height: 14px;
  margin: 0 8px 0 0;
  border: 1px solid #c9c5bc;
  border-radius: 3px;
  background: transparent;
  vertical-align: -2px;
  appearance: none;
}
.task-checkbox:checked { border-color: #2f6f62; background: #2f6f62; }
.task-checkbox:checked::after {
  content: "";
  position: absolute;
  left: 4px;
  top: 1px;
  width: 3px;
  height: 7px;
  border: solid #ffffff;
  border-width: 0 1.5px 1.5px 0;
  transform: rotate(45deg);
}
.markdown-body img {
  max-width: 100%;
  border-radius: 8px;
}
.markdown-body img:not([height]) {
  height: auto;
}
.image-placeholder {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 10px;
  border: 1px dashed #c9c5bc;
  border-radius: 7px;
  background: #f5f3ef;
  color: #74777b;
  font-size: 0.9em;
}
.image-placeholder-copy { display: inline-flex; flex-direction: column; gap: 1px; }
.image-placeholder-url {
  max-width: 46ch;
  overflow: hidden;
  color: #9a9c9e;
  font-family: "Cascadia Code", monospace;
  font-size: 0.72em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.image-placeholder-mark {
  padding: 1px 3px;
  border: 1px solid currentColor;
  border-radius: 3px;
  color: #2f6f62;
  font-family: "Cascadia Code", monospace;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1.2;
}
.hljs-comment, .hljs-quote { color: #7f8c9b; font-style: italic; }
.hljs-keyword, .hljs-selector-tag, .hljs-literal { color: #d3a2df; }
.hljs-string, .hljs-doctag, .hljs-regexp { color: #a8d08d; }
.hljs-number, .hljs-built_in, .hljs-symbol { color: #e0b07f; }
.hljs-title, .hljs-section, .hljs-name, .hljs-selector-id, .hljs-selector-class { color: #78c6b5; }
.hljs-type, .hljs-class .hljs-title, .hljs-attr, .hljs-attribute { color: #8fc7e8; }
.hljs-variable, .hljs-template-variable, .hljs-params { color: #d8dee4; }
.hljs-meta, .hljs-tag { color: #b8c2cc; }
.hljs-emphasis { font-style: italic; }
.hljs-strong { font-weight: 700; }
@media print {
  body { padding: 0; background: #fff; }
  .markdown-body { max-width: none; }
  pre, blockquote, table, .markdown-alert, .table-of-contents, .mermaid-block {
    break-inside: avoid;
  }
  .code-block, .task-checkbox:checked {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  a { color: inherit; }
}
`;

export async function buildStandaloneHtml({
  title,
  content,
  language = "zh-CN",
  strictMode = true,
}: ExportDocumentOptions): Promise<string> {
  const frontMatter = extractFrontMatter(content);
  const metadata = frontMatter?.metadata ?? {};
  const safeTitle = escapeHtml(
    (metadata.title || title).trim() || "Untitled",
  );
  const metaTags = [
    metadata.author
      ? `<meta name="author" content="${escapeHtml(metadata.author)}">`
      : "",
    metadata.description
      ? `<meta name="description" content="${escapeHtml(
          metadata.description,
        )}">`
      : "",
    metadata.keywords || metadata.tags
      ? `<meta name="keywords" content="${escapeHtml(
          metadata.keywords || metadata.tags,
        )}">`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const body = await renderMermaidMarkup(
    renderMarkdown(content, {
      imageMode: "export",
      mathOutput: "mathml",
      strictMode,
    }),
    "light",
  );
  return `<!doctype html>
<html lang="${language === "zh-CN" ? "zh-CN" : "en"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="MarkSI">
<title>${safeTitle}</title>
${metaTags}
<style>${documentStyles}</style>
</head>
<body>
<article class="markdown-body">
${body}
</article>
</body>
</html>
`;
}

export function htmlExportName(documentName: string): string {
  const base = documentName.replace(/\.[^.\\/]+$/, "").trim() || "Untitled";
  return `${base}.html`;
}

export function htmlExportPath(
  documentPath: string | null,
  documentName: string,
): string {
  const fileName = htmlExportName(documentName);
  if (!documentPath) {
    return fileName;
  }
  const separator = Math.max(
    documentPath.lastIndexOf("/"),
    documentPath.lastIndexOf("\\"),
  );
  return separator >= 0
    ? `${documentPath.slice(0, separator + 1)}${fileName}`
    : fileName;
}
