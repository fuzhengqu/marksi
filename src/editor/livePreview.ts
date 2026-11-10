import { syntaxTree } from "@codemirror/language";
import {
  RangeSetBuilder,
  StateField,
  type EditorState,
  type Extension,
  type Range,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import {
  blockquoteDepth,
  fenceLanguageLabel,
  quoteClassForDepth,
} from "../lib/blocks";
import {
  classifyImageSource,
  directoryName,
  resolveImageRootPath,
} from "../lib/images";
import { loadImageSource } from "../lib/imageLoader";
import {
  frontMatterLineCount,
  frontMatterSummary,
  type FrontMatterEntry,
} from "../lib/frontMatter";
import { renderMarkdown } from "../lib/markdown";
import { rangeIsActive } from "../lib/selection";
import { tablePreviewLimit } from "../lib/tables";
import {
  findImageOccurrences,
  imageFitFromAttributes,
  imageHeightFromAttributes,
  imageWidthFromAttributes,
  type ImageOccurrence,
} from "../lib/imageSize";
import { headingClassForNode } from "../lib/headings";
import {
  isTaskMarker,
  taskMarkerChecked,
  toggleTaskMarker,
} from "../lib/taskList";

export interface LivePreviewOptions {
  documentPath: string | null;
  workspacePath: string | null;
  imageRootPath: string;
  imageRootUrl: string;
  loadRemoteImages: boolean;
  taskToggleLabel: string;
  tableLabel: string;
  frontMatterLabel: string;
}

const EMPTY_OPTIONS: LivePreviewOptions = {
  documentPath: null,
  workspacePath: null,
  imageRootPath: "",
  imageRootUrl: "",
  loadRemoteImages: false,
  taskToggleLabel: "Toggle task",
  tableLabel: "Table",
  frontMatterLabel: "Front matter",
};

const hidden = Decoration.replace({});

interface DecorationRange {
  from: number;
  to: number;
  decoration: Decoration;
}

function imageOptions(options: LivePreviewOptions) {
  return {
    baseDirectory: options.documentPath
      ? directoryName(options.documentPath)
      : options.workspacePath,
    rootDirectory: resolveImageRootPath(
      options.imageRootPath,
      options.workspacePath,
      options.documentPath,
    ),
    rootUrl: options.imageRootUrl.trim() || null,
    loadRemote: options.loadRemoteImages,
  };
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class LiveImageWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly alt: string,
    readonly destination: string,
    readonly width: number | null,
    readonly height: number | null,
    readonly fit: "contain" | "cover" | null,
    readonly options: LivePreviewOptions,
  ) {
    super();
  }

  eq(other: LiveImageWidget): boolean {
    return (
      this.from === other.from &&
      this.alt === other.alt &&
      this.destination === other.destination &&
      this.width === other.width &&
      this.height === other.height &&
      this.fit === other.fit &&
      this.options === other.options
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const root = document.createElement("span");
    root.className = "cm-live-image is-loading";
    root.dataset.marksiLiveImage = "true";
    root.setAttribute("role", "img");
    root.setAttribute("aria-label", this.alt);
    root.title = this.destination;

    const frame = document.createElement("span");
    frame.className = "cm-live-image-frame";
    if (this.width) {
      frame.style.width = `${this.width}px`;
    }
    if (this.height) {
      frame.style.height = `${this.height}px`;
    }
    root.append(frame);

    // Clicking the rendered image reveals its Markdown source for editing.
    root.addEventListener("mousedown", (event) => {
      event.preventDefault();
      view.dispatch({
        selection: { anchor: this.from },
        scrollIntoView: true,
      });
      view.focus();
    });

    this.render(root, frame);
    return root;
  }

  ignoreEvent(): boolean {
    return true;
  }

  private render(root: HTMLElement, frame: HTMLElement): void {
    const source = classifyImageSource(this.destination);
    if (!this.destination || source.kind === "unsafe") {
      this.placeholder(
        root,
        frame,
        "IMG",
        "Unsupported image source.",
        this.alt,
      );
      return;
    }
    if (source.kind === "remote" && !this.options.loadRemoteImages) {
      this.placeholder(
        root,
        frame,
        "REMOTE",
        "Remote image not loaded. Enable remote images in Preferences.",
        this.alt,
      );
      root.classList.add("is-remote");
      return;
    }

    const loading = document.createElement("span");
    loading.className = "cm-live-image-loading";
    loading.textContent = this.alt;
    frame.replaceChildren(loading);

    void loadImageSource(this.destination, imageOptions(this.options))
      .then(({ source: dataUrl, path }) => {
        if (!root.isConnected) {
          return;
        }
        const image = document.createElement("img");
        image.className = "cm-live-image-media";
        image.alt = this.alt;
        image.title = path;
        image.loading = "lazy";
        image.decoding = "async";
        if (this.width) {
          image.width = this.width;
        }
        if (this.height) {
          image.height = this.height;
        }
        if (this.fit) {
          image.dataset.fit = this.fit;
        }
        image.addEventListener("load", () => {
          root.classList.remove("is-loading");
          root.classList.add("is-loaded");
        });
        image.addEventListener("error", () => {
          this.fail(root, frame, path);
        });
        image.src = dataUrl;
        frame.replaceChildren(image);
      })
      .catch((error) => {
        if (root.isConnected) {
          this.fail(root, frame, `${this.destination}: ${messageFor(error)}`);
        }
      });
  }

  private placeholder(
    root: HTMLElement,
    frame: HTMLElement,
    label: string,
    detail: string,
    alt: string,
  ): void {
    root.classList.remove("is-loading");
    root.classList.add("is-placeholder");
    const placeholder = document.createElement("span");
    placeholder.className = "cm-live-image-placeholder";
    placeholder.title = detail;

    const mark = document.createElement("span");
    mark.className = "cm-live-image-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = label;

    const copy = document.createElement("span");
    copy.className = "cm-live-image-copy";
    copy.textContent = alt || "Image";

    placeholder.append(mark, copy);
    frame.replaceChildren(placeholder);
  }

  private fail(root: HTMLElement, frame: HTMLElement, detail: string): void {
    root.classList.remove("is-loading", "is-loaded");
    root.classList.add("is-error");
    const error = document.createElement("span");
    error.className = "cm-live-image-placeholder";
    error.title = detail;

    const mark = document.createElement("span");
    mark.className = "cm-live-image-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "IMG";

    const copy = document.createElement("span");
    copy.className = "cm-live-image-copy";
    copy.textContent = this.alt || "Image";

    error.append(mark, copy);
    frame.replaceChildren(error);
  }
}

class LiveTaskWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly checked: boolean,
    readonly label: string,
  ) {
    super();
  }

  eq(other: LiveTaskWidget): boolean {
    return (
      this.from === other.from &&
      this.checked === other.checked &&
      this.label === other.label
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const control = document.createElement("span");
    control.className = `cm-live-task${this.checked ? " is-checked" : ""}`;
    control.setAttribute("role", "checkbox");
    control.setAttribute("aria-checked", String(this.checked));
    control.setAttribute("aria-label", this.label);
    control.title = this.label;
    control.tabIndex = 0;

    const box = document.createElement("span");
    box.className = "cm-live-task-box";
    box.setAttribute("aria-hidden", "true");
    control.append(box);

    const toggle = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      const marker = view.state.doc.sliceString(this.from, this.from + 3);
      const next = toggleTaskMarker(marker);
      if (!next) {
        return;
      }
      view.dispatch({
        changes: { from: this.from, to: this.from + 3, insert: next },
      });
      view.focus();
    };

    control.addEventListener("mousedown", toggle);
    control.addEventListener("keydown", (event) => {
      if (event.key === " " || event.key === "Enter") {
        toggle(event);
      }
    });
    return control;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

class LiveRuleWidget extends WidgetType {
  constructor(readonly from: number) {
    super();
  }

  eq(other: LiveRuleWidget): boolean {
    return this.from === other.from;
  }

  toDOM(view: EditorView): HTMLElement {
    const rule = document.createElement("span");
    rule.className = "cm-live-rule";
    rule.setAttribute("role", "separator");
    rule.tabIndex = 0;

    const reveal = (event: Event) => {
      event.preventDefault();
      view.dispatch({
        selection: { anchor: this.from },
        scrollIntoView: true,
      });
      view.focus();
    };
    rule.addEventListener("mousedown", reveal);
    rule.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        reveal(event);
      }
    });
    return rule;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

class LiveCodeBadgeWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly label: string,
  ) {
    super();
  }

  eq(other: LiveCodeBadgeWidget): boolean {
    return this.from === other.from && this.label === other.label;
  }

  toDOM(view: EditorView): HTMLElement {
    const badge = document.createElement("span");
    badge.className = "cm-live-code-badge";
    badge.textContent = this.label;
    badge.tabIndex = 0;
    badge.contentEditable = "false";
    badge.spellcheck = false;

    const reveal = (event: Event) => {
      event.preventDefault();
      view.dispatch({
        selection: { anchor: this.from },
        scrollIntoView: true,
      });
      view.focus();
    };
    badge.addEventListener("mousedown", reveal);
    badge.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        reveal(event);
      }
    });
    return badge;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

class LiveTableWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly source: string,
    readonly label: string,
  ) {
    super();
  }

  eq(other: LiveTableWidget): boolean {
    return (
      this.from === other.from &&
      this.to === other.to &&
      this.source === other.source &&
      this.label === other.label
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const table = document.createElement("div");
    table.className = "cm-live-table";
    table.contentEditable = "false";
    table.spellcheck = false;
    table.tabIndex = 0;
    table.setAttribute("role", "group");
    table.setAttribute("aria-label", this.label);
    table.innerHTML = renderMarkdown(this.source, {
      imageMode: "preview",
      imageResizable: false,
    });

    for (const frame of Array.from(
      table.querySelectorAll(".markdown-image-frame"),
    )) {
      const alt = frame.querySelector("img")?.getAttribute("alt")?.trim();
      const placeholder = document.createElement("span");
      placeholder.className = "cm-live-table-image";
      placeholder.textContent = alt || "Image";
      frame.replaceWith(placeholder);
    }

    const reveal = (event: Event) => {
      event.preventDefault();
      view.dispatch({
        selection: { anchor: this.from },
        scrollIntoView: true,
      });
      view.focus();
    };
    table.addEventListener("mousedown", reveal);
    table.addEventListener("click", (event) => {
      event.preventDefault();
    });
    table.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        reveal(event);
      }
    });
    return table;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

