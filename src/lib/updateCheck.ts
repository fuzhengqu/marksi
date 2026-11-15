import { APP_SEMVER, displayVersion } from "./version";

export interface ReleaseInfo {
  tag: string;
  name: string;
  url: string;
  notes: string;
  publishedAt: string | null;
}

export type ReleaseFetcher = () => Promise<ReleaseInfo | null>;

export type UpdateCheckResult =
  | { status: "available"; current: string; release: ReleaseInfo }
  | { status: "current"; current: string; release: ReleaseInfo }
  | { status: "error"; current: string; message: string };

export const LAST_UPDATE_CHECK_KEY = "marksi-last-update-check";
export const DISMISSED_UPDATE_KEY = "marksi-dismissed-update";
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const AUTO_UPDATE_DELAY_MS = 5_000;

const RELEASE_API =
  "https://api.github.com/repos/fuzhengqu/marksi/releases/latest";
const RELEASE_URL_PREFIX =
  "https://github.com/fuzhengqu/marksi/releases/tag/";
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Parses product versions such as `v0.69`, `0.69.0`, and `1.00` into the
 * monotonic versionCode. Patch releases are not part of the product scheme.
 */
export function parseProductVersion(value: string): number | null {
  const match = /^v?(\d+)\.(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (major === 0 && minor > 99) {
    return null;
  }
  if (match[3] !== undefined && Number(match[3]) !== 0) {
    return null;
  }
  return major * 100 + minor;
}

export function isNewerRelease(current: string, latestTag: string): boolean {
  const currentCode = parseProductVersion(current);
  const latestCode = parseProductVersion(latestTag);
  return (
    currentCode !== null && latestCode !== null && latestCode > currentCode
  );
}

export function parseRelease(payload: unknown): ReleaseInfo | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (record.draft === true || record.prerelease === true) {
    return null;
  }
  const tag = typeof record.tag_name === "string" ? record.tag_name.trim() : "";
  const url = typeof record.html_url === "string" ? record.html_url : "";
  if (!tag || !url.startsWith(RELEASE_URL_PREFIX)) {
    return null;
  }
  const name =
    typeof record.name === "string" && record.name.trim()
      ? record.name
      : tag;
  const notes = typeof record.body === "string" ? record.body : "";
  const publishedAt =
    typeof record.published_at === "string" && record.published_at
      ? record.published_at
      : null;
  return { tag, name, url, notes, publishedAt };
}

async function fetchLatestRelease(): Promise<ReleaseInfo> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(RELEASE_API, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status}`);
    }
    const release = parseRelease(await response.json());
    if (!release) {
      throw new Error("Unexpected release payload");
    }
    return release;
  } finally {
    window.clearTimeout(timer);
  }
}

let releaseFetcher: ReleaseFetcher = fetchLatestRelease;

export function setReleaseFetcher(next: ReleaseFetcher | null): void {
  releaseFetcher = next ?? fetchLatestRelease;
}

export async function checkForUpdate(
  current: string = APP_SEMVER,
): Promise<UpdateCheckResult> {
  try {
    const release = await releaseFetcher();
    if (!release) {
      throw new Error("No release data");
    }
    const currentCode = parseProductVersion(current);
    const latestCode = parseProductVersion(release.tag);
    if (currentCode === null || latestCode === null) {
      throw new Error("Invalid release version");
    }
    return latestCode > currentCode
      ? { status: "available", current: displayVersion(current), release }
      : { status: "current", current: displayVersion(current), release };
  } catch (error) {
    return {
      status: "error",
      current: displayVersion(current),
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export function shouldCheckForUpdates(now = Date.now()): boolean {
  try {
    const last = Number(window.localStorage.getItem(LAST_UPDATE_CHECK_KEY));
    return !Number.isFinite(last) || last <= 0 || now - last >= UPDATE_CHECK_INTERVAL_MS;
  } catch {
    return true;
  }
}

export function markUpdateChecked(now = Date.now()): void {
  try {
    window.localStorage.setItem(LAST_UPDATE_CHECK_KEY, String(now));
  } catch {
    // Update timing is best-effort.
  }
}

export function dismissedUpdateVersion(): string | null {
  try {
    return window.localStorage.getItem(DISMISSED_UPDATE_KEY);
  } catch {
    return null;
  }
}

export function dismissUpdate(tag: string): void {
  try {
    window.localStorage.setItem(DISMISSED_UPDATE_KEY, tag);
  } catch {
    // Dismissal is best-effort.
  }
}
