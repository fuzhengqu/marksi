import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorState, type Extension } from "@codemirror/state";
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightSpecialChars,
  keymap,
  rectangularSelection,
} from "@codemirror/view";
import { EDITOR_PASTE_IMAGE_EVENT } from "./bridge";
import { markdownHighlightStyle, markEditorTheme } from "./theme";
import { formattingKeymap } from "./format";

export interface EditorCallbacks {
  onChange: (content: string) => void;
  onCursor: (position: { line: number; column: number }) => void;
  onFocus?: () => void;
}

export function editorContentAttributes(spellcheck: boolean): Extension {
  return EditorView.contentAttributes.of({
    spellcheck: String(spellcheck),
    autocorrect: "off",
    autocapitalize: "off",
  });
}

export function createEditorExtensions(callbacks: EditorCallbacks): Extension[] {
  return [
    history(),
    drawSelection(),
    dropCursor(),
    rectangularSelection(),
    crosshairCursor(),
    highlightSpecialChars(),
    highlightSelectionMatches(),
    bracketMatching(),
    autocompletion(),
    indentOnInput(),
    EditorState.allowMultipleSelections.of(true),
    EditorState.tabSize.of(4),
    EditorView.lineWrapping,
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
      addKeymap: true,
    }),
    syntaxHighlighting(markdownHighlightStyle),
    markEditorTheme,
    keymap.of([
      ...formattingKeymap(),
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...completionKeymap,
      indentWithTab,
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        callbacks.onChange(update.state.doc.toString());
      }
      if (update.selectionSet || update.docChanged) {
        const head = update.state.selection.main.head;
        const line = update.state.doc.lineAt(head);
        callbacks.onCursor({
          line: line.number,
          column: head - line.from + 1,
        });
      }
    }),
    EditorView.domEventHandlers({
      focus: () => {
        callbacks.onFocus?.();
      },
      paste: (event) => {
        const items = event.clipboardData?.items;
        if (!items) {
          return false;
        }
        for (const item of Array.from(items)) {
          if (item.kind !== "file" || !item.type.startsWith("image/")) {
            continue;
          }
          const file = item.getAsFile();
          if (!file) {
            continue;
          }
          event.preventDefault();
          window.dispatchEvent(
            new CustomEvent<File>(EDITOR_PASTE_IMAGE_EVENT, { detail: file }),
          );
          return true;
        }
        return false;
      },
    }),
  ];
}