class LiveFrontMatterWidget extends WidgetType {
  constructor(
    readonly from: number,
    readonly to: number,
    readonly entries: readonly FrontMatterEntry[],
    readonly label: string,
  ) {
    super();
  }

  eq(other: LiveFrontMatterWidget): boolean {
    return (
      this.from === other.from &&
      this.to === other.to &&
      this.label === other.label &&
      this.entries.length === other.entries.length &&
      this.entries.every(
        (entry, index) =>
          entry.key === other.entries[index].key &&
          entry.value === other.entries[index].value,
      )
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const card = document.createElement("div");
    card.className = "cm-live-frontmatter";
    card.contentEditable = "false";
    card.spellcheck = false;
    card.tabIndex = 0;
    card.setAttribute("role", "group");
    card.setAttribute("aria-label", this.label);

    const header = document.createElement("div");
    header.className = "cm-live-frontmatter-header";
    const title = document.createElement("span");
    title.className = "cm-live-frontmatter-title";
    title.textContent = this.label;
    const badge = document.createElement("span");
    badge.className = "cm-live-frontmatter-badge";
    badge.textContent = "YAML";
    header.append(title, badge);
    card.append(header);

    if (this.entries.length > 0) {
      const list = document.createElement("dl");
      list.className = "cm-live-frontmatter-list";
      for (const entry of this.entries) {
        const key = document.createElement("dt");
        key.textContent = entry.key;
        const value = document.createElement("dd");
        value.textContent = entry.value;
        list.append(key, value);
      }
      card.append(list);
    }

    const reveal = (event: Event) => {
      event.preventDefault();
      view.dispatch({
        selection: { anchor: this.from },
        scrollIntoView: true,
      });
      view.focus();
    };
    card.addEventListener("mousedown", reveal);
    card.addEventListener("click", (event) => {
      event.preventDefault();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        reveal(event);
      }
    });
    return card;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

function collectImages(view: EditorView): ImageOccurrence[] {
  const source = view.state.doc.toString();
  return source.includes("![") ? findImageOccurrences(source) : [];
}

/**
 * Returns the end offset of a leading YAML front matter block, or 0 when the
 * document has none. Live-preview decorations skip this range so YAML is never
 * styled as headings or horizontal rules.
 */
function frontMatterEnd(state: EditorState): number {
  const lineCount = frontMatterLineCount(state.doc.lines, (lineNumber) =>
    state.doc.line(lineNumber).text,
  );
  return lineCount === 0 ? 0 : state.doc.line(lineCount).to;
}

function buildDecorations(
  view: EditorView,
  images: ImageOccurrence[],
  options: LivePreviewOptions,
): DecorationSet {
  const activeLines = new Set<number>();
  for (const range of view.state.selection.ranges) {
    const first = view.state.doc.lineAt(range.from).number;
    const last = view.state.doc.lineAt(range.to).number;
    for (let line = first; line <= last; line += 1) {
      activeLines.add(line);
    }
  }
  const frontMatterTo = frontMatterEnd(view.state);

  const ranges: DecorationRange[] = [];
  for (const image of images) {
    if (image.from < frontMatterTo) {
      continue;
    }
    if (activeLines.has(view.state.doc.lineAt(image.from).number)) {
      continue;
    }
    if (image.destination === null) {
      continue;
    }
    if (
      !view.visibleRanges.some(
        (range) => image.from <= range.to && image.to >= range.from,
      )
    ) {
      continue;
    }
    const attrs =
      image.attrsFrom !== null && image.attrsTo !== null
        ? view.state.doc.sliceString(image.attrsFrom + 1, image.attrsTo - 1)
        : "";
    const width = imageWidthFromAttributes(attrs);
    const height = imageHeightFromAttributes(attrs);
    const fit = imageFitFromAttributes(attrs);
    ranges.push({
      from: image.from,
      to: image.attrsTo ?? image.to,
      decoration: Decoration.replace({
        widget: new LiveImageWidget(
          image.from,
          image.alt.trim() || "Image",
          image.destination,
          width,
          height,
          fit,
          options,
        ),
      }),
    });
  }

  const tree = syntaxTree(view.state);
  for (const visible of view.visibleRanges) {
    tree.iterate({
      from: visible.from,
      to: visible.to,
      enter(node) {
        if (node.from < frontMatterTo) {
          return;
        }
        const lineNumber = view.state.doc.lineAt(node.from).number;
        if (activeLines.has(lineNumber)) {
          return;
        }

        let hideTo = node.to;
        switch (node.name) {
          case "HeaderMark":
            if (view.state.doc.sliceString(node.to, node.to + 1) === " ") {
              hideTo += 1;
            }
            ranges.push({
              from: node.from,
              to: hideTo,
              decoration: hidden,
            });
            break;
          case "QuoteMark":
            if (view.state.doc.sliceString(node.to, node.to + 1) === " ") {
              hideTo += 1;
            }
            ranges.push({
              from: node.from,
              to: hideTo,
              decoration: hidden,
            });
            break;
          case "HorizontalRule": {
            ranges.push({
              from: node.from,
              to: node.to,
              decoration: Decoration.replace({
                widget: new LiveRuleWidget(node.from),
              }),
            });
            break;
          }
          case "EmphasisMark":
          case "StrikethroughMark":
          case "LinkMark":
          case "LinkTitle":
          case "URL":
            ranges.push({
              from: node.from,
              to: node.to,
              decoration: hidden,
            });
            break;
          case "CodeMark":
            if (node.node.parent?.name === "InlineCode") {
              ranges.push({
                from: node.from,
                to: node.to,
                decoration: hidden,
              });
              break;
            }
            if (node.node.parent?.name === "FencedCode") {
              const fence = node.node.parent;
              if (node.from !== fence.from) {
                ranges.push({
                  from: node.from,
                  to: node.to,
                  decoration: hidden,
                });
                break;
              }
              const info = fence.getChild("CodeInfo");
              const end = info ? info.to : node.to;
              const label = fenceLanguageLabel(
                info ? view.state.doc.sliceString(info.from, info.to) : "",
              );
              ranges.push({
                from: node.from,
                to: end,
                decoration: Decoration.replace({
                  widget: new LiveCodeBadgeWidget(node.from, label),
                }),
              });
            }
            break;
          case "TaskMarker": {
            const marker = view.state.doc.sliceString(node.from, node.to);
            if (isTaskMarker(marker)) {
              ranges.push({
                from: node.from,
                to: node.to,
                decoration: Decoration.replace({
                  widget: new LiveTaskWidget(
                    node.from,
                    taskMarkerChecked(marker),
                    options.taskToggleLabel,
                  ),
                }),
              });
            }
            break;
          }
        }
      },
    });
  }

  // Prefer the widest range when an image and a syntax marker start together.
  ranges.sort(
    (left, right) => left.from - right.from || right.to - left.to,
  );
  const builder = new RangeSetBuilder<Decoration>();
  let lastTo = -1;
  for (const range of ranges) {
    if (range.from < lastTo || range.from >= range.to) {
      continue;
    }
    builder.add(range.from, range.to, range.decoration);
    lastTo = range.to;
  }
  return builder.finish();
}

function buildHeadingDecorations(view: EditorView): DecorationSet {
  const activeLines = new Set<number>();
  for (const range of view.state.selection.ranges) {
    const first = view.state.doc.lineAt(range.from).number;
    const last = view.state.doc.lineAt(range.to).number;
    for (let line = first; line <= last; line += 1) {
      activeLines.add(line);
    }
  }

  const ranges: Range<Decoration>[] = [];
  const seen = new Set<number>();
  const frontMatterTo = frontMatterEnd(view.state);
  syntaxTree(view.state).iterate({
    enter(node) {
      if (node.from < frontMatterTo) {
        return;
      }
      const className = headingClassForNode(node.name);
      if (!className) {
        return;
      }
      const start = view.state.doc.lineAt(node.from);
      const end = view.state.doc.lineAt(Math.max(node.from, node.to - 1));
      if (activeLines.has(start.number) || activeLines.has(end.number)) {
        return;
      }
      if (seen.has(start.number)) {
        return;
      }
      if (
        !view.visibleRanges.some(
          (range) => start.from <= range.to && start.to >= range.from,
        )
      ) {
        return;
      }
      seen.add(start.number);
      ranges.push(Decoration.line({ class: className }).range(start.from));
    },
  });
  return Decoration.set(ranges);
}

function buildBlockDecorations(view: EditorView): DecorationSet {
  const quoteDepths = new Map<number, number>();
  const codeClasses = new Map<number, Set<string>>();
  const visible = view.visibleRanges;
  const isVisible = (from: number, to: number) =>
    visible.some((range) => from <= range.to && to >= range.from);
  const frontMatterTo = frontMatterEnd(view.state);

  syntaxTree(view.state).iterate({
    enter(node) {
      if (node.from < frontMatterTo) {
        return;
      }
      if (node.name === "Blockquote") {
        const ancestors: string[] = [];
        let parent = node.node.parent;
        while (parent) {
          ancestors.push(parent.name);
          parent = parent.parent;
        }
        const depth = blockquoteDepth(ancestors);
        const start = view.state.doc.lineAt(node.from);
        const end = view.state.doc.lineAt(Math.max(node.from, node.to - 1));
        for (let number = start.number; number <= end.number; number += 1) {
          const line = view.state.doc.line(number);
          if (!isVisible(line.from, line.to)) {
            continue;
          }
          if (depth > (quoteDepths.get(line.from) ?? 0)) {
            quoteDepths.set(line.from, depth);
          }
        }
        return;
      }

      if (node.name !== "FencedCode" && node.name !== "CodeBlock") {
        return;
      }
      const start = view.state.doc.lineAt(node.from);
      const end = view.state.doc.lineAt(Math.max(node.from, node.to - 1));
      for (let number = start.number; number <= end.number; number += 1) {
        const line = view.state.doc.line(number);
        if (!isVisible(line.from, line.to)) {
          continue;
        }
        const classes = codeClasses.get(line.from) ?? new Set<string>();
        classes.add("cm-live-code");
        if (number === start.number) {
          classes.add("cm-live-code-first");
        }
        if (number === end.number) {
          classes.add("cm-live-code-last");
        }
        codeClasses.set(line.from, classes);
      }
    },
  });

  const lineClasses = new Map<number, Set<string>>();
  const addLineClass = (from: number, className: string) => {
    const classes = lineClasses.get(from) ?? new Set<string>();
    classes.add(className);
    lineClasses.set(from, classes);
  };
  for (const [from, depth] of quoteDepths) {
    addLineClass(from, quoteClassForDepth(depth));
  }
  for (const [from, classes] of codeClasses) {
    for (const className of classes) {
      addLineClass(from, className);
    }
  }

  const ranges: Range<Decoration>[] = [];
  for (const [from, classes] of lineClasses) {
    ranges.push(
      Decoration.line({ class: [...classes].join(" ") }).range(from),
    );
  }
  ranges.sort((left, right) => left.from - right.from);
  return Decoration.set(ranges);
}

function buildFrontMatterDecorations(
  state: EditorState,
  options: LivePreviewOptions,
): DecorationSet {
  const end = frontMatterEnd(state);
  if (end === 0 || rangeIsActive(state.selection.ranges, 0, end)) {
    return Decoration.none;
  }
  return Decoration.set([
    Decoration.replace({
      block: true,
      widget: new LiveFrontMatterWidget(
        0,
        end,
        frontMatterSummary(state.doc.sliceString(0, end)),
        options.frontMatterLabel,
      ),
    }).range(0, end),
  ]);
}

function createFrontMatterField(options: LivePreviewOptions) {
  return StateField.define<DecorationSet>({
    create: (state) => buildFrontMatterDecorations(state, options),
    update: (decorations, transaction) =>
      transaction.docChanged || transaction.selection
        ? buildFrontMatterDecorations(transaction.state, options)
        : decorations,
    provide: (field) => EditorView.decorations.from(field),
  });
}

function buildTableDecorations(
  state: EditorState,
  tree: ReturnType<typeof syntaxTree>,
  options: LivePreviewOptions,
): DecorationSet {
  const limit = tablePreviewLimit(state.doc.length);
  if (limit === 0) {
    return Decoration.none;
  }

  const ranges: Range<Decoration>[] = [];
  let count = 0;
  tree.iterate({
    enter(node) {
      if (node.name !== "Table" || node.node.parent?.name !== "Document") {
        return;
      }
      if (count >= limit) {
        return false;
      }
      const start = state.doc.lineAt(node.from);
      const end = state.doc.lineAt(Math.max(node.from, node.to - 1));
      if (rangeIsActive(state.selection.ranges, start.from, end.to)) {
        return false;
      }
      ranges.push(
        Decoration.replace({
          block: true,
          widget: new LiveTableWidget(
            start.from,
            end.to,
            state.doc.sliceString(start.from, end.to),
            options.tableLabel,
          ),
        }).range(start.from, end.to),
      );
      count += 1;
      return false;
    },
  });
  return Decoration.set(ranges, true);
}

interface TablePreviewState {
  decorations: DecorationSet;
  tree: ReturnType<typeof syntaxTree>;
}

function createTablePreviewField(options: LivePreviewOptions) {
  return StateField.define<TablePreviewState>({
    create: (state) => {
      const tree = syntaxTree(state);
      return {
        decorations: buildTableDecorations(state, tree, options),
        tree,
      };
    },
    update: (value, transaction) => {
      const tree = syntaxTree(transaction.state);
      if (
        !transaction.docChanged &&
        !transaction.selection &&
        tree === value.tree
      ) {
        return value;
      }
      return {
        decorations: buildTableDecorations(transaction.state, tree, options),
        tree,
      };
    },
    provide: (field) =>
      EditorView.decorations.from(field, (value) => value.decorations),
  });
}

function createBlockPreviewPlugin() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildBlockDecorations(view);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildBlockDecorations(update.view);
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
    },
  );
}

