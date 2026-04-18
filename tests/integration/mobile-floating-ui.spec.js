const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginUser,
  expectNoRuntimeErrors,
  expectScreenTitle,
  switchMenu,
  waitForAppReady,
} = require("./support/ui");

test("IT-MOB-01 mobile floating clusters auto-hide to screen edges and reveal without firing actions", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await waitForAppReady(page);
  await expectScreenTitle(page, "Kiểm tra tồn kho");

  const menuPanel = page.locator("#menuPanel");
  const floatingSearchDock = page.locator("#floatingSearchDock");
  const screenToolbox = page.locator(".screen-toolbox");
  const screenHeaderBar = page.locator("#screenHeaderBar");
  const helpModal = page.locator("#helpModal");
  const clickVisibleEdge = async (locator, side = "left") => {
    const box = await locator.boundingBox();
    expect(box).toBeTruthy();
    const x = side === "right"
      ? box.x + 18
      : box.x + box.width - 18;
    await page.mouse.click(x, box.y + 18);
  };

  await page.locator("body").click({ position: { x: 220, y: 260 } });
  await expect(menuPanel).toHaveClass(/is-edge-hidden/);
  await expect(floatingSearchDock).toHaveClass(/is-edge-hidden/);
  await expect(screenToolbox).toHaveClass(/is-edge-hidden/);

  await clickVisibleEdge(menuPanel, "left");
  await expect(menuPanel).not.toHaveClass(/is-edge-hidden/);
  await expect(page.locator("#menuToggleButton")).toHaveAttribute("aria-expanded", "false");

  await clickVisibleEdge(floatingSearchDock, "left");
  await expect(floatingSearchDock).not.toHaveClass(/is-edge-hidden/);

  await clickVisibleEdge(screenToolbox, "right");
  await expect(screenToolbox).not.toHaveClass(/is-edge-hidden/);
  await expect(helpModal).toBeHidden();
  await expectScreenTitle(page, "Kiểm tra tồn kho");

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(screenHeaderBar).toBeVisible();
  const headerBox = await screenHeaderBar.boundingBox();
  expect(headerBox).toBeTruthy();
  expect(headerBox.y).toBeLessThan(20);

  expectNoRuntimeErrors(runtime);
});

test("IT-MOB-02 screen header stays visible on tablet and version button still opens about", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);

  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await waitForAppReady(page);
  await expectScreenTitle(page, "Kiểm tra tồn kho");

  const screenHeaderBar = page.locator("#screenHeaderBar");
  const versionButton = page.locator("#appVersionButton");

  await expect(screenHeaderBar).toBeVisible();
  await expect(versionButton).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const headerBox = await screenHeaderBar.boundingBox();
  expect(headerBox).toBeTruthy();
  expect(headerBox.y).toBeLessThan(20);

  await switchMenu(page, "reports");
  await expectScreenTitle(page, "Báo cáo");

  await versionButton.click();
  await expectScreenTitle(page, "About ứng dụng");
  await expect(page.locator("#aboutSection")).toHaveClass(/is-active/);

  expectNoRuntimeErrors(runtime);
});

test("IT-NAV-02 desktop menu auto-collapses outside and expands from the menu button", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await waitForAppReady(page);
  await expectScreenTitle(page, "Kiểm tra tồn kho");

  const menuPanel = page.locator("#menuPanel");
  const menuToggleButton = page.locator("#menuToggleButton");
  const inventoryMenuButton = page.locator('[data-menu="inventory"]');
  const reportsMenuButton = page.locator('[data-menu="reports"]');

  await expect(menuPanel).toHaveClass(/is-collapsed/);
  await expect(menuToggleButton).toHaveAttribute("aria-expanded", "false");

  await menuToggleButton.hover();
  await expect(menuPanel).not.toHaveClass(/is-collapsed/);
  await expect(menuToggleButton).toHaveAttribute("aria-expanded", "true");

  const expandedPanelBox = await menuPanel.boundingBox();
  const expandedButtonBox = await inventoryMenuButton.boundingBox();
  expect(expandedPanelBox).toBeTruthy();
  expect(expandedButtonBox).toBeTruthy();
  expect(expandedPanelBox.width).toBeLessThan(720);
  expect(expandedButtonBox.width).toBeGreaterThan(90);
  expect(expandedButtonBox.width).toBeLessThan(160);

  await page.mouse.move(1180, 260);
  await expect(menuPanel).toHaveClass(/is-collapsed/);
  await expect(menuToggleButton).toHaveAttribute("aria-expanded", "false");

  await menuToggleButton.click();
  await expect(menuPanel).not.toHaveClass(/is-collapsed/);
  await reportsMenuButton.click();
  await expectScreenTitle(page, "Báo cáo");
  await expect(menuPanel).toHaveClass(/is-collapsed/);

  await menuToggleButton.click();
  await expect(menuPanel).not.toHaveClass(/is-collapsed/);
  await page.locator("body").click({ position: { x: 1180, y: 260 } });
  await expect(menuPanel).toHaveClass(/is-collapsed/);

  expectNoRuntimeErrors(runtime);
});
