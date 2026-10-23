import type {
  ExportMargin,
  ExportOptions,
  ExportOrientation,
  ExportPageSize,
  ExportProfileId,
} from "../types";

type PresetProfile = Exclude<ExportProfileId, "custom">;

export const DEFAULT_EXPORT_OPTIONS: Readonly<ExportOptions> = {
  profile: "document",
  useFrontMatter: true,
  includeMetadataTags: true,
  includeDocumentInfo: false,
  pageSize: "a4",
  orientation: "portrait",
  margin: "normal",
  header: "",
  footer: "",
};

export const EXPORT_PROFILE_PRESETS: Readonly<
  Record<PresetProfile, ExportOptions>
> = {
  document: { ...DEFAULT_EXPORT_OPTIONS, profile: "document" },
  print: {
    ...DEFAULT_EXPORT_OPTIONS,
    profile: "print",
    header: "{title}",
    footer: "{page} / {pages}",
  },
  minimal: {
    ...DEFAULT_EXPORT_OPTIONS,
    profile: "minimal",
    useFrontMatter: false,
    includeMetadataTags: false,
    margin: "narrow",
  },
};

const PAGE_SIZES: Record<ExportPageSize, string> = {
  a4: "A4",
  letter: "Letter",
  legal: "Legal",
};

const PAGE_MARGINS: Record<ExportMargin, string> = {
  normal: "18mm 16mm",
  narrow: "10mm 12mm",
  wide: "26mm 24mm",
};

const PROFILE_IDS: ExportProfileId[] = [
  "document",
  "print",
  "minimal",
  "custom",
];
const PAGE_SIZE_IDS: ExportPageSize[] = ["a4", "letter", "legal"];
const ORIENTATION_IDS: ExportOrientation[] = ["portrait", "landscape"];
const MARGIN_IDS: ExportMargin[] = ["normal", "narrow", "wide"];

function oneOf<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function cleanTemplate(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .slice(0, 120);
}

function optionsMatchPreset(
  options: ExportOptions,
  preset: ExportOptions,
): boolean {
  return (
    options.useFrontMatter === preset.useFrontMatter &&
    options.includeMetadataTags === preset.includeMetadataTags &&
    options.includeDocumentInfo === preset.includeDocumentInfo &&
    options.pageSize === preset.pageSize &&
    options.orientation === preset.orientation &&
    options.margin === preset.margin &&
    options.header === preset.header &&
    options.footer === preset.footer
  );
}

/**
 * Normalizes persisted or caller-supplied export options. Unknown enum values
 * fall back to the document preset, and a named preset whose values no longer
 * match becomes custom so the dialog never shows inconsistent controls.
 */
export function normalizeExportOptions(value: unknown): ExportOptions {
  const input = (value && typeof value === "object" ? value : {}) as Partial<
    Record<keyof ExportOptions, unknown>
  >;
  const profile = oneOf(
    input.profile,
    PROFILE_IDS,
    DEFAULT_EXPORT_OPTIONS.profile,
  );
  const options: ExportOptions = {
    profile,
    useFrontMatter: booleanOr(
      input.useFrontMatter,
      DEFAULT_EXPORT_OPTIONS.useFrontMatter,
    ),
    includeMetadataTags: booleanOr(
      input.includeMetadataTags,
      DEFAULT_EXPORT_OPTIONS.includeMetadataTags,
    ),
    includeDocumentInfo: booleanOr(
      input.includeDocumentInfo,
      DEFAULT_EXPORT_OPTIONS.includeDocumentInfo,
    ),
    pageSize: oneOf(
      input.pageSize,
      PAGE_SIZE_IDS,
      DEFAULT_EXPORT_OPTIONS.pageSize,
    ),
    orientation: oneOf(
      input.orientation,
      ORIENTATION_IDS,
      DEFAULT_EXPORT_OPTIONS.orientation,
    ),
    margin: oneOf(input.margin, MARGIN_IDS, DEFAULT_EXPORT_OPTIONS.margin),
    header: cleanTemplate(input.header, DEFAULT_EXPORT_OPTIONS.header),
    footer: cleanTemplate(input.footer, DEFAULT_EXPORT_OPTIONS.footer),
  };

  if (
    options.profile !== "custom" &&
    !optionsMatchPreset(options, EXPORT_PROFILE_PRESETS[options.profile])
  ) {
    options.profile = "custom";
  }
  return options;
}

export function exportProfileOptions(profile: PresetProfile): ExportOptions {
  return { ...EXPORT_PROFILE_PRESETS[profile] };
}

function cssString(value: string): string {
  return `"${value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, " ")}"`;
}

function cssContent(template: string, title: string): string {
  const parts: string[] = [];
  const pattern = /\{(title|page|pages)\}/g;
  let lastIndex = 0;
  let match = pattern.exec(template);
  while (match) {
    const text = template
      .slice(lastIndex, match.index)
      .replace(/\s+/g, " ")
      .trim();
    if (text) {
      parts.push(cssString(text));
    }
    parts.push(
      match[1] === "title" ? cssString(title) : `counter(${match[1]})`,
    );
    lastIndex = match.index + match[0].length;
    match = pattern.exec(template);
  }
  const tail = template.slice(lastIndex).replace(/\s+/g, " ").trim();
  if (tail) {
    parts.push(cssString(tail));
  }
  return parts.length ? parts.join(" ") : '""';
}

/**
 * Builds the paged-media portion of an export style. Paper size, orientation,
 * and margins are honored by Chromium/WebView2 printing. Margin boxes provide
 * optional headers and footers in engines that support CSS paged media; the
 * operating-system print dialog may still add or override its own header and
 * footer controls.
 */
export function buildPageCss(options: ExportOptions, title: string): string {
  const normalized = normalizeExportOptions(options);
  const header = normalized.header.trim();
  const footer = normalized.footer.trim();
  const boxes = [
    header
      ? `  @top-center {\n    content: ${cssContent(header, title)};\n    color: #6f7378;\n    font-family: "Segoe UI", system-ui, sans-serif;\n    font-size: 9pt;\n  }`
      : "",
    footer
      ? `  @bottom-center {\n    content: ${cssContent(footer, title)};\n    color: #6f7378;\n    font-family: "Segoe UI", system-ui, sans-serif;\n    font-size: 9pt;\n  }`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `@page {
  size: ${PAGE_SIZES[normalized.pageSize]} ${normalized.orientation};
  margin: ${PAGE_MARGINS[normalized.margin]};
${boxes ? `${boxes}\n` : ""}}`;
}
