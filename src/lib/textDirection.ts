import { extractFrontMatter } from "./frontMatter";

export type TextDirection = "ltr" | "rtl";
export type TextDirectionPreference = "auto" | TextDirection;

const RTL_RANGES: Array<[number, number]> = [
  [0x0590, 0x05ff],
  [0x0600, 0x06ff],
  [0x0700, 0x074f],
  [0x0750, 0x077f],
  [0x0780, 0x07bf],
  [0x07c0, 0x07ff],
  [0x0800, 0x085f],
  [0x0860, 0x08ff],
  [0xfb1d, 0xfb4f],
  [0xfb50, 0xfdff],
  [0xfe70, 0xfeff],
  [0x10800, 0x10fff],
  [0x1e800, 0x1efff],
];

const LETTER = /\p{L}/u;

function isRtlCodePoint(codePoint: number): boolean {
  return RTL_RANGES.some(
    ([start, end]) => codePoint >= start && codePoint <= end,
  );
}

export function firstStrongDirection(text: string): TextDirection | null {
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) {
      continue;
    }
    if (isRtlCodePoint(codePoint)) {
      return "rtl";
    }
    if (LETTER.test(character)) {
      return "ltr";
    }
  }
  return null;
}

export function resolveTextDirection(
  text: string,
  preference: TextDirectionPreference = "auto",
): TextDirection {
  if (preference === "ltr" || preference === "rtl") {
    return preference;
  }
  const body = extractFrontMatter(text)?.body ?? text;
  return firstStrongDirection(body) ?? "ltr";
}
