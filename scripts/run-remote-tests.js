const { spawnSync } = require('child_process');
const path = require('path');
const https = require('https');
const http = require('http');

async function fetchAdminPath(baseUrl) {
  return new Promise((resolve) => {
    let statusUrl = baseUrl;
    if (!statusUrl.endsWith('/')) statusUrl += '/';
    statusUrl += 'api/session/status';
    
    console.log(`\nĐang lấy cấu hình admin_path từ: ${statusUrl}`);
    
    const client = statusUrl.startsWith('https') ? https : http;
    const req = client.get(statusUrl, { rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          let adminPath = json.admin_path || 'admin';
          if (adminPath.startsWith('/')) adminPath = adminPath.slice(1);
          console.log(`[OK] Tìm thấy admin_path = "${adminPath}"\n`);
          resolve(adminPath);
        } catch (e) {
          console.log(`[WARN] Không parse được JSON. Dùng mặc định "admin".\n`);
          resolve("admin");
        }
      });
    });
    
    req.on('error', (e) => {
      console.log(`[WARN] Lỗi khi gọi API session/status: ${e.message}. Dùng mặc định "admin".\n`);
      resolve("admin");
    });
  });
}

async function main() {
  const level = process.argv[2] || 'smoke';
  const url = process.argv[3];

  if (!url) {
    console.error("\n[!] Thiếu URL mục tiêu.");
    console.error("Cách sử dụng: npm run test:staging:<level> -- <URL>");
    console.error("Ví dụ: npm run test:staging:smoke -- https://qts-home.duckdns.org/qltp/");
    process.exit(1);
  }

  const levels = {
    smoke: [
      "tests/integration/public-product-list.spec.js",
      "tests/integration/login.spec.js"
    ],
    readonly: [
      "tests/integration/public-product-list.spec.js",
      "tests/integration/login.spec.js",
      "tests/integration/detail-scroll.spec.js",
      "tests/integration/ui-feedback-layering.spec.js",
      "tests/integration/inventory-sort.spec.js",
      "tests/integration/pagination-settings.spec.js"
    ],
    full: []
  };

  if (!levels[level]) {
    console.error("Level không hợp lệ. Chọn: smoke, readonly, full");
    process.exit(1);
  }

  const adminPath = await fetchAdminPath(url);

  const args = ["playwright", "test", ...levels[level]];
  console.log(`\n======================================================`);
  console.log(`BẮT ĐẦU CHẠY TEST INTEGRATE (${level.toUpperCase()})`);
  console.log(`Môi trường: ${url}`);
  console.log(`Admin Path: ${adminPath}`);
  console.log(`Lệnh nội bộ: npx ${args.join(' ')}`);
  console.log(`======================================================\n`);

  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PLAYWRIGHT_BASE_URL: url, TEST_ADMIN_PATH: adminPath }
  });

  process.exit(result.status || 0);
}

main();
