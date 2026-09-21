import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "qa");
fs.mkdirSync(outDir, { recursive: true });

const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const userData = path.join(process.env.TEMP || "C:/Windows/Temp", `qa-inquiry-${Date.now()}`);
const port = 9334 + Math.floor(Math.random() * 80);
const url = process.argv[2] || "http://127.0.0.1:5173/";
const width = Number(process.argv[3] || 1440);
const height = Number(process.argv[4] || 1024);
const suffix = width <= 430 ? "-m" : "";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(u) {
  const res = await fetch(u);
  if (!res.ok) throw new Error(`${res.status} ${u}`);
  return res.json();
}

function wsCall(ws, id, method, params = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout ${method}`)), 25000);
    const onMsg = (event) => {
      const data = JSON.parse(event.data);
      if (data.id === id) {
        clearTimeout(timer);
        ws.removeEventListener("message", onMsg);
        if (data.error) reject(new Error(JSON.stringify(data.error)));
        else resolve(data.result);
      }
    };
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const chromeProc = spawn(chrome, [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userData}`,
  `--window-size=${width},${height}`,
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "--hide-scrollbars",
  url,
], { stdio: ["ignore", "pipe", "pipe"] });

let stderr = "";
chromeProc.stderr.on("data", (d) => { stderr += d.toString(); });

