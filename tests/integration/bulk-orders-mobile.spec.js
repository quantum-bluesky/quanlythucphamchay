const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginAdmin,
  autoLoginAdminRequest,
  autoLoginProcurementManager,
  autoLoginUser,
  collectToast,
  expectNoRuntimeErrors,
  expectScreenTitle,
  switchMenu,
} = require("./support/ui");

async function addBulkOrderItem(page, customerName, productName, quantity) {
  const card = page.locator("#bulkOrderList .bulk-order-card").filter({ hasText: customerName }).first();
  await expect(card).toBeVisible();
  await card.locator('[data-bulk-order-action="open-item-picker"]').click();
  await expect(page.locator("#bulkItemPickerModal")).toBeVisible();
  await page.locator("#bulkItemPickerSearchInput").fill(productName);

  const productRow = page.locator("#bulkItemPickerList .sales-product-row").filter({ hasText: productName }).first();
  await expect(productRow).toBeVisible();
  await productRow.locator('input[data-bulk-picker-qty]').fill(String(quantity));
  await productRow.locator('[data-bulk-picker-action="add-item"]').click();
  await expect(card).toContainText(productName);
  await page.locator("#bulkItemPickerCloseButton").click();
  await expect(page.locator("#bulkItemPickerModal")).toBeHidden();
}

async function expectActiveBulkField(page, expectedEntryId, expectedField, expectedItemId = "") {
  await expect.poll(async () => page.evaluate(() => {
    const active = document.activeElement;
    if (!active) {
      return null;
    }
    return {
      entryId: active.dataset?.entryId || "",
      field: active.dataset?.bulkOrderField || active.dataset?.bulkOrderItemField || "",
      itemId: active.dataset?.itemId || "",
    };
  })).toEqual({
    entryId: expectedEntryId,
    field: expectedField,
    itemId: expectedItemId,
  });
}

