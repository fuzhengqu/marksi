import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const forbiddenTerms = [
  ["ty", "pora"].join(""),
  "\u590d\u523b",
  "\u4eff\u5236",
];

const secretPatterns = [
  { label: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  { label: "GitHub fine-grained token", pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
  { label: "OpenAI key", pattern: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { label: "Anthropic key", pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { label: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { label: "private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  {
    label: "credential assignment",
    pattern:
      /\b(?:password|passwd|api[_-]?key|secret|access[_-]?token)\b\s*[:=]\s*["'][^"'\n]{6,}["']/gi,
  },
];

const localPathPatterns = [
  {
    label: "local user home path",
    pattern: /[A-Za-z]:\\Users\\[^\s`"'<>]+/g,
  },
  {
    label: "local workspace path",
    pattern: new RegExp(
      [
        ["E:", "\u6280\u672f\u5b66\u4e60"].join("\\"),
        ["D:", "AI", "VibeCoding"].join("\\"),
      ]
        .map(escapeRegExp)
        .join("|"),
      "g",
    ),
  },
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function git(args) {
  return execFileSync("git", args, {
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function textOf(buffer) {
  if (buffer.includes(0)) {
    return null;
  }
  return buffer.toString("utf8");
}

function lineAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

function scanText(text, location, findings) {
  for (const term of forbiddenTerms) {
    let cursor = text.toLowerCase().indexOf(term.toLowerCase());
    while (cursor >= 0) {
      findings.push({
        kind: "forbidden wording",
        location: `${location}:${lineAt(text, cursor)}`,
      });
      cursor = text.toLowerCase().indexOf(term.toLowerCase(), cursor + term.length);
    }
  }

  for (const { label, pattern } of secretPatterns) {
    pattern.lastIndex = 0;
    let match = pattern.exec(text);
    while (match) {
      findings.push({
        kind: label,
        location: `${location}:${lineAt(text, match.index)}`,
      });
      match = pattern.exec(text);
    }
  }

  for (const { label, pattern } of localPathPatterns) {
    pattern.lastIndex = 0;
    let match = pattern.exec(text);
    while (match) {
      findings.push({
        kind: label,
        location: `${location}:${lineAt(text, match.index)}`,
      });
      match = pattern.exec(text);
    }
  }
}

function scanFile(path) {
  const findings = [];
  let buffer;
  try {
    buffer = readFileSync(path);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [{ kind: "tracked file missing", location: path }];
    }
    throw error;
  }
  const text = textOf(buffer);
  if (text !== null) {
    scanText(text, path, findings);
  }
  return findings;
}

const findings = [];
const tracked = git(["ls-files", "-z"]).toString("utf8").split("\0").filter(Boolean);
const commits = git(["rev-list", "--branches", "--tags"])
  .toString("utf8")
  .trim()
  .split("\n")
  .filter(Boolean);

for (const path of tracked) {
  const lower = path.toLowerCase();
  if (
    /(^|\/)(\.env(\.|$)|secrets?(\.|$)|credentials?(\.|$)|id_rsa|id_ed25519)/i.test(
      lower,
    ) ||
    /\.(pem|key|p12|pfx)$/i.test(lower)
  ) {
    findings.push({ kind: "sensitive file name", location: path });
  }
  if (forbiddenTerms.some((term) => lower.includes(term.toLowerCase()))) {
    findings.push({ kind: "forbidden file name", location: path });
  }
  findings.push(...scanFile(path));
}

for (const commit of commits) {
  for (const term of forbiddenTerms) {
    try {
      const output = git([
        "grep",
        "-I",
        "-n",
        "-i",
        "-P",
        "-e",
        escapeRegExp(term),
        commit,
        "--",
        ".",
      ]).toString("utf8");
      for (const line of output.split("\n").filter(Boolean)) {
        const parts = line.split(":");
        findings.push({
          kind: "forbidden wording in history",
          location: `${parts[0].slice(0, 8)}:${parts.slice(1, 3).join(":")}`,
        });
      }
    } catch {
      // git grep exits 1 when a commit has no match.
    }
  }

  try {
    const output = git([
      "grep",
      "-I",
      "-n",
      "-P",
      ...secretPatterns.flatMap(({ pattern }) => [
        "-e",
        pattern.source,
      ]),
      commit,
      "--",
      ".",
    ]).toString("utf8");
    for (const line of output.split("\n").filter(Boolean)) {
      const parts = line.split(":");
      findings.push({
        kind: "credential in history",
        location: `${parts[0].slice(0, 8)}:${parts.slice(1, 3).join(":")}`,
      });
    }
  } catch {
    // git grep exits 1 when a commit has no match.
  }

  try {
    const output = git([
      "grep",
      "-I",
      "-n",
      "-P",
      ...localPathPatterns.flatMap(({ pattern }) => [
        "-e",
        pattern.source,
      ]),
      commit,
      "--",
      ".",
    ]).toString("utf8");
    for (const line of output.split("\n").filter(Boolean)) {
      const parts = line.split(":");
      findings.push({
        kind: "local path in history",
        location: `${parts[0].slice(0, 8)}:${parts.slice(1, 3).join(":")}`,
      });
    }
  } catch {
    // git grep exits 1 when a commit has no match.
  }
}

const messages = git([
  "log",
  "--branches",
  "--tags",
  "--format=%H%x00%B%x00",
]).toString("utf8");
const messageParts = messages.split("\0");
for (let index = 0; index + 1 < messageParts.length; index += 2) {
  const hash = messageParts[index].trim();
  const message = messageParts[index + 1];
  if (!hash || !message) {
    continue;
  }
  const messageFindings = [];
  scanText(message, hash.slice(0, 8), messageFindings);
  findings.push(
    ...messageFindings.map((finding) => ({
      ...finding,
      kind: `${finding.kind} in commit message`,
    })),
  );
}

const requiredFiles = [
  "README.md",
  "README.en.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "LICENSE",
];
for (const file of requiredFiles) {
  if (!tracked.includes(file)) {
    findings.push({ kind: "required file missing", location: file });
  }
}

if (tracked.includes("README.md")) {
  const readme = readFileSync("README.md", "utf8");
  if (!/[\u4e00-\u9fff]/.test(readme)) {
    findings.push({ kind: "README.md is not Chinese", location: "README.md" });
  }
}
if (tracked.includes("README.en.md")) {
  const readme = readFileSync("README.en.md", "utf8");
  if (!/[A-Za-z]/.test(readme)) {
    findings.push({ kind: "README.en.md is not English", location: "README.en.md" });
  }
}
if (tracked.includes("LICENSE")) {
  const license = readFileSync("LICENSE", "utf8");
  if (!/MIT License/i.test(license)) {
    findings.push({ kind: "LICENSE is not MIT", location: "LICENSE" });
  }
}

const packageVersion = JSON.parse(readFileSync("package.json", "utf8")).version;
const packageLock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const cargoVersion = /^version = "([^"]+)"/m.exec(
  readFileSync("src-tauri/Cargo.toml", "utf8"),
)?.[1];
const cargoLockVersion =
  /\[\[package\]\]\r?\nname = "marksi"\r?\nversion = "([^"]+)"/.exec(
    readFileSync("src-tauri/Cargo.lock", "utf8"),
  )?.[1];
const tauriVersion = JSON.parse(
  readFileSync("src-tauri/tauri.conf.json", "utf8"),
).version;
const versions = new Set([
  packageVersion,
  packageLock.version,
  packageLock.packages?.[""]?.version,
  cargoVersion,
  cargoLockVersion,
  tauriVersion,
]);
if (versions.size !== 1) {
  findings.push({
    kind: "version mismatch between package, lock, Cargo, and Tauri",
    location: [...versions].filter(Boolean).join(", "),
  });
}
if (!/^0\.\d+\.0$/.test(packageVersion)) {
  findings.push({
    kind: "release version must be 0.x.0",
    location: packageVersion,
  });
}
try {
  const parentPackage = JSON.parse(
    git(["show", "HEAD^:package.json"]).toString("utf8"),
  );
  if (parentPackage.version !== packageVersion) {
    const previous = /^0\.(\d+)\.0$/.exec(parentPackage.version);
    const expected = previous
      ? `0.${Number(previous[1]) + 1}.0`
      : null;
    if (packageVersion !== expected) {
      findings.push({
        kind: "release version skipped a step",
        location: `${parentPackage.version} -> ${packageVersion}`,
      });
    }
  }
} catch {
  // The root commit has no parent package version to compare.
}

const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
for (const [name, entry] of Object.entries(lock.packages ?? {})) {
  const licenses = Array.isArray(entry.license) ? entry.license : [entry.license];
  if (
    licenses.some(
      (license) =>
        typeof license === "string" &&
        /\b(?:A?GPL|LGPL|SSPL)\b|Commons Clause/i.test(license),
    )
  ) {
    findings.push({ kind: "copyleft dependency", location: name });
  }
}

const uniqueFindings = [
  ...new Map(
    findings.map((finding) => [
      `${finding.kind}:${finding.location}`,
      finding,
    ]),
  ).values(),
];

console.log(
  `Publication audit: ${tracked.length} tracked files, ${commits.length} commits`,
);
if (uniqueFindings.length > 0) {
  for (const finding of uniqueFindings.slice(0, 40)) {
    console.error(`FAIL  ${finding.kind}  ${finding.location}`);
  }
  if (uniqueFindings.length > 40) {
    console.error(`... ${uniqueFindings.length - 40} more finding(s)`);
  }
  console.error(`Publication audit failed with ${uniqueFindings.length} finding(s).`);
  process.exitCode = 1;
} else {
  console.log("PASS  no credentials, sensitive paths, forbidden wording, or copyleft dependencies");
  console.log("PASS  Chinese and English README files are present; MIT license is present");
}
