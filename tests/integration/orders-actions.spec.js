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
    await expect(draftOrderCard).toBeVisible();
    await draftOrderCard.locator('[data-queue-action="open"]').click();
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
    if (entry.includes("status of 409 (Conflict)") || entry.includes("server responded with a status of 409 (Conflict)")) {
      return false;
    }
    if (entry.includes("Đơn hàng đã chốt không thể sửa trực tiếp")) {
      return false;
    }
    return true;
  });
  expectNoRuntimeErrors(runtime);
});

test("IT-ORD-02 sales draft cart can save document discount from create-order screen", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const userCookie = await autoLoginUserRequest(request);
  const timestamp = Date.now();
  const draftCustomerName = `Khách discount draft ${timestamp}`;
  const draftCartId = `cart_discount_draft_${timestamp}`;
  const draftDiscountAmount = 3000;

  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const productsResponse = await request.get("/api/products", { headers: { Cookie: userCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const product = productsPayload.products?.[0];
  expect(product).toBeTruthy();

  const unitPrice = Number(product.sale_price || product.price || 0) || 1000;
  const item = {
    id: `order_discount_item_${timestamp}`,
    productId: product.id,
    productName: product.name,
    quantity: 2,
    unitPrice,
    note: "",
  };

  const draftCart = {
    id: draftCartId,
    customerName: draftCustomerName,
    status: "draft",
    paymentStatus: "unpaid",
    discountAmount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    orderCode: "",
    items: [item],
  };

  try {
    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: {
        carts: [draftCart, ...(originalState.carts || [])],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "orders");
    await expectScreenTitle(page, "Đơn hàng");
    await setFloatingSearch(page, draftCustomerName);
    const draftOrderCard = page.locator(".cart-queue-item", { hasText: draftCustomerName }).first();
    await draftOrderCard.locator('[data-queue-action="open"]').click();
    await expectScreenTitle(page, "Tạo đơn xuất hàng");
    await expect(page.locator("#customerLookupInput")).toHaveValue(draftCustomerName);
    const togglePanelButton = page.locator('[data-cart-action="toggle-panel"]');
    if (await togglePanelButton.count()) {
      await togglePanelButton.first().click();
    }
    const draftDiscountInput = page.locator(`[data-cart-discount-input="${draftCartId}"]`);
    await expect(draftDiscountInput).toBeVisible();
    await draftDiscountInput.fill(String(draftDiscountAmount));
    await page.locator('[data-cart-action="save-discount"]').click();
    const draftToast = await collectToast(page, runtime, "it-ord-02-save-draft-discount", { errorPattern: /^$/ });
    expect(draftToast).toContain("Đã lưu giảm giá khuyến mại");
    await expect(draftDiscountInput).toHaveValue(String(draftDiscountAmount));

    const latestStateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
    expect(latestStateResponse.ok()).toBeTruthy();
    const latestState = await latestStateResponse.json();
    const latestDraftCart = (latestState.carts || []).find((cart) => cart.id === draftCartId);
    expect(latestDraftCart).toBeTruthy();
    expect(Number(latestDraftCart.discountAmount || latestDraftCart.discount_amount || 0)).toBe(draftDiscountAmount);
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

test("IT-ORD-03 orders screen can repeat a completed order into a new draft cart", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const userCookie = await autoLoginUserRequest(request);
  const timestamp = Date.now();
  const customerName = `Khách lặp đơn ${timestamp}`;
  const completedCartId = `order_repeat_source_${timestamp}`;
  const discountAmount = 4000;
  const shipAddress = `Địa chỉ lặp đơn ${timestamp}`;

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
    customerId: `customer_repeat_${timestamp}`,
    customerName,
    status: "completed",
    paymentStatus: "unpaid",
    discountAmount,
    shipAddress,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    orderCode: `DH-REPEAT-${timestamp}`,
    items: [
      {
        id: `order_repeat_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity: 2,
        unitPrice: Number(product.sale_price || product.price || 0) || 1000,
        note: "",
      },
    ],
  };

  try {
    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: {
        carts: [completedCart, ...(originalState.carts || [])],
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
    await setFloatingSearch(page, customerName);

    const completedOrderCard = page.locator(".cart-queue-item", { hasText: customerName }).first();
    await expect(completedOrderCard).toBeVisible();
    const inlineRepeatButton = completedOrderCard.locator('[data-queue-action="repeat"]').first();
    if (await inlineRepeatButton.count()) {
      await inlineRepeatButton.click();
    } else {
      await completedOrderCard.locator('[data-queue-action="toggle-detail"]').click();
      await completedOrderCard.locator('[data-queue-action="repeat"]').click();
    }

    const repeatToast = await collectToast(page, runtime, "it-ord-03-repeat-order", { errorPattern: /^$/ });
    expect(repeatToast).toContain("Đã tạo đơn nháp mới");
    await expectScreenTitle(page, "Tạo đơn xuất hàng");
    await expect(page.locator("#customerLookupInput")).toHaveValue(customerName);
    const togglePanelButton = page.locator('#activeCartPanel [data-cart-action="toggle-panel"]').first();
    if (!await page.locator("#activeCartPanel [data-cart-ship-address-input]").count() && await togglePanelButton.count()) {
      await togglePanelButton.click();
    }
    await expect(page.locator("#activeCartPanel [data-cart-ship-address-input]")).toHaveValue(shipAddress);
    await expect(page.locator("#activeCartPanel [data-cart-discount-input]")).toHaveValue(String(discountAmount));

    const latestStateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
    expect(latestStateResponse.ok()).toBeTruthy();
    const latestState = await latestStateResponse.json();
    const repeatedDrafts = (latestState.carts || []).filter((cart) =>
      cart.id !== completedCartId &&
      cart.status === "draft" &&
      cart.customerName === customerName
    );
    expect(repeatedDrafts).toHaveLength(1);
    const repeatedDraft = repeatedDrafts[0];
    expect(repeatedDraft.paymentStatus).toBe("unpaid");
    expect(String(repeatedDraft.orderCode || "")).toBe("");
    expect(Number(repeatedDraft.discountAmount || repeatedDraft.discount_amount || 0)).toBe(discountAmount);
    expect(String(repeatedDraft.shipAddress || repeatedDraft.ship_address || "")).toBe(shipAddress);
    expect(repeatedDraft.items || []).toHaveLength(1);
    expect(Number(repeatedDraft.items[0].productId)).toBe(Number(product.id));
    expect(Number(repeatedDraft.items[0].quantity)).toBe(2);
    expect(Number(repeatedDraft.items[0].unitPrice)).toBe(Number(completedCart.items[0].unitPrice));

    const unchangedCompletedCart = (latestState.carts || []).find((cart) => cart.id === completedCartId);
    expect(unchangedCompletedCart).toBeTruthy();
    expect(unchangedCompletedCart.status).toBe("completed");
    expect(String(unchangedCompletedCart.orderCode || "")).toBe(completedCart.orderCode);
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
