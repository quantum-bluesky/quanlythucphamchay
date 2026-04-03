const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  expectNoRuntimeErrors,
  expectScreenTitle,
} = require("./support/ui");

test("mobile floating clusters auto-hide to screen edges and reveal without firing actions", async ({ page }) => {
  const runtime = attachRuntimeTracking(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expectScreenTitle(page, "Kiểm tra tồn kho");

  const menuPanel = page.locator("#menuPanel");
  const floatingSearchDock = page.locator("#floatingSearchDock");
  const screenToolbox = page.locator(".screen-toolbox");
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

  expectNoRuntimeErrors(runtime);
});
