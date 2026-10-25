import {
  closeBrackets,
  closeBracketsKeymap,
  startCompletion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { EditorState, Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { extractFrontMatter } from "../lib/frontMatter";
import { filterEmojis } from "./emojis";

export interface SmartTypingOptions {
  autoPair: boolean;
  smartPunctuation: boolean;
  emojiAutocomplete: boolean;
}

type Change = { from: number; to?: number; insert: string };

export type TypingPlan =
  | { kind: "cursor"; anchor: number }
  | { kind: "replace"; from: number; to: number; insert: string; anchor: number }
  | { kind: "changes"; changes: Change[]; anchor: number };

const MARKDOWN_MARKERS = new Set(["*", "_", "~", "=", "$", "`"]);
const LITERAL_NODE_PATTERN =
  /^(?:Code|FencedCode|CodeText|InlineCode|CodeBlock|URL|LinkTitle|LinkLabel|Autolink|Image|HTML|Comment|Math|YAML|FrontMatter)/;

function hasOpenLinkDestination(before: string): boolean {
  const opened = before.lastIndexOf("](");
  return opened !== -1 && before.lastIndexOf(")") < opened;
}

/**
 * True when the caret is in a place where markup characters should stay
 * literal. The parser catches complete code/link syntax, while the line and
 * front-matter checks cover incomplete constructs the parser cannot recognize
 * yet (for example, a link title being typed for the first time).
 */
export function isLiteralContext(state: EditorState, position: number): boolean {
  if (position < 0 || position > state.doc.length) {
    return false;
  }

  const tree = syntaxTree(state);
  let node = tree.resolveInner(position, -1) as typeof tree.topNode | null;
  while (node) {
    if (LITERAL_NODE_PATTERN.test(node.name)) {
      return true;
    }
    node = node.parent;
  }

  const line = state.doc.lineAt(position);
  const before = state.doc.sliceString(line.from, position);
  if (/^\s{4,}/.test(before) || hasOpenLinkDestination(before)) {
    return true;
  }

  // The Markdown parser only recognizes a code span after its closing
  // backtick. Treat an unmatched backtick on the current line as code while
  // the writer is still typing it.
  const backticks = before.split("`").length - 1;
  if (backticks % 2 === 1) {
    return true;
  }

  if (state.doc.line(1).text.trim() === "---") {
    const frontMatter = extractFrontMatter(state.doc.toString());
    if (frontMatter && position < frontMatter.block.length) {
      return true;
    }
  }

  return false;
}

function previousCharacter(state: EditorState, position: number): string {
  return position > 0 ? state.doc.sliceString(position - 1, position) : "";
}

function nextCharacter(state: EditorState, position: number): string {
  return position < state.doc.length
    ? state.doc.sliceString(position, position + 1)
    : "";
}

/**
 * Plans the result of typing a Markdown marker such as `*` or `~~`. A single
 * marker opens a pair, a second adjacent marker promotes it to a double pair,
 * and typing a marker immediately before an existing closing run moves over
 * that run instead of duplicating it.
 */
export function markdownPairPlan(
  state: EditorState,
  character: string,
): TypingPlan | null {
  if (!MARKDOWN_MARKERS.has(character) || !state.selection.main.empty) {
    return null;
  }

  const position = state.selection.main.head;
  const line = state.doc.lineAt(position);
  const beforeLine = state.doc.sliceString(line.from, position);

  // Let block syntax start intact: list bullets, setext underlines, rules,
  // front matter, and fenced code all begin with a bare marker.
  if (beforeLine.trim() === "") {
    return null;
  }
  if (isLiteralContext(state, position)) {
    return null;
  }

  const previous = previousCharacter(state, position);
  const next = nextCharacter(state, position);

  if (character === "_" && /[\p{L}\p{N}]/u.test(previous) && /[\p{L}\p{N}]/u.test(next)) {
    return null;
  }

  // Consecutive markers typed by hand at the start of a block are syntax, not
  // an auto-pair request. The normal input path should insert them literally.
  if (!next && previous === character) {
    return null;
  }

  let before = 0;
  while (
    position - before - 1 >= line.from &&
    state.doc.sliceString(position - before - 1, position - before) === character
  ) {
    before += 1;
  }
  let after = 0;
  while (
    position + after < line.to &&
    state.doc.sliceString(position + after, position + after + 1) === character
  ) {
    after += 1;
  }

  if (after > 0) {
    if (before === 1 && after === 1) {
      return {
        kind: "changes",
        changes: [
          { from: position, insert: character },
          { from: position + 1, insert: character },
        ],
        anchor: position + 1,
      };
    }
    return { kind: "cursor", anchor: position + 1 };
  }

  // After a word, a lone marker is almost always a closing marker that the
  // writer is typing by hand. Let the normal input path add one character, so
  // italic and code spans stay balanced at the start of a block.
  if (/[\p{L}\p{N}]/u.test(previous)) {
    return null;
  }

  return {
    kind: "replace",
    from: position,
    to: position,
    insert: character + character,
    anchor: position + 1,
  };
}

function smartQuotePlan(
  state: EditorState,
  character: string,
  position: number,
  autoPair: boolean,
  literal: boolean,
): TypingPlan | null {
  if (character !== '"' && character !== "'") {
    return null;
  }
  if (literal) {
    return null;
  }

  const previous = previousCharacter(state, position);
  const next = nextCharacter(state, position);
  const opening = !previous || /[\s([{<—–“‘]/u.test(previous);

  if (
    character === "'" &&
    /[\p{L}\p{N}]/u.test(previous) &&
    /[\p{L}\p{N}]/u.test(next)
  ) {
    return {
      kind: "replace",
      from: position,
      to: position,
      insert: "’",
      anchor: position + 1,
    };
  }

  const closing = character === '"' ? "”" : "’";
  const openingQuote = character === '"' ? "“" : "‘";

  if (next === closing && !opening) {
    return { kind: "cursor", anchor: position + 1 };
  }

  if (opening && autoPair) {
    return {
      kind: "replace",
      from: position,
      to: position,
      insert: openingQuote + closing,
      anchor: position + 1,
    };
  }

  return {
    kind: "replace",
    from: position,
    to: position,
    insert: opening ? openingQuote : closing,
    anchor: position + 1,
  };
}

/**
 * Plans smart punctuation edits for a single typed character. Returned plans
 * replace the typed character, so the caller should not let the browser insert
 * it separately.
 */
export function smartPunctuationPlan(
  state: EditorState,
  character: string,
  autoPair: boolean,
): TypingPlan | null {
  if (!state.selection.main.empty) {
    return null;
  }

  const position = state.selection.main.head;
  const literal = isLiteralContext(state, position);
  const quotePlan = smartQuotePlan(
    state,
    character,
    position,
    autoPair,
    literal,
  );
  if (quotePlan) {
    return quotePlan;
  }

  if (literal) {
    return null;
  }

  if (character === ".") {
    const before = state.doc.sliceString(Math.max(0, position - 2), position);
    if (before === "..") {
      return {
        kind: "replace",
        from: position - 2,
        to: position,
        insert: "…",
        anchor: position - 1,
      };
    }
  }

  if (character === "-") {
    const line = state.doc.lineAt(position);
    const beforeLine = state.doc.sliceString(line.from, position);
    if (/^[ \t]*-*$/.test(beforeLine)) {
      return null;
    }

    const previous = previousCharacter(state, position);
    if (previous === "–") {
      return {
        kind: "replace",
        from: position - 1,
        to: position,
        insert: "—",
        anchor: position,
      };
    }
    if (previous === "-") {
      return {
        kind: "replace",
        from: position - 1,
        to: position,
        insert: "–",
        anchor: position,
      };
    }
  }

  return null;
}

function dispatchPlan(view: EditorView, plan: TypingPlan): void {
  if (plan.kind === "cursor") {
    view.dispatch({
      selection: { anchor: plan.anchor },
      scrollIntoView: true,
      userEvent: "input.type",
    });
    return;
  }

  view.dispatch({
    changes:
      plan.kind === "replace"
        ? { from: plan.from, to: plan.to, insert: plan.insert }
        : plan.changes,
    selection: { anchor: plan.anchor },
    scrollIntoView: true,
    userEvent: "input.type",
  });
}

function typingInputHandler(options: SmartTypingOptions): Extension {
  return EditorView.inputHandler.of((view, from, to, insert) => {
    if (
      view.composing ||
      view.compositionStarted ||
      view.state.readOnly ||
      from !== to ||
      insert.length !== 1
    ) {
      return false;
    }

    const plan =
      (options.smartPunctuation
        ? smartPunctuationPlan(view.state, insert, options.autoPair)
        : null) ??
      (options.autoPair
        ? markdownPairPlan(view.state, insert)
        : null);

    if (!plan) {
      return false;
    }

    dispatchPlan(view, plan);
    return true;
  });
}

function emojiCompletionSource(
  context: CompletionContext,
): CompletionResult | null {
  if (context.view?.composing || context.view?.compositionStarted) {
    return null;
  }
  if (isLiteralContext(context.state, context.pos)) {
    return null;
  }

  const line = context.state.doc.lineAt(context.pos);
  const before = context.state.sliceDoc(line.from, context.pos);
  const match = /(^|[\s([{])[:]([a-z0-9_+-]*):?$/i.exec(before);
  if (!match) {
    return null;
  }

  const from = line.from + match.index + match[1].length;
  const options = filterEmojis(match[2]).map(({ alias, emoji }) => ({
    label: `:${alias}:`,
    detail: emoji,
    apply: emoji,
    type: "text",
  }));
  if (options.length === 0) {
    return null;
  }

  return { from, options, filter: false };
}

function emojiCompletionExtensions(): Extension {
  return [
    EditorState.languageData.of(() => [
      { autocomplete: emojiCompletionSource },
    ]),
    EditorView.inputHandler.of((view, from, to, insert) => {
      if (
        insert !== ":" ||
        from !== to ||
        view.state.readOnly ||
        view.composing ||
        view.compositionStarted
      ) {
        return false;
      }
      globalThis.setTimeout(() => {
        if (view.dom.isConnected && view.state.selection.main.empty) {
          startCompletion(view);
        }
      }, 0);
      return false;
    }),
  ];
}

export function smartTyping(options: SmartTypingOptions): Extension {
  const extensions: Extension[] = [];
  if (options.autoPair || options.smartPunctuation) {
    extensions.push(Prec.highest(typingInputHandler(options)));
  }
  if (options.autoPair) {
    extensions.push(
      Prec.high(keymap.of(closeBracketsKeymap)),
      closeBrackets(),
    );
  }
  if (options.emojiAutocomplete) {
    extensions.push(emojiCompletionExtensions());
  }
  return extensions;
}
