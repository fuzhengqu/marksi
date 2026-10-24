import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { join, relative, resolve } from "node:path";

const BUNDLE_EXTENSIONS = [
  ".msi",
  ".exe",
  ".deb",
  ".rpm",
  ".appimage",
  ".dmg",
];

export async function collectBundleFiles(root) {
  const files = [];
  const entries = await readdir(root, { withFileTypes: true }).catch(
    () => [],
  );
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectBundleFiles(path)));
      continue;
    }
    const lower = entry.name.toLowerCase();
    if (BUNDLE_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
      files.push(path);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

export async function checksumLine(path, root) {
  const bytes = await readFile(path);
  const digest = createHash("sha256").update(bytes).digest("hex").toUpperCase();
  const name = relative(root, path).split("\\").join("/");
  return `${digest}  ${name}`;
}

export async function buildChecksums(root) {
  const files = await collectBundleFiles(root);
  const lines = [];
  for (const file of files) {
    lines.push(await checksumLine(file, root));
  }
  return { files, text: lines.length ? `${lines.join("\n")}\n` : "" };
}

export async function writeChecksums(root, output) {
  const result = await buildChecksums(root);
  if (!result.files.length) {
    throw new Error(`No bundle artifacts found under ${root}`);
  }
  const target = output ?? join(root, "SHA256SUMS.txt");
  await writeFile(target, result.text, "utf8");
  return { ...result, target };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const root = resolve(
    process.argv[2] ?? "src-tauri/target/release/bundle",
  );
  writeChecksums(root)
    .then((result) => {
      console.log(
        `Wrote ${result.files.length} checksums to ${result.target}`,
      );
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
