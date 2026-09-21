import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const outputDir = path.join(publicDir, "frame-packs");
const frameCount = 240;
const sampleStep = 2;

function sampledIndexes() {
  const indexes = [];
  for (let index = 0; index < frameCount; index += sampleStep) indexes.push(index);
  if (indexes.at(-1) !== frameCount - 1) indexes.push(frameCount - 1);
  return indexes;
}

await mkdir(outputDir, { recursive: true });

for (let segment = 0; segment < 3; segment += 1) {
  const entries = [];
  const chunks = [];
  let offset = 0;
  for (const frameIndex of sampledIndexes()) {
    const filename = `frame-${String(frameIndex + 1).padStart(4, "0")}.webp`;
    const bytes = await readFile(path.join(publicDir, "frames", `scroll-0${segment + 1}`, filename));
    entries.push({ frameIndex, offset, length: bytes.length });
    chunks.push(bytes);
    offset += bytes.length;
  }

  const header = Buffer.from(JSON.stringify({ version: 1, segment, entries }), "utf8");
  const prefix = Buffer.allocUnsafe(8);
  prefix.write("ZFP1", 0, "ascii");
  prefix.writeUInt32LE(header.length, 4);
  await writeFile(
    path.join(outputDir, `boot-0${segment + 1}.zfp`),
    Buffer.concat([prefix, header, ...chunks]),
  );
}

console.log("Prepared three boot frame packs without changing the sampled frame set.");
