const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginAdmin,
  autoLoginProcurementManager,
  autoLoginUser,
  autoLoginUserRequest,
  collectToast,
  expectNoRuntimeErrors,
  expectScreenTitle,
  gotoWithRetry,
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

async function captureDialogMessage(page, trigger, { accept = true } = {}) {
  const dialogPromise = page.waitForEvent("dialog").then(async (dialog) => {
    const message = dialog.message();
    if (accept) {
      await dialog.accept();
    } else {
      await dialog.dismiss();
    }
    return message;
  });
  await trigger();
  return dialogPromise;
}

async function ensureSelectedCartItemsExpanded(page, itemId) {
  const lineToggleButton = page.locator(`[data-cart-item-action="toggle-detail"][data-item-id="${itemId}"]`);
  if (await lineToggleButton.isVisible().catch(() => false)) {
    return;
  }
  const sectionToggleButton = page.locator("#selectedCartToggleButton");
  if (await sectionToggleButton.isVisible().catch(() => false)) {
    await sectionToggleButton.click();
  }
  await expect(lineToggleButton).toBeVisible();
}

async function ensureSelectedPurchaseItemsExpanded(page, itemId) {
  const costInput = page.locator(`[data-purchase-cost-input="${itemId}"]`);
  if (await costInput.isVisible().catch(() => false)) {
    return;
  }
  const sectionBody = page.locator(".selected-items-body");
  if (await sectionBody.isHidden().catch(() => false)) {
    const sectionToggleButton = page.locator('[data-purchase-selected-action="toggle"]');
    if (await sectionToggleButton.isVisible().catch(() => false)) {
      await sectionToggleButton.click();
      await page.waitForTimeout(300);
    }
  }
  const itemToggleButton = page.locator(`[data-purchase-item-action="toggle-detail"][data-purchase-item-id="${itemId}"]`);
  if (await itemToggleButton.isVisible().catch(() => false)) {
    await itemToggleButton.click();
    await page.waitForTimeout(300);
  }
  await expect(costInput).toBeVisible();
}

function expectedQuantityText(value) {
  return String(Number(Number(value).toFixed(2))).replace(".", ",");
}

