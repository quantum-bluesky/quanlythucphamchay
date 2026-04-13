const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginAdmin,
  autoLoginUser,
  collectToast,
  expectNoRuntimeErrors,
  expectScreenTitle,
  switchMenu,
} = require("./support/ui");

test("ACC-LOG-01 normal user and admin login update header state and permissions correctly", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await expect(page.locator("#adminLogoutButton")).toHaveText("Login");
  await expect(page.locator("#adminSessionUserLabel")).toBeHidden();

  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await collectToast(page, runtime, "user-login");

  await expect(page.locator("#adminLogoutButton")).toHaveText("Logout");
  await expect(page.locator("#adminSessionUserLabel")).not.toBeHidden();
  await expect(page.locator("#adminModulePanel")).toBeHidden();

  await switchMenu(page, "inventory");
  await expectScreenTitle(page, "Kiểm tra tồn kho");
  await expect(page.locator('[data-product-action="toggle-expand"]').first()).toHaveCount(0);

  await page.evaluate(async () => {
    await fetch("/api/session/logout", { method: "POST" });
  });
  await page.reload({ waitUntil: "networkidle" });
  await collectToast(page, runtime, "user-logout");
  await expect(page.locator("#adminLogoutButton")).toHaveText("Login");
  await expect(page.locator("#adminSessionUserLabel")).toBeHidden();

  await autoLoginAdmin(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await collectToast(page, runtime, "admin-login");
  await switchMenu(page, "admin");
  await expectScreenTitle(page, "Master Admin");

  await expect(page.locator("#adminLogoutButton")).toHaveText("Logout");
  await expect(page.locator("#adminSessionUserLabel")).toHaveText("masteradmin");
  await expect(page.locator("#adminModulePanel")).toBeVisible();

  await switchMenu(page, "inventory");
  await expect(page.locator('[data-product-action="toggle-expand"]').first()).toBeVisible();

  expectNoRuntimeErrors(runtime);
});
