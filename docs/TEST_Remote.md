**Chạy test từ máy B trỏ vào server đang chạy ở máy A**
— Tách riêng 2 kiểu:

1.  **Kiểm thử “thực chiến” vào server thật** (máy A đang chạy `app.py`).

2.  **Integration chuẩn của repo** (dùng fixture DB riêng, do Playwright tự bật test server local).

Hiện tại repo đang cấu hình integration theo kiểu (2): `baseURL` cố định
`http://127.0.0.1:8130` và có `webServer` tự chạy
`tests/integration/run_test_server.py`, tức là mặc định **không nhắm
server từ máy
khác**.

------------------------------------------------------------------------

## Cách làm khi muốn máy B test vào server đang chạy ở máy A

### Bước 1) Trên máy A, chạy app với host có thể truy cập từ LAN

Ví dụ:

``` overflow-visible!
Bashpython app.py --host 0.0.0.0 --port 8000
```

Repo có hỗ trợ bind host/port tùy ý như
trên.

------------------------------------------------------------------------

### Bước 2) Trên máy B, kiểm tra truy cập được server máy A

Ví dụ máy A có IP `192.168.1.10`, thử mở:

- `http://192.168.1.10:8000`

Nếu mở được UI thì mới chạy Playwright tiếp.

------------------------------------------------------------------------

### Bước 3) Tạo config Playwright riêng để “trỏ remote server”

Vì config mặc định có `webServer` local và `baseURL`
localhost, nên trên máy B bạn tạo file mới, ví dụ
`playwright.remote.config.js`:

``` overflow-visible!
JavaScriptconst base = require("./playwright.config");
module.exports = {
  ...base,
  use: {
    ...base.use,
    baseURL: "http://192.168.1.10:8000",
  },
  webServer: undefined, // không tự bật test server local
};
```

------------------------------------------------------------------------

### Bước 4) Chạy test với config remote

``` overflow-visible!
Bashnpm install
npx playwright install chromium
npx playwright test --config=playwright.remote.config.js
```

Lệnh cài/chạy integration theo docs hiện
có.

------------------------------------------------------------------------

## Lưu ý quan trọng (rất nên đọc)

- **Integration mặc định của repo dùng fixture DB tạm**, không đụng DB
  thật. 
  Khi bạn trỏ vào server thật, test có thể tạo/sửa dữ liệu thật.

- `run_test_server.py` tạo DB tạm và seed dữ liệu cố định để test ổn
  định.

- Vì vậy:

  - Nếu cần regression “chuẩn CI” → dùng `npm run test:integration` mặc
    định.

  - Nếu cần kiểm tra nhanh môi trường thật nhiều máy → dùng
    `playwright.remote.config.js` như hướng dẫn trên.

------------------------------------------------------------------------

## Các lệnh đã dùng để kiểm tra repo

- `rg --files | rg 'AGENTS.md|README.md|docs/HUONG_DAN_SU_DUNG.md|docs/TESTING.md|playwright.config.js|tests/integration|package.json'`

- `sed -n '1,260p' docs/TESTING.md`

- `sed -n '1,260p' playwright.config.js`

- `sed -n '1,260p' tests/integration/run_test_server.py`

- `sed -n '260,520p' tests/integration/run_test_server.py`

- `sed -n '1,220p' README.md`

- `nl -ba ...` để lấy line number trích dẫn.
