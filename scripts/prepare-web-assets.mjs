import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const projectRoot = process.cwd();
const publicRoot = path.resolve(projectRoot, "public");
const assetsRoot = path.join(publicRoot, "assets");
const archiveRoot = path.resolve(projectRoot, "asset-source-archive");

function assertInside(candidate, root, label) {
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} escaped its root: ${candidate}`);
  }
}

async function exists(candidate) {
  try { await stat(candidate); return true; } catch { return false; }
}

async function walk(directory) {
  if (!(await exists(directory))) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  }));
  return nested.flat();
}

async function archiveDirectory(relativePath) {
  const source = path.join(publicRoot, relativePath);
  if (!(await exists(source))) return 0;
  const destination = path.join(archiveRoot, "unused-public", relativePath);
  assertInside(source, publicRoot, "Archive source");
  assertInside(destination, archiveRoot, "Archive destination");
  const files = await walk(source);
  const bytes = (await Promise.all(files.map(async (file) => (await stat(file)).size))).reduce((sum, size) => sum + size, 0);
  await mkdir(path.dirname(destination), { recursive: true });
  if (await exists(destination)) {
    await cp(source, destination, { recursive: true, force: true });
    throw new Error(`Archive destination already existed; copied but did not remove source: ${destination}`);
  }
  try {
    await rename(source, destination);
  } catch (error) {
    if (error?.code !== "EPERM") throw error;
    await cp(source, destination, { recursive: true, force: true });
    assertInside(source, publicRoot, "Archive removal");
    await rm(source, { recursive: true, force: true });
  }
  console.log(`[archive] ${relativePath} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
  return bytes;
}

const unusedPublicDirectories = [
  "assets/projects",
  "assets/system",
  "assets/system-library",
  "assets/vibe",
  "assets/works",
  "assets/library/05-graphic/_originals",
  "videos/_originals",
];

let archivedBytes = 0;
for (const directory of unusedPublicDirectories) archivedBytes += await archiveDirectory(directory);

const pngFiles = (await walk(assetsRoot)).filter((file) => file.toLowerCase().endsWith(".png"));
let pngBefore = 0;
let webpAfter = 0;
let converted = 0;

for (const file of pngFiles) {
  assertInside(file, assetsRoot, "PNG source");
  const relative = path.relative(assetsRoot, file);
  const archivedOriginal = path.join(archiveRoot, "png-originals", relative);
  const webpPath = file.slice(0, -4) + ".webp";
  assertInside(archivedOriginal, archiveRoot, "PNG archive");
  assertInside(webpPath, assetsRoot, "WebP output");

  const before = (await stat(file)).size;
  const metadata = await sharp(file).metadata();
  const isQr = /(?:qr|qrcode|二维码)/i.test(path.basename(file));
  await sharp(file, { sequentialRead: true })
    .webp(isQr
      ? { lossless: true, effort: 6 }
      : { quality: 82, alphaQuality: 90, smartSubsample: true, effort: 5 })
    .toFile(webpPath);
  const outputMeta = await sharp(webpPath).metadata();
  if (metadata.width !== outputMeta.width || metadata.height !== outputMeta.height) {
    throw new Error(`Dimension verification failed: ${file}`);
  }

  await mkdir(path.dirname(archivedOriginal), { recursive: true });
  if (!(await exists(archivedOriginal))) await rename(file, archivedOriginal);
  else throw new Error(`Original archive already exists: ${archivedOriginal}`);

  pngBefore += before;
  webpAfter += (await stat(webpPath)).size;
  converted += 1;
  if (converted % 20 === 0 || converted === pngFiles.length) {
    console.log(`[webp] ${converted}/${pngFiles.length}`);
  }
}

for (const relativeFile of ["src/data.js", "src/ProfileBadge.jsx"]) {
  const referenceFile = path.join(projectRoot, relativeFile);
  const source = await readFile(referenceFile, "utf8");
  const updated = source.replace(/\.png(?=["'`])/g, ".webp");
  if (updated !== source) await writeFile(referenceFile, updated, "utf8");
}

console.log(JSON.stringify({
  archivedPublicMB: Number((archivedBytes / 1024 / 1024).toFixed(2)),
  converted,
  pngBeforeMB: Number((pngBefore / 1024 / 1024).toFixed(2)),
  webpAfterMB: Number((webpAfter / 1024 / 1024).toFixed(2)),
  convertedSavedPercent: Number(((pngBefore - webpAfter) / Math.max(1, pngBefore) * 100).toFixed(2)),
}, null, 2));
