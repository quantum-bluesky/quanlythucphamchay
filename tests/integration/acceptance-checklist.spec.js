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

test("ACC-SUP-02 suppliers create stays healthy with legacy paid purchases using received_at", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const now = new Date().toISOString();
  const supplierName = `NCC Legacy ${Date.now()}`;

  const stateResponse = await request.get("/api/state?transaction_limit=16");
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();

  const legacyPaidPurchase = {
    id: `purchase_legacy_paid_${Date.now()}`,
    supplierName: "NCC Legacy Locked",
    note: "Legacy payload uses received_at",
    status: "paid",
    createdAt: now,
    updatedAt: now,
    paidAt: now,
    received_at: now,
    receiptCode: `PN-LEGACY-${Date.now()}`,
    items: [],
  };

  try {
    const seedResponse = await request.put("/api/state", {
      data: {
        purchases: [...(originalState.purchases || []), legacyPaidPurchase],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await switchMenu(page, "suppliers");
    await expectScreenTitle(page, "Nhà cung cấp");
    await page.locator("#supplierFormToggleButton").click();
    await expect(page.locator("#supplierFormSection")).not.toHaveClass(/is-collapsed/);

    await page.locator("#supplierNameInput").fill(supplierName);
    await page.locator("#supplierPhoneInput").fill("0909000098");
    await page.locator("#supplierAddressInput").fill("Dia chi NCC legacy");
    await page.locator("#supplierForm button[type=\"submit\"]").click();

    const toastText = await collectToast(page, runtime, "acc-supplier-legacy-purchase-create", {
      errorPattern: /^$/,
    });
    expect(toastText).toContain("Đã lưu nhà cung cấp");

    const latestStateResponse = await request.get("/api/state?transaction_limit=16");
    expect(latestStateResponse.ok()).toBeTruthy();
    const latestState = await latestStateResponse.json();
    expect((latestState.suppliers || []).some((supplier) => supplier.name === supplierName)).toBeTruthy();
  } finally {
    await request.put("/api/state", {
      data: {
        customers: originalState.customers,
        suppliers: originalState.suppliers,
        carts: originalState.carts,
        purchases: originalState.purchases,
      },
    });
  }

  expectNoRuntimeErrors(runtime);
});
