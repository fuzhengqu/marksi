import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import {
  productVersion,
  releaseTag,
  versionCodeFor,
} from "./versioning.mjs";

const OWNER = "fuzhengqu";
const REPO = "marksi";
const API = "https://api.github.com";

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  }).trim();
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const version = packageJson.version;
const tag = releaseTag(version);
const versionCode = versionCodeFor(version);
if (Number(packageJson.versionCode) !== versionCode) {
  throw new Error(
    `package.json versionCode ${packageJson.versionCode} does not match ${versionCode}`,
  );
}
if (git(["status", "--porcelain"])) {
  throw new Error("Working tree must be clean before creating a release tag");
}
const head = git(["rev-parse", "HEAD"]);
const origin = git(["rev-parse", "origin/main"]);
if (head !== origin) {
  throw new Error(`HEAD ${head} does not match origin/main ${origin}`);
}
const notesPath = `docs/releases/${tag}.md`;
const publishes = existsSync(notesPath);

const credential = execSync("git credential fill", {
  input: "protocol=https\nhost=github.com\n\n",
  encoding: "utf8",
});
const token = credential
  .split(/\r?\n/)
  .find((line) => line.startsWith("password="))
  .slice("password=".length);

async function request(path, init = {}) {
  let lastError;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const response = await fetch(`${API}${path}`, {
        ...init,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "marksi-release-tag",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(init.headers ?? {}),
        },
      });
      const text = await response.text();
      if (response.status >= 500) {
        lastError = new Error(`GitHub API ${response.status}: ${text}`);
      } else {
        return { status: response.status, text };
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  throw lastError ?? new Error("GitHub API request failed");
}

const existing = await request(
  `/repos/${OWNER}/${REPO}/git/ref/tags/${encodeURIComponent(tag)}`,
);
if (existing.status === 200) {
  throw new Error(`Tag ${tag} already exists`);
}
if (existing.status !== 404) {
  throw new Error(`Tag lookup failed (${existing.status}): ${existing.text}`);
}

const tagObject = await request(`/repos/${OWNER}/${REPO}/git/tags`, {
  method: "POST",
  body: JSON.stringify({
    tag,
    message: `MarkSI ${productVersion(version)} (versionCode ${versionCode})`,
    object: head,
    type: "commit",
  }),
});
if (tagObject.status !== 201) {
  throw new Error(`Tag creation failed (${tagObject.status}): ${tagObject.text}`);
}
const tagSha = JSON.parse(tagObject.text).sha;

const reference = await request(`/repos/${OWNER}/${REPO}/git/refs`, {
  method: "POST",
  body: JSON.stringify({ ref: `refs/tags/${tag}`, sha: tagSha }),
});
if (reference.status !== 201) {
  throw new Error(
    `Tag reference creation failed (${reference.status}): ${reference.text}`,
  );
}

git(["update-ref", `refs/tags/${tag}`, head]);
console.log(`Created ${tag} at ${head} (versionCode ${versionCode}).`);
console.log(
  publishes
    ? `Release notes found: ${notesPath}; the tag build will publish a GitHub Release.`
    : `No ${notesPath}; the tag build will only retain workflow artifacts.`,
);
