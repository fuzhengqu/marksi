import { describe, expect, it } from "vitest";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildChecksums,
  collectBundleFiles,
  writeChecksums,
} from "../scripts/checksums.mjs";

async function temporaryFolder() {
  const { mkdtemp } = await import("node:fs/promises");
  return mkdtemp(join(tmpdir(), "marksi-checksums-"));
}

describe("release checksums", () => {
  it("finds supported artifacts recursively and ignores other files", async () => {
    const root = await temporaryFolder();
    await mkdir(join(root, "nsis"), { recursive: true });
    await mkdir(join(root, "msi"), { recursive: true });
    await mkdir(join(root, "deb"), { recursive: true });
    await writeFile(join(root, "nsis", "MarkSI-setup.exe"), "setup");
    await writeFile(join(root, "msi", "MarkSI.msi"), "msi");
    await writeFile(join(root, "msi", "notes.txt"), "ignore");
    await writeFile(join(root, "deb", "control.tar.gz"), "staging");
    await writeFile(join(root, "linux.AppImage"), "appimage");

    const files = await collectBundleFiles(root);
    expect(files.map((path) => path.split(/[\\/]/).pop())).toEqual([
      "linux.AppImage",
      "MarkSI.msi",
      "MarkSI-setup.exe",
    ]);
  });

  it("writes uppercase SHA256 checksums with relative paths", async () => {
    const root = await temporaryFolder();
    await mkdir(join(root, "bundle"), { recursive: true });
    await writeFile(join(root, "bundle", "a.exe"), "hello");

    const result = await buildChecksums(root);
    expect(result.files).toHaveLength(1);
    expect(result.text).toMatch(
      /^[0-9A-F]{64}  bundle\/a\.exe\n$/,
    );
    const written = await writeChecksums(root);
    expect(await readFile(written.target, "utf8")).toBe(result.text);
  });

  it("fails when no artifacts exist", async () => {
    const root = await temporaryFolder();
    await expect(writeChecksums(root)).rejects.toThrow(
      "No bundle artifacts found",
    );
  });
});
