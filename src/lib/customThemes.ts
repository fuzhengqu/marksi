export interface CustomTheme {
  name: string;
  css: string;
}

export interface SanitizedCss {
  css: string;
  blocked: number;
}

const URL_PATTERN = /url\s*\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi;
const QUOTED_ABSOLUTE =
  /(["'])\s*(?:https?:)?\/\/[^"']*\1/gi;
const IMPORT_PATTERN = /@import\b[^;]*(?:;|$)/gi;

/**
 * User themes are local files, but they must not cause network requests from
 * the app. Remote @import rules and every non-data url() are removed. Quoted
 * absolute URLs are removed as well because image-set() accepts them directly.
 */
export function sanitizeCustomCss(css: string): SanitizedCss {
  let blocked = 0;
  let output = css.replace(/\/\*[\s\S]*?\*\//g, "");
  output = output.replace(IMPORT_PATTERN, () => {
    blocked += 1;
    return "";
  });
  output = output.replace(URL_PATTERN, (match, double, single, plain) => {
    const value = String(double ?? single ?? plain ?? "").trim();
    if (value.startsWith("data:") || value.startsWith("#")) {
      return match;
    }
    blocked += 1;
    return "none";
  });
  output = output.replace(QUOTED_ABSOLUTE, () => {
    blocked += 1;
    return '""';
  });
  output = output.replace(/\bexpression\s*\(/gi, () => {
    blocked += 1;
    return "none(";
  });
  output = output.replace(/(?:behavior|-moz-binding)\s*:/gi, () => {
    blocked += 1;
    return "blocked:";
  });
  return { css: output, blocked };
}

export function findCustomTheme(
  themes: CustomTheme[],
  name: string,
): CustomTheme | null {
  return themes.find((theme) => theme.name === name) ?? null;
}
