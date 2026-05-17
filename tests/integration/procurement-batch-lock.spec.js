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
  return {
    ...state,
    purchases: (state.purchases || []).filter((purchase) => {
      const id = String(purchase?.id || "");
      return !id.startsWith("purchase_conflict_batch_") && !id.startsWith("purchase_batch_lock_");
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
    return id.startsWith("purchase_conflict_batch_") || id.startsWith("purchase_batch_lock_");
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

    await gotoWithRetry(page, "/");
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
  const product = productsPayload.products?.[0];
  expect(product).toBeTruthy();
  const timestamp = Date.now();
  const supplierName = `NCC Batch Lock ${timestamp}`;
  const purchaseId = `purchase_batch_lock_${timestamp}`;

  const seededPurchase = {
    id: purchaseId,
    supplierName,
    note: "IT-PROC-02 batch ordered purchase",
    status: "ordered",
    sourceType: "procurement_batch",
    sourceCode: `batch-${timestamp}`,
    sourceName: "Batch procurement planner",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: `purchase_batch_lock_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity: 2,
        unitCost: Number(product.price || 0) || 1000,
      },
    ],
  };

  let batchStarted = false;
  try {
    await cleanupProcurementBatchTestPurchases(request, managerCookie);

    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: managerCookie },
      data: {
        purchases: [...(restoredState.purchases || []), seededPurchase],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    const startResponse = await request.post("/api/procurement/batch/start", {
      headers: { Cookie: managerCookie },
      data: {},
    });
    const startPayload = await startResponse.json();
    expect(startResponse.ok(), JSON.stringify(startPayload)).toBeTruthy();
    batchStarted = true;

    await gotoWithRetry(page, "/");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });
    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");

    await expect(page.locator("#createPurchaseDraftButton")).toBeDisabled();

    const purchaseCard = page.locator(".cart-queue-item", { hasText: supplierName }).first();
    await purchaseCard.locator('[data-purchase-list-action="open"]').click();
    await page.waitForTimeout(300);

    await expect(page.locator("#purchasePanel")).toContainText("Batch mode đang bật. Bạn chỉ được xem phiếu nháp/đã đặt này");
    await expect(page.locator('[data-go-menu="suppliers"]').first()).toBeDisabled();
    await expect(page.locator('[data-purchase-action="receive"]')).toBeEnabled();
    await expect(page.locator('[data-purchase-action="cancel"]')).toHaveCount(0);
    await expect(page.locator('[data-purchase-item-action="remove"]')).toHaveCount(0);

    await switchMenu(page, "procurement-planner");
    await expectScreenTitle(page, "Xử lý nhập thiếu");
    await expect(page.locator("#procurementExtraPanel")).toBeHidden();
  } finally {
    if (batchStarted) {
      await request.post("/api/procurement/batch/finish", {
        headers: { Cookie: managerCookie },
        data: {},
      });
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
    });
  }

  expectNoRuntimeErrors(runtime);
});

test("IT-PROC-03 owner can add extra product rows and review mixed batch purchase in one supplier draft", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const managerCookie = await autoLoginProcurementManagerRequest(request);
  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: managerCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const productsResponse = await request.get("/api/products", { headers: { Cookie: managerCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const shortageProduct = (productsPayload.products || []).find((product) => product.name === "Chả quế chay");
  const extraProduct = (productsPayload.products || []).find((product) => product.name === "Ruốc nấm");
  expect(shortageProduct).toBeTruthy();
  expect(extraProduct).toBeTruthy();
  const timestamp = Date.now();
  const supplierName = "NCC Hương Sen";
  let batchStarted = false;

  try {
    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: managerCookie },
      data: {
        carts: [
          ...(originalState.carts || []),
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

    await gotoWithRetry(page, "/");
    await page.waitForLoadState("networkidle");
    await autoLoginProcurementManager(page, request);
    await page.reload({ waitUntil: "networkidle" });
    await switchMenu(page, "procurement-planner");
    await expectScreenTitle(page, "Xử lý nhập thiếu");

    await page.locator("#procurementStartBatchButton").click();
    const batchToast = await collectToast(page, runtime, "it-proc-03-start-batch");
    expect(batchToast).toContain("Đã bắt đầu kỳ gom nhập");
    batchStarted = true;

    await page.locator(`[data-procurement-action="toggle-row"][data-product-id="${shortageProduct.id}"]`).check();
    await page.locator(`[data-procurement-field="supplier"][data-product-id="${shortageProduct.id}"]`).fill(supplierName);

    await expect(page.locator("#procurementExtraPanel")).toBeVisible();
    await page.locator('#procurementExtraPanel [data-procurement-extra-action="toggle"]').click();
    await page.locator('#procurementExtraPanel [data-procurement-extra-input="productName"]').fill(extraProduct.name);
    await page.locator('#procurementExtraPanel [data-procurement-extra-action="add"]').click();

    const extraRow = page.locator('#procurementExtraPanel [data-procurement-extra-row]').filter({ hasText: extraProduct.name }).first();
    await expect(extraRow).toBeVisible();
    await expect(extraRow).toContainText("Ngoài nhu cầu đơn");
    await extraRow.locator('[data-procurement-extra-field="supplierName"]').fill(supplierName);
    await extraRow.locator('[data-procurement-extra-field="quantity"]').fill("2");

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
      });
    }
    await request.put("/api/state", {
      headers: { Cookie: managerCookie },
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
