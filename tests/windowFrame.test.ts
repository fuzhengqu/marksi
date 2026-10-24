import { describe, expect, it } from "vitest";
import {
  fitWindowFrame,
  intersectsWorkArea,
  normalizeWindowFrame,
  type WindowFrame,
} from "../src/lib/windowFrame";

const frame: WindowFrame = {
  x: 120,
  y: 80,
  width: 1280,
  height: 840,
  maximized: false,
};

describe("window frame memory", () => {
  it("rejects malformed or implausible frames", () => {
    expect(normalizeWindowFrame(null)).toBeNull();
    expect(normalizeWindowFrame("frame")).toBeNull();
    expect(normalizeWindowFrame({ ...frame, x: "1" })).toBeNull();
    expect(normalizeWindowFrame({ ...frame, width: 100 })).toBeNull();
    expect(normalizeWindowFrame({ ...frame, height: 25_000 })).toBeNull();
    expect(
      normalizeWindowFrame({ ...frame, x: 10.4, width: 1280.6 }),
    ).toMatchObject({ x: 10, width: 1281, maximized: false });
    expect(normalizeWindowFrame({ ...frame, maximized: "yes" })?.maximized).toBe(
      false,
    );
  });

  it("detects usable overlap with a monitor", () => {
    const area = { x: 0, y: 0, width: 1920, height: 1040 };
    expect(intersectsWorkArea(frame, area)).toBe(true);
    expect(
      intersectsWorkArea({ ...frame, x: 1919, y: 0 }, area),
    ).toBe(false);
    expect(
      intersectsWorkArea({ ...frame, x: 0, y: 1039 }, area),
    ).toBe(false);
    expect(
      intersectsWorkArea({ ...frame, x: 1750, y: 900 }, area),
    ).toBe(true);
  });

  it("returns an offscreen frame to the nearest work area", () => {
    const areas = [{ x: 0, y: 0, width: 1920, height: 1040 }];
    const fitted = fitWindowFrame(
      { ...frame, x: 4000, y: 3000 },
      areas,
    );
    expect(fitted.x).toBe(640);
    expect(fitted.y).toBe(200);
    expect(fitted.width).toBe(1280);
    expect(fitted.height).toBe(840);
    expect(fitted.maximized).toBe(false);
  });

  it("clamps oversized frames to the monitor work area", () => {
    const areas = [{ x: 1920, y: 0, width: 1366, height: 728 }];
    const fitted = fitWindowFrame(
      { ...frame, x: 1920, y: 0, width: 3000, height: 2000 },
      areas,
    );
    expect(fitted).toEqual({
      x: 1920,
      y: 0,
      width: 1366,
      height: 728,
      maximized: false,
    });
  });

  it("keeps a partially visible frame on its monitor", () => {
    const areas = [{ x: 0, y: 0, width: 1920, height: 1040 }];
    const fitted = fitWindowFrame(
      { ...frame, x: 1700, y: 900 },
      areas,
    );
    expect(fitted.x).toBe(640);
    expect(fitted.y).toBe(200);
  });

  it("preserves the maximized flag and tolerates no monitors", () => {
    expect(fitWindowFrame({ ...frame, maximized: true }, []).maximized).toBe(
      true,
    );
    expect(fitWindowFrame({ ...frame, maximized: true }, [])).toMatchObject({
      width: 1280,
      height: 840,
    });
  });
});
