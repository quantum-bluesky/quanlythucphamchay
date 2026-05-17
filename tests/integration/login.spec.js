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
  await expect(page.locator("#quickPanel")).toBeHidden();
  await expect(page.locator('[data-product-action="create-receipt"]')).toHaveCount(0);
  await expect(page.locator('[data-product-action="start-price-edit"]')).toHaveCount(0);
  await expect(page.locator('[data-product-action="toggle-expand"]').first()).toBeVisible();

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
  await expect(page.locator("#quickPanel")).toBeVisible();
  await expect(page.locator("#noteInput")).toHaveAttribute("required", "");
  await expect(page.locator('[data-product-action="toggle-expand"]').first()).toBeVisible();

  expectNoRuntimeErrors(runtime);
});

test("IT-LOG-02 login form submit does not trigger login guard dialog while busy overlay is active", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page, { autoAcceptDialogs: false });
  const dialogMessages = [];
  const candidates = [
    { username: "user", password: "user12345" },
    { username: "staff", password: "staff12345" },
  ];

  page.on("dialog", async (dialog) => {
    dialogMessages.push(dialog.message());
    await dialog.dismiss();
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  let loginCandidate = null;
  for (const candidate of candidates) {
    const response = await request.post("/api/session/login", {
      data: candidate,
    });
    if (response.ok()) {
      loginCandidate = candidate;
      break;
    }
  }
  expect(loginCandidate).toBeTruthy();

  await expect(page.locator('[data-menu-section="login"]')).toHaveClass(/is-active/);
  await page.locator("#adminUsernameInput").fill(loginCandidate.username);
  await page.locator("#adminPasswordInput").fill(loginCandidate.password);
  await page.locator('#adminLoginForm button[type="submit"]').click();

  await expect(page.locator("#adminLogoutButton")).toHaveText("Logout");
  await expect(page.locator("#globalBusyOverlay")).toBeHidden();
  await expect(page.locator('[data-menu-section="login"]')).not.toHaveClass(/is-active/);
  expect(dialogMessages).toEqual([]);
  expectNoRuntimeErrors(runtime);
});
