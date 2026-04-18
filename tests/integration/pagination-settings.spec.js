const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginUser,
  autoLoginUserRequest,
  expectNoRuntimeErrors,
  expectScreenTitle,
  switchMenu,
  waitForAppReady,
} = require("./support/ui");

async function ensureMinimumProductCount(request, cookie, minimumCount) {
  const productsResponse = await request.get("/api/products", {
    headers: { Cookie: cookie },
  });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const existingCount = Array.isArray(productsPayload.products) ? productsPayload.products.length : 0;
  const missingCount = Math.max(0, minimumCount - existingCount);

  for (let index = 0; index < missingCount; index += 1) {
    const createResponse = await request.post("/api/products", {
      headers: { Cookie: cookie },
      data: {
        name: `PAGINATION TEST ${Date.now()} ${index + 1}`,
        category: "Regression",
        unit: "gói",
        price: 10000 + index,
        sale_price: 12000 + index,
        low_stock_threshold: 5,
      },
    });
    expect(createResponse.ok()).toBeTruthy();
  }

  const finalResponse = await request.get("/api/products", {
    headers: { Cookie: cookie },
  });
  expect(finalResponse.ok()).toBeTruthy();
  const finalPayload = await finalResponse.json();
  return Array.isArray(finalPayload.products) ? finalPayload.products.length : existingCount;
}

test("IT-PAG-01 desktop pagination uses adaptive defaults and supports 25/50/100 page size", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  const userCookie = await autoLoginUserRequest(request);
  const totalProducts = await ensureMinimumProductCount(request, userCookie, 40);
  await page.reload({ waitUntil: "networkidle" });
  await waitForAppReady(page);

  await switchMenu(page, "products");
  await expectScreenTitle(page, "Sản phẩm");

  const productRows = page.locator("#productManageList .product-row");
  const pageSizeSelect = page.locator('.products-top-pagination [data-page-size-group="items"]').first();
  const paginationStatus = page.locator(".products-top-pagination .pagination-status").first();

  await expect(pageSizeSelect).toBeVisible();
  await expect(pageSizeSelect).toHaveValue("100");
  await expect(productRows).toHaveCount(totalProducts);
  await expect(paginationStatus).toContainText(`Trang 1/${Math.ceil(totalProducts / 100)}`);

  await pageSizeSelect.selectOption("25");
  await expect(pageSizeSelect).toHaveValue("25");
  await expect(productRows).toHaveCount(25);
  await expect(paginationStatus).toContainText(`Trang 1/${Math.ceil(totalProducts / 25)}`);

  await pageSizeSelect.selectOption("50");
  await expect(pageSizeSelect).toHaveValue("50");
  await expect(productRows).toHaveCount(Math.min(50, totalProducts));
  await expect(paginationStatus).toContainText(`Trang 1/${Math.ceil(totalProducts / 50)}`);

  expectNoRuntimeErrors(runtime);
});
