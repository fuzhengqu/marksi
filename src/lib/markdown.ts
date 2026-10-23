import MarkdownIt, { type StateBlock, type Token } from "markdown-it";
import DOMPurify from "dompurify";
import { alert } from "@mdit/plugin-alert";
import { footnote } from "@mdit/plugin-footnote";
import { mark } from "@mdit/plugin-mark";
import { sub } from "@mdit/plugin-sub";
import { sup } from "@mdit/plugin-sup";
import { tex } from "@mdit/plugin-tex";
import katex from "katex";
import "katex/dist/katex.min.css";
import { extractFrontMatter } from "./frontMatter";
import { classifyImageSource } from "./images";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import go from "highlight.js/lib/languages/go";
import ini from "highlight.js/lib/languages/ini";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdownLanguage from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("css", css);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("dockerfile", dockerfile);
hljs.registerLanguage("go", go);
hljs.registerLanguage("ini", ini);
hljs.registerLanguage("java", java);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdownLanguage);
hljs.registerLanguage("python", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("yaml", yaml);

type MathOutput = "html" | "mathml";

interface MarkdownEnvironment {
  [key: string | symbol]: unknown;
  imageMode?: "preview" | "export";
  mathOutput?: MathOutput;
}

const ALERT_TITLES: Record<string, string> = {
  caution: "Caution",
  important: "Important",
  note: "Note",
  tip: "Tip",
  warning: "Warning",
};

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  breaks: false,
});

md.use(footnote)
  .use(mark)
  .use(sub)
  .use(sup)
  .use(alert, {
    titleRenderer: (tokens, index) => {
      const name = String(tokens[index].markup ?? "").toLowerCase();
      return `<p class="markdown-alert-title">${escapeHtml(
        ALERT_TITLES[name] ?? name,
      )}</p>\n`;
    },
  })
  .use(tex, {
    delimiters: "dollars",
    render: (content, displayMode, environment) => {
      const output =
        (environment as MarkdownEnvironment | undefined)?.mathOutput ?? "html";
      try {
        const rendered = katex.renderToString(content, {
          displayMode,
          output,
          strict: "ignore",
          throwOnError: false,
          trust: false,
        });
        return displayMode && output === "mathml"
          ? `<div class="math-display">${rendered}</div>`
          : rendered;
      } catch {
        return displayMode
          ? `<div class="math-display"><code class="math-error">${escapeHtml(
              content,
            )}</code></div>`
          : `<code class="math-error">${escapeHtml(content)}</code>`;
      }
    },
  });

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugifyHeading(value: string): string {
  return (
    value
      .replace(/<[^>]*>/g, "")
      .replace(/[`*_~[\]()#>!]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\p{L}\p{N}\-_]/gu, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "section"
  );
}

function plainInlineText(token: Token | undefined): string {
  if (!token) {
    return "";
  }
  if (!token.children?.length) {
    return token.content;
  }

  return token.children
    .map((child) => {
      if (child.type === "softbreak" || child.type === "hardbreak") {
        return " ";
      }
      if (child.type === "html_inline") {
        return "";
      }
      if (child.children?.length) {
        return plainInlineText(child);
      }
      return child.content;
    })
    .join("");
}

function frontMatterRule(
  state: StateBlock,
  startLine: number,
  _endLine: number,
  silent: boolean,
): boolean {
  if (startLine !== 0) {
    return false;
  }

  const frontMatter = extractFrontMatter(state.src);
  if (!frontMatter) {
    return false;
  }
  if (silent) {
    return true;
  }

  const token = state.push("front_matter", "", 0);
  token.block = true;
  token.content = frontMatter.raw;
  token.map = [0, frontMatter.lineCount];
  state.line = frontMatter.lineCount;
  return true;
}

md.block.ruler.before("hr", "marksi_front_matter", frontMatterRule, {
  alt: ["paragraph", "reference", "blockquote", "list"],
});
md.renderer.rules.front_matter = () => "";

md.core.ruler.push("marksi_source_map", (state) => {
  const seen = new Map<string, number>();

  state.tokens.forEach((token, index) => {
    if (
      token.map &&
      token.type !== "inline" &&
      token.nesting >= 0
    ) {
      token.attrSet("data-source-line", String(token.map[0] + 1));
    }

    if (token.type === "heading_open") {
      const inline = state.tokens[index + 1];
      const base = slugifyHeading(plainInlineText(inline));
      const duplicate = seen.get(base) ?? 0;
      seen.set(base, duplicate + 1);
      token.attrSet("id", duplicate === 0 ? base : `${base}-${duplicate}`);
    }
  });
});

interface TocHeading {
  level: number;
  id: string;
  text: string;
}

md.core.ruler.push("marksi_toc", (state) => {
  const headings: TocHeading[] = [];
  for (let index = 0; index < state.tokens.length; index += 1) {
    const token = state.tokens[index];
    if (token.type !== "heading_open") {
      continue;
    }
    const id = token.attrGet("id");
    if (!id) {
      continue;
    }
    headings.push({
      level: Number(token.tag.slice(1)) || 1,
      id: String(id),
      text: plainInlineText(state.tokens[index + 1]),
    });
  }

  for (let index = 0; index < state.tokens.length; index += 1) {
    const open = state.tokens[index];
    const inline = state.tokens[index + 1];
    const close = state.tokens[index + 2];
    if (
      open?.type !== "paragraph_open" ||
      inline?.type !== "inline" ||
      close?.type !== "paragraph_close" ||
      inline.content.trim().toLowerCase() !== "[toc]" ||
      inline.children?.[0]?.type !== "text"
    ) {
      continue;
    }

    const token = new state.Token("toc", "", 0);
    token.map = open.map;
    token.meta = { headings };
    token.attrSet(
      "data-source-line",
      String((open.map?.[0] ?? 0) + 1),
    );
    state.tokens.splice(index, 3, token);
  }
});

md.renderer.rules.toc = (tokens, index) => {
  const token = tokens[index];
  const headings = (token.meta?.headings ?? []) as TocHeading[];
  if (!headings.length) {
    return "";
  }

  const sourceLine = token.attrGet("data-source-line");
  const items = headings
    .map(
      (heading) =>
        `<li class="toc-level-${heading.level}"><a href="#${escapeHtml(
          heading.id,
        )}">${escapeHtml(heading.text)}</a></li>`,
    )
    .join("");
  return [
    `<nav class="table-of-contents" aria-label="Table of contents"`,
    sourceLine ? ` data-source-line="${escapeHtml(String(sourceLine))}"` : "",
    `>`,
    `<div class="toc-title">Contents</div>`,
    `<ul class="toc-list">${items}</ul>`,
    "</nav>\n",
  ].join("");
};

