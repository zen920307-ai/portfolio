// Vite plugin: serve a JSON list of images in a public assets directory,
// and auto-compress oversized PNG/JPG in place so dropping a big image in
// never blocks the page. Scans public/assets/library/<dir>.
import { readdirSync, statSync, existsSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { spawnSync } from "node:child_process";

let sharpP;
async function getSharp() {
  if (sharpP) return sharpP;
  sharpP = import("sharp").then((m) => m.default).catch(() => null);
  return sharpP;
}

async function compressIfNeeded(filePath) {
  const sharp = await getSharp();
  if (!sharp) return;
  const stat = statSync(filePath);
  if (stat.size < 500 * 1024) return; // < 500KB, leave alone
  const ext = extname(filePath).toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".webp"].includes(ext)) return;
  try {
    const { metadata } = await sharp(filePath).stats().then((s) => ({ metadata: s })).catch(() => ({}));
    const meta = await sharp(filePath).metadata();
    let pipeline = sharp(filePath);
    if (meta.width && meta.width > 1400) {
      pipeline = pipeline.resize({ width: 1400, withoutEnlargement: true });
    }
    const outPath = join(filePath.slice(0, -ext.length) + ".jpg");
    await pipeline.jpeg({ quality: 82, mozjpeg: true }).toFile(outPath);
    // Remove the original oversized file if we produced a jpg with a different name.
    if (outPath.toLowerCase() !== filePath.toLowerCase() && existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch (e) {
    // ignore compression errors
  }
}

export function libraryImagesPlugin() {
  return {
    name: "library-images",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://localhost");
        if (!url.pathname.startsWith("/api/library-images")) return next();
        const dir = url.searchParams.get("dir");
        if (!dir) { res.statusCode = 400; res.end("missing dir"); return; }
        const root = join(process.cwd(), "public", "assets", "library", dir);
        if (!existsSync(root)) { res.statusCode = 404; res.end("dir not found"); return; }

        // Auto-compress any oversized images first.
        const files = readdirSync(root).filter((f) => {
          const full = join(root, f);
          try { return statSync(full).isFile() && /\.(png|jpe?g|webp)$/i.test(f) && !f.startsWith("_"); } catch { return false; }
        });
        for (const f of files) {
          await compressIfNeeded(join(root, f));
        }

        // Re-read after compression (names may have changed .png -> .jpg).
        const finalFiles = readdirSync(root).filter((f) => {
          const full = join(root, f);
          try { return statSync(full).isFile() && /\.(png|jpe?g|webp)$/i.test(f) && !f.startsWith("_"); } catch { return false; }
        }).sort((a, b) => a.localeCompare(b, "zh-Hans-CN", { numeric: true }));

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify(finalFiles));
      });
    },
  };
}
