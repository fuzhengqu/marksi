import { describe, expect, it } from "vitest";
import {
  ENCODING_OPTIONS,
  encodingDisplayName,
  encodingOption,
} from "../src/lib/encodings";

describe("encoding options", () => {
  it("includes Chinese-first legacy encodings", () => {
    const values = ENCODING_OPTIONS.map((option) => option.value);
    expect(values).toContain("utf-8");
    expect(values).toContain("gb18030");
    expect(values).toContain("gbk");
    expect(values).toContain("big5");
  });

  it("finds an option by value or canonical label", () => {
    expect(encodingOption("GB18030")?.value).toBe("gb18030");
    expect(encodingOption("utf-16le")?.value).toBe("utf-16le");
    expect(encodingOption("UTF-16 LE")?.value).toBe("utf-16le");
    expect(encodingOption("not-real")).toBeUndefined();
  });

  it("uses friendly display names for canonical encodings", () => {
    expect(encodingDisplayName("gb18030")).toBe("GB18030");
    expect(encodingDisplayName("GBK")).toBe("GBK / GB2312");
    expect(encodingDisplayName("UTF-8")).toBe("UTF-8");
    expect(encodingDisplayName("made-up")).toBe("made-up");
  });
});
