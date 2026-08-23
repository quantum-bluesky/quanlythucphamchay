const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginUser,
  expectNoRuntimeErrors,
} = require("./support/ui");

test("IT-UI-01 non-confirm toast stays above loading overlay", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);

  await page.goto("admin");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });

  const overlayCheck = await page.evaluate(() => {
    const overlay = document.getElementById("globalBusyOverlay");
    const toast = document.getElementById("toast");
    if (!overlay || !toast) {
      throw new Error("Thiếu node overlay hoặc toast.");
    }

    overlay.hidden = false;
    toast.hidden = false;
    toast.textContent = "Lỗi test overlay";
    toast.classList.add("error");

    const toastRect = toast.getBoundingClientRect();
    const centerX = Math.round(toastRect.left + toastRect.width / 2);
    const centerY = Math.round(toastRect.top + toastRect.height / 2);
    const topNode = document.elementFromPoint(centerX, centerY);

    return {
      overlayZIndex: Number(window.getComputedStyle(overlay).zIndex || 0),
      toastZIndex: Number(window.getComputedStyle(toast).zIndex || 0),
      toastOnTop: Boolean(topNode && topNode.closest("#toast")),
    };
  });

  expect(overlayCheck.toastZIndex).toBeGreaterThan(overlayCheck.overlayZIndex);
  expect(overlayCheck.toastOnTop).toBeTruthy();
  expectNoRuntimeErrors(runtime);
});



