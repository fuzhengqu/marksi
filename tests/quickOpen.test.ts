import { describe, expect, it } from "vitest";
import { rankQuickOpen } from "../src/lib/quickOpen";

const files = [
  { path: "/workspace/notes.md", name: "notes.md", relativePath: "notes.md" },
  {
    path: "/workspace/docs/meeting-notes.md",
    name: "meeting-notes.md",
    relativePath: "docs/meeting-notes.md",
  },
  {
    path: "/workspace/readme.markdown",
    name: "readme.markdown",
    relativePath: "readme.markdown",
  },
];

describe("rankQuickOpen", () => {
  it("ranks direct filename matches above deep path matches", () => {
    const results = rankQuickOpen(files, "notes");
    expect(results[0].name).toBe("notes.md");
    expect(results.map((item) => item.name)).toContain("meeting-notes.md");
  });

  it("matches subsequences across the path", () => {
    const results = rankQuickOpen(files, "rdme");
    expect(results[0].name).toBe("readme.markdown");
  });

  it("prefers recent files when scores are close", () => {
    const results = rankQuickOpen(
      [
        ...files,
        {
          path: "/workspace/notes-copy.md",
          name: "notes-copy.md",
          relativePath: "notes-copy.md",
          recent: true,
        },
      ],
      "notes",
    );
    expect(results[0].name).toBe("notes-copy.md");
  });

  it("returns no results for unmatched queries and respects the limit", () => {
    expect(rankQuickOpen(files, "unfindable")).toEqual([]);
    expect(rankQuickOpen(files, "", 2)).toHaveLength(2);
  });
});
