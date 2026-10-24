export function formatSnapshotSize(bytes: number): string {
  const safe = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (safe < 1024) {
    return `${Math.round(safe)} B`;
  }
  if (safe < 1024 * 1024) {
    return `${(safe / 1024).toFixed(1)} KB`;
  }
  return `${(safe / (1024 * 1024)).toFixed(1)} MB`;
}

export function snapshotTime(
  savedAt: number,
  language: "zh-CN" | "en",
): string {
  if (!Number.isFinite(savedAt) || savedAt <= 0) {
    return language === "zh-CN" ? "未知时间" : "Unknown time";
  }
  return new Date(savedAt).toLocaleString(
    language === "zh-CN" ? "zh-CN" : "en",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  );
}
