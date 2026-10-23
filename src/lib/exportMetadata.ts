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
  const labels =
    language === "zh-CN"
      ? {
          author: "作者",
          date: "日期",
          description: "摘要",
          tags: "标签",
          keywords: "关键词",
        }
      : {
          author: "Author",
          date: "Date",
          description: "Summary",
          tags: "Tags",
          keywords: "Keywords",
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
  const label =
    language === "zh-CN" ? "文档信息" : "Document information";
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
