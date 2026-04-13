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

test("ACC-ORD-01 / ACC-CUS-01 / ACC-SUP-01 / ACC-REP-01 / ACC-HIS-01 orders, customers, suppliers, reports and history stay healthy", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });

  await switchMenu(page, "orders");
  await expectScreenTitle(page, "Đơn hàng");
  const orderDetailToggle = page.locator('[data-queue-action="toggle-detail"]').first();
  if (await orderDetailToggle.count()) {
    await orderDetailToggle.click();
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
  await expect(page.getByRole("heading", { name: "Khôi phục mặt hàng ngừng bán" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Khôi phục danh bạ khách hàng" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Khôi phục nguồn hàng" })).toBeVisible();
  await collectToast(page, runtime, "history-restore");
  await reloadHealthy(page, runtime, "history-reload", "Lịch sử & khôi phục");

  expectNoRuntimeErrors(runtime);
});
