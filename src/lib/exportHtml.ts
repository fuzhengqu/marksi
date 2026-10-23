import { escapeHtml, renderMarkdown } from "./markdown";

interface ExportDocumentOptions {
  title: string;
  content: string;
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
  pre, blockquote, table { break-inside: avoid; }
  .code-block, .task-checkbox:checked {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  a { color: inherit; }
}
`;

export function buildStandaloneHtml({
  title,
  content,
}: ExportDocumentOptions): string {
  const safeTitle = escapeHtml(title.trim() || "Untitled");
  const body = renderMarkdown(content);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="MarkSI">
<title>${safeTitle}</title>
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
