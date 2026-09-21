import React, { lazy, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import "./styles.css";

const Admin = lazy(() => import("./Admin.jsx").then((module) => ({ default: module.Admin })));
const isAdmin = window.location.pathname === "/admin";

// Defer application layout effects until the asynchronously loaded stylesheet
// is applied. The independent HTML backdrop stays visible during this wait.
const stylesReady = Promise.all([...document.querySelectorAll("link[data-app-style]")].map((link) =>
  link.sheet ? Promise.resolve() : new Promise((resolve, reject) => {
    if (link.dataset.failed) return reject(new Error("STYLES_UNAVAILABLE"));
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", reject, { once: true });
  })));

function StartupHandoff({ children }) {
  useEffect(() => {
    let cancelled = false;
    const poster = new Image();
    poster.src = "/assets/video/cloud-entry-poster.webp";
    const backdrop = isAdmin ? Promise.resolve() : poster.decode().catch(() => {});
    backdrop.then(() => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (cancelled) return;
        const scene = document.getElementById("boot-scene");
        scene?.classList.add("is-ready");
        window.setTimeout(() => scene?.remove(), 400);
      }));
    });
    return () => { cancelled = true; };
  }, []);
  return children;
}

stylesReady.then(() => createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isAdmin ? <Suspense fallback={null}><StartupHandoff><Admin /></StartupHandoff></Suspense> : <StartupHandoff><App /></StartupHandoff>}
  </React.StrictMode>,
)).catch(() => {
  const message = document.querySelector("#boot-scene p");
  if (message) message.innerHTML = '页面加载遇到问题，<a href="" style="color:inherit">点击重新加载</a>';
});
