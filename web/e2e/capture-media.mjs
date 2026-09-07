// Captures docs/media/hero.png and docs/media/demo.webm from a live backend.
// Usage: PROXINO_URL=http://127.0.0.1:8081 node e2e/capture-media.mjs
// (backend must already be running with demo traffic present)
import { chromium } from "@playwright/test";
import { mkdirSync, readdirSync, renameSync } from "node:fs";

const OUT = new URL("../../docs/media/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const BASE = process.env.PROXINO_URL ?? "http://127.0.0.1:8081";
const size = { width: 1400, height: 880 };

const browser = await chromium.launch();

// --- hero: inspector with a JSON response open
{
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2 });
  await page.goto(BASE);
  await page.waitForTimeout(800);
  // The flow table renders only the path (no query string), so target a row
  // by its unique path text: GET /users/1 returns a nested JSON object.
  await page.getByText("/users/1", { exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + "hero.png" });
  await page.close();
}

// --- demo video: ~12 s of realistic use
{
  const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: OUT, size } });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForTimeout(1500);
  const filter = page.getByPlaceholder(/status:/);
  await filter.pressSequentially("status:>=400", { delay: 60 });
  await page.waitForTimeout(1200);
  await filter.fill("");
  // Quick-filter chips in FilterBar.tsx are plain buttons labeled All/GET/POST/4xx/5xx.
  await page.getByRole("button", { name: "POST", exact: true }).click().catch(() => {});
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "All", exact: true }).click().catch(() => {});
  await page.waitForTimeout(400);
  await page.getByText("/users/1", { exact: true }).first().click();
  await page.waitForTimeout(1200);
  // DetailPane.tsx tabs are plain buttons (Overview/Headers/Body/Timing), not role="tab".
  await page.getByRole("button", { name: "Headers", exact: true }).click().catch(() => {});
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Timing", exact: true }).click().catch(() => {});
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Body", exact: true }).click().catch(() => {});
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Edit & Resend", exact: true }).click().catch(() => {});
  await page.waitForTimeout(1500);
  // ReplayModal.tsx has no Escape handler; close it via its Cancel button.
  await page.getByRole("button", { name: "Cancel", exact: true }).click().catch(() => {});
  await page.waitForTimeout(800);
  await ctx.close();
  const webm = readdirSync(OUT).find((f) => f.endsWith(".webm"));
  renameSync(OUT + webm, OUT + "demo.webm");
}
await browser.close();
console.log("wrote", OUT + "hero.png", "and", OUT + "demo.webm");
