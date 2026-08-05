import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gh = "C:\\PROGRA~1\\GITHUB~1\\gh.exe";
const token = execFileSync(gh, ["auth", "token"], { encoding: "utf8" }).trim();
if (!token) throw new Error("No GitHub token");

const url = `https://x-access-token:${token}@github.com/zen920307-ai/portfolio.git`;
const run = (args) => {
  const result = spawnSync("git", ["-c", "credential.helper=", ...args], {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) throw new Error(`git ${args[0]} failed with ${result.status}`);
};

console.log("Pushing HEAD:main to GitHub...");
run(["push", url, "HEAD:main"]);
console.log("Push complete.");
run(["fetch", url, "+refs/heads/*:refs/remotes/origin/*"]);
console.log("Fetch complete.");
