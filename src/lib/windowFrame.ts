export interface WindowFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
}

export interface WorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const WINDOW_FRAME_KEY = "marksi.window-frame.v1";
export const MIN_WINDOW_WIDTH = 640;
export const MIN_WINDOW_HEIGHT = 480;
export const MIN_VISIBLE_X = 120;
export const MIN_VISIBLE_Y = 80;

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeWindowFrame(value: unknown): WindowFrame | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const x = finite(record.x);
  const y = finite(record.y);
  const width = finite(record.width);
  const height = finite(record.height);
  if (x === null || y === null || width === null || height === null) {
    return null;
  }
  if (width < MIN_WINDOW_WIDTH || height < MIN_WINDOW_HEIGHT) {
    return null;
  }
  if (width > 20_000 || height > 20_000) {
    return null;
  }
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    maximized: record.maximized === true,
  };
}

export function intersectsWorkArea(
  frame: WindowFrame,
  area: WorkArea,
): boolean {
  const overlapX =
    Math.min(frame.x + frame.width, area.x + area.width) -
    Math.max(frame.x, area.x);
  const overlapY =
    Math.min(frame.y + frame.height, area.y + area.height) -
    Math.max(frame.y, area.y);
  return overlapX >= MIN_VISIBLE_X && overlapY >= MIN_VISIBLE_Y;
}

/**
 * Keeps a saved window reachable after monitor changes: the frame must overlap
 * a work area by a usable margin, and oversized frames are clamped to fit.
 */
export function fitWindowFrame(
  frame: WindowFrame,
  workAreas: WorkArea[],
): WindowFrame {
  if (workAreas.length === 0) {
    return { ...frame };
  }

  const target =
    workAreas.find((area) => intersectsWorkArea(frame, area)) ?? workAreas[0];
  const width = Math.max(
    Math.min(frame.width, target.width),
    Math.min(MIN_WINDOW_WIDTH, target.width),
  );
  const height = Math.max(
    Math.min(frame.height, target.height),
    Math.min(MIN_WINDOW_HEIGHT, target.height),
  );
  const maxX = target.x + target.width - width;
  const maxY = target.y + target.height - height;
  const x = Math.min(Math.max(frame.x, target.x), maxX);
  const y = Math.min(Math.max(frame.y, target.y), maxY);

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    maximized: frame.maximized,
  };
}

export function loadWindowFrame(): WindowFrame | null {
  try {
    const raw = localStorage.getItem(WINDOW_FRAME_KEY);
    return raw ? normalizeWindowFrame(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveWindowFrame(frame: WindowFrame): void {
  try {
    localStorage.setItem(WINDOW_FRAME_KEY, JSON.stringify(frame));
  } catch {
    // Window memory is optional; quota or privacy errors must not break saves.
  }
}

export function clearWindowFrame(): void {
  try {
    localStorage.removeItem(WINDOW_FRAME_KEY);
  } catch {
    // Ignore storage errors.
  }
}
