export const LARGE_FILE_CHARS = 500_000;

export function isLargeDocument(
  content: string,
  threshold = LARGE_FILE_CHARS,
): boolean {
  return content.length >= threshold;
}
