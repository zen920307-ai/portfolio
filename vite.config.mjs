import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { libraryImagesPlugin } from "./scripts/library-images-plugin.mjs";
import { companionPlugin } from "./scripts/companion-plugin.mjs";
import { instantBackdropPlugin } from "./scripts/instant-backdrop-plugin.mjs";

export default defineConfig({
  build: {
    outDir: "dist/client",
  },
  assetsInclude: ['**/*.glb'],
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    // Development must read the same published content as the live site.
    // The proxy also avoids browser CORS and local TLS interception issues.
    proxy: {
      "/api/published-content": {
        target: "https://design.zenslab.top",
        changeOrigin: true,
        secure: false,
        rewrite: () => "/portfolio-content.json",
      },
    },
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), companionPlugin(), libraryImagesPlugin(), instantBackdropPlugin()],
});
