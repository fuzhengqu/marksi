import type { EditorView, KeyBinding } from "@codemirror/view";

export type EditorCommand =
  | "bold"
  | "italic"
  | "strikethrough"
  | "inline-code"
  | "link";

export interface FormatEdit {
  from: number;
  to: number;
  insert: string;
  selectionFrom: number;
  selectionTo: number;
}

const inlineMarkers: Record<Exclude<EditorCommand, "link">, string> = {
  bold: "**",
  italic: "*",
  strikethrough: "~~",
  "inline-code": "`",
};

function clampPosition(position: number, length: number): number {
  return Math.max(0, Math.min(position, length));
}

/**
 * Wrap or unwrap a selection with an inline Markdown marker. The operation is
 * deliberately small and deterministic so it can be shared by shortcuts, the
 * menu, and unit tests.
 */
export function toggleInline(
  text: string,
  from: number,
  to: number,
  marker: string,
): FormatEdit {
  const start = clampPosition(from, text.length);
  const end = Math.max(start, clampPosition(to, text.length));
  const selected = text.slice(start, end);
  const width = marker.length;

  if (
    selected.length >= width * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const inner = selected.slice(width, -width);
    return {
      from: start,
      to: end,
      insert: inner,
      selectionFrom: start,
      selectionTo: start + inner.length,
    };
  }

  const before = text.slice(0, start);
  const after = text.slice(end);
  if (start >= width && before.endsWith(marker) && after.startsWith(marker)) {
    return {
      from: start - width,
      to: end + width,
      insert: selected,
      selectionFrom: start - width,
      selectionTo: end - width,
    };
  }

  return {
    from: start,
    to: end,
    insert: `${marker}${selected}${marker}`,
    selectionFrom: start + width,
    selectionTo: end + width,
  };
}

export function insertLink(
  text: string,
  from: number,
  to: number,
): FormatEdit {
  const start = clampPosition(from, text.length);
  const end = Math.max(start, clampPosition(to, text.length));
  const selected = text.slice(start, end);

  if (selected.length > 0) {
    const insert = `[${selected}](url)`;
    const urlStart = start + selected.length + 3;
    return {
      from: start,
      to: end,
      insert,
      selectionFrom: urlStart,
      selectionTo: urlStart + 3,
    };
  }

  const label = "link text";
  const insert = `[${label}](url)`;
  return {
    from: start,
    to: end,
    insert,
    selectionFrom: start + 1,
    selectionTo: start + 1 + label.length,
  };
}

/**
 * Apply an ATX heading level to every selected line. Level zero removes the
 * heading marker. Single-line edits preserve the cursor or selection offset;
 * multi-line edits select the transformed block.
 */
export function setHeadingLevel(
  text: string,
  from: number,
  to: number,
  level: number,
): FormatEdit {
  const targetLevel = Math.max(0, Math.min(6, Math.trunc(level)));
  const start = clampPosition(from, text.length);
  const end = Math.max(start, clampPosition(to, text.length));
  const lineStart = text.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  let lineEnd = text.indexOf("\n", end);
  if (lineEnd === -1) {
    lineEnd = text.length;
  }
  const block = text.slice(lineStart, lineEnd);
  const prefix = targetLevel > 0 ? `${"#".repeat(targetLevel)} ` : "";

  if (block.length === 0) {
    return {
      from: start,
      to: end,
      insert: prefix,
      selectionFrom: start + prefix.length,
      selectionTo: start + prefix.length,
    };
  }

  const lines = block.split("\n");
  const transformed = lines.map((line) => {
    const heading = line.match(/^(\s{0,3})#{1,6}[ \t]+(.*)$/);
    if (targetLevel === 0) {
      return heading ? `${heading[1]}${heading[2]}` : line;
    }
    if (line.trim().length === 0) {
      return line;
    }
    if (heading) {
      return `${heading[1]}${prefix}${heading[2]}`;
    }
    const indent = line.match(/^\s{0,3}/)?.[0] ?? "";
    return `${indent}${prefix}${line.slice(indent.length)}`;
  });
  const insert = transformed.join("\n");

  if (lines.length === 1) {
    const delta = insert.length - block.length;
    return {
      from: lineStart,
      to: lineEnd,
      insert,
      selectionFrom: clampPosition(start + delta, lineStart + insert.length),
      selectionTo: clampPosition(end + delta, lineStart + insert.length),
    };
  }

  return {
    from: lineStart,
    to: lineEnd,
    insert,
    selectionFrom: lineStart,
    selectionTo: lineStart + insert.length,
  };
}

export function editForCommand(
  command: EditorCommand,
  text: string,
  from: number,
  to: number,
): FormatEdit {
  if (command === "link") {
    return insertLink(text, from, to);
  }
  return toggleInline(text, from, to, inlineMarkers[command]);
}

function applyEdit(view: EditorView, edit: FormatEdit): boolean {
  view.dispatch({
    changes: { from: edit.from, to: edit.to, insert: edit.insert },
    selection: { anchor: edit.selectionFrom, head: edit.selectionTo },
    scrollIntoView: true,
  });
  view.focus();
  return true;
}

export function runEditorCommand(
  view: EditorView,
  command: EditorCommand,
): boolean {
  const range = view.state.selection.main;
  const edit = editForCommand(
    command,
    view.state.doc.toString(),
    range.from,
    range.to,
  );
  return applyEdit(view, edit);
}

export function applyHeading(view: EditorView, level: number): boolean {
  const range = view.state.selection.main;
  const edit = setHeadingLevel(
    view.state.doc.toString(),
    range.from,
    range.to,
    level,
  );
  return applyEdit(view, edit);
}

export function formattingKeymap(): KeyBinding[] {
  return [
    {
      key: "Mod-b",
      run: (view) => runEditorCommand(view, "bold"),
      preventDefault: true,
    },
    {
      key: "Mod-i",
      run: (view) => runEditorCommand(view, "italic"),
      preventDefault: true,
    },
    {
      key: "Mod-Shift-x",
      run: (view) => runEditorCommand(view, "strikethrough"),
      preventDefault: true,
    },
    {
      key: "Mod-`",
      run: (view) => runEditorCommand(view, "inline-code"),
      preventDefault: true,
    },
    {
      key: "Mod-k",
      run: (view) => runEditorCommand(view, "link"),
      preventDefault: true,
    },
    ...[1, 2, 3, 4, 5, 6].map((level) => ({
      key: `Mod-${level}`,
      run: (view: EditorView) => applyHeading(view, level),
      preventDefault: true,
    })),
    {
      key: "Mod-0",
      run: (view) => applyHeading(view, 0),
      preventDefault: true,
    },
  ];
}
