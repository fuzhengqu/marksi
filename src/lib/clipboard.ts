import { copyText } from "./clipboardText";
import { renderMarkdown } from "./markdown";
import { renderMermaidMarkup } from "./mermaid";
import type { Theme } from "../types";

export interface ClipboardDocument {
  html: string;
  text: string;
}

const BLOCK_TAGS = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "DD",
  "DIV",
  "DL",
  "DT",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "LI",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "UL",
]);

const SPACING_CONTAINERS = new Set([
  "DIV",
  "OL",
  "TABLE",
  "TBODY",
  "THEAD",
  "TR",
  "UL",
]);

function nodeText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    const parent = node.parentElement?.tagName;
    if (!text.trim() && parent && SPACING_CONTAINERS.has(parent)) {
      return "";
    }
    return text;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as HTMLElement;
  const tag = element.tagName;

  if (
    tag === "SCRIPT" ||
    tag === "STYLE" ||
    tag === "ANNOTATION" ||
    element.classList.contains("footnote-backref") ||
    element.classList.contains("code-block-head") ||
    element.classList.contains("katex-mathml")
  ) {
    return "";
  }
  if (tag === "BR") {
    return "\n";
  }
  if (tag === "HR") {
    return "\n---\n";
  }
  if (tag === "IMG") {
    return element.getAttribute("alt") ?? "";
  }
  if (tag === "INPUT" && element.getAttribute("type") === "checkbox") {
    return (element as HTMLInputElement).checked ? "[x] " : "[ ] ";
  }

  const inner = Array.from(element.childNodes).map(nodeText).join("");

  if (tag === "TD" || tag === "TH") {
    return `${inner.trim()}\t`;
  }
  if (tag === "TR") {
    return `\n${inner.trimEnd()}\n`;
  }
  if (tag === "LI") {
    return `- ${inner.trim()}\n`;
  }
  if (BLOCK_TAGS.has(tag)) {
    return `\n${inner.trim()}\n`;
  }
  if (element.classList.contains("katex-display")) {
    return `\n${inner}\n`;
  }
  return inner;
}

export function htmlToPlainText(root: ParentNode): string {
  return Array.from(root.childNodes)
    .map(nodeText)
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function buildClipboardDocument(
  source: string,
  options: { theme?: Theme; diagrams?: boolean } = {},
): Promise<ClipboardDocument> {
  let html = renderMarkdown(source, {
    imageMode: "export",
    mathOutput: "mathml",
  });
  if (options.diagrams && html.includes('class="mermaid-diagram"')) {
    html = await renderMermaidMarkup(html, options.theme ?? "light");
  }
  const textHtml = renderMarkdown(source, {
    imageMode: "export",
    mathOutput: "html",
  });
  const parsedHtml = new DOMParser().parseFromString(html, "text/html");
  const parsedText = new DOMParser().parseFromString(textHtml, "text/html");
  return {
    html: parsedHtml.body.innerHTML,
    text: htmlToPlainText(parsedText.body),
  };
}

function copyRichHtmlLegacy(html: string): boolean {
  const previousFocus =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const container = document.createElement("div");
  container.contentEditable = "true";
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.whiteSpace = "normal";
  container.innerHTML = html;
  document.body.appendChild(container);

  const selection = window.getSelection();
  const previousRanges: Range[] = [];
  if (selection) {
    for (let index = 0; index < selection.rangeCount; index += 1) {
      previousRanges.push(selection.getRangeAt(index).cloneRange());
    }
  }

  try {
    const range = document.createRange();
    range.selectNodeContents(container);
    selection?.removeAllRanges();
    selection?.addRange(range);
    return document.execCommand("copy");
  } finally {
    container.remove();
    if (selection) {
      selection.removeAllRanges();
      previousRanges.forEach((range) => selection.addRange(range));
    }
    previousFocus?.focus({ preventScroll: true });
  }
}

export async function copyRichHtml(
  content: ClipboardDocument,
): Promise<"rich" | "source"> {
  if (
    typeof ClipboardItem !== "undefined" &&
    typeof navigator.clipboard?.write === "function"
  ) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([content.html], { type: "text/html" }),
          "text/plain": new Blob([content.text], { type: "text/plain" }),
        }),
      ]);
      return "rich";
    } catch {
      // Some WebView versions expose ClipboardItem but reject rich writes.
    }
  }

  try {
    if (copyRichHtmlLegacy(content.html)) {
      return "rich";
    }
  } catch {
    // The selection-based path is best-effort in restricted WebViews.
  }

  await copyText(content.html);
  return "source";
}
