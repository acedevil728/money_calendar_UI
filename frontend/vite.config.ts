import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // proxy to backend during dev to avoid CORS; adjust if backend runs elsewhere
    proxy: {
      "/api": "http://localhost:8000"
    }
  }
});
