import { readFileSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv } from "vite";
import { companionChat } from "../worker/companion-chat.js";

export function companionPlugin() {
  let root, env;
  const getKnowledge = () => readFileSync(resolve(root, "src/companion-knowledge.md"), "utf8");
  return {
    name: "portfolio-companion",
    configResolved(config) { root = config.root; env = { ...loadEnv(config.mode, root, "DEEPSEEK_"), ...process.env }; },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "companion-knowledge.md", source: getKnowledge() });
    },
    closeBundle() { mkdirSync(resolve(root, "dist/server"), { recursive: true }); copyFileSync(resolve(root, "worker/companion-chat.js"), resolve(root, "dist/server/companion-chat.js")); },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split("?")[0] !== "/api/companion-chat") return next();
        try {
          const request = new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers, ...(req.method !== "GET" && req.method !== "HEAD" ? { body: req, duplex: "half" } : {}) });
          const response = await companionChat(request, env, getKnowledge);
          res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text());
        } catch { res.writeHead(500, { "content-type": "application/json" }); res.end(JSON.stringify({ error: "聊天暂时不可用，请稍后再试。" })); }
      });
    },
  };
}
