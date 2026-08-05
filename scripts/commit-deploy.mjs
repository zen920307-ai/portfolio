import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const msg = "Deploy portfolio to GitHub Pages for design.zenslab.top";
execSync(`git commit -m "${msg}"`, { cwd: root, stdio: "inherit" });
console.log("Committed.");
