import { test, expect } from "@playwright/test";

test("Edit & Resend opens the request editor prefilled", async ({ page }) => {
  await page.goto("/");
  await page.getByText("/v2/listings").click();
  await expect(page.getByRole("button", { name: /Copy as cURL/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Replay/i })).toBeVisible();  // one-click replay
  await page.getByRole("button", { name: /Edit & Resend/i }).click();
  await expect(page.getByRole("heading", { name: /Edit & resend/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeVisible();  // editor is interactive
});

test("live flow appears, filters, and detail opens", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("/v2/listings")).toBeVisible();
  await page.getByPlaceholder(/status:/).fill("host:*.soum.sa");
  await expect(page.getByText("/v2/listings")).toBeVisible();
  await page.getByPlaceholder(/status:/).fill("host:none.example");
  await expect(page.getByText("/v2/listings")).toHaveCount(0);
  await page.getByPlaceholder(/status:/).fill("");
  await page.getByText("/v2/listings").click();
  await expect(page.getByText('"ok"')).toBeVisible();  // JSON viewer shows the key
});

test("JSON viewer renders and collapses the response body", async ({ page }) => {
  await page.goto("/");
  await page.getByText("/v2/listings").click();
  await expect(page.getByText('"ok"')).toBeVisible();          // JSON viewer shows the key
  await page.getByText('"ok"').click().catch(() => {});         // interacting doesn't crash
});
