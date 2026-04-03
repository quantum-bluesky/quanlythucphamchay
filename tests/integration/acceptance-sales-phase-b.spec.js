const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
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
}

async function createBackupSnapshot(request) {
  await loginAdminApi(request);
  const response = await request.get("/api/admin/backup");
  expect(response.ok()).toBeTruthy();
  return response.body();
}

async function restoreBackupSnapshot(request, snapshot) {
  await loginAdminApi(request);
  const response = await request.post("/api/admin/restore", {
    data: {
      content_base64: snapshot.toString("base64"),
    },
  });
  expect(response.ok()).toBeTruthy();
}

async function fetchProducts(request) {
  const response = await request.get("/api/products");
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  return payload.products || [];
}

async function fetchTransactions(request, limit = 10) {
  const response = await request.get(`/api/transactions?limit=${limit}`);
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  return payload.transactions || [];
}

async function fetchSyncState(request) {
  const response = await request.get("/api/state?transaction_limit=16");
  expect(response.ok()).toBeTruthy();
  return response.json();
}

function getProductByName(products, name) {
  const product = products.find((entry) => entry.name === name);
  expect(product, `Không tìm thấy sản phẩm ${name}`).toBeTruthy();
  return product;
}

test("ACC-SALE-01 complete checkout updates stock and order history", async ({ page, request }) => {
  const snapshot = await createBackupSnapshot(request);
  const runtime = attachRuntimeTracking(page);
  const customerName = `ACC Sale 01 ${Date.now()}`;

  try {
    const beforeProducts = await fetchProducts(request);
    const boKho = getProductByName(beforeProducts, "Bò kho");
    const chaQueChay = getProductByName(beforeProducts, "Chả quế chay");

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await switchMenu(page, "create-order");
    await expectScreenTitle(page, "Tạo đơn xuất hàng");

    await page.locator("#customerLookupInput").fill(customerName);
    await page.locator("#openCartButton").click();
    await collectToast(page, runtime, "acc-sale-01-open-cart");

    await page.locator(`[data-pick-product="${boKho.id}"]`).check();
    const boKhoQtyInput = page.locator(".sales-product-row", { hasText: "Bò kho" }).locator("[data-sales-inline-qty]");
    await boKhoQtyInput.fill("2");
    await boKhoQtyInput.dispatchEvent("change");
    await page.locator(`[data-pick-product="${chaQueChay.id}"]`).check();

    await page.locator('#activeCartPanel [data-cart-action="toggle-panel"]').click();
    await page.waitForTimeout(300);
    await page.locator('#activeCartPanel [data-cart-action="checkout"]').click();
    const checkoutToast = await collectToast(page, runtime, "acc-sale-01-checkout", {
      errorPattern: /^$/,
    });
    expect(checkoutToast).toContain("Đã chốt giỏ hàng và xuất kho");

    await switchMenu(page, "orders");
    await expectScreenTitle(page, "Đơn hàng");
    await page.locator("#showArchivedCarts").check();
    const completedOrderCard = page.locator(".cart-queue-item", { hasText: customerName }).first();
    await expect(completedOrderCard).toContainText("Đã xong");

    const afterProducts = await fetchProducts(request);
    const afterBoKho = getProductByName(afterProducts, "Bò kho");
    const afterChaQueChay = getProductByName(afterProducts, "Chả quế chay");
    expect(Number(afterBoKho.current_stock)).toBe(Number(boKho.current_stock) - 2);
    expect(Number(afterChaQueChay.current_stock)).toBe(Number(chaQueChay.current_stock) - 1);

    const syncState = await fetchSyncState(request);
    const completedCart = (syncState.carts || []).find((cart) => cart.customerName === customerName);
    expect(completedCart).toBeTruthy();
    expect(completedCart.status).toBe("completed");
    expect(completedCart.items.length).toBe(2);
    expect(completedCart.orderCode).toContain("DH-");
  } finally {
    await restoreBackupSnapshot(request, snapshot);
  }

  expectNoRuntimeErrors(runtime);
});

