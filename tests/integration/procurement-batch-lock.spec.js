const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginProcurementManager,
  autoLoginProcurementManagerRequest,
  autoLoginUser,
  collectToast,
  expectNoRuntimeErrors,
  expectScreenTitle,
  gotoWithRetry,
  switchMenu,
} = require("./support/ui");

function stripProcurementBatchTestPurchases(state) {
  const isProcurementTestSupplier = (supplier) => {
    const id = String(supplier?.id || "");
    const name = String(supplier?.name || "");
    return id.startsWith("supplier_proc114_")
      || id.startsWith("supplier_proc_merge_")
      || name.startsWith("NCC Proc114 ")
      || name.startsWith("NCC proc merge ");
  };
  return {
    ...state,
    carts: (state.carts || []).filter((cart) => {
      const id = String(cart?.id || "");
      return !id.startsWith("cart_proc114_batch_")
        && !id.startsWith("cart_proc129_batch_")
        && !id.startsWith("cart_proc_merge_");
    }),
    suppliers: (state.suppliers || []).filter((supplier) => !isProcurementTestSupplier(supplier)),
    purchases: (state.purchases || []).filter((purchase) => {
      const id = String(purchase?.id || "");
      const sourceType = String(purchase?.sourceType || purchase?.source_type || "").trim();
      const status = String(purchase?.status || "").trim();
      const isTemporaryProcurementPurchase = id.startsWith("purchase_conflict_batch_")
        || id.startsWith("purchase_batch_lock_")
        || id.startsWith("purchase_proc_merge_")
        || sourceType === "procurement_batch";
      return !(isTemporaryProcurementPurchase && ["draft", "ordered"].includes(status));
    }),
  };
}

async function cleanupProcurementBatchTestPurchases(request, cookie) {
  await request.post("/api/procurement/batch/finish", {
    headers: { Cookie: cookie },
    data: {},
  }).catch(() => null);

  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: cookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const currentState = await stateResponse.json();
  const targetPurchases = (currentState.purchases || []).filter((purchase) => {
    const id = String(purchase?.id || "");
    const sourceType = String(purchase?.sourceType || purchase?.source_type || "").trim();
    return id.startsWith("purchase_conflict_batch_")
      || id.startsWith("purchase_batch_lock_")
      || id.startsWith("purchase_proc_merge_")
      || sourceType === "procurement_batch";
  });

  for (const purchase of targetPurchases) {
    const status = String(purchase?.status || "").trim();
    if (!["draft", "ordered"].includes(status)) {
      continue;
    }
    const action = status === "draft" ? "delete" : "cancel";
    const response = await request.post("/api/purchases/repair", {
      headers: { Cookie: cookie },
      data: {
        purchase_id: purchase.id,
        action,
      },
    });
    const payload = await response.json();
    expect(response.ok(), JSON.stringify(payload)).toBeTruthy();
  }
}

async function restoreStateAfterTest(request, cookie, restoredState) {
  const finalStateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: cookie } });
  expect(finalStateResponse.ok()).toBeTruthy();
  const finalState = await finalStateResponse.json();
  const cleanPurchases = (finalState.purchases || []).filter((purchase) => {
    const id = String(purchase?.id || "");
    const sourceType = String(purchase?.sourceType || purchase?.source_type || "").trim();
    const status = String(purchase?.status || "").trim();
    const isTemporary = id.startsWith("purchase_conflict_batch_")
      || id.startsWith("purchase_batch_lock_")
      || id.startsWith("purchase_proc_merge_")
      || sourceType === "procurement_batch";
    return !(isTemporary && ["draft", "ordered"].includes(status));
  });

  const response = await request.put("/api/state", {
    headers: { Cookie: cookie },
    data: {
      customers: restoredState.customers,
      suppliers: restoredState.suppliers,
      carts: restoredState.carts,
      purchases: cleanPurchases,
    },
  });
  expect(response.ok()).toBeTruthy();
}

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

