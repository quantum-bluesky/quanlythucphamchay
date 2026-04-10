const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  collectToast,
  expectNoRuntimeErrors,
  expectScreenTitle,
  switchMenu,
} = require("./support/ui");

test("IT-ORD-01 orders screen actions expand details, mark paid, and reopen draft carts", async ({ page }) => {
  const runtime = attachRuntimeTracking(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await switchMenu(page, "orders");
  await expectScreenTitle(page, "Đơn hàng");
  await page.locator("#showArchivedCarts").check();
  await page.waitForTimeout(300);

  const completedOrderCard = page.locator(".cart-queue-item", { hasText: "Chị Ngọc, Long Biên" }).first();
  await completedOrderCard.locator('[data-queue-action="toggle-detail"]').click();
  await page.waitForTimeout(300);
  await expect(completedOrderCard.locator('[data-queue-action="mark-paid"]')).toHaveCount(1);

  await completedOrderCard.locator('[data-queue-action="mark-paid"]').click();
  await page.waitForTimeout(400);
  await expect(page.locator(".cart-queue-item", { hasText: "Chị Ngọc, Long Biên" })).toHaveCount(0);
  await page.locator("#showPaidOrders").check();
  const paidOrderCard = page.locator(".cart-queue-item", { hasText: "Chị Ngọc, Long Biên" }).first();
  await expect(paidOrderCard).toContainText("Đã TT");

  const draftOrderCard = page.locator(".cart-queue-item", { hasText: "Quán Chay An Nhiên" }).first();
  await draftOrderCard.locator('[data-queue-action="open"], [data-cart-list-action="open"]').click();
  await expectScreenTitle(page, "Tạo đơn xuất hàng");
  await expect(page.locator("#customerLookupInput")).toHaveValue("Quán Chay An Nhiên");
  await collectToast(page, runtime, "orders-open-draft");

  expectNoRuntimeErrors(runtime);
});
