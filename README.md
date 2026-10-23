# MarkSI

**面向 Windows 与 Linux 的专注型 Markdown 写作工具。**

**简体中文** | [English](README.en.md)

MarkSI 是一个免费、开源的 Markdown 编辑器，使用 Rust 与 Tauri 构建。它围绕
安静的单文档写作体验设计：简洁标题栏、可折叠的文件/大纲/搜索侧边栏、居中的
源码编辑区，以及克制的状态栏。

> 状态：MVP。M1 和 M3 已完成；M2 核心与 M4 核心可用，M4 仍有 6 个文件/工作区
> 技术债，M5 进行中，M6/M7 尚未开始。里程碑范围、优先级和退出标准见
> [`docs/roadmap.md`](docs/roadmap.md)，详细功能清单见
> [`docs/feature-parity.md`](docs/feature-parity.md)。桌面外壳、源码编辑器、
> 可编辑实时预览、阅读视图、中英文界面、文件打开/保存、编码感知 IO、工作区
> 浏览、大纲、搜索、主题、扩展 Markdown、Mermaid 图表、本地图片资源、图片
> 尺寸调整、格式化命令、查找替换、HTML/PDF 导出、写作模式、智能输入、界面
> 缩放、文档复制操作、偏好设置、快速打开、工作区全文搜索、自动保存、崩溃
> 恢复和外部修改检测均已实现。

## 版本号

产品显示版本从 **0.01** 开始；每次 bug 修复或功能发布只递增一步：
`0.02`、`0.03`，依此类推，不得跳号。npm、Cargo 和 Tauri 要求 semver，
因此技术版本 `0.1.0` 对应产品版本 `0.01`，`0.2.0` 对应 `0.02`；关于对话框
显示产品版本。

发布前运行：

```bash
npm run version:bump
```

该命令会把所有清单版本只递增一步，并拒绝异常的版本状态。发布审计也会拦截
版本文件不一致或跳号。

## 设计原则

- **Markdown 是唯一事实来源。** MarkSI 不会通过有损富文本序列化器重写文档。
- **免费开源。** MIT 许可，无激活、无账户、无遥测、无付费功能限制。
- **本地优先。** 文件留在本机。只有在用户明确操作（例如打开链接或下载图片）
  时才会使用网络。
- **默认安静。** 界面让位于内容；窗口装饰最少，并优先支持键盘操作。

## 技术栈

