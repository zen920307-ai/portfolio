import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const port = 4173;

function killPort(p) {
  try {
    const out = execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${p} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`,
      { encoding: 'utf8' },
    );
    const pids = out.split(/\r?\n/).map((s) => s.trim()).filter((s) => /^\d+$/.test(s));
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log('killed', pid, 'on port', p);
      } catch {
        // ignore
      }
    }
  } catch {
    // no listeners
  }
}

function waitForServer(url, attempts = 120) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const tryOnce = () => {
      n += 1;
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) resolve(true);
        else if (n >= attempts) reject(new Error('bad status'));
        else setTimeout(tryOnce, 250);
      });
      req.on('error', () => {
        if (n >= attempts) reject(new Error('server not ready'));
        else setTimeout(tryOnce, 250);
      });
    };
    tryOnce();
  });
}

killPort(4173);

const node = process.execPath;
const vite = path.join(root, 'node_modules/vite/bin/vite.js');
if (!fs.existsSync(vite)) {
  console.error('vite missing');
  process.exit(1);
}

const child = spawn(node, [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root,
  detached: true,
  stdio: 'ignore',
  windowsHide: true,
});
child.unref();
console.log('spawned vite pid', child.pid);

try {
  await waitForServer(`http://127.0.0.1:${port}/`);
  await waitForServer(`http://127.0.0.1:${port}/src/Admin.jsx`);
  console.log('READY http://127.0.0.1:' + port + '/');
} catch (err) {
  console.error('FAILED', err.message);
  process.exit(1);
}
