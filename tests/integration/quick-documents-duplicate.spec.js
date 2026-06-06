const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginUser,
  autoLoginUserRequest,
  collectToast,
  expectNoRuntimeErrors,
  expectScreenTitle,
  switchMenu,
} = require("./support/ui");

async function fetchState(request, cookie) {
  const response = await request.get("/api/state?transaction_limit=16", { headers: { Cookie: cookie } });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function fetchProducts(request, cookie) {
  const response = await request.get("/api/products", { headers: { Cookie: cookie } });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  return payload.products || [];
}

async function createQuickPurchase(request, cookie, payload) {
  const response = await request.post("/api/purchases/quick-create", {
    headers: { Cookie: cookie },
    data: payload,
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

function countByName(entries, name, field) {
  return (entries || []).filter((entry) => String(entry?.[field] || "") === name).length;
}

async function waitForProductOption(page, productName) {
  await page.waitForFunction(
    (name) => Array.from(document.querySelectorAll("#productOptions option")).some((option) => option.value === name),
    productName,
  );
}

async function addQuickSaleLine(page, productName, quantity, unitPrice) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.locator("#quickSaleProductInput").fill(productName);
    await page.locator("#quickSaleQuantityInput").fill(String(quantity));
    await page.locator("#quickSaleUnitPriceInput").fill(String(unitPrice));
    await page.locator('[data-quick-sale-action="add-item"]').click();
    if (await page.locator('[data-quick-sale-action="remove-item"]').count()) {
      return;
    }
    await page.waitForTimeout(250);
  }
  await expect(page.locator('[data-quick-sale-action="remove-item"]')).toHaveCount(1);
}

async function addQuickPurchaseLine(page, productName, quantity, unitCost) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.locator("#quickPurchaseProductInput").fill(productName);
    await page.locator("#quickPurchaseQuantityInput").fill(String(quantity));
    await page.locator("#quickPurchaseUnitCostInput").fill(String(unitCost));
    await page.locator('[data-quick-purchase-action="add-item"]').click();
    if (await page.locator('[data-quick-purchase-action="remove-item"]').count()) {
      return;
    }
    await page.waitForTimeout(250);
  }
  await expect(page.locator('[data-quick-purchase-action="remove-item"]')).toHaveCount(1);
}

test("ACC-QUICK-06 quick import and export lock the saved form to prevent duplicate documents", async ({ page, request }) => {
  test.setTimeout(90000);
  const runtime = attachRuntimeTracking(page);
  const userCookie = await autoLoginUserRequest(request);
  const products = await fetchProducts(request, userCookie);
  const product = products[0];
  expect(product).toBeTruthy();

  const timestamp = Date.now();
  const stockSupplierName = `NCC cấp tồn quick duplicate ${timestamp}`;
  const saleCustomerName = `Khách quick duplicate ${timestamp}`;
  const purchaseSupplierName = `NCC quick duplicate ${timestamp}`;
  const unitCost = Number(product.price || 0) || 1000;
  const unitPrice = Number(product.sale_price || product.price || 0) || 1000;

  await createQuickPurchase(request, userCookie, {
    supplier_name: stockSupplierName,
    document_date: "2026-06-06",
    items: [{ product_id: product.id, quantity: 8, unit_cost: unitCost }],
    final_status: "received",
    mark_paid: false,
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });

  await switchMenu(page, "create-order");
  await expectScreenTitle(page, "Tạo đơn xuất hàng");
  await waitForProductOption(page, product.name);
  await page.locator("#quickSaleCustomerInput").fill(saleCustomerName);
  await addQuickSaleLine(page, product.name, 2, unitPrice);
  await page.locator('[data-quick-sale-action="submit"]').click();
  const saleToast = await collectToast(page, runtime, "acc-quick-06-sale", { errorPattern: /^$/ });
  expect(saleToast).toContain("Đã lưu");

  const saleSubmitButton = page.locator('[data-quick-sale-action="submit"]');
  await expect(saleSubmitButton).toBeDisabled();
  await expect(saleSubmitButton).toHaveText("Đã tạo phiếu");
  await expect(page.locator("#quickSaleCustomerInput")).toBeDisabled();
  await expect(page.locator('[data-quick-sale-action="continue"]')).toBeVisible();

  let latestState = await fetchState(request, userCookie);
  expect(countByName(latestState.carts, saleCustomerName, "customerName")).toBe(1);

  await switchMenu(page, "purchases");
  await expectScreenTitle(page, "Nhập hàng");
  await waitForProductOption(page, product.name);
  await page.locator("#quickPurchaseSupplierInput").fill(purchaseSupplierName);
  await addQuickPurchaseLine(page, product.name, 3, unitCost);
  await page.locator('[data-quick-purchase-action="submit"]').click();
  const purchaseToast = await collectToast(page, runtime, "acc-quick-06-purchase", { errorPattern: /^$/ });
  expect(purchaseToast).toContain("Đã lưu");

  const purchaseSubmitButton = page.locator('[data-quick-purchase-action="submit"]');
  await expect(purchaseSubmitButton).toBeDisabled();
  await expect(purchaseSubmitButton).toHaveText("Đã tạo phiếu");
  await expect(page.locator("#quickPurchaseSupplierInput")).toBeDisabled();
  await expect(page.locator('[data-quick-purchase-action="continue"]')).toBeVisible();

  latestState = await fetchState(request, userCookie);
  expect(countByName(latestState.purchases, purchaseSupplierName, "supplierName")).toBe(1);
  expectNoRuntimeErrors(runtime);
});