- [Tauri 2](https://tauri.app/) —— Rust 应用外壳
- [React 19](https://react.dev/) + TypeScript + Vite
- [CodeMirror 6](https://codemirror.net/) —— 编辑器基础
- [markdown-it](https://github.com/markdown-it/markdown-it) +
  [DOMPurify](https://github.com/cure53/DOMPurify) —— 安全渲染 Markdown
- [markdown-it-attrs](https://github.com/arve0/markdown-it-attrs) —— 受限的图片尺寸属性
- [KaTeX](https://katex.org/) —— 行内与块级数学公式
- [Mermaid](https://mermaid.js.org/) —— 在预览和导出中按需加载的图表
- [highlight.js](https://highlightjs.org/) —— 精选代码高亮
- Rust 核心负责文件 IO、编码检测和平台集成

## 已实现功能

M1 建立桌面基础：

- 原生打开、保存、另存为、打开文件夹和最近文件流程。
- UTF-8、UTF-16 及旧编码检测，保留 BOM 和 CRLF/LF 行尾。
- 原子保存，写入失败不会截断原文件。
- CodeMirror 6 Markdown 源码编辑、语法高亮、自动换行、撤销/重做、括号匹配
  和编辑器内搜索。
- 文件树、文档大纲导航、文档内搜索和最近文件。
- 原创的明暗主题、自定义标题栏、窗口控件和未保存修改关闭保护。
- 浏览器预览回退（原生文件系统功能需要 Tauri）。

M2 增加阅读与格式化工作流：

- 源码、可编辑实时预览和阅读视图。打开文档和新建空白文档默认进入可编辑实时
  预览；`Ctrl+/` 或状态栏可切换源码与实时预览，视图 > 阅读视图打开完整渲染的
  只读界面。切换模式不会丢失 CodeMirror 文档和撤销历史。
- 实时预览保持 CodeMirror 文档可编辑，同时隐藏非活动行的格式标记。当前活动行
  显示 Markdown 源码，图片、链接和强调仍基于同一份规范文本。
- 安全的 CommonMark/GFM 渲染，支持表格、任务列表、删除线、自动链接、标题锚点
  和按需加载的常见语言代码高亮。
- 通过快捷键和应用菜单设置粗体、斜体、删除线、行内代码、链接和标题级别。
- `Ctrl+F` / `Ctrl+H` 源码查找替换。
- 使用同一安全渲染器的独立 HTML 导出，以及通过系统打印对话框打印/另存为 PDF。
- 明暗主题和窄窗口下的自动布局及打印样式。

M3 增加工作区与可靠性层：

- 偏好设置支持语言、主题、编辑器字号、写作栏宽度、拼写检查、可选自动保存和
  自动保存延迟。偏好设置保存在本地并立即生效。
- 默认界面语言为中文（`zh-CN`），可在 偏好设置 > 外观 中切换英文。选择会立即
  应用到窗口、菜单、对话框、状态栏和编辑器搜索面板。
- 快速打开（`Ctrl+P`）覆盖最近文件和当前工作区，支持模糊排序、路径上下文和
  方向键导航。
- 工作区全文搜索，支持大小写匹配、行/列结果、匹配预览和按行打开。Rust 索引器
  会跳过隐藏目录、依赖/构建输出和常见版本控制目录。
- 命名文档可选自动保存，默认关闭。未保存工作始终镜像到本地恢复草稿；异常退出
  后，MarkSI 会在下次启动时提供恢复或丢弃选项。
- 通过轻量修改时间轮询检测外部修改。干净文档自动重新加载；有未保存修改的文档
  显示冲突提示，并保留本地编辑。
- 源码编辑器拼写检查控制。
- 工作区索引、搜索和修改时间查询在 Rust 中运行，而不是扫描 WebView。

M4 增加本地图片工作流：

- 使用 `Ctrl+Shift+I` 或应用菜单插入磁盘图片。文件会以安全命名复制到相对文档
  的资源文件夹。
- 将图片文件拖放到窗口，或从剪贴板粘贴图片；两种流程共用同一资源管线。
- 在 偏好设置 > 图片 中配置资源文件夹。绝对路径和跳出文档目录的路径会被拒绝。
- 预览本地 PNG、JPEG、GIF、WebP、BMP、SVG、AVIF 和 ICO 图片，单文件最大 25 MB。
  Rust 读取资源并将数据 URL 提供给 WebView。
- 点击渲染图片打开灯箱。使用工具栏、`+`、`-` 和 `0` 在 50%–400% 间缩放；
  `Esc` 关闭。
- 缺失的本地图片和远程图片在预览中显示带标签的占位符。HTML 导出保留相对资源
  路径和远程 URL。

M4 还增加扩展 Markdown：

- 支持 `[^label]` 脚注、行内 `^[note]` 注释、重复引用和返回链接。
- `[TOC]` 根据文档标题生成带链接的目录块。标题会获得稳定、去重的锚点。
- 文档顶部的 YAML front matter 会从预览中隐藏，其 `title`、`author`、
  `description`、`keywords` 和 `tags` 会成为独立 HTML 导出的元数据。
- GitHub 风格提示块（`> [!NOTE]`、`TIP`、`IMPORTANT`、`WARNING`、`CAUTION`）
  渲染为带标签的提示。
- `==高亮==`、`~下标~` 和 `^上标^` 使用主题感知样式。
- 行内 `$...$` 和块级 `$$...$$` 数学公式通过 KaTeX 渲染。预览使用 KaTeX HTML
  和内置字体；HTML 导出使用 MathML，因此导出文件不依赖本地字体资源。
- `[label]: https://example.com` 形式的链接引用定义可在文档内复用。
- 严格模式默认开启，要求 ATX 标题标记后必须有空格。关闭后可识别 `###标题`
  这类紧凑标题；围栏代码、front matter 和源文本不会被改写。

M4 还增加写作模式和文档复制操作：

- 专注模式淡化当前段落之外的内容，打字机模式让当前编辑行保持在垂直中心。
  两者均可从视图菜单和偏好设置启用。
- 只读模式阻止编辑、格式化和图片插入，同时保留选择、搜索、复制、导出和打印。
  状态栏显示只读徽标。
- 从编辑菜单或快捷键将整篇文档复制为 Markdown、富文本 HTML 或纯文本。
  Markdown 保留源码（仅做平台换行规范化）；HTML 来自同一安全渲染器并包含
  MathML；纯文本保留标题、段落、列表、表格、任务状态和代码。
- 写作模式偏好设置在本地持久化。快捷键：`Ctrl+Alt+F` 专注、`Ctrl+Alt+T`
  打字机、`Ctrl+Alt+R` 只读、`Ctrl+Alt+C` Markdown、`Ctrl+Alt+H` HTML、
  `Ctrl+Alt+P` 纯文本。

M4 还增加输入辅助和界面缩放：

- 自动配对括号、引号和 Markdown 强调标记。再次输入同一标记会把单个配对提升为
  双标记；在已有闭合标记前输入时会越过闭合标记而不是重复输入。行首块级语法
  保持原样，便于输入列表、分隔线、代码围栏和 front matter。可在偏好设置中关闭。
- 可选智能标点在默认关闭，启用后会把引号、撇号、双/三连字符和三个点转换为
  弯引号、短/长破折号和省略号。它会跳过代码、链接目标与标题、YAML front
  matter 和行首 Markdown 语法。
- Emoji 自动补全在输入 `:短代码:` 后建议常见别名并直接插入 Unicode Emoji。
  它不依赖第三方库，不改变渲染器，可在偏好设置中关闭。
- 界面缩放支持 `Ctrl+=`、`Ctrl+-`、`Ctrl+0`、视图菜单或 偏好设置 > 外观，
  范围为 80%–160%。缩放级别跨启动保留。

界面和写作流程还包括：

- IDEA 风格菜单栏。汉堡按钮在自身位置展开 File、Edit、Format、View 和 Help；
  File 取代汉堡位置，其他类别向右排列。点击类别打开下拉菜单，在菜单栏移动时
  切换类别；点击空白处关闭并恢复汉堡按钮。导出、偏好设置和退出位于 File 菜单。
- 空工作区在最近文件上方显示打开文件、打开文件夹、快速打开和新建文档四个操作。
  底部操作行已移除。
- 最近文件行仅在悬停或键盘聚焦时显示删除按钮；只删除该条目。File > 清除最近
  文件会清空整个列表，并保留空状态文案。
- MarkSI 启动后直接进入可编辑实时预览，不显示全屏欢迎页；空白文档保留编辑器
  提示，可立即开始输入。
- 新建文档会清空编辑器、聚焦空白编辑器，并显示确认 toast，使状态转换清晰可见。
- 中文优先界面，可切换英文；实时预览保持 Markdown 源码唯一事实来源。
- 新建文档保存对话框默认使用文档一级标题作为文件名；没有一级标题时保留
  `未命名.md` / `Untitled.md`。已命名文档另存为时保留当前文件名。

M5 从 Mermaid 图表开始：

- 带 `mermaid` 语言的围栏代码块在预览中渲染为图表。图表库首次使用时才按需
  加载，不含图表的文档不会承担启动成本。
- 图表跟随明暗主题，在外观变化时重新渲染。每个图表下方有默认折叠的源码区域，
  保留围栏源码。
- 语法错误显示简洁错误并展开源码，不会破坏预览其他部分。
- 独立 HTML 导出、富 HTML 复制和打印保留渲染后的图表。纯文本复制保留 Mermaid
  源码。
- Mermaid 使用严格安全设置，禁用 HTML 标签，并限制文本和边数量。SVG 输出在
  插入前还会经过专用 SVG 配置清理；脚本和 foreignObject 会被拒绝。

M5 还增加图片上下文操作：

- 右键已加载的本地图片，可查看大图、复制绝对路径、用默认应用打开，或在系统文件
  管理器中显示。
- 菜单始终位于窗口内，并在点击外部、Escape、滚动或调整窗口大小时关闭；占位符
  和远程图片不会打开菜单。
- 本地图片操作使用解析后的资源路径；粘贴的数据 URL 图片只保留灯箱操作。

M5 还增加图片尺寸调整：

- 图片尺寸使用规范 Markdown 形式 `![alt](image.png){width=320 height=180}`。
  宽度和高度限制为 24–1600 px；仅设置宽度时保持原始宽高比。
- 在阅读视图中悬停或聚焦已加载图片会显示宽度和高度手柄。水平拖拽或使用
  左/右方向键调整宽度；垂直拖拽或使用上/下方向键调整高度。手势结束时才写入
  源码，并作为单个可撤销编辑器事务提交。
- 只读模式禁用调整；脚注图片不显示手柄；无法唯一确定源码图片时拒绝修改。
  围栏代码、行内代码、YAML front matter 和引用定义不会使目标图片错位。
- HTML 导出、富文本剪贴板 HTML 和打印保留宽度与高度属性。

原始 HTML 始终被转义并保持惰性，不安全 URL 会被拒绝，预览渲染器不会主动请求
远程图片。数学渲染禁用 KaTeX 的 trust 和 HTML 扩展。Mermaid 使用严格安全设置、
禁用 HTML 标签、限制输入，并执行第二轮 SVG 清理。剪贴板 HTML 来自同一安全渲染
管线。草稿恢复快照保存在 WebView `localStorage`，不会传输文档内容。

## 开发

### 环境要求

- Node.js 22.12+ 和 npm
- Rust stable（Windows 使用 MSVC 工具链）
- Windows：Visual Studio 2022 Build Tools，安装 **Desktop development with C++**
  工作负载和 Windows SDK
- Linux：WebKitGTK 4.1 以及 Tauri 常见 Linux 依赖

### 运行

```bash
npm install
npm run tauri:dev
```

仅在浏览器中调试界面：

```bash
npm run dev
```

浏览器构建会回退到本地文件选择器；原生对话框和文件系统集成需要 Tauri。

### 构建

```bash
npm run tauri:build
```

### 检查

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run audit:public
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

`npm run test:e2e` 需要启用远程调试的桌面开发应用。完整门禁、覆盖矩阵和原生
对话框限制记录在 [`docs/verification.md`](docs/verification.md)。

针对运行中的桌面 WebView 检查界面时，使用
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222` 启动应用，
然后运行 `node scripts/cdp-eval.mjs "<expression>"` 或
`node scripts/cdp-screenshot.mjs <output.png>`。如果 9222 端口不可用，可选择
其他端口并通过 `MARKSI_CDP_PORT=9223` 告知辅助脚本。这些辅助脚本仅用于开发，
不会进入打包应用。

## 发布审计

每次推送公开仓库前运行：

```bash
npm run audit:public
```

审计会扫描工作树、所有可达 Git 提交和提交信息，检查凭据与令牌、私钥标记、
本地用户路径、禁止的品牌/复制措辞、被跟踪的密钥文件，以及 copyleft 依赖。
它还会确认中英文 README 存在，并确认项目许可证文件存在。

每个本地仓库只需启用一次钩子，让本地推送执行相同检查：

```bash
git config core.hooksPath .githooks
```

GitHub Actions 也会在每次 push 和 pull request 时执行该审计。

## 项目结构

```text
src/                 React 应用
src/components/      外壳、侧边栏、编辑器、状态栏、对话框
src/editor/          CodeMirror 配置、主题、Markdown 辅助
src/lib/             Tauri 与浏览器平台适配层
src/store/           应用状态
src-tauri/           Rust/Tauri 应用
docs/                产品与工程说明
```

## 安全与发布卫生

仓库不提交账户凭据、API Key、私钥、本地用户路径、构建产物或依赖目录。公开审计
是发布验证门禁，不表示任意源代码不存在漏洞。发现安全问题时，请私下联系仓库
所有者，不要在公开 issue 中披露敏感细节。

## 许可证

MIT。见 [LICENSE](LICENSE)。

MarkSI 是独立项目，与任何其他编辑器无隶属关系。第三方依赖保留各自许可证。
仓库不包含第三方专有源代码、主题、图标、翻译或品牌资源。
