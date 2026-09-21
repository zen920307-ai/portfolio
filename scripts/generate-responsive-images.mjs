import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sourceRoot = path.resolve("public/assets");
const outputRoot = path.join(sourceRoot, "responsive");
const widths = [480, 960, 1600];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "responsive" ? [] : walk(full);
    return [full];
  }));
  return nested.flat();
}

const images = (await walk(sourceRoot)).filter((file) => /\.(png|jpe?g|webp)$/i.test(file));
let completed = 0;

for (const source of images) {
  const relative = path.relative(sourceRoot, source);
  const stem = relative.replace(/\.(png|jpe?g|webp)$/i, "");
  for (const width of widths) {
    const output = path.join(outputRoot, `${stem}-${width}.webp`);
    await mkdir(path.dirname(output), { recursive: true });
    await sharp(source, { sequentialRead: true })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78, alphaQuality: 85, effort: 5, smartSubsample: true })
      .toFile(output);
  }
  completed += 1;
  if (completed % 25 === 0 || completed === images.length) console.log(`[responsive] ${completed}/${images.length}`);
}

console.log(`Generated ${images.length * widths.length} responsive WebP files.`);
