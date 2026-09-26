const { test, expect } = require("@playwright/test");
const { attachRuntimeTracking, expectNoRuntimeErrors } = require("./support/ui");

test("IT-PUB-01 Public ProductList shows low-stock status from the product threshold", async ({ page }) => {
  const runtime = attachRuntimeTracking(page);
  const products = [
    { id: 901, name: "Hàng còn nhiều", category: "Đồ chay", unit: "gói", sale_price: 20000, current_stock: 8, is_low_stock: false, incoming_open_purchases: 0, sold_count: 0, images: [], details: "", recipe: "", note: "" },
    { id: 902, name: "Hàng chạm ngưỡng", category: "Đồ chay", unit: "gói", sale_price: 20000, current_stock: 3, is_low_stock: true, incoming_open_purchases: 0, sold_count: 0, images: [], details: "", recipe: "", note: "" },
    { id: 903, name: "Hàng sắp về", category: "Đồ chay", unit: "gói", sale_price: 20000, current_stock: 0, is_low_stock: true, incoming_open_purchases: 4, sold_count: 0, images: [], details: "", recipe: "", note: "" },
    { id: 904, name: "Hàng đã hết", category: "Đồ chay", unit: "gói", sale_price: 20000, current_stock: 0, is_low_stock: true, incoming_open_purchases: 0, sold_count: 0, images: [], details: "", recipe: "", note: "" },
  ];
  await page.route("**/api/public/products", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ products, settings: {} }),
  }));

  await page.goto("./");

  await expect(page.locator('script[src*="public_products.js?v="]')).toHaveCount(1);
  await expect(page.locator('[data-availability-status="in-stock"]')).toHaveText("Có sẵn");
  await expect(page.locator('[data-availability-status="low-stock"]')).toHaveText("Sắp hết");
  await expect(page.locator('[data-availability-status="incoming"]')).toHaveText("Sắp về");
  await expect(page.locator('[data-availability-status="out-of-stock"]')).toHaveText("Hết hàng");
  expectNoRuntimeErrors(runtime);
});

test("Public ProductList preserves cart, supports review quantity edits and sorting", async ({ page }) => {
  const runtime = attachRuntimeTracking(page);

  await page.goto("./");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("h1")).toHaveText("Danh sách các thực phẩm chay");
  
  // 1. Check sort dropdown exists and default is 'name'
  const sortSelect = page.locator("#sortSelect");
  await expect(sortSelect).toBeVisible();
  await expect(sortSelect).toHaveValue("name");

  // Change sort to in_stock and popular
  await sortSelect.selectOption("in_stock");
  await expect(sortSelect).toHaveValue("in_stock");
  await sortSelect.selectOption("popular");
  await expect(sortSelect).toHaveValue("popular");
  await sortSelect.selectOption("name");

  // 2. Select product and verify cart persistence across reload
  const firstCheckbox = page.locator(".item-checkbox").first();
  await firstCheckbox.waitFor({ state: "visible" });
  await firstCheckbox.check();

  const cartBadge = page.locator("#cartCountBadge");
  await expect(cartBadge).toHaveText("1");

  await page.reload();
  await page.waitForLoadState("networkidle");

  await expect(cartBadge).toHaveText("1");
  await expect(firstCheckbox).toBeChecked();

  // 3. Open checkout confirm modal and test quantity adjustment
  await page.locator("#checkoutBtn").click();
  await expect(page.locator("#checkoutModal")).toBeVisible();
  await expect(page.locator("#checkoutReviewItems")).not.toBeEmpty();

  const reviewQtyInput = page.locator(".review-input-qty").first();
  await expect(reviewQtyInput).toHaveValue("1");

  // Click plus button to increase quantity
  const plusBtn = page.locator(".btn-review-qty-plus").first();
  await plusBtn.click();
  await expect(reviewQtyInput).toHaveValue("2");
  await expect(page.locator("#checkoutReviewTotal")).toContainText("2 món");

  // Close modal and verify card on grid is updated to 2
  await page.locator("#closeCheckoutModal").click();
  await expect(page.locator("#checkoutModal")).toBeHidden();
  const firstInputQty = page.locator(".input-qty").first();
  await expect(firstInputQty).toHaveValue("2");

  expectNoRuntimeErrors(runtime);
});

test("IT-PUB-03 Public ProductList treats items with stock less than smallest unit as out-of-stock", async ({ page }) => {
  const runtime = attachRuntimeTracking(page);
  const products = [
    { id: 911, name: "Hàng gói tồn lẻ nhỏ hơn 1 gói", category: "Đồ chay", unit: "gói", sale_price: 20000, current_stock: 0.5, is_low_stock: true, incoming_open_purchases: 0, sold_count: 0, images: [], details: "", recipe: "", note: "" },
    { id: 912, name: "Hàng kg tồn nhỏ hơn đơn vị quy đổi nhỏ nhất", category: "Đồ chay", unit: "kg", sale_price: 100000, current_stock: 0.2, is_low_stock: true, incoming_open_purchases: 0, sold_count: 0, images: [], details: "", recipe: "", note: "", unit_conversions: [{ from_unit: "gói 500g", conversion_factor: 0.5 }] },
    { id: 913, name: "Hàng kg đủ đơn vị quy đổi nhỏ nhất", category: "Đồ chay", unit: "kg", sale_price: 100000, current_stock: 0.6, is_low_stock: false, incoming_open_purchases: 0, sold_count: 0, images: [], details: "", recipe: "", note: "", unit_conversions: [{ from_unit: "gói 500g", conversion_factor: 0.5 }] },
    { id: 914, name: "Hàng tồn nhỏ hơn đơn vị nhỏ nhất nhưng có hàng sắp về", category: "Đồ chay", unit: "gói", sale_price: 20000, current_stock: 0.2, is_low_stock: true, incoming_open_purchases: 5, sold_count: 0, images: [], details: "", recipe: "", note: "" },
  ];
  await page.route("**/api/public/products", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ products, settings: {} }),
  }));

  await page.goto("./");

  // Product 911: stock 0.5 < 1 gói -> Hết hàng
  const card911 = page.locator(".product-card").filter({ hasText: "Hàng gói tồn lẻ nhỏ hơn 1 gói" });
  await expect(card911.locator('[data-availability-status="out-of-stock"]')).toHaveText("Hết hàng");

  // Product 912: stock 0.2 < min_unit 0.5 -> Hết hàng
  const card912 = page.locator(".product-card").filter({ hasText: "Hàng kg tồn nhỏ hơn đơn vị quy đổi nhỏ nhất" });
  await expect(card912.locator('[data-availability-status="out-of-stock"]')).toHaveText("Hết hàng");

  // Product 913: stock 0.6 >= min_unit 0.5 -> Có sẵn
  const card913 = page.locator(".product-card").filter({ hasText: "Hàng kg đủ đơn vị quy đổi nhỏ nhất" });
  await expect(card913.locator('[data-availability-status="in-stock"]')).toHaveText("Có sẵn");

  // Product 914: stock 0.2 < 1 gói but incoming 5 -> Sắp về
  const card914 = page.locator(".product-card").filter({ hasText: "Hàng tồn nhỏ hơn đơn vị nhỏ nhất nhưng có hàng sắp về" });
  await expect(card914.locator('[data-availability-status="incoming"]')).toHaveText("Sắp về");

  expectNoRuntimeErrors(runtime);
});


