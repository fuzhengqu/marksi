# MarkSI

**面向 Windows 与 Linux 的本地优先 Markdown 编辑器。**

**简体中文** | [English](README.en.md)

MarkSI 是一个免费、开源的 Markdown 编辑器，使用 Rust 与 Tauri 构建。它提供源码、
可编辑实时预览和阅读视图，支持工作区搜索、本地图片、数学公式与 Mermaid 图表，
文档始终保存在本机。

> 早期开发中：功能和文件格式可能变化。当前尚未提供打包安装包，请从源码构建。

## 功能

- **写作视图**：源码、可编辑实时预览、阅读视图；专注、打字机、只读模式；
  自动配对、智能标点、Emoji 补全和查找替换。
- **Markdown**：CommonMark/GFM、表格、任务列表、脚注、目录、YAML front matter、
  提示块、代码高亮、KaTeX 数学公式、Mermaid 图表，以及严格/宽松的标题、嵌套
  列表、续行和引用块列表缩进。
- **文件与工作区**：打开、保存、另存为、文件夹工作区、最近文件、大纲、快速
  打开、全文搜索、可选扁平文件列表，以及工作区内文件的重命名、创建副本、
  移动和删除；保留文件编码与换行符，并在本地保留可预览和恢复的历史快照。
- **图片**：插入、拖放或粘贴；文档相对资源目录和可选根路径；灯箱预览；
  宽度、高度调整；包含/覆盖适应模式和原始尺寸重置。
- **导出与复制**：使用文档、打印、极简或自定义配置档导出独立 HTML；
  控制 front matter 元数据和页面设置；通过系统打印对话框打印或另存为 PDF；
  可选自定义导出命令（显式配置，不经过 shell）；导出为 PNG 图片；
  可选 Pandoc 导出 DOCX、ODT、EPUB、LaTeX 或 RTF，以及导入 DOCX、ODT、EPUB、
  RTF 或 HTML（不打包 Pandoc）；复制为 Markdown、HTML 或纯文本。
- **可靠性**：已命名文档可选自动保存、未保存内容恢复、外部修改提示。
- **界面**：中英文界面、内置明暗主题、界面缩放。
- **隐私**：无账户、无遥测；文档保留在本机；原始 HTML 不会作为活动内容执行；
  远程图片默认不加载，开启后按需缓存到本机，可随时清除；不上传图片。

## 系统要求

- **运行**：Windows 11（WebView2），或 Linux（WebKitGTK 4.1）。
- **构建**：Node.js 22.12+、npm、Rust stable。Windows 需要 Visual Studio 2022
  Build Tools 的“使用 C++ 的桌面开发”工作负载和 Windows SDK；Linux 需要 Tauri
  的常见依赖。

## 安装与运行

当前仅提供源码构建：

```bash
npm install
npm run tauri:dev
```

构建发布版：

```bash
npm run tauri:build
```

## 开发

运行 `npm test` 执行单元测试。较大的改动请先开 issue 讨论；完整检查流程见
[CONTRIBUTING.md](CONTRIBUTING.md)。

## 贡献

欢迎提交 issue 和 pull request：
[Issues](https://github.com/fuzhengqu/marksi/issues)。

## 安全

请通过 [GitHub Security Advisories](https://github.com/fuzhengqu/marksi/security/advisories/new)
私下报告安全问题，不要在公开 issue 中披露敏感细节。详见
[SECURITY.md](SECURITY.md)。

## 许可证

MIT。见 [LICENSE](LICENSE) 与 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

仓库：<https://github.com/fuzhengqu/marksi>
