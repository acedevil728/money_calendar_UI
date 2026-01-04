import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // listen on all interfaces so other PCs on the LAN can reach the dev server
    host: true,
    port: 5173,
    // proxy to backend during dev to avoid CORS; adjust if backend runs elsewhere
    proxy: {
      "/api": "http://localhost:8000"
    }
  }
});
