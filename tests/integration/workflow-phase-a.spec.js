const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  expectNoRuntimeErrors,
  expectScreenTitle,
  switchMenu,
} = require("./support/ui");

test("purchase can only be marked paid after it has been received", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);

  const stateResponse = await request.get("/api/state?transaction_limit=16");
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();

  try {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");

    const orderedPurchaseCard = page.locator(".cart-queue-item", { hasText: "NCC Rau Củ" }).first();
    await orderedPurchaseCard.locator('[data-purchase-list-action="open"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-purchase-action="mark-paid"]')).toBeDisabled();

    const invalidPayload = structuredClone(originalState);
    const orderedPurchase = invalidPayload.purchases.find((purchase) => purchase.id === "purchase_ordered_1");
    orderedPurchase.status = "paid";
    orderedPurchase.receivedAt = new Date().toISOString();
    orderedPurchase.paidAt = new Date().toISOString();

    const invalidResponse = await request.put("/api/state", {
      data: { purchases: invalidPayload.purchases },
    });
    expect(invalidResponse.status()).toBe(400);
    const invalidBody = await invalidResponse.json();
    expect(invalidBody.error).toContain("đã thanh toán sau khi đã nhập kho");

    const receivedPayload = structuredClone(originalState);
    const receivedPurchase = receivedPayload.purchases.find((purchase) => purchase.id === "purchase_ordered_1");
    receivedPurchase.status = "received";
    receivedPurchase.receivedAt = new Date().toISOString();

    const receiveResponse = await request.put("/api/state", {
      data: { purchases: receivedPayload.purchases },
    });
    expect(receiveResponse.ok()).toBeTruthy();

    const paidPayload = structuredClone(receivedPayload);
    const paidPurchase = paidPayload.purchases.find((purchase) => purchase.id === "purchase_ordered_1");
    paidPurchase.status = "paid";
    paidPurchase.paidAt = new Date().toISOString();

    const payResponse = await request.put("/api/state", {
      data: { purchases: paidPayload.purchases },
    });
    expect(payResponse.ok()).toBeTruthy();
  } finally {
    await request.put("/api/state", {
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

test("completed orders and received or paid purchases reject direct edits", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);

  const stateResponse = await request.get("/api/state?transaction_limit=16");
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();

  try {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await switchMenu(page, "orders");
    await expectScreenTitle(page, "Đơn hàng");
    await page.locator("#showArchivedCarts").check();
    await page.waitForTimeout(300);
    const completedOrderCard = page.locator(".cart-queue-item", { hasText: "Chị Ngọc, Long Biên" }).first();
    await completedOrderCard.locator('[data-queue-action="toggle-detail"]').click();
    await page.waitForTimeout(300);
    await expect(completedOrderCard.locator('[data-queue-action="delete"]')).toHaveCount(0);

    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");
    await page.locator("#showPaidPurchases").check();
    await page.waitForTimeout(300);
    const paidPurchaseCard = page.locator(".cart-queue-item", { hasText: "Đã thanh toán" }).first();
    await paidPurchaseCard.locator('[data-purchase-list-action="open"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-purchase-item-action="save"]')).toHaveCount(0);
    await expect(page.locator('[data-purchase-action="delete"]')).toHaveCount(0);

    const invalidCartPayload = structuredClone(originalState);
    const completedCart = invalidCartPayload.carts.find((cart) => cart.id === "cart_completed_1");
    completedCart.items[0].quantity = 9;

    const invalidCartResponse = await request.put("/api/state", {
      data: { carts: invalidCartPayload.carts },
    });
    expect(invalidCartResponse.status()).toBe(400);
    const invalidCartBody = await invalidCartResponse.json();
    expect(invalidCartBody.error).toContain("Đơn hàng đã chốt không thể sửa trực tiếp");

    const invalidPurchasePayload = structuredClone(originalState);
    const paidPurchase = invalidPurchasePayload.purchases.find((purchase) => purchase.id === "purchase_paid_1");
    paidPurchase.items[0].unitCost = 99000;

    const invalidPurchaseResponse = await request.put("/api/state", {
      data: { purchases: invalidPurchasePayload.purchases },
    });
    expect(invalidPurchaseResponse.status()).toBe(400);
    const invalidPurchaseBody = await invalidPurchaseResponse.json();
    expect(invalidPurchaseBody.error).toContain("Phiếu nhập đã thanh toán không thể sửa trực tiếp");
  } finally {
    await request.put("/api/state", {
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
