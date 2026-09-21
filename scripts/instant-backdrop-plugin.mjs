import sharp from "sharp";
import path from "node:path";

// Embed a tiny copy of the actual opening frame: first paint needs no image,
// stylesheet or JavaScript round trip. Keep it derived from the source poster.
export function instantBackdropPlugin() {
  let root;
  let preview;
  return {
    name: "instant-backdrop",
    configResolved(config) { root = config.root; },
    transformIndexHtml: {
      order: "post",
      async handler(html) {
        preview ||= sharp(path.join(root, "public/assets/video/cloud-entry-poster.webp"))
          .resize({ width: 480 }).webp({ quality: 40 }).toBuffer();
        const image = (await preview).toString("base64");
        return html.replace("__BOOT_POSTER__", `data:image/webp;base64,${image}`)
          // Vite's production CSS must not block the inline opening scene.
          .replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g, (link) =>
            link.replace('rel="stylesheet"', 'rel="preload" as="style" data-app-style onload="this.onload=null;this.rel=\'stylesheet\'" onerror="this.dataset.failed=\'true\'"'));
      },
    },
  };
}
