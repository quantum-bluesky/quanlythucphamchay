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

const ADMIN_CREDENTIALS = {
  username: "masteradmin",
  password: "admin12345",
};

test.describe.configure({ timeout: 120000 });

async function loginAdminApi(request) {
  const response = await request.post("/api/admin/login", {
    data: ADMIN_CREDENTIALS,
  });
  expect(response.ok()).toBeTruthy();
  return response.headers()["set-cookie"]?.split(";")[0] || "";
}

async function createBackupSnapshot(request) {
  const adminCookie = await loginAdminApi(request);
  const response = await request.get("/api/admin/backup", {
    headers: { Cookie: adminCookie },
  });
  expect(response.ok()).toBeTruthy();
  return response.body();
}

async function restoreBackupSnapshot(request, snapshot) {
  const adminCookie = await loginAdminApi(request);
  const response = await request.post("/api/admin/restore", {
    headers: { Cookie: adminCookie },
    data: {
      content_base64: snapshot.toString("base64"),
    },
  });
  expect(response.ok()).toBeTruthy();
}

async function fetchProducts(request, cookie) {
  const response = await request.get("/api/products", { headers: { Cookie: cookie } });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  return payload.products || [];
}

async function fetchTransactions(request, cookie, limit = 10) {
  const response = await request.get(`/api/transactions?limit=${limit}`, { headers: { Cookie: cookie } });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  return payload.transactions || [];
}

