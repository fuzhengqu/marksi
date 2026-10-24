import { useCallback } from "react";
import { useAppStore } from "./store/useAppStore";
import type { Language } from "./types";

type Replacements = Record<string, string | number>;

const ZH: Record<string, string> = {
  "Open menu": "打开菜单",
  Menu: "菜单",
  "Unsaved changes": "有未保存的更改",
  "Switch to dark theme": "切换到深色主题",
  "Switch to light theme": "切换到浅色主题",
  "Dark theme": "深色主题",
  "Light theme": "浅色主题",
  Minimize: "最小化",
  Restore: "还原",
  Maximize: "最大化",
  Close: "关闭",
  Files: "文件",
  Outline: "大纲",
  Search: "搜索",
  "Sidebar panels": "侧边栏面板",
  Workspace: "工作区",
  "Refresh folder": "刷新文件夹",
  "Open a folder to keep your Markdown files close.":
    "打开一个文件夹，集中管理 Markdown 文件。",
  "Open folder": "打开文件夹",
  "Open file": "打开文件",
  "Recent files": "最近文件",
  "No recent documents yet.": "暂无最近文档。",
  "Remove from recent": "从最近文件中移除",
  "Clear recent files": "清除最近文件",
  "Recent files cleared.": "已清除最近文件。",
  "Headings appear here as you write.": "开始写作后，标题会显示在这里。",
  "Untitled heading": "无标题标题",
  "Line {line}": "第 {line} 行",
  "File tree": "文件树",
  "Open a file or folder to get started.": "打开文件或文件夹以开始使用。",
  "Search in document": "在文档中搜索",
  "Search in folder": "在文件夹中搜索",
  "Search document": "搜索文档",
  "Search folder": "搜索文件夹",
  "Search this document…": "搜索当前文档…",
  "Search every supported file…": "搜索所有支持的文档…",
  "Match case": "区分大小写",
  "No matches": "没有匹配项",
  "Search is unavailable while the document is empty.":
    "文档为空时无法搜索。",
  "Reading folder…": "正在读取文件夹…",
  "This folder has no visible files.": "此文件夹中没有可见文件。",
  "Folder expansion is available in the desktop app.":
    "文件夹展开功能仅在桌面应用中可用。",
  "Search scope": "搜索范围",
  Document: "文档",
  Folder: "文件夹",
  "Open a folder to search it": "打开文件夹后可搜索",
  "Search this folder…": "搜索此文件夹…",
  "Find in document…": "在文档中查找…",
  "Search workspace": "搜索工作区",
  "Searching folder…": "正在搜索文件夹…",
  "No matches in this folder.": "此文件夹中没有匹配项。",
  "No matches.": "没有匹配项。",
  "Search every Markdown and text file in the open folder.":
    "搜索已打开文件夹中的所有 Markdown 和文本文件。",
  "Search the current document. Use Ctrl+Shift+F to search the whole folder.":
    "搜索当前文档。使用 Ctrl+Shift+F 搜索整个文件夹。",
  "New document": "新建文档",
  "open": "打开",
  "Read only": "只读",
  "Read-only mode (Ctrl Alt R)": "只读模式 (Ctrl Alt R)",
  "Document encoding": "文档编码",
  "Line endings": "换行符",
  "decoded with replacements": "解码时存在替换字符",
  Preview: "预览",
  "Live preview": "实时预览",
  Source: "源码",
  Reading: "阅读",
  "Preview rendered document (Ctrl /)": "预览渲染后的文档 (Ctrl /)",
  "Edit Markdown source (Ctrl /)": "编辑 Markdown 源码 (Ctrl /)",
  "Switch to preview": "切换到预览",
  "Switch to source": "切换到源码",
  "{count} words": "{count} 字",
  "{count} chars": "{count} 字符",
  "Ln {line}, Col {column}": "第 {line} 行，第 {column} 列",
  File: "文件",
  Edit: "编辑",
  Format: "格式",
  View: "视图",
  Copy: "复制",
  Export: "导出",
  Help: "帮助",
  "New document…": "新建文档…",
  "Open file…": "打开文件…",
  "Open folder…": "打开文件夹…",
  "Quick open…": "快速打开…",
  "Search in folder…": "在文件夹中搜索…",
  "Close folder": "关闭文件夹",
  Save: "保存",
  "Save as…": "另存为…",
  Bold: "粗体",
  Italic: "斜体",
  Strikethrough: "删除线",
  "Inline code": "行内代码",
  Link: "链接",
  "Image…": "图片…",
  "Preview mode": "实时预览",
  "Source mode": "源码模式",
  "Reading view": "阅读视图",
  "Toggle sidebar": "切换侧边栏",
  "Dark appearance": "深色外观",
  "Light appearance": "浅色外观",
  "Focus mode": "专注模式",
  "Typewriter mode": "打字机模式",
  "Read-only mode": "只读模式",
  "Zoom in": "放大",
  "Zoom out": "缩小",
  "Actual size": "实际大小",
  "Copy as Markdown": "复制为 Markdown",
  "Copy as HTML": "复制为 HTML",
  "Copy as plain text": "复制为纯文本",
  "HTML document…": "HTML 文档…",
  "Print / Save as PDF": "打印 / 另存为 PDF",
  "Export…": "导出…",
  "Image (PNG)…": "图片 (PNG)…",
  "Pandoc export…": "Pandoc 导出…",
  "Pandoc import…": "Pandoc 导入…",
  "Imported {name}": "已导入 {name}",
  "Imported {name} with {count} embedded images.":
    "已导入 {name}，内嵌 {count} 张图片。",
  "Export with Pandoc": "使用 Pandoc 导出",
  "Convert the current Markdown with an external Pandoc.":
    "使用外部 Pandoc 转换当前 Markdown。",
  "Close Pandoc dialog": "关闭 Pandoc 对话框",
  Pandoc: "Pandoc",
  Status: "状态",
  "Checking Pandoc…": "正在检测 Pandoc…",
  "Detected: {version}": "已检测到：{version}",
  "Pandoc was not found. Set its path in Preferences.":
    "未找到 Pandoc。请在偏好设置中填写路径。",
  Ready: "可用",
  Unavailable: "不可用",
  "Pandoc error: {error}": "Pandoc 错误：{error}",
  Output: "输出",
  "Written by Pandoc, then saved atomically.":
    "由 Pandoc 写入，然后原子保存。",
  "Word document (.docx)": "Word 文档 (.docx)",
  "OpenDocument text (.odt)": "OpenDocument 文本 (.odt)",
  "EPUB book (.epub)": "EPUB 电子书 (.epub)",
  "LaTeX document (.tex)": "LaTeX 文档 (.tex)",
  "Rich Text Format (.rtf)": "RTF 富文本 (.rtf)",
  "Pandoc is not bundled. It runs as an external program and may fetch remote images referenced by the document. Save the document first if it uses relative local images.":
    "Pandoc 不会随应用打包，作为外部程序运行，可能会获取文档中引用的远程图片。如果文档使用相对本地图片，请先保存文档。",
  "Pandoc executable": "Pandoc 可执行文件",
  "Leave empty to use pandoc from PATH.":
    "留空则使用 PATH 中的 pandoc。",
  "Checking…": "检测中…",
  Detect: "检测",
  "Pandoc is not bundled. Install it separately or set its executable path.":
    "Pandoc 不会随应用打包。请单独安装或填写可执行文件路径。",
  "Pandoc is only available in the desktop app.":
    "Pandoc 仅在桌面应用中可用。",
  "The document is too long to export as a single image.":
    "文档太长，无法导出为单张图片。",
  "The reading view is not ready yet.": "阅读视图尚未准备好。",
  "The document could not be rendered as an image.":
    "无法将文档渲染为图片。",
  "Cannot read the image data.": "无法读取图片数据。",
  "Export document": "导出文档",
  "Choose a profile, metadata, and page setup.":
    "选择配置档、元数据和页面设置。",
  Profile: "配置档",
  "Export profile": "导出配置档",
  "Balanced HTML with front matter metadata and no headers or footers.":
    "均衡的 HTML，使用 front matter 元数据，不添加页眉和页脚。",
  "A4 portrait with the document title and page numbers in the margins.":
    "A4 纵向，在页边距中显示文档标题和页码。",
  "Clean HTML without front matter metadata and with narrow margins.":
    "简洁 HTML，不使用 front matter 元数据，采用窄页边距。",
  "Your own combination of metadata and page settings.":
    "自定义的元数据和页面设置组合。",
  Print: "打印",
  Minimal: "极简",
  Custom: "自定义",
  Metadata: "元数据",
  "Use front matter": "使用 front matter",
  "Read the title, author, date, and tags from YAML front matter.":
    "从 YAML front matter 读取标题、作者、日期和标签。",
  "Metadata tags": "元数据标签",
  "Add author, description, and keywords tags to the HTML head.":
    "在 HTML head 中添加作者、描述和关键词标签。",
  "Document info panel": "文档信息面板",
  "Show author, date, summary, tags, and keywords above the document.":
    "在文档上方显示作者、日期、摘要、标签和关键词。",
  "Page setup": "页面设置",
  "Paper size": "纸张大小",
  "Used when printing or saving as PDF.": "用于打印或另存为 PDF。",
  Orientation: "方向",
  "Portrait or landscape pages.": "纵向或横向页面。",
  Portrait: "纵向",
  Landscape: "横向",
  Margins: "页边距",
  "Page margins for print and PDF output.": "打印和 PDF 输出的页边距。",
  Normal: "普通",
  Narrow: "窄",
  Wide: "宽",
  Header: "页眉",
  "Optional text for the top page margin.": "顶部页边距中的可选文本。",
  Footer: "页脚",
  "Optional text for the bottom page margin.": "底部页边距中的可选文本。",
  "Header and footer tokens: {title}, {page}, {pages}. Paper size and margins apply to the exported HTML and the system print dialog; the print dialog may add its own header and footer.":
    "页眉和页脚标记：{title}、{page}、{pages}。纸张大小和页边距会应用于导出的 HTML 和系统打印对话框；打印对话框可能会添加自己的页眉和页脚。",
  "Add some content before exporting.": "请先输入内容再导出。",
  Cancel: "取消",
  "Print / PDF": "打印 / PDF",
  "Exporting…": "正在导出…",
  "Export HTML": "导出 HTML",
  "Close export dialog": "关闭导出对话框",
  "Custom export": "自定义导出",
  Program: "程序",
  "Executable to run after HTML export.":
    "导出 HTML 后运行的可执行文件。",
  Arguments: "参数",
  "One argument per line.": "每行一个参数。",
  "Placeholders: {input}, {document}, {title}. The HTML file is written first; the command runs without a shell in the exported file's folder, and a non-zero exit code is reported.":
    "占位符：{input}、{document}、{title}。会先写入 HTML 文件；命令不经过 shell，在导出文件所在文件夹中运行，非零退出代码会被报告。",
  "Configure a custom export command in Preferences first.":
    "请先在偏好设置中配置自定义导出命令。",
  "Configure a custom export command in Preferences to enable this action.":
    "在偏好设置中配置自定义导出命令后可启用此操作。",
  "Custom export completed.": "自定义导出完成。",
  "Custom export command exited with code {code}.":
    "自定义导出命令退出，代码 {code}。",
  "Custom export commands are only available in the desktop app.":
    "自定义导出命令仅适用于桌面应用。",
  "Preferences…": "偏好设置…",
  "Quit MarkSI": "退出 MarkSI",
  "About MarkSI": "关于 MarkSI",
  "MarkSI · MIT licensed": "MarkSI · MIT 许可",
  Preferences: "偏好设置",
  "Changes apply immediately and stay on this device.":
    "更改会立即生效，并只保存在本机。",
  Appearance: "外观",
  Theme: "主题",
  "Choose the writing environment.": "选择写作环境。",
  Light: "浅色",
  Dark: "深色",
  Language: "语言",
  "Interface language": "界面语言",
  "Editor text size": "编辑器字号",
  "Interface zoom": "界面缩放",
  "Scale the whole window.": "缩放整个窗口。",
  "Writing column": "写作栏宽度",
  Editor: "编辑器",
  Markdown: "Markdown",
  "Strict mode": "严格模式",
  "Require whitespace after ATX heading markers and use strict list indentation. Disable for compact headings such as ###Title and lax nested lists.":
    "要求 ATX 标题标记后必须有空格，并使用严格列表缩进。关闭后可识别 ###标题 这类紧凑标题和宽松嵌套列表。",
  "Spell check": "拼写检查",
  "Use the operating system dictionary while writing.":
    "写作时使用操作系统词典。",
  "Auto pair": "自动配对",
  "Close brackets, quotes, and Markdown markers as you type.":
    "输入时自动闭合括号、引号和 Markdown 标记。",
  "Smart punctuation": "智能标点",
  "Use curly quotes, dashes, and ellipses in prose.":
    "在正文中使用弯引号、破折号和省略号。",
  "Emoji autocomplete": "Emoji 补全",
  "Suggest emoji when you type a colon alias.":
    "输入冒号别名时提示 Emoji。",
  Writing: "写作",
  "Dim everything except the current paragraph.":
    "淡化当前段落以外的内容。",
  "Keep the line you are writing vertically centered.":
    "让正在编辑的行保持在视野中央。",
  "Block editing while keeping search, copy, export, and print available.":
    "禁止编辑，但保留搜索、复制、导出和打印。",
  Images: "图片",
  "Asset folder": "资源文件夹",
  "Relative folder for images inserted from disk, drag/drop, or paste.":
    "从磁盘插入、拖放或粘贴的图片会保存到此相对文件夹。",
  "Auto save": "自动保存",
  "Save named documents after a pause.": "暂停输入后自动保存已命名文档。",
  "Auto save delay": "自动保存延迟",
  "Reset": "重置",
  Done: "完成",
  "Quick open": "快速打开",
  "Search files and recent documents…": "搜索文件或最近文档…",
  "Search files by name or path…": "按名称或路径搜索文件…",
  "Search files": "搜索文件",
  "Loading files": "正在加载文件",
  "Open a folder to search your workspace.": "打开文件夹以搜索工作区。",
  "No matching files.": "没有匹配的文件。",
  "Type to search recent files and the open folder.":
    "输入以搜索最近文件或当前文件夹。",
  "File name": "文件名",
  recent: "最近",
  navigate: "导航",
  close: "关闭",
  "Recover draft": "恢复草稿",
  "Recover unsaved draft?": "恢复未保存的草稿？",
  "MarkSI found edits that were not written to a file before the last session ended.":
    "MarkSI 发现上次会话结束前未写入文件的编辑内容。",
  "The recovered draft is empty.": "恢复的草稿内容为空。",
  "Stored only on this device.": "仅保存在此设备上。",
  "Discard draft": "丢弃草稿",
  "Dismiss notification": "关闭通知",
  "An unsaved draft from a previous session is available.":
    "检测到上次会话留下的未保存草稿。",
  Recover: "恢复",
  Discard: "丢弃",
  "Keep editing": "继续编辑",
  "Discard changes": "丢弃更改",
  "You have unsaved changes. Discard them?": "有未保存的更改，确定要丢弃吗？",
  "Untitled": "无标题",
  "Untitled.md": "未命名.md",
  "There is nothing to export yet.": "目前没有可导出的内容。",
  "There is nothing to print yet.": "目前没有可打印的内容。",
  "There is nothing to copy yet.": "目前没有可复制的内容。",
  "Copied document as Markdown.": "已复制文档为 Markdown。",
  "Copied document as rich HTML.": "已复制文档为富文本 HTML。",
  "Copied HTML source.": "已复制 HTML 源码。",
  "Copied document as plain text.": "已复制文档为纯文本。",
  "Copied image path.": "已复制图片路径。",
  "New blank document created.": "已新建空白文档。",
  "Opening document…": "正在打开文档…",
  "Open image": "打开图片",
  "Copy image path": "复制图片路径",
  "Reveal in folder": "在文件夹中显示",
  "View image": "查看图片",
  "Image actions": "图片操作",
  "Fit: contain": "适应：包含",
  "Fit: cover": "适应：覆盖",
  "Original size": "原始尺寸",
  "Resize image": "调整图片宽度",
  "Resize image height": "调整图片高度",
  Image: "图片",
  "Rendered document": "渲染文档",
  "Could not copy image path: {error}": "无法复制图片路径：{error}",
  "Could not open image: {error}": "无法打开图片：{error}",
  "Could not reveal image: {error}": "无法在文件夹中显示图片：{error}",
  "Could not open link: {error}": "无法打开链接：{error}",
  "Local file links will open in a future milestone.":
    "本地文件链接将在后续版本中支持。",
  "Zoom out (-)": "缩小 (-)",
  "Zoom in (+)": "放大 (+)",
  "Reset zoom": "重置缩放",
  "Reset zoom (0)": "重置缩放 (0)",
  "Close image preview": "关闭图片预览",
  "Mermaid source": "Mermaid 源码",
  "Rendering diagram…": "正在渲染图表…",
  "This folder is empty.": "此文件夹为空。",
  "Read-only mode is on. Turn it off from the View menu to edit.":
    "只读模式已开启。请从“视图”菜单关闭后再编辑。",
  "Saved {name}": "已保存 {name}",
  "Exported {name}": "已导出 {name}",
  "Inserted image {name}": "已插入图片 {name}",
  "Save the document before inserting a local image.":
    "请先保存文档，再插入本地图片。",
  "Local images are available in the desktop app.":
    "本地图片功能仅在桌面应用中可用。",
  "Pasted images are available in the desktop app.":
    "粘贴图片功能仅在桌面应用中可用。",
  "This file changed on disk. Your unsaved edits are still here.":
    "文件已在磁盘上被修改，你的未保存编辑仍然保留。",
  "Reloaded changes from disk.": "已从磁盘重新加载更改。",
  "This file changed on disk. Reload it?": "文件已在磁盘上被修改，是否重新加载？",
  "File changed": "文件已更改",
  Reload: "重新加载",
  "Keep current": "保留当前内容",
  "You have unsaved changes. Close MarkSI without saving?":
    "有未保存的更改，确定不保存并关闭 MarkSI 吗？",
  "Close without saving": "不保存并关闭",
  "Drop a Markdown or text file, or a folder.":
    "拖入 Markdown、文本文件或文件夹。",
  "Local files are available in the desktop app.":
    "本地文件功能仅在桌面应用中可用。",
  "Folder workspaces are available in the desktop app.":
    "文件夹工作区仅在桌面应用中可用。",
  "Open a folder to search across files.": "打开文件夹后可跨文件搜索。",
  "Draft recovered. Review it, then save.":
    "草稿已恢复。请检查后保存。",
  "Recovered unsaved draft. Save it to a file.":
    "已恢复未保存的草稿。请保存到文件。",
  "MarkSI is an independent Markdown studio for Windows and Linux.":
    "MarkSI 是一款面向 Windows 和 Linux 的独立 Markdown 写作工具。",
  "Close about dialog": "关闭关于对话框",
  "Close preferences": "关闭偏好设置",
  "Auto pair brackets and Markdown markers": "自动配对括号和 Markdown 标记",
  "Restore default preferences": "恢复默认偏好",
  "These modes also live in the View menu. Focus, typewriter, and read-only use Ctrl Alt F, Ctrl Alt T, and Ctrl Alt R.":
    "这些模式也可以从“视图”菜单切换。专注、打字机和只读模式的快捷键分别是 Ctrl Alt F、Ctrl Alt T 和 Ctrl Alt R。",
  "Relative to the document folder.": "相对于文档所在文件夹。",
  "Image asset folder": "图片资源文件夹",
  "Image root path": "图片根路径",
  "Optional folder for /-relative images and as a fallback when an image is not next to the document.":
    "用于 / 开头图片的可选文件夹，也在图片不在文档旁边时作为回退。",
  "Use an absolute folder or a path relative to the workspace or document folder. The canonical Markdown is not changed.":
    "可使用绝对文件夹，或相对于工作区/文档文件夹的路径。不会修改规范 Markdown。",
  "Image root URL": "图片根 URL",
  "Optional web base for relative images when remote loading is enabled.":
    "启用远程加载后，用于相对图片的可选 Web 基地址。",
  "Load remote images": "加载远程图片",
  "Download remote images only after you enable this. Images are cached locally.":
    "仅在开启后下载远程图片。图片会缓存到本地。",
  "Remote image cache": "远程图片缓存",
  "Cached images stay on this device.": "缓存的图片保存在本设备上。",
  "Clear cache": "清除缓存",
  "Clearing…": "正在清除…",
  "Cleared {count} cached images.": "已清除 {count} 张缓存图片。",
  "Remote image cache is already empty.": "远程图片缓存已为空。",
  "Remote requests go directly to the image host. Localhost, private addresses, redirects, non-image responses, and files over 10 MB are blocked. MarkSI never uploads images.":
    "远程请求直接发往图片主机。会阻止 localhost、私有地址、重定向、非图片响应和超过 10 MB 的文件。MarkSI 从不上传图片。",
  "Remote images are only available in the desktop app.":
    "远程图片仅在桌面应用中可用。",
  "Inserted, dropped, and pasted images are copied into this folder. Use a relative path such as assets or media/images.":
    "插入、拖放和粘贴的图片会复制到此文件夹。请使用相对路径，例如 assets 或 media/images。",
  "Save named documents automatically after a pause.":
    "暂停输入后自动保存已命名文档。",
  "Auto-save pause": "自动保存延迟",
  "Flat file list": "扁平文件列表",
  "Show every workspace file without expanding folders.":
    "不展开文件夹，直接显示工作区中的所有文件。",
  "File actions": "文件操作",
  "Local history": "本地历史",
  "Local history…": "本地历史…",
  "Keep a capped set of snapshots when you save.":
    "保存时保留数量有限的本地快照。",
  "This document has no file yet.": "此文档尚未保存为文件。",
  "Open a saved document to view its local history.":
    "打开已保存的文档后可查看本地历史。",
  "No saved versions yet.": "尚无已保存的版本。",
  "Save the document to create a local snapshot.":
    "保存文档后会创建本地快照。",
  "Loading history…": "正在加载历史…",
  "Empty document": "空文档",
  "Choose a saved version to preview it.":
    "选择一个已保存版本进行预览。",
  "Restore this version": "恢复此版本",
  "Delete snapshot": "删除快照",
  "Snapshot deleted.": "快照已删除。",
  "Local history cleared.": "本地历史已清除。",
  "Clear all": "全部清除",
  "Confirm clear": "确认清除",
  "All saved versions for this document will be removed.":
    "将删除此文档的所有已保存版本。",
  "Snapshots stay in this app's local data folder. They are never uploaded.":
    "快照仅保存在本应用的本地数据目录中，绝不上传。",
  "Restored a saved version. Save to keep it.":
    "已恢复保存的版本；保存后才会写入文件。",
  "Read-only mode is on.": "只读模式已开启。",
  Rename: "重命名",
  Duplicate: "创建副本",
  "Move to folder…": "移动到文件夹…",
  Delete: "删除",
  "Rename file": "重命名文件",
  "Duplicate file": "创建文件副本",
  "Move file": "移动文件",
  "Delete file": "删除文件",
  "New name": "新名称",
  "Destination folder": "目标文件夹",
  "Leave empty for the workspace root": "留空表示工作区根目录",
  "Use a supported Markdown or text file extension.":
    "请使用受支持的 Markdown 或文本文件扩展名。",
  "Relative to the workspace root. Leave empty for the root.":
    "相对于工作区根目录；留空表示根目录。",
  "A copy of “{name}” will be created in the same folder.":
    "将在同一文件夹中创建“{name}”的副本。",
  "Delete “{name}”? This cannot be undone.":
    "删除“{name}”？此操作无法撤销。",
  "The open document will close and unsaved changes will be lost.":
    "当前文档将关闭，未保存的更改将丢失。",
  "The open document will close.": "当前文档将关闭。",
  "Renamed to {name}": "已重命名为 {name}",
  "Created {name}": "已创建 {name}",
  "Moved to {name}": "已移动到 {name}",
  "Deleted {name}": "已删除 {name}",
  "Create copy": "创建副本",
  Move: "移动",
  "Working…": "正在处理…",
  "Enter a file name.": "请输入文件名。",
  "File names cannot exceed 200 characters.":
    "文件名不能超过 200 个字符。",
  "File names cannot contain / or \\.": "文件名不能包含 / 或 \\。",
  'File names cannot contain control characters or < > : " | ? *.':
    '文件名不能包含控制字符或 < > : " | ? *。',
  "File names cannot end with a dot or a space.":
    "文件名不能以点或空格结尾。",
  "That file name is reserved by the operating system.":
    "该文件名被操作系统保留。",
  "Choose a folder inside the workspace.": "请选择工作区内的文件夹。",
  "How long to wait after the last edit.": "最后一次编辑后等待的时间。",
  "0.8 seconds": "0.8 秒",
  "1.5 seconds": "1.5 秒",
  "3 seconds": "3 秒",
  "5 seconds": "5 秒",
  "Unsaved drafts are always kept locally for crash recovery. MarkSI never sends document content anywhere.":
    "未保存的草稿始终保存在本机，用于崩溃恢复。MarkSI 不会把文档内容发送到任何地方。",
  "Read, search, copy, and export without editing.":
    "可阅读、搜索、复制和导出，但不能编辑。",
  "Writing column width": "写作栏宽度",
  "Version {version}": "版本 {version}",
  "A focused, local-first Markdown studio for Windows and Linux. Your words stay in plain text and on your machine.":
    "一款专注、本地优先的 Markdown 写作工具，适用于 Windows 和 Linux。文字始终以纯文本保存在你的设备上。",
  "MIT license": "MIT 许可",
  "No account": "无需账户",
  "No telemetry": "无遥测",
};

