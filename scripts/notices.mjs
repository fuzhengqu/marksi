import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const LICENSE_FILE_PATTERN =
  /^(?:licen[cs]e|copying|copyright|notice)(?:[-_.].*)?$/i;

const TARGETS = {
  win32: "x86_64-pc-windows-msvc",
  linux: "x86_64-unknown-linux-gnu",
  darwin: "aarch64-apple-darwin",
};

export function hostTarget() {
  return TARGETS[process.platform] ?? "x86_64-unknown-linux-gnu";
}

export function normalizeLicenseExpression(expression) {
  return String(expression ?? "")
    .replace(/[()]/g, " ")
    .replace(/\//g, " OR ")
    .replace(/\s+/g, " ")
    .trim();
}

export function licenseComponents(expression) {
  return normalizeLicenseExpression(expression)
    .split(/\s+(?:OR|AND)\s+/i)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isCopyrightNotice(line) {
  const trimmed = String(line).trim();
  if (!trimmed || /\[yyyy\]|\[name of copyright owner\]/i.test(trimmed)) {
    return false;
  }
  return (
    /^copyright\s+(?:\(c\)|©|\d{4})/i.test(trimmed) ||
    /^\(c\)\s*(?:\d{4}|©)/i.test(trimmed) ||
    /^©/.test(trimmed)
  );
}

export function copyrightLines(text) {
  const found = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (isCopyrightNotice(line)) {
      found.push(line.trim());
    }
  }
  return [...new Set(found)];
}

export function licenseBody(text) {
  return String(text)
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => !isCopyrightNotice(line))
    .join("\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const LICENSE_SIGNATURES = [
  ["Apache-2.0", /apache license\s+version 2\.0/i],
  ["MPL-2.0", /mozilla public license version 2\.0/i],
  ["Unicode-3.0", /unicode license v3/i],
  ["PSF-2.0", /python software foundation license version 2/i],
  ["EPL-2.0", /eclipse public license\s*-\s*v 2\.0/i],
  ["CC0-1.0", /cc0 1\.0 universal/i],
  ["Unlicense", /this is free and unencumbered software released into the public domain/i],
  ["MIT-0", /mit no attribution/i],
  [
    "0BSD",
    /permission to use, copy, modify, and\/or distribute this software for any purpose/i,
  ],
  ["Zlib", /this software is provided 'as-is'/i],
  ["BSD-3-Clause", /redistribution and use in source and binary forms/i],
  ["ISC", /permission to use, copy, modify, and\/or distribute this software/i],
  ["MIT", /permission is hereby granted, free of charge/i],
];

export function detectLicenseIds(text) {
  const value = String(text);
  const ids = [];
  for (const [id, pattern] of LICENSE_SIGNATURES) {
    if (pattern.test(value)) {
      ids.push(id);
    }
  }
  if (ids.includes("BSD-3-Clause")) {
    const isThreeClause = /neither the name/i.test(value);
    return [
      ...ids.filter((id) => id !== "BSD-3-Clause"),
      isThreeClause ? "BSD-3-Clause" : "BSD-2-Clause",
    ];
  }
  if (ids.includes("0BSD")) {
    return ids.filter((id) => id !== "ISC");
  }
  return ids;
}

export function parseCargoTree(output) {
  const packages = new Map();
  for (const line of String(output).split(/\r?\n/)) {
    if (!line || line.startsWith("marksi ")) {
      continue;
    }
    const separator = line.lastIndexOf("|");
    if (separator < 0) {
      continue;
    }
    const packagePart = line.slice(0, separator).trim();
    const license = line.slice(separator + 1).trim() || "UNKNOWN";
    const match = /^(.+?) v([^\s]+)(?: \(.+\))?$/.exec(packagePart);
    if (!match) {
      continue;
    }
    const key = `${match[1]}@${match[2]}`;
    if (!packages.has(key)) {
      packages.set(key, {
        name: match[1],
        version: match[2],
        license,
      });
    }
  }
  return [...packages.values()].sort((left, right) =>
    `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`),
  );
}

