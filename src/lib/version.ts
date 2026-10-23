import packageMetadata from "../../package.json";

export const APP_SEMVER = packageMetadata.version;

/**
 * Product releases use 0.01, 0.02, ... while npm, Cargo, and Tauri require
 * semver. The technical version therefore maps 0.1.0 to 0.01, 0.2.0 to 0.02.
 * Versions outside that one-step release pattern are shown unchanged.
 */
export function displayVersion(version: string = APP_SEMVER): string {
  const match = /^0\.(\d+)\.0$/.exec(version.trim());
  if (!match) {
    return version;
  }
  return `0.${match[1].padStart(2, "0")}`;
}