test("IT-PROC-01 start batch shows clickable conflict list for overlapping open purchases", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const managerCookie = await autoLoginProcurementManagerRequest(request);
  const timestamp = Date.now();

  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: managerCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const restoredState = stripProcurementBatchTestPurchases(originalState);
  const productsResponse = await request.get("/api/products", { headers: { Cookie: managerCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const product = productsPayload.products?.[0];
  expect(product).toBeTruthy();

  const purchaseDraftId = `purchase_conflict_batch_draft_${timestamp}`;
  const purchaseOrderedId = `purchase_conflict_batch_ordered_${timestamp}`;
  const supplierName = `NCC Conflict ${timestamp}`;
  const purchases = [
    {
      id: purchaseDraftId,
      supplierName,
      note: "IT-PROC-01 draft conflict",
      status: "draft",
      sourceType: "cart",
      sourceCode: `cart_conflict_${timestamp}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [
        {
          id: `purchase_conflict_batch_draft_item_${timestamp}`,
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          quantity: 2,
          unitCost: Number(product.price || 0) || 1000,
        },
      ],
    },
    {
      id: purchaseOrderedId,
      supplierName,
      note: "IT-PROC-01 manual conflict",
      status: "draft",
      sourceType: "manual",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [
        {
          id: `purchase_conflict_batch_ordered_item_${timestamp}`,
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          quantity: 3,
          unitCost: Number(product.price || 0) || 1000,
        },
      ],
    },
  ];

  try {
    await cleanupProcurementBatchTestPurchases(request, managerCookie);

    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: managerCookie },
      data: {
        purchases: [...(restoredState.purchases || []), ...purchases],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await gotoWithRetry(page, "/admin");
    await page.waitForLoadState("networkidle");
    await autoLoginProcurementManager(page, request);
    await page.reload({ waitUntil: "networkidle" });
    await switchMenu(page, "procurement-planner");
    await expectScreenTitle(page, "Xử lý nhập thiếu");

    await page.locator("#procurementStartBatchButton").click();

    const toast = await collectToast(page, runtime, "it-proc-01-start-batch");
    expect(toast).toContain("Cần dọn conflict trước khi bắt đầu kỳ gom nhập");

    const conflictPanel = page.locator('[data-procurement-start-conflicts]');
    await expect(conflictPanel).toBeVisible();
    await expect(conflictPanel).toContainText(product.name);
    await expect(conflictPanel.locator(`[data-procurement-conflict-action="open-purchase"][data-purchase-id="${purchaseDraftId}"]`)).toBeVisible();
    await expect(conflictPanel.locator(`[data-procurement-conflict-action="open-purchase"][data-purchase-id="${purchaseOrderedId}"]`)).toBeVisible();

    await conflictPanel.locator(`[data-procurement-conflict-action="open-purchase"][data-purchase-id="${purchaseDraftId}"]`).click();
    await expectScreenTitle(page, "Nhập hàng");
    await expect(page.locator("#purchasePanel")).toContainText(supplierName);
    await expect(page.locator("#purchasePanel")).toContainText("IT-PROC-01 draft conflict");
    runtime.errors = runtime.errors.filter((entry) => !entry.includes("status of 400 (Bad Request)"));
  } finally {
    await cleanupProcurementBatchTestPurchases(request, managerCookie);
    await request.put("/api/state", {
      headers: { Cookie: managerCookie },
      data: {
        customers: restoredState.customers,
        suppliers: restoredState.suppliers,
        carts: restoredState.carts,
        purchases: restoredState.purchases,
      },
    });
  }

  expectNoRuntimeErrors(runtime);
});

test("IT-PROC-02 non-owner sees purchase draft ordered structure locked during active batch", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const managerCookie = await autoLoginProcurementManagerRequest(request);
  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: managerCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const restoredState = stripProcurementBatchTestPurchases(originalState);
  const productsResponse = await request.get("/api/products", { headers: { Cookie: managerCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const openPurchaseProductIds = new Set(
    (restoredState.purchases || [])
      .filter((purchase) => ["draft", "ordered"].includes(String(purchase?.status || "").trim()))
      .flatMap((purchase) => (purchase.items || []).map((item) => Number(item?.productId || 0)))
      .filter((productId) => Number.isFinite(productId) && productId > 0)
  );
  const availableProducts = (productsPayload.products || []).filter(
    (product) => !openPurchaseProductIds.has(Number(product?.id || 0))
  );
  const batchProduct = availableProducts[0];
  const prebatchManualProduct = availableProducts[1];
  expect(batchProduct).toBeTruthy();
  expect(prebatchManualProduct).toBeTruthy();
  const timestamp = Date.now();
  const batchSupplierName = `NCC Batch Lock Batch ${timestamp}`;
  const prebatchSupplierName = `NCC Batch Lock Manual ${timestamp}`;
  const batchPurchaseId = `purchase_batch_lock_batch_${timestamp}`;
  const prebatchPurchaseId = `purchase_batch_lock_manual_${timestamp}`;
  const prebatchDraftCreatedAt = "2026-05-16T06:30:00+00:00";
  const prebatchOrderedAt = "2026-05-16T07:00:00+00:00";

  const seededBatchPurchase = {
    id: batchPurchaseId,
    supplierName: batchSupplierName,
    note: "IT-PROC-02 batch ordered purchase",
    status: "ordered",
    sourceType: "procurement_batch",
    sourceCode: `batch-${timestamp}`,
    sourceName: "Batch procurement planner",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: `purchase_batch_lock_batch_item_${timestamp}`,
        productId: batchProduct.id,
        productName: batchProduct.name,
        unit: batchProduct.unit,
        quantity: 2,
        unitCost: Number(batchProduct.price || 0) || 1000,
      },
    ],
  };
  const seededPrebatchManualPurchase = {
    id: prebatchPurchaseId,
    supplierName: prebatchSupplierName,
    note: "IT-PROC-02 manual ordered purchase before batch",
    status: "draft",
    sourceType: "manual",
    createdAt: prebatchDraftCreatedAt,
    updatedAt: prebatchDraftCreatedAt,
    items: [
      {
        id: `purchase_batch_lock_manual_item_${timestamp}`,
        productId: prebatchManualProduct.id,
        productName: prebatchManualProduct.name,
        unit: prebatchManualProduct.unit,
        quantity: 3,
        unitCost: Number(prebatchManualProduct.price || 0) || 1000,
      },
    ],
  };

  let batchStarted = false;
  try {
    await cleanupProcurementBatchTestPurchases(request, managerCookie);

    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: managerCookie },
      data: {
        purchases: [...(restoredState.purchases || []), seededBatchPurchase, seededPrebatchManualPurchase],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    const orderedSeedResponse = await request.put("/api/state", {
      headers: { Cookie: managerCookie },
      data: {
        purchases: [
          ...(restoredState.purchases || []),
          seededBatchPurchase,
          {
            ...seededPrebatchManualPurchase,
            status: "ordered",
            orderedAt: prebatchOrderedAt,
            updatedAt: prebatchOrderedAt,
          },
        ],
      },
    });
    const orderedSeedPayload = await orderedSeedResponse.json();
    expect(orderedSeedResponse.ok(), JSON.stringify(orderedSeedPayload)).toBeTruthy();

    const startResponse = await request.post("/api/procurement/batch/start", {
      headers: { Cookie: managerCookie },
      data: {},
    });
    const startPayload = await startResponse.json();
    expect(startResponse.ok(), JSON.stringify(startPayload)).toBeTruthy();
    batchStarted = true;

    const ownerUpdatedStateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: managerCookie } });
    expect(ownerUpdatedStateResponse.ok()).toBeTruthy();
    const ownerUpdatedState = await ownerUpdatedStateResponse.json();
    const ownerUpdatedPurchases = (ownerUpdatedState.purchases || []).map((purchase) => (
      purchase.id === prebatchPurchaseId
        ? { ...purchase, note: "IT-PROC-02 owner updated note after batch started" }
        : purchase
    ));
    const ownerUpdatedResponse = await request.put("/api/state", {
      headers: { Cookie: managerCookie },
      data: {
        purchases: ownerUpdatedPurchases,
      },
    });
    const ownerUpdatedPayload = await ownerUpdatedResponse.json();
    expect(ownerUpdatedResponse.ok(), JSON.stringify(ownerUpdatedPayload)).toBeTruthy();

    await page.context().clearCookies();
    await gotoWithRetry(page, "/admin");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });
    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");

    await expect(page.locator("#createPurchaseDraftButton")).toBeDisabled();

    const purchaseCard = page.locator(".cart-queue-item", { hasText: batchSupplierName }).first();
    await purchaseCard.locator('[data-purchase-list-action="open"]').click();
    await page.waitForTimeout(300);
    if (await page.locator("#purchasePanel").getByText("Phiếu nhập đang được thu gọn.").count()) {
      await page.locator("#togglePurchasePanelButton").click();
      await page.waitForTimeout(300);
    }

    await expect(page.locator("#purchasePanel")).toContainText("Batch mode đang bật. Bạn chỉ được xem phiếu nháp/đã đặt này");
    await expect(page.locator("#purchasePanel")).toContainText(batchSupplierName);
    await expect(page.locator('[data-go-menu="suppliers"]').first()).toBeDisabled();
    await expect(page.locator('[data-purchase-action="receive"]')).toHaveCount(0);
    await expect(page.locator('[data-purchase-action="cancel"]')).toHaveCount(0);
    await expect(page.locator('[data-purchase-item-action="remove"]')).toHaveCount(0);

    const prebatchManualPurchaseCard = page.locator(".cart-queue-item", { hasText: prebatchSupplierName }).first();
    await prebatchManualPurchaseCard.locator('[data-purchase-list-action="open"]').click();
    await page.waitForTimeout(300);
    if (await page.locator("#purchasePanel").getByText("Phiếu nhập đang được thu gọn.").count()) {
      await page.locator("#togglePurchasePanelButton").click();
      await page.waitForTimeout(300);
    }
    await expect(page.locator("#purchasePanel")).toContainText(prebatchSupplierName);
    await expect(page.locator('[data-purchase-action="receive"]')).toBeEnabled();
    await page.locator('[data-purchase-action="receive"]').click();
    await expect(page.locator("#purchasePanel")).toContainText("Đã nhập kho");
    await expect(page.locator('[data-purchase-action="mark-paid"]')).toBeEnabled();
    await page.locator('[data-purchase-action="mark-paid"]').click();
    await expect(page.locator("#purchasePanel")).toContainText("Đã thanh toán");

    await switchMenu(page, "procurement-planner");
    await expectScreenTitle(page, "Xử lý nhập thiếu");
    await expect(page.locator("#procurementExtraPanel")).toBeHidden();
  } finally {
    if (batchStarted) {
      await request.post("/api/procurement/batch/finish", {
        headers: { Cookie: managerCookie },
        data: {},
      }).catch(() => null);
    }
    await cleanupProcurementBatchTestPurchases(request, managerCookie);
    await request.put("/api/state", {
      headers: { Cookie: managerCookie },
      data: {
        customers: restoredState.customers,
        suppliers: restoredState.suppliers,
        carts: restoredState.carts,
        purchases: restoredState.purchases,
      },
    }).catch(() => null);
  }

  expectNoRuntimeErrors(runtime);
});

test("IT-PROC-03 owner can add extra product rows and review mixed batch purchase in one supplier draft", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const managerCookie = await autoLoginProcurementManagerRequest(request);
  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: managerCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const restoredState = stripProcurementBatchTestPurchases(originalState);
  const productsResponse = await request.get("/api/products", { headers: { Cookie: managerCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const shortageProduct = (productsPayload.products || []).find((product) => product.name === "Chả quế chay");
  const extraProduct = (productsPayload.products || []).find((product) => product.name === "Ruốc nấm");
  expect(shortageProduct).toBeTruthy();
  expect(extraProduct).toBeTruthy();
  const timestamp = Date.now();
  const supplierName = `NCC Proc114 ${timestamp}`;
  let batchStarted = false;

  try {
    await cleanupProcurementBatchTestPurchases(request, managerCookie);

    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: managerCookie },
      data: {
        suppliers: [
          ...(restoredState.suppliers || []),
          {
            id: `supplier_proc114_${timestamp}`,
            name: supplierName,
          },
        ],
        carts: [
          ...(restoredState.carts || []),
          {
            id: `cart_proc114_batch_${timestamp}`,
            customerName: "Khách proc114",
            status: "draft",
            items: [
              {
                id: `cart_proc114_batch_item_${timestamp}`,
                productId: shortageProduct.id,
                productName: shortageProduct.name,
                quantity: 10,
                unitPrice: Number(shortageProduct.sale_price || shortageProduct.salePrice || 0) || 55000,
              },
            ],
          },
        ],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await gotoWithRetry(page, "/admin");
    await page.waitForLoadState("networkidle");
    await autoLoginProcurementManager(page, request);
    await page.reload({ waitUntil: "networkidle" });
    await switchMenu(page, "procurement-planner");
    await expectScreenTitle(page, "Xử lý nhập thiếu");

    await page.locator("#procurementStartBatchButton").click();
    const batchToast = await collectToast(page, runtime, "it-proc-03-start-batch");
    expect(batchToast).toContain("Đã bắt đầu kỳ gom nhập");
    batchStarted = true;

    await page.locator(`[data-procurement-action="toggle-row"][data-product-id="${shortageProduct.id}"]`).click();
    await expect(page.locator(`[data-procurement-field="supplier"][data-product-id="${shortageProduct.id}"]`)).toBeVisible();
    await page.locator(`[data-procurement-field="supplier"][data-product-id="${shortageProduct.id}"]`).fill(supplierName);

    await expect(page.locator("#procurementExtraPanel")).toBeVisible();
    await page.locator('#procurementExtraPanel [data-procurement-extra-action="toggle"]').click();
    await expect(page.locator("#procurementExtraPanel")).toContainText("Đang có trên planner nhưng Cần nhập = 0");

    const extraRow = page.locator(`#procurementExtraPanel [data-procurement-extra-candidate][data-product-id="${extraProduct.id}"]`).first();
    await expect(extraRow).toBeVisible();
    await extraRow.locator('[data-procurement-extra-select]').check();
    await expect(extraRow).toContainText("Ngoài nhu cầu đơn");
    await extraRow.locator(`[data-procurement-extra-field="supplierName"][data-product-id="${extraProduct.id}"]`).fill(supplierName);
    await extraRow.locator(`[data-procurement-extra-field="quantity"][data-product-id="${extraProduct.id}"]`).fill("2");

    await page.locator("#procurementCreateSelectedButton").click();
    const createToast = await collectToast(page, runtime, "it-proc-03-create");
    expect(createToast).toContain("Đã tạo/cập nhật 1 phiếu nhập từ kỳ gom nhập.");

    await page.locator("#procurementReviewButton").click();
    await expect(page.locator("#procurementReviewPanel")).toContainText(shortageProduct.name);
    await expect(page.locator("#procurementReviewPanel")).toContainText(extraProduct.name);
    await expect(page.locator('#procurementReviewPanel [data-procurement-review-action="open"]')).toHaveCount(1);
  } finally {
    if (batchStarted) {
      await request.post("/api/procurement/batch/finish", {
        headers: { Cookie: managerCookie },
        data: {},
      }).catch(() => null);
    }
    await cleanupProcurementBatchTestPurchases(request, managerCookie);
    await request.put("/api/state", {
      headers: { Cookie: managerCookie },
      data: {
        customers: restoredState.customers,
        suppliers: restoredState.suppliers,
        carts: restoredState.carts,
        purchases: restoredState.purchases,
      },
    }).catch(() => null);
  }

  expectNoRuntimeErrors(runtime);
});

test("IT-PROC-03A planner hides zero-need shortage rows and keeps mobile scroll after supplier change", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const managerCookie = await autoLoginProcurementManagerRequest(request);
  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: managerCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const restoredState = stripProcurementBatchTestPurchases(originalState);
  const productsResponse = await request.get("/api/products", { headers: { Cookie: managerCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const zeroNeedProduct = (productsPayload.products || []).find((product) => product.name === "Bò lát xào");
  const shortageProduct = (productsPayload.products || []).find((product) => product.name === "Chả quế chay");
  expect(zeroNeedProduct).toBeTruthy();
  expect(shortageProduct).toBeTruthy();
  const timestamp = Date.now();
  let batchStarted = false;

  try {
    await cleanupProcurementBatchTestPurchases(request, managerCookie);

    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: managerCookie },
      data: {
        customers: restoredState.customers,
        suppliers: restoredState.suppliers,
        carts: [
          ...(restoredState.carts || []),
          {
            id: `cart_proc129_batch_${timestamp}`,
            customerName: "Khách proc129",
            status: "draft",
            items: [
              {
                id: `cart_proc129_batch_item_${timestamp}`,
                productId: shortageProduct.id,
                productName: shortageProduct.name,
                quantity: 10,
                unitPrice: Number(shortageProduct.sale_price || shortageProduct.salePrice || 0) || 55000,
              },
            ],
          },
        ],
      },
    });
    const seedPayload = await seedResponse.json();
    expect(seedResponse.ok(), JSON.stringify(seedPayload)).toBeTruthy();

    await page.setViewportSize({ width: 390, height: 480 });
    await gotoWithRetry(page, "/admin");
    await page.waitForLoadState("networkidle");
    await autoLoginProcurementManager(page, request);
    await page.reload({ waitUntil: "networkidle" });
    await switchMenu(page, "procurement-planner");
    await expectScreenTitle(page, "Xử lý nhập thiếu");

    await page.locator("#procurementStartBatchButton").click();
    const batchToast = await collectToast(page, runtime, "it-proc-03a-start-batch");
    expect(batchToast).toContain("Đã bắt đầu kỳ gom nhập");
    batchStarted = true;

    await expect(page.locator(`[data-procurement-action="toggle-row"][data-product-id="${shortageProduct.id}"]`)).toBeVisible();
    await expect(page.locator(`[data-procurement-action="toggle-row"][data-product-id="${zeroNeedProduct.id}"]`)).toHaveCount(0);

    await page.locator('#procurementExtraPanel [data-procurement-extra-action="toggle"]').click();
    const extraPanel = page.locator("#procurementExtraPanel");
    await expect(extraPanel).toContainText("Đang có trên planner nhưng Cần nhập = 0");
    const zeroNeedRow = extraPanel.locator(`[data-procurement-extra-candidate][data-product-id="${zeroNeedProduct.id}"]`).first();
    await expect(zeroNeedRow).toBeVisible();
    await expect(zeroNeedRow).not.toContainText("Đang có trên planner (cần nhập 0)");

    await zeroNeedRow.locator("[data-procurement-extra-select]").check();
    const supplierInput = zeroNeedRow.locator(`[data-procurement-extra-field="supplierName"][data-product-id="${zeroNeedProduct.id}"]`);
    await supplierInput.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const beforeScrollY = await page.evaluate(() => window.scrollY);
    await supplierInput.fill("NCC Hương Sen");
    await supplierInput.evaluate((element) => element.blur());
    await page.waitForTimeout(250);
    const afterScrollY = await page.evaluate(() => window.scrollY);
    expect(Math.abs(afterScrollY - beforeScrollY)).toBeLessThan(40);
    await expect(zeroNeedRow).toContainText("Ngoài nhu cầu đơn");
  } finally {
    if (batchStarted) {
      await request.post("/api/procurement/batch/finish", {
        headers: { Cookie: managerCookie },
        data: {},
      }).catch(() => null);
    }
    await cleanupProcurementBatchTestPurchases(request, managerCookie);
    await request.put("/api/state", {
      headers: { Cookie: managerCookie },
      data: {
        customers: restoredState.customers,
        suppliers: restoredState.suppliers,
        carts: restoredState.carts,
        purchases: restoredState.purchases,
      },
    }).catch(() => null);
  }

  expectNoRuntimeErrors(runtime);
});

test("IT-PROC-04 leaving procurement flow prompts to finish batch and offers stay-or-switch while lock stays active", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page, { autoAcceptDialogs: false });
  const managerCookie = await autoLoginProcurementManagerRequest(request);
  let batchStarted = false;
  try {
    await cleanupProcurementBatchTestPurchases(request, managerCookie);

    await gotoWithRetry(page, "/admin");
    await page.waitForLoadState("networkidle");
    await autoLoginProcurementManager(page, request);
    await page.reload({ waitUntil: "networkidle" });
    await switchMenu(page, "procurement-planner");
    await expectScreenTitle(page, "Xử lý nhập thiếu");

    await page.locator("#procurementStartBatchButton").click();
    const batchToast = await collectToast(page, runtime, "it-proc-04-start-batch");
    expect(batchToast).toContain("Đã bắt đầu kỳ gom nhập");
    batchStarted = true;

    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");

    const stayDialogMessages = [];
    const stayDialogHandler = async (dialog) => {
      stayDialogMessages.push(dialog.message());
      if (stayDialogMessages.length === 1) {
        await dialog.dismiss();
        return;
      }
      await dialog.accept();
    };
    page.on("dialog", stayDialogHandler);
    await switchMenu(page, "inventory");
    await page.waitForTimeout(800);
    page.off("dialog", stayDialogHandler);
    expect(stayDialogMessages[0]).toContain("Kỳ gom nhập vẫn đang bật");
    expect(stayDialogMessages[1]).toContain("Batch mode vẫn đang active lock");
    await expectScreenTitle(page, "Nhập hàng");

    const keepBatchDialogMessages = [];
    const keepBatchDialogHandler = async (dialog) => {
      keepBatchDialogMessages.push(dialog.message());
      await dialog.dismiss();
    };
    page.on("dialog", keepBatchDialogHandler);
    await switchMenu(page, "inventory");
    await page.waitForTimeout(800);
    page.off("dialog", keepBatchDialogHandler);
    expect(keepBatchDialogMessages[0]).toContain("Kỳ gom nhập vẫn đang bật");
    expect(keepBatchDialogMessages[1]).toContain("Batch mode vẫn đang active lock");
    await expectScreenTitle(page, "Kiểm tra tồn kho");

    const activeLockBanner = page.locator('[data-procurement-lock-alert="inventory"]');
    await expect(activeLockBanner).toBeVisible();
    await expect(activeLockBanner).toContainText("Kỳ gom nhập đang active lock");
    await expect(activeLockBanner).toContainText("Xử lý nhập thiếu");

    const batchStatusResponse = await request.get("/api/procurement/status", {
      headers: { Cookie: managerCookie },
    });
    expect(batchStatusResponse.ok()).toBeTruthy();
    const batchStatusPayload = await batchStatusResponse.json();
    expect(batchStatusPayload.mode).toBe("batch");

    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");

    let acceptDialogMessage = "";
    page.once("dialog", async (dialog) => {
      acceptDialogMessage = dialog.message();
      await dialog.accept();
    });
    await switchMenu(page, "inventory");
    await page.waitForTimeout(1200);
    expect(acceptDialogMessage).toContain("Chọn OK để kết thúc kỳ gom");
    await expectScreenTitle(page, "Kiểm tra tồn kho");

    const exitToast = await collectToast(page, runtime, "it-proc-04-exit-flow");
    expect(exitToast).toContain("Đã kết thúc kỳ gom nhập trước khi rời flow xử lý nhập thiếu.");
    batchStarted = false;

    const statusResponse = await request.get("/api/procurement/status", {
      headers: { Cookie: managerCookie },
    });
    expect(statusResponse.ok()).toBeTruthy();
    const statusPayload = await statusResponse.json();
    expect(statusPayload.mode).toBe("daily");
  } finally {
    if (batchStarted) {
      await request.post("/api/procurement/batch/finish", {
        headers: { Cookie: managerCookie },
        data: {},
      }).catch(() => null);
    }
  }

  expectNoRuntimeErrors(runtime);
});

