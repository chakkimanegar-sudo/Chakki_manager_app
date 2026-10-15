import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Apply saved theme before first render to prevent flash
const savedTheme = localStorage.getItem("chakki_theme");
if (savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
  document.documentElement.classList.add("dark");
}

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
