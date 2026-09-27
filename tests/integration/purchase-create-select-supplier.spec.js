const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginUser,
  autoLoginUserRequest,
  collectToast,
  expectNoRuntimeErrors,
  switchMenu,
} = require("./support/ui");

test("Issue 172: Select supplier when creating new purchase draft", async ({ page, request }) => {
  test.setTimeout(90000);
  const runtime = attachRuntimeTracking(page);
  await autoLoginUserRequest(request);

  await page.goto(process.env.TEST_ADMIN_PATH || "admin");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });

  await switchMenu(page, "purchases");

  const supplierInput = page.locator("#purchaseSupplierInput");
  const createDraftBtn = page.locator("#createPurchaseDraftButton");

  // 1. Kiểm tra ô nhập NCC luôn tương tác được khi ở màn hình Nhập hàng
  await expect(supplierInput).toBeVisible();
  await expect(supplierInput).toBeEnabled();

  // 2. Nhập tên nhà cung cấp mới và nhấn Enter
  const testSupplierName = "NCC Test Issue 172 Auto";
  await supplierInput.fill(testSupplierName);
  await supplierInput.press("Enter");
  await page.waitForTimeout(300);

  // Ô NCC vẫn giữ đúng tên NCC vừa nhập và tạo phiếu nháp
  await expect(supplierInput).toHaveValue(testSupplierName);

  // Thêm một mặt hàng gợi ý vào phiếu
  const suggestionRow = page.locator("#purchaseSuggestionList .sales-product-row").first();
  await expect(suggestionRow).toBeVisible();
  const addBtn = suggestionRow.locator('[data-purchase-suggestion-action="add"]').first();
  await addBtn.click();
  await page.waitForTimeout(400);

  // Kiểm tra tên NCC vẫn giữ nguyên sau khi thêm mặt hàng
  await expect(supplierInput).toHaveValue(testSupplierName);

  // 3. Test nút 'Tạo phiếu' tạo phiếu nháp mới và ô NCC được reset về rỗng để nhập NCC mới
  await createDraftBtn.click();
  await page.waitForTimeout(300);
  await expect(supplierInput).toHaveValue("");
  await expect(supplierInput).toBeEnabled();
  const testSupplier2 = "NCC Test Bam Tao Phieu";
  await supplierInput.fill(testSupplier2);
  await supplierInput.press("Enter");
  await page.waitForTimeout(300);
  await expect(supplierInput).toHaveValue(testSupplier2);

  // 4. Test chọn NCC từ màn hình Nhà cung cấp
  await switchMenu(page, "suppliers");
  const firstSupplierCard = page.locator(".supplier-card").first();
  if (await firstSupplierCard.isVisible()) {
    const selectBtn = firstSupplierCard.locator('[data-supplier-action="select"]');
    if (await selectBtn.isVisible()) {
      const selectedSupplierName = ((await firstSupplierCard.locator("strong").first().textContent()) || "").trim();
      await selectBtn.click();
      await page.waitForTimeout(400);

      // Chuyển sang màn hình Nhập hàng và hiển thị đúng NCC đã chọn
      await expect(supplierInput).toBeVisible();
      await expect(supplierInput).toHaveValue(selectedSupplierName);
    }
  }

  expectNoRuntimeErrors(runtime);
});
