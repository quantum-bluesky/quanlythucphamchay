const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginUser,
  autoLoginUserRequest,
  collectToast,
  expectNoRuntimeErrors,
  expectScreenTitle,
  switchMenu,
} = require("./support/ui");

test("IT-PURSUP-01 purchases screen can create a new supplier and apply it back to the draft flow", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const supplierName = `NCC Flow ${Date.now()}`;
  const userCookie = await autoLoginUserRequest(request);

  const stateResponseAuthed = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponseAuthed.ok()).toBeTruthy();
  const originalState = await stateResponseAuthed.json();

  try {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

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

    const latestStateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
    expect(latestStateResponse.ok()).toBeTruthy();
    const latestState = await latestStateResponse.json();
    expect((latestState.suppliers || []).some((supplier) => supplier.name === supplierName)).toBeTruthy();
    expect((latestState.purchases || []).some((purchase) => purchase.status === "draft" && purchase.supplierName === supplierName)).toBeTruthy();
  } finally {
    await request.put("/api/state", {
      headers: { Cookie: userCookie },
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

test("IT-PURSUP-02 suppliers screen can edit supplier without rewriting paid purchase history", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const supplierName = `NCC Locked ${Date.now()}`;
  const renamedSupplier = `${supplierName} Updated`;
  const now = new Date().toISOString();
  const userCookie = await autoLoginUserRequest(request);

  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();

  const injectedSupplier = {
    id: `supplier_locked_${Date.now()}`,
    name: supplierName,
    phone: "0909000099",
    address: "Dia chi NCC khoa lich su",
    note: "Supplier test paid purchase history",
    createdAt: now,
    updatedAt: now,
  };
  const paidPurchase = {
    id: `purchase_paid_${Date.now()}`,
    supplierName,
    note: "Phieu da thanh toan de chan sua nguoc",
    status: "paid",
    createdAt: now,
    updatedAt: now,
    receivedAt: now,
    receiptCode: `PN-LOCKED-${Date.now()}`,
    items: [],
  };

  try {
    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: {
        customers: originalState.customers,
        suppliers: [...(originalState.suppliers || []), injectedSupplier],
        carts: originalState.carts,
        purchases: [...(originalState.purchases || []), paidPurchase],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "suppliers");
    await expectScreenTitle(page, "Nhà cung cấp");

    await page.locator(`[data-supplier-action="edit"][data-supplier-id="${injectedSupplier.id}"]`).click();
    await expect(page.locator("#supplierNameInput")).toHaveValue(supplierName);

    await page.locator("#supplierNameInput").fill(renamedSupplier);
    await page.locator("#supplierForm button[type=\"submit\"]").click();

    const toastText = await collectToast(page, runtime, "supplier-edit-locked-history", {
      errorPattern: /^$/,
    });
    expect(toastText).toContain("Đã lưu nhà cung cấp");

    const latestStateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
    expect(latestStateResponse.ok()).toBeTruthy();
    const latestState = await latestStateResponse.json();
    expect((latestState.suppliers || []).some((supplier) => supplier.name === renamedSupplier)).toBeTruthy();
    expect((latestState.purchases || []).some((purchase) => purchase.id === paidPurchase.id && purchase.supplierName === supplierName)).toBeTruthy();
  } finally {
    await request.put("/api/state", {
      headers: { Cookie: userCookie },
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
