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
