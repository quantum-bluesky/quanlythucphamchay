const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginUser,
  expectNoRuntimeErrors,
  switchMenu,
  waitForAppReady,
} = require("./support/ui");

async function firstInventoryName(page) {
  return ((await page.locator("#productGrid .product-row-name").first().textContent()) || "").trim();
}

test("IT-INV-SORT-01 inventory sort control lives in pagination and sorts by stock, priority and expiry", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  await page.goto("/");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await waitForAppReady(page);

  const sortSelect = page.locator(".inventory-top-pagination [data-inventory-sort]");
  await expect(sortSelect).toBeVisible();
  await expect(page.locator(".list-search-toolbar [data-inventory-sort]")).toHaveCount(0);

  await sortSelect.selectOption("stock-desc");
  await expect.poll(() => firstInventoryName(page)).toContain("Bò kho");

  await sortSelect.selectOption("value-desc");
  await expect.poll(() => firstInventoryName(page)).toContain("Bò kho");

  await sortSelect.selectOption("priority");
  await expect.poll(() => firstInventoryName(page)).toContain("Bò lát xào");
  await expect(page.locator("#productGrid .product-row").first()).toContainText("Ưu tiên");

  await sortSelect.selectOption("expiry");
  await expect.poll(() => firstInventoryName(page)).toContain("Ruốc nấm");
  await expect(page.locator("#productGrid .product-row").first()).toContainText("Còn ước tính");

  expectNoRuntimeErrors(runtime);
});

test("IT-PROD-LIFE-01 product life metadata saves from inline edit", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  await page.goto("/");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await waitForAppReady(page);
  await switchMenu(page, "products");

  const firstProduct = page.locator("#productManageList .product-row").first();
  await firstProduct.locator('[data-product-manage-action="edit"]').click();
  await expect(page.locator('[data-manage-input="shelf_life_days"]').first()).toBeVisible();
  await page.locator('[data-manage-input="shelf_life_days"]').first().fill("77");
  await page.locator('[data-manage-input="storage_life_days"]').first().fill("88");
  await page.locator('[data-product-manage-action="save-inline"]').first().click();

  await expect(page.locator("#productManageList")).toContainText("Hạn 77 ngày");
  await expect(page.locator("#productManageList")).toContainText("Bảo quản 88 ngày");

  expectNoRuntimeErrors(runtime);
});

test("IT-INV-SORT-02 inventory sort control remains visible in desktop pagination", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await waitForAppReady(page);

  const topPagination = page.locator(".inventory-top-pagination .pagination-bar");
  await expect(topPagination).toBeVisible();
  await expect(topPagination.locator("[data-inventory-sort]")).toBeVisible();
  await expect(topPagination.locator("[data-page-size-group='items']")).toBeVisible();

  expectNoRuntimeErrors(runtime);
});
