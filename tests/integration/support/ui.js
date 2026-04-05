const { expect } = require("@playwright/test");

function attachRuntimeTracking(page) {
  const state = {
    errors: [],
    toasts: [],
  };

  page.on("pageerror", (error) => {
    state.errors.push(`pageerror: ${error.message}`);
  });

  page.on("console", (message) => {
    const text = message.text() || "";
    if (message.type() === "error" && !/favicon\.ico/i.test(text)) {
      state.errors.push(`console:${text}`);
    }
  });

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  return state;
}

async function expectScreenTitle(page, title) {
  await expect(page.locator("#activeScreenBarTitle")).toHaveText(title);
}

async function switchMenu(page, menu) {
  const toggle = page.locator("#menuToggleButton");
  const menuPanel = page.locator("#menuPanel");
  if (await menuPanel.evaluate((node) => node.classList.contains("is-edge-hidden"))) {
    const box = await menuPanel.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width - 18, box.y + 18);
    }
    await page.waitForTimeout(200);
  }
  if (await toggle.isVisible()) {
    const expanded = await toggle.getAttribute("aria-expanded");
    if (expanded !== "true") {
      await toggle.click();
      await page.waitForTimeout(250);
    }
  }
  await page.locator(`[data-menu="${menu}"]`).click();
  await page.waitForTimeout(500);
}

async function collectToast(page, runtime, label, { errorPattern = /not defined|thất bại|error/i } = {}) {
  await page.waitForTimeout(900);
  const toast = page.locator("#toast:not([hidden])");
  if (!await toast.count()) {
    return "";
  }
  const text = ((await toast.first().textContent()) || "").trim();
  if (!text) {
    return "";
  }
  runtime.toasts.push(`${label}:${text}`);
  if (errorPattern.test(text)) {
    runtime.errors.push(`toast:${label}:${text}`);
  }
  return text;
}

async function reloadHealthy(page, runtime, label, expectedTitle) {
  await page.reload({ waitUntil: "networkidle" });
  if (expectedTitle) {
    await expectScreenTitle(page, expectedTitle);
  }
  await collectToast(page, runtime, label);
}

function expectNoRuntimeErrors(runtime) {
  expect(runtime.errors, runtime.errors.join("\n")).toEqual([]);
}

module.exports = {
  attachRuntimeTracking,
  collectToast,
  expectNoRuntimeErrors,
  expectScreenTitle,
  reloadHealthy,
  switchMenu,
};
