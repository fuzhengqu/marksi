import { describe, expect, it } from "vitest";
import { isImeKeyEvent } from "../src/lib/ime";

describe("IME key guard", () => {
  it("ignores keys while composition is active", () => {
    expect(isImeKeyEvent({ isComposing: true, key: "b", keyCode: 66 })).toBe(
      true,
    );
    expect(isImeKeyEvent({ key: "Process", keyCode: 229 })).toBe(true);
    expect(isImeKeyEvent({ keyCode: 229 })).toBe(true);
  });

  it("allows normal shortcuts outside composition", () => {
    expect(isImeKeyEvent({ isComposing: false, key: "b", keyCode: 66 })).toBe(
      false,
    );
    expect(isImeKeyEvent({ key: "b", keyCode: 66 })).toBe(false);
    expect(isImeKeyEvent({ key: "Process" })).toBe(true);
  });
});
