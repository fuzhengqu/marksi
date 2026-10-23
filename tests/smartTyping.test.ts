import { describe, expect, it } from "vitest";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { filterEmojis } from "../src/editor/emojis";
import {
  markdownPairPlan,
  smartPunctuationPlan,
  type TypingPlan,
} from "../src/editor/smartTyping";

function stateFor(doc: string, position = doc.length): EditorState {
  return EditorState.create({
    doc,
    selection: { anchor: position },
    extensions: [markdown({ base: markdownLanguage, addKeymap: false })],
  });
}

function applyPlan(state: EditorState, plan: TypingPlan) {
  if (plan.kind === "cursor") {
    return { doc: state.doc.toString(), anchor: plan.anchor };
  }
  const changes =
    plan.kind === "replace"
      ? { from: plan.from, to: plan.to, insert: plan.insert }
      : plan.changes;
  const transaction = state.update({
    changes,
    selection: { anchor: plan.anchor },
  });
  return {
    doc: transaction.state.doc.toString(),
    anchor: transaction.state.selection.main.head,
  };
}

describe("markdownPairPlan", () => {
  it("opens an italic pair after whitespace", () => {
    const plan = markdownPairPlan(stateFor("hello "), "*");
    expect(plan).not.toBeNull();
    expect(applyPlan(stateFor("hello "), plan!)).toEqual({
      doc: "hello **",
      anchor: 7,
    });
  });

  it("promotes a single pair to a double pair", () => {
    const state = stateFor("hello **", 7);
    const plan = markdownPairPlan(state, "*");
    expect(applyPlan(state, plan!)).toEqual({
      doc: "hello ****",
      anchor: 8,
    });
  });

  it("moves over an existing closing run instead of duplicating it", () => {
    const state = stateFor("hello *text*", 11);
    expect(markdownPairPlan(state, "*")).toEqual({
      kind: "cursor",
      anchor: 12,
    });
  });

  it("does not pair markers in code or at the start of a block", () => {
    expect(markdownPairPlan(stateFor("`code`", 3), "*")).toBeNull();
    expect(markdownPairPlan(stateFor("", 0), "*")).toBeNull();
    expect(markdownPairPlan(stateFor("*", 1), "*")).toBeNull();
  });

  it("does not split snake_case identifiers", () => {
    expect(markdownPairPlan(stateFor("snakecase", 5), "_")).toBeNull();
  });

  it("leaves a closing marker after a word to the normal input path", () => {
    expect(markdownPairPlan(stateFor("hello", 5), "*")).toBeNull();
  });

  it("pairs after punctuation", () => {
    const plan = markdownPairPlan(stateFor("hello ("), "*");
    expect(applyPlan(stateFor("hello ("), plan!)).toEqual({
      doc: "hello (**",
      anchor: 8,
    });
  });
});

describe("smartPunctuationPlan", () => {
  it("pairs opening quotes and inserts closing quotes", () => {
    const opening = smartPunctuationPlan(stateFor("Hello "), '"', true);
    expect(applyPlan(stateFor("Hello "), opening!)).toEqual({
      doc: "Hello “”",
      anchor: 7,
    });

    const closing = smartPunctuationPlan(stateFor("Hello"), '"', true);
    expect(applyPlan(stateFor("Hello"), closing!)).toEqual({
      doc: "Hello”",
      anchor: 6,
    });
  });

  it("uses an apostrophe inside contractions", () => {
    const plan = smartPunctuationPlan(stateFor("dont", 3), "'", true);
    expect(applyPlan(stateFor("dont", 3), plan!)).toEqual({
      doc: "don’t",
      anchor: 4,
    });
  });

  it("turns two periods into an ellipsis", () => {
    const state = stateFor("Wait..");
    const plan = smartPunctuationPlan(state, ".", true);
    expect(applyPlan(state, plan!)).toEqual({ doc: "Wait…", anchor: 5 });
  });

  it("turns double and triple hyphens into en and em dashes", () => {
    const en = smartPunctuationPlan(stateFor("word-"), "-", true);
    expect(applyPlan(stateFor("word-"), en!)).toEqual({
      doc: "word–",
      anchor: 5,
    });

    const em = smartPunctuationPlan(stateFor("word–"), "-", true);
    expect(applyPlan(stateFor("word–"), em!)).toEqual({
      doc: "word—",
      anchor: 5,
    });
  });

  it("keeps block-level dashes literal", () => {
    expect(smartPunctuationPlan(stateFor("--"), "-", true)).toBeNull();
    expect(smartPunctuationPlan(stateFor("  --"), "-", true)).toBeNull();
  });

  it("skips code, link destinations, and front matter", () => {
    expect(smartPunctuationPlan(stateFor("`code`", 3), '"', true)).toBeNull();
    expect(smartPunctuationPlan(stateFor("`code", 5), '"', true)).toBeNull();
    expect(
      smartPunctuationPlan(stateFor('[x](url "'), '"', true),
    ).toBeNull();

    const frontMatter = "---\ntitle: \n---\nBody";
    const position = frontMatter.indexOf("title: ") + "title: ".length;
    expect(
      smartPunctuationPlan(stateFor(frontMatter, position), '"', true),
    ).toBeNull();
  });
});

describe("filterEmojis", () => {
  it("returns common aliases for an empty query", () => {
    const matches = filterEmojis("");
    expect(matches).toHaveLength(12);
    expect(matches[0]).toEqual({ alias: "grinning", emoji: "😀" });
  });

  it("prefers aliases that start with the query", () => {
    const aliases = filterEmojis("smile").map((match) => match.alias);
    expect(aliases[0]).toBe("smile");
    expect(aliases).toContain("smiley");
    expect(aliases).toContain("smile_cat");
  });

  it("supports symbol aliases and empty results", () => {
    expect(filterEmojis("+1")[0]).toEqual({ alias: "+1", emoji: "👍" });
    expect(filterEmojis("not-a-real-emoji")).toEqual([]);
  });
});
