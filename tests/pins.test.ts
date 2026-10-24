import { describe, expect, it } from "vitest";
import {
  isPinned,
  MAX_PINNED,
  normalizePins,
  pinKey,
  retargetPins,
  togglePin,
} from "../src/lib/pins";
import type { PinnedEntry } from "../src/types";

const file: PinnedEntry = {
  path: "C:\\Docs\\note.md",
  name: "note.md",
  isDir: false,
};
const folder: PinnedEntry = {
  path: "C:\\Docs\\notes",
  name: "notes",
  isDir: true,
};

describe("pinned locations", () => {
  it("adds newest entries first and toggles them off", () => {
    const first = togglePin([], file);
    expect(first).toEqual([file]);
    expect(isPinned(first, "c:/docs/note.md")).toBe(true);

    const second = togglePin(first, folder);
    expect(second.map((entry) => entry.name)).toEqual(["notes", "note.md"]);

    const removed = togglePin(second, file);
    expect(removed.map((entry) => entry.name)).toEqual(["notes"]);
  });

  it("deduplicates Windows-style paths and caps the list", () => {
    expect(pinKey("C:\\Docs\\Note.md")).toBe(pinKey("c:/docs/note.md"));
    let pinned: PinnedEntry[] = [];
    for (let index = 0; index < MAX_PINNED + 5; index += 1) {
      pinned = togglePin(pinned, {
        path: `C:\\Docs\\note-${index}.md`,
        name: `note-${index}.md`,
        isDir: false,
      });
    }
    expect(pinned).toHaveLength(MAX_PINNED);
    expect(pinned[0].name).toBe(`note-${MAX_PINNED + 4}.md`);
  });

  it("retargets pins after rename or move and removes deleted files", () => {
    const moved = retargetPins(
      [file, folder],
      "C:\\Docs\\note.md",
      "C:\\Docs\\renamed.md",
    );
    expect(moved[0].path).toBe("C:\\Docs\\renamed.md");
    expect(moved[0].name).toBe("renamed.md");
    expect(moved[1]).toEqual(folder);

    expect(retargetPins(moved, "C:/docs/renamed.md", null)).toEqual([
      folder,
    ]);
  });

  it("normalizes persisted values and rejects malformed entries", () => {
    const normalized = normalizePins([
      { path: " C:\\Docs\\note.md ", name: " note.md ", isDir: false },
      { path: "c:/docs/NOTE.md", name: "duplicate", isDir: false },
      { path: "", name: "missing", isDir: false },
      { path: "C:\\Docs\\folder", name: "folder", isDir: "yes" },
      null,
      "invalid",
    ]);
    expect(normalized).toEqual([
      { path: "C:\\Docs\\note.md", name: "note.md", isDir: false },
      { path: "C:\\Docs\\folder", name: "folder", isDir: false },
    ]);
    expect(normalizePins(null)).toEqual([]);
  });
});
