const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginAdmin,
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

test("ACC-ORD-17 bulk orders mobile keeps card UI and only commits valid customers", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const runtime = attachRuntimeTracking(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await autoLoginAdmin(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await collectToast(page, runtime, "admin-login");

  await switchMenu(page, "bulk-orders");
  await expectScreenTitle(page, "Tạo nhiều đơn");
  await expect(page.locator("#bulkOrderPermissionNotice")).toBeHidden();
  await expect(page.locator(".bulk-order-footer-actions button")).toHaveCount(2);

  await page.locator("#bulkCustomerLookupInput").fill("Khách bulk A");
  await page.locator("#bulkAddCustomerButton").click();
  await addBulkOrderItem(page, "Khách bulk A", "Chả quế chay", 1);

  await page.locator("#bulkCustomerLookupInput").fill("Khách bulk B");
  await page.locator("#bulkAddCustomerButton").click();
  await addBulkOrderItem(page, "Khách bulk B", "Bò lát xào", 1);

  await page.locator("#bulkOrderCommitValidButton").click();
  await expect(page.locator("#bulkOrderResultSummary")).toBeVisible();
  await expect(page.locator("#bulkOrderResultSummary")).toContainText("1 thành công / 1 lỗi");
  await expect(page.locator("#bulkOrderResultSummary")).toContainText("Khách bulk A");
  await expect(page.locator("#bulkOrderResultSummary")).toContainText("Khách bulk B");
  await expect(page.locator("#bulkOrderResultSummary")).toContainText("Thiếu Bò lát xào");

  await expect(page.locator("#bulkOrderList .bulk-order-card")).toHaveCount(1);
  await expect(page.locator("#bulkOrderList")).toContainText("Khách bulk B");
  await expect(page.locator("#bulkOrderList")).not.toContainText("Khách bulk A");
  await expect(page.locator("#bulkOrderList")).toContainText("Thiếu Bò lát xào");

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
  await expect(page.locator("#bulkOrderList")).toContainText("Chưa có khách nào");

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
  await expect(page.locator("#bulkOrderRequestsPanel")).toContainText("Đã duyệt");
  await expect(page.locator('[data-bulk-order-action="process-request"]')).toBeVisible();
  await page.locator('[data-bulk-order-action="process-request"]').click();
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
  await managerPage.locator('[data-bulk-order-action="approve-request"]').click();

  await page.reload({ waitUntil: "networkidle" });
  await switchMenu(page, "bulk-orders");
  await page.locator('[data-bulk-order-action="process-request"]').first().click();
  await page.locator('[data-bulk-order-action="history-request"]').first().click();
  await expect(page.locator("#auditHistoryModal")).toBeVisible();
  await expect(page.locator("#auditHistoryModalBody")).toContainText("Tạo yêu cầu");
  await expect(page.locator("#auditHistoryModalBody")).toContainText("Approve");
  await expect(page.locator("#auditHistoryModalBody")).toContainText("Xử lý request");
  await page.locator("#closeAuditHistoryButton").click();
  await expect(page.locator("#auditHistoryModal")).toBeHidden();

  await switchMenu(page, "orders");
  await page.locator('#cartQueueList .cart-queue-item').filter({ hasText: "Khách xem audit" }).first().click();
  await page.locator('[data-order-detail-action="history"]').click();
  await expect(page.locator("#auditHistoryModal")).toBeVisible();
  await expect(page.locator("#auditHistoryModalBody")).toContainText("Tạo mới");
  await expect(page.locator("#auditHistoryModalBody")).toContainText("Đổi trạng thái");

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
  const ownerPendingRequestCard = page.locator("#bulkOrderRequestsPanel .report-card").filter({ hasText: "Chờ duyệt" }).first();
  await expect(ownerPendingRequestCard.locator('[data-bulk-order-action="delete-request"]')).toBeVisible();
  await ownerPendingRequestCard.locator('[data-bulk-order-action="delete-request"]').click();
  const ownerDeleteToast = await collectToast(page, runtime, "acc-ord-20-owner-delete", { errorPattern: /^$/ });
  expect(ownerDeleteToast).toContain("Đã xóa yêu cầu xuất nhanh");
  await expect(page.locator('#bulkOrderRequestsPanel [data-bulk-order-action="delete-request"]')).toHaveCount(0);

  await page.locator("#bulkCustomerLookupInput").fill("Khách xóa request manager");
  await page.locator("#bulkAddCustomerButton").click();
  await addBulkOrderItem(page, "Khách xóa request manager", "Chả quế chay", 1);
  await page.locator("#bulkOrderCommitValidButton").click();
  await expect(page.locator('#bulkOrderRequestsPanel [data-bulk-order-action="delete-request"]')).toHaveCount(1);

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
  const managerPendingRequestCard = managerPage.locator("#bulkOrderRequestsPanel .report-card").filter({ hasText: "Chờ duyệt" }).first();
  await expect(managerPendingRequestCard.locator('[data-bulk-order-action="delete-request"]')).toBeVisible();
  await managerPendingRequestCard.locator('[data-bulk-order-action="delete-request"]').click();
  const managerDeleteToast = await collectToast(managerPage, managerRuntime, "acc-ord-20-manager-delete", { errorPattern: /^$/ });
  expect(managerDeleteToast).toContain("Đã xóa yêu cầu xuất nhanh");
  await expect(managerPage.locator('#bulkOrderRequestsPanel [data-bulk-order-action="delete-request"]')).toHaveCount(0);

  await page.reload({ waitUntil: "networkidle" });
  await switchMenu(page, "bulk-orders");
  await expect(page.locator('#bulkOrderRequestsPanel [data-bulk-order-action="delete-request"]')).toHaveCount(0);

  expectNoRuntimeErrors(runtime);
  expectNoRuntimeErrors(managerRuntime);
  await managerContext.close();
});
