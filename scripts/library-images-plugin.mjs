// Vite plugin: serve a JSON list of images in a public assets directory,
// and auto-compress oversized PNG/JPG in place so dropping a big image in
// never blocks the page. Scans public/assets/library/<dir>.
import { readdirSync, statSync, existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync, readFileSync } from "node:fs";
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
        if (url.pathname === "/api/portfolio-content") {
          const contentFile = join(process.cwd(), "public", "portfolio-content.json");
          if (req.method === "GET") {
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.setHeader("Cache-Control", "no-store");
            res.end(existsSync(contentFile) ? readFileSync(contentFile, "utf8") : "{}"); return;
          }
          if (req.method === "PUT") {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            try {
              const content = JSON.parse(Buffer.concat(chunks).toString("utf8"));
              writeFileSync(contentFile, JSON.stringify(content, null, 2), "utf8");
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(JSON.stringify({ ok: true, source: "local-file" })); return;
            } catch { res.statusCode = 400; res.end("invalid content payload"); return; }
          }
          res.statusCode = 405; res.end("method not allowed"); return;
        }
        if (url.pathname === "/api/content-media" && req.method === "POST") {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const contentType = req.headers["content-type"] || "";
          const boundary = contentType.match(/boundary=(.+)$/)?.[1];
          if (!boundary) { res.statusCode = 400; res.end("missing form boundary"); return; }
          const parts = Buffer.concat(chunks).toString("binary").split(`--${boundary}`);
          const filePart = parts.find((part) => /name="file"/.test(part));
          const group = (parts.find((part) => /name="group"/.test(part))?.match(/\r\n\r\n([^\r\n]+)/)?.[1] || "works").trim();
          const folders = { systemModules: "03-wanying/cms-uploads", projects: "04-projects/cms-uploads", works: "05-graphic/cms-uploads", vibeProjects: "06-vibe/cms-uploads" };
          const filename = filePart?.match(/filename="([^\"]+)"/)?.[1];
          const payload = filePart?.split("\r\n\r\n")[1]?.replace(/\r\n$/, "");
          if (!filename || !payload || !folders[group]) { res.statusCode = 400; res.end("invalid image upload"); return; }
          const ext = extname(filename).toLowerCase();
          if (!/\.(png|jpe?g|webp|gif|avif)$/i.test(ext)) { res.statusCode = 400; res.end("unsupported image"); return; }
          const target = join(process.cwd(), "public", "assets", "library", folders[group]);
          mkdirSync(target, { recursive: true });
          const cleanName = `${Date.now()}-${basename(filename, ext).replace(/[^\w.-]/g, "-")}${ext}`;
          writeFileSync(join(target, cleanName), Buffer.from(payload, "binary"));
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ url: `/assets/library/${folders[group]}/${cleanName}` })); return;
        }
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
