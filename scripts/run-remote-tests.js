const { spawnSync } = require('child_process');
const path = require('path');

const level = process.argv[2] || 'smoke';
const url = process.argv[3];

if (!url) {
  console.error("\n[!] Thiếu URL mục tiêu.");
  console.error("Cách sử dụng: npm run test:staging:<level> -- <URL>");
  console.error("Ví dụ: npm run test:staging:smoke -- https://qts-home.duckdns.org/qltp/");
  console.error("\nCác level hỗ trợ:");
  console.error("  - smoke: Chỉ test các trang cơ bản như trang chủ public và login (An toàn, không sửa đổi dữ liệu).");
  console.error("  - readonly: Test điều hướng, phân trang, lọc, xem chi tiết (An toàn, không sửa đổi dữ liệu).");
  console.error("  - full: Chạy toàn bộ test suite (CẢNH BÁO: Sẽ tạo/sửa đổi/xóa dữ liệu thật trên hệ thống!).\n");
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

const args = ["playwright", "test", ...levels[level]];
console.log(`\n======================================================`);
console.log(`BẮT ĐẦU CHẠY TEST INTEGRATE (${level.toUpperCase()})`);
console.log(`Môi trường: ${url}`);
console.log(`Lệnh nội bộ: npx ${args.join(' ')}`);
console.log(`======================================================\n`);

const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
  stdio: 'inherit',
  env: { ...process.env, PLAYWRIGHT_BASE_URL: url }
});

process.exit(result.status || 0);
