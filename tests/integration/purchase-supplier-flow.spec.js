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

async function fetchProducts(request, cookie) {
  const response = await request.get("/api/products", { headers: { Cookie: cookie } });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  return payload.products || [];
}

function hasActualPurchaseHistory(state, productId) {
  return (state.purchases || []).some((purchase) =>
    ["received", "paid"].includes(String(purchase.status || "")) &&
    String(purchase.supplierName || "").trim() &&
    (purchase.items || []).some((item) => Number(item.productId) === Number(productId))
  );
}

function buildPaidPurchase({ id, supplierName, product, quantity, now }) {
  return {
    id,
    supplierName,
    note: "Seed lịch sử NCC theo sản phẩm",
    status: "paid",
    createdAt: now,
    updatedAt: now,
    receivedAt: now,
    paidAt: now,
    receiptCode: `PN-${id}`,
    items: [
      {
        id: `${id}_item`,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity,
        unitCost: Number(product.price || 0),
      },
    ],
  };
}

function buildOpenPurchase({ id, supplierName, product, quantity, now, status = "draft" }) {
  return {
    id,
    supplierName,
    note: "Seed phiếu chờ nhập để review conflict NCC",
    status,
    createdAt: now,
    updatedAt: now,
    orderedAt: status === "ordered" ? now : "",
    receiptCode: status === "ordered" ? `PN-${id}` : "",
    items: [
      {
        id: `${id}_item`,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity,
        unitCost: Number(product.price || 0),
      },
    ],
  };
}

