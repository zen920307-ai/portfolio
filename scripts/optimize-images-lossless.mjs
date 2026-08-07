import { createHash } from "node:crypto";
import { copyFile, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve("public/assets");

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  }));
  return nested.flat();
}

function digest(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

const files = await walk(root);
const pngs = files.filter((file) => path.extname(file).toLowerCase() === ".png" && !file.endsWith(".lossless-opt.png"));
const compressedFormats = files.filter((file) => /\.(?:jpe?g|webp)$/i.test(file));
let beforeTotal = 0;
let afterTotal = 0;
let changed = 0;

let cursor = 0;
let completed = 0;

async function optimizeNext() {
  while (cursor < pngs.length) {
  const index = cursor;
  cursor += 1;
  const file = pngs[index];
  const temporary = `${file}.lossless-opt.png`;
  const beforeSize = (await stat(file)).size;
  const beforePixels = await sharp(file, { sequentialRead: true }).raw().toBuffer({ resolveWithObject: true });

  await sharp(file, { sequentialRead: true })
    .png({ compressionLevel: 8, adaptiveFiltering: true, effort: 4, palette: false })
    .toFile(temporary);

  const afterSize = (await stat(temporary)).size;
  const afterPixels = await sharp(temporary, { sequentialRead: true }).raw().toBuffer({ resolveWithObject: true });
  const sameGeometry = beforePixels.info.width === afterPixels.info.width
    && beforePixels.info.height === afterPixels.info.height
    && beforePixels.info.channels === afterPixels.info.channels;
  const samePixels = sameGeometry && digest(beforePixels.data) === digest(afterPixels.data);

  if (!samePixels) {
    await unlink(temporary);
    throw new Error(`Pixel verification failed: ${file}`);
  }

  beforeTotal += beforeSize;
  if (afterSize < beforeSize) {
    await copyFile(temporary, file);
    changed += 1;
    afterTotal += afterSize;
  } else {
    afterTotal += beforeSize;
  }
  await unlink(temporary);

  completed += 1;
  if (completed % 20 === 0 || completed === pngs.length) {
    console.log(`[lossless] ${completed}/${pngs.length}`);
  }
  }
}

await Promise.all(Array.from({ length: Math.min(3, pngs.length) }, () => optimizeNext()));

const saved = beforeTotal - afterTotal;
console.log(JSON.stringify({
  pngFiles: pngs.length,
  optimizedFiles: changed,
  untouchedAlreadyCompressed: compressedFormats.length,
  beforeMB: Number((beforeTotal / 1024 / 1024).toFixed(2)),
  afterMB: Number((afterTotal / 1024 / 1024).toFixed(2)),
  savedMB: Number((saved / 1024 / 1024).toFixed(2)),
  savedPercent: Number((saved / Math.max(1, beforeTotal) * 100).toFixed(2)),
}, null, 2));