md.renderer.rules.fence = (tokens, index) => {
  const token = tokens[index];
  const info = token.info.trim();
  const language = info.split(/\s+/)[0]?.toLowerCase() ?? "";
  let highlighted: string;

  if (language === "mermaid") {
    const sourceLine = token.attrGet("data-source-line");
    return [
      `<div class="mermaid-block"`,
      sourceLine
        ? ` data-source-line="${escapeHtml(String(sourceLine))}"`
        : "",
      `>`,
      `<div class="mermaid-diagram" data-mermaid-source="${encodeURIComponent(
        token.content,
      )}" aria-busy="true"></div>`,
      `<details class="mermaid-source"><summary>Mermaid source</summary>`,
      `<pre><code class="language-mermaid">${escapeHtml(
        token.content,
      )}</code></pre></details>`,
      "</div>\n",
    ].join("");
  }

  if (language && hljs.getLanguage(language)) {
    try {
      highlighted = hljs.highlight(token.content, {
        language,
        ignoreIllegals: true,
      }).value;
    } catch {
      highlighted = escapeHtml(token.content);
    }
  } else {
    highlighted = escapeHtml(token.content);
  }

  const label = language || "code";
  return [
    `<div class="code-block" data-language="${escapeHtml(label)}">`,
    `<div class="code-block-head"><span>${escapeHtml(label)}</span></div>`,
    `<pre><code class="hljs">${highlighted}</code></pre>`,
    "</div>\n",
  ].join("");
};

function imagePlaceholder(alt: string, label: string, detail?: string): string {
  return [
    `<span class="image-placeholder" role="img" aria-label="${escapeHtml(alt)}"`,
    detail ? ` title="${escapeHtml(detail)}"` : "",
    `>`,
    `<span class="image-placeholder-mark" aria-hidden="true">${escapeHtml(label)}</span>`,
    `<span class="image-placeholder-copy"><span>${escapeHtml(alt)}</span>`,
    detail
      ? `<small class="image-placeholder-url">${escapeHtml(detail)}</small>`
      : "",
    "</span></span>",
  ].join("");
}