function createHeadingPreviewPlugin() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildHeadingDecorations(view);
      }

      update(update: ViewUpdate): void {
        if (
          update.docChanged ||
          update.selectionSet ||
          update.viewportChanged
        ) {
          this.decorations = buildHeadingDecorations(update.view);
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
    },
  );
}

function createLivePreviewPlugin(options: LivePreviewOptions) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      images: ImageOccurrence[];

      constructor(view: EditorView) {
        this.images = collectImages(view);
        this.decorations = buildDecorations(view, this.images, options);
      }

      update(update: ViewUpdate): void {
        if (update.docChanged) {
          this.images = collectImages(update.view);
        }
        if (
          update.docChanged ||
          update.selectionSet ||
          update.viewportChanged ||
          update.focusChanged
        ) {
          this.decorations = buildDecorations(
            update.view,
            this.images,
            options,
          );
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
    },
  );
}

/**
 * Hides Markdown punctuation on inactive lines so the source editor reads like
 * a live preview while remaining fully editable. The active line keeps its
 * syntax visible for precise editing. Headings gain their reading-view
 * hierarchy, block quotes gain a quote rule, horizontal rules become dividers,
 * fenced and indented code blocks gain a card surface and language badge,
 * leading YAML front matter becomes a metadata card, inactive tables render as
 * read-only tables with click-to-edit source, local images render inline, and
 * remote images stay inert until the user enables remote loading in
 * Preferences.
 */
export function livePreview(
  options: LivePreviewOptions = EMPTY_OPTIONS,
): Extension {
  return [
    EditorView.editorAttributes.of({ class: "cm-live-preview" }),
    createFrontMatterField(options),
    createTablePreviewField(options),
    createBlockPreviewPlugin(),
    createHeadingPreviewPlugin(),
    createLivePreviewPlugin(options),
  ];
}
