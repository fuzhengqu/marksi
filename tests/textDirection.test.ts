import { describe, expect, it } from "vitest";
import {
  firstStrongDirection,
  resolveTextDirection,
} from "../src/lib/textDirection";

describe("document text direction", () => {
  it("finds the first strong character", () => {
    expect(firstStrongDirection("مرحبا بالعالم")).toBe("rtl");
    expect(firstStrongDirection("עברית")).toBe("rtl");
    expect(firstStrongDirection("Hello world")).toBe("ltr");
    expect(firstStrongDirection("中文段落")).toBe("ltr");
    expect(firstStrongDirection("日本語")).toBe("ltr");
    expect(firstStrongDirection("123 !!! 😀 مرحبا")).toBe("rtl");
    expect(firstStrongDirection("123 !!! 😀 hello")).toBe("ltr");
    expect(firstStrongDirection("123 !!! 😀")).toBeNull();
  });

  it("skips YAML front matter when choosing automatically", () => {
    const source = [
      "---",
      "title: English metadata",
      "---",
      "",
      "مرحبا بالعالم",
    ].join("\n");
    expect(resolveTextDirection(source)).toBe("rtl");
    expect(resolveTextDirection(source, "ltr")).toBe("ltr");
  });

  it("supports explicit overrides", () => {
    expect(resolveTextDirection("مرحبا", "ltr")).toBe("ltr");
    expect(resolveTextDirection("Hello", "rtl")).toBe("rtl");
    expect(resolveTextDirection("English only")).toBe("ltr");
    expect(resolveTextDirection("")).toBe("ltr");
  });
});
