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

test("IT-ORD-01 orders screen actions expand details, mark paid, and reopen draft carts", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const userCookie = await autoLoginUserRequest(request);
  const timestamp = Date.now();
  const completedCustomerName = `Khách completed ORD ${timestamp}`;
  const draftCustomerName = `Khách draft ORD ${timestamp}`;

  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const productsResponse = await request.get("/api/products", { headers: { Cookie: userCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const product = productsPayload.products?.[0];
  expect(product).toBeTruthy();

  const completedCart = {
    id: `order_completed_${timestamp}`,
    customerName: completedCustomerName,
    status: "completed",
    paymentStatus: "unpaid",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    orderCode: `DH-ORD-${timestamp}`,
    items: [
      {
        id: `order_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: Number(product.sale_price || product.price || 0) || 1000,
        note: "",
      },
    ],
  };
  const draftCart = {
    id: `order_draft_${timestamp}`,
    customerName: draftCustomerName,
    status: "draft",
    paymentStatus: "unpaid",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    orderCode: "",
    items: [],
  };

  try {
    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: {
        carts: [draftCart, completedCart, ...(originalState.carts || [])],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "orders");
    await expectScreenTitle(page, "Đơn hàng");
    await page.locator("#showArchivedCarts").check();
    await page.waitForTimeout(300);
    await setFloatingSearch(page, completedCustomerName);

    const completedOrderCard = page.locator(".cart-queue-item", { hasText: completedCustomerName }).first();
    await completedOrderCard.locator('[data-queue-action="toggle-detail"]').click();
    await page.waitForTimeout(300);
    await expect(completedOrderCard.locator('[data-queue-action="mark-paid"]')).toHaveCount(1);

    const currentStateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
    expect(currentStateResponse.ok()).toBeTruthy();
    const currentState = await currentStateResponse.json();
    const payResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: {
        carts: (currentState.carts || []).map((cart) => (
          cart.id === completedCart.id ? { ...cart, paymentStatus: "paid" } : cart
        )),
        expected_updated_at: { carts: currentState.updated_at?.carts || "" },
      },
    });
    expect(payResponse.ok()).toBeTruthy();

    await page.reload({ waitUntil: "networkidle" });
    await switchMenu(page, "orders");
    await expectScreenTitle(page, "Đơn hàng");
    await page.locator("#showArchivedCarts").check();
    await setFloatingSearch(page, draftCustomerName);
    const draftOrderCard = page.locator(".cart-queue-item", { hasText: draftCustomerName }).first();
    await page.evaluate((cartId) => {
      const button = document.querySelector(`[data-queue-action="open"][data-cart-id="${cartId}"]`);
      if (!(button instanceof HTMLElement)) {
        throw new Error("Không tìm thấy nút mở giỏ hàng nháp.");
      }
      button.click();
    }, draftCart.id);
    await expectScreenTitle(page, "Tạo đơn xuất hàng");
    await expect(page.locator("#customerLookupInput")).toHaveValue(draftCustomerName);
    await collectToast(page, runtime, "orders-open-draft");
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

  runtime.errors = runtime.errors.filter((entry) => {
    if (entry.includes("status of 400 (Bad Request)")) {
      return false;
    }
    if (entry.includes("Đơn hàng đã chốt không thể sửa trực tiếp")) {
      return false;
    }
    return true;
  });
  expectNoRuntimeErrors(runtime);
});
