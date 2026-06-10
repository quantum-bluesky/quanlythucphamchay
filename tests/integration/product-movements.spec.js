const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginAdminRequest,
  autoLoginUser,
  expectNoRuntimeErrors,
  expectScreenTitle,
  switchMenu,
  waitForAppReady,
} = require("./support/ui");

async function seedProductMovementFixture(request) {
  const adminCookie = await autoLoginAdminRequest(request);
  const productName = `IT MOV ${Date.now()}`;
  const createProductResponse = await request.post("/api/products", {
    headers: { Cookie: adminCookie },
    data: {
      name: productName,
      category: "Regression",
      unit: "gói",
      price: 12000,
      sale_price: 15000,
      low_stock_threshold: 2,
    },
  });
  expect(createProductResponse.ok()).toBeTruthy();
  const createProductPayload = await createProductResponse.json();
  const product = createProductPayload.product || createProductPayload;
  expect(product?.id).toBeTruthy();

  const stockInResponse = await request.post("/api/transactions", {
    headers: { Cookie: adminCookie },
    data: {
      product_id: product.id,
      quantity: 12,
      note: "Seed lịch sử nhập test IT-MOV",
      transaction_type: "in",
      adjustment_reason: "Seed test movement history",
    },
  });
  expect(stockInResponse.ok()).toBeTruthy();

  const stockOutResponse = await request.post("/api/transactions", {
    headers: { Cookie: adminCookie },
    data: {
      product_id: product.id,
      quantity: 3,
      note: "Seed lịch sử xuất test IT-MOV",
      transaction_type: "out",
      adjustment_reason: "Seed test movement history",
    },
  });
  expect(stockOutResponse.ok()).toBeTruthy();

  return { productName };
}

test("IT-MOV-01 inventory detail opens product movement screen with the selected product", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const { productName } = await seedProductMovementFixture(request);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await waitForAppReady(page);
  await expectScreenTitle(page, "Kiểm tra tồn kho");

  await page.locator("#searchInput").fill(productName);
  const targetRow = page.locator("#productGrid .product-row", { hasText: productName }).first();
  await expect(targetRow).toBeVisible();
  await targetRow.locator('[data-product-action="toggle-expand"]').click();
  const historyButtons = targetRow.locator('[data-product-action="open-movement-history"]');
  await expect(historyButtons.first()).toBeVisible();

  await historyButtons.first().click();
  await expectScreenTitle(page, "Lịch sử biến động sản phẩm");
  await expect(page.locator("#productMovementProductInput")).toHaveValue(productName);
  await expect(page.locator("#productMovementSummaryCards .summary-card")).toHaveCount(6);
  await expect(page.locator("#productMovementList .product-movement-item")).toHaveCount(2);
  await expect(page.locator("#productMovementStatus")).toContainText("OK - Tồn tính toán khớp với hệ thống.");

  expectNoRuntimeErrors(runtime);
});

test("IT-MOV-02 product movement screen stays readable on mobile", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const { productName } = await seedProductMovementFixture(request);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await waitForAppReady(page);
  await switchMenu(page, "inventory");
  await page.locator("#inventoryHistoryShortcutButton").click();
  await expectScreenTitle(page, "Lịch sử biến động sản phẩm");

  await page.locator("#productMovementProductInput").fill(productName);
  await page.locator("#productMovementForm").getByRole("button", { name: "Xem lịch sử" }).click();
  await expect(page.locator("#productMovementSummaryCards .summary-card")).toHaveCount(6);
  await expect(page.locator("#productMovementList .product-movement-item")).toHaveCount(2);

  const layoutMetrics = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const elements = [
      document.querySelector("#productMovementForm"),
      document.querySelector("#productMovementSummaryCards"),
      document.querySelector("#productMovementList .product-movement-item"),
    ].filter(Boolean);
    return elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
      };
    }).concat({
      left: 0,
      right: document.documentElement.scrollWidth,
      width: viewportWidth,
      viewportWidth,
    });
  });

  const pageMetrics = layoutMetrics[layoutMetrics.length - 1];
  expect(pageMetrics.right).toBeLessThanOrEqual(pageMetrics.viewportWidth + 4);
  for (const metric of layoutMetrics.slice(0, -1)) {
    expect(metric.left).toBeGreaterThanOrEqual(-1);
    expect(metric.right).toBeLessThanOrEqual(pageMetrics.viewportWidth + 1);
  }

  expectNoRuntimeErrors(runtime);
});

test("IT-MOV-03 product movement screen defaults to descending and supports ascending sort", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const { productName } = await seedProductMovementFixture(request);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await waitForAppReady(page);
  await switchMenu(page, "inventory");
  await page.locator("#inventoryHistoryShortcutButton").click();
  await expectScreenTitle(page, "Lịch sử biến động sản phẩm");

  await page.locator("#productMovementProductInput").fill(productName);
  await page.locator("#productMovementForm").getByRole("button", { name: "Xem lịch sử" }).click();

  const movementItems = page.locator("#productMovementList .product-movement-item");
  await expect(page.locator("#productMovementSortSelect")).toHaveValue("desc");
  await expect(page.locator("#productMovementMeta")).toContainText("Ngày giảm dần");
  await expect(movementItems).toHaveCount(2);
  await expect(movementItems.first()).toContainText("Xuất kho");
  await expect(movementItems.first()).toContainText("-3");

  await page.locator("#productMovementSortSelect").selectOption("asc");
  await page.locator("#productMovementForm").getByRole("button", { name: "Xem lịch sử" }).click();

  await expect(page.locator("#productMovementMeta")).toContainText("Ngày tăng dần");
  await expect(movementItems.first()).toContainText("Nhập kho");
  await expect(movementItems.first()).toContainText("+12");

  expectNoRuntimeErrors(runtime);
});
