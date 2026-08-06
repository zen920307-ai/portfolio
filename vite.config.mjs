import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { libraryImagesPlugin } from "./scripts/library-images-plugin.mjs";

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
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), libraryImagesPlugin()],
});