test("ACC-PUR-01 purchase can only be marked paid after it has been received", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const userCookie = await autoLoginUserRequest(request);
  const timestamp = Date.now();
  const orderedSupplierName = `NCC Ordered ${timestamp}`;
  const receivedSupplierName = `NCC Received ${timestamp}`;
  const purchaseId = `purchase_ordered_test_${timestamp}`;
  const receivedPurchaseId = `purchase_received_test_${timestamp}`;

  const stateResponse = await request.get("./api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const productsResponse = await request.get("./api/products", { headers: { Cookie: userCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const product = productsPayload.products?.[0];
  expect(product).toBeTruthy();

  const orderedPurchase = {
    id: purchaseId,
    supplierName: orderedSupplierName,
    note: "ACC-PUR-01 ordered purchase",
    status: "ordered",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    receiptCode: `PN-ORDERED-${timestamp}`,
    items: [
      {
        id: `purchase_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitCost: Number(product.price || 0) || 1000,
      },
    ],
  };

  const receivedPurchase = {
    id: receivedPurchaseId,
    supplierName: receivedSupplierName,
    note: "ACC-PUR-01 received purchase",
    status: "received",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    receiptCode: `PN-RECEIVED-${timestamp}`,
    items: [
      {
        id: `purchase_item_received_${timestamp}`,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitCost: Number(product.price || 0) || 1000,
      },
    ],
  };

  try {
    const seedResponse = await request.put("./api/state", {
      headers: { Cookie: userCookie },
      data: {
        purchases: [...(originalState.purchases || []), orderedPurchase, receivedPurchase],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();
    const seededState = await seedResponse.json();

    await page.goto(process.env.TEST_ADMIN_PATH || "admin");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });
    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");

    const orderedPurchaseCard = page.locator(".cart-queue-item", { hasText: orderedSupplierName }).first();
    await orderedPurchaseCard.locator('[data-purchase-list-action="open"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-purchase-action="mark-paid"]')).toBeDisabled();

    const invalidPayload = structuredClone(seededState.purchases || []);
    const invalidPurchase = invalidPayload.find((purchase) => purchase.id === purchaseId);
    expect(invalidPurchase).toBeTruthy();
    invalidPurchase.status = "paid";
    invalidPurchase.receivedAt = new Date().toISOString();
    invalidPurchase.paidAt = new Date().toISOString();

    const invalidResponse = await request.put("./api/state", {
      headers: { Cookie: userCookie },
      data: { purchases: invalidPayload },
    });
    expect(invalidResponse.status()).toBe(400);
    const invalidBody = await invalidResponse.json();
    expect(invalidBody.error).toContain("đã thanh toán sau khi đã nhập kho");

    const paidPayload = structuredClone(seededState.purchases || []);
    const paidPurchase = paidPayload.find((purchase) => purchase.id === receivedPurchaseId);
    expect(paidPurchase).toBeTruthy();
    paidPurchase.status = "paid";
    paidPurchase.paidAt = new Date().toISOString();

    const payResponse = await request.put("./api/state", {
      headers: { Cookie: userCookie },
      data: { purchases: paidPayload },
    });
    const payBody = await payResponse.json();
    expect(payResponse.ok(), JSON.stringify(payBody)).toBeTruthy();
  } finally {
    await request.put("./api/state", {
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

test("ACC-PUR-04 received purchase can save document discount before paid", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const userCookie = await autoLoginUserRequest(request);
  const timestamp = Date.now();
  const supplierName = `NCC Discount ${timestamp}`;
  const purchaseId = `purchase_discount_${timestamp}`;
  const discountAmount = 5000;

  const stateResponse = await request.get("./api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const productsResponse = await request.get("./api/products", { headers: { Cookie: userCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const product = productsPayload.products?.[0];
  expect(product).toBeTruthy();

  const receivedPurchase = {
    id: purchaseId,
    supplierName,
    note: "ACC-PUR-04 received purchase",
    status: "received",
    discountAmount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    receiptCode: `PN-DISCOUNT-${timestamp}`,
    items: [
      {
        id: `purchase_item_discount_${timestamp}`,
        productId: product.id,
        productName: product.name,
        quantity: 2,
        unitCost: Number(product.price || 0) || 1000,
      },
    ],
  };

  try {
    const seedResponse = await request.put("./api/state", {
      headers: { Cookie: userCookie },
      data: {
        purchases: [...(originalState.purchases || []), receivedPurchase],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto(process.env.TEST_ADMIN_PATH || "admin");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");

    const purchaseCard = page.locator(".cart-queue-item", { hasText: supplierName }).first();
    await purchaseCard.locator('[data-purchase-list-action="open"]').click();
    await page.waitForTimeout(300);

    const discountInput = page.locator(`[data-purchase-discount-input="${purchaseId}"]`);
    await expect(discountInput).toBeVisible();
    await discountInput.fill(String(discountAmount));
    await page.locator('[data-purchase-action="save-discount"]').click();

    const saveToast = await collectToast(page, runtime, "acc-pur-04-save-discount", { errorPattern: /^$/ });
    expect(saveToast).toContain("Đã lưu giảm giá khuyến mại");
    await expect(discountInput).toHaveValue(String(discountAmount));

    const latestStateResponse = await request.get("./api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
    expect(latestStateResponse.ok()).toBeTruthy();
    const latestState = await latestStateResponse.json();
    const savedPurchase = (latestState.purchases || []).find((purchase) => purchase.id === purchaseId);
    expect(savedPurchase).toBeTruthy();
    expect(Number(savedPurchase.discountAmount || savedPurchase.discount_amount || 0)).toBe(discountAmount);
  } finally {
    await request.put("./api/state", {
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

test("ACC-PUR-03 purchase draft must be ordered before receive and stays editable while ordered", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const userCookie = await autoLoginUserRequest(request);
  const timestamp = Date.now();
  const supplierName = `NCC Draft Flow ${timestamp}`;
  const purchaseId = `purchase_draft_flow_${timestamp}`;

  const stateResponse = await request.get("./api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const productsResponse = await request.get("./api/products", { headers: { Cookie: userCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const product = productsPayload.products?.[0];
  const extraProduct = productsPayload.products?.find((entry) => Number(entry.id) !== Number(product?.id));
  expect(product).toBeTruthy();
  expect(extraProduct).toBeTruthy();
  const startingStock = Number(product.current_stock || 0);
  const extraStartingStock = Number(extraProduct.current_stock || 0);

  const draftPurchase = {
    id: purchaseId,
    supplierName,
    note: "ACC-PUR-03 draft purchase",
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    receiptCode: "",
    items: [
      {
        id: `purchase_item_draft_${timestamp}`,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitCost: Number(product.price || 0) || 1000,
      },
    ],
  };

  try {
    const seedResponse = await request.put("./api/state", {
      headers: { Cookie: userCookie },
      data: {
        purchases: [...(originalState.purchases || []), draftPurchase],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto(process.env.TEST_ADMIN_PATH || "admin");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");
    await setFloatingSearch(page, supplierName);

    const draftPurchaseCard = page.locator(".cart-queue-item", { hasText: supplierName }).first();
    await expect(draftPurchaseCard).toBeVisible();
    await draftPurchaseCard.locator('[data-purchase-list-action="open"]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-purchase-action="receive"]')).toHaveCount(0);
    await expect(page.locator('[data-purchase-action="mark-ordered"]')).toBeVisible();

    await page.locator('[data-purchase-action="mark-ordered"]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-purchase-action="receive"]')).toBeVisible();
    await expect(page.locator("#purchaseSupplierInput")).toBeDisabled();
    await expect(page.locator('.purchases-panel [data-go-menu="suppliers"]')).toBeDisabled();

    const sectionBody = page.locator(".selected-items-body");
    if (await sectionBody.isHidden().catch(() => false)) {
      await page.locator('[data-purchase-selected-action="toggle"]').click();
      await page.waitForTimeout(300);
    }
    await page.locator('[data-purchase-item-action="toggle-detail"]').first().click();
    await page.waitForTimeout(300);
    const qtyInput = page.locator('[data-purchase-qty-input]').first();
    await expect(qtyInput).toBeVisible();
    await expect(qtyInput).toBeEnabled();
    await qtyInput.fill("2");
    await page.locator('[data-purchase-item-action="save"]').first().click();
    await page.evaluate(() => {
      window.confirm = () => false;
    });
    await setFloatingSearch(page, extraProduct.name);
    await page.locator(`[data-purchase-suggestion-action="add"][data-product-id="${extraProduct.id}"]`).first().click();

    await expect.poll(async () => {
      const syncResponse = await request.get("./api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
      expect(syncResponse.ok()).toBeTruthy();
      const syncPayload = await syncResponse.json();
      const orderedPurchase = (syncPayload.purchases || []).find((entry) => entry.id === purchaseId);
      return orderedPurchase?.items?.length || 0;
    }).toBe(2);

    await page.evaluate(() => {
      window.confirm = () => true;
    });
    await page.locator('[data-purchase-action="receive"]').click();
    await expect.poll(async () => {
      const syncResponse = await request.get("./api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
      expect(syncResponse.ok()).toBeTruthy();
      const syncPayload = await syncResponse.json();
      const receivedPurchase = (syncPayload.purchases || []).find((entry) => entry.id === purchaseId);
      return String(receivedPurchase?.status || "");
    }).toBe("received");

    await switchMenu(page, "inventory");
    await expectScreenTitle(page, "Kiểm tra tồn kho");
    await setFloatingSearch(page, product.name);
    const inventoryCard = page.locator(".product-row", { has: page.locator(`[data-product-detail-trigger="${product.id}"]`) }).first();
    await expect(inventoryCard.locator(".product-row-stock").first()).toContainText(expectedQuantityText(startingStock + 2));

    await setFloatingSearch(page, extraProduct.name);
    const extraInventoryCard = page.locator(".product-row", { has: page.locator(`[data-product-detail-trigger="${extraProduct.id}"]`) }).first();
    await expect(extraInventoryCard.locator(".product-row-stock").first()).toContainText(expectedQuantityText(extraStartingStock + Number(extraProduct.low_stock_threshold || 1)));
  } finally {
    await request.put("./api/state", {
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

test("ACC-PUR-05 purchase without supplier cannot be ordered or received", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const userCookie = await autoLoginUserRequest(request);
  const timestamp = Date.now();
  const purchaseId = `purchase_no_supplier_${timestamp}`;

  const stateResponse = await request.get("./api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const productsResponse = await request.get("./api/products", { headers: { Cookie: userCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const product = productsPayload.products?.[0];
  expect(product).toBeTruthy();

  const draftPurchase = {
    id: purchaseId,
    supplierName: "",
    note: "ACC-PUR-05 draft purchase without supplier",
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    receiptCode: "",
    items: [
      {
        id: `purchase_item_no_supplier_${timestamp}`,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitCost: Number(product.price || 0) || 1000,
      },
    ],
  };

  try {
    const seedResponse = await request.put("./api/state", {
      headers: { Cookie: userCookie },
      data: {
        purchases: [...(originalState.purchases || []), draftPurchase],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();
    const seededState = await seedResponse.json();

    await page.goto(process.env.TEST_ADMIN_PATH || "admin");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");

    const draftPurchaseCard = page.locator(".cart-queue-item", { hasText: "Phiếu nhập chưa có NCC" }).first();
    await draftPurchaseCard.locator('[data-purchase-list-action="open"]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-purchase-action="mark-ordered"]')).toBeDisabled();
    await expect(page.locator("#purchasePanel")).toContainText("Cần chọn nhà cung cấp");

    const orderedPayload = structuredClone(seededState.purchases || []);
    const orderedPurchase = orderedPayload.find((purchase) => purchase.id === purchaseId);
    expect(orderedPurchase).toBeTruthy();
    orderedPurchase.status = "ordered";

    const invalidOrderedResponse = await request.put("./api/state", {
      headers: { Cookie: userCookie },
      data: { purchases: orderedPayload },
    });
    expect(invalidOrderedResponse.status()).toBe(400);
    const invalidOrderedBody = await invalidOrderedResponse.json();
    expect(invalidOrderedBody.error).toContain("nhà cung cấp trước khi chuyển sang đã đặt hàng");

    const receivedPayload = structuredClone(seededState.purchases || []);
    const receivedPurchase = receivedPayload.find((purchase) => purchase.id === purchaseId);
    expect(receivedPurchase).toBeTruthy();
    receivedPurchase.status = "received";
    receivedPurchase.receivedAt = new Date().toISOString();
    receivedPurchase.receiptCode = `PN-NO-SUP-${timestamp}`;

    const invalidReceivedResponse = await request.put("./api/state", {
      headers: { Cookie: userCookie },
      data: { purchases: receivedPayload },
    });
    expect(invalidReceivedResponse.status()).toBe(400);
    const invalidReceivedBody = await invalidReceivedResponse.json();
    expect(invalidReceivedBody.error).toContain("nhà cung cấp trước khi nhập kho");
  } finally {
    await request.put("./api/state", {
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

test("IT-PUR-01 purchase suggestions allow overriding quantity before adding to draft", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page, { autoAcceptDialogs: false });

  await page.goto(process.env.TEST_ADMIN_PATH || "admin");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });

  await switchMenu(page, "purchases");
  await expectScreenTitle(page, "Nhập hàng");

  const suggestionCard = page.locator("#purchaseSuggestionList .sales-product-row").first();
  await expect(suggestionCard).toBeVisible();
  const productName = (await suggestionCard.locator("strong").first().textContent())?.trim();
  expect(productName).toBeTruthy();
  const overriddenQuantity = "7";
  await suggestionCard.locator("[data-purchase-suggestion-qty-input]").fill(overriddenQuantity);
  page.once("dialog", async (dialog) => {
    await dialog.dismiss();
  });
  await suggestionCard.locator('[data-purchase-suggestion-action="add"]').click();

  const toastText = await collectToast(page, runtime, "it-pur-01-add-suggestion", { errorPattern: /^$/ });
  expect(toastText).toContain("Đã thêm vào phiếu nhập");
  await expect(page.locator("[data-purchase-conflict-review]")).toHaveCount(0);

  const purchaseItemCard = page.locator("#purchasePanel .cart-item, .purchases-panel .cart-item").filter({ hasText: productName }).first();
  await expect(purchaseItemCard).toBeVisible();
  const sectionBody = page.locator(".selected-items-body");
  if (await sectionBody.isHidden().catch(() => false)) {
    await page.locator('[data-purchase-selected-action="toggle"]').click();
    await page.waitForTimeout(300);
  }
  await purchaseItemCard.locator('[data-purchase-item-action="toggle-detail"]').click();
  await page.waitForTimeout(300);
  await expect(purchaseItemCard.locator("[data-purchase-qty-input]").first()).toHaveValue(overriddenQuantity);

  runtime.errors = runtime.errors.filter((entry) => !entry.includes("Failed to load resource: net::ERR_CONNECTION_RESET"));
  expectNoRuntimeErrors(runtime);
});

test("IT-STS-01 status-changing order and purchase actions show confirm dialogs before applying", async ({ page, request }) => {
  test.slow();
  const runtime = attachRuntimeTracking(page, { autoAcceptDialogs: false });
  let userCookie = await autoLoginUserRequest(request);
  const timestamp = Date.now();
  const draftCustomerName = `Khách confirm ${timestamp}`;
  const cancelDraftCustomerName = `Khách hủy confirm ${timestamp}`;
  const deleteDraftCustomerName = `Khách xóa confirm ${timestamp}`;
  const draftSupplierName = `NCC confirm ${timestamp}`;
  const cancelOrderedSupplierName = `NCC hủy confirm ${timestamp}`;
  const deleteDraftSupplierName = `NCC xóa confirm ${timestamp}`;
  const draftCartId = `cart_confirm_${timestamp}`;
  const cancelDraftCartId = `cart_cancel_confirm_${timestamp}`;
  const deleteDraftCartId = `cart_delete_confirm_${timestamp}`;
  const draftPurchaseId = `purchase_confirm_${timestamp}`;
  const cancelOrderedPurchaseId = `purchase_cancel_confirm_${timestamp}`;
  const deleteDraftPurchaseId = `purchase_delete_confirm_${timestamp}`;
  const draftCartItemId = `cart_item_confirm_${timestamp}`;
  const draftPurchaseItemId = `purchase_item_confirm_${timestamp}`;

  const stateResponse = await request.get("./api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const productsResponse = await request.get("./api/products", { headers: { Cookie: userCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const product = productsPayload.products?.find((entry) => Number(entry.current_stock || 0) >= 2) || productsPayload.products?.[0];
  expect(product).toBeTruthy();
  const startingStock = Number(product.current_stock || 0);
  const originalSalePrice = Number(product.sale_price || product.price || 0) || 1000;
  const originalUnitCost = Number(product.price || 0) || 1000;
  const updatedSalePrice = originalSalePrice + 2000;
  const updatedUnitCost = originalUnitCost + 1000;

  const draftCart = {
    id: draftCartId,
    customerName: draftCustomerName,
    status: "draft",
    paymentStatus: "unpaid",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    orderCode: "",
    items: [
      {
        id: draftCartItemId,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: originalSalePrice,
        note: "",
      },
    ],
  };
  const draftPurchase = {
    id: draftPurchaseId,
    supplierName: draftSupplierName,
    note: "IT-STS-01 draft purchase",
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    receiptCode: "",
    items: [
      {
        id: draftPurchaseItemId,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitCost: originalUnitCost,
      },
    ],
  };
  const deleteDraftCart = {
    id: deleteDraftCartId,
    customerName: deleteDraftCustomerName,
    status: "draft",
    paymentStatus: "unpaid",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    orderCode: "",
    items: [
      {
        id: `cart_item_delete_confirm_${timestamp}`,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: Number(product.sale_price || product.price || 0) || 1000,
        note: "",
      },
    ],
  };
  const cancelDraftCart = {
    id: cancelDraftCartId,
    customerName: cancelDraftCustomerName,
    status: "draft",
    paymentStatus: "unpaid",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    orderCode: "",
    items: [
      {
        id: `cart_item_cancel_confirm_${timestamp}`,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: Number(product.sale_price || product.price || 0) || 1000,
        note: "",
      },
    ],
  };
  const deleteDraftPurchase = {
    id: deleteDraftPurchaseId,
    supplierName: deleteDraftSupplierName,
    note: "IT-STS-01 delete draft purchase",
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    receiptCode: "",
    items: [
      {
        id: `purchase_item_delete_confirm_${timestamp}`,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitCost: Number(product.price || 0) || 1000,
      },
    ],
  };
  const cancelOrderedPurchase = {
    id: cancelOrderedPurchaseId,
    supplierName: cancelOrderedSupplierName,
    note: "IT-STS-01 ordered purchase cancel",
    status: "ordered",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    receiptCode: "",
    items: [
      {
        id: `purchase_item_cancel_confirm_${timestamp}`,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitCost: Number(product.price || 0) || 1000,
      },
    ],
  };

  try {
    const seedResponse = await request.put("./api/state", {
      headers: { Cookie: userCookie },
      data: {
        carts: [...(originalState.carts || []), draftCart, cancelDraftCart, deleteDraftCart],
        purchases: [...(originalState.purchases || []), draftPurchase, cancelOrderedPurchase, deleteDraftPurchase],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto(process.env.TEST_ADMIN_PATH || "admin");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "orders");
    await expectScreenTitle(page, "Đơn hàng");
    await setFloatingSearch(page, draftCustomerName);
    const draftOrderCard = page.locator(".cart-queue-item", { hasText: draftCustomerName }).first();
    await draftOrderCard.locator('[data-queue-action="open"]').click();
    await expectScreenTitle(page, "Tạo đơn xuất hàng");
    await ensureSelectedCartItemsExpanded(page, draftCartItemId);
    await page.locator(`[data-cart-item-action="toggle-detail"][data-item-id="${draftCartItemId}"]`).click();
    const salePriceInput = page.locator(`[data-price-input="${draftCartItemId}"]`);
    await expect(salePriceInput).toBeVisible();
    await salePriceInput.fill(String(updatedSalePrice));
    const saleDefaultCancelDialog = await captureDialogMessage(page, async () => {
      await page.locator(`[data-cart-item-action="update-default-price"][data-item-id="${draftCartItemId}"]`).click();
    }, { accept: false });
    expect(saleDefaultCancelDialog).toBe("Xác nhận cập nhật giá bán hiện tại thành giá bán mặc định của mặt hàng?");
    let latestProductsResponse = await request.get("./api/products", { headers: { Cookie: userCookie } });
    expect(latestProductsResponse.ok()).toBeTruthy();
    let latestProductsPayload = await latestProductsResponse.json();
    expect(Number(latestProductsPayload.products?.find((entry) => Number(entry.id) === Number(product.id))?.sale_price || 0)).toBe(originalSalePrice);

    const saleDefaultConfirmDialog = await captureDialogMessage(page, async () => {
      await page.locator(`[data-cart-item-action="update-default-price"][data-item-id="${draftCartItemId}"]`).click();
    });
    expect(saleDefaultConfirmDialog).toBe("Xác nhận cập nhật giá bán hiện tại thành giá bán mặc định của mặt hàng?");
    const salePriceToast = await collectToast(page, runtime, "it-sts-01-sale-default-price", { errorPattern: /^$/ });
    expect(salePriceToast).toContain("Đã cập nhật giá bán");
    latestProductsResponse = await request.get("./api/products", { headers: { Cookie: userCookie } });
    expect(latestProductsResponse.ok()).toBeTruthy();
    latestProductsPayload = await latestProductsResponse.json();
    expect(Number(latestProductsPayload.products?.find((entry) => Number(entry.id) === Number(product.id))?.sale_price || 0)).toBe(updatedSalePrice);
    if (!await page.locator('[data-cart-action="commit"]').isVisible().catch(() => false)) {
      await page.locator('[data-cart-action="toggle-panel"]').click();
      await expect(page.locator('[data-cart-action="commit"]')).toBeVisible();
    }

    const commitDialog = await captureDialogMessage(page, async () => {
      await page.locator('[data-cart-action="commit"]').click();
    });
    expect(commitDialog).toContain("Chốt đơn");
    const commitToast = await collectToast(page, runtime, "it-sts-01-commit", { errorPattern: /^$/ });
    expect(commitToast).toContain("Đã chốt đơn");

    const shipDialog = await captureDialogMessage(page, async () => {
      await page.locator('[data-cart-action="ship"]').click();
    });
    expect(shipDialog).toContain("Đã xuất hàng");
    const shipToast = await collectToast(page, runtime, "it-sts-01-ship", { errorPattern: /^$/ });
    expect(shipToast).toContain("Đã xuất hàng");

    await switchMenu(page, "inventory");
    await expectScreenTitle(page, "Kiểm tra tồn kho");
    await setFloatingSearch(page, product.name);
    const inventoryCardAfterCheckout = page.locator(".product-row", { has: page.locator(`[data-product-detail-trigger="${product.id}"]`) }).first();
    await expect(inventoryCardAfterCheckout.locator(".product-row-stock").first()).toContainText(expectedQuantityText(startingStock - 1));

    userCookie = await autoLoginUserRequest(request);
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "orders");
    await expectScreenTitle(page, "Đơn hàng");
    await page.locator("#showArchivedCarts").check();
    await page.waitForTimeout(300);
    await setFloatingSearch(page, draftCustomerName);
    const completedOrderCard = page.locator(".cart-queue-item", { hasText: draftCustomerName }).first();
    await completedOrderCard.locator('[data-queue-action="toggle-detail"]').click();
    const markPaidDialog = await captureDialogMessage(page, async () => {
      await completedOrderCard.locator('[data-queue-action="mark-paid"]').click();
    });
    expect(markPaidDialog).toContain("đã thanh toán");
    const orderPaidToast = await collectToast(page, runtime, "it-sts-01-order-paid", { errorPattern: /^$/ });
    expect(orderPaidToast).toMatch(/Đã cập nhật.*thanh toán/i);
    await page.waitForTimeout(700);

    const paidOrderStateResponse = await request.get("./api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
    expect(paidOrderStateResponse.ok()).toBeTruthy();
    const paidOrderState = await paidOrderStateResponse.json();
    expect((paidOrderState.carts || []).some((cart) => cart.id === draftCartId && cart.paymentStatus === "paid")).toBeTruthy();

    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");
    await setFloatingSearch(page, draftSupplierName);
    const draftPurchaseCard = page.locator(".cart-queue-item", { hasText: draftSupplierName }).first();
    await draftPurchaseCard.locator('[data-purchase-list-action="open"]').click();
    await ensureSelectedPurchaseItemsExpanded(page, draftPurchaseItemId);
    const purchaseCostInput = page.locator(`[data-purchase-cost-input="${draftPurchaseItemId}"]`);
    await expect(purchaseCostInput).toBeVisible();
    await purchaseCostInput.fill(String(updatedUnitCost));

    const purchaseDefaultCancelDialog = await captureDialogMessage(page, async () => {
      await page.locator(`[data-purchase-item-action="update-default-cost"][data-purchase-item-id="${draftPurchaseItemId}"]`).click();
    }, { accept: false });
    expect(purchaseDefaultCancelDialog).toBe("Xác nhận cập nhật giá nhập hiện tại thành giá nhập mặc định của mặt hàng?");
    latestProductsResponse = await request.get("./api/products", { headers: { Cookie: userCookie } });
    expect(latestProductsResponse.ok()).toBeTruthy();
    latestProductsPayload = await latestProductsResponse.json();
    expect(Number(latestProductsPayload.products?.find((entry) => Number(entry.id) === Number(product.id))?.price || 0)).toBe(originalUnitCost);

    const purchaseDefaultConfirmDialog = await captureDialogMessage(page, async () => {
      await page.locator(`[data-purchase-item-action="update-default-cost"][data-purchase-item-id="${draftPurchaseItemId}"]`).click();
    });
    expect(purchaseDefaultConfirmDialog).toBe("Xác nhận cập nhật giá nhập hiện tại thành giá nhập mặc định của mặt hàng?");
    const purchasePriceToast = await collectToast(page, runtime, "it-sts-01-purchase-default-price", { errorPattern: /^$/ });
    expect(purchasePriceToast).toContain("Đã cập nhật giá nhập");
    latestProductsResponse = await request.get("./api/products", { headers: { Cookie: userCookie } });
    expect(latestProductsResponse.ok()).toBeTruthy();
    latestProductsPayload = await latestProductsResponse.json();
    expect(Number(latestProductsPayload.products?.find((entry) => Number(entry.id) === Number(product.id))?.price || 0)).toBe(updatedUnitCost);

    const markOrderedDialog = await captureDialogMessage(page, async () => {
      await page.locator('[data-purchase-action="mark-ordered"]').click();
    });
    expect(markOrderedDialog).toContain("Đã đặt hàng");
    const orderedToast = await collectToast(page, runtime, "it-sts-01-ordered", { errorPattern: /^$/ });
    expect(orderedToast).toContain("Đã cập nhật trạng thái đặt hàng");

    const receiveDialog = await captureDialogMessage(page, async () => {
      await page.locator('[data-purchase-action="receive"]').click();
    });
    expect(receiveDialog).toContain("Đã nhập kho");
    const receiveToast = await collectToast(page, runtime, "it-sts-01-receive", { errorPattern: /^$/ });
    expect(receiveToast).toContain("Đã nhập hàng vào kho");

    await setFloatingSearch(page, draftSupplierName);
    const receivedPurchaseCard = page.locator(".cart-queue-item", { hasText: draftSupplierName }).first();
    await receivedPurchaseCard.locator('[data-purchase-list-action="open"]').click();

    const markPurchasePaidDialog = await captureDialogMessage(page, async () => {
      await page.locator('[data-purchase-action="mark-paid"]').click();
    });
    expect(markPurchasePaidDialog).toContain("đã thanh toán");
    const purchasePaidToast = await collectToast(page, runtime, "it-sts-01-paid", { errorPattern: /^$/ });
    expect(purchasePaidToast).toMatch(/Đã cập nhật.*thanh toán/i);

    const paidPurchaseStateResponse = await request.get("./api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
    expect(paidPurchaseStateResponse.ok()).toBeTruthy();
    const paidPurchaseState = await paidPurchaseStateResponse.json();
    expect((paidPurchaseState.purchases || []).some((purchase) => purchase.id === draftPurchaseId && purchase.status === "paid")).toBeTruthy();

    await switchMenu(page, "orders");
    await expectScreenTitle(page, "Đơn hàng");
    await setFloatingSearch(page, cancelDraftCustomerName);
    const cancelDraftOrderCard = page.locator(".cart-queue-item", { hasText: cancelDraftCustomerName }).first();
    await cancelDraftOrderCard.locator('[data-queue-action="toggle-detail"]').click();
    const cancelCartDialog = await captureDialogMessage(page, async () => {
      await cancelDraftOrderCard.locator('[data-queue-action="cancel"]').click();
    });
    expect(cancelCartDialog).toContain("Hủy");
    await page.waitForTimeout(700);

    const cancelledCartStateResponse = await request.get("./api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
    expect(cancelledCartStateResponse.ok()).toBeTruthy();
    const cancelledCartState = await cancelledCartStateResponse.json();
    expect((cancelledCartState.carts || []).some((cart) => cart.id === cancelDraftCartId && cart.status === "cancelled")).toBeTruthy();

    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");
    await setFloatingSearch(page, cancelOrderedSupplierName);
    const cancelOrderedPurchaseCard = page.locator(".cart-queue-item", { hasText: cancelOrderedSupplierName }).first();
    await cancelOrderedPurchaseCard.locator('[data-purchase-list-action="open"]').click();

    const cancelPurchaseDialog = await captureDialogMessage(page, async () => {
      await page.locator('[data-purchase-action="cancel"]').click();
    });
    expect(cancelPurchaseDialog).toContain("Hủy");
    const cancelPurchaseToast = await collectToast(page, runtime, "it-sts-01-cancel-purchase", { errorPattern: /^$/ });
    expect(cancelPurchaseToast).toContain("Đã hủy");

    const cancelledPurchaseStateResponse = await request.get("./api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
    expect(cancelledPurchaseStateResponse.ok()).toBeTruthy();
    const cancelledPurchaseState = await cancelledPurchaseStateResponse.json();
    expect((cancelledPurchaseState.purchases || []).some((purchase) => purchase.id === cancelOrderedPurchaseId && purchase.status === "cancelled")).toBeTruthy();

    await switchMenu(page, "orders");
    await expectScreenTitle(page, "Đơn hàng");
    await setFloatingSearch(page, deleteDraftCustomerName);
    const deleteDraftOrderCard = page.locator(".cart-queue-item", { hasText: deleteDraftCustomerName }).first();
    await deleteDraftOrderCard.locator('[data-queue-action="toggle-detail"]').click();
    const deleteCartDialog = await captureDialogMessage(page, async () => {
      await deleteDraftOrderCard.locator('[data-queue-action="delete"]').click();
    });
    expect(deleteCartDialog).toContain("Xóa");
    await page.waitForTimeout(700);

    const deletedCartStateResponse = await request.get("./api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
    expect(deletedCartStateResponse.ok()).toBeTruthy();
    const deletedCartState = await deletedCartStateResponse.json();
    expect((deletedCartState.carts || []).some((cart) => cart.id === deleteDraftCartId)).toBeFalsy();

    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");
    await setFloatingSearch(page, deleteDraftSupplierName);
    const deleteDraftPurchaseCard = page.locator(".cart-queue-item", { hasText: deleteDraftSupplierName }).first();
    await deleteDraftPurchaseCard.locator('[data-purchase-list-action="open"]').click();

    const deletePurchaseDialog = await captureDialogMessage(page, async () => {
      await page.locator('[data-purchase-action="delete"]').click();
    });
    expect(deletePurchaseDialog).toContain("Xóa");
    const deletePurchaseToast = await collectToast(page, runtime, "it-sts-01-delete-purchase", { errorPattern: /^$/ });
    expect(deletePurchaseToast).toContain("Đã xóa");

    const deletedPurchaseStateResponse = await request.get("./api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
    expect(deletedPurchaseStateResponse.ok()).toBeTruthy();
    const deletedPurchaseState = await deletedPurchaseStateResponse.json();
    expect((deletedPurchaseState.purchases || []).some((purchase) => purchase.id === deleteDraftPurchaseId)).toBeFalsy();
  } finally {
    await request.put(`./api/products/${product.id}/sale-price`, {
      headers: { Cookie: userCookie },
      data: {
        sale_price: originalSalePrice,
      },
    });
    await request.put(`./api/products/${product.id}/price`, {
      headers: { Cookie: userCookie },
      data: {
        price: originalUnitCost,
      },
    });
    await request.put("./api/state", {
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

test("ACC-PUR-02 completed orders and received or paid purchases reject direct edits", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const userCookie = await autoLoginUserRequest(request);
  const timestamp = Date.now();
  const completedCartId = `cart_completed_test_${timestamp}`;
  const paidPurchaseId = `purchase_paid_test_${timestamp}`;
  const completedCustomerName = `Khách completed ${timestamp}`;
  const draftCustomerName = `Khách draft ${timestamp}`;
  const paidSupplierName = `NCC paid ${timestamp}`;

  const stateResponse = await request.get("./api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const productsResponse = await request.get("./api/products", { headers: { Cookie: userCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const product = productsPayload.products?.[0];
  expect(product).toBeTruthy();

  const completedCart = {
    id: completedCartId,
    customerName: completedCustomerName,
    status: "completed",
    paymentStatus: "unpaid",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    orderCode: `DH-COMP-${timestamp}`,
    items: [
      {
        id: `cart_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: Number(product.sale_price || product.price || 0) || 1000,
        note: "",
      },
    ],
  };
  const draftCart = {
    id: `cart_draft_test_${timestamp}`,
    customerName: draftCustomerName,
    status: "draft",
    paymentStatus: "unpaid",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    orderCode: "",
    items: [],
  };
  const paidPurchase = {
    id: paidPurchaseId,
    supplierName: paidSupplierName,
    note: "ACC-PUR-02 paid purchase",
    status: "paid",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    paidAt: new Date().toISOString(),
    receiptCode: `PN-PAID-${timestamp}`,
    items: [
      {
        id: `purchase_item_paid_${timestamp}`,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitCost: Number(product.price || 0) || 1000,
      },
    ],
  };

  try {
    const seedResponse = await request.put("./api/state", {
      headers: { Cookie: userCookie },
      data: {
        carts: [...(originalState.carts || []), completedCart, draftCart],
        purchases: [...(originalState.purchases || []), paidPurchase],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();
    const seededState = await seedResponse.json();

    await page.goto(process.env.TEST_ADMIN_PATH || "admin");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "orders");
    await expectScreenTitle(page, "Đơn hàng");
    await page.locator("#showArchivedCarts").check();
    await page.waitForTimeout(300);
    await setFloatingSearch(page, completedCustomerName);
    await expect(page.locator('#cartQueueList .cart-queue-item[data-order-select]', { hasText: completedCustomerName }).first()).toBeVisible();

    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");
    await page.locator("#showPaidPurchases").check();
    await page.waitForTimeout(300);
    await setFloatingSearch(page, paidSupplierName);
    await expect(page.locator(".cart-queue-item", { hasText: paidSupplierName })).toBeVisible();

    const invalidCartPayload = structuredClone(seededState.carts || []);
    const lockedCart = invalidCartPayload.find((cart) => cart.id === completedCartId);
    expect(lockedCart).toBeTruthy();
    lockedCart.items[0].quantity = 9;

    const invalidCartResponse = await request.put("./api/state", {
      headers: { Cookie: userCookie },
      data: { carts: invalidCartPayload },
    });
    expect(invalidCartResponse.status()).toBe(400);
    const invalidCartBody = await invalidCartResponse.json();
    expect(invalidCartBody.error).toContain("Đơn hàng đã xuất hàng không thể sửa trực tiếp");

    const invalidPurchasePayload = structuredClone(seededState.purchases || []);
    const lockedPurchase = invalidPurchasePayload.find((purchase) => purchase.id === paidPurchaseId);
    expect(lockedPurchase).toBeTruthy();
    lockedPurchase.items[0].unitCost = 99000;

    const invalidPurchaseResponse = await request.put("./api/state", {
      headers: { Cookie: userCookie },
      data: { purchases: invalidPurchasePayload },
    });
    expect(invalidPurchaseResponse.status()).toBe(400);
    const invalidPurchaseBody = await invalidPurchaseResponse.json();
    expect(invalidPurchaseBody.error).toContain("Phiếu nhập đã thanh toán không thể sửa trực tiếp");
  } finally {
    await request.put("./api/state", {
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

test("ACC-ADM-03 direct stock adjustment requires privileged login and a reason", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);

  const anonymousResponse = await request.post("./api/transactions", {
    data: {
      product_id: 1,
      transaction_type: "in",
      quantity: 1,
      adjustment_reason: "anonymous",
    },
  });
  expect(anonymousResponse.status()).toBe(401);

  await gotoWithRetry(page, "/admin", { waitUntil: "networkidle" });
  await autoLoginProcurementManager(page, request);
  await page.reload({ waitUntil: "networkidle" });

  await switchMenu(page, "inventory");
  await expectScreenTitle(page, "Kiểm tra tồn kho");
  await collectToast(page, runtime, "inventory-manager-login-auto", { errorPattern: /^$/ });
  const adminToggle = page.locator('[data-product-action="toggle-expand"]').first();
  const productId = await adminToggle.getAttribute("data-product-id");
  await adminToggle.click();
  await page.waitForTimeout(300);

  const expandedRow = page.locator(".product-row-body").first();
  await expect(page.locator('[data-product-action="start-price-edit"]')).toHaveCount(0);
  await expandedRow.locator('[data-delta="1"]').click();
  const missingReasonToast = await collectToast(page, runtime, "inventory-adjust-missing-reason", {
    errorPattern: /^$/,
  });
  expect(missingReasonToast).toContain("lý do");

  const reason = "Kiểm kê lệch cuối ngày";
  await expandedRow.locator("[data-adjust-reason-input]").fill(reason);
  await expandedRow.locator('[data-delta="1"]').click();
  await collectToast(page, runtime, "inventory-adjust-success");

  const transactionPayload = await page.evaluate(async () => {
    const response = await fetch("./api/transactions?limit=5");
    return response.json();
  });
  expect(transactionPayload.transactions[0].note).toContain(`Lý do: ${reason}`);

  await page.evaluate(async ({ targetProductId }) => {
    await fetch("./api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: Number(targetProductId),
        transaction_type: "out",
        quantity: 1,
        adjustment_reason: "Hoàn nguyên sau test",
      }),
    });
  }, { targetProductId: Number(productId) });

  expectNoRuntimeErrors(runtime);
});