function buildDemandCart({ id, customerName, product, quantity, now }) {
  return {
    id,
    customerName,
    status: "draft",
    paymentStatus: "unpaid",
    createdAt: now,
    updatedAt: now,
    orderCode: "",
    items: [
      {
        id: `${id}_item`,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity,
        unitPrice: Number(product.sale_price || product.price || 0) || 1000,
        note: "",
      },
    ],
  };
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
  test.setTimeout(90000);
  const runtime = attachRuntimeTracking(page, { autoAcceptDialogs: false });
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
    if (await page.locator("#purchaseSupplierInput").isDisabled()) {
      await page.locator("#createPurchaseDraftButton").click();
      await expect(page.locator("#purchaseSupplierInput")).toBeEnabled();
    }

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
    page.once("dialog", async (dialog) => {
      await dialog.dismiss();
    });
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

test("IT-PURSUP-04 empty purchase draft can be deleted and supplier button can switch supplier before ordered", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const timestamp = Date.now();
  const supplierA = `NCC draft A ${timestamp}`;
  const supplierB = `NCC draft B ${timestamp}`;
  const now = new Date().toISOString();
  const userCookie = await autoLoginUserRequest(request);
  const originalState = await fetchSyncState(request, userCookie);

  try {
    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: {
        customers: originalState.customers,
        suppliers: [
          ...(originalState.suppliers || []),
          {
            id: `supplier_draft_a_${timestamp}`,
            name: supplierA,
            phone: "",
            address: "",
            note: "",
            createdAt: now,
            updatedAt: now,
          },
          {
            id: `supplier_draft_b_${timestamp}`,
            name: supplierB,
            phone: "",
            address: "",
            note: "",
            createdAt: now,
            updatedAt: now,
          },
        ],
        carts: originalState.carts,
        purchases: originalState.purchases,
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");

    await page.locator("#createPurchaseDraftButton").click();
    await page.waitForTimeout(250);
    await page.locator("#purchaseSupplierInput").fill(supplierA);
    await page.locator("#purchaseNoteInput").click();
    await page.waitForTimeout(250);

    await page.locator('[data-purchase-action="delete"]').click();
    const deleteToast = await collectToast(page, runtime, "it-pursup-04-delete-empty-draft", { errorPattern: /^$/ });
    expect(deleteToast).toContain("Đã xóa phiếu nháp");
    await expect(page.locator("#purchaseSupplierInput")).not.toHaveValue(supplierA);
    const stateAfterDelete = await fetchSyncState(request, userCookie);
    expect((stateAfterDelete.purchases || []).some((purchase) => purchase.supplierName === supplierA)).toBeFalsy();

    await page.locator("#createPurchaseDraftButton").click();
    await page.waitForTimeout(250);
    await page.locator("#purchaseSupplierInput").fill(supplierA);
    await page.locator("#purchaseNoteInput").click();
    await page.waitForTimeout(250);
    await page.locator('.purchases-panel [data-go-menu="suppliers"]').click();

    await expectScreenTitle(page, "Nhà cung cấp");
    await expect(page.locator("#supplierFormSection")).toHaveClass(/is-collapsed/);
    await page.locator(`[data-supplier-action="use"][data-supplier-id="supplier_draft_b_${timestamp}"]`).click();

    await expectScreenTitle(page, "Nhập hàng");
    await expect(page.locator("#purchaseSupplierInput")).toHaveValue(supplierB);

    const stateAfterSwitch = await fetchSyncState(request, userCookie);
    expect((stateAfterSwitch.purchases || []).some((purchase) => purchase.supplierName === supplierA)).toBeFalsy();
    expect((stateAfterSwitch.purchases || []).some((purchase) => purchase.supplierName === supplierB)).toBeFalsy();
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

test("IT-PURSUP-05 purchase supplier suggestions auto-select the only historical supplier", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const timestamp = Date.now();
  const now = new Date().toISOString();
  const userCookie = await autoLoginUserRequest(request);
  const originalState = await fetchSyncState(request, userCookie);
  const products = await fetchProducts(request, userCookie);
  const candidateProducts = products.filter((product) => !hasActualPurchaseHistory(originalState, product.id));
  expect(candidateProducts.length).toBeGreaterThanOrEqual(1);
  const uniqueProduct = products.find((product) => product.name === "Bò kho" && !hasActualPurchaseHistory(originalState, product.id)) || candidateProducts[0];
  const uniqueSupplier = `NCC unique ${timestamp}`;

  try {
    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: {
        customers: originalState.customers,
        suppliers: [
          ...(originalState.suppliers || []),
          { id: `supplier_unique_${timestamp}`, name: uniqueSupplier, phone: "", address: "", note: "", createdAt: now, updatedAt: now },
        ],
        carts: [
          buildDemandCart({
            id: `cart_unique_${timestamp}`,
            customerName: `Khách cần ${uniqueProduct.name} ${timestamp}`,
            product: uniqueProduct,
            quantity: Math.max(Number(uniqueProduct.current_stock || 0) + 2, 2),
            now,
          }),
          ...(originalState.carts || []),
        ],
        purchases: [
          buildPaidPurchase({ id: `purchase_unique_${timestamp}`, supplierName: uniqueSupplier, product: uniqueProduct, quantity: 4, now }),
          ...(originalState.purchases || []),
        ],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });
    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");
    await page.locator("#createPurchaseDraftButton").click();
    await page.waitForTimeout(250);
    await collectToast(page, runtime, "it-pursup-06-create-draft", { errorPattern: /^$/ });
    await expect(page.locator("#purchaseSupplierInput")).toHaveValue("");

    const addUniqueButton = page.locator(`[data-purchase-suggestion-action="add"][data-product-id="${uniqueProduct.id}"]`).first();
    await expect(addUniqueButton).toBeVisible();
    await addUniqueButton.click();
    const uniqueToast = await collectToast(page, runtime, "it-pursup-05-unique", { errorPattern: /^$/ });
    expect(uniqueToast).toContain(`tự chọn ${uniqueSupplier}`);
    await expect(page.locator("#purchaseSupplierInput")).toHaveValue(uniqueSupplier);

    const stateAfterUnique = await fetchSyncState(request, userCookie);
    expect((stateAfterUnique.purchases || []).some((purchase) =>
      purchase.status === "draft" &&
      purchase.supplierName === uniqueSupplier &&
      (purchase.items || []).some((item) => Number(item.productId) === Number(uniqueProduct.id))
    )).toBeTruthy();
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

test("IT-PURSUP-06 purchase supplier suggestions prioritize multiple historical suppliers", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page, { autoAcceptDialogs: false });
  const timestamp = Date.now();
  const now = new Date().toISOString();
  const userCookie = await autoLoginUserRequest(request);
  const originalState = await fetchSyncState(request, userCookie);
  const products = await fetchProducts(request, userCookie);
  const candidateProducts = products.filter((product) => !hasActualPurchaseHistory(originalState, product.id));
  expect(candidateProducts.length).toBeGreaterThanOrEqual(1);
  const multiProduct = products.find((product) => product.name === "Bò lát xào" && !hasActualPurchaseHistory(originalState, product.id)) || candidateProducts[0];
  const lowPrioritySupplier = `NCC low ${timestamp}`;
  const highPrioritySupplier = `NCC high ${timestamp}`;

  try {
    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: {
        customers: originalState.customers,
        suppliers: [
          ...(originalState.suppliers || []),
          { id: `supplier_low_${timestamp}`, name: lowPrioritySupplier, phone: "", address: "", note: "", createdAt: now, updatedAt: now },
          { id: `supplier_high_${timestamp}`, name: highPrioritySupplier, phone: "", address: "", note: "", createdAt: now, updatedAt: now },
        ],
        carts: [
          buildDemandCart({
            id: `cart_multi_${timestamp}`,
            customerName: `Khách cần ${multiProduct.name} ${timestamp}`,
            product: multiProduct,
            quantity: Math.max(Number(multiProduct.current_stock || 0) + 2, 2),
            now,
          }),
          ...(originalState.carts || []),
        ],
        purchases: [
          buildPaidPurchase({ id: `purchase_low_${timestamp}`, supplierName: lowPrioritySupplier, product: multiProduct, quantity: 2, now }),
          buildPaidPurchase({ id: `purchase_high_${timestamp}`, supplierName: highPrioritySupplier, product: multiProduct, quantity: 9, now }),
          ...(originalState.purchases || []),
        ],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });
    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");
    await page.locator("#createPurchaseDraftButton").click();
    await page.waitForTimeout(250);
    await expect(page.locator("#purchaseSupplierInput")).toHaveValue("");

    const addMultiButton = page.locator(`[data-purchase-suggestion-action="add"][data-product-id="${multiProduct.id}"]`).first();
    await expect(addMultiButton).toBeVisible();
    page.once("dialog", async (dialog) => {
      await dialog.dismiss();
    });
    await addMultiButton.click();
    await expect(page.locator("#purchasePanel")).toContainText(multiProduct.name);
    await expect(page.locator("#purchaseSupplierInput")).toHaveValue("");

    const supplierOptionValues = await page.locator("#supplierOptions option").evaluateAll((options) =>
      options.map((option) => option.getAttribute("value") || "")
    );
    expect(supplierOptionValues.indexOf(highPrioritySupplier)).toBeGreaterThanOrEqual(0);
    expect(supplierOptionValues.indexOf(lowPrioritySupplier)).toBeGreaterThanOrEqual(0);
    expect(supplierOptionValues.indexOf(highPrioritySupplier)).toBeLessThan(supplierOptionValues.indexOf(lowPrioritySupplier));
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

test("IT-PURSUP-07 purchases warn and review open receipts when one product is pending across different suppliers", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page, { autoAcceptDialogs: false });
  const timestamp = Date.now();
  const now = new Date().toISOString();
  const supplierA = `NCC conflict A ${timestamp}`;
  const supplierB = `NCC conflict B ${timestamp}`;
  const userCookie = await autoLoginUserRequest(request);
  const originalState = await fetchSyncState(request, userCookie);
  const products = await fetchProducts(request, userCookie);
  const targetProduct = products[0];
  expect(targetProduct).toBeTruthy();

  try {
    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: {
        customers: originalState.customers,
        suppliers: [
          ...(originalState.suppliers || []),
          { id: `supplier_conflict_a_${timestamp}`, name: supplierA, phone: "", address: "", note: "", createdAt: now, updatedAt: now },
          { id: `supplier_conflict_b_${timestamp}`, name: supplierB, phone: "", address: "", note: "", createdAt: now, updatedAt: now },
        ],
        carts: [
          buildDemandCart({
            id: `cart_conflict_${timestamp}`,
            customerName: `Khách conflict ${timestamp}`,
            product: targetProduct,
            quantity: Math.max(Number(targetProduct.current_stock || 0) + 3, 3),
            now,
          }),
          ...(originalState.carts || []),
        ],
        purchases: [
          buildOpenPurchase({ id: `purchase_conflict_a_${timestamp}`, supplierName: supplierA, product: targetProduct, quantity: 2, now, status: "draft" }),
          buildOpenPurchase({ id: `purchase_conflict_b_${timestamp}`, supplierName: supplierB, product: targetProduct, quantity: 4, now, status: "ordered" }),
          ...(originalState.purchases || []),
        ],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });
    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");

    await page.locator("#createPurchaseDraftButton").click();
    await page.waitForTimeout(250);

    let firstDialogMessage = "";
    page.once("dialog", async (dialog) => {
      firstDialogMessage = dialog.message();
      await dialog.accept();
    });
    await page.locator(`[data-purchase-suggestion-action="add"][data-product-id="${targetProduct.id}"]`).first().click();
    await expect(page.locator("[data-purchase-conflict-review]")).toBeVisible();
    expect(firstDialogMessage).toContain(targetProduct.name);
    expect(firstDialogMessage).toContain("phiếu chờ nhập");
    await expect(page.locator("[data-purchase-conflict-review]")).toContainText(supplierA);
    await expect(page.locator("[data-purchase-conflict-review]")).toContainText(supplierB);

    await page.locator("[data-purchase-conflict-review] .cart-queue-item", { hasText: supplierA }).locator('[data-purchase-conflict-review-action="open"]').click();
    await expect(page.locator("#purchaseSupplierInput")).toHaveValue(supplierA);
    await page.locator('[data-purchase-conflict-review-action="dismiss"]').click();
    await expect(page.locator("[data-purchase-conflict-review]")).toHaveCount(0);

    await page.locator("#createPurchaseDraftButton").click();
    await page.waitForTimeout(250);
    let secondDialogMessage = "";
    page.once("dialog", async (dialog) => {
      secondDialogMessage = dialog.message();
      await dialog.dismiss();
    });
    await page.locator(`[data-purchase-suggestion-action="add"][data-product-id="${targetProduct.id}"]`).first().click();
    expect(secondDialogMessage).toContain(targetProduct.name);
    const conflictToast = await collectToast(page, runtime, "it-pursup-07-keep-current", { errorPattern: /^$/ });
    expect(conflictToast).toContain("Cảnh báo");
    await expect(page.locator("#purchasePanel")).toContainText(targetProduct.name);
    await expect(page.locator("#purchasePanel")).toContainText("Cảnh báo NCC theo mặt hàng");

    const latestState = await fetchSyncState(request, userCookie);
    expect((latestState.purchases || []).some((purchase) =>
      purchase.status === "draft" &&
      !String(purchase.supplierName || "").trim() &&
      (purchase.items || []).some((item) => Number(item.productId) === Number(targetProduct.id))
    )).toBeTruthy();
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
