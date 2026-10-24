import DOMPurify from "dompurify";
import type { ResolvedTheme } from "./theme";

interface Palette {
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentSoft: string;
}

const PALETTES: Record<ResolvedTheme, Palette> = {
  light: {
    background: "#fbfbfa",
    surface: "#ffffff",
    text: "#26282b",
    muted: "#6f7378",
    border: "#e4e2dd",
    accent: "#2f6f62",
    accentSoft: "#e5f1ee",
  },
  dark: {
    background: "#1d2024",
    surface: "#252930",
    text: "#e7e9ec",
    muted: "#9aa0a8",
    border: "#30353c",
    accent: "#78c6b5",
    accentSoft: "#1f3b36",
  },
};

const FONT_FAMILY =
  '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif';

let modulePromise: Promise<typeof import("mermaid").default> | null = null;
let initializedTheme: ResolvedTheme | null = null;
let diagramSequence = 0;

function themeVariables(theme: ResolvedTheme): Record<string, string> {
  const palette = PALETTES[theme];
  return {
    background: palette.background,
    mainBkg: palette.surface,
    primaryColor: palette.accentSoft,
    primaryTextColor: palette.text,
    primaryBorderColor: palette.accent,
    secondaryColor: palette.surface,
    secondaryTextColor: palette.text,
    secondaryBorderColor: palette.border,
    tertiaryColor: palette.background,
    tertiaryTextColor: palette.text,
    tertiaryBorderColor: palette.border,
    lineColor: palette.muted,
    textColor: palette.text,
    nodeTextColor: palette.text,
    nodeBorder: palette.border,
    clusterBkg: palette.surface,
    clusterBorder: palette.border,
    titleColor: palette.text,
    edgeLabelBackground: palette.surface,
    labelBackground: palette.surface,
    actorBkg: palette.surface,
    actorBorder: palette.border,
    actorTextColor: palette.text,
    signalColor: palette.muted,
    signalTextColor: palette.text,
    noteBkgColor: palette.accentSoft,
    noteTextColor: palette.text,
    noteBorderColor: palette.accent,
    fontFamily: FONT_FAMILY,
    fontSize: "14px",
  };
}

async function loadMermaid(theme: ResolvedTheme) {
  if (!modulePromise) {
    modulePromise = import("mermaid").then((module) => module.default);
  }
  const mermaid = await modulePromise;
  if (initializedTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      themeVariables: themeVariables(theme),
      darkMode: theme === "dark",
      htmlLabels: false,
      fontFamily: FONT_FAMILY,
      maxTextSize: 50_000,
      maxEdges: 500,
      suppressErrorRendering: true,
      secure: [
        "securityLevel",
        "startOnLoad",
        "htmlLabels",
        "theme",
        "themeVariables",
        "themeCSS",
        "maxTextSize",
        "maxEdges",
      ],
      flowchart: {
        htmlLabels: false,
        useMaxWidth: true,
        curve: "basis",
      },
      sequence: {
        useMaxWidth: true,
      },
      gantt: {
        useMaxWidth: true,
      },
      mindmap: {
        useMaxWidth: true,
      },
    });
    initializedTheme = theme;
  }
  return mermaid;
}

function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["script", "foreignObject", "iframe", "object", "embed"],
    FORBID_ATTR: [
      "onabort",
      "onafterprint",
      "onbeforeprint",
      "onbegin",
      "oncancel",
      "oncanplay",
      "onchange",
      "onclick",
      "onclose",
      "onend",
      "onerror",
      "onload",
      "onmousedown",
      "onmouseenter",
      "onmouseleave",
      "onmousemove",
      "onmouseout",
      "onmouseover",
      "onmouseup",
      "onrepeat",
      "onreset",
      "onscroll",
      "onsubmit",
      "ontoggle",
      "onwheel",
    ],
    ADD_ATTR: ["xmlns", "xmlns:xlink", "style"],
  });
}

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const compact = message.split(/\r?\n/).slice(0, 3).join(" ");
  return compact.length > 240 ? `${compact.slice(0, 240)}…` : compact;
}

