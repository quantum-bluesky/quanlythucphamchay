const { test, expect } = require("@playwright/test");
const { attachRuntimeTracking, expectNoRuntimeErrors } = require("./support/ui");

test("Public ProductList preserves selected items in cart across reloads", async ({ page }) => {
  const runtime = attachRuntimeTracking(page);

  await page.goto("./");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("h1")).toHaveText("Danh sách các thực phẩm chay");
  
  // Wait for products to render
  const firstCheckbox = page.locator(".item-checkbox").first();
  await firstCheckbox.waitFor({ state: "visible" });
  await firstCheckbox.check();

  // Verify cart bar is visible
  const cartBadge = page.locator("#cartCountBadge");
  await expect(cartBadge).toHaveText("1");

  // Reload page
  await page.reload();
  await page.waitForLoadState("networkidle");

  // Verify cart bar is preserved after reload
  await expect(cartBadge).toHaveText("1");
  await expect(firstCheckbox).toBeChecked();

  // Click checkout button to open modal
  await page.locator("#checkoutBtn").click();
  await expect(page.locator("#checkoutModal")).toBeVisible();
  await expect(page.locator("#checkoutReviewItems")).not.toBeEmpty();

  expectNoRuntimeErrors(runtime);
});

