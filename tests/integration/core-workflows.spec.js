const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginUser,
  collectToast,
  expectNoRuntimeErrors,
  expectScreenTitle,
  reloadHealthy,
  switchMenu,
} = require("./support/ui");

test("ACC-INV-02 / ACC-PROD-01 inventory, purchases, sales and products stay healthy across navigation", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await expectScreenTitle(page, "Kiểm tra tồn kho");
  await collectToast(page, runtime, "load");

  await page.locator('[data-inventory-flow="in"]').first().click();
  await expectScreenTitle(page, "Nhập hàng");
  await collectToast(page, runtime, "inventory-in-open");
  await reloadHealthy(page, runtime, "reload-purchases", "Nhập hàng");

  await switchMenu(page, "inventory");
  await page.locator('[data-inventory-flow="out"]').first().click();
  await expectScreenTitle(page, "Tạo đơn xuất hàng");
  await collectToast(page, runtime, "inventory-out-open");
  await reloadHealthy(page, runtime, "reload-create-order", "Tạo đơn xuất hàng");

  await switchMenu(page, "products");
  await expectScreenTitle(page, "Sản phẩm");
  await page.locator('[data-product-manage-action="edit"]').first().click();
  await page.waitForTimeout(500);
  await expect(page.locator('[data-product-manage-action="save-inline"]').first()).toBeVisible();
  await collectToast(page, runtime, "products-edit");
  await reloadHealthy(page, runtime, "reload-products", "Sản phẩm");

  expectNoRuntimeErrors(runtime);
});
