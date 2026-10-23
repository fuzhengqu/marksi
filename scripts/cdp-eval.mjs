#!/usr/bin/env node
/**
 * Tiny CDP helper for local MarkSI development.
 *
 * Start the desktop app with the WebView2 remote debugging port enabled:
 *   $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222"
 *   npm run tauri:dev
 *
 * Then evaluate JavaScript in the running page:
 *   node scripts/cdp-eval.mjs "document.title"
 */
const expression = process.argv.slice(2).join(" ");
if (!expression) {
  console.error("usage: node scripts/cdp-eval.mjs <javascript expression>");
  process.exit(2);
}

const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = targets.find(
  (target) => target.type === "page" && target.url.includes("localhost:1420"),
);
if (!page) {
  console.error("No MarkSI page target found on port 9222.");
  process.exit(1);
}

const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let sequence = 0;

socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      reject(new Error(JSON.stringify(message.error)));
    } else {
      resolve(message.result);
    }
  }
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

const result = await new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, { resolve, reject });
  socket.send(
    JSON.stringify({
      id,
      method: "Runtime.evaluate",
      params: {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      },
    }),
  );
});

socket.close();

if (result.exceptionDetails) {
  console.error(JSON.stringify(result.exceptionDetails, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result.result?.value ?? result.result, null, 2));
