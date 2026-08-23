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

async function setPaymentFilter(page, value) {
  await page.locator("#paymentFilterSelect").evaluate((node, nextValue) => {
    node.value = nextValue;
    node.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
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

test("IT-PAY-01 payments screen filters unpaid items, updates payment info, and opens source documents", async ({ page, request }) => {
  test.setTimeout(90000);
  const runtime = attachRuntimeTracking(page);
  const userCookie = await autoLoginUserRequest(request);
  const timestamp = Date.now();
  const customerName = `Khách thanh toán ${timestamp}`;
  const supplierName = `NCC thanh toán ${timestamp}`;
  const orderCode = `DH-PAY-${timestamp}`;
  const receiptCode = `PN-PAY-${timestamp}`;
  const originalState = await fetchSyncState(request, userCookie);
  const products = await fetchProducts(request, userCookie);
  const product = products[0];
  expect(product).toBeTruthy();
  const now = new Date().toISOString();

  const completedCart = {
    id: `cart_payment_${timestamp}`,
    customerName,
    status: "completed",
    paymentStatus: "unpaid",
    createdAt: now,
    updatedAt: now,
    completedAt: now,
    orderCode,
    items: [
      {
        id: `cart_payment_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        quantity: 2,
        unitPrice: Number(product.sale_price || product.price || 0) || 1000,
        note: "",
      },
    ],
  };
  const receivedPurchase = {
    id: `purchase_payment_${timestamp}`,
    supplierName,
    status: "received",
    note: "Phiếu đang chờ thanh toán",
    createdAt: now,
    updatedAt: now,
    orderedAt: now,
    receivedAt: now,
    receiptCode,
    items: [
      {
        id: `purchase_payment_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        quantity: 3,
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
        carts: [completedCart, ...(originalState.carts || [])],
        purchases: [receivedPurchase, ...(originalState.purchases || [])],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "payments");
    await expectScreenTitle(page, "Thanh toán");

    await setFloatingSearch(page, customerName);
    await expect(page.locator(".payment-document-card", { hasText: customerName }).first()).toBeVisible();
    await expect(page.locator("#paymentDetailPanel")).toContainText(orderCode);

    await page.locator('#paymentDetailPanel [data-payment-form-field="paidAt"]').fill("2026-05-10");
    await page.locator('#paymentDetailPanel [data-payment-form-field="paymentMethod"]').selectOption("bank_transfer");
    await page.locator('#paymentDetailPanel [data-payment-form-field="paymentNote"]').fill("Khách đã chuyển khoản");
    await page.locator('#paymentDetailPanel [data-payment-action="mark-paid"]').click();

    const customerToast = await collectToast(page, runtime, "it-pay-01-cart", { errorPattern: /^$/ });
    expect(customerToast).toContain("Đã cập nhật thanh toán cho đơn hàng.");
    await expect(page.locator("#paymentDocumentList")).toContainText("Không có phiếu nào khớp bộ lọc hiện tại.");

    let latestState = await fetchSyncState(request, userCookie);
    const paidCart = (latestState.carts || []).find((cart) => cart.id === completedCart.id);
    expect(paidCart).toBeTruthy();
    expect(paidCart.paymentStatus).toBe("paid");
    expect(paidCart.paidAt || paidCart.paid_at).toBe("2026-05-10");
    expect(paidCart.paymentMethod || paidCart.payment_method).toBe("bank_transfer");
    expect(paidCart.paymentNote || paidCart.payment_note).toBe("Khách đã chuyển khoản");

    await setPaymentFilter(page, "paid");
    const paidCustomerCard = page.locator(".payment-document-card", { hasText: customerName }).first();
    await expect(paidCustomerCard).toBeVisible();
    await paidCustomerCard.locator('[data-payment-list-action="open"]').click();
    await expectScreenTitle(page, "Đơn hàng");
    await expect(page.locator("#orderSearchInput")).toHaveValue(orderCode);

    await switchMenu(page, "payments");
    await expectScreenTitle(page, "Thanh toán");
    await page.locator('[data-payment-tab="suppliers"]').click();
    await page.waitForTimeout(300);
    await setPaymentFilter(page, "unpaid");
    await setFloatingSearch(page, supplierName);
    await expect(page.locator(".payment-document-card", { hasText: supplierName }).first()).toBeVisible();
    await expect(page.locator("#paymentDetailPanel")).toContainText(receiptCode);

    await page.locator('#paymentDetailPanel [data-payment-form-field="paidAt"]').fill("2026-05-11");
    await page.locator('#paymentDetailPanel [data-payment-form-field="paymentMethod"]').selectOption("cash");
    await page.locator('#paymentDetailPanel [data-payment-form-field="paymentNote"]').fill("Đã trả tiền mặt cho NCC");
    await page.locator('#paymentDetailPanel [data-payment-action="mark-paid"]').click();

    const supplierToast = await collectToast(page, runtime, "it-pay-01-purchase", { errorPattern: /^$/ });
    expect(supplierToast).toContain("Đã cập nhật thanh toán cho phiếu nhập.");
    await expect(page.locator("#paymentDocumentList")).toContainText("Không có phiếu nào khớp bộ lọc hiện tại.");

    latestState = await fetchSyncState(request, userCookie);
    const paidPurchase = (latestState.purchases || []).find((purchase) => purchase.id === receivedPurchase.id);
    expect(paidPurchase).toBeTruthy();
    expect(paidPurchase.status).toBe("paid");
    expect(paidPurchase.paidAt || paidPurchase.paid_at).toBe("2026-05-11");
    expect(paidPurchase.paymentMethod || paidPurchase.payment_method).toBe("cash");
    expect(paidPurchase.paymentNote || paidPurchase.payment_note).toBe("Đã trả tiền mặt cho NCC");

    await setPaymentFilter(page, "paid");
    const paidSupplierCard = page.locator(".payment-document-card", { hasText: supplierName }).first();
    await expect(paidSupplierCard).toBeVisible();
    await paidSupplierCard.locator('[data-payment-list-action="open"]').click();
    await expectScreenTitle(page, "Nhập hàng");
    await expect(page.locator("#purchaseSupplierInput")).toHaveValue(supplierName);
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