function renderError(element: HTMLElement, message: string): void {
  const error = document.createElement("div");
  error.className = "mermaid-error";
  error.setAttribute("role", "alert");
  error.textContent = `Mermaid diagram could not be rendered: ${message}`;
  element.replaceChildren(error);
  element.classList.add("is-error");
  element.dataset.mermaidState = "error";
  element.removeAttribute("aria-busy");
  element.closest(".mermaid-block")?.querySelector("details")?.setAttribute(
    "open",
    "",
  );
}

/**
 * Renders every Mermaid placeholder under `root`. The markdown renderer has
 * already escaped and sanitized the source; this helper only turns the source
 * into an SVG and sanitizes that SVG again with a strict profile.
 */
export async function renderMermaidDiagrams(
  root: ParentNode,
  theme: ResolvedTheme,
): Promise<void> {
  const diagrams = Array.from(
    root.querySelectorAll<HTMLElement>(
      ".mermaid-diagram[data-mermaid-source]",
    ),
  );
  if (diagrams.length === 0) {
    return;
  }

  let mermaid: Awaited<ReturnType<typeof loadMermaid>>;
  try {
    mermaid = await loadMermaid(theme);
  } catch (error) {
    diagrams.forEach((element) => renderError(element, describeError(error)));
    return;
  }

  for (const element of diagrams) {
    if (
      element.dataset.mermaidTheme === theme &&
      element.dataset.mermaidState === "ready" &&
      element.querySelector("svg")
    ) {
      continue;
    }

    const encoded = element.dataset.mermaidSource;
    if (!encoded) {
      continue;
    }

    let source: string;
    try {
      source = decodeURIComponent(encoded);
    } catch {
      source = encoded;
    }

    const run = String(Number(element.dataset.mermaidRun ?? "0") + 1);
    element.dataset.mermaidRun = run;
    delete element.dataset.mermaidState;
    element.classList.remove("is-error", "is-rendered");
    element.setAttribute("aria-busy", "true");
    element.replaceChildren();

    try {
      const result = await mermaid.render(
        `marksi-mermaid-${diagramSequence++}`,
        source,
      );
      if (element.dataset.mermaidRun !== run) {
        continue;
      }
      element.innerHTML = sanitizeSvg(result.svg);
      result.bindFunctions?.(element);
      element.dataset.mermaidTheme = theme;
      element.dataset.mermaidState = "ready";
      element.classList.add("is-rendered");
      element.removeAttribute("aria-busy");
    } catch (error) {
      if (element.dataset.mermaidRun !== run) {
        continue;
      }
      renderError(element, describeError(error));
    }
  }
}

/**
 * Converts a rendered Markdown body to self-contained HTML for export or the
 * clipboard. Source disclosure blocks are removed for successfully rendered
 * diagrams; failures keep them so the source remains recoverable.
 */
export async function renderMermaidMarkup(
  html: string,
  theme: ResolvedTheme,
): Promise<string> {
  if (!html.includes('class="mermaid-diagram"')) {
    return html;
  }

  const container = document.createElement("div");
  container.innerHTML = html;
  await renderMermaidDiagrams(container, theme);

  container.querySelectorAll(".mermaid-block").forEach((block) => {
    const diagram = block.querySelector<HTMLElement>(".mermaid-diagram");
    if (diagram?.dataset.mermaidState !== "ready") {
      return;
    }
    block.querySelector(".mermaid-source")?.remove();
    diagram.removeAttribute("data-mermaid-source");
    diagram.removeAttribute("data-mermaid-theme");
    diagram.removeAttribute("data-mermaid-state");
    diagram.removeAttribute("data-mermaid-run");
    diagram.removeAttribute("aria-busy");
    diagram.classList.remove("is-rendered");
  });

  return container.innerHTML;
}