const ZH_SEARCH_PHRASES: Record<string, string> = {
  Find: "查找",
  Replace: "替换",
  next: "下一个",
  previous: "上一个",
  all: "全部",
  "match case": "区分大小写",
  regexp: "正则表达式",
  "by word": "全词匹配",
  replace: "替换",
  "replace all": "全部替换",
  close: "关闭",
  "current match": "当前匹配",
  "on line": "位于第",
  "replaced $ matches": "已替换 $ 处",
  "replaced match on line $": "已替换第 $ 行的匹配",
  "Go to line": "跳转到行",
  go: "跳转",
};

export function searchPhrases(language: Language): Record<string, string> {
  return language === "zh-CN" ? ZH_SEARCH_PHRASES : {};
}

export function translate(
  language: Language,
  text: string,
  replacements?: Replacements,
): string {
  const template = language === "zh-CN" ? ZH[text] ?? text : text;
  if (!replacements) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = replacements[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

export function useT() {
  const language = useAppStore((state) => state.settings.language);
  return useCallback(
    (text: string, replacements?: Replacements) =>
      translate(language, text, replacements),
    [language],
  );
}

export function tNow(text: string, replacements?: Replacements): string {
  return translate(
    useAppStore.getState().settings.language,
    text,
    replacements,
  );
}
