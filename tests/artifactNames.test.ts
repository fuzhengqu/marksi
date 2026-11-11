import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  normalizeMsiArtifacts,
  stripMsiLanguageSuffix,
} from "../scripts/artifact-names.mjs";

const temporaryDirectories = [];

async function temporaryBundle() {
  const root = await mkdtemp(join(tmpdir(), "marksi-artifact-names-"));
  temporaryDirectories.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("stripMsiLanguageSuffix", () => {
  it("removes WiX language tags from Tauri MSI names", () => {
    expect(stripMsiLanguageSuffix("MarkSI_0.55.0_x64_en-US.msi")).toBe(
      "MarkSI_0.55.0_x64.msi",
    );
    expect(stripMsiLanguageSuffix("MarkSI_0.55.0_x64_zh-CN.msi")).toBe(
      "MarkSI_0.55.0_x64.msi",
    );
    expect(stripMsiLanguageSuffix("MarkSI_0.55.0_x64_pt-BR.msi")).toBe(
      "MarkSI_0.55.0_x64.msi",
    );
  });

  it("keeps already neutral and unrelated names unchanged", () => {
    expect(stripMsiLanguageSuffix("MarkSI_0.55.0_x64.msi")).toBe(
      "MarkSI_0.55.0_x64.msi",
    );
    expect(stripMsiLanguageSuffix("MarkSI_0.55.0_x64-setup.exe")).toBe(
      "MarkSI_0.55.0_x64-setup.exe",
    );
    expect(stripMsiLanguageSuffix("custom_build.msi")).toBe(
      "custom_build.msi",
    );
  });
});

describe("normalizeMsiArtifacts", () => {
  it("renames MSI files under the bundle msi directory", async () => {
    const root = await temporaryBundle();
    const msi = join(root, "msi");
    await writeFile(join(root, "SHA256SUMS.txt"), "");
    await writeFile(join(root, "nsis"), "");
    await mkdir(msi, { recursive: true });
    await writeFile(join(msi, "MarkSI_0.55.0_x64_en-US.msi"), "msi");
    await writeFile(join(msi, "notes.txt"), "keep");

    const renamed = await normalizeMsiArtifacts(root);
    expect(renamed).toEqual([
      {
        from: "MarkSI_0.55.0_x64_en-US.msi",
        to: "MarkSI_0.55.0_x64.msi",
      },
    ]);
    expect((await readdir(msi)).sort()).toEqual([
      "MarkSI_0.55.0_x64.msi",
      "notes.txt",
    ]);
  });

  it("is idempotent and replaces a stale neutral file", async () => {
    const root = await temporaryBundle();
    const msi = join(root, "msi");
    await mkdir(msi, { recursive: true });
    await writeFile(join(msi, "MarkSI_0.55.0_x64.msi"), "old");
    await writeFile(join(msi, "MarkSI_0.55.0_x64_en-US.msi"), "new");

    await normalizeMsiArtifacts(root);
    expect(await readdir(msi)).toEqual(["MarkSI_0.55.0_x64.msi"]);
    expect(await normalizeMsiArtifacts(root)).toEqual([]);
  });
});
