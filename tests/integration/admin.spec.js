const { test, expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const {
  attachRuntimeTracking,
  autoLoginAdmin,
  collectToast,
  expectNoRuntimeErrors,
  expectScreenTitle,
  openAdminPage,
  reloadHealthy,
  switchMenu,
} = require("./support/ui");

test("ACC-ADM-01 / ACC-ADM-02 master admin login, export, import, backup and restore work on fixture DB", async ({ page, request }, testInfo) => {
  test.setTimeout(120000);
  const runtime = attachRuntimeTracking(page);
  const downloadsDir = testInfo.outputPath("downloads");
  fs.mkdirSync(downloadsDir, { recursive: true });

  await openAdminPage(page);
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

  await page.locator("#adminMasterFormatProducts").selectOption("csv");
  const productsExportPromise = page.waitForEvent("download");
  await page.locator('[data-admin-export="products"]').click();
  const productsDownload = await productsExportPromise;
  expect(productsDownload.suggestedFilename()).toMatch(/\.csv$/i);
  const productsFile = path.join(downloadsDir, productsDownload.suggestedFilename());
  await productsDownload.saveAs(productsFile);
  const productsCsv = fs.readFileSync(productsFile, "utf8");
  expect(productsCsv).toContain("shelf_life_days");
  expect(productsCsv).toContain("storage_life_days");
  await page.locator("#adminImportProductsFile").setInputFiles(productsFile);
  await page.locator('[data-admin-import="products"]').click();
  await page.waitForTimeout(1200);
  await collectToast(page, runtime, "admin-products-import");

  await page.locator("#adminRestoreDbFile").setInputFiles(backupFile);
  await page.locator("#adminRestoreButton").click();
  await page.waitForTimeout(1600);
  await collectToast(page, runtime, "admin-restore");
  await reloadHealthy(page, runtime, "admin-reload", "Master Admin");
  await expect(page.locator("#adminModulePanel")).toBeVisible();
  runtime.errors = runtime.errors.filter((entry) => !entry.includes("status of 400 (Bad Request)"));

  expectNoRuntimeErrors(runtime);
});

test("ACC-ADM-04 Master Admin can send a configured-recipient test mail after confirmation", async ({ page, request }) => {
  const runtime = attachRuntimeTracking(page, { autoAcceptDialogs: false });
  let confirmMessage = "";
  let requestPayload = null;
  let savedMailConfig = null;
  let mailConfigLoadCount = 0;

  await openAdminPage(page);
  await page.waitForLoadState("networkidle");
  await autoLoginAdmin(page, request);
  await page.reload({ waitUntil: "networkidle" });
  await page.route("**/api/admin/mail-config", async (route) => {
    if (route.request().method() === "GET") {
      mailConfigLoadCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          environment: "production",
          mail: {
            enabled: true,
            smtp_host: "smtp.test.invalid",
            smtp_port: 587,
            username: "sender@test.invalid",
            has_password: true,
            from_email: "sender@test.invalid",
            to_emails: ["recipient@test.invalid"],
            use_tls: true,
            use_ssl: false,
            subject_prefix: "[Test]",
          },
        }),
      });
      return;
    }
    savedMailConfig = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Đã lưu cấu hình gửi mail.",
        environment: "production",
        mail: { ...savedMailConfig, has_password: true, password: undefined },
      }),
    });
  });
  await switchMenu(page, "admin");
  await expect(page.locator("#adminModulePanel")).toBeVisible();
  await expect(page.locator("#adminTestMailButton")).toBeVisible();
  await expect(page.locator("#adminMailSmtpHost")).toHaveValue("smtp.test.invalid");
  await expect(page.locator("#adminMailUsername")).toHaveValue("sender@test.invalid");
  await expect(page.locator("#adminMailRecipients")).toHaveValue("recipient@test.invalid");
  await expect(page.locator("#adminMailPassword")).toHaveValue("");
  await expect(page.locator("#adminMailPasswordState")).toContainText("Đã có mật khẩu");
  await expect(page.locator("#adminMailConfigStatus")).toContainText("môi trường production");
  await expect(page.locator('[data-mail-result="environment"]')).toHaveText("production");
  await expect(page.locator('[data-mail-result="server"]')).toHaveText("smtp.test.invalid:587");
  await expect(page.locator('[data-mail-result="recipients"]')).toContainText("recipient@test.invalid");
  await page.locator("#adminMailSmtpHost").fill("");
  await page.locator("#adminMailConfigReloadButton").click();
  await expect(page.locator("#adminMailSmtpHost")).toHaveValue("smtp.test.invalid");
  expect(mailConfigLoadCount).toBeGreaterThanOrEqual(2);
  await page.locator("#adminMailPassword").fill("replacement-secret");
  await page.locator("#adminMailConfigSaveButton").click();
  await expect(page.locator("#adminMailConfigStatus")).toContainText("Đã lưu");
  await expect(page.locator("#adminMailPassword")).toHaveValue("");
  expect(savedMailConfig.password).toBe("replacement-secret");
  expect(savedMailConfig.smtp_host).toBe("smtp.test.invalid");

  page.once("dialog", async (dialog) => {
    confirmMessage = dialog.message();
    await dialog.accept();
  });
  await page.route("**/api/admin/test-mail", async (route) => {
    requestPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Máy chủ SMTP đã nhận email thử.",
        result: {
          status: "sent",
          tested_at: "2026-10-23T10:30:00+07:00",
          environment: "production",
          smtp_host: "smtp.test.invalid",
          smtp_port: 587,
          security: "STARTTLS",
          from_email: "sender@test.invalid",
          to_emails: ["recipient@test.invalid"],
          recipient_count: 1,
        },
      }),
    });
  });

  await page.locator("#adminTestMailButton").click();
  await expect(page.locator("#adminTestMailStatus")).toContainText("Số người nhận: 1");
  await expect(page.locator("#adminTestMailStatus")).toContainText("SMTP đã nhận");
  await expect(page.locator("#adminTestMailResult")).toHaveAttribute("data-state", "sent");
  await expect(page.locator('[data-mail-result="environment"]')).toHaveText("production");
  await expect(page.locator('[data-mail-result="server"]')).toHaveText("smtp.test.invalid:587");
  await expect(page.locator('[data-mail-result="recipients"]')).toContainText("recipient@test.invalid");
  await expect(page.locator('[data-mail-result="tested-at"]')).not.toHaveText("—");
  expect(confirmMessage).toContain("toàn bộ người nhận");
  expect(requestPayload).toEqual({});
  expectNoRuntimeErrors(runtime);
});



