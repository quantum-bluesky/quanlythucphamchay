const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  collectToast,
  expectNoRuntimeErrors,
  expectScreenTitle,
  reloadHealthy,
  switchMenu,
} = require("./support/ui");

test("orders, customers, suppliers, reports and history stay healthy", async ({ page }) => {
  const runtime = attachRuntimeTracking(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await switchMenu(page, "orders");
  await expectScreenTitle(page, "Đơn hàng");
  const orderAction = page.locator('[data-queue-action="open"], [data-queue-action="toggle-detail"]').first();
  if (await orderAction.count()) {
    await orderAction.click();
    await page.waitForTimeout(500);
  }
  await collectToast(page, runtime, "orders-action");

  await switchMenu(page, "customers");
  await expectScreenTitle(page, "Khách hàng");
  const customerEdit = page.locator('[data-customer-action="edit"]').first();
  if (await customerEdit.count()) {
    await customerEdit.click();
    await page.waitForTimeout(500);
    await expect(page.locator("#customerNameInput")).not.toHaveValue("");
  }
  await collectToast(page, runtime, "customers-action");
  await reloadHealthy(page, runtime, "customers-reload", "Khách hàng");

  await switchMenu(page, "suppliers");
  await expectScreenTitle(page, "Nhà cung cấp");
  const supplierEdit = page.locator('[data-supplier-action="edit"]').first();
  if (await supplierEdit.count()) {
    await supplierEdit.click();
    await page.waitForTimeout(500);
    await expect(page.locator("#supplierNameInput")).not.toHaveValue("");
  }
  await collectToast(page, runtime, "suppliers-action");
  await reloadHealthy(page, runtime, "suppliers-reload", "Nhà cung cấp");

  await switchMenu(page, "reports");
  await expectScreenTitle(page, "Báo cáo");
  await page.locator("#reportFiltersToggleButton").click();
  await page.waitForTimeout(300);
  await page.locator("#refreshReportsButton").click();
  await collectToast(page, runtime, "reports-refresh");
  await reloadHealthy(page, runtime, "reports-reload", "Báo cáo");

  await switchMenu(page, "history");
  await expectScreenTitle(page, "Lịch sử & khôi phục");
  const restoreDeletedProduct = page.locator('[data-deleted-product-action="restore"]').first();
  if (await restoreDeletedProduct.count()) {
    await restoreDeletedProduct.click();
    await page.waitForTimeout(700);
  }
  await collectToast(page, runtime, "history-restore");
  await reloadHealthy(page, runtime, "history-reload", "Lịch sử & khôi phục");

  expectNoRuntimeErrors(runtime);
});
