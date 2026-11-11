import { describe, expect, it } from "vitest";
import {
  MERMAID_PREVIEW_MAX_CHARS,
  MERMAID_PREVIEW_MAX_DIAGRAMS,
  findMermaidBlocks,
  isMermaidFenceInfo,
  mermaidPreviewLimit,
} from "../src/lib/mermaidBlocks";

describe("mermaidPreviewLimit", () => {
  it("allows diagrams for ordinary documents", () => {
    expect(mermaidPreviewLimit(0)).toBe(MERMAID_PREVIEW_MAX_DIAGRAMS);
    expect(mermaidPreviewLimit(MERMAID_PREVIEW_MAX_CHARS)).toBe(
      MERMAID_PREVIEW_MAX_DIAGRAMS,
    );
  });

  it("falls back to source for very large documents", () => {
    expect(mermaidPreviewLimit(MERMAID_PREVIEW_MAX_CHARS + 1)).toBe(0);
  });
});

describe("isMermaidFenceInfo", () => {
  it("accepts the language token in common forms", () => {
    expect(isMermaidFenceInfo("mermaid")).toBe(true);
    expect(isMermaidFenceInfo("Mermaid")).toBe(true);
    expect(isMermaidFenceInfo(" mermaid title")).toBe(true);
    expect(isMermaidFenceInfo("{.mermaid}")).toBe(true);
  });

  it("rejects other languages and near matches", () => {
    expect(isMermaidFenceInfo("text")).toBe(false);
    expect(isMermaidFenceInfo("mermaidjs")).toBe(false);
    expect(isMermaidFenceInfo("")).toBe(false);
  });
});

describe("findMermaidBlocks", () => {
  it("finds a diagram and keeps its source", () => {
    const source = "Before\n```mermaid\ngraph TD\nA-->B\n```\nAfter";
    expect(findMermaidBlocks(source)).toEqual([
      {
        from: 7,
        to: 36,
        content: "graph TD\nA-->B\n",
      },
    ]);
  });

  it("finds multiple diagrams and ignores other fences", () => {
    const source = [
      "```text",
      "graph TD",
      "```",
      "",
      "```mermaid",
      "flowchart LR",
      "A-->B",
      "```",
      "",
      "~~~Mermaid",
      "sequenceDiagram",
      "A->>B: Hi",
      "~~~",
    ].join("\n");
    expect(findMermaidBlocks(source).map((block) => block.content)).toEqual([
      "flowchart LR\nA-->B\n",
      "sequenceDiagram\nA->>B: Hi\n",
    ]);
  });

  it("ignores empty diagrams", () => {
    expect(findMermaidBlocks("```mermaid\n\n```")).toEqual([]);
  });

  it("ignores fences inside YAML front matter", () => {
    const source = [
      "---",
      "example: |",
      "  ```mermaid",
      "  graph TD",
      "  ```",
      "---",
      "```mermaid",
      "graph LR",
      "```",
    ].join("\n");
    expect(findMermaidBlocks(source).map((block) => block.content)).toEqual([
      "graph LR\n",
    ]);
  });

  it("normalizes CRLF diagram source", () => {
    expect(
      findMermaidBlocks("```mermaid\r\ngraph TD\r\nA-->B\r\n```")[0].content,
    ).toBe("graph TD\nA-->B\n");
  });

  it("does not treat indented or quoted fences as top-level diagrams", () => {
    expect(findMermaidBlocks("    ```mermaid\n    graph TD\n    ```")).toEqual(
      [],
    );
    expect(findMermaidBlocks("> ```mermaid\n> graph TD\n> ```")).toEqual([]);
  });
});
