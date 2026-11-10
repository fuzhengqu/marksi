const FRONT_MATTER_PATTERN =
  /^(?:\uFEFF)?---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

export interface FrontMatter {
  block: string;
  raw: string;
  body: string;
  lineCount: number;
  metadata: Record<string, string>;
}

export function parseFrontMatterMetadata(
  raw: string,
): Record<string, string> {
  const metadata: Record<string, string> = {};
  let currentKey: string | null = null;

  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || /^\s*#/.test(line)) {
      continue;
    }

    const match = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(line);
    if (match) {
      const key = match[1].toLowerCase();
      let value = match[2].trim();
      if (
        value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'")))
      ) {
        value = value.slice(1, -1);
      }
      metadata[key] = value;
      currentKey = key;
      continue;
    }

    if (currentKey && /^\s+/.test(line)) {
      metadata[currentKey] =
        `${metadata[currentKey]} ${line.trim()}`.trim();
    }
  }

  return metadata;
}

export function frontMatterTitle(source: string): string | null {
  const title = extractFrontMatter(source)?.metadata.title?.trim();
  return title || null;
}

export interface FrontMatterEntry {
  key: string;
  value: string;
}

/**
 * Returns the 1-based line number of a leading front matter block's closing
 * delimiter, or 0 when the document does not start with a complete block.
 * Scanning stops at the closing delimiter, so callers avoid copying the whole
 * document just to find it.
 */
export function frontMatterLineCount(
  lineCount: number,
  lineAt: (lineNumber: number) => string,
): number {
  if (lineCount < 2) {
    return 0;
  }
  const opening = lineAt(1).replace(/^\uFEFF/, "");
  if (!/^---[ \t]*$/.test(opening)) {
    return 0;
  }
  for (let lineNumber = 2; lineNumber <= lineCount; lineNumber += 1) {
    if (/^(?:---|\.\.\.)[ \t]*$/.test(lineAt(lineNumber))) {
      return lineNumber;
    }
  }
  return 0;
}

/**
 * Returns displayable metadata entries in source order. Empty values are
 * omitted and the result is capped so the live-preview card stays compact.
 */
export function frontMatterSummary(
  source: string,
  limit = 6,
): FrontMatterEntry[] {
  const metadata = extractFrontMatter(source)?.metadata;
  const max = Math.max(0, Math.floor(limit));
  if (!metadata || max === 0) {
    return [];
  }

  return Object.entries(metadata)
    .map(([key, value]) => ({ key, value: value.trim() }))
    .filter((entry) => entry.value.length > 0)
    .slice(0, max);
}

export function extractFrontMatter(source: string): FrontMatter | null {
  const match = FRONT_MATTER_PATTERN.exec(source);
  if (!match) {
    return null;
  }

  const block = match[0];
  const raw = match[1] ?? "";
  const lineCount =
    block.split(/\r?\n/).length - (block.endsWith("\n") ? 1 : 0);

  return {
    block,
    raw,
    body: source.slice(block.length),
    lineCount,
    metadata: parseFrontMatterMetadata(raw),
  };
}
