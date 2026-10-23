import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
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
  placeholder,
  rectangularSelection,
} from "@codemirror/view";
import { markdownHighlightStyle, markEditorTheme } from "./theme";
import { formattingKeymap } from "./format";

export interface EditorCallbacks {
  onChange: (content: string) => void;
  onCursor: (position: { line: number; column: number }) => void;
  onFocus?: () => void;
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
    closeBrackets(),
    autocompletion(),
    indentOnInput(),
    EditorState.allowMultipleSelections.of(true),
    EditorState.tabSize.of(4),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({
      spellcheck: "true",
      autocorrect: "off",
      autocapitalize: "off",
    }),
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
      addKeymap: true,
    }),
    syntaxHighlighting(markdownHighlightStyle),
    markEditorTheme,
    placeholder("Start writing. Markdown is all you need."),
    keymap.of([
      ...formattingKeymap(),
      ...closeBracketsKeymap,
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
    }),
  ];
}
