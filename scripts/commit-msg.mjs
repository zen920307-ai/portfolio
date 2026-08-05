import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const msg = process.argv[2] || "Update";
execSync("git commit -m " + JSON.stringify(msg), { cwd: root, stdio: "inherit", shell: true });
