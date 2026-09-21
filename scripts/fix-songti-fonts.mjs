import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const UI = 'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", sans-serif';
const MONO = `ui-monospace, Consolas, ${UI}`;

const replacements = [
  [/ui-monospace,\s*Consolas,\s*monospace/g, MONO],
  [/ui-monospace,\s*Consolas,\s*"PingFang SC",\s*"Microsoft YaHei",\s*"Noto Sans SC",\s*monospace/g, MONO],
  [/ui-monospace,\s*"SFMono-Regular",\s*Consolas,\s*"PingFang SC",\s*"Microsoft YaHei",\s*"Noto Sans SC",\s*monospace/g, MONO],
  [/ui-monospace,\s*Consolas,\s*"PingFang SC",\s*"Microsoft YaHei",\s*sans-serif/g, MONO],
  [/"Inter",\s*"Helvetica Neue",\s*"PingFang SC",\s*"Microsoft YaHei",\s*"Noto Sans SC",\s*sans-serif/g, UI],
  [/"Inter",\s*"PingFang SC",\s*"Microsoft YaHei",\s*sans-serif/g, UI],
  [/Inter,\s*"PingFang SC",\s*"Microsoft YaHei",\s*Arial,\s*sans-serif/g, UI],
  [/Inter,\s*"PingFang SC",\s*"Microsoft YaHei",\s*sans-serif/g, UI],
  [/'SFMono-Regular',\s*'Roboto Mono',\s*'Cascadia Code',\s*'Liberation Mono',\s*Menlo,\s*monospace/g, MONO],
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith(".css")) files.push(full);
  }
  return files;
}

let total = 0;
for (const file of walk(root)) {
  let text = fs.readFileSync(file, "utf8");
  const before = text;
  for (const [pattern, value] of replacements) text = text.replace(pattern, value);
  if (text !== before) {
    fs.writeFileSync(file, text);
    const hits = [...before.matchAll(/monospace|Inter/g)].length - [...text.matchAll(/monospace|Inter/g)].length;
    console.log("updated", path.relative(root, file), "delta", text.length - before.length);
    total += 1;
  }
}
console.log("files", total);
