import { readFileSync, writeFileSync } from "node:fs";

const packagePath = "package.json";
const packageLockPath = "package-lock.json";
const cargoPath = "src-tauri/Cargo.toml";
const cargoLockPath = "src-tauri/Cargo.lock";
const tauriPath = "src-tauri/tauri.conf.json";

const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const current = packageJson.version;
const match = /^0\.(\d+)\.0$/.exec(current);
if (!match) {
  throw new Error(
    `Expected a 0.x.0 release version before bumping, received ${current}`,
  );
}

const nextMinor = Number(match[1]) + 1;
const next = `0.${nextMinor}.0`;
const display = `0.${String(nextMinor).padStart(2, "0")}`;

packageJson.version = next;
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const packageLock = JSON.parse(readFileSync(packageLockPath, "utf8"));
if (packageLock.version !== current || packageLock.packages?.[""]?.version !== current) {
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

console.log(
  `Version bumped ${current} -> ${next} (About displays ${display}).`,
);
