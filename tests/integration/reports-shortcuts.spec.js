const { test, expect } = require("@playwright/test");
const {
  attachRuntimeTracking,
  autoLoginUser,
  expectNoRuntimeErrors,
  expectScreenTitle,
  switchMenu,
} = require("./support/ui");

test("IT-REP-01 audit shortcut scrolls to receipt audit section", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });

  await switchMenu(page, "reports");
  await expectScreenTitle(page, "Báo cáo");
  await page.evaluate(() => window.scrollTo(0, 0));

  const auditSection = page.locator("#reportReceiptHistorySection");
  const beforeTop = await auditSection.evaluate((node) => node.getBoundingClientRect().top);

  await page.locator('[data-report-shortcut="audit"]').click();
  await page.waitForTimeout(500);

  const afterTop = await auditSection.evaluate((node) => node.getBoundingClientRect().top);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  expect(afterTop).toBeLessThan(beforeTop);
  expect(afterTop).toBeLessThan(viewportHeight - 120);

  expectNoRuntimeErrors(runtime);
});
