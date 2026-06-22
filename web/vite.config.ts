import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build output goes to ../public so the Express server can serve the SPA as
// static files (single-process deploy). In dev, /api is proxied to the backend.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../public",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/health": "http://localhost:3000",
    },
  },
});
