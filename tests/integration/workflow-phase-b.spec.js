const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginAdmin,
  autoLoginAdminRequest,
  autoLoginUser,
  autoLoginUserRequest,
  collectToast,
  expectNoRuntimeErrors,
  gotoWithRetry,
  switchMenu,
} = require("./support/ui");

test.describe.configure({ timeout: 120000 });

async function createBackupSnapshot(request) {
  const adminCookie = await autoLoginAdminRequest(request);
  const response = await request.get("/api/admin/backup", {
    headers: { Cookie: adminCookie },
  });
  expect(response.ok()).toBeTruthy();
  return response.body();
}

async function restoreBackupSnapshot(request, snapshot) {
  const adminCookie = await autoLoginAdminRequest(request);
  const response = await request.post("/api/admin/restore", {
    headers: { Cookie: adminCookie },
    data: {
      content_base64: snapshot.toString("base64"),
    },
  });
  expect(response.ok()).toBeTruthy();
}

async function fetchProducts(request, cookie) {
  const response = await request.get("/api/products", {
    headers: { Cookie: cookie },
  });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  return payload.products || [];
}

async function fetchTransactions(request, cookie, limit = 12) {
  const response = await request.get(`/api/transactions?limit=${limit}`, {
    headers: { Cookie: cookie },
  });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  return payload.transactions || [];
}

