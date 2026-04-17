const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginUser,
  autoLoginUserRequest,
  expectNoRuntimeErrors,
  expectScreenTitle,
  switchMenu,
} = require("./support/ui");

test.describe.configure({ timeout: 120000 });

async function getLocatorTop(locator) {
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  return box.y;
}

async function expectLocatorVisibleAfterScroll(page, locator, beforeTop) {
  const afterTop = await getLocatorTop(locator);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  expect(afterTop).toBeLessThan(beforeTop);
  expect(afterTop).toBeLessThan(viewportHeight - 160);
}

async function setFloatingSearch(page, term) {
  const toggle = page.locator("#floatingSearchToggle");
  const input = page.locator("#floatingSearchInput");
  if (!await input.isVisible()) {
    await toggle.click();
  }
  await expect(input).toBeVisible();
  await input.fill(term);
  await page.waitForTimeout(250);
}

test("IT-NAV-01 open detail actions scroll to the opened receipt info", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const userCookie = await autoLoginUserRequest(request);
  const timestamp = Date.now();
  const draftCustomerName = `Khách mở giỏ ORD ${timestamp}`;
  const supplierName = `NCC mở phiếu ${timestamp}`;

  const stateResponse = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: userCookie } });
  expect(stateResponse.ok()).toBeTruthy();
  const originalState = await stateResponse.json();
  const productsResponse = await request.get("/api/products", { headers: { Cookie: userCookie } });
  expect(productsResponse.ok()).toBeTruthy();
  const productsPayload = await productsResponse.json();
  const product = productsPayload.products?.[0];
  expect(product).toBeTruthy();

  const draftCart = {
    id: `order_draft_detail_${timestamp}`,
    customerName: draftCustomerName,
    status: "draft",
    paymentStatus: "unpaid",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    orderCode: "",
    items: [
      {
        id: `order_draft_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: Number(product.sale_price || product.price || 0) || 1000,
        note: "",
      },
    ],
  };
  const draftPurchase = {
    id: `purchase_detail_${timestamp}`,
    supplierName,
    note: "Phiếu test auto scroll",
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    receiptCode: `PN-DETAIL-${timestamp}`,
    items: [
      {
        id: `purchase_item_${timestamp}`,
        productId: product.id,
        productName: product.name,
        quantity: 2,
        unitCost: Number(product.price || 0) || 1000,
      },
    ],
  };
  try {
    const seedResponse = await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: {
        carts: [draftCart, ...(originalState.carts || [])],
        purchases: [draftPurchase, ...(originalState.purchases || [])],
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await autoLoginUser(page, request);
    await page.reload({ waitUntil: "networkidle" });

    await switchMenu(page, "orders");
    await expectScreenTitle(page, "Đơn hàng");
    await setFloatingSearch(page, draftCustomerName);
    const draftOrderCard = page.locator(".cart-queue-item", { hasText: draftCustomerName }).first();
    await expect(draftOrderCard).toBeVisible();
    await draftOrderCard.evaluate((node) => node.scrollIntoView({ block: "end" }));
    await page.waitForTimeout(200);
    const draftOrderBeforeTop = await getLocatorTop(draftOrderCard);
    await draftOrderCard.locator('[data-queue-action="open"]').click();
    await page.waitForTimeout(500);
    await expectScreenTitle(page, "Tạo đơn xuất hàng");
    await expect(page.locator("#customerLookupInput")).toHaveValue(draftCustomerName);
    await expectLocatorVisibleAfterScroll(page, page.locator("#activeCartPanel"), draftOrderBeforeTop);

    await switchMenu(page, "purchases");
    await expectScreenTitle(page, "Nhập hàng");
    await setFloatingSearch(page, supplierName);
    const purchaseCard = page.locator(".cart-queue-item", { hasText: supplierName }).first();
    await expect(purchaseCard).toBeVisible();
    await purchaseCard.evaluate((node) => node.scrollIntoView({ block: "end" }));
    await page.waitForTimeout(200);
    const purchaseCardBeforeTop = await getLocatorTop(purchaseCard);
    await purchaseCard.locator('[data-purchase-list-action="open"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator("#purchaseSupplierInput")).toHaveValue(supplierName);
    await expectLocatorVisibleAfterScroll(page, page.locator("#purchasePanel"), purchaseCardBeforeTop);
  } finally {
    await request.put("/api/state", {
      headers: { Cookie: userCookie },
      data: {
        customers: originalState.customers,
        suppliers: originalState.suppliers,
        carts: originalState.carts,
        purchases: originalState.purchases,
      },
    });
  }

  expectNoRuntimeErrors(runtime);
});
