import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  normalizeArtifactFiles,
  normalizeArtifactName,
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

describe("normalizeArtifactName", () => {
  it("converts technical filenames to two-part versions", () => {
    expect(
      normalizeArtifactName(
        "MarkSI_0.61.0_x64_en-US.msi",
        "0.61.0",
        "0.61",
      ),
    ).toBe("MarkSI_0.61_x64.msi");
    expect(
      normalizeArtifactName(
        "MarkSI_0.61.0_x64-setup.exe",
        "0.61.0",
        "0.61",
      ),
    ).toBe("MarkSI_0.61_x64-setup.exe");
    expect(
      normalizeArtifactName(
        "MarkSI_0.61.0_amd64.deb",
        "0.61.0",
        "0.61",
      ),
    ).toBe("MarkSI_0.61_amd64.deb");
    expect(
      normalizeArtifactName(
        "MarkSI-0.61.0-1.x86_64.rpm",
        "0.61.0",
        "0.61",
      ),
    ).toBe("MarkSI-0.61-1.x86_64.rpm");
    expect(
      normalizeArtifactName(
        "MarkSI_0.61.0_amd64.AppImage",
        "0.61.0",
        "0.61",
      ),
    ).toBe("MarkSI_0.61_amd64.AppImage");
    expect(
      normalizeArtifactName(
        "MarkSI_0.61.0_x86_64.flatpak",
        "0.61.0",
        "0.61",
      ),
    ).toBe("MarkSI_0.61_x86_64.flatpak");
  });

  it("leaves checksums and unrelated files unchanged", () => {
    expect(
      normalizeArtifactName("SHA256SUMS.txt", "0.61.0", "0.61"),
    ).toBe("SHA256SUMS.txt");
    expect(normalizeArtifactName("notes.txt", "0.61.0", "0.61")).toBe(
      "notes.txt",
    );
  });
});

describe("normalizeMsiArtifacts", () => {
  it("renames language-suffixed MSI files without changing versions", async () => {
    const root = await temporaryBundle();
    const msi = join(root, "msi");
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
});

describe("normalizeArtifactFiles", () => {
  it("normalizes every installer filename recursively", async () => {
    const root = await temporaryBundle();
    await mkdir(join(root, "msi"), { recursive: true });
    await mkdir(join(root, "nsis"), { recursive: true });
    await mkdir(join(root, "deb"), { recursive: true });
    await mkdir(join(root, "rpm"), { recursive: true });
    await mkdir(join(root, "appimage"), { recursive: true });
    await mkdir(join(root, "flatpak"), { recursive: true });
    await writeFile(
      join(root, "msi", "MarkSI_0.61.0_x64_en-US.msi"),
      "msi",
    );
    await writeFile(
      join(root, "nsis", "MarkSI_0.61.0_x64-setup.exe"),
      "exe",
    );
    await writeFile(join(root, "deb", "MarkSI_0.61.0_amd64.deb"), "deb");
    await writeFile(
      join(root, "rpm", "MarkSI-0.61.0-1.x86_64.rpm"),
      "rpm",
    );
    await writeFile(
      join(root, "appimage", "MarkSI_0.61.0_amd64.AppImage"),
      "appimage",
    );
    await writeFile(
      join(root, "flatpak", "MarkSI_0.61.0_x86_64.flatpak"),
      "flatpak",
    );
    await writeFile(join(root, "SHA256SUMS.txt"), "keep");

    const renamed = await normalizeArtifactFiles(
      root,
      "0.61.0",
      "0.61",
    );
    expect(renamed).toHaveLength(6);
    expect((await readdir(join(root, "msi"))).sort()).toEqual([
      "MarkSI_0.61_x64.msi",
    ]);
    expect((await readdir(join(root, "nsis"))).sort()).toEqual([
      "MarkSI_0.61_x64-setup.exe",
    ]);
    expect((await readdir(join(root, "deb"))).sort()).toEqual([
      "MarkSI_0.61_amd64.deb",
    ]);
    expect((await readdir(join(root, "rpm"))).sort()).toEqual([
      "MarkSI-0.61-1.x86_64.rpm",
    ]);
    expect((await readdir(join(root, "appimage"))).sort()).toEqual([
      "MarkSI_0.61_amd64.AppImage",
    ]);
    expect((await readdir(join(root, "flatpak"))).sort()).toEqual([
      "MarkSI_0.61_x86_64.flatpak",
    ]);
    expect(await normalizeArtifactFiles(root, "0.61.0", "0.61")).toEqual(
      [],
    );
  });
});
