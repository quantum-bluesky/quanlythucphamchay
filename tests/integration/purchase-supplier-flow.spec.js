const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  collectToast,
  expectNoRuntimeErrors,
  expectScreenTitle,
  switchMenu,
} = require("./support/ui");

test("purchases screen can create a new supplier and apply it back to the draft flow", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const supplierName = `NCC Flow ${Date.now()}`;

  const stateResponse = await request.get("/api/state?transaction_limit=16");
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();

  try {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");

    await page.locator("#purchaseSupplierInput").fill(supplierName);
    await page.locator(".purchases-panel [data-go-menu=\"suppliers\"]").click();

    await expectScreenTitle(page, "Nhà cung cấp");
    await expect(page.locator("#supplierFormSection")).not.toHaveClass(/is-collapsed/);
    await expect(page.locator("#supplierNameInput")).toHaveValue(supplierName);

    await page.locator("#supplierPhoneInput").fill("0909000038");
    await page.locator("#supplierAddressInput").fill("Dia chi test issue 38");
    await page.locator("#supplierNoteInput").fill("Tao moi tu man hinh nhap hang");
    await page.locator("#supplierForm button[type=\"submit\"]").click();

    await expectScreenTitle(page, "Nhập hàng");

    const toastText = await collectToast(page, runtime, "purchase-supplier-create", {
      errorPattern: /^$/,
    });
    expect(toastText).toContain("Đã lưu nhà cung cấp");

    const latestStateResponse = await request.get("/api/state?transaction_limit=16");
    expect(latestStateResponse.ok()).toBeTruthy();
    const latestState = await latestStateResponse.json();
    expect((latestState.suppliers || []).some((supplier) => supplier.name === supplierName)).toBeTruthy();
    expect((latestState.purchases || []).some((purchase) => purchase.status === "draft" && purchase.supplierName === supplierName)).toBeTruthy();
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
