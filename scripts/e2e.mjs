import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const port = process.env.MARKSI_CDP_PORT ?? "9222";
const origin = process.env.MARKSI_E2E_ORIGIN ?? "localhost:1420";
const fixtureDir = resolve(".tmp/e2e-fixtures");
const markdownFixture = resolve(fixtureDir, "fixture.md");
const imageFixture = resolve(fixtureDir, "icon.png");
const pandocExecutable = resolve(
  ".tmp/pandoc/portable/pandoc-3.12.1/pandoc.exe",
);
const fixtureMarkdown = [
  "# 标题",
  "",
  "**粗体** 和 *斜体*，[链接](https://example.com)，`代码`。",
  "",
  "普通段落。",
].join("\n");

const results = [];
let socket;
let pending = new Map();
let sequence = 0;

function pass(message) {
  results.push({ ok: true, message });
  console.log(`PASS  ${message}`);
}

function fail(message, error) {
  results.push({ ok: false, message, error: String(error) });
  console.error(`FAIL  ${message}`);
  console.error(`      ${String(error).replace(/\n/g, "\n      ")}`);
}

function assert(condition, message, detail) {
  if (!condition) {
    throw new Error(detail === undefined ? message : `${message}: ${JSON.stringify(detail)}`);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect() {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = targets.find(
    (target) => target.type === "page" && target.url.includes(origin),
  );
  if (!page) {
    throw new Error(
      `No MarkSI page at ${origin} on CDP port ${port}. Start the dev app and retry.`,
    );
  }

  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", rejectOpen, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id || !pending.has(message.id)) {
      return;
    }
    const { resolve: resolveMessage, reject: rejectMessage } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      rejectMessage(new Error(JSON.stringify(message.error)));
    } else {
      resolveMessage(message.result);
    }
  });

  await send("Page.bringToFront").catch(() => {});
  await send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(
    () => {},
  );
}

function send(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolveMessage, rejectMessage) => {
    pending.set(id, { resolve: resolveMessage, reject: rejectMessage });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      `${result.exceptionDetails.text}\n${result.exceptionDetails.exception?.description ?? ""}`,
    );
  }
  return result.result?.value;
}

async function waitFor(expression, timeout = 12_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await evaluate(`Boolean(${expression})`);
    if (value) {
      return true;
    }
    await sleep(180);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function waitForFile(path, exists = true, timeout = 8_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (existsSync(path) === exists) {
      return true;
    }
    await sleep(120);
  }
  throw new Error(
    `Timed out waiting for ${path} to ${exists ? "exist" : "disappear"}`,
  );
}

async function screenshot(name) {
  try {
    await mkdir(resolve(".tmp"), { recursive: true });
    const result = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
      fromSurface: true,
    });
    await writeFile(
      resolve(".tmp", `e2e-failure-${name}.png`),
      Buffer.from(result.data, "base64"),
    );
  } catch {
    // The failure report is more important than the screenshot.
  }
}

async function test(name, run) {
  try {
    await run();
    pass(name);
  } catch (error) {
    fail(name, error);
    await screenshot(name.replace(/[^a-z0-9]+/gi, "-"));
  }
}

async function clickPoint(x, y, button = "left") {
  const params = {
    x,
    y,
    button,
    clickCount: 1,
  };
  await send("Input.dispatchMouseEvent", { type: "mousePressed", ...params });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", ...params });
  await sleep(180);
}

