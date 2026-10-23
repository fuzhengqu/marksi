export interface CustomExportValues {
  input: string;
  document: string;
  title: string;
}

export function parseCommandArguments(source: string): string[] {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Replaces placeholders in already-separated arguments. The command is never
 * passed through a shell, so argument text is never re-tokenized.
 */
export function expandCommandArguments(
  args: string[],
  values: CustomExportValues,
): string[] {
  return args.map((argument) =>
    argument.replace(
      /\{(input|document|title)\}/g,
      (_match, key: keyof CustomExportValues) => values[key],
    ),
  );
}

export function parentDirectory(path: string): string | null {
  const separator = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (separator < 0) {
    return null;
  }
  const parent = path.slice(0, separator);
  if (!parent) {
    return path.slice(0, 1);
  }
  if (/^[A-Za-z]:$/.test(parent)) {
    return `${parent}\\`;
  }
  return parent;
}
