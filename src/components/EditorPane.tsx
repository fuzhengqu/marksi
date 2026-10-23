import { useEffect, useRef, useState } from "react";
import { Annotation, Compartment, EditorState } from "@codemirror/state";
import { EditorView, placeholder } from "@codemirror/view";
import { openSearchPanel } from "@codemirror/search";
import {
  EDITOR_COMMAND_EVENT,
  EDITOR_IMAGE_RESIZE_EVENT,
  EDITOR_INSERT_EVENT,
  EDITOR_SEARCH_EVENT,
  type EditorImageResizeRequest,
  type EditorInsertRequest,
} from "../editor/bridge";
import { runEditorCommand, type EditorCommand } from "../editor/format";
import {
  createEditorExtensions,
  editorContentAttributes,
} from "../editor/setup";
import { livePreview } from "../editor/livePreview";
import { searchPhrases } from "../i18n";
import { clearImageSize, setImageFit, setImageSize } from "../lib/imageSize";
import { minimalTextChange } from "../lib/textChange";
import { smartTyping } from "../editor/smartTyping";
import {
  centerSelection,
  focusMode,
  typewriterMode,
} from "../editor/viewModes";
import { useAppStore } from "../store/useAppStore";
import type { Language } from "../types";

interface EditorPaneProps {
  content: string;
  documentKey: string;
  gotoLine: number | null;
  active: boolean;
  readOnly: boolean;
  focusMode: boolean;
  typewriterMode: boolean;
  spellcheck: boolean;
  autoPair: boolean;
  smartPunctuation: boolean;
  emojiAutocomplete: boolean;
  livePreviewMode: boolean;
  language: Language;
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

const allowReadOnlyEdit = Annotation.define<boolean>();

function editableExtensions(readOnly: boolean) {
  const extensions = [
    EditorView.editable.of(!readOnly),
    EditorState.readOnly.of(readOnly),
  ];
  if (readOnly) {
    extensions.push(
      EditorState.transactionFilter.of((transaction) =>
        transaction.docChanged && !transaction.annotation(allowReadOnlyEdit)
          ? []
          : transaction,
      ),
    );
  }
  return extensions;
}

export function EditorPane({
  content,
  documentKey,
  gotoLine,
  active,
  readOnly,
  focusMode: focusModeEnabled,
  typewriterMode: typewriterModeEnabled,
  spellcheck,
  autoPair,
  smartPunctuation,
  emojiAutocomplete,
  livePreviewMode,
  language,
}: EditorPaneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const contentRef = useRef(content);
  const readOnlyRef = useRef(readOnly);
  const focusModeRef = useRef(focusModeEnabled);
  const typewriterModeRef = useRef(typewriterModeEnabled);
  const spellcheckRef = useRef(spellcheck);
  const autoPairRef = useRef(autoPair);
  const smartPunctuationRef = useRef(smartPunctuation);
  const emojiAutocompleteRef = useRef(emojiAutocomplete);
  const livePreviewRef = useRef(livePreviewMode);
  const languageRef = useRef(language);
  const [editableCompartment] = useState(() => new Compartment());
  const [focusModeCompartment] = useState(() => new Compartment());
  const [typewriterModeCompartment] = useState(() => new Compartment());
  const [spellcheckCompartment] = useState(() => new Compartment());
  const [typingCompartment] = useState(() => new Compartment());
  const [livePreviewCompartment] = useState(() => new Compartment());
  const [phrasesCompartment] = useState(() => new Compartment());
  const [placeholderCompartment] = useState(() => new Compartment());
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
    focusModeRef.current = focusModeEnabled;
  }, [focusModeEnabled]);

  useEffect(() => {
    typewriterModeRef.current = typewriterModeEnabled;
  }, [typewriterModeEnabled]);

  useEffect(() => {
    spellcheckRef.current = spellcheck;
  }, [spellcheck]);

  useEffect(() => {
    autoPairRef.current = autoPair;
    smartPunctuationRef.current = smartPunctuation;
    emojiAutocompleteRef.current = emojiAutocomplete;
    livePreviewRef.current = livePreviewMode;
    languageRef.current = language;
  }, [
    autoPair,
    emojiAutocomplete,
    language,
    livePreviewMode,
    smartPunctuation,
  ]);

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
        editableCompartment.of(editableExtensions(readOnlyRef.current)),
        focusModeCompartment.of(
          focusModeRef.current ? focusMode() : [],
        ),
        typewriterModeCompartment.of(
          typewriterModeRef.current ? typewriterMode() : [],
        ),
        spellcheckCompartment.of(
          editorContentAttributes(spellcheckRef.current),
        ),
        typingCompartment.of(
          smartTyping({
            autoPair: autoPairRef.current,
            smartPunctuation: smartPunctuationRef.current,
            emojiAutocomplete: emojiAutocompleteRef.current,
          }),
        ),
        livePreviewCompartment.of(
          livePreviewRef.current ? livePreview() : [],
        ),
        phrasesCompartment.of(
          EditorState.phrases.of(searchPhrases(languageRef.current)),
        ),
        placeholderCompartment.of(
          placeholder(
            languageRef.current === "zh-CN"
              ? "开始写作。Markdown 足矣。"
              : "Start writing. Markdown is all you need.",
          ),
        ),
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
  }, [
    editableCompartment,
    focusModeCompartment,
    livePreviewCompartment,
    phrasesCompartment,
    placeholderCompartment,
    spellcheckCompartment,
    typewriterModeCompartment,
    typingCompartment,
  ]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: editableCompartment.reconfigure(
        editableExtensions(readOnly),
      ),
    });
    if (readOnly && view.hasFocus) {
      view.contentDOM.blur();
    }
  }, [editableCompartment, readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: focusModeCompartment.reconfigure(
        focusModeEnabled ? focusMode() : [],
      ),
    });
  }, [focusModeCompartment, focusModeEnabled]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: typewriterModeCompartment.reconfigure(
        typewriterModeEnabled ? typewriterMode() : [],
      ),
    });
    if (typewriterModeEnabled && active) {
      requestAnimationFrame(() => {
        if (viewRef.current === view && view.dom.isConnected) {
          centerSelection(view);
        }
      });
    }
  }, [active, typewriterModeCompartment, typewriterModeEnabled]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: spellcheckCompartment.reconfigure(
        editorContentAttributes(spellcheck),
      ),
    });
  }, [spellcheck, spellcheckCompartment]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: livePreviewCompartment.reconfigure(
        livePreviewMode ? livePreview() : [],
      ),
    });
  }, [livePreviewCompartment, livePreviewMode]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const effects = [
      phrasesCompartment.reconfigure(
        EditorState.phrases.of(searchPhrases(language)),
      ),
      placeholderCompartment.reconfigure(
        placeholder(
          language === "zh-CN"
            ? "开始写作。Markdown 足矣。"
            : "Start writing. Markdown is all you need.",
        ),
      ),
    ];
    view.dispatch({ effects });
  }, [language, phrasesCompartment, placeholderCompartment]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: typingCompartment.reconfigure(
        smartTyping({ autoPair, smartPunctuation, emojiAutocomplete }),
      ),
    });
  }, [
    autoPair,
    emojiAutocomplete,
    smartPunctuation,
    typingCompartment,
  ]);

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
      if (!view) {
        return;
      }
      focusSearchField(view, Boolean((event as CustomEvent<boolean>).detail));
    };
    const onInsert = (event: Event) => {
      const view = viewRef.current;
      const request = (event as CustomEvent<EditorInsertRequest>).detail;
      if (!view || readOnlyRef.current || !request?.text) {
        return;
      }

      let text = request.text;
      if (request.block) {
        const { from, to } = view.state.selection.main;
        const before = view.state.sliceDoc(Math.max(0, from - 2), from);
        const after = view.state.sliceDoc(
          to,
          Math.min(view.state.doc.length, to + 2),
        );
        const prefix =
          from === 0
            ? ""
            : before.endsWith("\n\n")
              ? ""
              : before.endsWith("\n")
                ? "\n"
                : "\n\n";
        const suffix =
          to >= view.state.doc.length
            ? ""
            : after.startsWith("\n\n")
              ? ""
              : after.startsWith("\n")
                ? "\n"
                : "\n\n";
        text = `${prefix}${text}${suffix}`;
      }

      view.dispatch({
        ...view.state.replaceSelection(text),
        scrollIntoView: true,
      });
      view.focus();
    };
    const onImageResize = (event: Event) => {
      const view = viewRef.current;
      const request = (event as CustomEvent<EditorImageResizeRequest>).detail;
      if (!view || !request) {
        return;
      }
      const current = view.state.doc.toString();
      const next = request.reset
        ? clearImageSize(current, request.imageIndex, request.alt)
        : request.fit
          ? setImageFit(
              current,
              request.imageIndex,
              request.fit,
              request.width,
              request.height,
              request.alt,
            )
          : setImageSize(
              current,
              request.imageIndex,
              request.width,
              request.height,
              request.alt,
            );
      const change = minimalTextChange(current, next);
      if (!change) {
        return;
      }
      view.dispatch({
        changes: change,
        annotations: allowReadOnlyEdit.of(true),
        scrollIntoView: false,
      });
    };
    window.addEventListener(EDITOR_COMMAND_EVENT, onCommand);
    window.addEventListener(EDITOR_SEARCH_EVENT, onSearch);
    window.addEventListener(EDITOR_INSERT_EVENT, onInsert);
    window.addEventListener(EDITOR_IMAGE_RESIZE_EVENT, onImageResize);
    return () => {
      window.removeEventListener(EDITOR_COMMAND_EVENT, onCommand);
      window.removeEventListener(EDITOR_SEARCH_EVENT, onSearch);
      window.removeEventListener(EDITOR_INSERT_EVENT, onInsert);
      window.removeEventListener(EDITOR_IMAGE_RESIZE_EVENT, onImageResize);
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
              editableExtensions(readOnlyRef.current),
            ),
            focusModeCompartment.of(
              focusModeRef.current ? focusMode() : [],
            ),
            typewriterModeCompartment.of(
              typewriterModeRef.current ? typewriterMode() : [],
            ),
            spellcheckCompartment.of(
              editorContentAttributes(spellcheckRef.current),
            ),
            typingCompartment.of(
              smartTyping({
                autoPair: autoPairRef.current,
                smartPunctuation: smartPunctuationRef.current,
                emojiAutocomplete: emojiAutocompleteRef.current,
              }),
            ),
            livePreviewCompartment.of(
              livePreviewRef.current ? livePreview() : [],
            ),
            phrasesCompartment.of(
              EditorState.phrases.of(searchPhrases(languageRef.current)),
            ),
            placeholderCompartment.of(
              placeholder(
                languageRef.current === "zh-CN"
                  ? "开始写作。Markdown 足矣。"
                  : "Start writing. Markdown is all you need.",
              ),
            ),
          ],
        }),
      );
    }
    contentRef.current = content;
  }, [
    content,
    editableCompartment,
    focusModeCompartment,
    livePreviewCompartment,
    phrasesCompartment,
    placeholderCompartment,
    spellcheckCompartment,
    typewriterModeCompartment,
    typingCompartment,
  ]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !active) {
      return;
    }
    view.focus();
    if (typewriterModeRef.current) {
      requestAnimationFrame(() => {
        if (viewRef.current === view && view.dom.isConnected) {
          centerSelection(view);
        }
      });
    }
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
      className={`editor-area ${readOnly ? "is-read-only" : ""}`}
      aria-hidden={!active}
      inert={!active ? true : undefined}
    >
      <div className="editor-host" ref={hostRef} />
    </div>
  );
}
