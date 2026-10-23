import { describe, expect, it } from "vitest";
import { searchPhrases, translate } from "../src/i18n";

describe("translate", () => {
  it("defaults to Chinese labels for the Chinese language", () => {
    expect(translate("zh-CN", "New document")).toBe("新建文档");
    expect(translate("zh-CN", "Open file")).toBe("打开文件");
    expect(translate("zh-CN", "Settings that do not exist")).toBe(
      "Settings that do not exist",
    );
  });

  it("localizes export dialog labels", () => {
    expect(translate("zh-CN", "Export document")).toBe("导出文档");
    expect(translate("zh-CN", "Export HTML")).toBe("导出 HTML");
    expect(translate("zh-CN", "Page setup")).toBe("页面设置");
    expect(translate("zh-CN", "Export with Pandoc")).toBe("使用 Pandoc 导出");
    expect(translate("zh-CN", "Pandoc export…")).toBe("Pandoc 导出…");
    expect(translate("zh-CN", "Pandoc import…")).toBe("Pandoc 导入…");
    expect(translate("zh-CN", "Load remote images")).toBe("加载远程图片");
    expect(translate("zh-CN", "Remote image cache")).toBe("远程图片缓存");
  });

  it("returns the source label for English", () => {
    expect(translate("en", "New document")).toBe("New document");
  });

  it("replaces named values", () => {
    expect(
      translate("zh-CN", "Ln {line}, Col {column}", {
        line: 12,
        column: 4,
      }),
    ).toBe("第 12 行，第 4 列");
    expect(
      translate("en", "Saved {name}", { name: "notes.md" }),
    ).toBe("Saved notes.md");
  });

  it("provides Chinese phrases for the editor search panel", () => {
    expect(searchPhrases("zh-CN").Find).toBe("查找");
    expect(searchPhrases("zh-CN")["replace all"]).toBe("全部替换");
    expect(searchPhrases("en")).toEqual({});
  });
});
