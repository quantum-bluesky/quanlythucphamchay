const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/integration",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "test-results/playwright",
  use: {
    baseURL: "http://127.0.0.1:8130",
    headless: true,
    viewport: { width: 480, height: 900 },
    acceptDownloads: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "python tests/integration/run_test_server.py --host 127.0.0.1 --port 8130",
    url: "http://127.0.0.1:8130",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
