const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/** Parses a three-part technical version used by npm, Cargo, and Tauri. */
export function parseSemver(value) {
  const match = SEMVER.exec(String(value).trim());
  if (!match) {
    throw new Error(`Expected a three-part version, received ${value}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/**
 * Returns the two-part product version. The technical version keeps a patch
 * segment for package-manager compatibility, but users and tags never see it.
 */
export function productVersion(value) {
  const { major, minor } = parseSemver(value);
  if (major === 0 && minor > 99) {
    throw new Error("Use 1.0.0 instead of a 0.100+ version");
  }
  return `${major}.${String(minor).padStart(2, "0")}`;
}

/** Monotonic integer used to compare releases without parsing version names. */
export function versionCodeFor(value) {
  const { major, minor } = parseSemver(value);
  if (major === 0 && minor > 99) {
    throw new Error("Use 1.0.0 instead of a 0.100+ version");
  }
  return major * 100 + minor;
}

/** Product tag such as v0.61 or v1.00. */
export function releaseTag(value) {
  return `v${productVersion(value)}`;
}

/**
 * Returns the next technical version. The default adds one minor step; `--to`
 * may request an explicit milestone. 0.99.0 defaults to 1.0.0, never 0.100.0.
 */
export function nextReleaseVersion(current, target = null) {
  const parsed = parseSemver(current);
  if (parsed.patch !== 0) {
    throw new Error("Release versions must end in .0");
  }

  let next;
  if (target != null) {
    let normalized = String(target).trim();
    if (/^\d+\.\d+$/.test(normalized)) {
      normalized += ".0";
    }
    const requested = parseSemver(normalized);
    if (requested.patch !== 0) {
      throw new Error("Release versions must end in .0");
    }
    next = requested;
  } else if (parsed.major === 0 && parsed.minor === 99) {
    next = { major: 1, minor: 0, patch: 0 };
  } else if (parsed.major === 0) {
    next = { major: 0, minor: parsed.minor + 1, patch: 0 };
  } else {
    next = { major: parsed.major, minor: parsed.minor + 1, patch: 0 };
  }

  if (next.major === 0 && next.minor > 99) {
    throw new Error("0.99.0 must be followed by 1.0.0");
  }
  const nextVersion = `${next.major}.${next.minor}.0`;
  if (versionCodeFor(nextVersion) <= versionCodeFor(current)) {
    throw new Error(
      `Next version ${nextVersion} must increase versionCode beyond ${versionCodeFor(current)}`,
    );
  }
  return nextVersion;
}
