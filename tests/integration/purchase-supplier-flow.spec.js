const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginAdminRequest,
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

async function createBackupSnapshot(request) {
  const adminCookie = await autoLoginAdminRequest(request);
  const response = await request.get("/api/admin/backup", {
    headers: { Cookie: adminCookie },
  });
  expect(response.ok()).toBeTruthy();
  return response.body();
}

async function restoreBackupSnapshot(request, snapshot, page = null) {
  if (page && !page.isClosed()) {
    await page.close();
  }
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const adminCookie = await autoLoginAdminRequest(request);
      const response = await request.post("/api/admin/restore", {
        headers: { Cookie: adminCookie },
        data: {
          content_base64: snapshot.toString("base64"),
        },
      });
      expect(response.ok()).toBeTruthy();
      return;
    } catch (error) {
      lastError = error;
      if (attempt === 3) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }
  throw lastError || new Error("restoreBackupSnapshot failed");
}

async function waitForToastContaining(page, expectedTexts, timeout = 5000) {
  const expectedList = Array.isArray(expectedTexts) ? expectedTexts : [expectedTexts];
  const toast = page.locator("#toast:not([hidden])");
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await toast.count()) {
      const text = ((await toast.first().textContent()) || "").trim();
      if (expectedList.some((entry) => text.includes(entry))) {
        return text;
      }
    }
    await page.waitForTimeout(150);
  }
  const lastText = await toast.count() ? (((await toast.first().textContent()) || "").trim()) : "";
  throw new Error(`Không thấy toast mong đợi (${expectedList.join(" | ")}). Toast hiện tại: ${lastText}`);
}

function hasActualPurchaseHistory(state, productId) {
  return (state.purchases || []).some((purchase) =>
    ["received", "paid"].includes(String(purchase.status || "")) &&
    String(purchase.supplierName || "").trim() &&
    (purchase.items || []).some((item) => Number(item.productId) === Number(productId))
  );
}

function hasAnyOpenPurchaseReference(state, productId) {
  return (state.purchases || []).some((purchase) =>
    !["cancelled", "paid"].includes(String(purchase.status || "")) &&
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
  const snapshot = await createBackupSnapshot(request);

  const stateResponseAuthed = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponseAuthed.ok()).toBeTruthy();
  const originalState = await stateResponseAuthed.json();

  try {
    await page.goto("/admin");
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
    await restoreBackupSnapshot(request, snapshot, page);
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
  const snapshot = await createBackupSnapshot(request);
  const originalState = await fetchSyncState(request, userCookie);

  try {
    await page.goto("/admin");
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
    await restoreBackupSnapshot(request, snapshot, page);
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
  const snapshot = await createBackupSnapshot(request);
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

    await page.goto("/admin");
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
    await restoreBackupSnapshot(request, snapshot, page);
  }

  expectNoRuntimeErrors(runtime);
});

