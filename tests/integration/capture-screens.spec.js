const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { attachRuntimeTracking, autoLoginUser, expectScreenTitle, switchMenu, waitForAppReady } = require("./support/ui");

// Test case: ACC-SCR-CAP-01 - Capture all main screens
test("ACC-SCR-CAP-01 capture all main screens and save to test-results", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const today = new Date();
  const dateYYYYMMDD = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const screenshotDir = path.join(process.cwd(), `test-results/capture/mobile/${dateYYYYMMDD}`);

  // Create screenshot directory if needed
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  // Login
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });

  // Define screens to capture
  const screensToCapture = [
    { menu: "inventory", title: "Kiểm tra tồn kho", filename: "01-inventory.png" },
    { menu: "create-order", title: "Tạo đơn xuất hàng", filename: "02-create-order.png" },
    { menu: "orders", title: "Đơn hàng", filename: "03-orders.png" },
    { menu: "customers", title: "Khách hàng", filename: "04-customers.png" },
    { menu: "products", title: "Sản phẩm", filename: "05-products.png" },
    { menu: "purchases", title: "Nhập hàng", filename: "06-purchases.png" },
    { menu: "suppliers", title: "Nhà cung cấp", filename: "07-suppliers.png" },
    { menu: "reports", title: "Báo cáo", filename: "08-reports.png" },
    { menu: "history", title: "Lịch sử & khôi phục", filename: "09-history.png" },
    { menu: "admin", title: "Master Admin", filename: "10-admin.png" },
  ];

  // Capture each screen
  for (const screen of screensToCapture) {
    try {
      await switchMenu(page, screen.menu);
      await expectScreenTitle(page, screen.title);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      const filepath = path.join(screenshotDir, screen.filename);
      await page.screenshot({ path: filepath, fullPage: true });
      console.log(`✓ Captured: ${screen.filename}`);
    } catch (error) {
      runtime.errors.push(`Failed to capture ${screen.filename}: ${error.message}`);
      console.error(`✗ Failed to capture ${screen.filename}:`, error.message);
    }
  }

  // Verify screenshots were created
  const files = fs.readdirSync(screenshotDir);
  console.log(`\nTotal screenshots captured: ${files.length}`);
  console.log("Files:", files.join(", "));

  expect(files.length).toBeGreaterThan(0);
  expect(runtime.errors).toEqual([]);
});

// Test case: ACC-SCR-CAP-02 - Capture all main screens on Tablet
test("ACC-SCR-CAP-02 capture all main screens on tablet and save to test-results", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);
  const today = new Date();
  const dateYYYYMMDD = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const screenshotDir = path.join(process.cwd(), `test-results/capture/tablet/${dateYYYYMMDD}`);

  // Create screenshot directory if needed
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  // Set tablet viewport (iPad size: 768x1024)
  await page.setViewportSize({ width: 768, height: 1024 });

  // Login
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });

  // Define screens to capture
  const screensToCapture = [
    { menu: "inventory", title: "Kiểm tra tồn kho", filename: "01-inventory.png" },
    { menu: "create-order", title: "Tạo đơn xuất hàng", filename: "02-create-order.png" },
    { menu: "orders", title: "Đơn hàng", filename: "03-orders.png" },
    { menu: "customers", title: "Khách hàng", filename: "04-customers.png" },
    { menu: "products", title: "Sản phẩm", filename: "05-products.png" },
    { menu: "purchases", title: "Nhập hàng", filename: "06-purchases.png" },
    { menu: "suppliers", title: "Nhà cung cấp", filename: "07-suppliers.png" },
    { menu: "reports", title: "Báo cáo", filename: "08-reports.png" },
    { menu: "history", title: "Lịch sử & khôi phục", filename: "09-history.png" },
    { menu: "admin", title: "Master Admin", filename: "10-admin.png" },
  ];

  // Capture each screen
  for (const screen of screensToCapture) {
    try {
      await switchMenu(page, screen.menu);
      await expectScreenTitle(page, screen.title);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);

      const filepath = path.join(screenshotDir, screen.filename);
      await page.screenshot({ path: filepath, fullPage: true });
      console.log(`✓ Captured (tablet): ${screen.filename}`);
    } catch (error) {
      runtime.errors.push(`Failed to capture tablet ${screen.filename}: ${error.message}`);
      console.error(`✗ Failed to capture tablet ${screen.filename}:`, error.message);
    }
  }

  // Verify screenshots were created
  const files = fs.readdirSync(screenshotDir);
  console.log(`\nTotal tablet screenshots captured: ${files.length}`);
  console.log("Files:", files.join(", "));

  expect(files.length).toBeGreaterThan(0);
  expect(runtime.errors).toEqual([]);
});
