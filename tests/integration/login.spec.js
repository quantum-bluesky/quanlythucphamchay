const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  collectToast,
  expectNoRuntimeErrors,
  expectScreenTitle,
  switchMenu,
} = require("./support/ui");

test("ACC-LOG-01 normal user and admin login update header state and permissions correctly", async ({ page }) => {
  const runtime = attachRuntimeTracking(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await expect(page.locator("#adminLogoutButton")).toHaveText("Login");
  await expect(page.locator("#adminSessionUserLabel")).toBeHidden();

  await page.locator("#adminLogoutButton").click();
  await expectScreenTitle(page, "Master Admin");

  await page.locator("#adminUsernameInput").fill("staff");
  await page.locator("#adminPasswordInput").fill("staff12345");
  await page.locator('#adminLoginForm button[type="submit"]').click();
  await collectToast(page, runtime, "user-login");

  await expect(page.locator("#adminLogoutButton")).toHaveText("Logout");
  await expect(page.locator("#adminSessionUserLabel")).toHaveText("staff");
  await expect(page.locator("#adminModulePanel")).toBeHidden();
  await expect(page.locator("#adminLoginPanel")).toBeVisible();

  await switchMenu(page, "inventory");
  await expectScreenTitle(page, "Kiểm tra tồn kho");
  await expect(page.locator('[data-product-action="toggle-expand"]').first()).toHaveCount(0);

  await page.locator("#adminLogoutButton").click();
  await collectToast(page, runtime, "user-logout");
  await expect(page.locator("#adminLogoutButton")).toHaveText("Login");
  await expect(page.locator("#adminSessionUserLabel")).toBeHidden();

  await switchMenu(page, "admin");
  await expectScreenTitle(page, "Master Admin");
  await page.locator("#adminUsernameInput").fill("masteradmin");
  await page.locator("#adminPasswordInput").fill("admin12345");
  await page.locator('#adminLoginForm button[type="submit"]').click();
  await collectToast(page, runtime, "admin-login");

  await expect(page.locator("#adminLogoutButton")).toHaveText("Logout");
  await expect(page.locator("#adminSessionUserLabel")).toHaveText("masteradmin");
  await expect(page.locator("#adminModulePanel")).toBeVisible();

  await switchMenu(page, "inventory");
  await expect(page.locator('[data-product-action="toggle-expand"]').first()).toBeVisible();

  expectNoRuntimeErrors(runtime);
});
