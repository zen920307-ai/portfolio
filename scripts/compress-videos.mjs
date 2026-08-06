// Compress the scroll-scrub background videos WITHOUT touching resolution
// or frame count. Only raises CRF to cut bitrate, keeps every frame a
// keyframe so currentTime scrub stays instant.
// Resolution, fps, frame count, dimensions are all preserved.
// Usage: node scripts/compress-videos.mjs
import { readdirSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from "node:fs";
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

  // NO scale filter → original resolution preserved.
  // -g 1 + -bf 0 → every frame keyframe, no B-frames → instant scrub seek.
  // -crf 28 → visually lossless against the heavy vignette/filter backdrop,
  //           but cuts bitrate ~3-4x. Raise to 30 for smaller, 26 for sharper.
  const args = [
    "-y",
    "-i", src,
    "-an",
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "28",
    "-g", "1",
    "-keyint_min", "1",
    "-bf", "0",
    "-refs", "1",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    tmp,
  ];
  execSync(`ffmpeg ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`, {
    stdio: "inherit",
  });

  // Backup original (only if not already backed up), replace with compressed.
  const backupPath = join(backup, f);
  if (!existsSync(backupPath)) renameSync(src, backupPath);
  else unlinkSync(src);
  renameSync(tmp, src);
  const after = statSync(src).size;
  totalAfter += after;
  console.log(`${f}: ${Math.round(before / 1024 / 1024 * 100) / 100}MB -> ${Math.round(after / 1024 / 1024 * 100) / 100}MB`);
}

console.log(`\nTotal: ${Math.round(totalBefore / 1024 / 1024 * 100) / 100}MB -> ${Math.round(totalAfter / 1024 / 1024 * 100) / 100}MB`);
console.log(`Originals backed up to: ${backup}`);