async function readLicenseTexts(folder) {
  let entries;
  try {
    entries = await readdir(folder, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = entries
    .filter(
      (entry) => entry.isFile() && LICENSE_FILE_PATTERN.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
  const texts = [];
  for (const file of files) {
    const text = await readFile(join(folder, file), "utf8").catch(() => "");
    if (text.trim()) {
      texts.push({ file, text });
    }
  }
  return texts;
}

export async function collectNpmPackages(root = process.cwd()) {
  const lock = JSON.parse(
    await readFile(join(root, "package-lock.json"), "utf8"),
  );
  const packages = [];
  for (const [path, info] of Object.entries(lock.packages ?? {})) {
    if (!path.startsWith("node_modules/") || info.dev) {
      continue;
    }
    const folder = join(root, path);
    const manifestPath = join(folder, "package.json");
    if (!existsSync(manifestPath)) {
      continue;
    }
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const texts = await readLicenseTexts(folder);
    let license = manifest.license ?? "UNKNOWN";
    if (license === "UNKNOWN" && texts.length) {
      const detected = detectLicenseIds(texts.map((entry) => entry.text).join("\n"));
      if (detected.length) {
        license = detected.join(" OR ");
      }
    }
    packages.push({
      ecosystem: "npm",
      name: manifest.name ?? path.replace("node_modules/", ""),
      version: manifest.version ?? info.version ?? "0.0.0",
      license,
      texts,
    });
  }
  return packages.sort((left, right) =>
    `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`),
  );
}

async function cargoSourceFolders() {
  const registry = join(homedir(), ".cargo", "registry", "src");
  const folders = [];
  for (const index of await readdir(registry, { withFileTypes: true }).catch(
    () => [],
  )) {
    if (!index.isDirectory()) {
      continue;
    }
    const base = join(registry, index.name);
    for (const crate of await readdir(base, { withFileTypes: true }).catch(
      () => [],
    )) {
      if (crate.isDirectory()) {
        folders.push(join(base, crate.name));
      }
    }
  }
  return folders;
}

export async function collectRustPackages(
  root = process.cwd(),
  target = hostTarget(),
) {
  const tree = execFileSync(
    "cargo",
    [
      "tree",
      "--offline",
      "--manifest-path",
      join(root, "src-tauri", "Cargo.toml"),
      "--target",
      target,
      "--prefix",
      "none",
      "--format",
      "{p}|{l}",
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const packages = parseCargoTree(tree);
  const sources = await cargoSourceFolders();
  const byName = new Map();
  for (const source of sources) {
    const name = source.split(/[\\/]/).pop();
    if (!byName.has(name)) {
      byName.set(name, source);
    }
  }
  for (const pkg of packages) {
    pkg.ecosystem = "cargo";
    pkg.texts = await readLicenseTexts(
      byName.get(`${pkg.name}-${pkg.version}`) ?? "",
    );
  }
  return packages;
}

function hashText(text) {
  return createHash("sha256").update(text).digest("hex").slice(0, 8);
}

export function buildLicenseCatalog(packages) {
  const bodies = new Map();
  for (const pkg of packages) {
    for (const entry of pkg.texts) {
      const body = licenseBody(entry.text);
      if (!body) {
        continue;
      }
      const id = `L-${hashText(body)}`;
      if (!bodies.has(id)) {
        bodies.set(id, {
          id,
          text: body,
          ids: detectLicenseIds(body),
          packages: 0,
        });
      }
      bodies.get(id).packages += 1;
    }
  }
  const catalog = [...bodies.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const byLicense = new Map();
  for (const license of catalog) {
    for (const id of license.ids) {
      if (!byLicense.has(id)) {
        byLicense.set(id, license.id);
      }
    }
  }
  for (const pkg of packages) {
    const ids = [];
    for (const entry of pkg.texts) {
      const body = licenseBody(entry.text);
      if (body) {
        ids.push(`L-${hashText(body)}`);
      }
    }
    if (!ids.length && pkg.license !== "UNKNOWN") {
      for (const component of licenseComponents(pkg.license)) {
        const id = byLicense.get(component);
        if (id) {
          ids.push(id);
        }
      }
    }
    pkg.licenseIds = [...new Set(ids)];
    pkg.copyrights = [
      ...new Set(
        pkg.texts.flatMap((entry) => copyrightLines(entry.text)),
      ),
    ];
  }
  return catalog;
}

function escapeCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");
}

function renderPackageTable(packages) {
  const lines = [
    "| Package | Version | License | Copyright |",
    "|---|---|---|---|",
  ];
  for (const pkg of packages) {
    const copyright = pkg.copyrights.length
      ? escapeCell(pkg.copyrights.join("; "))
      : "";
    lines.push(
      `| ${escapeCell(pkg.name)} | ${escapeCell(pkg.version)} | ${escapeCell(
        pkg.license,
      )} | ${copyright} |`,
    );
  }
  return lines.join("\n");
}

export function renderNotices({
  target,
  npm,
  rust,
  licenses,
  version,
}) {
  const missing = [...npm, ...rust].filter(
    (pkg) => pkg.licenseIds.length === 0,
  );
  const sections = [
    "# Third-party notices",
    "",
    "MarkSI is MIT licensed. It depends on the open-source projects listed",
    "below; their licenses remain in effect. No proprietary third-party source",
    "code, themes, icons, translations, or branding are included.",
    "",
    `Generated by \`npm run notices:generate\` for MarkSI ${version} and target`,
    `\`${target}\`. Do not edit this file by hand; regenerate it after`,
    "dependency changes.",
    "",
    `- npm production packages: ${npm.length}`,
    `- Rust crates for this target: ${rust.length}`,
    `- Distinct license texts: ${licenses.length}`,
  ];
  if (missing.length) {
    sections.push(
      `- Packages without a license file in the local cache: ${missing.length}`,
    );
  }
  sections.push(
    "",
    "Pandoc is an optional external tool and is not bundled or distributed",
    "with MarkSI. If the user installs it separately, Pandoc's own license",
    "(GPL-2.0-or-later) applies to that separate program. Remote image loading",
    "uses the operating system's WinHTTP API on Windows or the system curl",
    "executable on Linux; neither is bundled by MarkSI.",
    "",
    "## npm dependencies",
    "",
    renderPackageTable(npm),
    "",
    "## Rust dependencies",
    "",
    renderPackageTable(rust),
    "",
    "## License texts",
    "",
  );
  for (const license of licenses) {
    const label = license.ids.length
      ? license.ids.join(" / ")
      : "License text";
    sections.push(
      `### ${license.id} — ${label}`,
      "",
      `Referenced by ${license.packages} package ${
        license.packages === 1 ? "entry" : "entries"
      }.`,
      "",
      "````text",
      license.text,
      "````",
      "",
    );
  }
  if (missing.length) {
    sections.push(
      "## Packages without a cached license file",
      "",
      "The following locked packages did not ship a license file in the local",
      "dependency cache. Their declared license above still applies; consult",
      "the upstream package for the exact text.",
      "",
    );
    for (const pkg of missing) {
      sections.push(
        `- ${pkg.ecosystem} ${pkg.name}@${pkg.version} (${pkg.license})`,
      );
    }
    sections.push("");
  }
  return `${sections.join("\n").trimEnd()}\n`;
}

export async function generateNotices({
  root = process.cwd(),
  target = hostTarget(),
} = {}) {
  const version = JSON.parse(
    await readFile(join(root, "package.json"), "utf8"),
  ).version;
  const npm = await collectNpmPackages(root);
  const rust = await collectRustPackages(root, target);
  const licenses = buildLicenseCatalog([...npm, ...rust]);
  return renderNotices({ target, npm, rust, licenses, version });
}

async function main() {
  const args = process.argv.slice(2);
  const targetIndex = args.indexOf("--target");
  const target =
    targetIndex >= 0 ? args[targetIndex + 1] : hostTarget();
  const outputIndex = args.indexOf("--output");
  const root = process.cwd();
  const output =
    outputIndex >= 0
      ? resolve(args[outputIndex + 1])
      : join(root, "THIRD_PARTY_NOTICES.md");
  const text = await generateNotices({ root, target });
  if (args.includes("--check")) {
    const current = (await readFile(output, "utf8").catch(() => "")).replace(
      /\r\n/g,
      "\n",
    );
    if (current !== text) {
      console.error(
        `${output} is out of date. Run npm run notices:generate.`,
      );
      process.exitCode = 1;
      return;
    }
    console.log(`${output} is up to date.`);
    return;
  }
  await writeFile(output, text, "utf8");
  console.log(
    `Wrote ${text.length.toString()} characters to ${output} for ${target}.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
