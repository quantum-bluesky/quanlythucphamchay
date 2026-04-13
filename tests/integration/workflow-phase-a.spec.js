const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginAdmin,
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

test("ACC-PUR-01 purchase can only be marked paid after it has been received", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const userCookie = await autoLoginUserRequest(request);
  const timestamp = Date.now();
  const supplierName = `NCC Test Ordered ${timestamp}`;
  const purchaseId = `purchase_ordered_test_${timestamp}`;

  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const productsResponse = await request.get("/api/products", { headers: { Cookie: userCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const product = productsPayload.products?.[0];
  expect(product).toBeTruthy();

  const orderedPurchase = {
    id: purchaseId,
    supplierName,
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

  try {
    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: {
        purchases: [...(originalState.purchases || []), orderedPurchase],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();
    const seededState = await seedResponse.json();

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });
    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");

    const orderedPurchaseCard = page.locator(".cart-queue-item", { hasText: supplierName }).first();
    await orderedPurchaseCard.locator('[data-purchase-list-action="open"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-purchase-action="mark-paid"]')).toBeDisabled();

    const invalidPayload = structuredClone(seededState.purchases || []);
    const invalidPurchase = invalidPayload.find((purchase) => purchase.id === purchaseId);
    expect(invalidPurchase).toBeTruthy();
    invalidPurchase.status = "paid";
    invalidPurchase.receivedAt = new Date().toISOString();
    invalidPurchase.paidAt = new Date().toISOString();

    const invalidResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: { purchases: invalidPayload },
    });
    expect(invalidResponse.status()).toBe(400);
    const invalidBody = await invalidResponse.json();
    expect(invalidBody.error).toContain("đã thanh toán sau khi đã nhập kho");

    const receivedPayload = structuredClone(seededState.purchases || []);
    const receivedPurchase = receivedPayload.find((purchase) => purchase.id === purchaseId);
    expect(receivedPurchase).toBeTruthy();
    receivedPurchase.status = "received";
    receivedPurchase.receivedAt = new Date().toISOString();

    const receiveResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: { purchases: receivedPayload },
    });
    expect(receiveResponse.ok()).toBeTruthy();
    const receivedState = await receiveResponse.json();

    const paidPayload = structuredClone(receivedState.purchases || []);
    const paidPurchase = paidPayload.find((purchase) => purchase.id === purchaseId);
    expect(paidPurchase).toBeTruthy();
    paidPurchase.status = "paid";
    paidPurchase.paidAt = new Date().toISOString();

    const payResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: { purchases: paidPayload },
    });
    expect(payResponse.ok()).toBeTruthy();
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

test("ACC-PUR-02 completed orders and received or paid purchases reject direct edits", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const userCookie = await autoLoginUserRequest(request);
  const timestamp = Date.now();
  const completedCartId = `cart_completed_test_${timestamp}`;
  const paidPurchaseId = `purchase_paid_test_${timestamp}`;
  const completedCustomerName = `Khách completed ${timestamp}`;
  const draftCustomerName = `Khách draft ${timestamp}`;
  const paidSupplierName = `NCC paid ${timestamp}`;

  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const productsResponse = await request.get("/api/products", { headers: { Cookie: userCookie } });
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
    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: {
        carts: [...(originalState.carts || []), completedCart, draftCart],
        purchases: [...(originalState.purchases || []), paidPurchase],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();
    const seededState = await seedResponse.json();

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "orders");
    await expectScreenTitle(page, "Đơn hàng");
    await page.locator("#showArchivedCarts").check();
    await page.waitForTimeout(300);
    await setFloatingSearch(page, completedCustomerName);
    await expect(page.locator(".cart-queue-item", { hasText: completedCustomerName })).toBeVisible();

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

    const invalidCartResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: { carts: invalidCartPayload },
    });
    expect(invalidCartResponse.status()).toBe(400);
    const invalidCartBody = await invalidCartResponse.json();
    expect(invalidCartBody.error).toContain("Đơn hàng đã chốt không thể sửa trực tiếp");

    const invalidPurchasePayload = structuredClone(seededState.purchases || []);
    const lockedPurchase = invalidPurchasePayload.find((purchase) => purchase.id === paidPurchaseId);
    expect(lockedPurchase).toBeTruthy();
    lockedPurchase.items[0].unitCost = 99000;

    const invalidPurchaseResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: { purchases: invalidPurchasePayload },
    });
    expect(invalidPurchaseResponse.status()).toBe(400);
    const invalidPurchaseBody = await invalidPurchaseResponse.json();
    expect(invalidPurchaseBody.error).toContain("Phiếu nhập đã thanh toán không thể sửa trực tiếp");
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

test("ACC-ADM-03 direct stock adjustment requires admin login and a reason", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);

  const anonymousResponse = await request.post("/api/transactions", {
    data: {
      product_id: 1,
      transaction_type: "in",
      quantity: 1,
      adjustment_reason: "anonymous",
    },
  });
  expect(anonymousResponse.status()).toBe(401);

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await autoLoginAdmin(page, request);
  await page.reload({ waitUntil: "networkidle" });

  await switchMenu(page, "admin");
  await expectScreenTitle(page, "Master Admin");
  await collectToast(page, runtime, "admin-login-auto", { errorPattern: /^$/ });

  await switchMenu(page, "inventory");
  await expectScreenTitle(page, "Kiểm tra tồn kho");
  const adminToggle = page.locator('[data-product-action="toggle-expand"]').first();
  const productId = await adminToggle.getAttribute("data-product-id");
  await adminToggle.click();
  await page.waitForTimeout(300);

  const expandedRow = page.locator(".product-row-body").first();
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
    const response = await fetch("/api/transactions?limit=5");
    return response.json();
  });
  expect(transactionPayload.transactions[0].note).toContain(`Lý do: ${reason}`);

  await page.evaluate(async ({ targetProductId }) => {
    await fetch("/api/transactions", {
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
