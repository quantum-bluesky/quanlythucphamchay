const { test, expect } = require("@playwright/test");
const { attachRuntimeTracking, expectNoRuntimeErrors } = require("./support/ui");

test("Public ProductList preserves cart, supports review quantity edits and sorting", async ({ page }) => {
  const runtime = attachRuntimeTracking(page);

  await page.goto("./");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("h1")).toHaveText("Danh sách các thực phẩm chay");
  
  // 1. Check sort dropdown exists and default is 'name'
  const sortSelect = page.locator("#sortSelect");
  await expect(sortSelect).toBeVisible();
  await expect(sortSelect).toHaveValue("name");

  // Change sort to in_stock and popular
  await sortSelect.selectOption("in_stock");
  await expect(sortSelect).toHaveValue("in_stock");
  await sortSelect.selectOption("popular");
  await expect(sortSelect).toHaveValue("popular");
  await sortSelect.selectOption("name");

  // 2. Select product and verify cart persistence across reload
  const firstCheckbox = page.locator(".item-checkbox").first();
  await firstCheckbox.waitFor({ state: "visible" });
  await firstCheckbox.check();

  const cartBadge = page.locator("#cartCountBadge");
  await expect(cartBadge).toHaveText("1");

  await page.reload();
  await page.waitForLoadState("networkidle");

  await expect(cartBadge).toHaveText("1");
  await expect(firstCheckbox).toBeChecked();

  // 3. Open checkout confirm modal and test quantity adjustment
  await page.locator("#checkoutBtn").click();
  await expect(page.locator("#checkoutModal")).toBeVisible();
  await expect(page.locator("#checkoutReviewItems")).not.toBeEmpty();

  const reviewQtyInput = page.locator(".review-input-qty").first();
  await expect(reviewQtyInput).toHaveValue("1");

  // Click plus button to increase quantity
  const plusBtn = page.locator(".btn-review-qty-plus").first();
  await plusBtn.click();
  await expect(reviewQtyInput).toHaveValue("2");
  await expect(page.locator("#checkoutReviewTotal")).toContainText("2 món");

  // Close modal and verify card on grid is updated to 2
  await page.locator("#closeCheckoutModal").click();
  await expect(page.locator("#checkoutModal")).toBeHidden();
  const firstInputQty = page.locator(".input-qty").first();
  await expect(firstInputQty).toHaveValue("2");

  expectNoRuntimeErrors(runtime);
});


