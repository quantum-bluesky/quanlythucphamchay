const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  collectToast,
  expectNoRuntimeErrors,
  expectScreenTitle,
  reloadHealthy,
  switchMenu,
} = require("./support/ui");

test("ACC-ABOUT-01 version button opens about screen with backend app version", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);

  const versionResponse = await request.get("/api/runtime-version");
  expect(versionResponse.ok()).toBeTruthy();
  const versionPayload = await versionResponse.json();

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.locator("#appVersionButton").click();

  await expectScreenTitle(page, "About ứng dụng");
  await expect(page.locator("#aboutContent")).toContainText(versionPayload.app.name);
  await expect(page.locator("#aboutContent")).toContainText(versionPayload.app.version);

  await page.locator('#aboutContent [data-go-menu="inventory"]').click();
  await expectScreenTitle(page, "Kiểm tra tồn kho");

  await collectToast(page, runtime, "acc-about-open");
  expectNoRuntimeErrors(runtime);
});

test("ACC-INV-01 inventory shortcuts open import and sales workflows", async ({ page }) => {
  const runtime = attachRuntimeTracking(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expectScreenTitle(page, "Kiểm tra tồn kho");

  await page.locator('[data-inventory-flow="in"]').first().click();
  await expectScreenTitle(page, "Nhập hàng");
  await collectToast(page, runtime, "acc-inventory-in");

  await switchMenu(page, "inventory");
  await page.locator('[data-inventory-flow="out"]').first().click();
  await expectScreenTitle(page, "Tạo đơn xuất hàng");
  await collectToast(page, runtime, "acc-inventory-out");

  expectNoRuntimeErrors(runtime);
});

test("ACC-REP-01 and ACC-HIS-01 reports refresh and history screen render healthy", async ({ page }) => {
  const runtime = attachRuntimeTracking(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await switchMenu(page, "reports");
  await expectScreenTitle(page, "Báo cáo");
  await page.locator("#reportFiltersToggleButton").click();
  await page.locator("#reportRangeSelect").selectOption("3");
  await page.locator("#refreshReportsButton").click();
  await expect(page.locator("#reportSummaryCards .summary-card").first()).toBeVisible();
  await expect(page.locator("#reportProductActivity")).not.toContainText("undefined");
  await collectToast(page, runtime, "acc-reports-refresh");
  await reloadHealthy(page, runtime, "acc-reports-reload", "Báo cáo");

  await switchMenu(page, "history");
  await expectScreenTitle(page, "Lịch sử & khôi phục");
  await expect(page.locator("#deletedProductList")).toContainText("Hàng đã xóa");
  await expect(page.locator("#deletedCustomerList")).toContainText("Khách đã xóa");
  await expect(page.locator("#deletedSupplierList")).toContainText("NCC Đã Xóa");
  await collectToast(page, runtime, "acc-history-screen");

  expectNoRuntimeErrors(runtime);
});
