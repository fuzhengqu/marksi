import { useEffect, useRef, useState } from "react";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { openSearchPanel } from "@codemirror/search";
import {
  EDITOR_COMMAND_EVENT,
  EDITOR_SEARCH_EVENT,
} from "../editor/bridge";
import { runEditorCommand, type EditorCommand } from "../editor/format";
import { createEditorExtensions } from "../editor/setup";
import { useAppStore } from "../store/useAppStore";

interface EditorPaneProps {
  content: string;
  documentKey: string;
  gotoLine: number | null;
  active: boolean;
  readOnly: boolean;
}

function focusSearchField(view: EditorView, replace: boolean): void {
  openSearchPanel(view);
  requestAnimationFrame(() => {
    const selector = replace ? 'input[name="replace"]' : 'input[name="search"]';
    const input = view.dom.querySelector<HTMLInputElement>(`.cm-search ${selector}`);
    input?.focus();
    input?.select();
  });
}

export function EditorPane({
  content,
  documentKey,
  gotoLine,
  active,
  readOnly,
}: EditorPaneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const contentRef = useRef(content);
  const readOnlyRef = useRef(readOnly);
  const [editableCompartment] = useState(() => new Compartment());
  const callbacksRef = useRef({
    onChange: useAppStore.getState().setContent,
    onCursor: useAppStore.getState().setCursor,
  });

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    readOnlyRef.current = readOnly;
  }, [readOnly]);

  useEffect(() => {
    callbacksRef.current = {
      onChange: useAppStore.getState().setContent,
      onCursor: useAppStore.getState().setCursor,
    };
  });

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const state = EditorState.create({
      doc: contentRef.current,
      extensions: [
        ...createEditorExtensions({
          onChange: (value) => callbacksRef.current.onChange(value),
          onCursor: (position) => callbacksRef.current.onCursor(position),
        }),
        editableCompartment.of(EditorView.editable.of(!readOnlyRef.current)),
      ],
    });

    const view = new EditorView({
      state,
      parent: hostRef.current,
    });

    viewRef.current = view;
    return () => {
      viewRef.current = null;
      view.destroy();
    };
  }, [editableCompartment]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: editableCompartment.reconfigure(
        EditorView.editable.of(!readOnly),
      ),
    });
    if (readOnly && view.hasFocus) {
      view.contentDOM.blur();
    }
  }, [editableCompartment, readOnly]);

  useEffect(() => {
    const onCommand = (event: Event) => {
      const view = viewRef.current;
      if (!view || readOnlyRef.current) {
        return;
      }
      const command = (event as CustomEvent<EditorCommand>).detail;
      runEditorCommand(view, command);
    };
    const onSearch = (event: Event) => {
      const view = viewRef.current;
      if (!view || readOnlyRef.current) {
        return;
      }
      focusSearchField(view, Boolean((event as CustomEvent<boolean>).detail));
    };
    window.addEventListener(EDITOR_COMMAND_EVENT, onCommand);
    window.addEventListener(EDITOR_SEARCH_EVENT, onSearch);
    return () => {
      window.removeEventListener(EDITOR_COMMAND_EVENT, onCommand);
      window.removeEventListener(EDITOR_SEARCH_EVENT, onSearch);
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const current = view.state.doc.toString();
    if (current !== content) {
      // Replacing the state, rather than only the text, clears the undo
      // history. Otherwise undo could walk back into the previously opened
      // document after a file switch or a new document.
      view.setState(
        EditorState.create({
          doc: content,
          extensions: [
            ...createEditorExtensions({
              onChange: (value) => callbacksRef.current.onChange(value),
              onCursor: (position) => callbacksRef.current.onCursor(position),
            }),
            editableCompartment.of(
              EditorView.editable.of(!readOnlyRef.current),
            ),
          ],
        }),
      );
    }
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !active) {
      return;
    }
    view.focus();
  }, [documentKey, active]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !active || gotoLine == null) {
      return;
    }
    const lineNumber = Math.min(Math.max(1, gotoLine), view.state.doc.lines);
    const line = view.state.doc.line(lineNumber);
    view.dispatch({
      selection: { anchor: line.from },
      scrollIntoView: true,
    });
    view.focus();
    useAppStore.getState().clearGotoLine();
  }, [gotoLine, active]);

  return (
    <div
      className="editor-area"
      aria-hidden={!active}
      inert={!active ? true : undefined}
    >
      <div className="editor-host" ref={hostRef} />
    </div>
  );
}
