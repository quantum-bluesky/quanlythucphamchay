const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginAdmin,
  gotoWithRetry,
  switchMenu,
  waitForAppReady,
} = require("./support/ui");

test("DEBUG-TEST exact modal appearance on receive and ship", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page, { autoAcceptDialogs: true });

  await gotoWithRetry(page, "/admin");
  await page.waitForLoadState("networkidle");
  await autoLoginAdmin(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await waitForAppReady(page);

  // 1. TEST NHẬP KHO: Chọn phiếu 'NCC Rau Củ' đang ở trạng thái 'Đã đặt'
  console.log("=== TEST NHẬP KHO ===");
  await switchMenu(page, "purchases");
  await page.waitForTimeout(500);

  // Tìm card có chữ "Đã đặt"
  const orderedPurchaseCard = page.locator(".cart-queue-item", { hasText: "Đã đặt" }).first();
  await expect(orderedPurchaseCard).toBeVisible();
  // Bấm nút "Mở" trên card đó
  await orderedPurchaseCard.locator("button[data-purchase-list-action='open']").click();
  await page.waitForTimeout(500);

  // Mở rộng purchasePanel nếu đang bị thu gọn
  const togglePanelBtn = page.locator("#togglePurchasePanelButton");
  if (await togglePanelBtn.isVisible()) {
    const text = await togglePanelBtn.textContent();
    if (text.includes("Mở")) {
      await togglePanelBtn.click();
      await page.waitForTimeout(300);
    }
  }

  const receiveBtn = page.locator("#purchasePanel button[data-purchase-action='receive']");
  await expect(receiveBtn).toBeVisible();
  console.log("Found receive button! Clicking...");
  await receiveBtn.click();
  await page.waitForTimeout(500);

  const isModalVisibleAfterReceive = await page.locator("#documentActionDateModal").isVisible();
  console.log("documentActionDateModal visible after receive click:", isModalVisibleAfterReceive);
  expect(isModalVisibleAfterReceive).toBe(true);

  const receiveTitle = await page.locator("#documentActionDateTitle").textContent();
  const receiveInputVal = await page.locator("#documentActionDateInput").inputValue();
  console.log("Receive modal title:", receiveTitle, "input date:", receiveInputVal);

  // Đóng modal bằng nút Hủy
  await page.locator("#documentActionDateCancelButton").click();
  await page.waitForTimeout(300);
  expect(await page.locator("#documentActionDateModal").isVisible()).toBe(false);

  // 2. TEST XUẤT HÀNG TRÊN CART QUEUE & ORDER DETAIL (Màn Đơn hàng)
  console.log("=== TEST XUẤT HÀNG TRÊN CART QUEUE ===");
  await switchMenu(page, "orders");
  await page.waitForTimeout(500);

  // Lấy 1 đơn đã chốt
  const committedOrderCard = page.locator(".cart-queue-item", { hasText: "Đã chốt" }).first();
  if (await committedOrderCard.isVisible()) {
    // Thử nút Xuất hàng trực tiếp trên card nếu có
    const shipQueueBtn = committedOrderCard.locator("button[data-queue-action='ship']");
    if (await shipQueueBtn.isVisible()) {
      console.log("Clicking ship from cart queue...");
      await shipQueueBtn.click();
      await page.waitForTimeout(500);
      const isModalVisibleAfterQueueShip = await page.locator("#documentActionDateModal").isVisible();
      console.log("Modal visible after queue ship:", isModalVisibleAfterQueueShip);
      expect(isModalVisibleAfterQueueShip).toBe(true);
      await page.locator("#documentActionDateCancelButton").click();
      await page.waitForTimeout(300);
    }

    // Mở Order Detail
    await committedOrderCard.click();
    await page.waitForTimeout(500);
    const shipDetailBtn = page.locator("#orderDetailPanel button[data-order-detail-action='ship']");
    if (await shipDetailBtn.isVisible()) {
      console.log("Clicking ship from order detail panel...");
      await shipDetailBtn.click();
      await page.waitForTimeout(500);
      const isModalVisibleAfterDetailShip = await page.locator("#documentActionDateModal").isVisible();
      console.log("Modal visible after detail ship:", isModalVisibleAfterDetailShip);
      expect(isModalVisibleAfterDetailShip).toBe(true);
      await page.locator("#documentActionDateCancelButton").click();
      await page.waitForTimeout(300);
    }
  }

  // 3. TEST XUẤT HÀNG TRÊN CREATE-ORDER (Active Cart Panel)
  console.log("=== TEST XUẤT HÀNG TRÊN CREATE-ORDER ===");
  await switchMenu(page, "create-order");
  await page.waitForTimeout(500);

  // Tạo 1 đơn mới, thêm sản phẩm và chốt đơn
  await page.locator("#customerLookupInput").fill("Khách Modal Đơn Mới");
  await page.waitForTimeout(300);

  // Click thêm sản phẩm vào giỏ
  const addProductBtn = page.locator("#salesProductList button.compact-button").first();
  if (await addProductBtn.isVisible()) {
    await addProductBtn.click();
    await page.waitForTimeout(500);
  }

  // Chốt đơn
  const commitBtn = page.locator("#activeCartPanel button[data-cart-action='commit']");
  if (await commitBtn.isVisible()) {
    await commitBtn.click();
    await page.waitForTimeout(500);
  }

  const shipActiveBtn = page.locator("#activeCartPanel button[data-cart-action='ship']");
  if (await shipActiveBtn.isVisible()) {
    console.log("Clicking ship from active cart panel...");
    await shipActiveBtn.click();
    await page.waitForTimeout(500);

    const isModalVisibleAfterActiveShip = await page.locator("#documentActionDateModal").isVisible();
    console.log("Modal visible after active cart ship:", isModalVisibleAfterActiveShip);
    expect(isModalVisibleAfterActiveShip).toBe(true);

    // Điền ngày mới và xác nhận
    await page.locator("#documentActionDateInput").fill("2026-06-20");
    await page.locator("#documentActionDateConfirmButton").click();
    await page.waitForTimeout(1000);
    console.log("Shipped successfully with date 2026-06-20!");
  }

  console.log("TEST HOÀN TẤT THÀNH CÔNG!");
});
