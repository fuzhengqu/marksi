import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const port = process.env.MARKSI_CDP_PORT ?? "9222";
const origin = process.env.MARKSI_E2E_ORIGIN ?? "localhost:1420";
const fixtureDir = resolve(".tmp/e2e-fixtures");
const markdownFixture = resolve(fixtureDir, "fixture.md");
const imageFixture = resolve(fixtureDir, "icon.png");
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

  await test("boots with Chinese UI, preview mode, and welcome screen", async () => {
    const state = await evaluate(`({
      language: document.documentElement.lang,
      viewMode: window.__MARKSI_DEV__.getState().viewMode,
      name: document.querySelector(".document-title")?.textContent,
      welcome: Boolean(document.querySelector(".welcome")),
      live: Boolean(document.querySelector(".cm-live-preview")),
      tabs: Array.from(document.querySelectorAll(".sidebar-tab span")).map((node) => node.textContent)
    })`);
    assert(state.language === "zh-CN", "html lang should be zh-CN", state);
    assert(state.viewMode === "preview", "default view should be preview", state);
    assert(state.name === "未命名.md", "default name should be Chinese", state);
    assert(state.welcome, "initial welcome screen should be visible", state);
    assert(state.live, "live preview should be mounted", state);
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

  await test("IDEA menu replaces the hamburger and restores it on blank click", async () => {
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
    assert(state.labels.includes("HTML 文档…"), "HTML export missing", state);
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
      bottom: Boolean(document.querySelector(".about-button"))
    })`);
    assert(state.buttons.length === 1, "about should have one close control", state);
    assert(!state.bottom, "about footer button must be removed", state);
    await clickSelector(".about-dialog .modal-close");
    await waitFor('!document.querySelector(".about-dialog")');
  });

  await test("new document hides welcome and focuses a blank preview", async () => {
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
    assert(!state.welcome, "welcome should be dismissed", state);
    assert(state.content === "", "new document should be empty", state);
    assert(state.viewMode === "preview", "new document should open in preview", state);
    assert(state.focused, "editor should be focused", state);
    assert(state.toast?.includes("已新建空白文档"), "missing new-document toast", state);
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
        JSON.stringify(["查看图片", "复制图片路径", "打开图片", "在文件夹中显示"]),
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
