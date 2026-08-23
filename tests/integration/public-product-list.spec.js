const { test, expect } = require("@playwright/test");
const { attachRuntimeTracking, expectNoRuntimeErrors } = require("./support/ui");

test("Public ProductList loads via base path", async ({ page }) => {
  const runtime = attachRuntimeTracking(page);

  // Test relative root path (which defaults to ProductList for public users)
  await page.goto("./");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("h1")).toHaveText("Danh sách các thực phẩm chay");
  
  // Wait for fetch products
  await page.waitForTimeout(500);

  // Verify fetch products is successful
  expectNoRuntimeErrors(runtime);
});
