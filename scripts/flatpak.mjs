import { copyFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const APP_ID = "com.marksi.app";
const RUNTIME_VERSION = "51";
const ICONS = [
  { source: "64x64.png", target: "64x64.png" },
  { source: "128x128.png", target: "128x128.png" },
  { source: "128x128@2x.png", target: "256x256.png" },
  { source: "icon.png", target: "512x512.png" },
];

export function flatpakPaths(root) {
  const base = resolve(root, "flatpak");
  return {
    base,
    manifest: join(base, `${APP_ID}.yml`),
    desktop: join(base, `${APP_ID}.desktop`),
    metainfo: join(base, `${APP_ID}.metainfo.xml`),
    stage: join(base, "stage"),
    binary: join(base, "stage", "marksi"),
  };
}

export async function checkFlatpak(root = ".") {
  const paths = flatpakPaths(root);
  const packageJson = JSON.parse(
    await readFile(resolve(root, "package.json"), "utf8"),
  );
  const manifest = await readFile(paths.manifest, "utf8");
  const desktop = await readFile(paths.desktop, "utf8");
  const metainfo = await readFile(paths.metainfo, "utf8");
  const errors = [];

  for (const expected of [
    `app-id: ${APP_ID}`,
    "runtime: org.gnome.Platform",
    `runtime-version: "${RUNTIME_VERSION}"`,
    "command: marksi",
    "--socket=wayland",
    "--socket=fallback-x11",
    "--filesystem=home",
  ]) {
    if (!manifest.includes(expected)) {
      errors.push(`manifest is missing ${expected}`);
    }
  }
  for (const expected of [
    "Type=Application",
    "Exec=marksi %F",
    `Icon=${APP_ID}`,
    "MimeType=text/markdown;",
  ]) {
    if (!desktop.includes(expected)) {
      errors.push(`desktop entry is missing ${expected}`);
    }
  }
  for (const expected of [
    `<id>${APP_ID}</id>`,
    `<launchable type="desktop-id">${APP_ID}.desktop</launchable>`,
    `<project_license>MIT</project_license>`,
    `<release version="${packageJson.version}"`,
  ]) {
    if (!metainfo.includes(expected)) {
      errors.push(`AppStream metadata is missing ${expected}`);
    }
  }
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
  return { appId: APP_ID, version: packageJson.version, paths };
}

export async function stageFlatpak(
  root = ".",
  { binary, output = flatpakPaths(root).stage } = {},
) {
  const paths = flatpakPaths(root);
  const sourceBinary =
    binary ??
    resolve(root, "src-tauri", "target", "release", "marksi");
  if (!existsSync(sourceBinary)) {
    throw new Error(
      `Flatpak staging needs a release binary at ${sourceBinary}. Run npm run tauri:build first or pass --binary.`,
    );
  }
  await mkdir(join(output, "icons"), { recursive: true });
  await copyFile(sourceBinary, join(output, "marksi"));
  for (const icon of ICONS) {
    const source = resolve(root, "src-tauri", "icons", icon.source);
    if (!existsSync(source)) {
      throw new Error(`Flatpak icon is missing: ${source}`);
    }
    await copyFile(source, join(output, "icons", icon.target));
  }
  return {
    binary: join(output, "marksi"),
    icons: ICONS.map((icon) => join(output, "icons", icon.target)),
    metadata: [paths.desktop, paths.metainfo],
  };
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const command = process.argv[2] ?? "check";
  const root = argument("--root") ?? ".";
  const binary = argument("--binary");
  const action =
    command === "stage"
      ? stageFlatpak(root, { binary })
      : command === "check"
        ? checkFlatpak(root)
        : Promise.reject(new Error(`Unknown Flatpak command: ${command}`));
  action
    .then((result) => {
      if (command === "stage") {
        console.log(`Staged Flatpak files in ${flatpakPaths(root).stage}`);
      } else {
        console.log(`Flatpak metadata is valid for ${result.appId} ${result.version}.`);
      }
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
