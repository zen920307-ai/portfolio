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

const repository = "https://github.com/zen920307-ai/portfolio.git";
let remote = repository;
let usesGhToken = false;
try {
  const token = execFileSync(gh, ["auth", "token"], { encoding: "utf8" }).trim();
  remote = `https://x-access-token:${token}@github.com/zen920307-ai/portfolio.git`;
  usesGhToken = true;
} catch {
  // Git Credential Manager can still hold a valid repository credential even
  // when the optional GitHub CLI session has expired.
  console.warn("GitHub CLI token unavailable; using the saved Git credential.");
}
const work = mkdtempSync(path.join(tmpdir(), "portfolio-gh-pages-"));

try {
  // Start from the live branch rather than an empty repository. CMS uploads
  // are written directly to assets/admin-uploads at runtime and are not part
  // of the Vite build output; an empty deploy would silently delete them.
  execSync(`git clone --depth 1 --branch gh-pages ${remote} .`, { cwd: work, stdio: "inherit", shell: true });
  execSync('git config user.email "zen92@foxmail.com"', { cwd: work, shell: true });
  execSync('git config user.name "Tang Qidong"', { cwd: work, shell: true });
  cpSync(dist, work, { recursive: true });
  writeFileSync(path.join(work, "CNAME"), "design.zenslab.top\n");
  // No Jekyll processing for media/assets paths starting with underscore.
  writeFileSync(path.join(work, ".nojekyll"), "");
  execSync("git add -A", { cwd: work, stdio: "ignore", shell: true });
  // A content-only publish may already have brought the branch up to date.
  // Do not treat that normal state as a deployment failure.
  let hasChanges = true;
  try {
    execSync("git diff --cached --quiet", { cwd: work, stdio: "ignore", shell: true });
    hasChanges = false;
  } catch {
    // git diff exits with 1 when staged changes exist.
  }
  if (!hasChanges) {
    console.log("No static deploy changes.");
    process.exit(0);
  }
  execSync("git commit -q -m " + JSON.stringify("Deploy static site to gh-pages"), {
    cwd: work,
    stdio: "inherit",
    shell: true,
  });
  if (usesGhToken) {
    execSync(`git -c credential.helper= push ${remote} HEAD:gh-pages`, {
      cwd: work,
      stdio: "inherit",
      shell: true,
    });
  } else {
    execSync(`git remote set-url origin ${repository}`, { cwd: work, stdio: "inherit", shell: true });
    execSync("git push origin HEAD:gh-pages", { cwd: work, stdio: "inherit", shell: true });
  }
  console.log("gh-pages branch updated.");
} finally {
  rmSync(work, { recursive: true, force: true });
}
