export interface EncodingOption {
  value: string;
  label: string;
}

export const ENCODING_OPTIONS: EncodingOption[] = [
  { value: "auto", label: "Auto-detect" },
  { value: "utf-8", label: "UTF-8" },
  { value: "utf-16le", label: "UTF-16 LE" },
  { value: "utf-16be", label: "UTF-16 BE" },
  { value: "gb18030", label: "GB18030" },
  { value: "gbk", label: "GBK / GB2312" },
  { value: "big5", label: "Big5" },
  { value: "shift_jis", label: "Shift_JIS" },
  { value: "euc-jp", label: "EUC-JP" },
  { value: "euc-kr", label: "EUC-KR" },
  { value: "windows-1252", label: "Windows-1252" },
  { value: "iso-8859-1", label: "ISO-8859-1" },
];

export function encodingOption(
  encoding: string,
): EncodingOption | undefined {
  const key = encoding.trim().toLowerCase();
  return ENCODING_OPTIONS.find(
    (option) =>
      option.value === key || option.label.toLowerCase() === key,
  );
}

export function encodingDisplayName(encoding: string): string {
  const option = encodingOption(encoding);
  if (option && option.value !== "auto") {
    return option.label;
  }
  return encoding;
}
