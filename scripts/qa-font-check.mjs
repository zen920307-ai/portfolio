import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const userData = path.join(process.env.TEMP || "C:/Windows/Temp", `qa-font-${Date.now()}`);
const port = 9411;
const url = "http://127.0.0.1:5173/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chromeProc = spawn(chrome, [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userData}`,
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  url,
], { stdio: ["ignore", "pipe", "pipe"] });

try {
  await sleep(1800);
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  let id = 0;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const thisId = ++id;
    const timer = setTimeout(() => reject(new Error("timeout " + method)), 20000);
    const onMsg = (event) => {
      const data = JSON.parse(event.data);
      if (data.id === thisId) {
        clearTimeout(timer);
        ws.removeEventListener("message", onMsg);
        if (data.error) reject(new Error(JSON.stringify(data.error)));
        else resolve(data.result);
      }
    };
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify({ id: thisId, method, params }));
  });
  await send("Runtime.enable");
  await send("Page.enable");
  await sleep(1500);
  await send("Runtime.evaluate", {
    expression: `(() => {
      const btn = document.querySelector('.prelude-btn--primary');
      if (btn) { btn.disabled = false; btn.click(); }
      return true;
    })()`,
  });
  await sleep(1800);
  await send("Runtime.evaluate", { expression: `document.getElementById('projects')?.scrollIntoView(); true;` });
  await sleep(600);
  await send("Runtime.evaluate", { expression: `document.querySelectorAll('.project-cover-card')[1]?.click(); true;` });
  await sleep(1200);
  const info = await send("Runtime.evaluate", {
    expression: `(() => {
      const pick = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { sel, text: (el.textContent || '').slice(0, 24), family: cs.fontFamily };
      };
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const width = (font) => { ctx.font = font; return ctx.measureText('调研汉字').width; };
      const sample = document.querySelector('.inq-cast strong, .inq-matrix__row b, .case-block__lead');
      const used = sample ? getComputedStyle(sample).font : '';
      return {
        body: pick('body'),
        lead: pick('.case-block__lead'),
        inquiry: pick('.inq-cast strong') || pick('.inq-matrix__row b') || pick('.inq-heatmap__row b'),
        method: pick('.inq-methods b'),
        simsun: width('16px SimSun'),
        yahei: width('16px "Microsoft YaHei"'),
        used: width(used || '16px sans-serif'),
        usedFont: used,
        hasSong: /SimSun|宋体|Songti|STSong|NSimSun|PMingLiU/i.test([
          pick('body')?.family, pick('.case-block__lead')?.family, pick('.inq-cast strong')?.family, pick('.inq-matrix__row b')?.family
        ].join(' '))
      };
    })()`,
    returnByValue: true,
  });
  const out = path.join(__dirname, "..", "qa", "font-check.json");
  fs.writeFileSync(out, JSON.stringify(info.result.value, null, 2));
  console.log(JSON.stringify(info.result.value, null, 2));
  ws.close();
} finally {
  chromeProc.kill();
}
