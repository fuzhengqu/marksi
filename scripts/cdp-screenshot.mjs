#!/usr/bin/env node
import { writeFile } from "node:fs/promises";

const output = process.argv[2] ?? "marksi-screenshot.png";
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
      method: "Page.captureScreenshot",
      params: {
        format: "png",
        captureBeyondViewport: true,
        fromSurface: true,
      },
    }),
  );
});

socket.close();
const bytes = Buffer.from(result.data, "base64");
await writeFile(output, bytes);
console.log(`${output} (${bytes.length} bytes)`);
