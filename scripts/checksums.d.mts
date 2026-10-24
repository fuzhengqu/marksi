export function collectBundleFiles(root: string): Promise<string[]>;
export function checksumLine(path: string, root: string): Promise<string>;
export function buildChecksums(root: string): Promise<{
  files: string[];
  text: string;
}>;
export function writeChecksums(
  root: string,
  output?: string,
): Promise<{
  files: string[];
  text: string;
  target: string;
}>;
