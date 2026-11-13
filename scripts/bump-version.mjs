import { readFileSync, writeFileSync } from "node:fs";
import {
  nextReleaseVersion,
  productVersion,
  versionCodeFor,
} from "./versioning.mjs";

const packagePath = "package.json";
const packageLockPath = "package-lock.json";
const cargoPath = "src-tauri/Cargo.toml";
const cargoLockPath = "src-tauri/Cargo.lock";
const tauriPath = "src-tauri/tauri.conf.json";
const metainfoPath = "flatpak/com.marksi.app.metainfo.xml";

function targetArgument(args) {
  let target = null;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--to") {
      target = args[index + 1];
      index += 1;
      continue;
    }
    if (argument.startsWith("--to=")) {
      target = argument.slice("--to=".length);
      continue;
    }
    throw new Error(`Unknown version argument: ${argument}`);
  }
  if (target === "") {
    throw new Error("--to requires a version");
  }
  return target;
}

const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const current = packageJson.version;
const currentCode =
  packageJson.versionCode === undefined
    ? versionCodeFor(current)
    : Number(packageJson.versionCode);
if (!Number.isInteger(currentCode) || currentCode !== versionCodeFor(current)) {
  throw new Error(
    `package.json versionCode ${packageJson.versionCode} does not match ${versionCodeFor(current)}`,
  );
}

const next = nextReleaseVersion(current, targetArgument(process.argv.slice(2)));
const nextCode = versionCodeFor(next);
if (nextCode <= currentCode) {
  throw new Error(`versionCode must increase: ${currentCode} -> ${nextCode}`);
}
const display = productVersion(next);

packageJson.version = next;
packageJson.versionCode = nextCode;
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const packageLock = JSON.parse(readFileSync(packageLockPath, "utf8"));
if (
  packageLock.version !== current ||
  packageLock.packages?.[""]?.version !== current
) {
  throw new Error("package-lock.json version does not match package.json");
}
packageLock.version = next;
packageLock.packages[""].version = next;
writeFileSync(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`);

const cargo = readFileSync(cargoPath, "utf8");
const cargoPattern = /^version = "[^"]+"$/m;
if (!cargoPattern.test(cargo)) {
  throw new Error("Could not find the package version in Cargo.toml");
}
writeFileSync(cargoPath, cargo.replace(cargoPattern, `version = "${next}"`));

const cargoLock = readFileSync(cargoLockPath, "utf8");
const cargoLockPattern =
  /(\[\[package\]\]\r?\nname = "marksi"\r?\nversion = )"[^"]+"/;
if (!cargoLockPattern.test(cargoLock)) {
  throw new Error("Could not find the marksi package in Cargo.lock");
}
writeFileSync(
  cargoLockPath,
  cargoLock.replace(cargoLockPattern, `$1"${next}"`),
);

const tauri = JSON.parse(readFileSync(tauriPath, "utf8"));
if (tauri.version !== current) {
  throw new Error("tauri.conf.json version does not match package.json");
}
tauri.version = next;
writeFileSync(tauriPath, `${JSON.stringify(tauri, null, 2)}\n`);

const metainfo = readFileSync(metainfoPath, "utf8");
const releasePattern = /<release version="[^"]+" date="[^"]+"\/>/;
if (!releasePattern.test(metainfo)) {
  throw new Error("Could not find the latest release in the AppStream metadata");
}
writeFileSync(
  metainfoPath,
  metainfo.replace(
    releasePattern,
    `<release version="${display}" date="${new Date().toISOString().slice(0, 10)}"/>`,
  ),
);

console.log(
  `Version bumped ${current} -> ${next} (versionName ${display}, versionCode ${nextCode}).`,
);
