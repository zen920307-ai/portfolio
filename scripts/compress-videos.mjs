// Compress the scroll-scrub background videos.
// Strategy: 720p, every frame a keyframe (-g 1), no B-frames, CRF 28.
// This keeps scrub seek instant while cutting size ~5-8x with no perceptible
// quality loss against the heavy vignette + filter backdrop.
// Usage: node scripts/compress-videos.mjs
import { readdirSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const dir = join(process.cwd(), "public", "videos");
const backup = join(dir, "_originals");
if (!existsSync(backup)) mkdirSync(backup, { recursive: true });

const files = readdirSync(dir).filter((f) => /^scroll-\d+\.mp4$/i.test(f));
if (!files.length) {
  console.error("No scroll-*.mp4 found in", dir);
  process.exit(1);
}

let totalBefore = 0;
let totalAfter = 0;

for (const f of files) {
  const src = join(dir, f);
  const tmp = join(dir, `__${f}`);
  const before = statSync(src).size;
  totalBefore += before;

  // -g 1: every frame keyframe → instant scrub seek
  // -bf 0: no B-frames → no reorder delay
  // -pix_fmt yuv420p: max compat (Safari/iOS)
  // -movflags +faststart: moov atom first → stream starts before full download
  const args = [
    "-y",
    "-i", src,
    "-vf", "scale=1280:720",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "28",
    "-g", "1",
    "-keyint_min", "1",
    "-bf", "0",
    "-refs", "1",
    "-pix_fmt", "yuv420p",
    "-an",
    "-movflags", "+faststart",
    tmp,
  ];
  execSync(`ffmpeg ${args.map((a) => a.includes(" ") ? `"${a}"` : a).join(" ")}`, {
    stdio: "inherit",
  });

  // Backup original, replace with compressed.
  renameSync(src, join(backup, f));
  renameSync(tmp, src);
  const after = statSync(src).size;
  totalAfter += after;
  console.log(`${f}: ${Math.round(before / 1024 / 1024 * 100) / 100}MB -> ${Math.round(after / 1024 / 1024 * 100) / 100}MB`);
}

console.log(`\nTotal: ${Math.round(totalBefore / 1024 / 1024 * 100) / 100}MB -> ${Math.round(totalAfter / 1024 / 1024 * 100) / 100}MB`);
console.log(`Originals backed up to: ${backup}`);