async function fetchMonthlyReport(request, cookie, focusMonth) {
  const response = await request.get(`/api/reports/monthly?months=3&focus_month=${focusMonth}`, {
    headers: { Cookie: cookie },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function fetchReceiptHistory(request, cookie, startDateTime, endDateTime) {
  const params = new URLSearchParams({
    limit: "20",
    start_date: startDateTime,
    end_date: endDateTime,
  });
  const response = await request.get(`/api/receipts/history?${params.toString()}`, {
    headers: { Cookie: cookie },
  });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  return payload.history || [];
}

async function fetchSyncState(request, cookie) {
  const response = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: cookie } });
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

async function seedDraftCartForCustomer(request, cookie, customerName, items = []) {
  const state = await fetchSyncState(request, cookie);
  const timestamp = Date.now();
  const customer = {
    id: `customer_sale_${timestamp}`,
    name: customerName,
    phone: "",
    address: "",
    zaloUrl: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const cart = {
    id: `cart_sale_${timestamp}`,
    customerId: customer.id,
    customerName,
    status: "draft",
    paymentStatus: "unpaid",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items,
  };
  const response = await request.put("/api/state", {
    headers: { Cookie: cookie },
    data: {
      customers: [...(state.customers || []), customer],
      carts: [cart, ...(state.carts || [])],
    },
  });
  expect(response.ok()).toBeTruthy();
  return cart;
}

async function openDraftCartFromOrders(page, customerName, cartId) {
  await switchMenu(page, "orders");
  await expectScreenTitle(page, "Đơn hàng");
  await setFloatingSearch(page, customerName);
  await page.evaluate((targetCartId) => {
    const button = document.querySelector(`[data-queue-action="open"][data-cart-id="${targetCartId}"]`);
    if (!(button instanceof HTMLElement)) {
      throw new Error("Không tìm thấy nút mở giỏ hàng từ màn Đơn hàng.");
    }
    button.click();
  }, cartId);
}

async function ensureActiveCartPanelOpen(page) {
  const checkoutButton = page.locator('#activeCartPanel [data-cart-action="checkout"]');
  if (!await checkoutButton.isVisible()) {
    await page.locator('#activeCartPanel [data-cart-action="toggle-panel"]').click();
    await expect(checkoutButton).toBeVisible();
  }
}

async function interceptConfirm(page, nextResult = true) {
  await page.evaluate((result) => {
    window.__testConfirmMessages = [];
    window.confirm = (message) => {
      window.__testConfirmMessages.push(String(message || ""));
      return Boolean(result);
    };
  }, nextResult);
}

async function readInterceptedConfirmMessages(page) {
  return page.evaluate(() => Array.isArray(window.__testConfirmMessages) ? window.__testConfirmMessages.slice() : []);
}

function filterOrderOpenSyncNoise(runtime) {
  runtime.errors = runtime.errors.filter((entry) => {
    if (entry.includes("status of 400 (Bad Request)")) {
      return false;
    }
    if (entry.includes("Đơn hàng đã chốt không thể sửa trực tiếp")) {
      return false;
    }
    return true;
  });
}

test("ACC-SALE-01 complete checkout updates stock and order history", async ({ request }) => {
  const snapshot = await createBackupSnapshot(request);
  const customerName = `ACC Sale 01 ${Date.now()}`;
  const adminCookie = await loginAdminApi(request);
  const userCookie = await autoLoginUserRequest(request);

  try {
    const beforeProducts = await fetchProducts(request, adminCookie);
    const saleProduct = getProduct(
      beforeProducts,
      (entry) => Number(entry.current_stock) >= 2,
      "Không tìm thấy sản phẩm đủ tồn kho để checkout."
    );
    const checkoutResponse = await request.post("/api/orders/checkout", {
      headers: { Cookie: userCookie },
      data: {
        customer_name: customerName,
        items: [
          {
            product_id: saleProduct.id,
            quantity: 2,
            unit_price: Number(saleProduct.sale_price || saleProduct.price || 0) || 1000,
          },
        ],
      },
    });
    expect(checkoutResponse.status()).toBe(201);
    const checkoutPayload = await checkoutResponse.json();
    expect(checkoutPayload.message).toContain("Đã chốt giỏ hàng và xuất kho");
    expect(checkoutPayload.order?.order_code || "").toContain("DH-");

    const afterProducts = await fetchProducts(request, adminCookie);
    const afterSaleProduct = getProduct(afterProducts, (entry) => entry.id === saleProduct.id, "Không tìm thấy sản phẩm sau checkout.");
    expect(Number(afterSaleProduct.current_stock)).toBe(Number(saleProduct.current_stock) - 2);
  } finally {
    await restoreBackupSnapshot(request, snapshot);
  }
});

test("ACC-SALE-02 shortage checkout for normal user creates purchase suggestion instead of stock bypass", async ({ page, request }) => {
  const snapshot = await createBackupSnapshot(request);
  const runtime = { errors: [], toasts: [] };
  page.on("pageerror", (error) => {
    runtime.errors.push(`pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    const text = message.text() || "";
    if (message.type() === "error" && !/favicon\.ico/i.test(text)) {
      runtime.errors.push(`console:${text}`);
    }
  });
  const customerName = `ACC Sale 02 ${Date.now()}`;
  const adminCookie = await loginAdminApi(request);
  const userCookie = await autoLoginUserRequest(request);

  try {
    const beforeProducts = await fetchProducts(request, adminCookie);
    const shortageProduct = getProduct(
      beforeProducts,
      (entry) => Number(entry.current_stock) >= 1,
      "Không tìm thấy sản phẩm để kiểm thử luồng thiếu hàng."
    );
    const shortageQuantity = Math.max(Number(shortageProduct.current_stock) + 1, 1);
    const seededCart = await seedDraftCartForCustomer(request, adminCookie, customerName, [
      {
        id: `cart_item_sale_02_${Date.now()}`,
        productId: shortageProduct.id,
        productName: shortageProduct.name,
        quantity: shortageQuantity,
        unitPrice: Number(shortageProduct.sale_price || shortageProduct.price || 0) || 1000,
        note: "",
      },
    ]);

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });
    await openDraftCartFromOrders(page, customerName, seededCart.id);
    await expectScreenTitle(page, "Tạo đơn xuất hàng");
    await expect(page.locator("#customerLookupInput")).toHaveValue(customerName);
    await ensureActiveCartPanelOpen(page);

    await interceptConfirm(page, true);
    await page.locator('#activeCartPanel [data-cart-action="checkout"]').click();

    await expectScreenTitle(page, "Nhập hàng");
    const createDialogMessages = await readInterceptedConfirmMessages(page);
    const createDialogMessage = createDialogMessages[createDialogMessages.length - 1] || "";
    expect(createDialogMessages[0] || "").toContain("Chốt xuất kho");
    expect(createDialogMessage).toContain("App sẽ tạo hoặc cập nhật phiếu nhập tương ứng cho phần còn thiếu");
    expect(createDialogMessage).toContain(shortageProduct.name);
    const shortageToast = await collectToast(page, runtime, "acc-sale-02-shortage", {
      errorPattern: /^$/,
    });
    expect(shortageToast).toContain("Đã tạo hoặc cập nhật phiếu nhập dự kiến");
    await expect(page.locator("#purchaseNoteInput")).toHaveValue("");

    let syncState = await fetchSyncState(request, adminCookie);
    const linkedPurchases = (syncState.purchases || []).filter((purchase) =>
      purchase.status === "draft" &&
      String(purchase.note || "") === "" &&
      String(purchase.sourceType || purchase.source_type || "") === "cart" &&
      String(purchase.sourceCode || purchase.source_code || "") === seededCart.id &&
      String(purchase.sourceName || purchase.source_name || "") === customerName &&
      Array.isArray(purchase.items)
    );
    expect(linkedPurchases).toHaveLength(1);
    const draftPurchase = linkedPurchases[0];
    expect(draftPurchase).toBeTruthy();
    expect(draftPurchase.status).toBe("draft");
    expect(
      (syncState.purchases || []).some((purchase) => String(purchase.note || "") === "Seed phiếu nhập nháp cho Bò lát xào")
    ).toBeTruthy();
    expect(
      draftPurchase.items.some(
        (item) => Number(item.productId) === Number(shortageProduct.id) && Number(item.quantity) >= shortageQuantity - Number(shortageProduct.current_stock)
      )
    ).toBeTruthy();

    await switchMenu(page, "create-order");
    await expectScreenTitle(page, "Tạo đơn xuất hàng");
    await expect(page.locator("#customerLookupInput")).toHaveValue(customerName);
    await ensureActiveCartPanelOpen(page);

    await interceptConfirm(page, true);
    await page.locator('#activeCartPanel [data-cart-action="checkout"]').click();

    await expectScreenTitle(page, "Nhập hàng");
    const existingPurchaseDialogMessages = await readInterceptedConfirmMessages(page);
    const existingPurchaseDialogMessage = existingPurchaseDialogMessages[existingPurchaseDialogMessages.length - 1] || "";
    expect(existingPurchaseDialogMessages[0] || "").toContain("Chốt xuất kho");
    expect(existingPurchaseDialogMessage).toContain("đã có phiếu chờ nhập đủ số lượng");
    expect(existingPurchaseDialogMessage).toContain(shortageProduct.name);
    const existingPurchaseToast = await collectToast(page, runtime, "acc-sale-02-existing-purchase", {
      errorPattern: /^$/,
    });
    expect(existingPurchaseToast).toContain("Đã mở phiếu nhập chờ liên quan");
    await expect(page.locator("#purchaseNoteInput")).toHaveValue("");

    syncState = await fetchSyncState(request, adminCookie);
    const linkedPurchasesAfterRetry = (syncState.purchases || []).filter((purchase) =>
      purchase.status === "draft" &&
      String(purchase.note || "") === "" &&
      String(purchase.sourceType || purchase.source_type || "") === "cart" &&
      String(purchase.sourceCode || purchase.source_code || "") === seededCart.id &&
      String(purchase.sourceName || purchase.source_name || "") === customerName &&
      Array.isArray(purchase.items)
    );
    expect(linkedPurchasesAfterRetry).toHaveLength(1);
    expect(
      linkedPurchasesAfterRetry[0].items.filter((item) => Number(item.productId) === Number(shortageProduct.id))
    ).toHaveLength(1);
    expect(
      Number(
        linkedPurchasesAfterRetry[0].items.find((item) => Number(item.productId) === Number(shortageProduct.id))?.quantity || 0
      )
    ).toBeCloseTo(shortageQuantity - Number(shortageProduct.current_stock), 2);
  } finally {
    await restoreBackupSnapshot(request, snapshot);
  }

  filterOrderOpenSyncNoise(runtime);
  expectNoRuntimeErrors(runtime);
});

test("ACC-PHB-01 inventory adjustment receipt updates stock and audit trail", async ({ request }) => {
  const snapshot = await createBackupSnapshot(request);

  try {
    const adminCookie = await loginAdminApi(request);
    const beforeProducts = await fetchProducts(request, adminCookie);
    const adjustableProduct = getProduct(
      beforeProducts,
      (entry) => Number(entry.current_stock) >= 1,
      "Không tìm thấy sản phẩm đủ tồn kho để kiểm thử phiếu điều chỉnh."
    );

    const response = await request.post("/api/adjustments/inventory", {
      headers: { Cookie: adminCookie },
      data: {
        reason: "ACC Phase B kiểm kho lệch",
        note: "ACC-PHB-01",
        items: [
          {
            product_id: adjustableProduct.id,
            quantity_delta: -1,
          },
        ],
      },
    });
    expect(response.status()).toBe(201);

    const payload = await response.json();
    expect(payload.message).toContain("phiếu điều chỉnh tồn");
    expect(payload.receipt.receipt_code).toContain("DC-");
    expect(payload.receipt.actor).toBe("masteradmin");

    const afterProducts = await fetchProducts(request, adminCookie);
    const updatedProduct = getProduct(afterProducts, (entry) => entry.id === adjustableProduct.id, "Không tìm thấy sản phẩm sau điều chỉnh.");
    expect(Number(updatedProduct.current_stock)).toBe(Number(adjustableProduct.current_stock) - 1);

    const transactions = await fetchTransactions(request, adminCookie, 6);
    expect(transactions[0].note).toContain(payload.receipt.receipt_code);
    expect(transactions[0].note).toContain("Lý do: ACC Phase B kiểm kho lệch");
    expect(transactions[0].note).toContain("Người chỉnh: masteradmin");
  } finally {
    await restoreBackupSnapshot(request, snapshot);
  }
});

test("ACC-PHB-02 customer return receipt adds stock and writes transaction note", async ({ request }) => {
  const snapshot = await createBackupSnapshot(request);

  try {
    const adminCookie = await loginAdminApi(request);
    const beforeProducts = await fetchProducts(request, adminCookie);
    const returnedProduct = getProduct(beforeProducts, () => true, "Không tìm thấy sản phẩm để kiểm thử trả hàng khách.");

    const response = await request.post("/api/returns/customers", {
      headers: { Cookie: adminCookie },
      data: {
        customer_name: "Khách ACC Phase B",
        note: "Khách đổi sang lô khác",
        items: [
          {
            product_id: returnedProduct.id,
            quantity: 1,
            unit_refund: 60000,
          },
        ],
      },
    });
    expect(response.status()).toBe(201);

    const payload = await response.json();
    expect(payload.message).toContain("phiếu trả hàng khách");
    expect(payload.receipt.receipt_code).toContain("THK-");

    const afterProducts = await fetchProducts(request, adminCookie);
    const updatedProduct = getProduct(afterProducts, (entry) => entry.id === returnedProduct.id, "Không tìm thấy sản phẩm sau trả hàng khách.");
    expect(Number(updatedProduct.current_stock)).toBe(Number(returnedProduct.current_stock) + 1);

    const transactions = await fetchTransactions(request, adminCookie, 6);
    expect(transactions[0].note).toContain(payload.receipt.receipt_code);
    expect(transactions[0].note).toContain("Khách: Khách ACC Phase B");
    expect(transactions[0].note).toContain("Khách đổi sang lô khác");
  } finally {
    await restoreBackupSnapshot(request, snapshot);
  }
});

test("ACC-PHB-03 supplier return receipt reduces stock and writes transaction note", async ({ request }) => {
  const snapshot = await createBackupSnapshot(request);

  try {
    const adminCookie = await loginAdminApi(request);
    const beforeProducts = await fetchProducts(request, adminCookie);
    const supplierReturnProduct = getProduct(
      beforeProducts,
      (entry) => Number(entry.current_stock) >= 1,
      "Không tìm thấy sản phẩm đủ tồn kho để kiểm thử trả nhà cung cấp."
    );

    const response = await request.post("/api/returns/suppliers", {
      headers: { Cookie: adminCookie },
      data: {
        supplier_name: "NCC ACC Phase B",
        note: "Trả lại hàng lỗi bao bì",
        items: [
          {
            product_id: supplierReturnProduct.id,
            quantity: 1,
            unit_cost: 15000,
          },
        ],
      },
    });
    expect(response.status()).toBe(201);

    const payload = await response.json();
    expect(payload.message).toContain("phiếu trả nhà cung cấp");
    expect(payload.receipt.receipt_code).toContain("TNCC-");

    const afterProducts = await fetchProducts(request, adminCookie);
    const updatedProduct = getProduct(afterProducts, (entry) => entry.id === supplierReturnProduct.id, "Không tìm thấy sản phẩm sau trả nhà cung cấp.");
    expect(Number(updatedProduct.current_stock)).toBe(Number(supplierReturnProduct.current_stock) - 1);

    const transactions = await fetchTransactions(request, adminCookie, 6);
    expect(transactions[0].note).toContain(payload.receipt.receipt_code);
    expect(transactions[0].note).toContain("NCC: NCC ACC Phase B");
    expect(transactions[0].note).toContain("Trả lại hàng lỗi bao bì");
  } finally {
    await restoreBackupSnapshot(request, snapshot);
  }
});

test("ACC-PHB-04 reports and receipt audit track phase B receipts separately", async ({ request }) => {
  const snapshot = await createBackupSnapshot(request);

  try {
    const adminCookie = await loginAdminApi(request);
    const focusMonth = new Date().toISOString().slice(0, 7);
    const reportBefore = await fetchMonthlyReport(request, adminCookie, focusMonth);
    const beforeFocus = reportBefore.focus_summary || {};
    const beforeProductActivity = reportBefore.product_activity || [];
    const beforeHistory = await fetchReceiptHistory(
      request,
      adminCookie,
      `${focusMonth}-01T00:00:00`,
      `${focusMonth}-31T23:59:59`
    );

    const beforeProducts = await fetchProducts(request, adminCookie);
    const product = getProduct(
      beforeProducts,
      () => true,
      "Không tìm thấy sản phẩm để kiểm thử báo cáo Phase B."
    );

    const purchaseResponse = await request.post("/api/purchases/receive", {
      headers: { Cookie: adminCookie },
      data: {
        supplier_name: "NCC ACC PHB 04",
        note: "ACC-PHB-04 purchase",
        items: [
          {
            product_id: product.id,
            quantity: 5,
            unit_cost: 12000,
          },
        ],
      },
    });
    expect(purchaseResponse.status()).toBe(201);
    const purchasePayload = await purchaseResponse.json();

    const checkoutResponse = await request.post("/api/orders/checkout", {
      headers: { Cookie: adminCookie },
      data: {
        customer_name: "Khách ACC PHB 04",
        note: "ACC-PHB-04 sale",
        items: [
          {
            product_id: product.id,
            quantity: 2,
            unit_price: 18000,
          },
        ],
      },
    });
    expect(checkoutResponse.status()).toBe(201);
    const checkoutPayload = await checkoutResponse.json();

    const customerReturnResponse = await request.post("/api/returns/customers", {
      headers: { Cookie: adminCookie },
      data: {
        customer_name: "Khách ACC PHB 04",
        source_type: "order",
        source_code: checkoutPayload.order.order_code,
        note: "ACC-PHB-04 customer-return",
        items: [
          {
            product_id: product.id,
            quantity: 1,
            unit_refund: 17000,
          },
        ],
      },
    });
    expect(customerReturnResponse.status()).toBe(201);
    const customerReturnPayload = await customerReturnResponse.json();

    const supplierReturnResponse = await request.post("/api/returns/suppliers", {
      headers: { Cookie: adminCookie },
      data: {
        supplier_name: "NCC ACC PHB 04",
        source_type: "purchase",
        source_code: purchasePayload.receipt.receipt_code,
        note: "ACC-PHB-04 supplier-return",
        items: [
          {
            product_id: product.id,
            quantity: 1,
            unit_cost: 12000,
          },
        ],
      },
    });
    expect(supplierReturnResponse.status()).toBe(201);
    const supplierReturnPayload = await supplierReturnResponse.json();

    const adjustmentResponse = await request.post("/api/adjustments/inventory", {
      headers: { Cookie: adminCookie },
      data: {
        reason: "ACC-PHB-04 adjustment",
        note: "ACC-PHB-04 adjustment",
        items: [
          { product_id: product.id, quantity_delta: 2 },
          { product_id: product.id, quantity_delta: -1 },
        ],
      },
    });
    expect(adjustmentResponse.status()).toBe(201);
    const adjustmentPayload = await adjustmentResponse.json();

    const reportAfter = await fetchMonthlyReport(request, adminCookie, focusMonth);
    const afterFocus = reportAfter.focus_summary || {};
    const productAfter = (reportAfter.product_activity || []).find((entry) => entry.product_id === product.id);
    const productBefore = beforeProductActivity.find((entry) => entry.product_id === product.id) || {
      customer_return_value: 0,
      supplier_return_value: 0,
      adjustment_in_quantity: 0,
      adjustment_out_quantity: 0,
    };

    expect(Number(afterFocus.purchase_value) - Number(beforeFocus.purchase_value || 0)).toBeCloseTo(60000, 2);
    expect(Number(afterFocus.revenue_value) - Number(beforeFocus.revenue_value || 0)).toBeCloseTo(36000, 2);
    expect(Number(afterFocus.customer_return_value) - Number(beforeFocus.customer_return_value || 0)).toBeCloseTo(17000, 2);
    expect(Number(afterFocus.supplier_return_value) - Number(beforeFocus.supplier_return_value || 0)).toBeCloseTo(12000, 2);
    expect(Number(afterFocus.adjustment_in_quantity) - Number(beforeFocus.adjustment_in_quantity || 0)).toBeCloseTo(2, 2);
    expect(Number(afterFocus.adjustment_out_quantity) - Number(beforeFocus.adjustment_out_quantity || 0)).toBeCloseTo(1, 2);
    expect(Number(productAfter.customer_return_value) - Number(productBefore.customer_return_value || 0)).toBeCloseTo(17000, 2);
    expect(Number(productAfter.supplier_return_value) - Number(productBefore.supplier_return_value || 0)).toBeCloseTo(12000, 2);
    expect(Number(productAfter.adjustment_in_quantity) - Number(productBefore.adjustment_in_quantity || 0)).toBeCloseTo(2, 2);
    expect(Number(productAfter.adjustment_out_quantity) - Number(productBefore.adjustment_out_quantity || 0)).toBeCloseTo(1, 2);

    const historyAfter = await fetchReceiptHistory(
      request,
      adminCookie,
      `${focusMonth}-01T00:00:00`,
      `${focusMonth}-31T23:59:59`
    );
    expect(historyAfter.length).toBeGreaterThanOrEqual(beforeHistory.length + 3);

    const byCode = Object.fromEntries(historyAfter.map((entry) => [entry.receipt_code, entry]));
    expect(byCode[customerReturnPayload.receipt.receipt_code]?.source_code).toBe(checkoutPayload.order.order_code);
    expect(byCode[supplierReturnPayload.receipt.receipt_code]?.source_code).toBe(purchasePayload.receipt.receipt_code);
    expect(byCode[adjustmentPayload.receipt.receipt_code]?.receipt_type).toBe("inventory_adjustment");
  } finally {
    await restoreBackupSnapshot(request, snapshot);
  }
});
