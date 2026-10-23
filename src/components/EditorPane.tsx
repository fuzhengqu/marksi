import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { createEditorExtensions } from "../editor/setup";
import { useAppStore } from "../store/useAppStore";

interface EditorPaneProps {
  content: string;
  documentKey: string;
  gotoLine: number | null;
}

export function EditorPane({ content, documentKey, gotoLine }: EditorPaneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const contentRef = useRef(content);
  const callbacksRef = useRef({
    onChange: useAppStore.getState().setContent,
    onCursor: useAppStore.getState().setCursor,
  });

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

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
      extensions: createEditorExtensions({
        onChange: (value) => callbacksRef.current.onChange(value),
        onCursor: (position) => callbacksRef.current.onCursor(position),
      }),
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
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const current = view.state.doc.toString();
    if (current !== content) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
      });
    }
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.focus();
  }, [documentKey]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || gotoLine == null) {
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
  }, [gotoLine]);

  return (
    <div className="editor-area">
      <div className="editor-host" ref={hostRef} />
    </div>
  );
}