async function fetchSyncState(request, cookie) {
  const response = await request.get("/api/state?transaction_limit=16", {
    headers: { Cookie: cookie },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function saveSyncState(request, cookie, payload) {
  const response = await request.put("/api/state", {
    headers: { Cookie: cookie },
    data: payload,
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

function getProduct(products, predicate, message) {
  const product = products.find(predicate);
  expect(product, message).toBeTruthy();
  return product;
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

async function openHomeWithLogin(page, request, loginFn) {
  await gotoWithRetry(page, "/", { waitUntil: "networkidle" });
  await loginFn(page, request);
  await page.reload({ waitUntil: "networkidle" });
}

test("IT-PHB-01 inventory adjustment receipt UI creates stock adjustment from inventory screen", async ({ page, request }) => {
  const snapshot = await createBackupSnapshot(request);
  const runtime = attachRuntimeTracking(page);

  try {
    const adminCookie = await autoLoginAdminRequest(request);
    const beforeProducts = await fetchProducts(request, adminCookie);
    const product = getProduct(
      beforeProducts,
      (entry) => Number(entry.current_stock) >= 2,
      "Không tìm thấy sản phẩm đủ tồn kho để test phiếu điều chỉnh tồn trên UI."
    );

    await openHomeWithLogin(page, request, autoLoginAdmin);
    await switchMenu(page, "inventory");
    await page.locator("#inventoryReceiptToggleButton").click();
    await expect(page.locator("#inventoryReceiptWrap")).toBeVisible();
    await page.locator("#inventoryReceiptProductInput").fill(product.name);
    await page.locator("#inventoryReceiptDeltaInput").fill("1");
    await page.locator("#inventoryReceiptReasonInput").fill("IT-PHB-01 kiểm kho lệch");
    await page.locator("#inventoryReceiptNoteInput").fill("UI phase B");
    await page.locator("#inventoryReceiptAddButton").click();
    await page.locator("#inventoryReceiptSubmitButton").click();

    const toastText = await collectToast(page, runtime, "it-phb-01", { errorPattern: /^$/ });
    expect(toastText).toContain("Đã tạo phiếu điều chỉnh tồn");

    const afterProducts = await fetchProducts(request, adminCookie);
    const updatedProduct = getProduct(afterProducts, (entry) => entry.id === product.id, "Không tìm thấy sản phẩm sau khi tạo phiếu điều chỉnh.");
    expect(Number(updatedProduct.current_stock)).toBe(Number(product.current_stock) + 1);

    const transactions = await fetchTransactions(request, adminCookie, 4);
    expect(transactions[0].note).toContain("IT-PHB-01 kiểm kho lệch");
  } finally {
    await restoreBackupSnapshot(request, snapshot);
  }

  expectNoRuntimeErrors(runtime);
});

test("IT-PHB-02 customer return receipt UI creates from completed order", async ({ page, request }) => {
  const snapshot = await createBackupSnapshot(request);
  const runtime = attachRuntimeTracking(page);

  try {
    const adminCookie = await autoLoginAdminRequest(request);
    const userCookie = await autoLoginUserRequest(request);
    const beforeProducts = await fetchProducts(request, adminCookie);
    const product = getProduct(
      beforeProducts,
      (entry) => Number(entry.current_stock) >= 2,
      "Không tìm thấy sản phẩm đủ tồn kho để test trả hàng khách từ đơn cũ."
    );
    const customerName = `IT PHB Customer ${Date.now()}`;
    const checkoutResponse = await request.post("/api/orders/checkout", {
      headers: { Cookie: userCookie },
      data: {
        customer_name: customerName,
        note: "Đơn gốc cho IT-PHB-02",
        items: [
          {
            product_id: product.id,
            quantity: 2,
            unit_price: Number(product.sale_price || product.price || 0) || 1000,
          },
        ],
      },
    });
    expect(checkoutResponse.status()).toBe(201);
    const checkoutPayload = await checkoutResponse.json();
    const orderCode = checkoutPayload.order?.orderCode || checkoutPayload.order?.order_code || `DH-IT-PHB-02-${Date.now()}`;
    const cartId = `cart_it_phb_02_${Date.now()}`;
    const syncState = await fetchSyncState(request, userCookie);
    await saveSyncState(request, userCookie, {
      carts: [
        {
          id: cartId,
          customerId: "",
          customerName,
          status: "completed",
          paymentStatus: "unpaid",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          orderCode,
          items: [
            {
              id: `cart_item_${Date.now()}`,
              productId: product.id,
              productName: product.name,
              quantity: 2,
              unitPrice: Number(product.sale_price || product.price || 0) || 1000,
              note: "",
            },
          ],
        },
        ...(syncState.carts || []),
      ],
      expected_updated_at: {
        carts: syncState.updated_at?.carts,
      },
    });

    await openHomeWithLogin(page, request, autoLoginAdmin);
    await switchMenu(page, "orders");
    await page.locator("#showArchivedCarts").check();
    await setFloatingSearch(page, customerName);
    const orderCard = page.locator(".cart-queue-item").filter({ hasText: customerName }).first();
    await expect(orderCard).toBeVisible();
    const detailButton = orderCard.locator('[data-queue-action="toggle-detail"]');
    if (await detailButton.count()) {
      await detailButton.click();
    }
    const returnButton = orderCard.locator('[data-queue-action="customer-return"], [data-cart-list-action="customer-return"]');
    await returnButton.first().click();
    await expect(page.locator("#customerReturnWrap")).toBeVisible();
    await expect(page.locator("#customerReturnCustomerInput")).toHaveValue(customerName);
    await expect(page.locator("#customerReturnNoteInput")).toHaveValue(new RegExp(orderCode));
    await page.locator('[data-customer-return-qty]').first().fill("1");
    await page.locator("#customerReturnSubmitButton").click();

    const toastText = await collectToast(page, runtime, "it-phb-02", { errorPattern: /^$/ });
    expect(toastText).toContain("Đã tạo phiếu trả hàng khách");

    const afterProducts = await fetchProducts(request, adminCookie);
    const updatedProduct = getProduct(afterProducts, (entry) => entry.id === product.id, "Không tìm thấy sản phẩm sau khi tạo phiếu trả khách.");
    expect(Number(updatedProduct.current_stock)).toBe(Number(product.current_stock) - 1);

    const transactions = await fetchTransactions(request, adminCookie, 4);
    expect(transactions[0].note).toContain(orderCode);
  } finally {
    await restoreBackupSnapshot(request, snapshot);
  }

  expectNoRuntimeErrors(runtime);
});

test("IT-PHB-03 customer return receipt UI also supports independent manual entry", async ({ page, request }) => {
  const snapshot = await createBackupSnapshot(request);
  const runtime = attachRuntimeTracking(page);

  try {
    const adminCookie = await autoLoginAdminRequest(request);
    const beforeProducts = await fetchProducts(request, adminCookie);
    const product = getProduct(beforeProducts, () => true, "Không tìm thấy sản phẩm để test phiếu trả khách độc lập.");

    await openHomeWithLogin(page, request, autoLoginUser);
    await switchMenu(page, "orders");
    await page.locator("#customerReturnToggleButton").click();
    await expect(page.locator("#customerReturnWrap")).toBeVisible();
    await page.locator("#customerReturnCustomerInput").fill("Khách lẻ IT-PHB-03");
    await page.locator("#customerReturnNoteInput").fill("Lập phiếu độc lập");
    await page.locator("#customerReturnProductInput").fill(product.name);
    await page.locator("#customerReturnQuantityInput").fill("1");
    await page.locator("#customerReturnPriceInput").fill("55000");
    await page.locator("#customerReturnAddButton").click();
    await page.locator("#customerReturnSubmitButton").click();

    const toastText = await collectToast(page, runtime, "it-phb-03", { errorPattern: /^$/ });
    expect(toastText).toContain("Đã tạo phiếu trả hàng khách");

    const afterProducts = await fetchProducts(request, adminCookie);
    const updatedProduct = getProduct(afterProducts, (entry) => entry.id === product.id, "Không tìm thấy sản phẩm sau phiếu trả khách độc lập.");
    expect(Number(updatedProduct.current_stock)).toBe(Number(product.current_stock) + 1);
  } finally {
    await restoreBackupSnapshot(request, snapshot);
  }

  expectNoRuntimeErrors(runtime);
});

test("IT-PHB-04 supplier return receipt UI creates from received purchase", async ({ page, request }) => {
  const snapshot = await createBackupSnapshot(request);
  const runtime = attachRuntimeTracking(page);

  try {
    const userCookie = await autoLoginUserRequest(request);
    const adminCookie = await autoLoginAdminRequest(request);
    const beforeProducts = await fetchProducts(request, adminCookie);
    const product = getProduct(
      beforeProducts,
      () => true,
      "Không tìm thấy sản phẩm để test trả NCC từ phiếu đã nhập."
    );
    const supplierName = `IT PHB Supplier ${Date.now()}`;
    const syncState = await fetchSyncState(request, userCookie);
    const purchaseId = `purchase_it_phb_${Date.now()}`;

    await saveSyncState(request, userCookie, {
      purchases: [
        {
          id: purchaseId,
          supplierId: "",
          supplierName,
          note: "Phiếu gốc IT-PHB-04",
          status: "draft",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          receiptCode: "",
          items: [
            {
              id: `purchase_item_${Date.now()}`,
              productId: product.id,
              productName: product.name,
              quantity: 2,
              unitCost: Number(product.price || 0) || 12000,
            },
          ],
        },
        ...(syncState.purchases || []),
      ],
      expected_updated_at: {
        purchases: syncState.updated_at?.purchases,
      },
    });

    await openHomeWithLogin(page, request, autoLoginUser);
    await switchMenu(page, "purchases");
    if (await page.locator("#togglePurchasePanelButton").isVisible()) {
      const toggleLabel = await page.locator("#togglePurchasePanelButton").textContent();
      if ((toggleLabel || "").includes("Mở phiếu")) {
        await page.locator("#togglePurchasePanelButton").click();
      }
    }
    await expect(page.locator('[data-purchase-action="mark-ordered"]')).toBeVisible();
    await expect(page.locator('[data-purchase-action="receive"]')).toHaveCount(0);
    await page.locator('[data-purchase-action="mark-ordered"]').click();
    await expect(page.locator('[data-purchase-action="receive"]')).toBeVisible();
    await page.locator('[data-purchase-action="receive"]').click();
    const receiveToast = await collectToast(page, runtime, "it-phb-04-receive", { errorPattern: /^$/ });
    expect(receiveToast).toContain("Đã nhập hàng vào kho");
    const purchaseCard = page.locator(".cart-queue-item").filter({ hasText: supplierName }).first();
    await expect(purchaseCard).toBeVisible();
    await purchaseCard.locator('[data-purchase-list-action="open"]').click();
    await page.locator('[data-purchase-action="supplier-return"]').click();
    await expect(page.locator("#supplierReturnWrap")).toBeVisible();
    await expect(page.locator("#supplierReturnSupplierInput")).toHaveValue(supplierName);
    await page.locator('[data-supplier-return-qty]').first().fill("1");
    await page.locator("#supplierReturnSubmitButton").click();

    const returnToast = await collectToast(page, runtime, "it-phb-04-return", { errorPattern: /^$/ });
    expect(returnToast).toContain("Đã tạo phiếu trả nhà cung cấp");

    const afterProducts = await fetchProducts(request, adminCookie);
    const updatedProduct = getProduct(afterProducts, (entry) => entry.id === product.id, "Không tìm thấy sản phẩm sau trả NCC từ phiếu cũ.");
    expect(Number(updatedProduct.current_stock)).toBe(Number(product.current_stock) + 1);

    const transactions = await fetchTransactions(request, adminCookie, 6);
    expect(transactions[0].note).toContain("Phiếu nguồn PN-");
  } finally {
    await restoreBackupSnapshot(request, snapshot);
  }

  expectNoRuntimeErrors(runtime);
});

test("IT-PHB-05 supplier return receipt UI also supports independent manual entry", async ({ page, request }) => {
  const snapshot = await createBackupSnapshot(request);
  const runtime = attachRuntimeTracking(page);

  try {
    const adminCookie = await autoLoginAdminRequest(request);
    const beforeProducts = await fetchProducts(request, adminCookie);
    const product = getProduct(
      beforeProducts,
      (entry) => Number(entry.current_stock) >= 1,
      "Không tìm thấy sản phẩm đủ tồn kho để test phiếu trả NCC độc lập."
    );

    await openHomeWithLogin(page, request, autoLoginUser);
    await switchMenu(page, "purchases");
    await page.locator("#supplierReturnToggleButton").click();
    await expect(page.locator("#supplierReturnWrap")).toBeVisible();
    await page.locator("#supplierReturnSupplierInput").fill("NCC lẻ IT-PHB-05");
    await page.locator("#supplierReturnNoteInput").fill("Lập phiếu trả độc lập");
    await page.locator("#supplierReturnProductInput").fill(product.name);
    await page.locator("#supplierReturnQuantityInput").fill("1");
    await page.locator("#supplierReturnPriceInput").fill("12000");
    await page.locator("#supplierReturnAddButton").click();
    await page.locator("#supplierReturnSubmitButton").click();

    const toastText = await collectToast(page, runtime, "it-phb-05", { errorPattern: /^$/ });
    expect(toastText).toContain("Đã tạo phiếu trả nhà cung cấp");

    const afterProducts = await fetchProducts(request, adminCookie);
    const updatedProduct = getProduct(afterProducts, (entry) => entry.id === product.id, "Không tìm thấy sản phẩm sau phiếu trả NCC độc lập.");
    expect(Number(updatedProduct.current_stock)).toBe(Number(product.current_stock) - 1);
  } finally {
    await restoreBackupSnapshot(request, snapshot);
  }

  expectNoRuntimeErrors(runtime);
});
