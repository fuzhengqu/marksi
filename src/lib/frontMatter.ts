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
