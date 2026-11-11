/** GitHub alert kinds supported by the reading view and live preview. */
export const ALERT_TITLES = {
  caution: "Caution",
  important: "Important",
  note: "Note",
  tip: "Tip",
  warning: "Warning",
} as const;

export type AlertKind = keyof typeof ALERT_TITLES;

export interface AlertMarker {
  kind: AlertKind;
  /** Offset of `[!KIND]` within the line. */
  start: number;
  /** End offset of `[!KIND]`, excluding any following text. */
  end: number;
}

const ALERT_PATTERN =
  /^( {0,3}>[ \t]?)(\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\])(?=[ \t]|$)/i;

function isAlertKind(value: string): value is AlertKind {
  return Object.prototype.hasOwnProperty.call(ALERT_TITLES, value);
}

/**
 * Parses the first line of a GitHub alert block quote. The marker must start
 * the quote content and be followed by whitespace or the end of the line;
 * `[!NOTE]text` and nested `> > [!NOTE]` lines are rejected so ordinary quotes
 * keep their normal live-preview styling.
 */
export function alertMarker(line: string): AlertMarker | null {
  const match = ALERT_PATTERN.exec(line.replace(/\r$/, ""));
  if (!match) {
    return null;
  }
  const kind = match[3].toLowerCase();
  if (!isAlertKind(kind)) {
    return null;
  }
  const start = match[1].length;
  return { kind, start, end: start + match[2].length };
}

/** Line classes shared by the alert block and its per-kind accent. */
export function alertClass(kind: AlertKind): string {
  return `cm-live-alert cm-live-alert-${kind}`;
}
