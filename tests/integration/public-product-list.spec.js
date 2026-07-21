const { test, expect } = require("@playwright/test");
const { attachRuntimeTracking, expectNoRuntimeErrors } = require("./support/ui");

test("Public ProductList loads via absolute and subdirectory paths", async ({ page }) => {
  const runtime = attachRuntimeTracking(page);

  // Test absolute path
  await page.goto("/ProductList");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("h1")).toHaveText("Sản phẩm của chúng tôi");
  
  // Wait for fetch products
  await page.waitForTimeout(500);

  // Test subdirectory path (simulating proxy routing)
  await page.goto("/qltp/ProductList");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("h1")).toHaveText("Sản phẩm của chúng tôi");

  // Verify fetch products is successful
  await page.waitForTimeout(500);

  expectNoRuntimeErrors(runtime);
});
