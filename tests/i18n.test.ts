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
    expect(translate("zh-CN", "Image root path")).toBe("图片根路径");
    expect(translate("zh-CN", "Image root URL")).toBe("图片根 URL");
    expect(translate("zh-CN", "Flat file list")).toBe("扁平文件列表");
    expect(translate("zh-CN", "File actions")).toBe("文件操作");
    expect(translate("zh-CN", "Local history")).toBe("本地历史");
    expect(translate("zh-CN", "Pinned")).toBe("已固定");
    expect(translate("zh-CN", "Reopen with encoding")).toBe("按编码重新打开");
    expect(translate("zh-CN", "Large file mode")).toBe("大文件模式");
    expect(translate("zh-CN", "System")).toBe("跟随系统");
    expect(translate("zh-CN", "Sepia")).toBe("柔和棕褐");
    expect(translate("zh-CN", "High contrast")).toBe("高对比度");
    expect(translate("zh-CN", "Keyboard shortcuts")).toBe("快捷键");
    expect(translate("zh-CN", "Toggle fullscreen")).toBe("切换全屏");
    expect(translate("zh-CN", "Remember window size and position")).toBe(
      "记住窗口大小和位置",
    );
    expect(translate("zh-CN", "Restore last session")).toBe("恢复上次会话");
    expect(translate("zh-CN", "Advanced")).toBe("高级");
    expect(translate("zh-CN", "Apply JSON")).toBe("应用 JSON");
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
