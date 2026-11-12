const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginUser,
  autoLoginUserRequest,
  collectToast,
  expectNoRuntimeErrors,
  switchMenu,
} = require("./support/ui");

test("Issue 171: Use active purchase in quick purchase and submit", async ({ page, request }) => {
  test.setTimeout(90000);
  const runtime = attachRuntimeTracking(page);
  const userCookie = await autoLoginUserRequest(request);

  await page.goto(process.env.TEST_ADMIN_PATH || "admin");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });

  await switchMenu(page, "purchases");

  // Kiểm tra xem có purchase panel không
  const quickToggle = page.locator('[data-quick-purchase-action="toggle-panel"]');
  if (await quickToggle.isVisible() && (await quickToggle.textContent()).trim() === "Mở rộng") {
    await quickToggle.click();
  }

  // Click 'Lấy từ phiếu đang mở'
  const useActiveBtn = page.locator('[data-quick-purchase-action="use-active-purchase"]');
  await expect(useActiveBtn).toBeVisible();
  
  // Lắng nghe dialog (confirm) nếu có
  page.on("dialog", async (dialog) => {
    console.log("Dialog message:", dialog.message());
    await dialog.accept();
  });

  await useActiveBtn.click();
  await page.waitForTimeout(500);

  // Click 'Lưu nhập nhanh'
  const submitBtn = page.locator('[data-quick-purchase-action="submit"]');
  await submitBtn.click();

  const toast = await collectToast(page, runtime, "issue-171", { timeout: 10000 });
  console.log("Toast result:", toast);

  await expect(submitBtn).toHaveText("Đã cập nhật");
  expectNoRuntimeErrors(runtime);
});
