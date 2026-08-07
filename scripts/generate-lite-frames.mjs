import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve("public");
const sourceRoot = path.join(root, "frames");
const outputRoot = path.join(root, "frames-lite");
const scenes = ["scroll-01", "scroll-02", "scroll-03", "scroll-04", "scroll-05"];
const jobs = [];

for (const scene of scenes) {
  const sourceDir = path.join(sourceRoot, scene);
  const outputDir = path.join(outputRoot, scene);
  await mkdir(outputDir, { recursive: true });
  const frames = (await readdir(sourceDir)).filter((file) => file.endsWith(".webp"));
  for (const frame of frames) jobs.push({ source: path.join(sourceDir, frame), output: path.join(outputDir, frame) });
}

let next = 0;
const workers = Array.from({ length: 8 }, async () => {
  while (next < jobs.length) {
    const job = jobs[next];
    next += 1;
    await sharp(job.source)
      .resize({ width: 960, height: 540, fit: "cover" })
      .webp({ quality: 76, effort: 4 })
      .toFile(job.output);
  }
});

await Promise.all(workers);
console.log("Generated " + jobs.length + " lightweight cinematic frames.");
