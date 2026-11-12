const fs = require("node:fs");
const path = require("node:path");

const configPath = path.resolve(__dirname, "../test_runtime_config.json");
const testRuntimeConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

function normalizeAdminPath(value) {
  const pathValue = String(value || "admin").trim().replace(/^\/+|\/+$/g, "");
  return pathValue || "admin";
}

const adminPath = normalizeAdminPath(process.env.TEST_ADMIN_PATH || testRuntimeConfig.admin_path);
process.env.TEST_ADMIN_PATH = adminPath;

module.exports = { adminPath, testRuntimeConfig };
