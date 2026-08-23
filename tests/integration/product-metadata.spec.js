const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginUser,
  expectNoRuntimeErrors,
  switchMenu,
  waitForAppReady,
} = require("./support/ui");

test("IT-PROD-LIFE-01 product life metadata saves from inline edit", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  await page.goto(process.env.TEST_ADMIN_PATH || "admin");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await waitForAppReady(page);
  await switchMenu(page, "products");

  const firstProduct = page.locator("#productManageList .product-row").first();
  await firstProduct.locator('[data-product-manage-action="edit"]').click();
  await expect(page.locator('[data-manage-input="shelf_life_days"]').first()).toBeVisible();
  await page.locator('[data-manage-input="shelf_life_days"]').first().fill("77");
  await page.locator('[data-manage-input="storage_life_days"]').first().fill("88");
  await page.locator('[data-product-manage-action="save-inline"]').first().click();
  await expect(page.locator("#toast")).toContainText("Đã cập nhật sản phẩm.");
  
  // Verify it appears in the DOM
  await expect(page.locator("#productManageList")).toContainText("Hạn 77 ngày");
  await expect(page.locator("#productManageList")).toContainText("Bảo quản 88 ngày");

  expectNoRuntimeErrors(runtime);
});
