const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginProcurementManager,
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

async function captureDialog(page, trigger, { value = undefined, accept = true } = {}) {
  const dialogPromise = page.waitForEvent("dialog").then(async (dialog) => {
    const payload = {
      type: dialog.type(),
      message: dialog.message(),
    };
    if (accept) {
      await dialog.accept(value);
    } else {
      await dialog.dismiss();
    }
    return payload;
  });
  await trigger();
  return dialogPromise;
}

async function fetchSyncState(request, cookie) {
  const response = await request.get("/api/state?transaction_limit=24", { headers: { Cookie: cookie } });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function fetchProducts(request, cookie) {
  const response = await request.get("/api/products", { headers: { Cookie: cookie } });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  return payload.products || [];
}

async function createQuickPurchase(request, cookie, payload) {
  const response = await request.post("/api/purchases/quick-create", {
    headers: { Cookie: cookie },
    data: payload,
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function createQuickSale(request, cookie, payload) {
  const response = await request.post("/api/orders/quick-create", {
    headers: { Cookie: cookie },
    data: payload,
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test("ACC-CANCEL-01 user can request cancel and manager can approve for completed order and received purchase", async ({ browser, page, request }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  const runtime = attachRuntimeTracking(page, { autoAcceptDialogs: false });
  const userCookie = await autoLoginUserRequest(request);
  const products = await fetchProducts(request, userCookie);
  const product = products[0];
  expect(product).toBeTruthy();
  const initialStock = Number(product.current_stock || 0);

  const timestamp = Date.now();
  const customerName = `Khách hủy duyệt ${timestamp}`;
  const saleSupplierName = `NCC cấp hàng hủy đơn ${timestamp}`;
  const purchaseSupplierName = `NCC hủy phiếu nhập ${timestamp}`;
  const orderReason = "Nhập nhầm đơn đã xuất cuối ngày";
  const purchaseReason = "Nhập nhầm phiếu đã nhập kho cuối ngày";

  const stockPurchase = await createQuickPurchase(request, userCookie, {
    supplier_name: saleSupplierName,
    document_date: "2026-06-06",
    items: [{ product_id: product.id, quantity: 6, unit_cost: Number(product.price || 0) || 1000 }],
    final_status: "received",
    mark_paid: false,
  });
  expect(stockPurchase.purchase.status).toBe("received");

  const salePayload = await createQuickSale(request, userCookie, {
    customer_name: customerName,
    document_date: "2026-06-06",
    items: [{ product_id: product.id, quantity: 2, unit_price: Number(product.sale_price || product.price || 0) || 1000 }],
    final_status: "completed",
    mark_paid: false,
  });
  expect(salePayload.cart.status).toBe("completed");

  const purchasePayload = await createQuickPurchase(request, userCookie, {
    supplier_name: purchaseSupplierName,
    document_date: "2026-06-06",
    items: [{ product_id: product.id, quantity: 3, unit_cost: Number(product.price || 0) || 1000 }],
    final_status: "received",
    mark_paid: false,
  });
  expect(purchasePayload.purchase.status).toBe("received");

  await page.goto("/admin");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });

  await switchMenu(page, "orders");
  await expectScreenTitle(page, "Đơn hàng");
  await page.locator("#showArchivedCarts").check();
  await page.waitForTimeout(300);
  await setFloatingSearch(page, customerName);
  const orderCard = page.locator(".cart-queue-item", { hasText: customerName }).first();
  await orderCard.locator('[data-queue-action="toggle-detail"]').click();
  const orderPrompt = await captureDialog(page, async () => {
    await page.locator('[data-order-detail-action="request-cancel"]').click();
  }, { value: orderReason });
  expect(orderPrompt.type).toBe("prompt");
  expect(orderPrompt.message).toContain("Yêu cầu hủy");
  const orderToast = await collectToast(page, runtime, "acc-cancel-01-order-request", { errorPattern: /^$/ });
  expect(orderToast).toMatch(/yêu cầu hủy|mail thông báo/i);
  await expect(page.locator("#orderDetailPanel")).toContainText("Yêu cầu hủy chờ duyệt");

  await switchMenu(page, "purchases");
  await expectScreenTitle(page, "Nhập hàng");
  await setFloatingSearch(page, purchaseSupplierName);
  const purchaseCard = page.locator(".cart-queue-item", { hasText: purchaseSupplierName }).first();
  await purchaseCard.locator('[data-purchase-list-action="open"]').click();
  const purchasePrompt = await captureDialog(page, async () => {
    await page.locator('[data-purchase-action="request-cancel"]').click();
  }, { value: purchaseReason });
  expect(purchasePrompt.type).toBe("prompt");
  expect(purchasePrompt.message).toContain("Yêu cầu hủy");
  const purchaseToast = await collectToast(page, runtime, "acc-cancel-01-purchase-request", { errorPattern: /^$/ });
  expect(purchaseToast).toMatch(/yêu cầu hủy|mail thông báo/i);
  await expect(page.locator("#purchasePanel")).toContainText("Yêu cầu hủy chờ duyệt");

  const managerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const managerPage = await managerContext.newPage();
  const managerRuntime = attachRuntimeTracking(managerPage, { autoAcceptDialogs: false });
  try {
    await managerPage.goto("/admin");
    await managerPage.waitForLoadState("networkidle");
    await autoLoginProcurementManager(managerPage, request);
    await managerPage.reload({ waitUntil: "networkidle" });

    await expect(managerPage.locator('[data-menu="orders"]')).toContainText("1 hủy chờ duyệt");
    await expect(managerPage.locator('[data-menu="purchases"]')).toContainText("1 hủy chờ duyệt");

    await switchMenu(managerPage, "orders");
    await expectScreenTitle(managerPage, "Đơn hàng");
    await managerPage.locator("#showArchivedCarts").check();
    await managerPage.waitForTimeout(300);
    await setFloatingSearch(managerPage, customerName);
    const managerOrderCard = managerPage.locator(".cart-queue-item", { hasText: customerName }).first();
    await managerOrderCard.locator('[data-queue-action="toggle-detail"]').click();
    const approveOrderDialog = await captureDialog(managerPage, async () => {
      await managerPage.locator('[data-order-detail-action="approve-cancel-request"]').click();
    });
    expect(approveOrderDialog.type).toBe("confirm");
    expect(approveOrderDialog.message).toContain("Duyệt hủy");
    const approveOrderToast = await collectToast(managerPage, managerRuntime, "acc-cancel-01-order-approve", { errorPattern: /^$/ });
    expect(approveOrderToast).toContain("Đã duyệt");

    await switchMenu(managerPage, "purchases");
    await expectScreenTitle(managerPage, "Nhập hàng");
    await setFloatingSearch(managerPage, purchaseSupplierName);
    const managerPurchaseCard = managerPage.locator(".cart-queue-item", { hasText: purchaseSupplierName }).first();
    await managerPurchaseCard.locator('[data-purchase-list-action="open"]').click();
    const approvePurchaseDialog = await captureDialog(managerPage, async () => {
      await managerPage.locator('[data-purchase-action="approve-cancel-request"]').click();
    });
    expect(approvePurchaseDialog.type).toBe("confirm");
    expect(approvePurchaseDialog.message).toContain("Duyệt hủy");
    const approvePurchaseToast = await collectToast(managerPage, managerRuntime, "acc-cancel-01-purchase-approve", { errorPattern: /^$/ });
    expect(approvePurchaseToast).toContain("Đã duyệt");

    const latestState = await fetchSyncState(request, userCookie);
    expect((latestState.carts || []).some((cart) => cart.id === salePayload.cart.id && cart.status === "cancelled")).toBeTruthy();
    expect((latestState.purchases || []).some((purchase) => purchase.id === purchasePayload.purchase.id && purchase.status === "cancelled")).toBeTruthy();
    expect((latestState.document_cancel_requests || []).filter((entry) => entry.status === "pending_approval")).toHaveLength(0);

    const latestProducts = await fetchProducts(request, userCookie);
    const finalProduct = latestProducts.find((entry) => entry.id === product.id);
    expect(finalProduct).toBeTruthy();
    expect(Number(finalProduct.current_stock || 0)).toBe(initialStock + 6);
  } finally {
    await managerContext.close();
  }

  expectNoRuntimeErrors(runtime);
  expectNoRuntimeErrors(managerRuntime);
});



