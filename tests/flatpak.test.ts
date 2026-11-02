import { describe, expect, it } from "vitest";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkFlatpak,
  flatpakPaths,
  stageFlatpak,
} from "../scripts/flatpak.mjs";

async function temporaryFolder() {
  return mkdtemp(join(tmpdir(), "marksi-flatpak-"));
}

describe("flatpak packaging", () => {
  it("keeps the manifest desktop entry and AppStream metadata aligned", async () => {
    const result = await checkFlatpak(".");
    expect(result.appId).toBe("com.marksi.app");
    expect(result.version).toMatch(/^0\.\d+\.0$/);
    expect(result.paths.binary.endsWith("marksi")).toBe(true);
  });

  it("stages the release binary and icons", async () => {
    const root = await temporaryFolder();
    const binary = join(root, "marksi-release");
    const output = join(root, "stage");
    await writeFile(binary, "binary");

    try {
      const staged = await stageFlatpak(".", { binary, output });
      expect(await readFile(join(output, "marksi"), "utf8")).toBe("binary");
      expect(staged.icons).toHaveLength(4);
      for (const icon of staged.icons) {
        expect((await readFile(icon)).length).toBeGreaterThan(0);
      }
      expect(await readFile(join(output, "icons", "256x256.png"))).toEqual(
        await readFile(join("src-tauri", "icons", "128x128@2x.png")),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects metadata whose release version does not match package.json", async () => {
    const root = await temporaryFolder();
    try {
      await mkdir(join(root, "flatpak"), { recursive: true });
      const paths = flatpakPaths(root);
      await copyFile("flatpak/com.marksi.app.yml", paths.manifest);
      await copyFile("flatpak/com.marksi.app.desktop", paths.desktop);
      await copyFile(
        "flatpak/com.marksi.app.metainfo.xml",
        paths.metainfo,
      );
      await writeFile(
        join(root, "package.json"),
        JSON.stringify({ version: "9.9.9" }),
      );
      await expect(checkFlatpak(root)).rejects.toThrow(
        'AppStream metadata is missing <release version="9.9.9"',
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
