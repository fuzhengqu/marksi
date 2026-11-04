import { describe, expect, it } from "vitest";
import {
  imagePathCandidates,
  loadImageSource,
} from "../src/lib/imageLoader";

const options = {
  baseDirectory: null,
  rootDirectory: null,
  rootUrl: null,
  loadRemote: false,
};

describe("imagePathCandidates", () => {
  it("tries the document folder before the image root for relative paths", () => {
    expect(
      imagePathCandidates("assets/a.png", "C:/docs", "C:/shared"),
    ).toEqual(["C:/docs/assets/a.png", "C:/shared/assets/a.png"]);
  });

  it("tries the image root first for root-relative paths", () => {
    expect(
      imagePathCandidates("/assets/a.png", "C:/docs", "C:/shared"),
    ).toEqual(["C:/shared/assets/a.png", "C:/docs/assets/a.png"]);
  });

  it("deduplicates identical candidates", () => {
    expect(
      imagePathCandidates("assets/a.png", "C:/docs", "C:/docs"),
    ).toEqual(["C:/docs/assets/a.png"]);
  });
});

describe("loadImageSource", () => {
  it("returns data URLs without a desktop bridge", async () => {
    await expect(
      loadImageSource("data:image/png;base64,abc", options),
    ).resolves.toEqual({
      source: "data:image/png;base64,abc",
      path: "data:image/png;base64,abc",
      remote: false,
    });
  });

  it("never starts a remote request without explicit opt-in", async () => {
    await expect(
      loadImageSource("https://example.com/a.png", options),
    ).rejects.toThrow("Remote image loading is disabled");
  });

  it("rejects unsupported sources and local paths outside the desktop app", async () => {
    await expect(
      loadImageSource("javascript:alert(1)", options),
    ).rejects.toThrow("Unsupported image source");
    await expect(
      loadImageSource("assets/a.png", {
        ...options,
        baseDirectory: "C:/docs",
      }),
    ).rejects.toThrow("desktop app");
  });
});
