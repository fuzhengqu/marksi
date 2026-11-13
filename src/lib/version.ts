import packageMetadata from "../../package.json";

export const APP_SEMVER = packageMetadata.version;
export const APP_VERSION_CODE = Number(packageMetadata.versionCode);

/**
 * Product releases use 0.01, 0.02, ... 1.00 while npm, Cargo, and Tauri require
 * three-part semver. The patch segment is hidden from users and tags.
 */
export function displayVersion(version: string = APP_SEMVER): string {
  const match = /^(\d+)\.(\d+)\.0$/.exec(version.trim());
  if (!match) {
    return version;
  }
  return `${match[1]}.${match[2].padStart(2, "0")}`;
}

/** Monotonic integer derived from a release version. */
export function versionCodeFor(version: string = APP_SEMVER): number {
  const match = /^(\d+)\.(\d+)\.0$/.exec(version.trim());
  if (!match) {
    throw new Error(`Expected a release version, received ${version}`);
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (major === 0 && minor > 99) {
    throw new Error("Use 1.0.0 instead of a 0.100+ version");
  }
  return major * 100 + minor;
}
