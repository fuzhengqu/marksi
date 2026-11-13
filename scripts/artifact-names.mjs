import { readdir, rename, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { productVersion } from "./versioning.mjs";

const TAURI_MSI_NAME =
  /^(.+_\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?_[^_]+)_([a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)\.msi$/i;
const ARTIFACT_EXTENSIONS = new Set([
  ".msi",
  ".exe",
  ".deb",
  ".rpm",
  ".appimage",
  ".flatpak",
]);

/**
 * Removes the WiX-generated language suffix from a Tauri MSI filename.
 * Non-Tauri names and names without a language suffix are returned unchanged.
 */
export function stripMsiLanguageSuffix(name) {
  const match = TAURI_MSI_NAME.exec(name);
  return match ? `${match[1]}.msi` : name;
}

/**
 * Normalizes a bundle filename to the product's two-part version and removes
 * the WiX language suffix. Non-artifact names and unrelated files are kept.
 */
export function normalizeArtifactName(
  name,
  technicalVersion,
  productVersionName,
) {
  if (!ARTIFACT_EXTENSIONS.has(name.slice(name.lastIndexOf(".")).toLowerCase())) {
    return name;
  }
  let next = name;
  if (next.toLowerCase().endsWith(".msi")) {
    next = stripMsiLanguageSuffix(next);
  }
  if (technicalVersion && productVersionName) {
    next = next.split(technicalVersion).join(productVersionName);
  }
  return next;
}

/**
 * Renames bundle artifacts in place. Running it again is a no-op.
 */
export async function normalizeArtifactFiles(
  root,
  technicalVersion,
  productVersionName,
) {
  const renamed = [];
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true }).catch(
      () => [],
    );
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
        continue;
      }
      const target = normalizeArtifactName(
        entry.name,
        technicalVersion,
        productVersionName,
      );
      if (target === entry.name) {
        continue;
      }
      const targetPath = join(directory, target);
      await rm(targetPath, { force: true });
      await rename(path, targetPath);
      renamed.push({ from: entry.name, to: target });
    }
  }
  await walk(root);
  return renamed;
}

/** Legacy entry point for callers that only normalize MSI language suffixes. */
export async function normalizeMsiArtifacts(root) {
  return normalizeArtifactFiles(root, "", "");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const root = resolve(
    process.argv[2] ?? "src-tauri/target/release/bundle",
  );
  const display = productVersion(packageJson.version);
  normalizeArtifactFiles(root, packageJson.version, display)
    .then((renamed) => {
      if (!renamed.length) {
        console.log("No artifact names needed normalization.");
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