md.renderer.rules.image = (tokens, index, _options, environment) => {
  const token = tokens[index];
  const raw = String(token.attrGet("src") ?? "").trim();
  const alt = String(token.content.trim() || "Image");
  const title = token.attrGet("title");
  const source = classifyImageSource(raw);
  const mode = (environment as MarkdownEnvironment | undefined)?.imageMode;

  if (source.kind === "unsafe" || !raw) {
    return imagePlaceholder(alt, "IMG", raw || "No image source");
  }

  if (mode === "export") {
    const titleAttribute = title
      ? ` title="${escapeHtml(String(title))}"`
      : "";
    return `<img src="${escapeHtml(raw)}" alt="${escapeHtml(alt)}"${titleAttribute} loading="lazy" />`;
  }

  if (source.kind === "remote") {
    return imagePlaceholder(alt, "REMOTE", raw);
  }

  if (source.kind === "data") {
    return [
      `<img src="${escapeHtml(raw)}" alt="${escapeHtml(alt)}"`,
      title ? ` title="${escapeHtml(String(title))}"` : "",
      ` class="markdown-image" data-marksi-image="true" loading="lazy" />`,
    ].join("");
  }

  return [
    `<img data-marksi-src="${escapeHtml(raw)}" alt="${escapeHtml(alt)}"`,
    title ? ` title="${escapeHtml(String(title))}"` : "",
    ` class="markdown-image is-loading" loading="lazy" />`,
  ].join("");
};

md.renderer.rules.link_open = (tokens, index, options, _env, self) => {
  const token = tokens[index];
  const href = String(token.attrGet("href") ?? "");
  if (/^(https?:|mailto:)/i.test(href)) {
    token.attrSet("target", "_blank");
    token.attrSet("rel", "noopener noreferrer");
  }
  return self.renderToken(tokens, index, options);
};

function enhanceTaskLists(root: Document): void {
  root.querySelectorAll("li").forEach((item) => {
    const first = item.firstElementChild?.tagName === "P"
      ? item.firstElementChild
      : item;
    if (!first?.firstChild || first.firstChild.nodeType !== 3) {
      return;
    }
    const text = first.firstChild;
    const match = text.textContent?.match(/^\[([ xX])\][ \t]+/);
    if (!match) {
      return;
    }

    const taskText = text.textContent?.slice(match[0].length) ?? "";
    text.textContent = taskText;
    const checkbox = root.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = match[1].toLowerCase() === "x";
    if (checkbox.checked) {
      checkbox.setAttribute("checked", "");
    }
    checkbox.disabled = true;
    checkbox.tabIndex = -1;
    checkbox.className = "task-checkbox";
    checkbox.setAttribute("aria-label", taskText.trim() || "Task");
    first.insertBefore(checkbox, text);
    item.classList.add("task-list-item");
    item.parentElement?.classList.add("contains-task-list");
  });
}

function wrapTables(root: Document): void {
  root.querySelectorAll("table").forEach((table) => {
    if (table.parentElement?.classList.contains("table-scroll")) {
      return;
    }
    const wrapper = root.createElement("div");
    wrapper.className = "table-scroll";
    table.parentNode?.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
}

export function renderMarkdown(
  source: string,
  options: {
    imageMode?: "preview" | "export";
    mathOutput?: MathOutput;
  } = {},
): string {
  const imageMode = options.imageMode ?? "preview";
  const environment: MarkdownEnvironment = {
    imageMode,
    mathOutput:
      options.mathOutput ?? (imageMode === "export" ? "mathml" : "html"),
  };
  const rendered = md.render(source, environment);
  const sanitized = DOMPurify.sanitize(rendered, {
    USE_PROFILES: { html: true, mathMl: true },
    ADD_ATTR: [
      "data-source-line",
      "data-language",
      "data-marksi-src",
      "data-marksi-image",
      "data-mermaid-source",
      "target",
      "rel",
      "loading",
      "xmlns",
      "display",
      "mathvariant",
    ],
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
  });
  const document = new DOMParser().parseFromString(sanitized, "text/html");
  enhanceTaskLists(document);
  wrapTables(document);
  return document.body.innerHTML;
}

export { escapeHtml, slugifyHeading };