test("IT-PURSUP-08 purchases can repeat a received purchase into a new draft with cleared lot metadata", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const userCookie = await autoLoginUserRequest(request);
  const timestamp = Date.now();
  const supplierName = `NCC lap NH ${timestamp}`;
  const purchaseId = `purchase_repeat_${timestamp}`;
  const discountAmount = 6000;
  const now = new Date().toISOString();
  const originalState = await fetchSyncState(request, userCookie);
  const snapshot = await createBackupSnapshot(request);
  const products = await fetchProducts(request, userCookie);
  const product = products[0];
  expect(product).toBeTruthy();

  const receivedPurchase = {
    id: purchaseId,
    supplierName,
    note: "Nhập lại từ phiếu cũ",
    status: "received",
    discountAmount,
    createdAt: now,
    updatedAt: now,
    receivedAt: now,
    receiptCode: `PN-REPEAT-${timestamp}`,
    items: [
      {
        id: `purchase_repeat_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity: 3,
        unitCost: Number(product.price || 0) || 1000,
        batchCode: `LO-${timestamp}`,
        expiryInputMode: "direct",
        expiryDate: "2026-12-31",
        manufactureDate: "",
      },
    ],
  };

  try {
    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: {
        customers: originalState.customers,
        suppliers: originalState.suppliers,
        carts: originalState.carts,
        purchases: [receivedPurchase, ...(originalState.purchases || [])],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");
    await setFloatingSearch(page, supplierName);

    const purchaseCard = page.locator(".cart-queue-item", { hasText: supplierName }).first();
    await expect(purchaseCard).toBeVisible();
    await purchaseCard.locator('[data-purchase-list-action="repeat"]').click();

    const repeatToast = await collectToast(page, runtime, "it-pursup-08-repeat-purchase", { errorPattern: /^$/ });
    expect(repeatToast).toContain("Đã tạo phiếu nhập nháp mới");
    await expect(page.locator("#purchaseSupplierInput")).toHaveValue(supplierName);
    await expect(page.locator("#purchaseNoteInput")).toHaveValue(receivedPurchase.note);
    await expect(page.locator('[data-purchase-discount-input]')).toHaveValue(String(discountAmount));
    await page.locator('[data-purchase-item-action="toggle-detail"]').first().click();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-purchase-qty-input]').first()).toHaveValue("3");
    await expect(page.locator('[data-purchase-cost-input]').first()).toHaveValue(String(Number(receivedPurchase.items[0].unitCost)));
    await expect(page.locator('[data-purchase-batch-input]').first()).toHaveValue("");
    await expect(page.locator('[data-purchase-expiry-input]').first()).toHaveValue("");
    await expect(page.locator('[data-purchase-manufacture-input]').first()).toHaveValue("");

    const latestState = await fetchSyncState(request, userCookie);
    const repeatedDrafts = (latestState.purchases || []).filter((purchase) =>
      purchase.id !== purchaseId &&
      purchase.status === "draft" &&
      purchase.supplierName === supplierName
    );
    expect(repeatedDrafts).toHaveLength(1);
    const repeatedDraft = repeatedDrafts[0];
    expect(String(repeatedDraft.receiptCode || repeatedDraft.receipt_code || "")).toBe("");
    expect(String(repeatedDraft.sourceType || repeatedDraft.source_type || "")).toBe("");
    expect(String(repeatedDraft.sourceCode || repeatedDraft.source_code || "")).toBe("");
    expect(String(repeatedDraft.sourceName || repeatedDraft.source_name || "")).toBe("");
    expect(String(repeatedDraft.note || "")).toBe(receivedPurchase.note);
    expect(Number(repeatedDraft.discountAmount || repeatedDraft.discount_amount || 0)).toBe(discountAmount);
    expect(repeatedDraft.items || []).toHaveLength(1);
    expect(Number(repeatedDraft.items[0].productId)).toBe(Number(product.id));
    expect(Number(repeatedDraft.items[0].quantity)).toBe(3);
    expect(Number(repeatedDraft.items[0].unitCost || repeatedDraft.items[0].unit_cost || 0)).toBe(Number(receivedPurchase.items[0].unitCost));
    expect(String(repeatedDraft.items[0].batchCode || repeatedDraft.items[0].batch_code || "")).toBe("");
    expect(String(repeatedDraft.items[0].expiryDate || repeatedDraft.items[0].expiry_date || "")).toBe("");
    expect(String(repeatedDraft.items[0].manufactureDate || repeatedDraft.items[0].manufacture_date || "")).toBe("");
  } finally {
    await restoreBackupSnapshot(request, snapshot, page);
  }

  expectNoRuntimeErrors(runtime);
});

test("IT-PURSUP-09 received purchase note stays editable until paid", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const userCookie = await autoLoginUserRequest(request);
  const timestamp = Date.now();
  const supplierName = `NCC ghi chu ${timestamp}`;
  const purchaseId = `purchase_note_${timestamp}`;
  const now = new Date().toISOString();
  const originalState = await fetchSyncState(request, userCookie);
  const snapshot = await createBackupSnapshot(request);
  const products = await fetchProducts(request, userCookie);
  const product = products[0];
  expect(product).toBeTruthy();

  const receivedPurchase = {
    id: purchaseId,
    supplierName,
    note: "Ghi chu truoc thanh toan",
    status: "received",
    discountAmount: 0,
    createdAt: now,
    updatedAt: now,
    orderedAt: now,
    receivedAt: now,
    receiptCode: `PN-NOTE-${timestamp}`,
    items: [
      {
        id: `purchase_note_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity: 2,
        unitCost: Number(product.price || 0) || 1000,
      },
    ],
  };

  try {
    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: {
        customers: originalState.customers,
        suppliers: originalState.suppliers,
        carts: originalState.carts,
        purchases: [receivedPurchase, ...(originalState.purchases || [])],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");
    await setFloatingSearch(page, supplierName);

    const purchaseCard = page.locator(".cart-queue-item", { hasText: supplierName }).first();
    await expect(purchaseCard).toBeVisible();
    await purchaseCard.locator('[data-purchase-list-action="open"]').click();

    const noteInput = page.locator("#purchaseNoteInput");
    await expect(noteInput).toBeEnabled();
    await noteInput.fill("Da sua truoc thanh toan");
    await noteInput.press("Tab");

    await expect.poll(async () => {
      const latestState = await fetchSyncState(request, userCookie);
      const latestReceivedPurchase = (latestState.purchases || []).find((purchase) => purchase.id === purchaseId);
      return String(latestReceivedPurchase?.note || "");
    }).toBe("Da sua truoc thanh toan");

    await page.locator('[data-purchase-action="mark-paid"]').click();

    const paidToast = await collectToast(page, runtime, "it-pursup-09-mark-paid", { errorPattern: /^$/ });
    expect(paidToast).toMatch(/Đã cập nhật.*thanh toán/i);
    await expect(noteInput).toBeDisabled();

    const latestState = await fetchSyncState(request, userCookie);
    const latestPaidPurchase = (latestState.purchases || []).find((purchase) => purchase.id === purchaseId);
    expect(String(latestPaidPurchase?.status || "")).toBe("paid");
    expect(String(latestPaidPurchase?.note || "")).toBe("Da sua truoc thanh toan");
  } finally {
    await restoreBackupSnapshot(request, snapshot, page);
  }

  expectNoRuntimeErrors(runtime);
});

