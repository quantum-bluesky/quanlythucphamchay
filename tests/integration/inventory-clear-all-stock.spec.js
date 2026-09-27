const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginAdmin,
  autoLoginAdminRequest,
  collectToast,
  expectNoRuntimeErrors,
  switchMenu,
} = require("./support/ui");

test("IT-INV-03 admin can use clear all button to reduce stock to 0 with confirmation", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page, { autoAcceptDialogs: false });
  const adminCookie = await autoLoginAdminRequest(request);

  await page.goto(process.env.TEST_ADMIN_PATH || "admin");
  await page.waitForLoadState("networkidle");
  await autoLoginAdmin(page, request);
  await page.reload({ waitUntil: "networkidle" });

  await switchMenu(page, "inventory");

  // Đảm bảo panel chỉnh tồn trực tiếp mở
  const quickPanel = page.locator("#quickPanel");
  if (!(await quickPanel.isVisible())) {
    await page.locator("#quickPanelToggle").click();
    await expect(quickPanel).toBeVisible();
  }

  const clearAllButton = page.locator("#quickClearAllStockButton");
  await expect(clearAllButton).toBeVisible();
  await expect(clearAllButton).toHaveText("Xuất tất cả");

  // 1. Click khi chưa chọn sản phẩm -> báo lỗi
  await page.locator("#productLookupInput").fill("");
  await clearAllButton.click();
  const emptyToast = await collectToast(page, runtime, "it-inv-03-empty-product", { isError: true });
  expect(emptyToast).toContain("Vui lòng chọn sản phẩm cần xuất tất cả");

  // 2. Click khi sản phẩm đã hết hàng (tồn = 0, Bò lát xào) -> báo lỗi không có tồn
  await page.locator("#productLookupInput").fill("Bò lát xào");
  await clearAllButton.click();
  const zeroStockToast = await collectToast(page, runtime, "it-inv-03-zero-stock", { isError: true });
  expect(zeroStockToast).toContain("hiện không có tồn kho để xuất");

  // 3. Click khi sản phẩm còn hàng (Chả quế chay, tồn = 4)
  await page.locator("#productLookupInput").fill("Chả quế chay");

  let dialogHandled = false;
  page.once("dialog", async (dialog) => {
    dialogHandled = true;
    const message = dialog.message();
    expect(message).toContain("Xác nhận xuất tất cả");
    expect(message).toContain("Chả quế chay");
    expect(message).toContain("để giảm tồn kho về 0?");
    await dialog.accept();
  });

  await clearAllButton.click();
  await page.waitForTimeout(500);
  expect(dialogHandled).toBeTruthy();

  const successToast = await collectToast(page, runtime, "it-inv-03-success", { errorPattern: /^$/ });
  expect(successToast).toContain("Đã cập nhật tồn kho");

  // 4. Kiểm tra tồn kho của Chả quế chay trên state API
  const stateResponse = await request.get("./api/state?transaction_limit=16", {
    headers: { Cookie: adminCookie },
  });
  expect(stateResponse.ok()).toBeTruthy();
  const latestState = await stateResponse.json();
  const product = (latestState.products || []).find((p) => p.name === "Chả quế chay");
  expect(product).toBeTruthy();
  expect(Number(product.current_stock)).toBe(0);

  // 5. Kiểm tra trên UI tồn kho hiển thị hết hàng ("Không còn")
  const productRow = page.locator('#productGrid .product-row').filter({ hasText: "Chả quế chay" }).first();
  await expect(productRow.locator(".product-row-stock")).toHaveText("Không còn");

  expectNoRuntimeErrors(runtime);
});
