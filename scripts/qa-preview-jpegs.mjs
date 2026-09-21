import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "qa");
const files = fs.readdirSync(dir).filter((f) => f.startsWith("inquiry-") && f.endsWith(".png"));
for (const file of files) {
  const src = path.join(dir, file);
  const dest = path.join(dir, file.replace(".png", ".jpg"));
  await sharp(src).jpeg({ quality: 72 }).resize({ width: 1200, withoutEnlargement: true }).toFile(dest);
  console.log(file, fs.statSync(src).size, "->", dest);
}
