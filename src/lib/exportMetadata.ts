import { translate } from "../i18n/dictionary";
import { escapeHtml } from "./htmlEscape";
import type { Language } from "../types";

interface DocumentInfoEntry {
  label: string;
  value: string;
}

function cleanInfoValue(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function documentInfoEntries(
  metadata: Record<string, string>,
  language: Language,
): DocumentInfoEntry[] {
  const labels = {
    author: translate(language, "Author"),
    date: translate(language, "Date"),
    description: translate(language, "Summary"),
    tags: translate(language, "Tags"),
    keywords: translate(language, "Keywords"),
  };
  const fields: Array<[keyof typeof labels, string]> = [
    ["author", cleanInfoValue(metadata.author)],
    ["date", cleanInfoValue(metadata.date)],
    [
      "description",
      cleanInfoValue(metadata.description || metadata.summary),
    ],
    ["tags", cleanInfoValue(metadata.tags)],
    ["keywords", cleanInfoValue(metadata.keywords)],
  ];
  return fields
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => ({ label: labels[key], value }));
}

export function buildMetaTags(
  metadata: Record<string, string>,
  enabled: boolean,
): string {
  if (!enabled) {
    return "";
  }
  const description = metadata.description || metadata.summary;
  return [
    metadata.author
      ? `<meta name="author" content="${escapeHtml(metadata.author)}">`
      : "",
    description
      ? `<meta name="description" content="${escapeHtml(description)}">`
      : "",
    metadata.keywords || metadata.tags
      ? `<meta name="keywords" content="${escapeHtml(
          metadata.keywords || metadata.tags,
        )}">`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function documentInfoMarkup(
  metadata: Record<string, string>,
  language: Language,
  enabled: boolean,
): string {
  if (!enabled) {
    return "";
  }
  const entries = documentInfoEntries(metadata, language);
  if (!entries.length) {
    return "";
  }
  const label = translate(language, "Document information");
  return `<section class="document-info" aria-label="${label}">
<dl>
${entries
  .map(
    (entry) =>
      `<div><dt>${escapeHtml(entry.label)}</dt><dd>${escapeHtml(
        entry.value,
      )}</dd></div>`,
  )
  .join("\n")}
</dl>
</section>`;
}
