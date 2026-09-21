const url = process.argv[2] || 'http://127.0.0.1:4173/';
const html = await (await fetch(url)).text();
console.log('html status ok, len', html.length);
const scriptMatch = html.match(/src="([^"]+\.js)"/);
const cssMatch = html.match(/href="([^"]+\.css)"/);
console.log('script', scriptMatch?.[1]);
console.log('css', cssMatch?.[1]);

if (scriptMatch) {
  const jsUrl = new URL(scriptMatch[1], url).href;
  const js = await (await fetch(jsUrl)).text();
  console.log('js len', js.length);
  console.log('has motion import', /from["']motion/.test(js));
  console.log('has tilted', /tilted-card|TiltedCard|rotateAmplitude/.test(js));
}

// quick headless chrome check via --dump-dom if available
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const out = path.join(process.env.TEMP || 'C:/Windows/Temp', 'portfolio-dom.html');
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
await new Promise((resolve, reject) => {
  const p = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    `--dump-dom`,
    url,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  p.stdout.on('data', (d) => { stdout += d.toString(); });
  p.stderr.on('data', (d) => { stderr += d.toString(); });
  p.on('exit', (code) => {
    fs.writeFileSync(out, stdout);
    console.log('dom len', stdout.length);
    console.log('has portfolio-shell', stdout.includes('portfolio-shell'));
    console.log('has root content', /id="root"[^>]*>\s*<div/.test(stdout) || stdout.includes('portfolio-shell'));
    console.log('title', (stdout.match(/<title>([^<]*)<\/title>/i) || [])[1]);
    if (!stdout.includes('portfolio-shell')) {
      console.log('dom head', stdout.slice(0, 500));
      console.log('stderr', stderr.slice(0, 500));
    }
    resolve(code);
  });
});
