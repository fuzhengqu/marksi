import { readdir, rename, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const TAURI_MSI_NAME =
  /^(.+_\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?_[^_]+)_([a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)\.msi$/i;

/**
 * Removes the WiX-generated language suffix from a Tauri MSI filename.
 * Non-Tauri names and names without a language suffix are returned unchanged.
 */
export function stripMsiLanguageSuffix(name) {
  const match = TAURI_MSI_NAME.exec(name);
  return match ? `${match[1]}.msi` : name;
}

/**
 * Renames every language-suffixed MSI under `<bundle>/msi` to its
 * language-neutral name. Running it again is a no-op.
 */
export async function normalizeMsiArtifacts(root) {
  const directory = join(root, "msi");
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    () => [],
  );
  const renamed = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".msi")) {
      continue;
    }
    const target = stripMsiLanguageSuffix(entry.name);
    if (target === entry.name) {
      continue;
    }
    const sourcePath = join(directory, entry.name);
    const targetPath = join(directory, target);
    await rm(targetPath, { force: true });
    await rename(sourcePath, targetPath);
    renamed.push({ from: entry.name, to: target });
  }
  return renamed;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const root = resolve(
    process.argv[2] ?? "src-tauri/target/release/bundle",
  );
  normalizeMsiArtifacts(root)
    .then((renamed) => {
      if (!renamed.length) {
        console.log("No language-suffixed MSI artifacts found.");
        return;
      }
      for (const entry of renamed) {
        console.log(`${entry.from} -> ${entry.to}`);
      }
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
