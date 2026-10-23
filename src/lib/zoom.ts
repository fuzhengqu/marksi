export const ZOOM_MIN = 0.8;
export const ZOOM_MAX = 1.6;
export const ZOOM_STEP = 0.1;

export function clampZoom(value: number): number {
  const safe = Number.isFinite(value) ? value : 1;
  const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, safe));
  return Math.round(clamped * 100) / 100;
}

export function stepZoom(current: number, direction: 1 | -1): number {
  return clampZoom(current + direction * ZOOM_STEP);
}

export function zoomPercent(value: number): number {
  return Math.round(clampZoom(value) * 100);
}
