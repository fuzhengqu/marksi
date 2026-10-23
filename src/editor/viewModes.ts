import {
  RangeSetBuilder,
  type EditorState,
  type Extension,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";

interface BlockRange {
  from: number;
  to: number;
}

function currentBlock(state: EditorState, position: number): BlockRange {
  const line = state.doc.lineAt(position);
  let start = line;
  let end = line;

  if (line.text.trim()) {
    while (start.number > 1) {
      const previous = state.doc.line(start.number - 1);
      if (!previous.text.trim()) {
        break;
      }
      start = previous;
    }
    while (end.number < state.doc.lines) {
      const next = state.doc.line(end.number + 1);
      if (!next.text.trim()) {
        break;
      }
      end = next;
    }
  }

  return { from: start.from, to: end.to };
}

const dimmedLine = Decoration.line({ class: "cm-focus-dim" });

function buildFocusDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { from, to } = view.viewport;
  const block = currentBlock(view.state, view.state.selection.main.head);
  let position = from;

  while (position <= to) {
    const line = view.state.doc.lineAt(position);
    if (line.from < block.from || line.from > block.to) {
      builder.add(line.from, line.from, dimmedLine);
    }
    if (line.to >= view.state.doc.length) {
      break;
    }
    position = line.to + 1;
  }

  return builder.finish();
}

class FocusModePlugin {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = buildFocusDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.selectionSet || update.viewportChanged) {
      this.decorations = buildFocusDecorations(update.view);
    }
  }
}

const focusModePlugin = ViewPlugin.fromClass(FocusModePlugin, {
  decorations: (value) => value.decorations,
});

export function focusMode(): Extension {
  return focusModePlugin;
}

export function centerSelection(view: EditorView): void {
  const head = view.state.selection.main.head;
  const coordinates = view.coordsAtPos(head);
  if (!coordinates) {
    return;
  }

  const scroller = view.scrollDOM;
  const scrollerRect = scroller.getBoundingClientRect();
  const targetCenter = scrollerRect.top + scroller.clientHeight / 2;
  const lineCenter = (coordinates.top + coordinates.bottom) / 2;
  const maximum = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  const target = scroller.scrollTop + lineCenter - targetCenter;
  scroller.scrollTop = Math.min(Math.max(0, target), maximum);
}

export function typewriterMode(): Extension {
  return EditorView.updateListener.of((update) => {
    if (!update.selectionSet && !update.docChanged) {
      return;
    }
    if (update.view.composing) {
      return;
    }
    const view = update.view;
    requestAnimationFrame(() => {
      if (view.dom.isConnected) {
        centerSelection(view);
      }
    });
  });
}
