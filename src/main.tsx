import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { startServiceWorker } from "./lib/sw";

startServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Reactが正常に起動したら、index.htmlの一度限りの更新回復フラグを解除する。
requestAnimationFrame(() => sessionStorage.removeItem("abx-navi/chunk-recovery/v1"));
