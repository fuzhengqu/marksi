import { describe, expect, it } from "vitest";
import {
  clampImageWidth,
  findImageOccurrences,
  imageWidthFromAttributes,
  setImageWidth,
} from "../src/lib/imageSize";

describe("findImageOccurrences", () => {
  it("finds plain and nested-label images without matching escaped markers", () => {
    const source = "before ![one](one.png) and ![two [x]](two.png)";
    const occurrences = findImageOccurrences(source);
    expect(occurrences).toHaveLength(2);
    expect(occurrences[0].from).toBe(source.indexOf("![one]"));
    expect(occurrences[1].from).toBe(source.indexOf("![two"));
    expect(findImageOccurrences("\\![not](image.png)")).toHaveLength(0);
  });

  it("locates an immediately following attribute block", () => {
    const source = "![alt](image.png){width=300 height=200}";
    const [image] = findImageOccurrences(source);
    expect(source.slice(image.attrsFrom!, image.attrsTo!)).toBe(
      "{width=300 height=200}",
    );
  });

  it("ignores image-like text in fenced and inline code", () => {
    const source = [
      "```markdown",
      "![fenced](fenced.png)",
      "```",
      "`![inline](inline.png)`",
      "![real](real.png)",
    ].join("\n");
    const occurrences = findImageOccurrences(source);
    expect(occurrences).toHaveLength(1);
    expect(source.slice(occurrences[0].from, occurrences[0].to)).toBe(
      "![real](real.png)",
    );
  });

  it("counts full, collapsed, and shortcut reference images", () => {
    const source = [
      "![full][one]",
      "![collapsed][]",
      "![shortcut]",
      "",
      "[one]: one.png",
      "[collapsed]: collapsed.png",
      "[shortcut]: shortcut.png",
    ].join("\n");
    const occurrences = findImageOccurrences(source);
    expect(occurrences).toHaveLength(3);
    expect(
      occurrences.map((occurrence) => source.slice(occurrence.from, occurrence.to)),
    ).toEqual(["![full][one]", "![collapsed][]", "![shortcut]"]);
    expect(findImageOccurrences("![missing][nope]")).toHaveLength(0);
  });

  it("excludes footnote bodies so main images keep their render index", () => {
    const source = [
      "[^1]: foot ![foot](foot.png)",
      "",
      "![main](main.png)",
      "",
      "Text[^1]",
    ].join("\n");
    const occurrences = findImageOccurrences(source);
    expect(occurrences).toHaveLength(1);
    expect(source.slice(occurrences[0].from, occurrences[0].to)).toBe(
      "![main](main.png)",
    );
  });

  it("ignores parentheses inside quoted image titles", () => {
    const source = '![alt](image.png "a (title")';
    const occurrences = findImageOccurrences(source);
    expect(occurrences).toHaveLength(1);
    expect(source.slice(occurrences[0].from, occurrences[0].to)).toBe(source);
  });

  it("ignores image syntax in front matter", () => {
    const source = [
      "---",
      "cover: '![metadata](metadata.png)'",
      "---",
      "",
      "![real](real.png)",
    ].join("\n");
    const occurrences = findImageOccurrences(source);
    expect(occurrences).toHaveLength(1);
    expect(source.slice(occurrences[0].from, occurrences[0].to)).toBe(
      "![real](real.png)",
    );
  });
});

describe("setImageWidth", () => {
  it("adds width attributes without touching the rest of the source", () => {
    expect(setImageWidth("![alt](image.png)", 0, 320)).toBe(
      "![alt](image.png){width=320}",
    );
  });

  it("updates an existing width and keeps other attributes", () => {
    expect(
      setImageWidth(
        "![alt](image.png){height=200 width=300 .photo}",
        0,
        480,
      ),
    ).toBe("![alt](image.png){height=200 width=480 .photo}");
  });

  it("adds width to an existing attribute block without a width", () => {
    expect(setImageWidth("![alt](image.png){height=200}", 0, 240)).toBe(
      "![alt](image.png){height=200 width=240}",
    );
  });

  it("moves a spaced attribute block onto the image", () => {
    expect(setImageWidth("![alt](image.png) {width=300}", 0, 200)).toBe(
      "![alt](image.png){width=200}",
    );
  });

  it("targets the requested image and ignores invalid indexes", () => {
    const source = "![a](a.png) ![b](b.png)";
    expect(setImageWidth(source, 1, 200)).toBe(
      "![a](a.png) ![b](b.png){width=200}",
    );
    expect(setImageWidth(source, 9, 200)).toBe(source);
  });

  it("does not write into code when an image follows a code fence", () => {
    const source =
      "```\n![code](code.png)\n```\n\n![real](real.png)";
    expect(setImageWidth(source, 0, 240)).toBe(
      "```\n![code](code.png)\n```\n\n![real](real.png){width=240}",
    );
  });

  it("writes dimensions onto reference-style images", () => {
    expect(
      setImageWidth("![alt][ref]\n\n[ref]: image.png", 0, 260),
    ).toBe("![alt][ref]{width=260}\n\n[ref]: image.png");
  });

  it("uses the rendered alt when the indexed occurrence is not the target", () => {
    const indentedCode = "    ![code](code.png)\n\n![real](real.png)";
    expect(setImageWidth(indentedCode, 0, 240, "real")).toBe(
      "    ![code](code.png)\n\n![real](real.png){width=240}",
    );
    expect(setImageWidth(indentedCode, 0, 240, "missing")).toBe(indentedCode);
  });

  it("clamps sizes to the safe range", () => {
    expect(clampImageWidth(1)).toBe(24);
    expect(clampImageWidth(5000)).toBe(1600);
    expect(clampImageWidth(Number.NaN)).toBe(0);
  });

  it("reads width attributes for tests and future controls", () => {
    expect(imageWidthFromAttributes("height=200 width=320")).toBe(320);
    expect(imageWidthFromAttributes("height=200")).toBeNull();
  });
});
