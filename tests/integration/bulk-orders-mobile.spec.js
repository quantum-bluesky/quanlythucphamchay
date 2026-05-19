const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginAdmin,
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
