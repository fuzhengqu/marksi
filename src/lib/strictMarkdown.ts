import { extractFrontMatter } from "./frontMatter";

/**
 * Adds the whitespace required by strict ATX headings when the user disables
 * strict mode. The canonical Markdown source is not modified; this only
 * normalizes the rendering input. Fenced code and front matter are untouched.
 */
export function normalizeLaxHeadings(source: string): string {
  const frontMatter = extractFrontMatter(source);
  const body = frontMatter ? source.slice(frontMatter.block.length) : source;
  const lines = body.split("\n");
  let fence: { character: string; length: number } | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (fence) {
      const closing = new RegExp(
        `^ {0,3}\\${fence.character}{${fence.length},}[ \\t]*\\r?$`,
      );
      if (closing.test(line)) {
        fence = null;
      }
      continue;
    }

    const opening = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (opening) {
      fence = { character: opening[1][0], length: opening[1].length };
      continue;
    }

    const lineEnding = line.endsWith("\r") ? "\r" : "";
    const lineBody = lineEnding ? line.slice(0, -1) : line;
    const compactHeading = /^( {0,3})(#{1,6})([^#\s].*)$/.exec(lineBody);
    if (compactHeading) {
      lines[index] = `${compactHeading[1]}${compactHeading[2]} ${compactHeading[3]}${lineEnding}`;
    }
  }

  const normalizedBody = lines.join("\n");
  return frontMatter
    ? `${frontMatter.block}${normalizedBody}`
    : normalizedBody;
}
