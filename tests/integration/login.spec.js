const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginAdmin,
  autoLoginProcurementManager,
  autoLoginUser,
  collectToast,
  expectNoRuntimeErrors,
  expectScreenTitle,
  switchMenu,
} = require("./support/ui");

test("ACC-LOG-01 normal user, delegated stock adjust user, and admin update header state and permissions correctly", async ({ page, request }) => {
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

  await autoLoginProcurementManager(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await collectToast(page, runtime, "inventory-manager-login");
  await switchMenu(page, "inventory");
  await expect(page.locator("#adminSessionUserLabel")).toHaveText("bizmanager");
  await expect(page.locator("#adminModulePanel")).toBeHidden();
  await expect(page.locator("#quickPanel")).toBeVisible();
  await expect(page.locator("#noteInput")).toHaveAttribute("required", "");
  await page.locator('[data-product-action="toggle-expand"]').first().click();
  await expect(page.locator(".product-row-body").first()).toBeVisible();
  await expect(page.locator("[data-adjust-reason-input]").first()).toBeVisible();
  await expect(page.locator('[data-delta="1"]').first()).toBeVisible();
  await expect(page.locator('[data-product-action="start-price-edit"]')).toHaveCount(0);

  await page.evaluate(async () => {
    await fetch("/api/session/logout", { method: "POST" });
  });
  await page.reload({ waitUntil: "networkidle" });
  await collectToast(page, runtime, "inventory-manager-logout");
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

test("IT-LOG-03 bootstrap retries once when app module import fails during authenticated reload", async ({ page, request }) => {
  let firstAppModuleRequestFailed = false;

  await page.route(/\/static\/app\.js(?:\?|$)/, async (route) => {
    if (!firstAppModuleRequestFailed) {
      firstAppModuleRequestFailed = true;
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page.locator("#globalBusyOverlay")).toBeVisible();
  await expect(page.locator("#adminLogoutButton")).toHaveText("Logout", { timeout: 20000 });
  await expectScreenTitle(page, "Kiểm tra tồn kho");
  await expect(page.locator("#globalBusyOverlay")).toBeHidden();
  expect(firstAppModuleRequestFailed).toBeTruthy();
});

test("IT-LOG-04 quick account picker and switch user require password before changing permissions", async ({ page }) => {
  const runtime = attachRuntimeTracking(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await expect(page.locator('[data-menu-section="login"]')).toHaveClass(/is-active/);
  await expect(page.locator("#adminUsernameInput")).toHaveValue("masteradmin");
  const quickAccountLabels = await page.locator("#adminQuickUserSelect option").evaluateAll((options) =>
    options.map((option) => option.textContent.trim())
  );
  expect(quickAccountLabels).toContain("Master Admin");
  expect(quickAccountLabels).toContain("Biz Manager");
  expect(quickAccountLabels).toContain("User thường");
  expect(quickAccountLabels).not.toContain("masteradmin");
  expect(quickAccountLabels).not.toContain("bizmanager");
  expect(quickAccountLabels).not.toContain("user");

  await page.locator("#adminQuickUserSelect").selectOption("bizmanager");
  await expect(page.locator("#adminUsernameInput")).toHaveValue("bizmanager");
  await page.locator("#adminPasswordInput").fill("biz12345");
  await page.locator('#adminLoginForm button[type="submit"]').click();
  await collectToast(page, runtime, "quick-biz-login");

  await expect(page.locator("#adminLogoutButton")).toHaveText("Logout");
  await expect(page.locator("#adminSessionUserLabel")).toHaveText("bizmanager");
  await expect(page.locator("#adminModulePanel")).toBeHidden();
  const switchAccountLabels = await page.locator("#adminSwitchUserSelect option").evaluateAll((options) =>
    options.map((option) => option.textContent.trim())
  );
  expect(switchAccountLabels).toContain("Chuyển quyền...");
  expect(switchAccountLabels).toContain("Master Admin");
  expect(switchAccountLabels).toContain("Biz Manager");
  expect(switchAccountLabels).toContain("User thường");
  expect(switchAccountLabels).not.toContain("masteradmin");
  expect(switchAccountLabels).not.toContain("bizmanager");
  expect(switchAccountLabels).not.toContain("user");

  await page.locator("#adminSwitchUserSelect").selectOption("user");
  await collectToast(page, runtime, "switch-user-logout");

  await expect(page.locator('[data-menu-section="login"]')).toHaveClass(/is-active/);
  await expect(page.locator("#adminLogoutButton")).toHaveText("Login");
  await expect(page.locator("#adminSessionUserLabel")).toBeHidden();
  await expect(page.locator("#adminUsernameInput")).toHaveValue("user");
  await expect(page.locator("#adminPasswordInput")).toHaveValue("");

  await page.locator("#adminPasswordInput").fill("user12345");
  await page.locator('#adminLoginForm button[type="submit"]').click();
  await collectToast(page, runtime, "switch-user-login");

  await expect(page.locator("#adminLogoutButton")).toHaveText("Logout");
  await expect(page.locator("#adminSessionUserLabel")).toHaveText("user");
  await expect(page.locator("#adminModulePanel")).toBeHidden();
  expectNoRuntimeErrors(runtime);
});
