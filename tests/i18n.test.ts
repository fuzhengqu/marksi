import { describe, expect, it } from "vitest";
import { normalizeLanguage } from "../src/lib/language";
import { searchPhrases, translate } from "../src/i18n";

describe("translate", () => {
  it("defaults to Simplified Chinese labels", () => {
    expect(translate("zh-Hans", "New document")).toBe("新建文档");
    expect(translate("zh-Hans", "Open file")).toBe("打开文件");
    expect(translate("zh-Hans", "Settings that do not exist")).toBe(
      "Settings that do not exist",
    );
  });

  it("localizes export dialog labels", () => {
    expect(translate("zh-Hans", "Export document")).toBe("导出文档");
    expect(translate("zh-Hans", "Export HTML")).toBe("导出 HTML");
    expect(translate("zh-Hans", "Page setup")).toBe("页面设置");
    expect(translate("zh-Hans", "Export with Pandoc")).toBe(
      "使用 Pandoc 导出",
    );
    expect(translate("zh-Hans", "Pandoc export…")).toBe("Pandoc 导出…");
    expect(translate("zh-Hans", "Pandoc import…")).toBe("Pandoc 导入…");
    expect(translate("zh-Hans", "Load remote images")).toBe("加载远程图片");
    expect(translate("zh-Hans", "Remote image cache")).toBe("远程图片缓存");
    expect(translate("zh-Hans", "Image root path")).toBe("图片根路径");
    expect(translate("zh-Hans", "Image root URL")).toBe("图片根 URL");
    expect(translate("zh-Hans", "Flat file list")).toBe("扁平文件列表");
    expect(translate("zh-Hans", "File actions")).toBe("文件操作");
    expect(translate("zh-Hans", "Local history")).toBe("本地历史");
    expect(translate("zh-Hans", "Pinned")).toBe("已固定");
    expect(translate("zh-Hans", "Reopen with encoding")).toBe(
      "按编码重新打开",
    );
    expect(translate("zh-Hans", "Large file mode")).toBe("大文件模式");
    expect(translate("zh-Hans", "System")).toBe("跟随系统");
    expect(translate("zh-Hans", "Sepia")).toBe("柔和棕褐");
    expect(translate("zh-Hans", "High contrast")).toBe("高对比度");
    expect(translate("zh-Hans", "Keyboard shortcuts")).toBe("快捷键");
    expect(translate("zh-Hans", "Toggle fullscreen")).toBe("切换全屏");
    expect(translate("zh-Hans", "Remember window size and position")).toBe(
      "记住窗口大小和位置",
    );
    expect(translate("zh-Hans", "Restore last session")).toBe(
      "恢复上次会话",
    );
    expect(translate("zh-Hans", "Advanced")).toBe("高级");
    expect(translate("zh-Hans", "Apply JSON")).toBe("应用 JSON");
    expect(translate("zh-Hans", "Skip to editor")).toBe("跳到编辑器");
    expect(translate("zh-Hans", "Third-party notices")).toBe(
      "第三方许可声明",
    );
    expect(translate("zh-Hans", "Native title bar")).toBe("原生标题栏");
    expect(translate("zh-Hans", "Text direction")).toBe("文本方向");
    expect(translate("zh-Hans", "Right to left")).toBe("从右到左");
    expect(translate("zh-Hans", "Render reading view")).toBe(
      "渲染阅读视图",
    );
    expect(translate("zh-Hans", "New window")).toBe("新建窗口");
    expect(translate("zh-Hans", "Custom CSS theme")).toBe(
      "自定义 CSS 主题",
    );
  });

  it("translates Taiwan Traditional Chinese labels", () => {
    expect(translate("zh-Hant", "New document")).toBe("新增文件");
    expect(translate("zh-Hant", "Open file")).toBe("開啟檔案");
    expect(translate("zh-Hant", "Preferences")).toBe("偏好設定");
    expect(translate("zh-Hant", "Render reading view")).toBe(
      "渲染閱讀檢視",
    );
    expect(translate("zh-Hant", "Line endings")).toBe("換行字元");
    expect(translate("zh-Hant", "High contrast")).toBe("高對比");
    expect(translate("zh-Hant", "Advanced")).toBe("進階");
  });

  it("falls back from Traditional to Simplified Chinese before the source", () => {
    expect(
      translate("zh-Hant", "Text that has no translation"),
    ).toBe("Text that has no translation");
  });

  it("localizes live-preview labels", () => {
    expect(translate("zh-Hans", "Table")).toBe("表格");
    expect(translate("zh-Hant", "Table")).toBe("表格");
    expect(translate("zh-Hans", "Front matter")).toBe("文档信息");
    expect(translate("zh-Hant", "Front matter")).toBe("文件資訊");
    expect(translate("zh-Hans", "Math")).toBe("数学公式");
    expect(translate("zh-Hant", "Math")).toBe("數學公式");
    expect(translate("zh-Hans", "Mermaid diagram")).toBe("Mermaid 图表");
    expect(translate("zh-Hant", "Mermaid diagram")).toBe("Mermaid 圖表");
    expect(translate("zh-Hans", "Footnote")).toBe("脚注");
    expect(translate("zh-Hant", "Footnote")).toBe("腳註");
    expect(translate("zh-Hans", "Copy code")).toBe("复制代码");
    expect(translate("zh-Hant", "Copy code")).toBe("複製程式碼");
    expect(translate("zh-Hans", "Copied")).toBe("已复制");
    expect(translate("zh-Hant", "Copied")).toBe("已複製");
    expect(translate("zh-Hans", "Copy source")).toBe("复制源码");
    expect(translate("zh-Hant", "Copy source")).toBe("複製原始碼");
    expect(translate("zh-Hans", "Mermaid source")).toBe("Mermaid 源码");
    expect(translate("zh-Hant", "Mermaid source")).toBe("Mermaid 原始碼");
    expect(translate("zh-Hans", "Render raw HTML")).toBe("渲染原始 HTML");
    expect(translate("zh-Hant", "Render raw HTML")).toBe("渲染原始 HTML");
  });

  it("returns the source label for English", () => {
    expect(translate("en", "New document")).toBe("New document");
  });

  it("replaces named values", () => {
    expect(
      translate("zh-Hans", "Ln {line}, Col {column}", {
        line: 12,
        column: 4,
      }),
    ).toBe("第 12 行，第 4 列");
    expect(translate("en", "Saved {name}", { name: "notes.md" })).toBe(
      "Saved notes.md",
    );
    expect(translate("en", "Saved {name}")).toBe("Saved {name}");
  });

  it("accepts legacy language tags at runtime", () => {
    expect(translate("zh-CN" as never, "New document")).toBe("新建文档");
    expect(translate("zh-TW" as never, "New document")).toBe("新增文件");
  });

  it("provides Chinese phrases for the editor search panel", () => {
    expect(searchPhrases("zh-Hans").Find).toBe("查找");
    expect(searchPhrases("zh-Hans")["replace all"]).toBe("全部替换");
    expect(searchPhrases("zh-Hant").Find).toBe("尋找");
    expect(searchPhrases("zh-Hant")["replace all"]).toBe("全部取代");
    expect(searchPhrases("zh-Hant")["by word"]).toBe("全字比對");
    expect(searchPhrases("en")).toEqual({});
  });
});

describe("normalizeLanguage", () => {
  it("maps legacy and regional tags to supported languages", () => {
    expect(normalizeLanguage("zh-CN")).toBe("zh-Hans");
    expect(normalizeLanguage("zh-Hans")).toBe("zh-Hans");
    expect(normalizeLanguage("zh-Hant")).toBe("zh-Hant");
    expect(normalizeLanguage("zh-TW")).toBe("zh-Hant");
    expect(normalizeLanguage("zh-HK")).toBe("zh-Hant");
    expect(normalizeLanguage("zh-Hant-TW")).toBe("zh-Hant");
    expect(normalizeLanguage("en")).toBe("en");
    expect(normalizeLanguage("en-US")).toBe("en");
    expect(normalizeLanguage("zh_CN")).toBe("zh-Hans");
  });

  it("rejects unsupported values", () => {
    expect(normalizeLanguage("fr")).toBeNull();
    expect(normalizeLanguage("")).toBeNull();
    expect(normalizeLanguage(undefined)).toBeNull();
    expect(normalizeLanguage(42)).toBeNull();
  });
});
