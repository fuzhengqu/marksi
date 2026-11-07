import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import {
  classifyImageSource,
  directoryName,
  resolveImageRootPath,
} from "../lib/images";
import { loadImageSource } from "../lib/imageLoader";
import {
  findImageOccurrences,
  imageFitFromAttributes,
  imageHeightFromAttributes,
  imageWidthFromAttributes,
  type ImageOccurrence,
} from "../lib/imageSize";
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
}

const EMPTY_OPTIONS: LivePreviewOptions = {
  documentPath: null,
  workspacePath: null,
  imageRootPath: "",
  imageRootUrl: "",
  loadRemoteImages: false,
  taskToggleLabel: "Toggle task",
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

function collectImages(view: EditorView): ImageOccurrence[] {
  const source = view.state.doc.toString();
  return source.includes("![") ? findImageOccurrences(source) : [];
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

  const ranges: DecorationRange[] = [];
  for (const image of images) {
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
 * syntax visible for precise editing. Local images render inline; remote
 * images stay inert until the user enables remote loading in Preferences.
 */
export function livePreview(
  options: LivePreviewOptions = EMPTY_OPTIONS,
): Extension {
  return [
    EditorView.editorAttributes.of({ class: "cm-live-preview" }),
    createLivePreviewPlugin(options),
  ];
}
