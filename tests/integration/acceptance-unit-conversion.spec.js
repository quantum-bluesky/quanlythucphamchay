const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginAdmin,
  expectNoRuntimeErrors,
  gotoWithRetry,
  switchMenu,
  waitForAppReady,
} = require("./support/ui");

test("UI-ACCEPTANCE-01 multi-unit conversion, default units, name bugfix, and auto quantity/price recalculation", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);

  await gotoWithRetry(page, "/admin");
  await page.waitForLoadState("networkidle");
  await autoLoginAdmin(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await waitForAppReady(page);

  // 1. Go to Products screen
  await switchMenu(page, "products");
  await expect(page.locator("#productFormToggleButton")).toBeVisible({ timeout: 5000 });

  // Open add product form
  await page.click("#productFormToggleButton");
  await page.waitForTimeout(400);
  await expect(page.locator("#productFormWrap")).toBeVisible();

  const testProductName = `Bánh quy chay test ${Date.now()}`;
  await page.locator("#productForm input[name='name']").fill(testProductName);
  await page.locator("#productForm input[name='unit']").fill("cái");
  await page.locator("#productForm input[name='price']").fill("5000");
  await page.locator("#productForm input[name='sale_price']").fill("7000");

  // Add unit conversion 1: thùng (factor 10, cost 50000, price 70000)
  const addConvBtn = page.locator("#productAddUnitConversionButton");
  await expect(addConvBtn).toBeVisible();
  await addConvBtn.click();

  const convRows = page.locator("#productUnitConversionsContainer .unit-conversion-row");
  const row1 = convRows.nth(0);
  await row1.locator(".uc-unit").fill("thùng");
  await row1.locator(".uc-factor").fill("10");
  await row1.locator(".uc-price").fill("50000");
  await row1.locator(".uc-saleprice").fill("70000");

  // Add unit conversion 2: kg (factor 30, cost 140000, price 200000)
  await addConvBtn.click();
  const row2 = convRows.nth(1);
  await row2.locator(".uc-unit").fill("kg");
  await row2.locator(".uc-factor").fill("30");
  await row2.locator(".uc-price").fill("140000");
  await row2.locator(".uc-saleprice").fill("200000");

  // Set default units to "thùng"
  const defaultPurchaseSelect = page.locator("#productDefaultPurchaseUnitSelect");
  const defaultSaleSelect = page.locator("#productDefaultSaleUnitSelect");
  await expect(defaultPurchaseSelect).toBeVisible();
  await expect(defaultSaleSelect).toBeVisible();

  await defaultPurchaseSelect.selectOption("thùng");
  await defaultSaleSelect.selectOption("thùng");

  // Save product
  await page.locator("#productForm button[type='submit']").click();
  await expect(page.locator("#toast")).toContainText("Đã thêm sản phẩm", { timeout: 8000 });

  // Verify product was created and edit it to check that unit name is NOT undefined
  const productsResp = await request.get("./api/products");
  const productsData = await productsResp.json();
  const createdProduct = productsData.products.find(p => p.name === testProductName);
  expect(createdProduct).toBeTruthy();
  expect(createdProduct.default_purchase_unit).toBe("thùng");
  expect(createdProduct.default_sale_unit).toBe("thùng");

  // Click edit on the created product in the product list
  await switchMenu(page, "products");
  const productCard = page.locator("#productManageList .product-row", { hasText: testProductName }).first();
  await expect(productCard).toBeVisible({ timeout: 8000 });
  await productCard.locator('[data-product-manage-action="edit-full"]').click();

  // Verify unit name in form rows are "thùng" and "kg", NOT "undefined"
  await expect(page.locator("#productFormWrap")).toBeVisible();
  const editRows = page.locator("#productUnitConversionsContainer .unit-conversion-row");
  await expect(editRows).toHaveCount(2);
  await expect(editRows.nth(0).locator(".uc-unit")).toHaveValue("thùng");
  await expect(editRows.nth(1).locator(".uc-unit")).toHaveValue("kg");
  await expect(defaultPurchaseSelect).toHaveValue("thùng");
  await expect(defaultSaleSelect).toHaveValue("thùng");

  // 2. Test Quick Sale: auto defaults to "thùng" & auto quantity/price recalculation
  await switchMenu(page, "create-order");
  const quickSaleInput = page.locator("#quickSaleProductInput");
  if (await quickSaleInput.isVisible()) {
    await quickSaleInput.fill(`${testProductName} - ${createdProduct.id}`);
    await quickSaleInput.dispatchEvent("input");

    const saleUnitSelect = page.locator("#quickSaleUnitSelect");
    await expect(saleUnitSelect).toBeVisible();
    // Default sale unit should be "thùng" (factor 10, price 70000)
    await expect(saleUnitSelect).toHaveValue("10");
    const unitPriceInput = page.locator("#quickSaleUnitPriceInput");
    await expect(unitPriceInput).toHaveValue("70000");

    // Enter quantity 1 thùng
    const qtyInput = page.locator("#quickSaleQuantityInput");
    await qtyInput.fill("1");

    // Change unit to "kg" (factor 30, price 200000)
    // 1 thùng (10 cái) -> kg (30 cái) => 10/30 = 0.3333 kg
    await saleUnitSelect.selectOption({ label: "kg (1=30)" });
    await saleUnitSelect.dispatchEvent("change");

    const convertedQty = await qtyInput.inputValue();
    expect(parseFloat(convertedQty)).toBeCloseTo(0.3333, 3);
    await expect(unitPriceInput).toHaveValue("200000");
  }

  // 3. Test Quick Purchase: auto defaults to "thùng" & auto quantity/cost recalculation
  await switchMenu(page, "purchases");
  const quickPurchaseInput = page.locator("#quickPurchaseProductInput");
  if (await quickPurchaseInput.isVisible()) {
    await quickPurchaseInput.fill(`${testProductName} - ${createdProduct.id}`);
    await quickPurchaseInput.dispatchEvent("input");

    const purchaseUnitSelect = page.locator("#quickPurchaseUnitSelect");
    await expect(purchaseUnitSelect).toBeVisible();
    // Default purchase unit should be "thùng" (factor 10, cost 50000)
    await expect(purchaseUnitSelect).toHaveValue("10");
    const unitCostInput = page.locator("#quickPurchaseUnitCostInput");
    await expect(unitCostInput).toHaveValue("50000");

    // Enter quantity 1 thùng
    const purchaseQtyInput = page.locator("#quickPurchaseQuantityInput");
    await purchaseQtyInput.fill("1");

    // Change unit to base unit "cái" (factor 1, cost 5000)
    // 1 thùng (10 cái) -> 10 cái
    await purchaseUnitSelect.selectOption({ label: "cái (gốc)" });
    await purchaseUnitSelect.dispatchEvent("change");

    await expect(purchaseQtyInput).toHaveValue("10");
    await expect(unitCostInput).toHaveValue("5000");
  }

  expectNoRuntimeErrors(runtime);
});