test("IT-PROC-05 procurement planner blocks merging mixed purchase and sales documents", async ({ page, request }) => {
  test.setTimeout(90000);
  const runtime = attachRuntimeTracking(page);
  const managerCookie = await autoLoginProcurementManagerRequest(request);
  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: managerCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const restoredState = stripProcurementBatchTestPurchases(originalState);
  const productsResponse = await request.get("/api/products", { headers: { Cookie: managerCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const openPurchaseProductIds = new Set(
    (restoredState.purchases || [])
      .filter((purchase) => ["draft", "ordered"].includes(String(purchase?.status || "").trim()))
      .flatMap((purchase) => (purchase.items || []).map((item) => Number(item?.productId || 0)))
      .filter((productId) => Number.isFinite(productId) && productId > 0)
  );
  const shortageProduct = (productsPayload.products || []).find((product) =>
    Number.isFinite(Number(product?.current_stock || 0))
    && !openPurchaseProductIds.has(Number(product?.id || 0))
  ) || (productsPayload.products || []).find((product) => Number.isFinite(Number(product?.current_stock || 0)));
  expect(shortageProduct).toBeTruthy();
  const timestamp = Date.now();
  const customerName = `Khách proc merge ${timestamp}`;
  const supplierName = `NCC proc merge ${timestamp}`;
  const cartId = `cart_proc_merge_${timestamp}`;
  const purchaseId = `purchase_proc_merge_${timestamp}`;
  const shortageQuantity = Math.max(Number(shortageProduct.current_stock || 0) + 2, 2);
  let batchStarted = false;

  try {
    await cleanupProcurementBatchTestPurchases(request, managerCookie);

    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: managerCookie },
      data: {
        customers: restoredState.customers,
        suppliers: restoredState.suppliers,
        carts: [
          ...(restoredState.carts || []),
          {
            id: cartId,
            customerName,
            status: "draft",
            paymentStatus: "unpaid",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            items: [
              {
                id: `cart_proc_merge_item_${timestamp}`,
                productId: shortageProduct.id,
                productName: shortageProduct.name,
                unit: shortageProduct.unit,
                quantity: shortageQuantity,
                unitPrice: Number(shortageProduct.sale_price || shortageProduct.price || 0) || 1000,
                note: "",
              },
            ],
          },
        ],
        purchases: [
          ...(restoredState.purchases || []),
          {
            id: purchaseId,
            supplierName,
            note: "IT-PROC-05 phiếu nhập mở liên quan",
            status: "draft",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            items: [
              {
                id: `purchase_proc_merge_item_${timestamp}`,
                productId: shortageProduct.id,
                productName: shortageProduct.name,
                unit: shortageProduct.unit,
                quantity: 1,
                unitCost: Number(shortageProduct.price || 0) || 1000,
              },
            ],
          },
        ],
      },
    });
    const seedPayload = await seedResponse.json();
    expect(seedResponse.ok(), JSON.stringify(seedPayload)).toBeTruthy();

    const startResponse = await request.post("/api/procurement/batch/start", {
      headers: { Cookie: managerCookie },
      data: {},
    });
    const startPayload = await startResponse.json();
    expect(startResponse.ok(), JSON.stringify(startPayload)).toBeTruthy();
    batchStarted = true;

    await gotoWithRetry(page, "/admin");
    await page.waitForLoadState("networkidle");
    await autoLoginProcurementManager(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "orders");
    await expectScreenTitle(page, "Đơn hàng");
    await setFloatingSearch(page, customerName);
    const cartCard = page.locator(`[data-order-select="${cartId}"]`).first();
    await expect(cartCard).toBeVisible();
    await cartCard.locator('[data-queue-action="toggle-detail"]').click();
    await expect(page.locator("#orderDetailPanel")).toContainText(customerName);
    await page.locator('#orderDetailPanel [data-order-detail-action="commit"]').click();
    await expectScreenTitle(page, "Xử lý nhập thiếu");
    await expect(page.locator("[data-procurement-merge-panel]")).toBeVisible();

    await page.locator(`[data-procurement-merge-action="toggle"][data-document-key="cart:${cartId}"]`).check();
    await page.locator(`[data-procurement-merge-action="toggle"][data-document-key="purchase:${purchaseId}"]`).check();
    await page.locator('[data-procurement-merge-action="start"]').click();
    const mixedToast = await collectToast(page, runtime, "it-proc-05-mixed", { errorPattern: /^$/ });
    expect(mixedToast).toContain("Không gộp lẫn phiếu nhập và phiếu xuất trong cùng một lần thao tác.");
    await expectScreenTitle(page, "Xử lý nhập thiếu");
    await expect(page.locator("[data-procurement-merge-panel]")).toBeVisible();
  } finally {
    if (batchStarted) {
      await request.post("/api/procurement/batch/finish", {
        headers: { Cookie: managerCookie },
        data: {},
      }).catch(() => null);
    }
    await cleanupProcurementBatchTestPurchases(request, managerCookie);
    await request.put("/api/state", {
      headers: { Cookie: managerCookie },
      data: {
        customers: restoredState.customers,
        suppliers: restoredState.suppliers,
        carts: restoredState.carts,
        purchases: restoredState.purchases,
      },
    }).catch(() => null);
  }

  expectNoRuntimeErrors(runtime);
});



