const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginAdmin,
  autoLoginAdminRequest,
  collectToast,
  expectNoRuntimeErrors,
  expectScreenTitle,
  switchMenu,
} = require("./support/ui");

test("ADMIN-EDIT-FULL Master Admin can edit locked received purchase and locked completed sale", async ({ page, request }) => {
  test.setTimeout(120000);
  const runtime = attachRuntimeTracking(page, { autoAcceptDialogs: false });

  // Handle prompt dialogs
  page.on("dialog", async (dialog) => {
    console.log("Dialog opened:", dialog.type(), dialog.message());
    if (dialog.type() === "prompt") {
      await dialog.accept("Sua do Master Admin dieu chinh ly do");
    } else {
      await dialog.accept();
    }
  });

  const adminCookie = await autoLoginAdminRequest(request);
  const stateRes = await request.get("./api/state", { headers: { Cookie: adminCookie } });
  const originalState = await stateRes.json();
  const timestamp = Date.now();
  const product = originalState.products[0];
  const orderCustomerName = `Khách Test Admin Edit ${timestamp}`;

  const purchaseId = `purchase_rec_${timestamp}`;
  const receivedPurchase = {
    id: purchaseId,
    supplierName: "NCC Test Admin Edit",
    note: "Ghi chú phiếu nhập nhận hàng",
    status: "received",
    discountAmount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    receiptCode: `PN-REC-${timestamp}`,
    items: [
      {
        id: `purchase_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        unit: product.unit || "Cái",
        quantity: 5,
        unitCost: Number(product.price || 0) || 10000,
        batchCode: `LO-${timestamp}`,
        expiryInputMode: "direct",
        expiryDate: "2026-12-31",
        manufactureDate: "",
      },
    ],
  };

  const cartId = `cart_comm_${timestamp}`;
  const orderCode = `DH-COMM-${timestamp}`;
  const committedCart = {
    id: cartId,
    customerId: originalState.customers[0]?.id || "cust_1",
    customerName: orderCustomerName,
    status: "committed",
    paymentStatus: "unpaid",
    note: "Đơn committed chuẩn bị xuất hàng",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    committedAt: new Date().toISOString(),
    orderCode: orderCode,
    items: [
      {
        id: `cart_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        quantity: 2,
        unitPrice: 20000,
        lineTotal: 40000,
        unit: product.unit || "Cái",
      },
    ],
  };

  const seedResponse = await request.put("./api/state", {
    headers: { Cookie: adminCookie },
    data: {
      customers: originalState.customers,
      suppliers: originalState.suppliers,
      carts: [committedCart, ...(originalState.carts || [])],
      purchases: [receivedPurchase, ...(originalState.purchases || [])],
    },
  });
  expect(seedResponse.ok()).toBeTruthy();

  await page.goto(process.env.TEST_ADMIN_PATH || "admin");
  await page.waitForLoadState("networkidle");
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
  await purchaseNote.fill("Updated note by admin test " + timestamp);

  await adminBypassSaveBtn.click();
  await page.waitForTimeout(1000);
  const toastText = await collectToast(page, runtime, "save-admin-purchase");
  console.log("Toast received after save:", toastText);

  // 2. TEST SALES ADMIN EDIT
  await switchMenu(page, "orders");
  await expectScreenTitle(page, "Đơn hàng");

  // Find the committed order card and click to select it
  const committedOrderCard = page.locator(".cart-queue-item", { hasText: orderCustomerName }).first();
  await expect(committedOrderCard).toBeVisible({ timeout: 10000 });
  await committedOrderCard.click();
  await page.waitForTimeout(500);

  const shipBtn = page.locator('[data-order-detail-action="ship"]').first();
  await expect(shipBtn).toBeVisible({ timeout: 10000 });
  await shipBtn.click();
  await page.waitForTimeout(1000);
  const shipToast = await collectToast(page, runtime, "ship-order");
  console.log("Ship toast:", shipToast);

  // Check showArchivedCarts to show completed orders
  const showArchivedCheckbox = page.locator("#showArchivedCarts");
  await showArchivedCheckbox.check();
  await page.waitForTimeout(500);

  // Find the now completed order card
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
  const saleNote = page.locator("#noteInput");
  if (await saleNote.isVisible()) {
    await saleNote.fill("Updated sale note by admin " + timestamp);
  }

  // Save admin bypass cart
  await cartAdminBypassSaveBtn.click();
  await page.waitForTimeout(1000);
  const saleToast = await collectToast(page, runtime, "save-admin-sale");
  console.log("Sale toast received after save:", saleToast);

  expectNoRuntimeErrors(runtime);
});



