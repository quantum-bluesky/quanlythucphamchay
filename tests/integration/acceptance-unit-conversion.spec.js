const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginAdmin,
  expectNoRuntimeErrors,
  gotoWithRetry,
  switchMenu,
  waitForAppReady,
} = require("./support/ui");

test("UI-ACCEPTANCE-01 multi-unit conversion creation, display, quick-sale and quick-purchase price sync", async ({ page, request }) => {
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
  await page.waitForTimeout(300);
  await expect(page.locator("#productFormWrap")).toBeVisible();

  const testProductName = `Bò lát chay đa đơn vị ${Date.now()}`;
  await page.locator("#productForm input[name='name']").fill(testProductName);
  await page.locator("#productForm input[name='unit']").fill("gói");
  await page.locator("#productForm input[name='price']").fill("10000");
  await page.locator("#productForm input[name='sale_price']").fill("15000");

  // Add unit conversion
  const addConvBtn = page.locator("#productAddUnitConversionButton");
  await expect(addConvBtn).toBeVisible();
  await addConvBtn.click();

  const convRow = page.locator("#productUnitConversionsContainer .unit-conversion-row").last();
  await expect(convRow).toBeVisible();
  await convRow.locator(".uc-unit").fill("thùng");
  await convRow.locator(".uc-factor").fill("24");
  await convRow.locator(".uc-price").fill("200000");
  await convRow.locator(".uc-saleprice").fill("280000");

  // Save product
  await page.locator("#productForm button[type='submit']").click();
  await expect(page.locator("#toast")).toContainText("Đã thêm sản phẩm", { timeout: 8000 });

  // 2. Go to Create Order (Tạo đơn)
  await switchMenu(page, "create-order");
  const quickSaleInput = page.locator("#quickSaleProductInput");
  if (await quickSaleInput.isVisible()) {
    // Select product in quick sale
    const productsResp = await request.get("./api/products");
    const productsData = await productsResp.json();
    const createdProduct = productsData.products.find(p => p.name === testProductName);
    expect(createdProduct).toBeTruthy();

    await quickSaleInput.fill(`${testProductName} - ${createdProduct.id}`);
    await quickSaleInput.dispatchEvent("input");

    const unitSelect = page.locator("#quickSaleUnitSelect");
    await expect(unitSelect).toBeVisible();
    await unitSelect.selectOption({ label: "thùng (1=24)" });
    await unitSelect.dispatchEvent("input");

    const unitPriceInput = page.locator("#quickSaleUnitPriceInput");
    await expect(unitPriceInput).toHaveValue("280000");
  }

  // 3. Go to Purchases (Nhập hàng)
  await switchMenu(page, "purchases");
  const quickPurchaseInput = page.locator("#quickPurchaseProductInput");
  if (await quickPurchaseInput.isVisible()) {
    const productsResp = await request.get("./api/products");
    const productsData = await productsResp.json();
    const createdProduct = productsData.products.find(p => p.name === testProductName);
    expect(createdProduct).toBeTruthy();

    await quickPurchaseInput.fill(`${testProductName} - ${createdProduct.id}`);
    await quickPurchaseInput.dispatchEvent("input");

    const purchaseUnitSelect = page.locator("#quickPurchaseUnitSelect");
    await expect(purchaseUnitSelect).toBeVisible();
    await purchaseUnitSelect.selectOption({ label: "thùng (1=24)" });
    await purchaseUnitSelect.dispatchEvent("input");

    const unitCostInput = page.locator("#quickPurchaseUnitCostInput");
    await expect(unitCostInput).toHaveValue("200000");
  }

  expectNoRuntimeErrors(runtime);
});
