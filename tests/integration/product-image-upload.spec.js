const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginAdmin,
  expectNoRuntimeErrors,
  gotoWithRetry,
  switchMenu,
} = require("./support/ui");
const fs = require("fs");
const path = require("path");

// IT-PROD-IMG-01: Upload anh san pham thanh cong qua endpoint /api/products/images/upload
test("IT-PROD-IMG-01 upload anh san pham thanh cong", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);

  await gotoWithRetry(page, "/admin");
  await page.waitForLoadState("networkidle");
  await autoLoginAdmin(page, request);
  await page.reload({ waitUntil: "networkidle" });

  // Chuyen sang man San pham
  await switchMenu(page, "products");
  await expect(page.locator("#productFormToggleButton")).toBeVisible({ timeout: 5000 });

  // Mo form them san pham
  await page.click("#productFormToggleButton");
  await page.waitForTimeout(400);

  // Nut upload phai hien thi sau khi mo form
  await expect(page.locator("#uploadProductImageButton")).toBeVisible({ timeout: 5000 });

  // Tao file anh tam (JPEG header toi gian)
  const testImagePath = path.join(__dirname, "test-upload.jpg");
  const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  fs.writeFileSync(testImagePath, jpegBytes);

  try {
    // Click nut upload de mo file chooser
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.click("#uploadProductImageButton");
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(testImagePath);

    // Doi upload xu ly xong
    await page.waitForTimeout(2000);

    // Kiem tra khong co loi JS runtime
    expectNoRuntimeErrors(runtime);

    // Kiem tra URL anh da duoc them vao truong images
    const imagesValue = await page.locator("textarea[name='images']").inputValue();
    expect(imagesValue.trim(), "Anh phai duoc ghi nhan vao truong images sau khi upload thanh cong").toBeTruthy();
    expect(imagesValue).toContain("/images/products/");
  } finally {
    if (fs.existsSync(testImagePath)) fs.unlinkSync(testImagePath);
  }
});