test("IT-PURSUP-10 purchases merge only open receipts of the same supplier and can cancel preview", async ({ page, request }) => {
  test.setTimeout(90000);
  const runtime = attachRuntimeTracking(page);
  const userCookie = await autoLoginUserRequest(request);
  const timestamp = Date.now();
  const sameSupplierName = `NCC gộp ${timestamp}`;
  const otherSupplierName = `NCC gộp ${timestamp} khác`;

  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const productsResponse = await request.get("/api/products", { headers: { Cookie: userCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const product = productsPayload.products?.[0];
  expect(product).toBeTruthy();

  const orderedPurchase = {
    id: `purchase_merge_ordered_${timestamp}`,
    supplierName: sameSupplierName,
    note: "Ghi chú ordered",
    status: "ordered",
    discountAmount: 3000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    orderedAt: new Date().toISOString(),
    receiptCode: `PN-MERGE-${timestamp}`,
    items: [
      {
        id: `purchase_merge_ordered_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity: 2,
        unitCost: Number(product.price || 0) || 1000,
      },
    ],
  };
  const draftPurchase = {
    id: `purchase_merge_draft_${timestamp}`,
    supplierName: sameSupplierName,
    note: "Ghi chú draft",
    status: "draft",
    discountAmount: 5000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: `purchase_merge_draft_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity: 5,
        unitCost: Number(product.price || 0) || 1000,
      },
    ],
  };
  const otherPurchase = {
    id: `purchase_merge_other_${timestamp}`,
    supplierName: otherSupplierName,
    note: "Phiếu NCC khác",
    status: "draft",
    discountAmount: 700,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: `purchase_merge_other_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity: 1,
        unitCost: Number(product.price || 0) || 1000,
      },
    ],
  };

  async function checkMergePurchase(purchaseId) {
    const checkbox = page.locator(`[data-purchase-select="${purchaseId}"] input[data-purchase-list-action="toggle-merge-select"]`).first();
    await checkbox.evaluate((node) => {
      node.checked = true;
      node.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(checkbox).toBeChecked();
  }

  try {
    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: {
        purchases: [orderedPurchase, draftPurchase, otherPurchase, ...(originalState.purchases || [])],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");
    await setFloatingSearch(page, `NCC gộp ${timestamp}`);

    const orderedCard = page.locator(`[data-purchase-select="${orderedPurchase.id}"]`).first();
    const draftCard = page.locator(`[data-purchase-select="${draftPurchase.id}"]`).first();
    const otherCard = page.locator(`[data-purchase-select="${otherPurchase.id}"]`).first();
    await expect(orderedCard).toBeVisible();
    await expect(draftCard).toBeVisible();
    await expect(otherCard).toBeVisible();

    await checkMergePurchase(orderedPurchase.id);
    await checkMergePurchase(otherPurchase.id);
    await page.locator('#purchaseOrderList [data-purchase-list-action="start-merge-preview"]').click();
    const invalidToast = await collectToast(page, runtime, "it-pursup-10-invalid", { errorPattern: /^$/ });
    expect(invalidToast).toContain("Chỉ gộp được các phiếu nhập cùng một nhà cung cấp.");
    await expectScreenTitle(page, "Nhập hàng");

    await page.locator('#purchaseOrderList [data-purchase-list-action="clear-merge-selection"]').click();
    await checkMergePurchase(orderedPurchase.id);
    await checkMergePurchase(draftPurchase.id);
    await page.locator('#purchaseOrderList [data-purchase-list-action="start-merge-preview"]').click();
    await expect(page.locator("#purchasePanel")).toContainText("Gộp phiếu nhập đang chờ xác nhận");
    await page.locator('#purchasePanel [data-purchase-action="cancel-merge-preview"]').click();
    await expectScreenTitle(page, "Nhập hàng");
    await expect(orderedCard).toBeVisible();
    await expect(draftCard).toBeVisible();
    await expect(page.locator('#purchaseOrderList [data-purchase-list-action="start-merge-preview"]')).toHaveCount(0);

    await checkMergePurchase(orderedPurchase.id);
    await checkMergePurchase(draftPurchase.id);
    await page.locator('#purchaseOrderList [data-purchase-list-action="start-merge-preview"]').click();
    await expect(page.locator("#purchasePanel")).toContainText("Gộp phiếu nhập đang chờ xác nhận");
    await page.locator('#purchasePanel [data-purchase-action="confirm-merge-preview"]').click();
    const mergeToast = await collectToast(page, runtime, "it-pursup-10-merge", { errorPattern: /^$/ });
    expect(mergeToast).toContain("Đã gộp các phiếu nhập đã chọn vào phiếu hiện hành.");

    const latestStateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
    expect(latestStateResponse.ok()).toBeTruthy();
    const latestState = await latestStateResponse.json();
    const mergedOrderedPurchase = (latestState.purchases || []).find((purchase) => purchase.id === orderedPurchase.id);
    const cancelledDraftPurchase = (latestState.purchases || []).find((purchase) => purchase.id === draftPurchase.id);
    const untouchedOtherPurchase = (latestState.purchases || []).find((purchase) => purchase.id === otherPurchase.id);

    expect(mergedOrderedPurchase).toBeTruthy();
    expect(mergedOrderedPurchase.status).toBe("ordered");
    expect(Number(mergedOrderedPurchase.discountAmount || mergedOrderedPurchase.discount_amount || 0)).toBe(8000);
    expect(String(mergedOrderedPurchase.note || "")).toBe("Ghi chú ordered | Ghi chú draft");
    expect(mergedOrderedPurchase.items || []).toHaveLength(1);
    expect(Number(mergedOrderedPurchase.items[0].quantity)).toBe(7);
    expect(cancelledDraftPurchase).toBeTruthy();
    expect(cancelledDraftPurchase.status).toBe("cancelled");
    expect(untouchedOtherPurchase).toBeTruthy();
    expect(untouchedOtherPurchase.status).toBe("draft");
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

test("IT-PURSUP-11 purchases screen can bulk mark selected drafts ordered and keep invalid drafts selected", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const userCookie = await autoLoginUserRequest(request);
  const timestamp = Date.now();
  const supplierName = `NCC bulk order ${timestamp}`;
  const searchTerm = String(timestamp);

  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const productsResponse = await request.get("/api/products", { headers: { Cookie: userCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const product = productsPayload.products?.[0];
  expect(product).toBeTruthy();

  const validPurchase = {
    id: `purchase_bulk_valid_${timestamp}`,
    supplierName,
    note: "Phiếu đủ điều kiện đặt",
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: `purchase_bulk_valid_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity: 2,
        unitCost: Number(product.price || 0) || 1000,
      },
    ],
  };
  const invalidPurchase = {
    id: `purchase_bulk_invalid_${timestamp}`,
    supplierName: "",
    note: `Thiếu NCC ${timestamp}`,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: `purchase_bulk_invalid_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity: 1,
        unitCost: Number(product.price || 0) || 1000,
      },
    ],
  };

  try {
    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: {
        purchases: [validPurchase, invalidPurchase, ...(originalState.purchases || [])],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");
    await setFloatingSearch(page, searchTerm);

    const validCheckbox = page.locator(`[data-purchase-select="${validPurchase.id}"] input[data-purchase-list-action="toggle-merge-select"]`).first();
    const invalidCheckbox = page.locator(`[data-purchase-select="${invalidPurchase.id}"] input[data-purchase-list-action="toggle-merge-select"]`).first();
    await validCheckbox.check();
    await invalidCheckbox.check();
    await expect(validCheckbox).toBeChecked();
    await expect(invalidCheckbox).toBeChecked();

    await page.locator('#purchaseOrderList [data-purchase-list-action="mark-selected-ordered"]').click();
    const bulkOrderToast = await collectToast(page, runtime, "it-pursup-11-bulk-order", { errorPattern: /^$/ });
    expect(bulkOrderToast).toContain("Đã chuyển 1 phiếu sang Đã đặt hàng.");

    const latestStateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
    expect(latestStateResponse.ok()).toBeTruthy();
    const latestState = await latestStateResponse.json();
    const latestValidPurchase = (latestState.purchases || []).find((purchase) => purchase.id === validPurchase.id);
    const latestInvalidPurchase = (latestState.purchases || []).find((purchase) => purchase.id === invalidPurchase.id);
    expect(String(latestValidPurchase?.status || "")).toBe("ordered");
    expect(String(latestInvalidPurchase?.status || "")).toBe("draft");

    await expect(page.locator("#purchaseOrderList .inline-alert.warning")).toContainText("1 phiếu nhập đang được chọn");
    await expect(invalidCheckbox).toBeChecked();
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
  const snapshot = await createBackupSnapshot(request);
  const originalState = await fetchSyncState(request, userCookie);
  const products = await fetchProducts(request, userCookie);
  const candidateProducts = products.filter((product) =>
    !hasActualPurchaseHistory(originalState, product.id)
    && !hasAnyOpenPurchaseReference(originalState, product.id)
  );
  expect(candidateProducts.length).toBeGreaterThanOrEqual(1);
  const uniqueProduct = products.find((product) =>
    product.name === "Bò kho"
    && !hasActualPurchaseHistory(originalState, product.id)
    && !hasAnyOpenPurchaseReference(originalState, product.id)
  ) || candidateProducts[0];
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

    await page.goto("/admin");
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
    const uniqueToast = await waitForToastContaining(page, `tự chọn ${uniqueSupplier}`);
    runtime.toasts.push(`it-pursup-05-unique:${uniqueToast}`);
    expect(uniqueToast).toContain(`tự chọn ${uniqueSupplier}`);
    await expect(page.locator("#purchaseSupplierInput")).toHaveValue(uniqueSupplier);

    const stateAfterUnique = await fetchSyncState(request, userCookie);
    expect((stateAfterUnique.purchases || []).some((purchase) =>
      purchase.status === "draft" &&
      purchase.supplierName === uniqueSupplier &&
      (purchase.items || []).some((item) => Number(item.productId) === Number(uniqueProduct.id))
    )).toBeTruthy();
  } finally {
    await restoreBackupSnapshot(request, snapshot, page);
  }

  expectNoRuntimeErrors(runtime);
});

test("IT-PURSUP-06 purchase supplier suggestions prioritize multiple historical suppliers", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page, { autoAcceptDialogs: false });
  const timestamp = Date.now();
  const now = new Date().toISOString();
  const userCookie = await autoLoginUserRequest(request);
  const snapshot = await createBackupSnapshot(request);
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

    await page.goto("/admin");
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
    await restoreBackupSnapshot(request, snapshot, page);
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
  const snapshot = await createBackupSnapshot(request);
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

    await page.goto("/admin");
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
    await expect(page.locator("#purchasePanel")).toContainText(targetProduct.name);
    await expect(page.locator("#purchasePanel")).toContainText("Cảnh báo NCC theo mặt hàng");

    const latestState = await fetchSyncState(request, userCookie);
    expect((latestState.purchases || []).some((purchase) =>
      purchase.status === "draft" &&
      !String(purchase.supplierName || "").trim() &&
      (purchase.items || []).some((item) => Number(item.productId) === Number(targetProduct.id))
    )).toBeTruthy();
  } finally {
    await restoreBackupSnapshot(request, snapshot, page);
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
  const snapshot = await createBackupSnapshot(request);

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

    await page.goto("/admin");
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
    await restoreBackupSnapshot(request, snapshot, page);
  }

  expectNoRuntimeErrors(runtime);
});