test("ACC-SALE-02 shortage checkout for normal user creates purchase suggestion instead of stock bypass", async ({ page, request }) => {
  const snapshot = await createBackupSnapshot(request);
  const runtime = attachRuntimeTracking(page);
  const customerName = `ACC Sale 02 ${Date.now()}`;

  try {
    const beforeProducts = await fetchProducts(request);
    const boLatXao = getProductByName(beforeProducts, "Bò lát xào");
    expect(Number(boLatXao.current_stock)).toBe(0);

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await switchMenu(page, "create-order");
    await expectScreenTitle(page, "Tạo đơn xuất hàng");

    await page.locator("#customerLookupInput").fill(customerName);
    await page.locator("#openCartButton").click();
    await collectToast(page, runtime, "acc-sale-02-open-cart");

    await page.locator(`[data-pick-product="${boLatXao.id}"]`).check();
    await page.locator('#activeCartPanel [data-cart-action="toggle-panel"]').click();
    await page.waitForTimeout(300);
    await page.locator('#activeCartPanel [data-cart-action="checkout"]').click();

    await expectScreenTitle(page, "Nhập hàng");
    const shortageToast = await collectToast(page, runtime, "acc-sale-02-shortage", {
      errorPattern: /^$/,
    });
    expect(shortageToast).toContain("Đã tạo sẵn phiếu nhập dự kiến");
    await expect(page.locator("#purchaseNoteInput")).toHaveValue(`Thiếu hàng cho đơn ${customerName}`);

    const syncState = await fetchSyncState(request);
    const draftPurchase = (syncState.purchases || []).find((purchase) => purchase.note === `Thiếu hàng cho đơn ${customerName}`);
    expect(draftPurchase).toBeTruthy();
    expect(draftPurchase.status).toBe("draft");
    expect(
      draftPurchase.items.some(
        (item) => Number(item.productId) === Number(boLatXao.id) && Number(item.quantity) >= 1
      )
    ).toBeTruthy();
  } finally {
    await restoreBackupSnapshot(request, snapshot);
  }

  expectNoRuntimeErrors(runtime);
});

test("ACC-PHB-01 inventory adjustment receipt updates stock and audit trail", async ({ request }) => {
  const snapshot = await createBackupSnapshot(request);

  try {
    await loginAdminApi(request);
    const beforeProducts = await fetchProducts(request);
    const chaQueChay = getProductByName(beforeProducts, "Chả quế chay");

    const response = await request.post("/api/adjustments/inventory", {
      data: {
        reason: "ACC Phase B kiểm kho lệch",
        note: "ACC-PHB-01",
        items: [
          {
            product_id: chaQueChay.id,
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

    const afterProducts = await fetchProducts(request);
    const updatedProduct = getProductByName(afterProducts, "Chả quế chay");
    expect(Number(updatedProduct.current_stock)).toBe(Number(chaQueChay.current_stock) - 1);

    const transactions = await fetchTransactions(request, 6);
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
    const beforeProducts = await fetchProducts(request);
    const boKho = getProductByName(beforeProducts, "Bò kho");

    const response = await request.post("/api/returns/customers", {
      data: {
        customer_name: "Khách ACC Phase B",
        note: "Khách đổi sang lô khác",
        items: [
          {
            product_id: boKho.id,
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

    const afterProducts = await fetchProducts(request);
    const updatedProduct = getProductByName(afterProducts, "Bò kho");
    expect(Number(updatedProduct.current_stock)).toBe(Number(boKho.current_stock) + 1);

    const transactions = await fetchTransactions(request, 6);
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
    const beforeProducts = await fetchProducts(request);
    const ruocNam = getProductByName(beforeProducts, "Ruốc nấm");

    const response = await request.post("/api/returns/suppliers", {
      data: {
        supplier_name: "NCC ACC Phase B",
        note: "Trả lại hàng lỗi bao bì",
        items: [
          {
            product_id: ruocNam.id,
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

    const afterProducts = await fetchProducts(request);
    const updatedProduct = getProductByName(afterProducts, "Ruốc nấm");
    expect(Number(updatedProduct.current_stock)).toBe(Number(ruocNam.current_stock) - 1);

    const transactions = await fetchTransactions(request, 6);
    expect(transactions[0].note).toContain(payload.receipt.receipt_code);
    expect(transactions[0].note).toContain("NCC: NCC ACC Phase B");
    expect(transactions[0].note).toContain("Trả lại hàng lỗi bao bì");
  } finally {
    await restoreBackupSnapshot(request, snapshot);
  }
});
