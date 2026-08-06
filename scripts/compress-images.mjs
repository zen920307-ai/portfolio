// Compress images in a folder: downscale to max width and re-encode as JPG.
// Usage: node scripts/compress-images.mjs <dir> [maxWidth]
import { readdirSync, existsSync, mkdirSync, renameSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join, extname, basename } from "node:path";

const dir = process.argv[2];
const maxWidth = Number(process.argv[3] || 1200);
if (!dir || !existsSync(dir)) {
  console.error("Usage: node compress-images.mjs <dir> [maxWidth]");
  process.exit(1);
}

let sharp;
try { sharp = (await import("sharp")).default; } catch { sharp = null; }

if (!sharp) {
  console.error("sharp not installed. Install with: npm i -D sharp");
  process.exit(2);
}

const backupDir = join(dir, "_originals");
if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });

const files = readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f) && !f.startsWith("_"));
let done = 0;
let totalBefore = 0;
let totalAfter = 0;

for (const f of files) {
  const src = join(dir, f);
  const buf = readFileSync(src);
  totalBefore += buf.length;
  const meta = await sharp(buf).metadata();
  let pipeline = sharp(buf);
  if (meta.width && meta.width > maxWidth) {
    pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }
  const outName = basename(f, extname(f)) + ".jpg";
  const out = join(dir, outName);
  const outBuf = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  writeFileSync(out, outBuf);
  totalAfter += outBuf.length;
  // Backup original then remove it from the working dir.
  renameSync(src, join(backupDir, f));
  if (outName !== f && existsSync(join(dir, f))) unlinkSync(join(dir, f));
  done++;
  console.log(`${f} -> ${outName}  ${Math.round(buf.length / 1024)}KB -> ${Math.round(outBuf.length / 1024)}KB`);
}

console.log(`\nDone ${done} files. Total ${Math.round(totalBefore / 1024 / 1024)}MB -> ${Math.round(totalAfter / 1024 / 1024)}MB`);
console.log(`Originals backed up to: ${backupDir}`);