try {
  const home = await fetch(url);
  const html = await home.text();
  fs.writeFileSync(path.join(outDir, "inquiry-home.txt"), `status ${home.status} len ${html.length}\n${html.slice(0, 400)}`);
  await sleep(1800);
  const list = await fetchJson(`http://127.0.0.1:${port}/json/list`);
  const page = list.find((t) => t.type === "page") || list[0];
  if (!page) throw new Error("no page target\n" + stderr.slice(0, 400));

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });

  let id = 0;
  const send = (method, params) => wsCall(ws, ++id, method, params);

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: 1, mobile: width <= 430,
  });
  await send("Page.bringToFront");
  await send("Page.reload", { ignoreCache: true });
  await sleep(2500);

  const waitEnter = async () => {
    for (let i = 0; i < 80; i += 1) {
      const result = await send("Runtime.evaluate", {
        expression: `({
          ready: !document.querySelector('.prelude-btn--primary')?.disabled && !!document.querySelector('.prelude-btn--primary'),
          entered: !document.querySelector('.lab-loader') || document.querySelector('.lab-loader.is-leaving') || !!document.querySelector('.project-cover-card'),
          btn: document.querySelector('.prelude-btn--primary')?.textContent || '',
          cards: document.querySelectorAll('.project-cover-card').length
        })`,
        returnByValue: true,
      });
      const value = result.result.value;
      if (value.entered && value.cards > 0) return value;
      await send("Runtime.evaluate", {
        expression: `(() => {
          const btn = document.querySelector('.prelude-btn--primary');
          if (!btn) return false;
          btn.disabled = false;
          btn.click();
          return true;
        })()`,
      });
      await sleep(1600);
    }
    const dump = await send("Runtime.evaluate", {
      expression: `({
        title: document.title,
        href: location.href,
        body: (document.body?.innerText || '').slice(0, 600),
        html: (document.getElementById('root')?.innerHTML || '').slice(0, 500),
        loader: !!document.querySelector('.lab-loader'),
        btn: document.querySelector('.prelude-btn--primary')?.outerHTML || '',
        disabled: document.querySelector('.prelude-btn--primary')?.disabled,
      })`,
      returnByValue: true,
    });
    fs.writeFileSync(path.join(outDir, "inquiry-timeout.json"), JSON.stringify(dump.result.value, null, 2));
    throw new Error("enter timeout");
  };

  const entered = await waitEnter();
  fs.writeFileSync(path.join(outDir, "inquiry-enter.json"), JSON.stringify(entered, null, 2));

  await send("Runtime.evaluate", {
    expression: `document.getElementById('projects')?.scrollIntoView({block:'start'}); true;`,
  });
  await sleep(900);

  const shot = async (name) => {
    try {
      const pic = await send("Page.captureScreenshot", { format: "png" });
      if (!pic?.data) {
        fs.writeFileSync(path.join(outDir, `${name}.err.txt`), JSON.stringify(pic || {}));
        return;
      }
      fs.writeFileSync(path.join(outDir, name), Buffer.from(pic.data, "base64"));
    } catch (err) {
      fs.writeFileSync(path.join(outDir, `${name}.err.txt`), err.message);
    }
  };

  const captureProject = async (index, slug) => {
    await send("Runtime.evaluate", {
      expression: `
        document.querySelectorAll('.project-cover-card')[${index}]?.click();
        true;
      `,
    });
    await sleep(1200);
    const info = await send("Runtime.evaluate", {
      expression: `(() => {
        const stage = document.querySelector('.case-stage');
        const inquiry = document.querySelector('.inquiry');
        if (stage) stage.scrollTop = 0;
        const overflow = [...(inquiry?.querySelectorAll('*') || [])]
          .filter((el) => el.scrollWidth > el.clientWidth + 4)
          .slice(0, 8)
          .map((el) => ({ cls: el.className, sw: el.scrollWidth, cw: el.clientWidth, text: (el.innerText || '').slice(0, 40) }));
        return {
          title: document.getElementById('project-title')?.textContent || '',
          style: [...document.querySelector('.detail-overlay')?.classList || []],
          inquiryClass: inquiry?.className || '',
          inquiryBox: inquiry ? { w: Math.round(inquiry.getBoundingClientRect().width), h: Math.round(inquiry.getBoundingClientRect().height) } : null,
          stageBox: stage ? { w: Math.round(stage.clientWidth), h: Math.round(stage.clientHeight), sh: stage.scrollHeight } : null,
          overflow,
          inquiryText: inquiry?.innerText?.slice(0, 500) || '',
          hasJourney: !!document.querySelector('.inq-journey'),
          hasMatrix: !!document.querySelector('.inq-matrix'),
          hasHeatmap: !!document.querySelector('.inq-heatmap'),
          hasMoves: document.querySelectorAll('.case-moves li').length,
          hasPains: document.querySelectorAll('.pain-card').length,
          hasResearchCards: document.querySelectorAll('.case-research article').length,
          overview: document.querySelector('.case-block__lead')?.textContent || '',
          blocks: [...document.querySelectorAll('.case-block__head strong')].map((n) => n.textContent)
        };
      })()`,
      returnByValue: true,
    });
    fs.writeFileSync(path.join(outDir, `inquiry-${slug}${suffix}.json`), JSON.stringify(info?.result?.value || info, null, 2));
    await sleep(300);
    await shot(`inquiry-${slug}${suffix}-top.png`);

    await send("Runtime.evaluate", {
      expression: `document.querySelector('.inquiry')?.scrollIntoView({block:'start'}); true;`,
    });
    await sleep(400);
    await shot(`inquiry-${slug}${suffix}-research.png`);
    const clip = await send("Runtime.evaluate", {
      expression: `(() => {
        const el = document.querySelector('.inquiry');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(r.width, ${width}), height: Math.min(r.height, ${height} - 40), scale: 1 };
      })()`,
      returnByValue: true,
    });
    const box = clip.result.value;
    if (box?.width > 20 && box?.height > 20) {
      try {
        const pic = await send("Page.captureScreenshot", {
          format: "png",
          fromSurface: true,
          clip: {
            x: Math.round(box.x),
            y: Math.round(box.y),
            width: Math.round(box.width),
            height: Math.round(box.height),
            scale: 1,
          },
        });
        if (pic?.data) fs.writeFileSync(path.join(outDir, `inquiry-${slug}${suffix}-clip.png`), Buffer.from(pic.data, "base64"));
      } catch (err) {
        fs.writeFileSync(path.join(outDir, `inquiry-${slug}-clip-error.txt`), err.message);
      }
    }

    await send("Runtime.evaluate", {
      expression: `document.querySelector('.case-moves')?.scrollIntoView({block:'start'}); true;`,
    });
    await sleep(400);
    await shot(`inquiry-${slug}${suffix}-moves.png`);

    await send("Runtime.evaluate", {
      expression: `document.querySelector('.overlay-fixed-close')?.click(); true;`,
    });
    await sleep(500);
  };

  await captureProject(0, "cdez");
  await captureProject(1, "mystery");
  await captureProject(2, "wanying");

  console.log("ok", outDir);
  ws.close();
} catch (error) {
  console.error("FAIL", error.message);
  console.error(stderr.slice(0, 800));
  process.exitCode = 1;
} finally {
  chromeProc.kill();
}
