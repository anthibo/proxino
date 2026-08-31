import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  webServer: { command: "node e2e/mock-server.mjs", port: 8099, reuseExistingServer: false },
  use: { baseURL: "http://localhost:8099" },
});
