const { test, expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const {
  attachRuntimeTracking,
  autoLoginAdmin,
  collectToast,
  expectNoRuntimeErrors,
  expectScreenTitle,
  reloadHealthy,
  switchMenu,
} = require("./support/ui");

test("ACC-ADM-01 / ACC-ADM-02 master admin login, export, import, backup and restore work on fixture DB", async ({ page, request }, testInfo) => {
  test.setTimeout(120000);
  const runtime = attachRuntimeTracking(page);
  const downloadsDir = testInfo.outputPath("downloads");
  fs.mkdirSync(downloadsDir, { recursive: true });

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await autoLoginAdmin(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await switchMenu(page, "admin");
  await expectScreenTitle(page, "Master Admin");
  await collectToast(page, runtime, "admin-login-auto", { errorPattern: /^$/ });
  await expect(page.locator("#adminModulePanel")).toBeVisible();

  await switchMenu(page, "inventory");
  await expectScreenTitle(page, "Kiểm tra tồn kho");
  const adminToggle = page.locator('[data-product-action="toggle-expand"]').first();
  await expect(adminToggle).toBeVisible();
  await adminToggle.click();
  await page.waitForTimeout(400);
  await expect(page.locator('[data-quantity-input]').first()).toBeVisible();

  await switchMenu(page, "admin");
  await expectScreenTitle(page, "Master Admin");
  await expect(page.locator("#adminModulePanel")).toBeVisible();

  await page.locator("#adminMasterFormatCustomers").selectOption("csv");
  const exportDownloadPromise = page.waitForEvent("download");
  await page.locator('[data-admin-export="customers"]').click();
  const exportDownload = await exportDownloadPromise;
  expect(exportDownload.suggestedFilename()).toMatch(/\.csv$/i);
  const exportFile = path.join(downloadsDir, exportDownload.suggestedFilename());
  await exportDownload.saveAs(exportFile);
  expect(fs.existsSync(exportFile)).toBeTruthy();
  await collectToast(page, runtime, "admin-export");

  const backupDownloadPromise = page.waitForEvent("download");
  await page.locator("#adminBackupButton").click();
  const backupDownload = await backupDownloadPromise;
  const backupFile = path.join(downloadsDir, backupDownload.suggestedFilename());
  await backupDownload.saveAs(backupFile);
  expect(fs.existsSync(backupFile)).toBeTruthy();
  await collectToast(page, runtime, "admin-backup");

  await page.locator("#adminImportCustomersFile").setInputFiles(exportFile);
  await page.locator('[data-admin-import="customers"]').click();
  await page.waitForTimeout(1200);
  await collectToast(page, runtime, "admin-import");

  await page.locator("#adminRestoreDbFile").setInputFiles(backupFile);
  await page.locator("#adminRestoreButton").click();
  await page.waitForTimeout(1600);
  await collectToast(page, runtime, "admin-restore");
  await reloadHealthy(page, runtime, "admin-reload", "Master Admin");
  await expect(page.locator("#adminModulePanel")).toBeVisible();
  runtime.errors = runtime.errors.filter((entry) => !entry.includes("status of 400 (Bad Request)"));

  expectNoRuntimeErrors(runtime);
});
