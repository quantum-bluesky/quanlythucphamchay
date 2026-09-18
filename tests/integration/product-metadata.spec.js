const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginUser,
  expectNoRuntimeErrors,
  switchMenu,
  waitForAppReady,
} = require("./support/ui");

test("IT-PROD-LIFE-01 product life metadata saves from inline edit", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  await page.goto(process.env.TEST_ADMIN_PATH || "admin");
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
  await expect(page.locator("#toast")).toContainText("Đã cập nhật sản phẩm.");
  
  // Verify it appears in the DOM
  await expect(page.locator("#productManageList")).toContainText("Hạn 77 ngày");
  await expect(page.locator("#productManageList")).toContainText("Bảo quản 88 ngày");

  expectNoRuntimeErrors(runtime);
});

test("IT-PUB-02 full product edit can hide and restore a public item", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  await page.goto(process.env.TEST_ADMIN_PATH || "admin");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await waitForAppReady(page);
  await switchMenu(page, "products");

  const initialPublicResponse = await request.get("./api/public/products");
  expect(initialPublicResponse.ok()).toBeTruthy();
  const initialPublicPayload = await initialPublicResponse.json();
  const product = initialPublicPayload.products[0];
  expect(product).toBeTruthy();

  const editButton = page.locator(
    `[data-product-manage-action="edit-full"][data-product-id="${product.id}"]`,
  );
  await expect(editButton).toBeVisible();
  await editButton.click();

  const publicCheckbox = page.locator('#productForm input[name="is_public"]');
  await expect(publicCheckbox).toBeChecked();
  await publicCheckbox.uncheck();
  await page.locator("#productForm button[type='submit']").click();
  await expect(page.locator("#toast")).toContainText("Đã cập nhật sản phẩm.");

  const hiddenPublicResponse = await request.get("./api/public/products");
  expect(hiddenPublicResponse.ok()).toBeTruthy();
  const hiddenPublicPayload = await hiddenPublicResponse.json();
  expect(hiddenPublicPayload.products.some((item) => item.id === product.id)).toBeFalsy();

  await editButton.click();
  await expect(publicCheckbox).not.toBeChecked();

  // Restore the shared fixture so this regression test does not affect later public-catalog cases.
  await publicCheckbox.check();
  await page.locator("#productForm button[type='submit']").click();
  await expect(page.locator("#toast")).toContainText("Đã cập nhật sản phẩm.");

  expectNoRuntimeErrors(runtime);
});
