import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";

const hidden = Decoration.replace({});

interface HiddenRange {
  from: number;
  to: number;
}

function buildDecorations(view: EditorView): DecorationSet {
  const activeLines = new Set<number>();
  for (const range of view.state.selection.ranges) {
    const first = view.state.doc.lineAt(range.from).number;
    const last = view.state.doc.lineAt(range.to).number;
    for (let line = first; line <= last; line += 1) {
      activeLines.add(line);
    }
  }

  const ranges: HiddenRange[] = [];
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
            ranges.push({ from: node.from, to: hideTo });
            break;
          case "EmphasisMark":
          case "StrikethroughMark":
          case "LinkMark":
          case "LinkTitle":
          case "URL":
            ranges.push({ from: node.from, to: node.to });
            break;
          case "CodeMark":
            if (node.node.parent?.name === "InlineCode") {
              ranges.push({ from: node.from, to: node.to });
            }
            break;
        }
      },
    });
  }

  ranges.sort((left, right) => left.from - right.from || left.to - right.to);
  const builder = new RangeSetBuilder<Decoration>();
  let lastTo = -1;
  for (const range of ranges) {
    if (range.from < lastTo || range.from >= range.to) {
      continue;
    }
    builder.add(range.from, range.to, hidden);
    lastTo = range.to;
  }
  return builder.finish();
}

class LivePreviewPlugin {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = buildDecorations(view);
  }

  update(update: ViewUpdate): void {
    if (
      update.docChanged ||
      update.selectionSet ||
      update.viewportChanged ||
      update.focusChanged
    ) {
      this.decorations = buildDecorations(update.view);
    }
  }
}

/**
 * Hides Markdown punctuation on inactive lines so the source editor reads like
 * a live preview while remaining fully editable. The active line keeps its
 * syntax visible for precise editing.
 */
export function livePreview(): Extension {
  return [
    EditorView.editorAttributes.of({ class: "cm-live-preview" }),
    ViewPlugin.fromClass(LivePreviewPlugin, {
      decorations: (plugin) => plugin.decorations,
    }),
  ];
}
