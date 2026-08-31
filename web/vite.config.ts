import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://127.0.0.1:8081", "/ws": { target: "ws://127.0.0.1:8081", ws: true } } },
  test: { environment: "jsdom", setupFiles: ["./vitest.setup.ts"], globals: true, exclude: ["e2e/**", "node_modules/**"] },
} as any);
