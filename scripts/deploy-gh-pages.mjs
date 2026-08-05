import { execFileSync, execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist", "client");
const gh = "C:\\PROGRA~1\\GITHUB~1\\gh.exe";

if (!existsSync(path.join(dist, "index.html"))) {
  console.log("Building...");
  execSync("npm run build", { cwd: root, stdio: "inherit", shell: true });
}

const token = execFileSync(gh, ["auth", "token"], { encoding: "utf8" }).trim();
const remote = `https://x-access-token:${token}@github.com/zen920307-ai/portfolio.git`;
const work = mkdtempSync(path.join(tmpdir(), "portfolio-gh-pages-"));

try {
  execSync("git init", { cwd: work, stdio: "inherit", shell: true });
  execSync('git config user.email "zen92@foxmail.com"', { cwd: work, shell: true });
  execSync('git config user.name "Tang Qidong"', { cwd: work, shell: true });
  cpSync(dist, work, { recursive: true });
  writeFileSync(path.join(work, "CNAME"), "design.zenslab.top\n");
  // No Jekyll processing for media/assets paths starting with underscore.
  writeFileSync(path.join(work, ".nojekyll"), "");
  execSync("git add -A", { cwd: work, stdio: "inherit", shell: true });
  execSync("git commit -m " + JSON.stringify("Deploy static site to gh-pages"), {
    cwd: work,
    stdio: "inherit",
    shell: true,
  });
  execSync(`git -c credential.helper= push -f ${remote} HEAD:gh-pages`, {
    cwd: work,
    stdio: "inherit",
    shell: true,
  });
  console.log("gh-pages branch updated.");
} finally {
  rmSync(work, { recursive: true, force: true });
}
