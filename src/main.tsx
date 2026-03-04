import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import OverlayApp from "./overlay/OverlayApp";
import "./index.css";

const isOverlay = new URLSearchParams(window.location.search).has("overlay");

if (isOverlay) {
  document.documentElement.classList.add("overlay-mode");
  document.body.classList.add("overlay-mode");
  // Force transparent backgrounds via inline styles (beats Tailwind preflight)
  document.documentElement.style.background = "transparent";
  document.body.style.background = "transparent";
  document.getElementById("root")!.style.background = "transparent";
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isOverlay ? <OverlayApp /> : <App />}
  </React.StrictMode>,
);
