const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginAdmin,
  gotoWithRetry,
  switchMenu,
  waitForAppReady,
} = require("./support/ui");

test.describe("Issue 174: List inputs quick clear button", () => {
  test("[IT-LIST-01] clear buttons appear when typing and clear input on click for all list inputs", async ({
    page,
    request,
  }) => {
    attachRuntimeTracking(page, { autoAcceptDialogs: true });

    await gotoWithRetry(page, "/admin");
    await page.waitForLoadState("networkidle");
    await autoLoginAdmin(page, request);
    await page.reload({ waitUntil: "networkidle" });
    await waitForAppReady(page);

    // 1. Màn Tạo đơn: customerLookupInput
    await switchMenu(page, "create-order");
    const customerInput = page.locator("#customerLookupInput");
    await expect(customerInput).toBeVisible();

    const customerWrap = customerInput.locator("xpath=..");
    const customerClearBtn = customerWrap.locator(".search-clear-button");
    await expect(customerClearBtn).toHaveCount(1);
    await expect(customerClearBtn).toBeHidden();

    await customerInput.fill("Khách hàng thử nghiệm");
    await expect(customerClearBtn).toBeVisible();

    await customerClearBtn.click();
    await expect(customerInput).toHaveValue("");
    await expect(customerClearBtn).toBeHidden();

    // 2. Màn Xuất nhanh (bulk-orders): bulkCustomerLookupInput
    await switchMenu(page, "bulk-orders");
    const bulkCustomerInput = page.locator("#bulkCustomerLookupInput");
    await expect(bulkCustomerInput).toBeVisible();

    const bulkCustomerWrap = bulkCustomerInput.locator("xpath=..");
    const bulkCustomerClearBtn = bulkCustomerWrap.locator(".search-clear-button");
    await expect(bulkCustomerClearBtn).toHaveCount(1);
    await expect(bulkCustomerClearBtn).toBeHidden();

    await bulkCustomerInput.fill("Khách xuất nhanh thử nghiệm");
    await expect(bulkCustomerClearBtn).toBeVisible();

    await bulkCustomerClearBtn.click();
    await expect(bulkCustomerInput).toHaveValue("");
    await expect(bulkCustomerClearBtn).toBeHidden();

    // 3. Màn Nhập hàng: purchaseSupplierInput
    await switchMenu(page, "purchases");
    const supplierInput = page.locator("#purchaseSupplierInput");
    await expect(supplierInput).toBeVisible();

    const supplierWrap = supplierInput.locator("xpath=..");
    const supplierClearBtn = supplierWrap.locator(".search-clear-button");
    await expect(supplierClearBtn).toHaveCount(1);

    await supplierInput.fill("Nhà cung cấp thử nghiệm");
    await expect(supplierClearBtn).toBeVisible();

    await supplierClearBtn.click();
    await expect(supplierInput).toHaveValue("");
    await expect(supplierClearBtn).toBeHidden();

    // 4. Màn Tồn kho: productLookupInput
    await switchMenu(page, "inventory");
    const productInput = page.locator("#productLookupInput");
    await expect(productInput).toBeVisible();

    const productWrap = productInput.locator("xpath=..");
    const productClearBtn = productWrap.locator(".search-clear-button");
    await expect(productClearBtn).toHaveCount(1);
    await expect(productClearBtn).toBeHidden();

    await productInput.fill("Sản phẩm thử nghiệm");
    await expect(productClearBtn).toBeVisible();

    await productClearBtn.click();
    await expect(productInput).toHaveValue("");
    await expect(productClearBtn).toBeHidden();

    // 5. Màn Tồn kho: inventoryReceiptProductInput (mở collapse phiếu điều chỉnh tồn)
    const toggleReceiptBtn = page.locator("#inventoryReceiptToggleButton");
    if (await toggleReceiptBtn.isVisible()) {
      await toggleReceiptBtn.click();
    }
    const receiptProductInput = page.locator("#inventoryReceiptProductInput");
    await expect(receiptProductInput).toBeVisible();

    const receiptWrap = receiptProductInput.locator("xpath=..");
    const receiptClearBtn = receiptWrap.locator(".search-clear-button");
    await expect(receiptClearBtn).toHaveCount(1);
    await expect(receiptClearBtn).toBeHidden();

    await receiptProductInput.fill("Sản phẩm phiếu điều chỉnh");
    await expect(receiptClearBtn).toBeVisible();

    await receiptClearBtn.click();
    await expect(receiptProductInput).toHaveValue("");
    await expect(receiptClearBtn).toBeHidden();

    // 6. Màn Lịch sử biến động: productMovementProductInput
    await switchMenu(page, "product-movements");
    const movementProductInput = page.locator("#productMovementProductInput");
    await expect(movementProductInput).toBeVisible();

    const movementWrap = movementProductInput.locator("xpath=..");
    const movementClearBtn = movementWrap.locator(".search-clear-button");
    await expect(movementClearBtn).toHaveCount(1);
    await expect(movementClearBtn).toBeHidden();

    await movementProductInput.fill("Sản phẩm biến động");
    await expect(movementClearBtn).toBeVisible();

    await movementClearBtn.click();
    await expect(movementProductInput).toHaveValue("");
    await expect(movementClearBtn).toBeHidden();
  });
});
