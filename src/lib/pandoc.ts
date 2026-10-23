export type PandocFormat = "docx" | "odt" | "epub" | "latex" | "rtf";

export interface PandocFormatInfo {
  id: PandocFormat;
  extension: string;
  label: string;
  filterName: string;
}

export const PANDOC_FORMATS: PandocFormatInfo[] = [
  {
    id: "docx",
    extension: "docx",
    label: "Word document (.docx)",
    filterName: "Word document",
  },
  {
    id: "odt",
    extension: "odt",
    label: "OpenDocument text (.odt)",
    filterName: "OpenDocument text",
  },
  {
    id: "epub",
    extension: "epub",
    label: "EPUB book (.epub)",
    filterName: "EPUB book",
  },
  {
    id: "latex",
    extension: "tex",
    label: "LaTeX document (.tex)",
    filterName: "LaTeX document",
  },
  {
    id: "rtf",
    extension: "rtf",
    label: "Rich Text Format (.rtf)",
    filterName: "Rich Text Format",
  },
];

export function pandocFormatInfo(format: PandocFormat): PandocFormatInfo {
  return (
    PANDOC_FORMATS.find((entry) => entry.id === format) ?? PANDOC_FORMATS[0]
  );
}

export function pandocExportName(
  documentName: string,
  format: PandocFormat,
): string {
  const base =
    documentName.replace(/\.[^.\\/]+$/, "").trim() || "Untitled";
  return `${base}.${pandocFormatInfo(format).extension}`;
}

export function pandocExportPath(
  documentPath: string | null,
  documentName: string,
  format: PandocFormat,
): string {
  const fileName = pandocExportName(documentName, format);
  if (!documentPath) {
    return fileName;
  }
  const separator = Math.max(
    documentPath.lastIndexOf("/"),
    documentPath.lastIndexOf("\\"),
  );
  return separator >= 0
    ? `${documentPath.slice(0, separator + 1)}${fileName}`
    : fileName;
}
