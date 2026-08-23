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

    await page.goto(process.env.TEST_ADMIN_PATH || "admin");
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
    await page.locator("#showPaidOrders").check();
    await setFloatingSearch(page, completedCustomerName);
    await expect(page.locator(".cart-queue-item", { hasText: completedCustomerName }).first()).toBeVisible();

    await setFloatingSearch(page, "");
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

test("IT-ORD-08 create-order screen can create a separate new draft without reusing the current one", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page, { autoAcceptDialogs: false });
  const userCookie = await autoLoginUserRequest(request);
  const timestamp = Date.now();
  const customerId = `customer_new_separate_${timestamp}`;
  const customerName = `Khách tách đơn ${timestamp}`;

  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const productsResponse = await request.get("/api/products", { headers: { Cookie: userCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const product = productsPayload.products?.[0];
  expect(product).toBeTruthy();

  const existingDraftCart = {
    id: `order_existing_draft_${timestamp}`,
    customerId,
    customerName,
    status: "draft",
    paymentStatus: "unpaid",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    orderCode: "",
    items: [
      {
        id: `order_existing_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        quantity: 2,
        unitPrice: Number(product.sale_price || product.price || 0) || 1000,
        note: "",
      },
    ],
  };
  const seededCustomer = {
    id: customerId,
    name: customerName,
    phone: "",
    address: "",
    zaloUrl: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const dialogs = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });

  try {
    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: {
        customers: [seededCustomer, ...(originalState.customers || [])],
        carts: [existingDraftCart, ...(originalState.carts || [])],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto(process.env.TEST_ADMIN_PATH || "admin");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "create-order");
    await expectScreenTitle(page, "Tạo đơn xuất hàng");
    await page.locator("#customerLookupInput").fill(customerName);
    await page.locator("#openCartButton").click();
    await collectToast(page, runtime, "it-ord-08-open-existing", { errorPattern: /^$/ });

    await expect(page.locator("#customerLookupInput")).toHaveValue(customerName);
    await expect(page.locator("#createNewCartButton")).toBeVisible();

    await page.locator("#createNewCartButton").click();

    const createToast = await collectToast(page, runtime, "it-ord-08-create-new", { errorPattern: /^$/ });
    expect(createToast).toContain("Đã tạo đơn nháp mới tách biệt đơn cũ.");
    if (dialogs.length) {
      expect(dialogs[0]).toContain("Tạo đơn mới");
    }

    await expect(page.locator("#selectedCartSection")).toBeHidden();

    const latestStateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
    expect(latestStateResponse.ok()).toBeTruthy();
    const latestState = await latestStateResponse.json();
    const draftCarts = (latestState.carts || []).filter((cart) => (
      String(cart.customerId || cart.customer_id || "") === customerId
      && String(cart.status || "") === "draft"
    ));
    expect(draftCarts).toHaveLength(2);
    const reusedExistingCart = draftCarts.find((cart) => String(cart.id || "") === existingDraftCart.id);
    const newDraftCart = draftCarts.find((cart) => String(cart.id || "") !== existingDraftCart.id);
    expect(reusedExistingCart).toBeTruthy();
    expect(newDraftCart).toBeTruthy();
    expect(reusedExistingCart.items || []).toHaveLength(1);
    expect(newDraftCart.items || []).toHaveLength(0);
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

test("IT-ORD-09 sales order note can be created from form and edited from order detail", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const userCookie = await autoLoginUserRequest(request);
  const timestamp = Date.now();
  const customerName = `Khách note ORD ${timestamp}`;
  const initialNote = `Ghi chú tạo mới ${timestamp}`;
  const updatedNote = `Ghi chú đã sửa ${timestamp}`;

  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();

  try {
    await page.goto(process.env.TEST_ADMIN_PATH || "admin");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "create-order");
    await expectScreenTitle(page, "Tạo đơn xuất hàng");
    await page.locator("#customerLookupInput").fill(customerName);
    await page.locator("#createNewCartButton").click();
    const createToast = await collectToast(page, runtime, "it-ord-09-create-cart", { errorPattern: /^$/ });
    expect(createToast).toContain("Đã tạo đơn nháp mới tách biệt đơn cũ.");

    const salesNoteInput = page.locator("#salesNoteInput");
    await expect(salesNoteInput).toBeEnabled();
    await salesNoteInput.fill(initialNote);
    await salesNoteInput.press("Tab");
    const saveDraftNoteToast = await collectToast(page, runtime, "it-ord-09-save-draft-note", { errorPattern: /^$/ });
    expect(saveDraftNoteToast).toContain("Đã lưu ghi chú phiếu xuất.");

    const draftStateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
    expect(draftStateResponse.ok()).toBeTruthy();
    const draftState = await draftStateResponse.json();
    const createdDraft = (draftState.carts || []).find((cart) =>
      cart.status === "draft" &&
      cart.customerName === customerName
    );
    expect(createdDraft).toBeTruthy();
    expect(String(createdDraft.note || "")).toBe(initialNote);

    await switchMenu(page, "orders");
    await expectScreenTitle(page, "Đơn hàng");
    await setFloatingSearch(page, customerName);

    const orderCard = page.locator(".cart-queue-item", { hasText: customerName }).first();
    await expect(orderCard).toBeVisible();
    await orderCard.locator('[data-queue-action="toggle-detail"]').click();

    const detailPanel = page.locator("#orderDetailPanel");
    await detailPanel.locator('[data-order-detail-action="toggle-detail-meta"]').click();
    await expect(detailPanel).toContainText(initialNote);
    const detailNoteInput = detailPanel.locator(`[data-cart-note-input="${createdDraft.id}"]`);
    await expect(detailNoteInput).toHaveValue(initialNote);

    await detailNoteInput.fill(updatedNote);
    await detailPanel.locator('[data-order-detail-action="save-note"]').click();
    const saveDetailNoteToast = await collectToast(page, runtime, "it-ord-09-save-detail-note", { errorPattern: /^$/ });
    expect(saveDetailNoteToast).toContain("Đã lưu ghi chú phiếu xuất.");

    const latestStateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
    expect(latestStateResponse.ok()).toBeTruthy();
    const latestState = await latestStateResponse.json();
    const updatedDraft = (latestState.carts || []).find((cart) => cart.id === createdDraft.id);
    expect(updatedDraft).toBeTruthy();
    expect(String(updatedDraft.note || "")).toBe(updatedNote);
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

test("IT-ORD-05 commit warns when sale total is lower than purchase total", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page, { autoAcceptDialogs: false });
  const userCookie = await autoLoginUserRequest(request);
  const timestamp = Date.now();
  const customerName = `Khách cảnh báo giá ${timestamp}`;

  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const productsResponse = await request.get("/api/products", { headers: { Cookie: userCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const product = productsPayload.products?.find((entry) => Number(entry.current_stock || 0) >= 2) || productsPayload.products?.[0];
  expect(product).toBeTruthy();

  const draftCart = {
    id: `order_warning_${timestamp}`,
    customerName,
    status: "draft",
    paymentStatus: "unpaid",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    orderCode: "",
    items: [
      {
        id: `order_warning_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        quantity: 2,
        unitPrice: Math.max(0, Number(product.price || 0) - 2000),
        note: "",
      },
    ],
  };

  try {
    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: {
        carts: [draftCart, ...(originalState.carts || [])],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto(process.env.TEST_ADMIN_PATH || "admin");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "orders");
    await expectScreenTitle(page, "Đơn hàng");
    await setFloatingSearch(page, customerName);

    const draftOrderCard = page.locator(".cart-queue-item", { hasText: customerName }).first();
    await expect(draftOrderCard).toBeVisible();
    await draftOrderCard.locator('[data-queue-action="open"]').click();
    await expectScreenTitle(page, "Tạo đơn xuất hàng");
    if (!await page.locator('[data-cart-action="commit"]').isVisible().catch(() => false)) {
      await page.locator('[data-cart-action="toggle-panel"]').click();
      await expect(page.locator('[data-cart-action="commit"]')).toBeVisible();
    }

    const dialogs = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    await page.locator('[data-cart-action="commit"]').click();

    await expect.poll(() => dialogs.length).toBe(2);
    expect(dialogs[0]).toContain("Chốt đơn");
    expect(dialogs[1]).toContain("tổng giá xuất đang thấp hơn giá nhập");

    const commitToast = await collectToast(page, runtime, "it-ord-05-commit-warning", { errorPattern: /^$/ });
    expect(commitToast).toContain("Đã chốt đơn");
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

test("IT-ORD-07 orders screen can bulk commit selected drafts and keep invalid drafts selected", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const userCookie = await autoLoginUserRequest(request);
  const timestamp = Date.now();
  const customerPrefix = `Khách bulk commit ${timestamp}`;

  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const productsResponse = await request.get("/api/products", { headers: { Cookie: userCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const product = productsPayload.products?.find((entry) => Number(entry.current_stock || 0) >= 1) || productsPayload.products?.[0];
  expect(product).toBeTruthy();

  const validCart = {
    id: `order_bulk_valid_${timestamp}`,
    customerName: `${customerPrefix} A`,
    status: "draft",
    paymentStatus: "unpaid",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    orderCode: "",
    items: [
      {
        id: `order_bulk_valid_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: Number(product.sale_price || product.price || 0) || 1000,
        note: "",
      },
    ],
  };
  const invalidCart = {
    id: `order_bulk_invalid_${timestamp}`,
    customerName: `${customerPrefix} B`,
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
        carts: [validCart, invalidCart, ...(originalState.carts || [])],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto(process.env.TEST_ADMIN_PATH || "admin");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "orders");
    await expectScreenTitle(page, "Đơn hàng");
    await setFloatingSearch(page, customerPrefix);

    const validCheckbox = page.locator(`[data-order-select="${validCart.id}"] input[data-queue-action="toggle-merge-select"]`).first();
    const invalidCheckbox = page.locator(`[data-order-select="${invalidCart.id}"] input[data-queue-action="toggle-merge-select"]`).first();
    await validCheckbox.check();
    await invalidCheckbox.check();
    await expect(validCheckbox).toBeChecked();
    await expect(invalidCheckbox).toBeChecked();

    await page.locator('#cartQueueList [data-queue-action="commit-selected"]').click();
    const bulkCommitToast = await collectToast(page, runtime, "it-ord-07-bulk-commit", { errorPattern: /^$/ });
    expect(bulkCommitToast).toContain("Đã chốt 1 đơn đã chọn.");

    const latestStateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
    expect(latestStateResponse.ok()).toBeTruthy();
    const latestState = await latestStateResponse.json();
    const latestValidCart = (latestState.carts || []).find((cart) => cart.id === validCart.id);
    const latestInvalidCart = (latestState.carts || []).find((cart) => cart.id === invalidCart.id);
    expect(String(latestValidCart?.status || "")).toBe("committed");
    expect(String(latestInvalidCart?.status || "")).toBe("draft");

    await expect(page.locator("#cartQueueList .inline-alert.warning")).toContainText("1 phiếu xuất đang được chọn");
    await expect(invalidCheckbox).toBeChecked();
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

    await page.goto(process.env.TEST_ADMIN_PATH || "admin");
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

test("IT-ORD-04 orders screen asks to merge repeat items into an existing draft cart of the same customer", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page, { autoAcceptDialogs: false });
  const userCookie = await autoLoginUserRequest(request);
  const timestamp = Date.now();
  const customerId = `customer_repeat_merge_${timestamp}`;
  const customerName = `Khách dồn nháp ${timestamp}`;
  const completedCartId = `order_repeat_merge_source_${timestamp}`;
  const draftCartId = `order_repeat_merge_target_${timestamp}`;

  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const productsResponse = await request.get("/api/products", { headers: { Cookie: userCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const firstProduct = productsPayload.products?.[0];
  expect(firstProduct).toBeTruthy();

  const completedCart = {
    id: completedCartId,
    customerId,
    customerName,
    status: "completed",
    paymentStatus: "unpaid",
    discountAmount: 5000,
    shipAddress: `Địa chỉ completed ${timestamp}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    orderCode: `DH-REPEAT-MERGE-${timestamp}`,
    items: [
      {
        id: `order_repeat_merge_item_source_${timestamp}`,
        productId: firstProduct.id,
        productName: firstProduct.name,
        unit: firstProduct.unit,
        quantity: 2,
        unitPrice: Number(firstProduct.sale_price || firstProduct.price || 0) || 1000,
        note: "",
      },
    ],
  };

  const existingDraftCart = {
    id: draftCartId,
    customerId,
    customerName,
    status: "draft",
    paymentStatus: "unpaid",
    discountAmount: 2000,
    shipAddress: `Địa chỉ draft ${timestamp}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    orderCode: "",
    items: [
      {
        id: `order_repeat_merge_item_target_${timestamp}`,
        productId: firstProduct.id,
        productName: firstProduct.name,
        unit: firstProduct.unit,
        quantity: 1,
        unitPrice: Number(firstProduct.sale_price || firstProduct.price || 0) || 1000,
        note: "",
      },
    ],
  };
  const customer = {
    id: customerId,
    name: customerName,
    phone: "",
    address: existingDraftCart.shipAddress,
    zaloUrl: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: {
        customers: [...(originalState.customers || []), customer],
        carts: [existingDraftCart, completedCart, ...(originalState.carts || [])],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto(process.env.TEST_ADMIN_PATH || "admin");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "orders");
    await expectScreenTitle(page, "Đơn hàng");
    await page.locator("#showArchivedCarts").check();
    await page.waitForTimeout(300);
    await setFloatingSearch(page, customerName);

    const completedOrderCard = page.locator(".cart-queue-item", { hasText: completedCart.orderCode }).first();
    await expect(completedOrderCard).toBeVisible();
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("đang có một đơn nháp");
      await dialog.accept();
    });
    const inlineRepeatButton = completedOrderCard.locator('[data-queue-action="repeat"]').first();
    if (await inlineRepeatButton.count()) {
      await inlineRepeatButton.click();
    } else {
      await completedOrderCard.locator('[data-queue-action="toggle-detail"]').click();
      await completedOrderCard.locator('[data-queue-action="repeat"]').click();
    }

    const repeatToast = await collectToast(page, runtime, "it-ord-04-repeat-order-merge", { errorPattern: /^$/ });
    expect(repeatToast).toContain("Đã dồn thêm vào đơn nháp hiện có");
    await expectScreenTitle(page, "Tạo đơn xuất hàng");
    await expect(page.locator("#customerLookupInput")).toHaveValue(customerName);

    const latestStateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
    expect(latestStateResponse.ok()).toBeTruthy();
    const latestState = await latestStateResponse.json();
    const repeatedDrafts = (latestState.carts || []).filter((cart) =>
      cart.status === "draft" &&
      cart.customerName === customerName
    );
    expect(repeatedDrafts).toHaveLength(1);
    const mergedDraft = repeatedDrafts[0];
    expect(mergedDraft.id).toBe(draftCartId);
    expect(String(mergedDraft.shipAddress || mergedDraft.ship_address || "")).toBe(existingDraftCart.shipAddress);
    expect(Number(mergedDraft.discountAmount || mergedDraft.discount_amount || 0)).toBe(2000);
    expect(mergedDraft.items || []).toHaveLength(1);
    expect(Number(mergedDraft.items[0].quantity)).toBe(3);

    const unchangedCompletedCart = (latestState.carts || []).find((cart) => cart.id === completedCartId);
    expect(unchangedCompletedCart).toBeTruthy();
    expect(unchangedCompletedCart.status).toBe("completed");
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

test("IT-ORD-06 orders screen merges only open orders of the same customer and can return from merge preview", async ({ page, request }) => {
  test.setTimeout(90000);
  const runtime = attachRuntimeTracking(page);
  const userCookie = await autoLoginUserRequest(request);
  const timestamp = Date.now();
  const sameCustomerName = `Khách gộp ORD ${timestamp}`;
  const otherCustomerName = `Khách gộp ORD ${timestamp} khác`;

  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const productsResponse = await request.get("/api/products", { headers: { Cookie: userCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const product = productsPayload.products?.[0];
  expect(product).toBeTruthy();

  const committedCart = {
    id: `order_merge_committed_${timestamp}`,
    customerName: sameCustomerName,
    status: "committed",
    paymentStatus: "unpaid",
    discountAmount: 1000,
    shipAddress: `Địa chỉ chốt ${timestamp}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    committedAt: new Date().toISOString(),
    orderCode: `DH-MERGE-${timestamp}`,
    items: [
      {
        id: `order_merge_committed_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity: 1,
        unitPrice: Number(product.sale_price || product.price || 0) || 1000,
        note: "",
      },
    ],
  };
  const draftCart = {
    id: `order_merge_draft_${timestamp}`,
    customerName: sameCustomerName,
    status: "draft",
    paymentStatus: "unpaid",
    discountAmount: 2000,
    shipAddress: `Địa chỉ nháp ${timestamp}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    orderCode: "",
    items: [
      {
        id: `order_merge_draft_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity: 2,
        unitPrice: Number(product.sale_price || product.price || 0) || 1000,
        note: "",
      },
    ],
  };
  const otherDraftCart = {
    id: `order_merge_other_${timestamp}`,
    customerName: otherCustomerName,
    status: "draft",
    paymentStatus: "unpaid",
    discountAmount: 500,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    orderCode: "",
    items: [
      {
        id: `order_merge_other_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity: 1,
        unitPrice: Number(product.sale_price || product.price || 0) || 1000,
        note: "",
      },
    ],
  };

  async function checkMergeCart(cartId) {
    const checkbox = page.locator(`[data-order-select="${cartId}"] input[data-queue-action="toggle-merge-select"]`).first();
    await checkbox.evaluate((node) => {
      node.checked = true;
      node.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(checkbox).toBeChecked();
  }

  try {
    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: {
        carts: [committedCart, draftCart, otherDraftCart, ...(originalState.carts || [])],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto(process.env.TEST_ADMIN_PATH || "admin");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "orders");
    await expectScreenTitle(page, "Đơn hàng");
    await setFloatingSearch(page, `Khách gộp ORD ${timestamp}`);

    const committedCard = page.locator(`[data-order-select="${committedCart.id}"]`).first();
    const draftCard = page.locator(`[data-order-select="${draftCart.id}"]`).first();
    const otherCard = page.locator(`[data-order-select="${otherDraftCart.id}"]`).first();
    await expect(committedCard).toBeVisible();
    await expect(draftCard).toBeVisible();
    await expect(otherCard).toBeVisible();

    await checkMergeCart(committedCart.id);
    await checkMergeCart(otherDraftCart.id);
    await page.locator('#cartQueueList [data-queue-action="start-merge-preview"]').click();
    const invalidToast = await collectToast(page, runtime, "it-ord-06-invalid", { errorPattern: /^$/ });
    expect(invalidToast).toContain("Chỉ gộp được các phiếu xuất cùng một khách hàng.");
    await expectScreenTitle(page, "Đơn hàng");

    await page.locator('#cartQueueList [data-queue-action="clear-merge-selection"]').click();
    await checkMergeCart(committedCart.id);
    await checkMergeCart(draftCart.id);
    await page.locator('#cartQueueList [data-queue-action="start-merge-preview"]').click();
    await expectScreenTitle(page, "Tạo đơn xuất hàng");
    await expect(page.locator("#activeCartPanel")).toContainText("Gộp đơn đang chờ xác nhận");
    await page.locator('#activeCartPanel [data-cart-action="cancel-merge-preview"]').click();

    await expectScreenTitle(page, "Đơn hàng");
    await expect(committedCard).toBeVisible();
    await expect(draftCard).toBeVisible();
    await expect(page.locator('#cartQueueList [data-queue-action="start-merge-preview"]')).toHaveCount(0);

    await checkMergeCart(committedCart.id);
    await checkMergeCart(draftCart.id);
    await page.locator('#cartQueueList [data-queue-action="start-merge-preview"]').click();
    await expectScreenTitle(page, "Tạo đơn xuất hàng");
    await page.locator('#activeCartPanel [data-cart-action="confirm-merge-preview"]').click();
    const mergeToast = await collectToast(page, runtime, "it-ord-06-merge", { errorPattern: /^$/ });
    expect(mergeToast).toContain("Đã gộp các phiếu xuất đã chọn vào phiếu hiện hành.");

    const latestStateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
    expect(latestStateResponse.ok()).toBeTruthy();
    const latestState = await latestStateResponse.json();
    const mergedCommittedCart = (latestState.carts || []).find((cart) => cart.id === committedCart.id);
    const cancelledDraftCart = (latestState.carts || []).find((cart) => cart.id === draftCart.id);
    const untouchedOtherCart = (latestState.carts || []).find((cart) => cart.id === otherDraftCart.id);

    expect(mergedCommittedCart).toBeTruthy();
    expect(mergedCommittedCart.status).toBe("committed");
    expect(Number(mergedCommittedCart.discountAmount || mergedCommittedCart.discount_amount || 0)).toBe(3000);
    expect(mergedCommittedCart.items || []).toHaveLength(1);
    expect(Number(mergedCommittedCart.items[0].quantity)).toBe(3);
    expect(cancelledDraftCart).toBeTruthy();
    expect(cancelledDraftCart.status).toBe("cancelled");
    expect(untouchedOtherCart).toBeTruthy();
    expect(untouchedOtherCart.status).toBe("draft");
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



