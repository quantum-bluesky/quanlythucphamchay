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

async function setFloatingSearch(page, term) {
  const toggle = page.locator("#floatingSearchToggle");
  const input = page.locator("#floatingSearchInput");
  if (!await input.isVisible()) {
    await toggle.click();
  }
  await expect(input).toBeVisible();
  await input.fill(term);
  await page.waitForTimeout(250);
}

async function fetchSyncState(request, cookie) {
  const response = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: cookie } });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test("IT-PURSUP-01 purchases screen can create a new supplier and apply it back to the draft flow", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const timestamp = Date.now();
  const supplierName = `NCC Flow ${timestamp}`;
  const supplierPhone = `09${String(timestamp).slice(-8)}`;
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

    await page.locator("#createPurchaseDraftButton").click();
    await page.waitForTimeout(300);
    await page.locator("#purchaseSupplierInput").fill(supplierName);
    await page.locator(".purchases-panel [data-go-menu=\"suppliers\"]").click();

    await expectScreenTitle(page, "Nhà cung cấp");
    await expect(page.locator("#supplierFormSection")).not.toHaveClass(/is-collapsed/);
    await expect(page.locator("#supplierNameInput")).toHaveValue(supplierName);

    await page.locator("#supplierPhoneInput").fill(supplierPhone);
    await page.locator("#supplierAddressInput").fill("Dia chi test issue 38");
    await page.locator("#supplierNoteInput").fill("Tao moi tu man hinh nhap hang");
    await page.locator("#supplierForm button[type=\"submit\"]").click();

    await expectScreenTitle(page, "Nhập hàng");
    await expect(page.locator("#purchaseSupplierInput")).toHaveValue(supplierName);

    const toastText = await collectToast(page, runtime, "purchase-supplier-create", {
      errorPattern: /^$/,
    });
    expect(toastText).toContain("Đã lưu nhà cung cấp");

    const latestStateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
    expect(latestStateResponse.ok()).toBeTruthy();
    const latestState = await latestStateResponse.json();
    expect((latestState.suppliers || []).some((supplier) => supplier.name === supplierName)).toBeTruthy();
    expect((latestState.purchases || []).some((purchase) =>
      purchase.status === "draft" &&
      purchase.supplierName === supplierName &&
      (!Array.isArray(purchase.items) || purchase.items.length === 0)
    )).toBeFalsy();
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

test("IT-PURSUP-03 purchases keep separate draft per supplier and reuse the existing draft when supplier repeats", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const timestamp = Date.now();
  const supplierA = `NCC A ${timestamp}`;
  const supplierB = `NCC B ${timestamp}`;
  const userCookie = await autoLoginUserRequest(request);
  const originalState = await fetchSyncState(request, userCookie);

  try {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");

    const purchaseSuggestions = page.locator("#purchaseSuggestionList .sales-product-row");
    await expect(purchaseSuggestions.first()).toBeVisible();
    const suggestionCount = await purchaseSuggestions.count();
    expect(suggestionCount).toBeGreaterThanOrEqual(2);

    const productOneName = ((await purchaseSuggestions.nth(0).locator("strong").first().textContent()) || "").trim();
    const productTwoName = ((await purchaseSuggestions.nth(1).locator("strong").first().textContent()) || "").trim();
    expect(productOneName).toBeTruthy();
    expect(productTwoName).toBeTruthy();
    expect(productTwoName).not.toBe(productOneName);

    await page.locator("#purchaseSupplierInput").fill(supplierA);
    await page.locator("#purchaseNoteInput").click();
    await page.waitForTimeout(250);
    await purchaseSuggestions.nth(0).locator('[data-purchase-suggestion-action="add"]').click();
    await collectToast(page, runtime, "it-pursup-03-add-supplier-a", { errorPattern: /^$/ });

    await page.locator("#createPurchaseDraftButton").click();
    await page.waitForTimeout(250);
    await expect(page.locator("#purchaseSupplierInput")).toHaveValue("");

    await page.locator("#purchaseSupplierInput").fill(supplierB);
    await page.locator("#purchaseNoteInput").click();
    await page.waitForTimeout(250);
    const secondProductSuggestion = page.locator("#purchaseSuggestionList .sales-product-row", { hasText: productTwoName }).first();
    await expect(secondProductSuggestion).toBeVisible();
    await secondProductSuggestion.locator('[data-purchase-suggestion-action="add"]').click();
    await collectToast(page, runtime, "it-pursup-03-add-supplier-b", { errorPattern: /^$/ });

    let latestState = await fetchSyncState(request, userCookie);
    let supplierADrafts = (latestState.purchases || []).filter((purchase) => purchase.status === "draft" && purchase.supplierName === supplierA);
    let supplierBDrafts = (latestState.purchases || []).filter((purchase) => purchase.status === "draft" && purchase.supplierName === supplierB);

    expect(supplierADrafts).toHaveLength(1);
    expect(supplierBDrafts).toHaveLength(1);
    expect((supplierADrafts[0].items || []).some((item) => item.productName === productOneName)).toBeTruthy();
    expect((supplierBDrafts[0].items || []).some((item) => item.productName === productTwoName)).toBeTruthy();
    expect((supplierADrafts[0].items || []).some((item) => item.productName === productTwoName)).toBeFalsy();

    await page.locator("#createPurchaseDraftButton").click();
    await page.waitForTimeout(250);
    await expect(page.locator("#purchaseSupplierInput")).toHaveValue("");

    await page.locator("#purchaseSupplierInput").fill(supplierA);
    await page.locator("#purchaseNoteInput").click();
    await page.waitForTimeout(250);
    await expect(page.locator("#purchaseSupplierInput")).toHaveValue(supplierA);
    await expect(page.locator(".cart-item").filter({ hasText: productOneName }).first()).toBeVisible();
    await expect(page.locator(".cart-item").filter({ hasText: productTwoName })).toHaveCount(0);

    await expect(secondProductSuggestion).toBeVisible();
    await secondProductSuggestion.locator('[data-purchase-suggestion-action="add"]').click();
    await collectToast(page, runtime, "it-pursup-03-reuse-supplier-a", { errorPattern: /^$/ });

    latestState = await fetchSyncState(request, userCookie);
    supplierADrafts = (latestState.purchases || []).filter((purchase) => purchase.status === "draft" && purchase.supplierName === supplierA);
    supplierBDrafts = (latestState.purchases || []).filter((purchase) => purchase.status === "draft" && purchase.supplierName === supplierB);

    expect(supplierADrafts).toHaveLength(1);
    expect(supplierBDrafts).toHaveLength(1);
    expect((supplierADrafts[0].items || []).some((item) => item.productName === productOneName)).toBeTruthy();
    expect((supplierADrafts[0].items || []).some((item) => item.productName === productTwoName)).toBeTruthy();
    expect((supplierBDrafts[0].items || []).some((item) => item.productName === productTwoName)).toBeTruthy();
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
  const timestamp = Date.now();
  const supplierName = `NCC Locked ${timestamp}`;
  const renamedSupplier = `${supplierName} Updated`;
  const supplierPhone = `09${String(timestamp).slice(-8)}`;
  const now = new Date().toISOString();
  const userCookie = await autoLoginUserRequest(request);

  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();

  const injectedSupplier = {
    id: `supplier_locked_${timestamp}`,
    name: supplierName,
    phone: supplierPhone,
    address: "Dia chi NCC khoa lich su",
    note: "Supplier test paid purchase history",
    createdAt: now,
    updatedAt: now,
  };
  const paidPurchase = {
    id: `purchase_paid_${timestamp}`,
    supplierName,
    note: "Phieu da thanh toan de chan sua nguoc",
    status: "paid",
    createdAt: now,
    updatedAt: now,
    receivedAt: now,
    receiptCode: `PN-LOCKED-${timestamp}`,
    items: [],
  };

  try {
    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: {
        customers: originalState.customers,
        suppliers: [injectedSupplier, ...(originalState.suppliers || [])],
        carts: originalState.carts,
        purchases: [paidPurchase, ...(originalState.purchases || [])],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "suppliers");
    await expectScreenTitle(page, "Nhà cung cấp");
    await setFloatingSearch(page, supplierName);
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
