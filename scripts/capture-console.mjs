import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket } from 'ws';

const outDir = path.join(process.env.TEMP || 'C:/Windows/Temp', 'portfolio-runtime-probe');
fs.mkdirSync(outDir, { recursive: true });

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userData = path.join(outDir, `chrome-profile-${Date.now()}`);
const port = 9333 + Math.floor(Math.random() * 200);
const url = process.argv[2] || 'http://127.0.0.1:4173/';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(u) {
  const res = await fetch(u);
  return res.json();
}

const chromeProc = spawn(chrome, [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userData}`,
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  url,
], { stdio: ['ignore', 'pipe', 'pipe'] });

let stderr = '';
chromeProc.stderr.on('data', (d) => { stderr += d.toString(); });

await sleep(2500);

try {
  const version = await fetchJson(`http://127.0.0.1:${port}/json/version`);
  const list = await fetchJson(`http://127.0.0.1:${port}/json/list`);
  console.log('chrome version', version.Browser);
  console.log('url', url);
  console.log('targets', list.map((t) => t.type + ' ' + t.url).join(' | '));

  const page = list.find((t) => t.type === 'page' && /127\.0\.0\.1|localhost/.test(t.url)) || list.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');

  const logs = [];
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const send = (method, params = {}) => {
      id += 1;
      ws.send(JSON.stringify({ id, method, params }));
      return id;
    };
    let doneId = -1;
    const timer = setTimeout(() => {
      console.log('timeout, logs:', logs.length);
      logs.forEach((l) => console.log(JSON.stringify(l)));
      ws.close();
      resolve();
    }, 10000);

    ws.on('open', () => {
      send('Runtime.enable');
      send('Log.enable');
      send('Network.enable');
      send('Page.enable');
      send('Page.reload', { ignoreCache: true });
      setTimeout(() => {
        doneId = send('Runtime.evaluate', {
          expression: `({
            title: document.title,
            rootLen: document.getElementById('root')?.innerHTML?.length || 0,
            rootHTML: document.getElementById('root')?.innerHTML?.slice(0, 400) || '',
            bodyText: document.body?.innerText?.slice(0, 400) || '',
            scripts: [...document.scripts].map(s => s.src).filter(Boolean)
          })`,
          returnByValue: true,
        });
      }, 4000);
    });

    ws.on('message', (buf) => {
      const msg = JSON.parse(buf.toString());
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? JSON.stringify(a)).join(' ');
        logs.push({ type: 'console', level: msg.params.type, text });
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        logs.push({
          type: 'exception',
          text: msg.params.exceptionDetails?.exception?.description
            || msg.params.exceptionDetails?.text
            || JSON.stringify(msg.params.exceptionDetails),
        });
      }
      if (msg.method === 'Log.entryAdded') {
        logs.push({ type: 'log', text: msg.params.entry?.text, level: msg.params.entry?.level });
      }
      if (msg.method === 'Network.loadingFailed') {
        logs.push({ type: 'netfail', text: `${msg.params.errorText} ${msg.params.type}` });
      }
      if (msg.id === doneId) {
        clearTimeout(timer);
        const value = msg.result?.result?.value;
        console.log('PAGE_STATE', JSON.stringify(value, null, 2));
        logs.forEach((l) => console.log(JSON.stringify(l)));
        ws.close();
        resolve();
      }
    });
    ws.on('error', reject);
  });
} catch (err) {
  console.error('probe failed', err);
  console.error('stderr', stderr.slice(0, 1000));
} finally {
  chromeProc.kill();
}