test("ACC-ORD-17 bulk orders mobile keeps card UI and only commits valid customers", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const runtime = attachRuntimeTracking(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await autoLoginAdmin(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await collectToast(page, runtime, "admin-login");
  const adminCookie = await autoLoginAdminRequest(request);

  await switchMenu(page, "bulk-orders");
  await expectScreenTitle(page, "Tạo nhiều đơn");
  await expect(page.locator("#bulkOrderPermissionNotice")).toBeHidden();
  await expect(page.locator(".bulk-order-footer-actions button")).toHaveCount(2);

  await page.locator("#bulkCustomerLookupInput").fill("Khách bulk A");
  await page.locator("#bulkAddCustomerButton").click();
  await addBulkOrderItem(page, "Khách bulk A", "Chả quế chay", 1);
  const firstBulkCard = page.locator("#bulkOrderList .bulk-order-card").filter({ hasText: "Khách bulk A" }).first();
  const firstEntryId = await firstBulkCard.getAttribute("data-entry-id");
  expect(firstEntryId).toBeTruthy();
  const quantityInput = firstBulkCard.locator('[data-bulk-order-item-field="quantity"]').first();
  const quantityItemId = await quantityInput.getAttribute("data-item-id");
  expect(quantityItemId).toBeTruthy();
  await quantityInput.click();
  await quantityInput.press("ControlOrMeta+A");
  await quantityInput.type("2");
  await expect(quantityInput).toHaveValue("2");
  await expectActiveBulkField(page, firstEntryId, "quantity", quantityItemId);

  const unitPriceInput = firstBulkCard.locator('[data-bulk-order-item-field="unit-price"]').first();
  const unitPriceItemId = await unitPriceInput.getAttribute("data-item-id");
  expect(unitPriceItemId).toBeTruthy();
  await unitPriceInput.click();
  await unitPriceInput.press("ControlOrMeta+A");
  await unitPriceInput.type("56000");
  await expect(unitPriceInput).toHaveValue("56000");
  await expectActiveBulkField(page, firstEntryId, "unit-price", unitPriceItemId);

  const shipAddressInput = firstBulkCard.locator('[data-bulk-order-field="ship-address"]');
  await shipAddressInput.click();
  await shipAddressInput.press("ControlOrMeta+A");
  await shipAddressInput.type("Dia chi bulk mobile");
  await expect(shipAddressInput).toHaveValue("Dia chi bulk mobile");
  await expectActiveBulkField(page, firstEntryId, "ship-address");

  const discountInput = firstBulkCard.locator('[data-bulk-order-field="discount-amount"]');
  await discountInput.click();
  await discountInput.press("ControlOrMeta+A");
  await discountInput.type("5000");
  await expect(discountInput).toHaveValue("5000");
  await expectActiveBulkField(page, firstEntryId, "discount-amount");

  await page.locator("#bulkOrderSaveDraftButton").click();
  await expect(page.locator("#bulkOrderResultSummary")).toBeVisible();
  await expect(page.locator("#bulkOrderResultSummary")).toContainText("1 thành công / 0 lỗi");
  await expect(page.locator("#bulkOrderList .bulk-order-card")).toHaveCount(1);
  const savedDraftCard = page.locator("#bulkOrderList .bulk-order-card").filter({ hasText: "Khách bulk A" }).first();
  await expect(savedDraftCard).toContainText("Đã lưu nháp");

  const afterDraftStateResponse = await request.get("/api/state?transaction_limit=16", {
    headers: { Cookie: adminCookie },
  });
  expect(afterDraftStateResponse.ok()).toBeTruthy();
  const afterDraftState = await afterDraftStateResponse.json();
  const draftCartsForCustomerA = (afterDraftState.carts || []).filter((cart) => cart.customerName === "Khách bulk A");
  expect(draftCartsForCustomerA).toHaveLength(1);
  const draftCartId = draftCartsForCustomerA[0].id;
  expect(draftCartsForCustomerA[0].status).toBe("draft");
  expect(draftCartsForCustomerA[0].shipAddress).toBe("Dia chi bulk mobile");
  expect(Number(draftCartsForCustomerA[0].discountAmount || 0)).toBe(5000);
  expect(Number(draftCartsForCustomerA[0].items?.[0]?.quantity || 0)).toBe(2);
  expect(Number(draftCartsForCustomerA[0].items?.[0]?.unitPrice || 0)).toBe(56000);

  const draftQuantityInput = savedDraftCard.locator('[data-bulk-order-item-field="quantity"]').first();
  const draftItemId = await draftQuantityInput.getAttribute("data-item-id");
  expect(draftItemId).toBeTruthy();
  await draftQuantityInput.click();
  await draftQuantityInput.press("ControlOrMeta+A");
  await draftQuantityInput.type("3");
  await expect(draftQuantityInput).toHaveValue("3");
  await expectActiveBulkField(page, firstEntryId, "quantity", draftItemId);

  await page.locator("#bulkCustomerLookupInput").fill("Khách bulk B");
  await page.locator("#bulkAddCustomerButton").click();
  await addBulkOrderItem(page, "Khách bulk B", "Bò lát xào", 1);

  await page.locator("#bulkOrderCommitValidButton").click();
  await expect(page.locator("#bulkOrderResultSummary")).toBeVisible();
  await expect(page.locator("#bulkOrderResultSummary")).toContainText("1 thành công / 1 lỗi");
  await expect(page.locator("#bulkOrderResultSummary")).toContainText("Khách bulk A");
  await expect(page.locator("#bulkOrderResultSummary")).toContainText("Khách bulk B");
  await expect(page.locator("#bulkOrderResultSummary")).toContainText("Thiếu Bò lát xào");

  await expect(page.locator("#bulkOrderList .bulk-order-card")).toHaveCount(2);
  await expect(page.locator("#bulkOrderList")).toContainText("Khách bulk B");
  await expect(page.locator("#bulkOrderList")).toContainText("Khách bulk A");
  await expect(page.locator("#bulkOrderList")).toContainText("Thiếu Bò lát xào");
  const successCard = page.locator("#bulkOrderList .bulk-order-card").filter({ hasText: "Khách bulk A" }).first();
  await expect(successCard).toContainText("Đã chốt");
  await successCard.locator('[data-bulk-order-action="toggle-detail"]').click();
  const successQuantityInput = successCard.locator('[data-bulk-order-item-field="quantity"]').first();
  const successItemId = await successQuantityInput.getAttribute("data-item-id");
  expect(successItemId).toBeTruthy();
  await successQuantityInput.click();
  await successQuantityInput.press("ControlOrMeta+A");
  await successQuantityInput.type("4");
  await expect(successQuantityInput).toHaveValue("4");
  await expectActiveBulkField(page, firstEntryId, "quantity", successItemId);

  await page.locator("#bulkOrderCommitValidButton").click();
  await expect(page.locator("#bulkOrderResultSummary")).toContainText("1 thành công / 1 lỗi");
  await expect(successCard).toContainText("Đã chốt");

  const latestStateResponse = await request.get("/api/state?transaction_limit=16", {
    headers: { Cookie: adminCookie },
  });
  expect(latestStateResponse.ok()).toBeTruthy();
  const latestState = await latestStateResponse.json();
  const cartsForCustomerA = (latestState.carts || []).filter((cart) => cart.customerName === "Khách bulk A");
  expect(cartsForCustomerA).toHaveLength(1);
  expect(cartsForCustomerA[0].id).toBe(draftCartId);
  expect(cartsForCustomerA[0].status).toBe("committed");
  expect(cartsForCustomerA[0].shipAddress).toBe("Dia chi bulk mobile");
  expect(Number(cartsForCustomerA[0].discountAmount || 0)).toBe(5000);
  expect(Number(cartsForCustomerA[0].items?.[0]?.quantity || 0)).toBe(4);
  expect(Number(cartsForCustomerA[0].items?.[0]?.unitPrice || 0)).toBe(56000);

  await expect(page.locator('#bulkOrderResultSummary [data-bulk-order-action="open-shortage-purchases"]')).toBeVisible();
  await page.locator('#bulkOrderResultSummary [data-bulk-order-action="open-shortage-purchases"]').click();
  await expectScreenTitle(page, "Nhập hàng");
  await expect(page.locator("#purchasePanel")).toContainText("Bò lát xào");

  expectNoRuntimeErrors(runtime);
});

test("ACC-ORD-18 bulk order approval requests stay visible across users and owner can process after approval", async ({ browser, page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const runtime = attachRuntimeTracking(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await collectToast(page, runtime, "user-login");

  await switchMenu(page, "bulk-orders");
  await expectScreenTitle(page, "Tạo nhiều đơn");
  await expect(page.locator("#bulkOrderPermissionNotice")).toContainText("chờ duyệt");
  await expect(page.locator("#bulkOrderCommitValidButton")).toHaveText("Gửi duyệt chốt đơn");

  await page.locator("#bulkCustomerLookupInput").fill("Khách duyệt xuất nhanh");
  await page.locator("#bulkAddCustomerButton").click();
  await addBulkOrderItem(page, "Khách duyệt xuất nhanh", "Chả quế chay", 1);

  await page.locator("#bulkOrderCommitValidButton").click();
  await expect(page.locator("#bulkOrderRequestsPanel")).toBeVisible();
  await expect(page.locator("#bulkOrderRequestsPanel")).toContainText("Chờ duyệt");
  const createdRequestCard = page.locator("#bulkOrderRequestsPanel .report-card").filter({ hasText: "Chờ duyệt" }).first();
  const createdRequestCode = ((await createdRequestCard.locator(".report-card-head strong").textContent()) || "").trim();
  await createdRequestCard.locator('[data-bulk-order-action="toggle-request-detail"]').click();
  await expect(page.locator("#bulkOrderRequestsPanel")).toContainText("Khách duyệt xuất nhanh");
  await expect(page.locator("#bulkOrderList")).toContainText("Khách duyệt xuất nhanh");
  await expect(page.locator("#bulkOrderList")).toContainText("Đã tạo yêu cầu chờ duyệt.");

  const managerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const managerPage = await managerContext.newPage();
  const managerRuntime = attachRuntimeTracking(managerPage);
  await managerPage.goto("/");
  await managerPage.waitForLoadState("networkidle");
  await autoLoginProcurementManager(managerPage, request);
  await managerPage.reload({ waitUntil: "networkidle" });
  await collectToast(managerPage, managerRuntime, "manager-login");

  await expect(managerPage.locator('[data-menu="bulk-orders"]')).toContainText("1 chờ duyệt");
  await switchMenu(managerPage, "bulk-orders");
  const managerRequestCard = managerPage.locator("#bulkOrderRequestsPanel .report-card").filter({ hasText: createdRequestCode }).first();
  await managerRequestCard.locator('[data-bulk-order-action="approve-request"]').click();
  const approveToast = await collectToast(managerPage, managerRuntime, "acc-ord-18-approve", { errorPattern: /^$/ });
  expect(approveToast).toContain("approve");

  await page.reload({ waitUntil: "networkidle" });
  await switchMenu(page, "bulk-orders");
  const approvedRequestCard = page.locator("#bulkOrderRequestsPanel .report-card").filter({ hasText: createdRequestCode }).first();
  await expect(approvedRequestCard).toContainText("Đã duyệt");
  await expect(approvedRequestCard.locator('[data-bulk-order-action="process-request"]')).toBeVisible();
  await approvedRequestCard.locator('[data-bulk-order-action="process-request"]').click();
  await expect(page.locator("#bulkOrderRequestsPanel")).toContainText("Đã xử lý");

  await switchMenu(page, "orders");
  await expect(page.locator("#cartQueueList")).toContainText("Khách duyệt xuất nhanh");

  expectNoRuntimeErrors(runtime);
  expectNoRuntimeErrors(managerRuntime);
  await managerContext.close();
});

test("ACC-ORD-19 audit history modal opens from request detail and order detail", async ({ browser, page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const runtime = attachRuntimeTracking(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });

  await switchMenu(page, "bulk-orders");
  await page.locator("#bulkCustomerLookupInput").fill("Khách xem audit");
  await page.locator("#bulkAddCustomerButton").click();
  await addBulkOrderItem(page, "Khách xem audit", "Chả quế chay", 1);
  await page.locator("#bulkOrderCommitValidButton").click();
  const ownerRequestCard = page.locator("#bulkOrderRequestsPanel .report-card").first();
  await ownerRequestCard.locator('[data-bulk-order-action="toggle-request-detail"]').click();
  await expect(ownerRequestCard).toContainText("Khách xem audit");
  const ownerRequestCode = ((await ownerRequestCard.locator(".report-card-head strong").textContent()) || "").trim();

  const managerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const managerPage = await managerContext.newPage();
  const managerRuntime = attachRuntimeTracking(managerPage);
  await managerPage.goto("/");
  await managerPage.waitForLoadState("networkidle");
  await autoLoginProcurementManager(managerPage, request);
  await managerPage.reload({ waitUntil: "networkidle" });
  await switchMenu(managerPage, "bulk-orders");
  const managerRequestCard = managerPage.locator("#bulkOrderRequestsPanel .report-card").filter({ hasText: ownerRequestCode }).first();
  await managerRequestCard.locator('[data-bulk-order-action="approve-request"]').click();

  await page.reload({ waitUntil: "networkidle" });
  await switchMenu(page, "bulk-orders");
  const processedRequestCard = page.locator("#bulkOrderRequestsPanel .report-card").filter({ hasText: ownerRequestCode }).first();
  await processedRequestCard.locator('[data-bulk-order-action="process-request"]').click();
  await processedRequestCard.locator('[data-bulk-order-action="history-request"]').click();
  await expect(page.locator("#auditHistoryModal")).toBeVisible();
  await expect(page.locator("#auditHistoryModalBody")).toContainText("Tạo yêu cầu");
  await expect(page.locator("#auditHistoryModalBody")).toContainText("Approve");
  await expect(page.locator("#auditHistoryModalBody")).toContainText("Xử lý request");
  await page.locator("#closeAuditHistoryButton").click();
  await expect(page.locator("#auditHistoryModal")).toBeHidden();

  await switchMenu(page, "orders");
  const processedOrderCard = page.locator('#cartQueueList .cart-queue-item').first();
  await expect(processedOrderCard).toContainText("Khách xem audit");
  await processedOrderCard.click();
  await page.locator('[data-order-detail-action="history"]').click();
  await expect(page.locator("#auditHistoryModal")).toBeVisible();
  await expect(page.locator("#auditHistoryModalBody")).toContainText("Tạo mới");
  await expect(page.locator("#auditHistoryModalBody")).toContainText("Khách xem audit");

  expectNoRuntimeErrors(runtime);
  expectNoRuntimeErrors(managerRuntime);
  await managerContext.close();
});

test("ACC-ORD-20 pending bulk order request can be deleted by owner or manager", async ({ browser, page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const runtime = attachRuntimeTracking(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });

  await switchMenu(page, "bulk-orders");
  await page.locator("#bulkCustomerLookupInput").fill("Khách xóa request owner");
  await page.locator("#bulkAddCustomerButton").click();
  await addBulkOrderItem(page, "Khách xóa request owner", "Chả quế chay", 1);
  await page.locator("#bulkOrderCommitValidButton").click();
  const ownerPendingRequestCard = page.locator("#bulkOrderRequestsPanel .report-card").first();
  await ownerPendingRequestCard.locator('[data-bulk-order-action="toggle-request-detail"]').click();
  await expect(ownerPendingRequestCard).toContainText("Khách xóa request owner");
  const ownerRequestCode = ((await ownerPendingRequestCard.locator(".report-card-head strong").textContent()) || "").trim();
  await expect(ownerPendingRequestCard.locator('[data-bulk-order-action="delete-request"]')).toBeVisible();
  await ownerPendingRequestCard.locator('[data-bulk-order-action="delete-request"]').click();
  const ownerDeleteToast = await collectToast(page, runtime, "acc-ord-20-owner-delete", { errorPattern: /^$/ });
  expect(ownerDeleteToast).toContain("Đã xóa yêu cầu xuất nhanh");
  await expect(page.locator("#bulkOrderRequestsPanel")).not.toContainText(ownerRequestCode);

  await page.locator("#bulkCustomerLookupInput").fill("Khách xóa request manager");
  await page.locator("#bulkAddCustomerButton").click();
  await addBulkOrderItem(page, "Khách xóa request manager", "Chả quế chay", 1);
  await page.locator("#bulkOrderCommitValidButton").click();
  const managerPendingOwnerView = page.locator("#bulkOrderRequestsPanel .report-card").first();
  await managerPendingOwnerView.locator('[data-bulk-order-action="toggle-request-detail"]').click();
  await expect(managerPendingOwnerView).toContainText("Khách xóa request manager");
  const managerRequestCode = ((await managerPendingOwnerView.locator(".report-card-head strong").textContent()) || "").trim();
  await expect(managerPendingOwnerView.locator('[data-bulk-order-action="delete-request"]')).toBeVisible();

  const managerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const managerPage = await managerContext.newPage();
  const managerRuntime = attachRuntimeTracking(managerPage);
  await managerPage.goto("/");
  await managerPage.waitForLoadState("networkidle");
  await autoLoginProcurementManager(managerPage, request);
  await managerPage.reload({ waitUntil: "networkidle" });

  await switchMenu(managerPage, "bulk-orders");
  const managerPendingRequestCard = managerPage.locator("#bulkOrderRequestsPanel .report-card").filter({ hasText: managerRequestCode }).first();
  await expect(managerPendingRequestCard.locator('[data-bulk-order-action="delete-request"]')).toBeVisible();
  await managerPendingRequestCard.locator('[data-bulk-order-action="delete-request"]').click();
  const managerDeleteToast = await collectToast(managerPage, managerRuntime, "acc-ord-20-manager-delete", { errorPattern: /^$/ });
  expect(managerDeleteToast).toContain("Đã xóa yêu cầu xuất nhanh");
  await expect(managerPage.locator("#bulkOrderRequestsPanel")).not.toContainText(managerRequestCode);

  await page.reload({ waitUntil: "networkidle" });
  await switchMenu(page, "bulk-orders");
  await expect(page.locator("#bulkOrderRequestsPanel")).not.toContainText(managerRequestCode);

  expectNoRuntimeErrors(runtime);
  expectNoRuntimeErrors(managerRuntime);
  await managerContext.close();
});
