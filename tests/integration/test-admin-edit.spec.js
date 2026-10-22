const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginAdmin,
  autoLoginAdminRequest,
  collectToast,
  expectNoRuntimeErrors,
  expectScreenTitle,
  openAdminPage,
  switchMenu,
} = require("./support/ui");

async function createQuickPurchase(request, cookie, payload) {
  const response = await request.post("./api/purchases/quick-create", {
    headers: { Cookie: cookie },
    data: payload,
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function createQuickSale(request, cookie, payload) {
  const response = await request.post("./api/orders/quick-create", {
    headers: { Cookie: cookie },
    data: payload,
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test("IT-ADM-EDIT-01 Master Admin can edit locked received purchase and locked completed sale", async ({ page, request }) => {
  test.setTimeout(120000);
  const runtime = attachRuntimeTracking(page, { autoAcceptDialogs: false });
  const adminEditConfirmations = [];

  // Handle prompt dialogs
  page.on("dialog", async (dialog) => {
    console.log("Dialog opened:", dialog.type(), dialog.message());
    if (dialog.type() === "prompt") {
      await dialog.accept("Sua do Master Admin dieu chinh ly do");
    } else {
      if (dialog.type() === "confirm") adminEditConfirmations.push(dialog.message());
      await dialog.accept();
    }
  });

  const adminCookie = await autoLoginAdminRequest(request);
  const stateRes = await request.get("./api/state", { headers: { Cookie: adminCookie } });
  const originalState = await stateRes.json();
  const timestamp = Date.now();
  const product = originalState.products[0];
  const orderCustomerName = `Khách Test Admin Edit ${timestamp}`;
  const unitCost = Number(product.price || 0) || 10000;
  const unitPrice = Number(product.sale_price || product.price || 0) || 20000;
  const receivedPurchasePayload = await createQuickPurchase(request, adminCookie, {
    supplier_name: `NCC Test Admin Edit ${timestamp}`,
    document_date: "2026-06-06",
    items: [{ product_id: product.id, quantity: 5, unit_cost: unitCost }],
    final_status: "received",
    mark_paid: false,
  });
  const purchaseId = receivedPurchasePayload.purchase.id;
  const completedSalePayload = await createQuickSale(request, adminCookie, {
    customer_name: orderCustomerName,
    document_date: "2026-06-06",
    items: [{ product_id: product.id, quantity: 2, unit_price: unitPrice }],
    final_status: "completed",
    mark_paid: false,
  });
  const cartId = completedSalePayload.cart.id;

  await openAdminPage(page);
  await autoLoginAdmin(page, request);
  await page.reload({ waitUntil: "networkidle" });

  // 1. TEST PURCHASES ADMIN EDIT
  await switchMenu(page, "purchases");
  await expectScreenTitle(page, "Nhập hàng");

  // If the app auto-opened an existing draft (because of staging data), go back to the list
  const purchasesListBtn = page.locator('[data-screen="purchases"] button').filter({ hasText: "Danh sách phiếu" });
  if (await purchasesListBtn.isVisible()) {
    await purchasesListBtn.click();
    await page.waitForTimeout(500);
  }

  // Check if admin edit button exists on the received purchase in list
  const purchaseCard = page.locator(`[data-purchase-select="${purchaseId}"]`);
  await expect(purchaseCard).toBeVisible({ timeout: 10000 });
  const adminEditBtn = purchaseCard.locator('[data-purchase-list-action="admin-edit"]');
  await expect(adminEditBtn).toBeVisible({ timeout: 10000 });
  console.log("Found admin-edit button on received purchase!");

  // Click Sửa Admin
  await adminEditBtn.click();
  await page.waitForTimeout(1000);

  // Check if active purchase panel opened the purchase
  const adminBypassSaveBtn = page.locator('[data-purchase-action="admin-bypass-save"]');
  await expect(adminBypassSaveBtn).toBeVisible({ timeout: 10000 });
  console.log("SUCCESS: Active purchase panel opened with admin-bypass-save button!");

  // Modify note and save
  const purchaseNote = page.locator("#purchaseNoteInput");
  await expect(purchaseNote).toBeVisible();
  const updatedPurchaseNote = "Updated note by admin test " + timestamp;
  await purchaseNote.fill(updatedPurchaseNote);
  await purchaseNote.press("Tab");
  await expect(page.getByText("Chế độ Master Admin sửa phiếu đã nhận")).toBeVisible();
  await expect(adminBypassSaveBtn).toBeEnabled();

  const purchaseEditResponsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/admin/purchases/edit-locked") && response.request().method() === "POST",
    { timeout: 15000 }
  );
  const purchaseConfirmDialog = page.waitForEvent("dialog", { timeout: 10000 });
  await adminBypassSaveBtn.click({ timeout: 10000 });
  await purchaseConfirmDialog;
  const purchaseEditResponse = await purchaseEditResponsePromise;
  expect(purchaseEditResponse.ok()).toBeTruthy();
  const toastText = await collectToast(page, runtime, "save-admin-purchase");
  console.log("Toast received after save:", toastText);
  const savedPurchaseState = await (await request.get("./api/state", { headers: { Cookie: adminCookie } })).json();
  expect(savedPurchaseState.purchases.find((purchase) => purchase.id === purchaseId)?.note).toBe(updatedPurchaseNote);

  // 2. TEST SALES ADMIN EDIT
  await switchMenu(page, "orders");
  await expectScreenTitle(page, "Đơn hàng");

  // The quick-create API creates a real completed receipt with ledger data for the admin-edit endpoint.
  const showArchivedCheckbox = page.locator("#showArchivedCarts");
  await showArchivedCheckbox.check();
  await page.waitForTimeout(500);

  const completedOrderCard = page.locator(".cart-queue-item", { hasText: orderCustomerName }).first();
  await expect(completedOrderCard).toBeVisible({ timeout: 10000 });

  // Click to open detail
  await completedOrderCard.click();
  await page.waitForTimeout(500);

  const adminEditSaleBtn = page.locator('[data-order-detail-action="admin-edit"]').first();
  await expect(adminEditSaleBtn).toBeVisible({ timeout: 10000 });
  console.log("Found admin-edit button in order detail!");

  await adminEditSaleBtn.click();
  await page.waitForTimeout(1000);

  // Should switch to Bán hàng / Tạo đơn xuất hàng screen
  await expectScreenTitle(page, "Tạo đơn xuất hàng");
  const cartAdminBypassSaveBtn = page.locator('[data-cart-action="admin-bypass-save"]');
  await expect(cartAdminBypassSaveBtn).toBeVisible({ timeout: 10000 });
  console.log("SUCCESS: Active cart panel opened with admin-bypass-save button!");

  // Modify note or items and save
  const saleDetailToggle = page.locator('[data-cart-action="toggle-detail"]').first();
  if (await saleDetailToggle.isVisible()) {
    await saleDetailToggle.click();
  }
  const saleNote = page.locator("#activeCartPanel [data-cart-note-input]");
  const updatedSaleNote = "Updated sale note by admin " + timestamp;
  await expect(saleNote).toBeVisible();
  await saleNote.fill(updatedSaleNote);
  await page.locator('[data-cart-action="save-note"]').click();

  // Save admin bypass cart
  const saleEditResponsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/admin/orders/edit-locked") && response.request().method() === "POST",
    { timeout: 15000 }
  );
  const saleConfirmDialog = page.waitForEvent("dialog", { timeout: 10000 });
  await cartAdminBypassSaveBtn.click({ timeout: 10000 });
  await saleConfirmDialog;
  const saleEditResponse = await saleEditResponsePromise;
  expect(saleEditResponse.ok()).toBeTruthy();
  const saleToast = await collectToast(page, runtime, "save-admin-sale");
  console.log("Sale toast received after save:", saleToast);
  const savedSaleState = await (await request.get("./api/state", { headers: { Cookie: adminCookie } })).json();
  expect(savedSaleState.carts.find((cart) => cart.id === cartId)?.note).toBe(updatedSaleNote);

  expect(adminEditConfirmations.some((message) => message.includes("Phiếu này đã nhập kho") && message.includes("Master Admin"))).toBeTruthy();
  expect(adminEditConfirmations.some((message) => message.includes("Đơn này đã xuất hàng") && message.includes("Master Admin"))).toBeTruthy();

  expectNoRuntimeErrors(runtime);
});



