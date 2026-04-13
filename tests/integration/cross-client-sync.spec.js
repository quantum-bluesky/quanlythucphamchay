const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginAdminRequest,
  autoLoginUser,
  collectToast,
  expectNoRuntimeErrors,
  expectScreenTitle,
  switchMenu,
} = require("./support/ui");

function formatQuantity(value) {
  const numericValue = Number(value || 0);
  return Number.isInteger(numericValue) ? String(numericValue) : numericValue.toString();
}

function formatMoney(value) {
  return new Intl.NumberFormat("vi-VN").format(Number(value || 0));
}

test("ACC-SYNC-01 create-order screen auto refreshes stock and price after changes from another client", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await switchMenu(page, "create-order");
  await expectScreenTitle(page, "Tạo đơn xuất hàng");

  await page.locator("#floatingSearchToggle").click();
  await page.locator("#floatingSearchInput").fill("Bò lát xào");
  await page.waitForTimeout(500);

  const productRow = page.locator(".sales-product-row", {
    has: page.locator("text=Bò lát xào"),
  }).first();

  const adminCookie = await autoLoginAdminRequest(request);
  expect(adminCookie).toBeTruthy();
  const productsResponse = await request.get("/api/products", {
    headers: {
      Cookie: adminCookie,
    },
  });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const product = (productsPayload.products || []).find((entry) => entry.name === "Bò lát xào");
  expect(product).toBeTruthy();
  const originalStock = Number(product.current_stock || 0);
  const originalPrice = Number(product.price || 0);
  const stockDelta = 1;
  const updatedStock = originalStock + stockDelta;
  const updatedPrice = originalPrice + 1000;

  await expect(productRow).toContainText(`Tồn ${formatQuantity(originalStock)} gói`);
  await expect(productRow).toContainText(`Giá nhập ${formatMoney(originalPrice)}`);

  try {
    const stockResponse = await request.post("/api/transactions", {
      headers: {
        Cookie: adminCookie,
      },
      data: {
        product_id: product.id,
        transaction_type: "in",
        quantity: stockDelta,
        adjustment_reason: "Playwright cross-client sync test",
      },
    });
    expect(stockResponse.ok()).toBeTruthy();

    const priceResponse = await request.put(`/api/products/${product.id}/price`, {
      headers: {
        Cookie: adminCookie,
      },
      data: {
        price: updatedPrice,
      },
    });
    expect(priceResponse.ok()).toBeTruthy();

    await page.locator("body").click({ position: { x: 10, y: 10 } });
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));

    await expect(productRow).toContainText(`Tồn ${formatQuantity(updatedStock)} gói`, { timeout: 12000 });
    await expect(productRow).toContainText(`Giá nhập ${formatMoney(updatedPrice)}`, { timeout: 12000 });
  } finally {
    await request.put(`/api/products/${product.id}/price`, {
      headers: {
        Cookie: adminCookie,
      },
      data: {
        price: originalPrice,
      },
    });
    await request.post("/api/transactions", {
      headers: {
        Cookie: adminCookie,
      },
      data: {
        product_id: product.id,
        transaction_type: "out",
        quantity: stockDelta,
        adjustment_reason: "Hoàn nguyên Playwright cross-client sync test",
      },
    });
  }

  await collectToast(page, runtime, "cross-client-sync");
  expectNoRuntimeErrors(runtime);
});
