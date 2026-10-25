import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { isTauri, setWindowDecorations } from "./lib/platform";
import { useAppStore } from "./store/useAppStore";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/app.css";

async function bootstrap(): Promise<void> {
  if (isTauri()) {
    try {
      await setWindowDecorations(
        useAppStore.getState().settings.nativeTitleBar,
      );
    } catch {
      // The configured frame remains usable if decoration switching fails.
    }
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap();
