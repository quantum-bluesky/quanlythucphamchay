const { defineConfig } = require("@playwright/test");
const { adminPath } = require("./tests/integration/support/test-config");

process.env.TEST_ADMIN_PATH = adminPath;
const integrationBackend = process.env.PLAYWRIGHT_BACKEND || "legacy";
if (!["legacy", "flask"].includes(integrationBackend)) {
  throw new Error(`Unsupported PLAYWRIGHT_BACKEND: ${integrationBackend}`);
}

module.exports = defineConfig({
  testDir: "./tests/integration",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "test-results/playwright",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8130",
    headless: true,
    viewport: { width: 480, height: 900 },
    acceptDownloads: true,
    trace: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: `python tests/integration/run_test_server.py --host 127.0.0.1 --port 8130 --backend ${integrationBackend}`,
    url: "http://127.0.0.1:8130",
    env: { ...process.env, TEST_ADMIN_PATH: adminPath },
    reuseExistingServer: false,
    timeout: 120000,
  },
});