async function clickSelector(selector, offset = 0.5) {
  const point = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return { x: box.left + box.width * ${offset}, y: box.top + box.height / 2 };
  })()`);
  if (!point) {
    throw new Error(`Element not found: ${selector}`);
  }
  await clickPoint(point.x, point.y);
}

async function typeText(text) {
  await send("Input.insertText", { text });
  await sleep(70);
}

async function typeChars(text) {
  for (const character of text) {
    await typeText(character);
  }
}

async function keyWithCtrl(key, code, keyCode) {
  const params = {
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
    modifiers: 2,
  };
  await send("Input.dispatchKeyEvent", { type: "keyDown", ...params });
  await send("Input.dispatchKeyEvent", { type: "keyUp", ...params });
  await sleep(220);
}

async function press(key, code, keyCode) {
  const params = {
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  };
  await send("Input.dispatchKeyEvent", { type: "keyDown", ...params });
  await send("Input.dispatchKeyEvent", { type: "keyUp", ...params });
  await sleep(220);
}

async function resetBase({ clearContent = true } = {}) {
  await evaluate(`(async () => {
    const dev = window.__MARKSI_DEV__;
    dev.getState().setMenuOpen(false);
    dev.getState().setSettingsOpen(false);
    dev.closeExport?.();
    dev.closePandoc?.();
    dev.getState().setQuickOpen(false);
    dev.getState().setTheme("light");
    dev.getState().setViewMode("preview");
    dev.getState().resetSettings();
    ${clearContent ? "dev.getState().newDocument();" : ""}
    await new Promise((resolve) => setTimeout(resolve, 180));
    document.querySelector(".cm-content")?.focus();
  })()`);
  await sleep(220);
}

async function reloadApp() {
  await resetBase();
  await evaluate('localStorage.removeItem("marksi-recovery-draft")');
  await send("Page.reload", { ignoreCache: false });
  await waitFor("Boolean(window.__MARKSI_DEV__)", 15_000);
  await send("Page.bringToFront").catch(() => {});
  await waitFor('document.querySelector(".cm-content")', 10_000);
  await sleep(350);
}

async function openFixture() {
  await evaluate(
    `window.__MARKSI_DEV__.openPath(${JSON.stringify(markdownFixture)})`,
  );
  await waitFor(
    'window.__MARKSI_DEV__.getState().doc.path === ' +
      JSON.stringify(markdownFixture),
    10_000,
  );
  await sleep(300);
}

async function main() {
  await mkdir(fixtureDir, { recursive: true });
  await writeFile(markdownFixture, fixtureMarkdown, "utf8");
  await copyFile(
    resolve("src-tauri/icons/32x32.png"),
    imageFixture,
  );

  await connect();
  await reloadApp();

  await test("boots directly into the editor with its empty prompt", async () => {
    const state = await evaluate(`({
      language: document.documentElement.lang,
      viewMode: window.__MARKSI_DEV__.getState().viewMode,
      name: document.querySelector(".document-title")?.textContent,
      welcome: Boolean(document.querySelector(".welcome")),
      live: Boolean(document.querySelector(".cm-live-preview")),
      placeholder: document.querySelector(".cm-placeholder")?.textContent ?? null,
      focused: document.activeElement?.classList.contains("cm-content") ?? false,
      tabs: Array.from(document.querySelectorAll(".sidebar-tab span")).map((node) => node.textContent)
    })`);
    assert(state.language === "zh-CN", "html lang should be zh-CN", state);
    assert(state.viewMode === "preview", "default view should be preview", state);
    assert(state.name === "未命名.md", "default name should be Chinese", state);
    assert(!state.welcome, "welcome overlay must not be shown", state);
    assert(state.live, "live preview should be mounted", state);
    assert(
      state.placeholder?.includes("开始写作"),
      "empty editor prompt should remain visible",
      state,
    );
    assert(state.focused, "editor should be focused on startup", state);
    assert(
      JSON.stringify(state.tabs) === JSON.stringify(["文件", "大纲", "搜索"]),
      "sidebar tabs should be Chinese",
      state,
    );
  });

  await test("sidebar has four workspace actions and no footer", async () => {
    const state = await evaluate(`({
      actions: Array.from(document.querySelectorAll(".workspace-empty-actions button")).map((node) => node.textContent?.trim()),
      footer: Boolean(document.querySelector(".sidebar-footer"))
    })`);
    assert(
      JSON.stringify(state.actions) ===
        JSON.stringify(["打开文件", "打开文件夹", "快速打开", "新建文档"]),
      "workspace actions are wrong",
      state,
    );
    assert(!state.footer, "sidebar footer must not exist", state);
  });

  await test("compact menu replaces the hamburger and restores it on blank click", async () => {
    await clickSelector(".menu-button");
    const opened = await evaluate(`(() => {
      const button = document.querySelector(".menu-button");
      const bar = document.querySelector(".menu-bar");
      return {
        menuOpen: window.__MARKSI_DEV__.getState().menuOpen,
        hamburger: getComputedStyle(button).visibility,
        bar: Boolean(bar),
        barLeft: bar?.getBoundingClientRect().left,
        labels: Array.from(document.querySelectorAll(".menu-bar-item")).map((node) => node.textContent),
        dropdown: Boolean(document.querySelector(".menu-dropdown"))
      };
    })()`);
    assert(opened.menuOpen, "menu should be open", opened);
    assert(opened.hamburger === "hidden", "hamburger should be hidden", opened);
    assert(opened.bar, "menu bar should be visible", opened);
    assert(opened.barLeft === 8, "menu bar should start at the left", opened);
    assert(!opened.dropdown, "dropdown should be closed initially", opened);
    assert(
      JSON.stringify(opened.labels) ===
        JSON.stringify(["文件", "编辑", "格式", "视图", "帮助"]),
      "menu categories are wrong",
      opened,
    );

    await clickPoint(700, 300);
    const closed = await evaluate(`({
      menuOpen: window.__MARKSI_DEV__.getState().menuOpen,
      hamburger: getComputedStyle(document.querySelector(".menu-button")).visibility
    })`);
    assert(!closed.menuOpen, "blank click should close the menu", closed);
    assert(closed.hamburger === "visible", "hamburger should return", closed);
  });

  await test("File menu contains export, preferences, and quit; no footer", async () => {
    await clickSelector(".menu-button");
    await clickSelector(".menu-bar-item");
    const state = await evaluate(`(() => {
      const labels = Array.from(document.querySelectorAll(".menu-dropdown .menu-item-label")).map((node) => node.textContent);
      return {
        labels,
        footer: Boolean(document.querySelector(".menu-footer")),
        last: labels[labels.length - 1]
      };
    })()`);
    assert(state.labels.includes("导出…"), "export dialog entry missing", state);
    assert(state.labels.includes("图片 (PNG)…"), "image export entry missing", state);
    assert(state.labels.includes("Pandoc 导出…"), "Pandoc export entry missing", state);
    assert(state.labels.includes("Pandoc 导入…"), "Pandoc import entry missing", state);
    assert(state.labels.includes("偏好设置…"), "preferences missing", state);
    assert(state.last === "退出 MarkSI", "quit should be last", state);
    assert(!state.footer, "menu footer must be gone", state);
  });

  await test("About dialog has only its top-right close button", async () => {
    await clickSelector(".menu-bar-item:nth-child(5)");
    await clickSelector(".menu-dropdown .menu-item");
    await waitFor('document.querySelector(".about-dialog")');
    const state = await evaluate(`({
      buttons: Array.from(document.querySelectorAll(".about-dialog button")).map((node) => node.textContent?.trim()),
      bottom: Boolean(document.querySelector(".about-button")),
      version: document.querySelector(".about-version")?.textContent?.trim() ?? null
    })`);
    assert(state.buttons.length === 1, "about should have one close control", state);
    assert(!state.bottom, "about footer button must be removed", state);
    assert(state.version?.includes("0.16"), "About should show version 0.16", state);
    await clickSelector(".about-dialog .modal-close");
    await waitFor('!document.querySelector(".about-dialog")');
  });

  await test("new document focuses a blank preview", async () => {
    await evaluate(
      'window.__MARKSI_DEV__.getState().setMenuOpen(false); window.__MARKSI_DEV__.getState().setSettingsOpen(false)',
    );
    await sleep(150);
    await clickSelector(".workspace-empty-actions button:nth-child(4)");
    await sleep(350);
    const state = await evaluate(`({
      welcome: Boolean(document.querySelector(".welcome")),
      content: window.__MARKSI_DEV__.getState().doc.content,
      viewMode: window.__MARKSI_DEV__.getState().viewMode,
      focused: document.activeElement?.classList.contains("cm-content") ?? false,
      toast: document.querySelector(".toast")?.textContent?.trim() ?? null
    })`);
    assert(!state.welcome, "welcome overlay must remain absent", state);
    assert(state.content === "", "new document should be empty", state);
    assert(state.viewMode === "preview", "new document should open in preview", state);
    assert(state.focused, "editor should be focused", state);
    assert(state.toast?.includes("已新建空白文档"), "missing new-document toast", state);
  });

  await test("new document save dialog uses its first level heading", async () => {
    const headingSavePath = resolve(fixtureDir, "save-heading.md");
    const untitledSavePath = resolve(fixtureDir, "save-untitled.md");
    await resetBase();
    try {
      await evaluate(`(async () => {
        const platform = await import("/src/lib/platform.ts");
        window.__MARKSI_SAVE_CAPTURE__ = null;
        window.__MARKSI_SAVE_RETURN__ = ${JSON.stringify(headingSavePath)};
        platform.setSaveDialogForTests(async (options) => {
          window.__MARKSI_SAVE_CAPTURE__ = options;
          return window.__MARKSI_SAVE_RETURN__;
        });
      })()`);
      await evaluate(
        'window.__MARKSI_DEV__.setContent("# 项目计划\\n\\n正文内容")',
      );
      await evaluate("window.__MARKSI_DEV__.save()");
      await waitFor(
        "window.__MARKSI_DEV__.getState().doc.path === " +
          JSON.stringify(headingSavePath) +
          " && !window.__MARKSI_DEV__.getState().doc.dirty",
        10_000,
      );
      const headingCapture = await evaluate(
        "window.__MARKSI_SAVE_CAPTURE__",
      );
      assert(
        headingCapture?.defaultPath === "项目计划.md",
        "the save dialog should default to the H1 filename",
        headingCapture,
      );
      const savedMarkdown = await readFile(headingSavePath, "utf8");
      assert(
        savedMarkdown.includes("# 项目计划"),
        "the save flow should write the edited Markdown",
        savedMarkdown,
      );

      await evaluate("window.__MARKSI_DEV__.getState().newDocument()");
      await evaluate(
        'window.__MARKSI_DEV__.setContent("## 只有二级标题\\n\\n正文内容")',
      );
      await evaluate(
        `window.__MARKSI_SAVE_RETURN__ = ${JSON.stringify(untitledSavePath)}`,
      );
      await evaluate("window.__MARKSI_DEV__.save()");
      await waitFor(
        "window.__MARKSI_DEV__.getState().doc.path === " +
          JSON.stringify(untitledSavePath),
        10_000,
      );
      const untitledCapture = await evaluate(
        "window.__MARKSI_SAVE_CAPTURE__",
      );
      assert(
        untitledCapture?.defaultPath === "未命名.md",
        "a document without an H1 should keep the untitled save name",
        untitledCapture,
      );
    } finally {
      await evaluate(`(async () => {
        const platform = await import("/src/lib/platform.ts");
        platform.setSaveDialogForTests(null);
        window.__MARKSI_DEV__.getState().newDocument();
        delete window.__MARKSI_SAVE_CAPTURE__;
        delete window.__MARKSI_SAVE_RETURN__;
      })()`).catch(() => {});
      await rm(headingSavePath, { force: true });
      await rm(untitledSavePath, { force: true });
      await resetBase();
    }
  });

  await test("opened Markdown starts in editable live preview", async () => {
    await openFixture();
    const state = await evaluate(`({
      viewMode: window.__MARKSI_DEV__.getState().viewMode,
      path: window.__MARKSI_DEV__.getState().doc.path,
      live: Boolean(document.querySelector(".cm-live-preview")),
      reading: Boolean(document.querySelector(".preview-surface")),
      editable: document.querySelector(".cm-content")?.getAttribute("contenteditable")
    })`);
    assert(state.viewMode === "preview", "opened document should use preview", state);
    assert(state.path === markdownFixture, "fixture was not opened", state);
    assert(state.live, "live preview should be mounted", state);
    assert(!state.reading, "reading overlay should be hidden", state);
    assert(state.editable === "true", "live preview should be editable", state);
  });

  await test("live preview edits text and hides inactive Markdown markers", async () => {
    const lines = await evaluate(
      'Array.from(document.querySelectorAll(".cm-line")).map((node) => node.textContent)',
    );
    assert(
      lines.some((line) => line.includes("粗体") && !line.includes("**")),
      "inactive emphasis markers should be hidden",
      lines,
    );
    await clickSelector(".cm-line:nth-child(3)", 0.25);
    await typeText("（编辑）");
    const content = await evaluate(
      "window.__MARKSI_DEV__.getState().doc.content",
    );
    assert(content.includes("（编辑）"), "typing in preview did not edit source", content);
    assert(
      (await evaluate("window.__MARKSI_DEV__.getState().viewMode")) === "preview",
      "typing should not leave preview",
    );
  });

  await test("editor search is localized and closes with Escape", async () => {
    await clickSelector(".cm-content");
    await keyWithCtrl("f", "KeyF", 70);
    await sleep(300);
    const state = await evaluate(`({
      placeholder: document.querySelector(".cm-search input[name=search]")?.getAttribute("placeholder") ?? null,
      labels: Array.from(document.querySelectorAll(".cm-search label")).map((node) => node.textContent?.trim())
    })`);
    assert(state.placeholder === "查找", "search placeholder should be Chinese", state);
    assert(state.labels.includes("区分大小写"), "search labels should be Chinese", state);
    await press("Escape", "Escape", 27);
  });

  await test("source and reading modes switch correctly", async () => {
    await evaluate('window.__MARKSI_DEV__.getState().setViewMode("source")');
    await sleep(200);
    assert(
      !(await evaluate('document.querySelector(".cm-live-preview")')),
      "source mode must not use live-preview decorations",
    );
    await evaluate('window.__MARKSI_DEV__.getState().setViewMode("reading")');
    await waitFor('document.querySelector(".markdown-body")');
    const state = await evaluate(`({
      overlay: Boolean(document.querySelector(".preview-surface")),
      body: Boolean(document.querySelector(".markdown-body")),
      editable: document.querySelector(".cm-content")?.getAttribute("contenteditable")
    })`);
    assert(state.overlay && state.body, "reading view should render", state);
    assert(state.editable === "false", "reading view editor should be read-only", state);
    await evaluate('window.__MARKSI_DEV__.getState().setViewMode("preview")');
    await sleep(200);
  });

  await test("settings dialog is Chinese and switches English and back", async () => {
    await evaluate('window.__MARKSI_DEV__.getState().setSettingsOpen(true)');
    await waitFor('document.querySelector(".settings-dialog")');
    const zh = await evaluate(`({
      title: document.querySelector("#settings-title")?.textContent,
      languageButtons: Array.from(document.querySelectorAll(".segmented-control button")).map((node) => node.textContent)
    })`);
    assert(zh.title === "偏好设置", "settings title should be Chinese", zh);
    assert(zh.languageButtons.includes("中文"), "Chinese language option missing", zh);
    await evaluate(`(() => {
      const button = Array.from(document.querySelectorAll(".segmented-control button")).find((node) => node.textContent === "English");
      button?.click();
    })()`);
    await sleep(250);
    const en = await evaluate(`({
      lang: document.documentElement.lang,
      title: document.querySelector("#settings-title")?.textContent
    })`);
    assert(en.lang === "en", "html lang should switch to en", en);
    assert(en.title === "Preferences", "settings should switch to English", en);
    await evaluate(`(() => {
      const button = Array.from(document.querySelectorAll(".segmented-control button")).find((node) => node.textContent === "中文");
      button?.click();
    })()`);
    await sleep(200);
    await clickSelector(".settings-close");
    await waitFor('!document.querySelector(".settings-dialog")');
  });

  await test("strict mode toggles compact ATX headings", async () => {
    await resetBase();
    await evaluate(
      'window.__MARKSI_DEV__.setContent("###紧凑标题\\n\\n正文")',
    );
    await evaluate('window.__MARKSI_DEV__.getState().setViewMode("reading")');
    await waitFor('document.querySelector(".markdown-body")');
    const strict = await evaluate(`({
      heading: document.querySelector(".markdown-body h3")?.textContent ?? null,
      setting: window.__MARKSI_DEV__.getState().settings.strictMode
    })`);
    assert(strict.setting === true, "strict mode should start enabled", strict);
    assert(strict.heading === null, "strict mode should reject compact headings", strict);

    await evaluate(
      'window.__MARKSI_DEV__.getState().setSettingsOpen(true)',
    );
    await waitFor('document.querySelector(".settings-dialog")');
    const toggled = await evaluate(`(() => {
      const toggle = Array.from(document.querySelectorAll('.settings-dialog [role="switch"]'))
        .find((node) => node.getAttribute("aria-label") === "严格模式");
      toggle?.click();
      return Boolean(toggle);
    })()`);
    assert(toggled, "strict mode setting toggle is missing");
    await clickSelector(".settings-close");
    await waitFor('!document.querySelector(".settings-dialog")');
    await waitFor(
      'document.querySelector(".markdown-body h3")?.textContent?.includes("紧凑标题")',
    );
    const lax = await evaluate(`({
      heading: document.querySelector(".markdown-body h3")?.textContent ?? null,
      setting: window.__MARKSI_DEV__.getState().settings.strictMode
    })`);
    assert(lax.setting === false, "strict mode toggle did not update settings", lax);
    assert(lax.heading?.includes("紧凑标题"), "compact heading was not rendered", lax);
    await resetBase();
  });

  await test("strict mode toggles lax list indentation", async () => {
    await resetBase();
    const source = [
      "10. 父项",
      "  1. 子项",
      "",
      "```md",
      "  1. 代码不是列表",
      "```",
    ].join("\n");
    await evaluate(
      `window.__MARKSI_DEV__.setContent(${JSON.stringify(source)})`,
    );
    await evaluate('window.__MARKSI_DEV__.getState().setViewMode("reading")');
    await waitFor('document.querySelector(".markdown-body > ol")');
    const strict = await evaluate(`({
      topItems: document.querySelectorAll(".markdown-body > ol > li").length,
      nestedItems: document.querySelectorAll(".markdown-body > ol > li > ol > li").length,
      code: document.querySelector(".markdown-body pre code")?.textContent ?? "",
      content: window.__MARKSI_DEV__.getState().doc.content
    })`);
    assert(strict.topItems === 2, "strict mode should keep two top-level items", strict);
    assert(strict.nestedItems === 0, "strict mode should not nest the list", strict);
    assert(strict.code.includes("1. 代码不是列表"), "strict mode changed the code fence", strict);
    assert(strict.content === source, "rendering must not rewrite the source", strict);

    await evaluate(
      'window.__MARKSI_DEV__.setSettings({ strictMode: false })',
    );
    await waitFor(
      'document.querySelectorAll(".markdown-body > ol > li > ol > li").length === 1',
    );
    const lax = await evaluate(`({
      topItems: document.querySelectorAll(".markdown-body > ol > li").length,
      nestedText: document.querySelector(".markdown-body > ol > li > ol > li")?.textContent ?? "",
      code: document.querySelector(".markdown-body pre code")?.textContent ?? "",
      content: window.__MARKSI_DEV__.getState().doc.content,
      setting: window.__MARKSI_DEV__.getState().settings.strictMode
    })`);
    assert(lax.setting === false, "strict mode setting should be off", lax);
    assert(lax.topItems === 1, "lax mode should nest the child item", lax);
    assert(lax.nestedText.includes("子项"), "nested item text is missing", lax);
    assert(lax.code.includes("1. 代码不是列表"), "lax mode changed the code fence", lax);
    assert(lax.content === source, "rendering must not rewrite the source", lax);
    await resetBase();
  });

  await test("flat file list shows nested workspace files", async () => {
    await resetBase();
    const flatDir = resolve(fixtureDir, "flat-workspace");
    try {
      await mkdir(resolve(flatDir, "nested"), { recursive: true });
      await writeFile(resolve(flatDir, "top.md"), "# Top\n", "utf8");
      await writeFile(
        resolve(flatDir, "nested", "child.md"),
        "# Child\n",
        "utf8",
      );
      await evaluate(`(async () => {
        const platform = await import("/src/lib/platform.ts");
        const entries = await platform.listDirectory(${JSON.stringify(flatDir)});
        window.__MARKSI_DEV__.getState().setWorkspace(${JSON.stringify(flatDir)}, entries);
        window.__MARKSI_DEV__.getState().setSidebarTab("files");
      })()`);
      await waitFor('document.querySelector(".file-tree .file-row")');
      const tree = await evaluate(`({
        flat: Boolean(document.querySelector(".flat-file-list")),
        child: Boolean(Array.from(document.querySelectorAll(".file-row")).find((node) => node.textContent?.includes("child.md"))),
        folders: Array.from(document.querySelectorAll(".file-row.is-folder")).length
      })`);
      assert(!tree.flat, "flat list should be off by default", tree);
      assert(!tree.child, "nested file should be hidden before expansion", tree);
      assert(tree.folders >= 1, "folder row is missing", tree);

      await evaluate(
        'window.__MARKSI_DEV__.setSettings({ flatFileList: true })',
      );
      await waitFor('document.querySelector(".flat-file-list .file-row")');
      const flat = await evaluate(`({
        rows: Array.from(document.querySelectorAll(".flat-file-list .file-row")).map((node) => node.textContent?.trim()),
        folders: document.querySelectorAll(".flat-file-list .file-row.is-folder").length
      })`);
      assert(
        flat.rows.some((row) => row.includes("top.md")),
        "flat list is missing top-level files",
        flat,
      );
      assert(
        flat.rows.some((row) => row.includes("child.md")),
        "flat list is missing nested files",
        flat,
      );
      assert(flat.folders === 0, "flat list should not render folders", flat);
    } finally {
      await evaluate(
        'window.__MARKSI_DEV__.getState().clearWorkspace()',
      ).catch(() => {});
      await rm(flatDir, { recursive: true, force: true });
      await resetBase();
    }
  });

  await test("file actions rename, duplicate, move, and delete workspace files", async () => {
    await resetBase();
    const root = resolve(fixtureDir, "file-ops-workspace");
    const renameFile = resolve(root, "rename-me.md");
    const renamedFile = resolve(root, "renamed.md");
    const copyFile = resolve(root, "renamed copy.md");
    const moveFile = resolve(root, "move-me.md");
    const movedFile = resolve(root, "target", "move-me.md");
    const deleteFile = resolve(root, "delete-me.md");

    try {
      await mkdir(resolve(root, "target"), { recursive: true });
      await writeFile(renameFile, "# Rename\n\nBody.\n", "utf8");
      await writeFile(moveFile, "# Move\n", "utf8");
      await writeFile(deleteFile, "# Delete\n", "utf8");
      await evaluate(`(async () => {
        const platform = await import("/src/lib/platform.ts");
        const entries = await platform.listDirectory(${JSON.stringify(root)});
        window.__MARKSI_DEV__.getState().setWorkspace(${JSON.stringify(root)}, entries);
      })()`);
      await waitFor('document.querySelector(".file-tree .file-row")');

      async function openRowAction(name, action) {
        const opened = await evaluate(`(() => {
          const wrap = Array.from(document.querySelectorAll(".file-row-wrap"))
            .find((node) => node.querySelector(".file-name")?.textContent === ${JSON.stringify(name)});
          if (!wrap) return false;
          wrap.querySelector(".file-row-actions")?.click();
          return true;
        })()`);
        assert(opened, `row action button missing for ${name}`);
        await waitFor('document.querySelector(".file-actions-menu")');
        const chosen = await evaluate(`(() => {
          const button = document.querySelector('.file-actions-menu [data-action="${action}"]');
          button?.click();
          return Boolean(button);
        })()`);
        assert(chosen, `file action missing: ${action}`);
        await waitFor('document.querySelector(".file-op-dialog")');
      }

      async function setDialogInput(value) {
        await evaluate(`(() => {
          const input = document.querySelector(".file-op-input");
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(input, ${JSON.stringify(value)});
          input.dispatchEvent(new Event("input", { bubbles: true }));
        })()`);
        await sleep(120);
      }

      async function confirmDialog() {
        await evaluate('document.querySelector(".file-op-confirm")?.click()');
        await waitFor('!document.querySelector(".file-op-dialog")', 8_000);
      }

      const opened = await evaluate(`(() => {
        const row = Array.from(document.querySelectorAll(".file-row"))
          .find((node) => node.querySelector(".file-name")?.textContent === "rename-me.md");
        row?.click();
        return Boolean(row);
      })()`);
      assert(opened, "workspace file row is missing");
      await waitFor(
        'window.__MARKSI_DEV__.getState().doc.path?.toLowerCase().endsWith("rename-me.md")',
        10_000,
      );
      await evaluate(`(async () => {
        const platform = await import("/src/lib/platform.ts");
        await platform.clearHistory(${JSON.stringify(renameFile)});
        await platform.recordHistory(
          ${JSON.stringify(renameFile)},
          "rename-me.md",
          "# Rename\\n\\nBody.\\n",
          "UTF-8",
          "LF"
        );
      })()`);

      await openRowAction("rename-me.md", "rename");
      await setDialogInput("../escape.md");
      const invalid = await evaluate(`({
        error: document.querySelector(".file-op-error")?.textContent ?? "",
        disabled: document.querySelector(".file-op-confirm")?.disabled ?? false
      })`);
      assert(invalid.error.length > 0, "invalid rename should show an error", invalid);
      assert(invalid.disabled, "invalid rename should be blocked", invalid);
      assert(existsSync(renameFile), "invalid rename must not touch the file");

      await setDialogInput("renamed.md");
      await confirmDialog();
      await waitForFile(renamedFile);
      assert(!existsSync(renameFile), "old name should be gone after rename");
      const renamed = await evaluate(`({
        path: window.__MARKSI_DEV__.getState().doc.path,
        content: window.__MARKSI_DEV__.getState().doc.content
      })`);
      assert(
        renamed.path?.toLowerCase().endsWith("renamed.md"),
        "active document should follow the renamed file",
        renamed,
      );
      assert(
        renamed.content.includes("# Rename"),
        "rename should preserve document content",
        renamed,
      );
      let relocatedHistory = 0;
      for (let attempt = 0; attempt < 40; attempt += 1) {
        relocatedHistory = await evaluate(`(async () => {
          const platform = await import("/src/lib/platform.ts");
          return (await platform.listHistory(${JSON.stringify(renamedFile)})).length;
        })()`);
        if (relocatedHistory > 0) {
          break;
        }
        await sleep(120);
      }
      assert(
        relocatedHistory > 0,
        "rename should move local history to the new path",
        relocatedHistory,
      );

      await openRowAction("renamed.md", "duplicate");
      await confirmDialog();
      await waitForFile(copyFile);
      assert(
        (await readFile(copyFile, "utf8")).includes("# Rename"),
        "duplicate should copy file content",
      );
      const afterCopy = await evaluate(
        'window.__MARKSI_DEV__.getState().doc.path',
      );
      assert(
        afterCopy?.toLowerCase().endsWith("renamed.md"),
        "duplicate should not retarget the open document",
        afterCopy,
      );

      await openRowAction("move-me.md", "move");
      await setDialogInput("target");
      await confirmDialog();
      await waitForFile(movedFile);
      assert(!existsSync(moveFile), "source should be gone after move");
      assert(
        (await readFile(movedFile, "utf8")).includes("# Move"),
        "move should preserve file content",
      );

      await openRowAction("delete-me.md", "delete");
      const deleteText = await evaluate(
        'document.querySelector(".file-op-copy")?.textContent ?? ""',
      );
      assert(
        deleteText.includes("delete-me.md"),
        "delete confirmation should name the file",
        deleteText,
      );
      await confirmDialog();
      await waitForFile(deleteFile, false);

      await openRowAction("renamed.md", "delete");
      const warning = await evaluate(
        'document.querySelector(".file-op-warning")?.textContent ?? ""',
      );
      assert(
        warning.length > 0,
        "deleting the open document should warn about closing it",
        warning,
      );
      await confirmDialog();
      await waitForFile(renamedFile, false);
      await waitFor(
        'window.__MARKSI_DEV__.getState().doc.path === null',
        8_000,
      );
      const blank = await evaluate(`({
        content: window.__MARKSI_DEV__.getState().doc.content,
        dirty: window.__MARKSI_DEV__.getState().doc.dirty,
        placeholder: document.querySelector(".cm-placeholder")?.textContent ?? ""
      })`);
      assert(
        blank.content === "" && !blank.dirty && blank.placeholder.length > 0,
        "deleting the open document should return to a blank preview",
        blank,
      );
    } finally {
      await evaluate(
        'document.querySelector(".file-op-cancel")?.click()',
      ).catch(() => {});
      await evaluate(
        'window.__MARKSI_DEV__.getState().clearWorkspace()',
      ).catch(() => {});
      await evaluate(`(async () => {
        const platform = await import("/src/lib/platform.ts");
        await platform.clearHistory(${JSON.stringify(renameFile)});
        await platform.clearHistory(${JSON.stringify(renamedFile)});
      })()`).catch(() => {});
      await rm(root, { recursive: true, force: true });
      await resetBase();
    }
  });

  await test("local history records, previews, restores, and clears saved versions", async () => {
    await resetBase();
    const historyFile = resolve(fixtureDir, "history-note.md");
    const original = "# Version one\n\nOriginal body.\n";

    try {
      await writeFile(historyFile, original, "utf8");
      await evaluate(`(async () => {
        const platform = await import("/src/lib/platform.ts");
        await platform.clearHistory(${JSON.stringify(historyFile)});
        await window.__MARKSI_DEV__.openPath(${JSON.stringify(historyFile)});
      })()`);
      await waitFor(
        'window.__MARKSI_DEV__.getState().doc.path?.toLowerCase().endsWith("history-note.md")',
        10_000,
      );
      await sleep(250);

      await evaluate(
        'window.__MARKSI_DEV__.setContent("# Version two\\n\\nChanged body.\\n")',
      );
      await evaluate("window.__MARKSI_DEV__.save()");
      await waitFor(
        "window.__MARKSI_DEV__.getState().doc.dirty === false",
        10_000,
      );

      let historyCount = 0;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        historyCount = await evaluate(`(async () => {
          const platform = await import("/src/lib/platform.ts");
          return (await platform.listHistory(${JSON.stringify(historyFile)})).length;
        })()`);
        if (historyCount >= 2) {
          break;
        }
        await sleep(150);
      }
      assert(
        historyCount >= 2,
        "saving should record the previous and current version",
        historyCount,
      );

      await evaluate("window.__MARKSI_DEV__.openHistory()");
      await waitFor('document.querySelectorAll(".history-item").length >= 2');
      const previews = await evaluate(
        'Array.from(document.querySelectorAll(".history-item-preview")).map((node) => node.textContent ?? "")',
      );
      assert(
        previews.some((text) => text.includes("Changed body")),
        "history should include the newest saved text",
        previews,
      );
      assert(
        previews.some((text) => text.includes("Original body")),
        "history should include the previous saved text",
        previews,
      );

      await evaluate(`(() => {
        const items = document.querySelectorAll(".history-item");
        items[items.length - 1]?.click();
      })()`);
      await waitFor(
        'document.querySelector(".history-content")?.textContent.includes("Original body")',
      );
      await waitFor(
        'document.querySelector(".history-restore") && !document.querySelector(".history-restore").disabled',
      );
      await evaluate('document.querySelector(".history-restore")?.click()');
      await waitFor('!document.querySelector(".history-dialog")');
      const restored = await evaluate(`({
        content: window.__MARKSI_DEV__.getState().doc.content,
        dirty: window.__MARKSI_DEV__.getState().doc.dirty
      })`);
      assert(
        restored.content === original,
        "restore should load the selected snapshot without touching disk",
        restored,
      );
      assert(restored.dirty, "restored content should be unsaved", restored);

      await evaluate("window.__MARKSI_DEV__.openHistory()");
      await waitFor('document.querySelectorAll(".history-item").length >= 2');
      await evaluate('document.querySelector(".history-clear")?.click()');
      await waitFor(
        'document.querySelector(".history-clear")?.classList.contains("button-danger")',
      );
      await evaluate('document.querySelector(".history-clear")?.click()');
      await waitFor('document.querySelector(".history-empty")');
      const cleared = await evaluate(`(async () => {
        const platform = await import("/src/lib/platform.ts");
        return (await platform.listHistory(${JSON.stringify(historyFile)})).length;
      })()`);
      assert(cleared === 0, "clearing should remove every snapshot", cleared);

      await sleep(200);
      await press("Escape", "Escape", 27);
      await waitFor('!document.querySelector(".history-dialog")');
    } finally {
      await evaluate("window.__MARKSI_DEV__.closeHistory?.()").catch(() => {});
      await evaluate(`(async () => {
        const platform = await import("/src/lib/platform.ts");
        await platform.clearHistory(${JSON.stringify(historyFile)});
      })()`).catch(() => {});
      await rm(historyFile, { force: true });
      await resetBase();
    }
  });

  await test("lax mode keeps list continuations and quoted lists", async () => {
    await resetBase();
    const source = [
      "1. 父项",
      "",
      "  续行",
      "",
      "> 10. 引用父项",
      ">   1. 引用子项",
    ].join("\n");
    await evaluate(
      `window.__MARKSI_DEV__.setContent(${JSON.stringify(source)})`,
    );
    await evaluate('window.__MARKSI_DEV__.getState().setViewMode("reading")');
    await waitFor('document.querySelector(".markdown-body > ol")');
    const strict = await evaluate(`({
      itemText: document.querySelector(".markdown-body > ol > li")?.textContent ?? "",
      outsideText: document.querySelector(".markdown-body > p")?.textContent ?? "",
      quoteTop: document.querySelectorAll(".markdown-body blockquote > ol > li").length,
      quoteNested: document.querySelectorAll(".markdown-body blockquote > ol > li > ol > li").length
    })`);
    assert(!strict.itemText.includes("续行"), "strict mode should leave the continuation outside", strict);
    assert(strict.outsideText.includes("续行"), "strict mode should render the continuation as a paragraph", strict);
    assert(strict.quoteTop === 2, "strict mode should keep quoted items flat", strict);
    assert(strict.quoteNested === 0, "strict mode should not nest quoted items", strict);

    await evaluate(
      'window.__MARKSI_DEV__.setSettings({ strictMode: false })',
    );
    await waitFor(
      'document.querySelectorAll(".markdown-body blockquote > ol > li > ol > li").length === 1',
    );
    const lax = await evaluate(`({
      itemText: document.querySelector(".markdown-body > ol > li")?.textContent ?? "",
      outsideText: document.querySelector(".markdown-body > p")?.textContent ?? "",
      quoteTop: document.querySelectorAll(".markdown-body blockquote > ol > li").length,
      quoteNested: document.querySelectorAll(".markdown-body blockquote > ol > li > ol > li").length,
      content: window.__MARKSI_DEV__.getState().doc.content
    })`);
    assert(lax.itemText.includes("续行"), "lax mode should keep the continuation in the item", lax);
    assert(!lax.outsideText.includes("续行"), "lax mode should not leave the continuation outside", lax);
    assert(lax.quoteTop === 1, "lax mode should nest the quoted child", lax);
    assert(lax.quoteNested === 1, "quoted child marker is missing", lax);
    assert(lax.content === source, "rendering must not rewrite the source", lax);
    await resetBase();
  });

  await test("export dialog applies profile, front matter, and page setup", async () => {
    await resetBase();
    const exportPath = resolve(fixtureDir, "export-options.html");
    const source = [
      "---",
      "title: Export Test",
      "author: Ada <script>alert(1)</script>",
      "description: A short note",
      "tags: alpha, beta",
      "---",
      "# Body",
      "",
      "Hello.",
    ].join("\n");
    try {
      await evaluate(
        `window.__MARKSI_DEV__.setContent(${JSON.stringify(source)})`,
      );
      await evaluate("window.__MARKSI_DEV__.openExport()");
      await waitFor('document.querySelector(".export-dialog")');
      const initial = await evaluate(`({
        title: document.querySelector("#export-title")?.textContent,
        profile: document.querySelector(".export-profile-select")?.value,
        selects: Array.from(document.querySelectorAll(".export-dialog select")).map((node) => node.getAttribute("aria-label")),
        toggles: Array.from(document.querySelectorAll('.export-dialog [role="switch"]')).map((node) => node.getAttribute("aria-label")),
        buttons: Array.from(document.querySelectorAll(".export-actions button")).map((node) => node.textContent?.trim())
      })`);
      assert(initial.title === "导出文档", "export dialog should be Chinese", initial);
      assert(initial.profile === "document", "document profile should be the default", initial);
      assert(
        JSON.stringify(initial.selects) ===
          JSON.stringify(["导出配置档", "纸张大小", "方向", "页边距"]),
        "export dialog selects are incomplete",
        initial,
      );
      assert(
        ["使用 front matter", "元数据标签", "文档信息面板"].every((label) =>
          initial.toggles.includes(label),
        ),
        "metadata toggles are missing",
        initial,
      );
      assert(
        initial.buttons.includes("导出 HTML") &&
          initial.buttons.includes("打印 / PDF") &&
          initial.buttons.includes("自定义导出"),
        "export actions are missing",
        initial,
      );

      await evaluate(`(() => {
        const select = document.querySelector('.export-dialog select[aria-label="导出配置档"]');
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
        setter.call(select, "print");
        select.dispatchEvent(new Event("change", { bubbles: true }));
      })()`);
      await sleep(180);
      const printProfile = await evaluate(`({
        profile: document.querySelector(".export-profile-select")?.value,
        header: document.querySelector('.export-dialog input[aria-label="页眉"]')?.value,
        footer: document.querySelector('.export-dialog input[aria-label="页脚"]')?.value
      })`);
      assert(printProfile.profile === "print", "print profile was not selected", printProfile);
      assert(printProfile.header === "{title}", "print header was not filled", printProfile);
      assert(printProfile.footer === "{page} / {pages}", "print footer was not filled", printProfile);

      await evaluate(
        'document.querySelector(\'.export-dialog button[aria-label="使用 front matter"]\')?.click()',
      );
      await sleep(140);
      const withoutFrontMatter = await evaluate(`({
        enabled: document.querySelector('.export-dialog button[aria-label="使用 front matter"]')?.getAttribute("aria-checked"),
        metaDisabled: document.querySelector('.export-dialog button[aria-label="元数据标签"]')?.disabled,
        panelDisabled: document.querySelector('.export-dialog button[aria-label="文档信息面板"]')?.disabled
      })`);
      assert(withoutFrontMatter.enabled === "false", "front matter toggle did not turn off", withoutFrontMatter);
      assert(withoutFrontMatter.metaDisabled, "metadata tags should disable", withoutFrontMatter);
      assert(withoutFrontMatter.panelDisabled, "document info should disable", withoutFrontMatter);

      await evaluate(
        'document.querySelector(\'.export-dialog button[aria-label="使用 front matter"]\')?.click()',
      );
      await sleep(150);
      await evaluate(
        'document.querySelector(\'.export-dialog button[aria-label="文档信息面板"]\')?.click()',
      );
      await sleep(120);
      await evaluate(`(() => {
        const setSelect = (label, value) => {
          const select = document.querySelector('.export-dialog select[aria-label="' + label + '"]');
          const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
          setter.call(select, value);
          select.dispatchEvent(new Event("change", { bubbles: true }));
        };
        setSelect("纸张大小", "letter");
        setSelect("方向", "landscape");
        setSelect("页边距", "wide");
      })()`);
      await sleep(180);
      const custom = await evaluate(`({
        profile: document.querySelector(".export-profile-select")?.value,
        header: document.querySelector('.export-dialog input[aria-label="页眉"]')?.value,
        footer: document.querySelector('.export-dialog input[aria-label="页脚"]')?.value,
        pageSize: document.querySelector('.export-dialog select[aria-label="纸张大小"]')?.value,
        orientation: document.querySelector('.export-dialog select[aria-label="方向"]')?.value,
        margin: document.querySelector('.export-dialog select[aria-label="页边距"]')?.value,
        panel: document.querySelector('.export-dialog button[aria-label="文档信息面板"]')?.getAttribute("aria-checked")
      })`);
      assert(custom.profile === "custom", "editing a preset should switch to custom", custom);
      assert(custom.pageSize === "letter", "paper size was not changed", custom);
      assert(custom.orientation === "landscape", "orientation was not changed", custom);
      assert(custom.margin === "wide", "margin was not changed", custom);
      assert(custom.header === "{title}" && custom.footer === "{page} / {pages}", "print header/footer should be retained", custom);
      assert(custom.panel === "true", "document info panel was not enabled", custom);

      await evaluate(`(async () => {
        const platform = await import("/src/lib/platform.ts");
        window.__MARKSI_EXPORT_CAPTURE__ = null;
        platform.setSaveDialogForTests(async (options) => {
          window.__MARKSI_EXPORT_CAPTURE__ = options;
          return ${JSON.stringify(exportPath)};
        });
      })()`);
      const clicked = await evaluate(`(() => {
        const button = Array.from(document.querySelectorAll(".export-actions button"))
          .find((node) => node.textContent?.includes("导出 HTML"));
        button?.click();
        return Boolean(button);
      })()`);
      assert(clicked, "export HTML button is missing");
      await waitFor('!document.querySelector(".export-dialog")', 10_000);

      const html = await readFile(exportPath, "utf8");
      assert(html.includes("<title>Export Test</title>"), "front matter title missing", html.slice(0, 500));
      assert(html.includes("size: Letter landscape;"), "page size or orientation missing", html.slice(0, 800));
      assert(html.includes("margin: 26mm 24mm;"), "wide margins missing", html.slice(0, 800));
      assert(html.includes("@top-center") && html.includes('content: "Export Test";'), "header tokens missing", html.slice(0, 800));
      assert(html.includes('counter(page) "/" counter(pages)'), "footer page tokens missing", html.slice(0, 800));
      assert(
        html.includes('meta name="author" content="Ada &lt;script&gt;alert(1)&lt;/script&gt;"'),
        "metadata tag was not escaped",
        html.slice(0, 800),
      );
      assert(html.includes('class="document-info"'), "document info panel missing", html.slice(0, 1200));
      assert(html.includes("<dt>作者</dt>"), "document info panel is not localized", html.slice(0, 1200));
      assert(!html.includes("<script>alert(1)</script>"), "front matter injected a script");

      const state = await evaluate(`({
        content: window.__MARKSI_DEV__.getState().doc.content,
        options: window.__MARKSI_DEV__.getState().settings.exportOptions,
        capture: window.__MARKSI_EXPORT_CAPTURE__
      })`);
      assert(state.content === source, "export must not rewrite the Markdown source", state);
      assert(state.options.pageSize === "letter", "paper size was not persisted", state);
      assert(state.options.orientation === "landscape", "orientation was not persisted", state);
      assert(state.options.margin === "wide", "margin was not persisted", state);
      assert(state.options.includeDocumentInfo === true, "document info option was not persisted", state);
      assert(
        state.capture?.defaultPath?.endsWith(".html") &&
          state.capture?.filters?.[0]?.extensions?.includes("html"),
        "HTML save dialog options are wrong",
        state.capture,
      );
    } finally {
      await evaluate(`(async () => {
        const platform = await import("/src/lib/platform.ts");
        platform.setSaveDialogForTests(null);
        delete window.__MARKSI_EXPORT_CAPTURE__;
      })()`).catch(() => {});
      await rm(exportPath, { force: true });
      await resetBase();
    }
  });

  await test("custom export runs the configured command in the export folder", async () => {
    await resetBase();
    const exportPath = resolve(fixtureDir, "custom-export.html");
    const markerPath = resolve(fixtureDir, "custom-command-marker.txt");
    const source = "# Custom export\n\nBody";
    const program = process.platform === "win32" ? "cmd" : "sh";
    const args =
      process.platform === "win32"
        ? "/C\necho {input}>custom-command-marker.txt"
        : "-c\nprintf '%s' \"{input}\" > custom-command-marker.txt";
    try {
      await evaluate(
        `window.__MARKSI_DEV__.setContent(${JSON.stringify(source)})`,
      );
      await evaluate(
        `window.__MARKSI_DEV__.setSettings(${JSON.stringify({
          customExportProgram: program,
          customExportArgs: args,
        })})`,
      );
      await evaluate(`(async () => {
        const platform = await import("/src/lib/platform.ts");
        window.__MARKSI_EXPORT_CAPTURE__ = null;
        platform.setSaveDialogForTests(async (options) => {
          window.__MARKSI_EXPORT_CAPTURE__ = options;
          return ${JSON.stringify(exportPath)};
        });
      })()`);
      await evaluate("window.__MARKSI_DEV__.openExport()");
      await waitFor('document.querySelector(".export-dialog")');
      const action = await evaluate(`(() => {
        const button = Array.from(document.querySelectorAll(".export-actions button"))
          .find((node) => node.textContent?.includes("自定义导出"));
        return { exists: Boolean(button), disabled: button?.disabled };
      })()`);
      assert(action.exists, "custom export action is missing", action);
      assert(!action.disabled, "custom export action should be enabled", action);

      const clicked = await evaluate(`(() => {
        const button = Array.from(document.querySelectorAll(".export-actions button"))
          .find((node) => node.textContent?.includes("自定义导出"));
        button?.click();
        return Boolean(button);
      })()`);
      assert(clicked, "custom export button is missing");
      await waitFor('!document.querySelector(".export-dialog")', 20_000);

      const state = await evaluate(`({
        content: window.__MARKSI_DEV__.getState().doc.content,
        toast: document.querySelector(".toast")?.textContent?.trim() ?? null,
        capture: window.__MARKSI_EXPORT_CAPTURE__
      })`);
      assert(state.content === source, "custom export must not rewrite the source", state);
      assert(
        state.capture?.defaultPath?.endsWith(".html"),
        "custom export should still use the HTML save dialog",
        state.capture,
      );
      assert(
        state.toast?.includes("自定义导出完成"),
        "custom export success toast is missing",
        state,
      );
      const html = await readFile(exportPath, "utf8");
      assert(html.includes("# Custom export") || html.includes("Custom export"), "custom export HTML missing", html.slice(0, 400));
      const marker = await readFile(markerPath, "utf8");
      assert(
        marker.includes(exportPath),
        "custom command did not run in the export folder with {input}",
        marker,
      );
    } finally {
      await evaluate(`(async () => {
        const platform = await import("/src/lib/platform.ts");
        platform.setSaveDialogForTests(null);
        delete window.__MARKSI_EXPORT_CAPTURE__;
      })()`).catch(() => {});
      await rm(exportPath, { force: true });
      await rm(markerPath, { force: true });
      await resetBase();
    }
  });

  await test("image export writes a PNG of the reading view", async () => {
    await resetBase();
    const imageDoc = resolve(fixtureDir, "image-export.md");
    const pngPath = resolve(fixtureDir, "export-image.png");
    const source = "# Image export\n\n![icon](icon.png)\n\nA paragraph.";
    try {
      await writeFile(imageDoc, source, "utf8");
      await evaluate(
        `window.__MARKSI_DEV__.openPath(${JSON.stringify(imageDoc)})`,
      );
      await waitFor(
        "window.__MARKSI_DEV__.getState().doc.path === " +
          JSON.stringify(imageDoc),
        10_000,
      );
      await evaluate(`(async () => {
        const platform = await import("/src/lib/platform.ts");
        window.__MARKSI_IMAGE_CAPTURE__ = null;
        platform.setSaveDialogForTests(async (options) => {
          window.__MARKSI_IMAGE_CAPTURE__ = options;
          return ${JSON.stringify(pngPath)};
        });
      })()`);
      await evaluate("window.__MARKSI_DEV__.exportImage()");
      let lastImageState = null;
      for (let attempt = 0; attempt < 150; attempt += 1) {
        lastImageState = await evaluate(`({
          toast: document.querySelector(".toast")?.textContent?.trim() ?? null,
          capture: window.__MARKSI_IMAGE_CAPTURE__,
          viewMode: window.__MARKSI_DEV__.getState().viewMode,
          body: Boolean(document.querySelector(".markdown-body")),
          path: window.__MARKSI_DEV__.getState().doc.path
        })`);
        if (lastImageState.toast?.includes("已导出")) {
          break;
        }
        if (lastImageState.toast) {
          break;
        }
        await sleep(200);
      }
      assert(
        lastImageState?.toast?.includes("已导出"),
        "image export did not finish",
        lastImageState,
      );

      const png = await readFile(pngPath);
      const signature = "89504e470d0a1a0a";
      assert(
        png.subarray(0, 8).toString("hex") === signature,
        "exported file is not a PNG",
      );
      const width = png.readUInt32BE(16);
      const height = png.readUInt32BE(20);
      assert(width >= 500, "PNG width is too small", { width, height });
      assert(height >= 200, "PNG height is too small", { width, height });
      assert(png.length > 1000, "PNG payload is too small", png.length);

      const pixels = await evaluate(`(async () => {
        const image = new Image();
        image.src = "data:image/png;base64,${png.toString("base64")}";
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const colors = new Set();
        for (let index = 0; index < data.length; index += 4 * 97) {
          colors.add(data[index] + "," + data[index + 1] + "," + data[index + 2]);
        }
        return { colors: colors.size, width: image.naturalWidth, height: image.naturalHeight };
      })()`);
      assert(
        pixels.colors > 5,
        "exported PNG appears to be a blank canvas",
        pixels,
      );

      const state = await evaluate(`({
        content: window.__MARKSI_DEV__.getState().doc.content,
        viewMode: window.__MARKSI_DEV__.getState().viewMode,
        capture: window.__MARKSI_IMAGE_CAPTURE__
      })`);
      assert(state.content === source, "image export must not rewrite the source", state);
      assert(state.viewMode === "reading", "image export should use the reading view", state);
      assert(
        state.capture?.defaultPath?.endsWith(".png") &&
          state.capture?.filters?.[0]?.extensions?.includes("png"),
        "PNG save dialog options are wrong",
        state.capture,
      );
    } finally {
      await evaluate(`(async () => {
        const platform = await import("/src/lib/platform.ts");
        platform.setSaveDialogForTests(null);
        delete window.__MARKSI_IMAGE_CAPTURE__;
      })()`).catch(() => {});
      await rm(pngPath, { force: true });
      await rm(imageDoc, { force: true });
      await resetBase();
    }
  });

  await test("remote images load only after explicit opt-in", async () => {
    await resetBase();
    const remoteUrl = "https://example.com/pixel.png";
    const pixel =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
    try {
      await evaluate(`(async () => {
        const platform = await import("/src/lib/platform.ts");
        platform.setRemoteImageLoaderForTests(async () => ${JSON.stringify(pixel)});
      })()`);
      await evaluate(
        `window.__MARKSI_DEV__.setContent(${JSON.stringify(
          `![remote](${remoteUrl})`,
        )})`,
      );
      await evaluate('window.__MARKSI_DEV__.getState().setViewMode("reading")');
      await waitFor(
        'document.querySelector(".markdown-body [data-marksi-remote-src]")',
      );
      const off = await evaluate(`({
        placeholder: Boolean(document.querySelector(".markdown-body [data-marksi-remote-src]")),
        loaded: Boolean(document.querySelector('.markdown-body img[data-marksi-remote="true"]')),
        setting: window.__MARKSI_DEV__.getState().settings.loadRemoteImages
      })`);
      assert(off.setting === false, "remote images should be off by default", off);
      assert(off.placeholder && !off.loaded, "remote image loaded without opt-in", off);

      await evaluate(
        'window.__MARKSI_DEV__.setSettings({ loadRemoteImages: true })',
      );
      await waitFor(
        'document.querySelector(\'.markdown-body img[data-marksi-remote="true"]\')',
      );
      const on = await evaluate(`({
        src: document.querySelector('.markdown-body img[data-marksi-remote="true"]')?.getAttribute("src") ?? "",
        title: document.querySelector('.markdown-body img[data-marksi-remote="true"]')?.getAttribute("title") ?? "",
        placeholder: Boolean(document.querySelector(".markdown-body [data-marksi-remote-src]"))
      })`);
      assert(on.src.startsWith("data:image/png;base64,"), "remote image was not cached as data", on);
      assert(on.title === remoteUrl, "remote image title is wrong", on);
      assert(!on.placeholder, "remote placeholder should be replaced", on);

      await evaluate(
        'window.__MARKSI_DEV__.setSettings({ loadRemoteImages: false })',
      );
      await waitFor(
        'document.querySelector(".markdown-body [data-marksi-remote-src]")',
      );
      const restored = await evaluate(
        'Boolean(document.querySelector(\'.markdown-body img[data-marksi-remote="true"]\'))',
      );
      assert(!restored, "remote image should disappear when opt-in is disabled");
    } finally {
      await evaluate(`(async () => {
        const platform = await import("/src/lib/platform.ts");
        platform.setRemoteImageLoaderForTests(null);
      })()`).catch(() => {});
      await resetBase();
    }
  });

  await test("image root path resolves root-relative images", async () => {
    await resetBase();
    const rootDir = resolve(fixtureDir, "root-path");
    const docDir = resolve(rootDir, "docs");
    const docPath = resolve(docDir, "root.md");
    try {
      await mkdir(docDir, { recursive: true });
      await copyFile(imageFixture, resolve(rootDir, "icon.png"));
      await writeFile(docPath, "![root](/icon.png)\n", "utf8");
      await evaluate(
        `window.__MARKSI_DEV__.setSettings(${JSON.stringify({
          imageRootPath: rootDir,
        })})`,
      );
      await evaluate(
        `window.__MARKSI_DEV__.openPath(${JSON.stringify(docPath)})`,
      );
      await waitFor(
        "window.__MARKSI_DEV__.getState().doc.path === " +
          JSON.stringify(docPath),
        10_000,
      );
      await evaluate('window.__MARKSI_DEV__.getState().setViewMode("reading")');
      await waitFor(
        'document.querySelector(".markdown-body img.markdown-image[data-marksi-resolved]")',
        10_000,
      );
      const state = await evaluate(`({
        resolved: document.querySelector(".markdown-body img.markdown-image")?.getAttribute("data-marksi-resolved") ?? "",
        src: document.querySelector(".markdown-body img.markdown-image")?.getAttribute("src") ?? ""
      })`);
      assert(
        state.resolved.endsWith("/root-path/icon.png"),
        "root image did not resolve from the configured root",
        state,
      );
      assert(state.src.startsWith("data:image/png;base64,"), "root image did not load", state);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
      await resetBase();
    }
  });

  await test("image root URL resolves through the remote cache", async () => {
    await resetBase();
    const rootUrl = "https://example.com/assets/";
    const expected = `${rootUrl}missing.png`;
    const pixel =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
    try {
      await evaluate(`(async () => {
        const platform = await import("/src/lib/platform.ts");
        platform.setRemoteImageLoaderForTests(async () => ${JSON.stringify(pixel)});
      })()`);
      await evaluate(
        `window.__MARKSI_DEV__.setSettings(${JSON.stringify({
          imageRootUrl: rootUrl,
          loadRemoteImages: true,
        })})`,
      );
      await evaluate(
        `window.__MARKSI_DEV__.setContent("![root](missing.png)")`,
      );
      await evaluate('window.__MARKSI_DEV__.getState().setViewMode("reading")');
      await waitFor(
        'document.querySelector(\'.markdown-body img[data-marksi-remote-origin]\')',
        10_000,
      );
      const state = await evaluate(`({
        src: document.querySelector('.markdown-body img[data-marksi-remote-origin]')?.getAttribute("src") ?? "",
        origin: document.querySelector('.markdown-body img[data-marksi-remote-origin]')?.getAttribute("data-marksi-remote-origin") ?? ""
      })`);
      assert(state.src.startsWith("data:image/png;base64,"), "root URL image was not cached", state);
      assert(state.origin === expected, "root URL composition is wrong", state);

      await evaluate(
        'window.__MARKSI_DEV__.setSettings({ loadRemoteImages: false })',
      );
      await waitFor(
        'document.querySelector(".markdown-body .image-placeholder")',
      );
      assert(
        !(await evaluate(
          'Boolean(document.querySelector(\'.markdown-body img[data-marksi-remote-origin]\'))',
        )),
        "root URL image should disappear when remote cache is disabled",
      );
    } finally {
      await evaluate(`(async () => {
        const platform = await import("/src/lib/platform.ts");
        platform.setRemoteImageLoaderForTests(null);
      })()`).catch(() => {});
      await resetBase();
    }
  });

  if (existsSync(pandocExecutable)) {
    await test("Pandoc export writes a real DOCX", async () => {
      await resetBase();
      const docxPath = resolve(fixtureDir, "pandoc-export.docx");
      const source = [
        "# Pandoc export",
        "",
        "- one",
        "- two",
        "",
        "A **bold** paragraph.",
      ].join("\n");
      try {
        await evaluate(
          `window.__MARKSI_DEV__.setContent(${JSON.stringify(source)})`,
        );
        await evaluate(
          `window.__MARKSI_DEV__.setSettings(${JSON.stringify({
            pandocPath: pandocExecutable,
          })})`,
        );
        await evaluate("window.__MARKSI_DEV__.openPandoc()");
        await waitFor('document.querySelector(".pandoc-dialog")');
        await waitFor(
          'document.querySelector(".pandoc-status.is-ready")',
          20_000,
        );
        const status = await evaluate(
          'document.querySelector(".pandoc-dialog .settings-copy small")?.textContent ?? ""',
        );
        assert(status.includes("pandoc"), "Pandoc version was not detected", status);

        await evaluate(`(async () => {
          const platform = await import("/src/lib/platform.ts");
          window.__MARKSI_PANDOC_CAPTURE__ = null;
          platform.setSaveDialogForTests(async (options) => {
            window.__MARKSI_PANDOC_CAPTURE__ = options;
            return ${JSON.stringify(docxPath)};
          });
        })()`);
        const clicked = await evaluate(`(() => {
          const button = document.querySelector(".pandoc-dialog .button-primary");
          button?.click();
          return Boolean(button);
        })()`);
        assert(clicked, "Pandoc export button is missing");
        await waitFor('!document.querySelector(".pandoc-dialog")', 30_000);

        const docx = await readFile(docxPath);
        assert(
          docx.subarray(0, 4).toString("hex") === "504b0304",
          "Pandoc output is not a DOCX zip",
        );
        assert(
          docx.includes(Buffer.from("word/document.xml")),
          "DOCX payload is missing word/document.xml",
        );
        assert(docx.length > 1000, "DOCX payload is too small", docx.length);

        const state = await evaluate(`({
          content: window.__MARKSI_DEV__.getState().doc.content,
          pandocPath: window.__MARKSI_DEV__.getState().settings.pandocPath,
          capture: window.__MARKSI_PANDOC_CAPTURE__,
          toast: document.querySelector(".toast")?.textContent?.trim() ?? null
        })`);
        assert(state.content === source, "Pandoc export must not rewrite the source", state);
        assert(state.pandocPath === pandocExecutable, "Pandoc path was not persisted", state);
        assert(state.toast?.includes("已导出"), "Pandoc success toast is missing", state);
        assert(
          state.capture?.defaultPath?.endsWith(".docx") &&
            state.capture?.filters?.[0]?.extensions?.includes("docx"),
          "Pandoc save dialog options are wrong",
          state.capture,
        );
      } finally {
        await evaluate(`(async () => {
          const platform = await import("/src/lib/platform.ts");
          platform.setSaveDialogForTests(null);
          delete window.__MARKSI_PANDOC_CAPTURE__;
        })()`).catch(() => {});
        await rm(docxPath, { force: true });
        await resetBase();
      }
    });
  } else {
    console.log(
      "SKIP  Pandoc export writes a real DOCX (portable Pandoc not present)",
    );
  }

  if (existsSync(pandocExecutable)) {
    await test("Pandoc import opens a DOCX and embeds its image", async () => {
      await resetBase();
      const sourcePath = resolve(fixtureDir, "pandoc-import-source.md");
      const docxPath = resolve(fixtureDir, "pandoc-import-source.docx");
      try {
        await writeFile(
          sourcePath,
          "# Imported\n\n![icon](icon.png)\n\nImported body.",
          "utf8",
        );
        await execFileAsync(pandocExecutable, [
          sourcePath,
          "-o",
          docxPath,
          `--resource-path=${fixtureDir}`,
        ]);
        await evaluate(
          `window.__MARKSI_DEV__.setSettings(${JSON.stringify({
            pandocPath: pandocExecutable,
          })})`,
        );
        await evaluate(`(async () => {
          const platform = await import("/src/lib/platform.ts");
          window.__MARKSI_IMPORT_CAPTURE__ = null;
          platform.setOpenDialogForTests(async (options) => {
            window.__MARKSI_IMPORT_CAPTURE__ = options;
            return ${JSON.stringify(docxPath)};
          });
        })()`);
        await evaluate("window.__MARKSI_DEV__.pandocImport()");
        await waitFor(
          'window.__MARKSI_DEV__.getState().doc.name === "pandoc-import-source.md"',
          20_000,
        );

        const state = await evaluate(`({
          content: window.__MARKSI_DEV__.getState().doc.content,
          path: window.__MARKSI_DEV__.getState().doc.path,
          dirty: window.__MARKSI_DEV__.getState().doc.dirty,
          viewMode: window.__MARKSI_DEV__.getState().viewMode,
          toast: document.querySelector(".toast")?.textContent?.trim() ?? null,
          capture: window.__MARKSI_IMPORT_CAPTURE__
        })`);
        assert(state.content.includes("Imported"), "imported heading is missing", state);
        assert(
          state.content.includes("data:image/png;base64,"),
          "embedded DOCX image was not inlined",
          state,
        );
        assert(state.path === null, "imported document should be unsaved", state);
        assert(state.dirty, "imported document should be dirty", state);
        assert(state.viewMode === "preview", "import should open in preview", state);
        assert(state.toast?.includes("已导入"), "import success toast is missing", state);
        assert(
          state.capture?.filters?.[0]?.extensions?.includes("docx"),
          "Pandoc import filter is wrong",
          state.capture,
        );

        await evaluate(
          'window.__MARKSI_DEV__.getState().setViewMode("reading")',
        );
        await waitFor(
          'document.querySelector(".markdown-body img[src^=\\"data:image/png\\"]")',
          10_000,
        );
      } finally {
        await evaluate(`(async () => {
          const platform = await import("/src/lib/platform.ts");
          platform.setOpenDialogForTests(null);
          delete window.__MARKSI_IMPORT_CAPTURE__;
        })()`).catch(() => {});
        await rm(sourcePath, { force: true });
        await rm(docxPath, { force: true });
        await resetBase();
      }
    });

    await test("Preferences detects the configured Pandoc", async () => {
      await resetBase();
      try {
        await evaluate(
          `window.__MARKSI_DEV__.setSettings(${JSON.stringify({
            pandocPath: pandocExecutable,
          })})`,
        );
        await evaluate(
          'window.__MARKSI_DEV__.getState().setSettingsOpen(true)',
        );
        await waitFor('document.querySelector(".settings-dialog")');
        const clicked = await evaluate(`(() => {
          const button = Array.from(document.querySelectorAll(".settings-dialog button"))
            .find((node) => node.textContent?.trim() === "检测");
          button?.click();
          return Boolean(button);
        })()`);
        assert(clicked, "Pandoc detect button is missing");
        await waitFor(
          'document.querySelector(".settings-dialog")?.textContent?.includes("已检测到")',
          20_000,
        );
        const state = await evaluate(`({
          value: document.querySelector('.settings-dialog input[aria-label="Pandoc 可执行文件"]')?.value,
          text: document.querySelector(".settings-dialog")?.textContent ?? ""
        })`);
        assert(state.value === pandocExecutable, "Pandoc path input is wrong", state);
        assert(state.text.includes("pandoc 3.12.1"), "Pandoc version is missing", state);
      } finally {
        await evaluate(
          'window.__MARKSI_DEV__.getState().setSettingsOpen(false)',
        ).catch(() => {});
        await resetBase();
      }
    });
  }

  await test("Mermaid diagrams render in reading view without script or foreignObject", async () => {
    await evaluate(`window.__MARKSI_DEV__.getState().setContent(${JSON.stringify(
      ["```mermaid", "graph TD", "  A[Start] --> B[Ship]", "```"].join("\n"),
    )})`);
    await evaluate('window.__MARKSI_DEV__.getState().setViewMode("reading")');
    await waitFor(
      'document.querySelector(".mermaid-diagram[data-mermaid-state=ready] svg")',
      20_000,
    );
    const state = await evaluate(`({
      svg: document.querySelectorAll(".mermaid-diagram svg").length,
      scripts: document.querySelectorAll(".mermaid-diagram script").length,
      foreignObjects: document.querySelectorAll(".mermaid-diagram foreignObject").length
    })`);
    assert(state.svg === 1, "Mermaid SVG missing", state);
    assert(state.scripts === 0 && state.foreignObjects === 0, "unsafe SVG content", state);
    await evaluate('window.__MARKSI_DEV__.getState().setViewMode("preview")');
    await sleep(200);
  });

  await test("smart typing pairs Markdown, converts quotes, and inserts emoji", async () => {
    await resetBase();
    await clickSelector(".cm-content");
    await typeText("hello ");
    await typeText("*");
    await typeText("world");
    await typeText("*");
    const paired = await evaluate("window.__MARKSI_DEV__.getState().doc.content");
    assert(paired === "hello *world*", "auto pair failed", paired);

    await resetBase();
    await evaluate(
      'window.__MARKSI_DEV__.getState().updateSettings({ smartPunctuation: true })',
    );
    await clickSelector(".cm-content");
    await typeText("He said ");
    await typeText('"');
    await typeText("hello");
    await typeText('"');
    const smart = await evaluate("window.__MARKSI_DEV__.getState().doc.content");
    assert(smart === "He said “hello”", "smart punctuation failed", smart);

    await resetBase();
    await evaluate(
      'window.__MARKSI_DEV__.getState().updateSettings({ emojiAutocomplete: true })',
    );
    await clickSelector(".cm-content");
    await typeText(":");
    await typeChars("smile");
    await waitFor(
      'Array.from(document.querySelectorAll(".cm-tooltip-autocomplete li")).some((node) => node.textContent?.includes(":smile:"))',
      5000,
    );
    await sleep(180);
    const selected = await evaluate(
      'document.querySelector(\'.cm-tooltip-autocomplete li[aria-selected="true"]\')?.textContent ?? null',
    );
    assert(selected?.includes(":smile:"), "emoji completion did not select smile", selected);
    await press("Enter", "Enter", 13);
    await sleep(150);
    const emoji = await evaluate("window.__MARKSI_DEV__.getState().doc.content");
    assert(emoji === "😄", "emoji completion failed", emoji);
  });

  await test("image context menu opens and view action opens the lightbox", async () => {
    await resetBase();
    const imageDoc = resolve(fixtureDir, "image.md");
    await writeFile(imageDoc, "![icon](icon.png)\n", "utf8");
    await evaluate(
      `window.__MARKSI_DEV__.openPath(${JSON.stringify(imageDoc)})`,
    );
    await waitFor(
      'window.__MARKSI_DEV__.getState().doc.path === ' +
        JSON.stringify(imageDoc),
      10_000,
    );
    await evaluate('window.__MARKSI_DEV__.getState().setViewMode("reading")');
    await waitFor(
      'document.querySelector("img.markdown-image[data-marksi-resolved]")',
      10_000,
    );
    await evaluate(`(() => {
      const image = document.querySelector("img.markdown-image");
      const box = image.getBoundingClientRect();
      image.dispatchEvent(new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        button: 2,
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2
      }));
    })()`);
    await sleep(250);
    const labels = await evaluate(
      'Array.from(document.querySelectorAll(".image-context-menu .menu-item-label")).map((node) => node.textContent)',
    );
    assert(
      JSON.stringify(labels) ===
        JSON.stringify([
          "查看图片",
          "适应：包含",
          "适应：覆盖",
          "原始尺寸",
          "复制图片路径",
          "打开图片",
          "在文件夹中显示",
        ]),
      "image context menu is incomplete",
      labels,
    );
    await evaluate(
      'document.querySelector(".image-context-menu .menu-item")?.click()',
    );
    await sleep(250);
    assert(
      await evaluate('Boolean(document.querySelector(".image-lightbox"))'),
      "view image should open the lightbox",
    );
    await press("Escape", "Escape", 27);
    await evaluate('window.__MARKSI_DEV__.getState().setViewMode("preview")');
  });

  await test("image fit controls update the rendered image and reset cleanly", async () => {
    await resetBase();
    const imageDoc = resolve(fixtureDir, "image-fit.md");
    await writeFile(imageDoc, "![icon](icon.png)\n", "utf8");
    await evaluate(
      `window.__MARKSI_DEV__.openPath(${JSON.stringify(imageDoc)})`,
    );
    await waitFor(
      'window.__MARKSI_DEV__.getState().doc.path === ' +
        JSON.stringify(imageDoc),
      10_000,
    );
    await evaluate('window.__MARKSI_DEV__.getState().setViewMode("reading")');
    await waitFor(
      'document.querySelector("img.markdown-image[data-marksi-resolved]")',
      10_000,
    );
    await sleep(250);

    async function openImageMenu() {
      await evaluate(`(() => {
        const image = document.querySelector("img.markdown-image");
        const box = image.getBoundingClientRect();
        image.dispatchEvent(new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX: box.left + box.width / 2,
          clientY: box.top + box.height / 2
        }));
      })()`);
      await sleep(220);
    }

    async function clickImageMenuLabel(label) {
      const clicked = await evaluate(`(() => {
        const button = Array.from(document.querySelectorAll(".image-context-menu .menu-item"))
          .find((node) => node.textContent?.includes(${JSON.stringify(label)}));
        button?.click();
        return Boolean(button);
      })()`);
      assert(clicked, `image menu action missing: ${label}`);
      await sleep(450);
    }

    await openImageMenu();
    await clickImageMenuLabel("适应：包含");
    const contained = await evaluate(`({
      content: window.__MARKSI_DEV__.getState().doc.content,
      fit: document.querySelector("img.markdown-image")?.getAttribute("data-fit"),
      objectFit: getComputedStyle(document.querySelector("img.markdown-image")).objectFit
    })`);
    assert(
      contained.content.includes("fit=contain") &&
        contained.content.includes("width=") &&
        contained.content.includes("height="),
      "contain fit did not write dimensions and fit to source",
      contained,
    );
    assert(contained.fit === "contain", "contain fit was not rendered", contained);
    assert(contained.objectFit === "contain", "contain object-fit missing", contained);

    await openImageMenu();
    await clickImageMenuLabel("适应：覆盖");
    const covered = await evaluate(`({
      content: window.__MARKSI_DEV__.getState().doc.content,
      fit: document.querySelector("img.markdown-image")?.getAttribute("data-fit"),
      objectFit: getComputedStyle(document.querySelector("img.markdown-image")).objectFit
    })`);
    assert(covered.content.includes("fit=cover"), "cover fit was not written", covered);
    assert(covered.fit === "cover", "cover fit was not rendered", covered);
    assert(covered.objectFit === "cover", "cover object-fit missing", covered);

    await openImageMenu();
    await clickImageMenuLabel("原始尺寸");
    const reset = await evaluate(`({
      content: window.__MARKSI_DEV__.getState().doc.content,
      fit: document.querySelector("img.markdown-image")?.getAttribute("data-fit"),
      width: document.querySelector("img.markdown-image")?.getAttribute("width"),
      height: document.querySelector("img.markdown-image")?.getAttribute("height")
    })`);
    assert(reset.content === "![icon](icon.png)\n", "original size did not reset source", reset);
    assert(reset.fit === null, "original size left data-fit behind", reset);
    assert(reset.width === null && reset.height === null, "original size left dimensions", reset);
    await resetBase();
  });

  await test("image width attributes, drag write-back, and undo work", async () => {
    await resetBase();
    const imageDoc = resolve(fixtureDir, "image-resize.md");
    await writeFile(
      imageDoc,
      [
        "```markdown",
        "![inside code](icon.png)",
        "```",
        "",
        "![icon][img]{width=120}",
        "",
        "[img]: icon.png",
        "",
      ].join("\n"),
      "utf8",
    );
    await evaluate(
      `window.__MARKSI_DEV__.openPath(${JSON.stringify(imageDoc)})`,
    );
    await waitFor(
      'window.__MARKSI_DEV__.getState().doc.path === ' +
        JSON.stringify(imageDoc),
      10_000,
    );
    await evaluate('window.__MARKSI_DEV__.getState().setViewMode("reading")');
    await waitFor('document.querySelector(".markdown-image-frame img.markdown-image")');
    await sleep(250);
    const before = await evaluate(`(() => {
      const image = document.querySelector(".markdown-image-frame img.markdown-image");
      return {
        widthAttribute: image?.getAttribute("width"),
        width: image?.getBoundingClientRect().width ?? null,
        handle: Boolean(document.querySelector(".image-resize-handle"))
      };
    })()`);
    assert(before.widthAttribute === "120", "width attribute was not rendered", before);
    assert(before.handle, "image resize handle missing", before);
    const handlePoint = await evaluate(`(() => {
      const box = document.querySelector(".image-resize-handle").getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    })()`);
    await send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: handlePoint.x,
      y: handlePoint.y,
    });
    await sleep(120);
    await send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: handlePoint.x,
      y: handlePoint.y,
      button: "left",
      buttons: 1,
      clickCount: 1,
    });
    await send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: handlePoint.x + 40,
      y: handlePoint.y,
      button: "left",
      buttons: 1,
    });
    await send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: handlePoint.x + 40,
      y: handlePoint.y,
      button: "left",
      buttons: 0,
      clickCount: 1,
    });
    await sleep(500);
    const content = await evaluate(
      "window.__MARKSI_DEV__.getState().doc.content",
    );
    assert(
      content.includes("![icon][img]{width=160}"),
      "drag did not write the reference image width",
      content,
    );
    assert(
      content.includes("![inside code](icon.png)"),
      "drag modified image syntax inside a code fence",
      content,
    );
    await evaluate(
      "window.__MARKSI_DEV__.getState().updateSettings({ readOnlyMode: true })",
    );
    await waitFor(
      '!document.querySelector(".image-resize-handle")',
      5_000,
    );
    await evaluate(
      "window.__MARKSI_DEV__.getState().updateSettings({ readOnlyMode: false })",
    );
    await evaluate('window.__MARKSI_DEV__.getState().setViewMode("preview")');
    await clickSelector(".cm-content");
    await keyWithCtrl("z", "KeyZ", 90);
    await sleep(350);
    const undone = await evaluate(
      "window.__MARKSI_DEV__.getState().doc.content",
    );
    assert(
      undone.includes("width=120") && !undone.includes("width=160"),
      "image resize should be undoable without resetting editor history",
      undone,
    );
    await keyWithCtrl("y", "KeyY", 89);
    await sleep(350);
    const redone = await evaluate(
      "window.__MARKSI_DEV__.getState().doc.content",
    );
    assert(
      redone.includes("width=160"),
      "image resize redo did not restore the new width",
      redone,
    );
  });

  await test("image height handle writes height back", async () => {
    await resetBase();
    const imageDoc = resolve(fixtureDir, "image-height.md");
    await writeFile(imageDoc, "![icon](icon.png)\n", "utf8");
    await evaluate(
      `window.__MARKSI_DEV__.openPath(${JSON.stringify(imageDoc)})`,
    );
    await waitFor(
      'window.__MARKSI_DEV__.getState().doc.path === ' +
        JSON.stringify(imageDoc),
      10_000,
    );
    await evaluate('window.__MARKSI_DEV__.getState().setViewMode("reading")');
    await waitFor(
      'document.querySelector("img.markdown-image[data-marksi-resolved]")',
      10_000,
    );
    await sleep(250);
    const before = await evaluate(`(() => {
      const image = document.querySelector("img.markdown-image");
      const box = image.getBoundingClientRect();
      return { height: box.height, width: box.width };
    })()`);
    const heightHandlePoint = await evaluate(`(() => {
      const box = document.querySelector('.image-resize-handle[data-axis="height"]').getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    })()`);
    await send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: heightHandlePoint.x,
      y: heightHandlePoint.y,
    });
    await sleep(120);
    await send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: heightHandlePoint.x,
      y: heightHandlePoint.y,
      button: "left",
      buttons: 1,
      clickCount: 1,
    });
    await send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: heightHandlePoint.x,
      y: heightHandlePoint.y + 30,
      button: "left",
      buttons: 1,
    });
    await send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: heightHandlePoint.x,
      y: heightHandlePoint.y + 30,
      button: "left",
      buttons: 0,
      clickCount: 1,
    });
    await sleep(450);
    const content = await evaluate(
      "window.__MARKSI_DEV__.getState().doc.content",
    );
    const expectedHeight = Math.round(before.height + 30);
    assert(
      content.includes(`height=${expectedHeight}`),
      "height drag did not write height back",
      { content, before, expectedHeight },
    );
    assert(
      content.includes("![icon](icon.png){"),
      "height was not written as an image attribute block",
      content,
    );
    const rendered = await evaluate(`(() => {
      const image = document.querySelector("img.markdown-image");
      return {
        heightAttribute: image?.getAttribute("height"),
        height: image?.getBoundingClientRect().height ?? null
      };
    })()`);
    assert(
      rendered.heightAttribute === String(expectedHeight),
      "height attribute was not rendered",
      rendered,
    );
    await evaluate(
      'document.querySelector(\'.image-resize-handle[data-axis="height"]\')?.focus()',
    );
    await press("ArrowDown", "ArrowDown", 40);
    await sleep(350);
    const keyboardContent = await evaluate(
      "window.__MARKSI_DEV__.getState().doc.content",
    );
    assert(
      keyboardContent.includes(`height=${expectedHeight + 20}`),
      "keyboard height adjustment did not update the source",
      keyboardContent,
    );
    await resetBase();
  });

  await test("recent files reveal per-item close and File > Clear recent files", async () => {
    const saved = await evaluate("window.__MARKSI_DEV__.getState().recent");
    const recentOne = resolve(fixtureDir, "recent-one.md");
    const recentTwo = resolve(fixtureDir, "recent-two.md");
    await evaluate(
      `window.__MARKSI_DEV__.getState().addRecent(${JSON.stringify(recentOne)}); window.__MARKSI_DEV__.getState().addRecent(${JSON.stringify(recentTwo)}); window.__MARKSI_DEV__.getState().setSidebarTab("files")`,
    );
    await waitFor('document.querySelectorAll(".recent-item").length >= 2');
    await send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: 700,
      y: 300,
      button: "none",
    });
    await sleep(220);
    const beforeHover = await evaluate(
      'getComputedStyle(document.querySelector(".recent-remove")).opacity',
    );
    assert(beforeHover === "0", "recent close should be hidden by default", beforeHover);

    const itemPoint = await evaluate(`(() => {
      const box = document.querySelector(".recent-item").getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    })()`);
    await send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: itemPoint.x,
      y: itemPoint.y,
      button: "none",
    });
    await sleep(250);
    const afterHover = await evaluate(`({
      opacity: getComputedStyle(document.querySelector(".recent-remove")).opacity,
      pointer: getComputedStyle(document.querySelector(".recent-remove")).pointerEvents
    })`);
    assert(afterHover.opacity === "1", "recent close should appear on hover", afterHover);
    assert(afterHover.pointer === "auto", "recent close should be clickable on hover", afterHover);

    await clickSelector(".recent-item .recent-remove");
    await sleep(200);
    const afterRemove = await evaluate(`({
      hasRemoved: window.__MARKSI_DEV__.getState().recent.some((entry) => entry.path.includes("recent-two.md")),
      count: window.__MARKSI_DEV__.getState().recent.length
    })`);
    assert(!afterRemove.hasRemoved, "per-item close did not remove the recent entry", afterRemove);

    await clickSelector(".menu-button");
    await clickSelector(".menu-bar-item");
    await waitFor(
      'Array.from(document.querySelectorAll(".menu-dropdown .menu-item-label")).some((node) => node.textContent?.includes("清除最近文件"))',
    );
    const clearButton = await evaluate(`(() => {
      const button = Array.from(document.querySelectorAll(".menu-dropdown .menu-item")).find((node) => node.textContent?.includes("清除最近文件"));
      if (!button) return null;
      const box = button.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2, disabled: button.disabled };
    })()`);
    assert(clearButton && !clearButton.disabled, "clear recent item should be enabled", clearButton);
    await clickPoint(clearButton.x, clearButton.y);
    await sleep(250);
    const afterClear = await evaluate(`({
      count: window.__MARKSI_DEV__.getState().recent.length,
      items: document.querySelectorAll(".recent-item").length,
      empty: document.querySelector(".recent-empty")?.textContent ?? null
    })`);
    assert(afterClear.count === 0, "clear recent did not empty the store", afterClear);
    assert(afterClear.items === 0, "recent UI still has items", afterClear);
    assert(afterClear.empty?.includes("暂无最近文档"), "empty recent copy is missing", afterClear);

    await evaluate(`(async () => {
      const { useAppStore } = await import("/src/store/useAppStore.ts");
      useAppStore.setState({ recent: ${JSON.stringify(saved)} });
    })()`);
    await sleep(200);
  });

  await test("zoom shortcuts and reset work", async () => {
    await resetBase();
    await clickSelector(".cm-content");
    const before = await evaluate(`({
      zoom: window.__MARKSI_DEV__.getState().settings.zoomLevel,
      width: window.innerWidth,
      cssZoom: document.documentElement.style.getPropertyValue("zoom")
    })`);
    await keyWithCtrl("=", "Equal", 187);
    const zoomed = await evaluate(`({
      zoom: window.__MARKSI_DEV__.getState().settings.zoomLevel,
      width: window.innerWidth,
      cssZoom: document.documentElement.style.getPropertyValue("zoom")
    })`);
    assert(zoomed.zoom > before.zoom, "Ctrl+= should zoom in", { before, zoomed });
    await keyWithCtrl("0", "Digit0", 48);
    const reset = await evaluate(
      "window.__MARKSI_DEV__.getState().settings.zoomLevel",
    );
    assert(reset === 1, "Ctrl+0 should reset zoom", reset);
  });

  await test("cleanup leaves a blank preview and removes fixtures from recent", async () => {
    await evaluate(`(async () => {
      const dev = window.__MARKSI_DEV__;
      dev.getState().setViewMode("preview");
      dev.getState().newDocument();
      dev.getState().resetSettings();
      const { useAppStore } = await import("/src/store/useAppStore.ts");
      useAppStore.setState((state) => ({
        recent: state.recent.filter((entry) => !entry.path.includes(".tmp/e2e-fixtures"))
      }));
      localStorage.removeItem("marksi-recovery-draft");
      await new Promise((resolve) => setTimeout(resolve, 900));
      localStorage.removeItem("marksi-recovery-draft");
      document.querySelector(".cm-content")?.blur();
    })()`);
    const state = await evaluate(`({
      viewMode: window.__MARKSI_DEV__.getState().viewMode,
      content: window.__MARKSI_DEV__.getState().doc.content,
      recent: window.__MARKSI_DEV__.getState().recent.map((entry) => entry.path)
    })`);
    assert(state.viewMode === "preview", "cleanup should restore preview", state);
    assert(state.content === "", "cleanup should leave an empty document", state);
    assert(
      !state.recent.some((path) => path.includes(".tmp/e2e-fixtures")),
      "fixture paths should be removed from recent",
      state,
    );
  });

  await rm(fixtureDir, { recursive: true, force: true });
  socket.close();

  const failed = results.filter((result) => !result.ok);
  console.log("");
  console.log(
    `${results.length - failed.length}/${results.length} E2E checks passed.`,
  );
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
  if (socket) {
    socket.close();
  }
  await rm(fixtureDir, { recursive: true, force: true }).catch(() => {});
});
