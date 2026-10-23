# Kế hoạch chuyển backend HTTP sang Flask

Issue: [#182](https://github.com/quantum-bluesky/quanlythucphamchay/issues/182)

Branch thực hiện: `codex/182_Chuyển_backend_HTTP_sang_Flask_theo_lộ_trình_tương_thích`

## Mục tiêu và phạm vi

Chuyển lớp HTTP hiện tại từ `http.server.ThreadingHTTPServer` và
`BaseHTTPRequestHandler` sang Flask theo từng bước có thể kiểm chứng. Giữ nguyên
SQLite, schema, `InventoryStore`, nghiệp vụ, hợp đồng API, xác thực, cấu hình
`admin_path`, static cache-busting, CLI và khả năng chạy sau reverse proxy.

Đợt này không chuyển sang ORM và không thay đổi schema DB. Flask là lớp web; các
route chỉ nhận/kiểm tra HTTP input, gọi logic hiện hữu và chuyển kết quả thành
response tương thích.

## Nguyên tắc làm việc

- Làm trên branch Issue #182, lấy local `dev` hiện tại làm base. Base đã chứa
  merge commit `dbf0a99` với fix #119 (`6d0e190`).
- Giữ nguyên mọi file untracked có từ trước; chỉ stage file do Issue này tạo/sửa.
- Tuyệt đối không chạy test ghi dữ liệu trên `data/inventory.db` hoặc cấu hình
  production. Unit/integration mặc định dùng DB riêng trong thư mục tạm.
- Khi cần dữ liệu sát thực tế, tạo một bản sao riêng từ DB local và chạy kiểm tra
  trên bản sao đó; ghi rõ test nào được phép ghi vào bản sao. Không thay thế hay
  đồng bộ ngược bản sao vào DB gốc.
- Không bỏ server cũ cho tới khi route/API, auth, static, subpath proxy, test và
  phương án rollback đều đạt điều kiện nghiệm thu.
- Giữ `unittest` và Playwright hiện có; không đưa pytest hoặc SQLAlchemy vào phạm
  vi nếu chưa có quyết định riêng.

## Giai đoạn 0 — Baseline và kiểm kê

- [x] Ghi lại Python/dependency/runtime, lệnh CLI, cấu hình test và cách deploy.
- [ ] Lập danh sách route theo method, URL, response status/body/headers, auth,
  cookie, static asset, cache và hành vi proxy/subpath.
- [x] Chạy baseline unit, integration/acceptance hiện có trên fixture test.
- [ ] Đánh giá regression phạm vi fix #119: batch lock, trạng thái phiếu nhập,
  gán sản phẩm vào batch, đồng bộ state, audit và các luồng nhập/xuất liên quan.
- [x] Nếu dùng dữ liệu local thực tế, sao chép DB vào thư mục fixture tạm, kiểm
  tra bản sao độc lập và không ghi vào DB gốc.
- [ ] Xác minh Windows/IIS/reverse proxy và khả năng giữ `python app.py` cùng các
  subcommand hiện tại.

**Gate:** Có kết quả baseline, danh sách tương thích và rủi ro đã được xác nhận;
không có test nào dùng DB runtime gốc.

## Giai đoạn 1 — Flask app factory và cấu hình

- [x] Thêm `create_app(...)` trong package web riêng, không tạo app ở import-time.
- [x] Khởi tạo `InventoryStore`, session manager, config và asset version manager
  theo app instance; không tạo ORM/database model song song.
- [x] Cung cấp cấu hình test dùng DB, config, credential và manifest asset tạm.
- [x] Giữ lựa chọn production config theo `APP_ENV`; test không thể vô tình đọc
  `system_config.production.json` hoặc ghi `data/inventory.db`.
- [x] Thêm smoke test tạo nhiều app instance với config độc lập.

**Gate:** Factory khởi tạo app cô lập được; cấu hình test sai hoặc thiếu phải fail
an toàn thay vì fallback sang dữ liệu runtime.

## Giai đoạn 2 — Lớp tương thích và chuyển route

- [ ] Chuyển static/public/admin/auth trước; giữ URL admin động theo
  `admin_path`, cookie/session, quyền và redirect hiện tại.
- [ ] Bảo toàn schema JSON, status code, headers, cache policy, xử lý lỗi và
  version hóa JavaScript.
- [ ] Tách Blueprint theo domain sau khi có route contract: catalog/entities,
  inventory, carts/orders, purchases, reports/history, state sync và admin tools.
- [ ] Giữ route/Blueprint mỏng; gọi logic `InventoryStore`/service hiện có.
- [ ] Không dùng `request`, `g`, `current_app` ngoài context; background task chỉ
  nhận giá trị cụ thể, không giữ request proxy.
- [ ] Mỗi nhóm route phải có kiểm thử hợp đồng và có thể so sánh với server cũ.

**Gate:** Mỗi nhóm route đạt parity trước khi nhóm kế tiếp được chuyển; đường
admin tùy chỉnh không bị rơi về frontend root.

## Giai đoạn 3 — Test harness

- [ ] Giữ `unittest`; dùng Flask test client cho kiểm thử HTTP không cần socket.
- [ ] Fixture tạo app/client/store/session cho từng test; teardown đóng kết nối,
  xóa DB tạm cùng WAL/SHM và dọn auth state.
- [ ] Dùng DB file tạm khi cần nhiều connection hoặc mô phỏng WAL/locking.
- [ ] Mock mail, Zalo/OAuth, network ngoài, thời gian và background tasks ở boundary.
- [ ] Tiếp tục Playwright cho browser flows và một smoke test qua WSGI server thật.
- [ ] Test admin phải điều hướng bằng `TEST_ADMIN_PATH` từ fixture và assert trang
  login admin trước khi nhập thông tin.
- [ ] Cập nhật `docs/TESTING.md`, test index/descriptions nếu thay đổi test spec.

**Gate:** Suite không phụ thuộc thứ tự; không chạm DB runtime; test admin xác nhận
đúng route trước khi đăng nhập.

## Giai đoạn 4 — Runtime và deploy

- [ ] Chọn WSGI server sau khi xác minh môi trường Windows/deploy hiện tại; không
  dùng Flask development server cho production.
- [ ] Giữ `python app.py`, `config`, `init` và đối số host/port tương thích.
- [ ] Xác minh route khi proxy giữ prefix và khi proxy đã strip prefix; không tin
  forwarded headers từ nguồn không được cấu hình rõ.
- [ ] Cập nhật requirements/setup/Windows/IIS/reverse proxy docs và hướng dẫn
  vận hành, logging, restart, backup và rollback.
- [ ] Đánh giá concurrency/SQLite lock với WSGI worker/thread configuration.

**Gate:** Máy Windows có thể setup/chạy theo tài liệu; smoke test qua proxy/subpath
đạt; rollback về entrypoint cũ đã được thử.

## Giai đoạn 5 — So sánh, cutover và dọn mã cũ

- [ ] Chạy API contract suite trên server cũ và mới; so sánh status, body, headers,
  cookies và side effects trên các fixture DB riêng.
- [ ] Chạy unit, integration, acceptance, backup/restore, auth/permission và
  regression #119.
- [ ] Chạy smoke read/write chỉ trên bản sao DB local đã xác nhận độc lập.
- [ ] Chuẩn bị backup/rollback và cửa sổ cutover trước khi đổi runtime production.
- [ ] Chỉ xóa `BaseHTTPRequestHandler` khi parity hoàn tất và không còn caller/test
  phụ thuộc.
- [ ] Xóa dependency Flask-SQLAlchemy nếu không dùng; chỉ giữ dependency runtime
  đã được xác nhận cần thiết.
- [ ] Cập nhật `AGENT_RULES.md`, README, test/deploy docs; tăng version theo phân
  loại Issue và base branch thực tế trước commit hoàn tất.

**Gate:** Toàn bộ điều kiện nghiệm thu đạt và có cách quay lại bản chạy cũ.

## Điều kiện nghiệm thu cuối

- App và CLI khởi động theo cách vận hành đã tài liệu hóa.
- API, auth/session/cookie, quyền, response/error, static/cache-busting và route
  admin tương thích với hành vi hiện hành.
- `admin_path` mặc định và tùy chỉnh được kiểm thử; frontend root không bị nhận
  nhầm là trang đăng nhập admin.
- URL domain gốc và subpath reverse proxy hoạt động.
- Unit/integration/acceptance và regression #119 đạt; mọi test ghi dữ liệu chỉ dùng
  DB fixture tạm hoặc bản sao độc lập.
- SQLite schema, nghiệp vụ, import/export, backup/restore không bị đổi ngoài phạm
  vi được Issue chấp thuận.
- Có tài liệu deploy, logging, setup và rollback cập nhật.

## Baseline đã xác minh trước khi triển khai

- Backend hiện hành dùng `ThreadingHTTPServer`/`BaseHTTPRequestHandler`,
  `qltpchay/http_handler.py`, SQLite và `InventoryStore`.
- Unit/integration Python dùng `unittest`; browser integration/acceptance dùng
  Playwright. Repo không cấu hình pytest.
- `requirements.txt` khai báo Flask và Flask-SQLAlchemy nhưng luồng runtime chưa
  tạo Flask app/Blueprint; cần phân biệt dependency được dùng thật với dependency
  tồn dư.
- Local `dev` đang ở `dbf0a99`, chứa fix #119 `6d0e190`; `origin/dev` đang ở
  `a9a5e93`. Branch Issue #182 được tạo từ local `dev` để giữ fix vừa hoàn thành.
- Có các file untracked tồn tại trước Issue này. Không stage, sửa hoặc xóa chúng.
- Version base của Issue là `3.42.0`. Do phạm vi thay lớp web/runtime là thay đổi
  kiến trúc lớn, version được bump một lần thành `4.0.0` ở commit checkpoint đầu;
  các commit tiếp theo của cùng Issue không bump lặp lại.

## Nhật ký tiến độ và kết quả kiểm chứng

### Baseline test

- Python hệ thống Windows: 3.13.5. Trước khi cài dependency cô lập,
  `python scripts/run_tests_summary.py unit` chạy 140 test, 139 pass và 1 error
  do thiếu `Pillow` (`ModuleNotFoundError: PIL`).
- Sau đó cài Flask 3.1.3 và Pillow 13.0.0 vào `.tmp/flask-deps-182` (không sửa
  Python global), toàn bộ 154 unit test pass trên Python 3.13.5.
- Python bundled 3.12.14 có Pillow 12.3.0: 140/140 unit pass. Đây là baseline
  sạch nhưng chưa xác nhận Python 3.13.
- Playwright full suite dùng fixture DB tạm: 95 pass, 11 fail, 4 skip. Nhóm lỗi
  hiện hữu gồm cancel approval; batch lock; public lunar reminder; supplier draft
  reuse/received purchase/merge receipts; quick purchase active order; admin edit;
  hai acceptance purchase; supplier return receipt UI. Cần lưu lại failure log và
  điều tra khi từng luồng được chuyển.
- Riêng regression #119 `IT-PROC-02` pass độc lập và cả 6 case của
  `procurement-batch-lock.spec.js` pass; trong full suite case này fail. Đây là
  tín hiệu phụ thuộc thứ tự/state cần điều tra, chưa kết luận fix #119 gây lỗi.
- Rerun trên branch Issue #182: `npx.cmd playwright test
  tests/integration/procurement-batch-lock.spec.js --grep IT-PROC-02` pass 1/1
  (8.5s), dùng integration fixture DB tạm.
- Flask 3.1.3 và Pillow 13.0.0 được cài vào `.tmp/flask-deps-182` (repo ignore)
  để thử nghiệm, không cài vào Python global.
- Một lượt full unit có 1 lỗi socket gián đoạn (`UT-AUTH-18`,
  `ConnectionAbortedError`); chạy riêng case đó pass, và lượt full ngay sau pass
  154/154. Không có code trong legacy handler thay đổi.

### Bản sao SQLite local

- Sao chép bằng SQLite backup API tới
  `C:\Users\quann\AppData\Local\Temp\qltpchay-flask-migration-182-4e5bd545dc884097a2db24f2f542c9d3\inventory-fixture.db`.
- Bản sao có 23 bảng và `PRAGMA integrity_check` trả `ok`. Đây là fixture dữ liệu
  thực tế dành cho smoke test về sau; không ghi vào DB nguồn hoặc đồng bộ ngược.

### Route map sơ bộ (legacy server)

Đây là map nhóm route để dẫn dắt chuyển đổi; status/header/body/cookie parity cần
được ghi thành contract cho từng nhóm trước cutover.

- Trang/static: `GET /` (public catalog), `GET {admin_path}` (admin SPA),
  `GET /ProductList`, `/favicon.ico`, `/static/<path>`, `/images/<path>`.
- Session/catalog: session status; admin status/Zalo groups; public products và
  public order submit; product CRUD/history/movements; receipt/transaction/order/
  purchase histories; bulk requests và cancel history.
- State/report/planning: state sync, runtime version, procurement status/planner,
  monthly reports.
- Admin tools: settings, backup/export/import/restore, upload, legacy audit/fix,
  Zalo/mail config and test mail.
- Write routes trải trên session login/logout; product/customer/supplier CRUD;
  transactions/inventory adjustments; carts/orders/checkout/ship/returns;
  purchases/drafts/receive/payment; bulk request approval; document cancellation;
  procurement batch locks; product base-unit changes. Bảng method/URL đầy đủ cần
  trích xuất tiếp từ dispatch branches của `qltpchay/http_handler.py`.

### Mốc code đầu tiên

- Đã thêm `qltpchay/flask_app.py:create_app`, không khởi tạo app khi import. Factory
  yêu cầu DB và config tường minh; gắn store/session/asset manager vào
  `app.extensions`; test mode từ chối DB runtime, manifest/runtime config và ảnh
  trong `data/`.
- Đã chuyển bước đầu các trang `/`, `{admin_path}`, `/ProductList`, favicon,
  static assets và uploaded images, gồm alias dưới `{admin_path}` cho SPA URLs như
  `/admin/static/...`. `/` vẫn là public; chỉ path cấu hình mới phục vụ
  `static/index.html`; các API chưa chuyển vẫn chạy qua legacy server.
- Đã chuyển thêm `GET /api/public/products` và `GET /api/public/orders`, giữ
  catalog fields, lịch âm, settings, lọc sản phẩm public và validation tra cứu;
  cấu hình lấy từ app factory thay vì đọc lại config global.
- Đã chuyển `GET /api/session/status`, `GET /api/admin/status`, login/logout của
  session thường và Master Admin; giữ cookie theo port, trạng thái/permission,
  timeout và thông điệp logout cũ.
- Đã chuyển `POST /api/public/orders`: config Zalo lấy từ app factory, tạo đơn qua
  `InventoryStore`, giữ response 201 và validation 400; lỗi bất ngờ được log và
  trả JSON 500 an toàn. Hỗ trợ URL gốc và alias dưới `admin_path`.
- Đã chuyển `GET /api/products` với response danh sách + summary và helper xác
  thực dùng lại được; giữ response 401 và không gia hạn session cho request
  `X-Session-Activity: passive`.
- Đã chuyển `GET /api/products/deleted` và `GET /api/products/history`, gồm bộ
  lọc history theo limit, actor và ngày; các endpoint dùng chung auth gate.
- Đã chuyển `GET /api/product-movements`, giữ query filters và lỗi 400 khi product
  ID không hợp lệ; endpoint dùng chung auth gate.
- Đã chuyển `GET /api/receipts/history` và `GET /api/transactions`, giữ response
  wrappers và query parameters; hai endpoint dùng chung auth gate.
- Đã chuyển lịch sử đơn hàng và phiếu nhập theo ID, giữ response document/history,
  limit và status 400 khi chứng từ không tồn tại; hai endpoint dùng chung auth gate.
- Đã chuyển `GET /api/runtime-version` và `GET /api/reports/monthly`, giữ metadata,
  bộ lọc và lỗi 400 cho tham số tháng không hợp lệ.
- Đã chuyển `GET /api/procurement/status`, giữ timeout khóa, config công khai,
  quyền `procurement_batch_manage`, manager allowlist và trạng thái lock owner.
- Đã chuyển `GET /api/procurement/planner`, giữ scope, timeout khóa, config,
  yêu cầu login khi batch mode bật và quyền quản lý; scope sai trả 400.
- Đã chuyển aggregate `GET /api/state`, gồm metadata, products, summary,
  transactions, runtime version, procurement, request queues và sync collections.
- Runtime factory đọc config theo `APP_ENV` khi được gọi; test mode bắt buộc config
  được inject, không tự đọc config runtime.
- `tests/test_flask_app.py`: `UT-WEB-01..14` xác nhận admin path tùy chỉnh, root
  không nhầm admin, app instances cách ly DB/route và test mode chặn runtime DB.
  `UT-WEB-04` xác nhận contract catalog/lunar/settings và lọc sản phẩm;
  `UT-WEB-05` xác nhận config test phải được inject; `UT-WEB-06` xác nhận lỗi
  tra cứu đơn hàng public; `UT-WEB-07` xác nhận runtime loader nhận đúng
  `CONFIG_PATH` theo `APP_ENV`; `UT-WEB-08` xác nhận logging và JSON 500 an toàn;
  `UT-WEB-09` chặn mọi DB trong `data/` ở test mode; `UT-WEB-10` xác nhận static
  assets dưới admin prefix hoạt động; `UT-WEB-11..12` xác nhận login/status/logout,
  cookie port-scoped và quyền Master Admin; `UT-WEB-13` smoke test qua WSGI loopback;
  `UT-WEB-14` so sánh payload session status với HTTP handler cũ.
- Đã cập nhật convention Flask trong `AGENT_RULES.md` cùng test docs/index.
- Lệnh kiểm tra trên Python 3.13.5 với Flask 3.1.3 tạm trong `.tmp`:
  `python -m unittest tests.test_flask_app` (14 pass),
  `python -m py_compile qltpchay/flask_app.py tests/test_flask_app.py app.py` (pass).
- Full unit gần nhất: `python scripts/run_tests_summary.py unit` (154 pass, 28.96s).
- Checkpoint đầu đã commit `24358fa` (`feat(#182): add staged Flask app factory`);
  `4.0.0` là version major duy nhất của Issue này.
- Tiếp tục chuyển `POST /api/public/orders`; `tests.test_flask_app` hiện chạy
  19/19 pass sau khi thêm test tạo đơn, config Zalo, validation, lỗi an toàn và
  alias admin path. Full unit cần chạy lại trước checkpoint tiếp theo.
- Thêm `GET /api/products` và kiểm tra response/auth cho login tắt, thiếu session
  session hợp lệ và request passive; cập nhật test index/descriptions. Kết quả
  mới nhất: Flask test module 23/23 pass, full unit 163/163 pass, `py_compile`
  và `git diff --check` pass.
- Kế tiếp thêm `GET /api/products/deleted` và `/api/products/history`; chưa commit,
  kết quả sau chuyển: Flask test module 25/25 pass, full unit 165/165 pass,
  `py_compile` và `git diff --check` pass.
- Thêm `GET /api/product-movements`; kết quả hiện tại: Flask test module 27/27
  pass, full unit 167/167 pass, `py_compile` và `git diff --check` pass.
- Thêm `GET /api/receipts/history` và `GET /api/transactions`; kết quả hiện tại:
  Flask test module 29/29 pass, full unit 169/169 pass, `py_compile` và
  `git diff --check` pass.
- Thêm history endpoint cho đơn hàng và phiếu nhập; kết quả hiện tại: Flask test
  module 33/33 pass, full unit 173/173 pass, `py_compile` và `git diff --check`
  pass.
- Thêm runtime version và monthly report reads; kết quả hiện tại: Flask test
  module 36/36 pass, full unit 176/176 pass, `py_compile` và `git diff --check`
  pass.
- Thêm procurement status cùng auth/permission contract; kết quả hiện tại:
  Flask test module 38/38 pass, full unit 178/178 pass, `py_compile` và
  `git diff --check` pass.
- Thêm procurement planner với kiểm tra scope, login và quyền; kết quả hiện tại:
  Flask test module 41/41 pass, full unit 181/181 pass, `py_compile` và
  `git diff --check` pass.
- Thêm aggregate `/api/state` và dùng chung helper cho procurement status;
  kết quả hiện tại: Flask test module 43/43 pass, full unit 183/183 pass,
  `py_compile` và `git diff --check` pass.
- Thêm `POST /api/products`, `PUT /api/products/<id>` và
  `DELETE /api/products/<id>`; thêm `UT-WEB-44..47` cho create/update/soft-delete
  và lỗi validation. Kết quả: `tests.test_flask_app` 47/47 pass, full unit
  187/187 pass, `py_compile` và `git diff --check` pass; commit lát cắt này đã
  hoàn tất riêng trong Issue #182.
- Chuyển tiếp `PUT /api/products/<id>/price`,
  `PUT /api/products/<id>/sale-price` và `POST /api/products/<id>/restore`;
  thêm `UT-WEB-48..50`. Kết quả: `tests.test_flask_app` 50/50 pass, full unit
  190/190 pass, `py_compile` và `git diff --check` pass; đã chốt thành commit
  riêng trong Issue #182.
- Đang chuyển `POST /api/products/<id>/change-base-unit` cùng quyền Master Admin;
  `UT-WEB-51..53` kiểm tra login tắt, staff bị chặn và admin thành công qua
  prefix cấu hình. Kết quả: `tests.test_flask_app` 53/53 pass, full unit
  193/193 pass, `py_compile` và `git diff --check` pass; đã chốt thành commit
  riêng trong Issue #182.
- Chuyển `DELETE /api/admin/products/<id>/hard`, gồm kiểm tra login gate,
  Master Admin và response legacy; `UT-WEB-54..56` pass. Nhóm hiện đạt
  `tests.test_flask_app` 56/56 pass, full unit 196/196 pass, `py_compile` và
  `git diff --check` pass; đã chốt thành commit riêng trong Issue #182.
- Đang chuyển `POST /api/products/images/upload`: giữ raw-binary input, extension
  allowlist, tối ưu ảnh qua helper hiện có, lưu dưới app `IMAGE_ROOT`, và trả
  đường dẫn có thể đọc qua route ảnh. `UT-WEB-57..58` kiểm tra save/serve và
  admin prefix. Kết quả: `tests.test_flask_app` 58/58 pass, full unit 198/198
  pass, `py_compile` và `git diff --check` pass; đã chốt thành commit riêng.
- Đang chuyển hai read endpoint lịch sử cho bulk order request và document
  cancellation request; `UT-WEB-59..60` kiểm tra wrapper, limit và not-found.
  Kết quả: `tests.test_flask_app` 60/60 pass, full unit 200/200 pass,
  `py_compile` và `git diff --check` pass; đã chốt thành commit riêng.
- Đang chuyển admin read routes cho public-web config, mail config và legacy
  audit; `UT-WEB-61..62` kiểm tra Master Admin, che password và response audit.
  Kết quả: `tests.test_flask_app` 62/62 pass, full unit 202/202 pass,
  `py_compile` và `git diff --check` pass; đã chốt thành commit riêng.
- Đang chuyển admin export master data sang JSON/CSV, giữ download headers, thứ
  tự cột CSV/UTF-8 BOM và lỗi format không hỗ trợ; `UT-WEB-63..65` pass.
  Kết quả: `tests.test_flask_app` 65/65 pass, full unit 205/205 pass,
  `py_compile` và `git diff --check` pass; đã chốt thành commit riêng.
- Đang chuyển admin database backup download; test mock backup file trong thư
  mục tạm để không tạo file backup trên runtime. `UT-WEB-66` pass;
  `tests.test_flask_app` 66/66 pass, full unit cuối cùng 206/206 pass,
  `py_compile` và `git diff --check` pass. Một lượt full trước đó gặp socket
  abort ở test legacy #177; chạy riêng pass và rerun full pass.
- Đang chuyển `PUT /api/state`, giữ actor/session role, metadata response,
  `SyncConflictError` 409 và validation 400; `UT-WEB-67..70` pass.
  Kết quả: `tests.test_flask_app` 70/70 pass, full unit 210/210 pass,
  `py_compile` và `git diff --check` pass; đã chốt thành commit riêng.
- Đang chuyển `POST /api/transactions`, giữ quyền inventory adjustment luôn
  yêu cầu session, actor username, batch/expiry data và response 201;
  `UT-WEB-71..74` pass. Kết quả: `tests.test_flask_app` 74/74 pass, full unit
  214/214 pass, `py_compile` và `git diff --check` pass; đã chốt thành commit
  riêng trong Issue #182.
- Đang chuyển các thao tác bán hàng đơn lẻ: checkout, quick-create và commit;
  `UT-WEB-75..77` pass. Kết quả: `tests.test_flask_app` 77/77 pass,
  full unit 217/217 pass, `py_compile` và `git diff --check` pass; đã chốt thành
  commit riêng.
- Đang chuyển `POST /api/orders/bulk-create`, gồm quyền create/commit riêng,
  approval workflow và duplicate conflict; `UT-WEB-78..82` pass. Kết quả:
  `tests.test_flask_app` 82/82 pass, full unit 222/222 pass, `py_compile` và
  `git diff --check` pass; đã chốt thành commit riêng.
- Đang chuyển approve/reject cho bulk requests, giữ quyền `order_batch_manage`,
  actor, reason và queue response; `UT-WEB-83..85` pass. Kết quả:
  `tests.test_flask_app` 85/85 pass, full unit 225/225 pass, `py_compile` và
  `git diff --check` pass; đã chốt thành commit riêng.
- Đang chuyển delete/process bulk requests, giữ owner-or-manager permission,
  login gate và inventory summary; `UT-WEB-86..89` pass. Kết quả:
  `tests.test_flask_app` 89/89 pass, full unit 229/229 pass, `py_compile` và
  `git diff --check` pass; đã chốt thành commit riêng.
- Đang chuyển yêu cầu hủy order/purchase, giữ EnableLogin gate, lưu request và
  notification semantics; `UT-WEB-90..92` pass với email boundary mock.
  Kết quả: `tests.test_flask_app` 92/92 pass, full unit 232/232 pass,
  `py_compile` và `git diff --check` pass; đã chốt thành commit riêng.
- Đang chuyển approve/reject document-cancel requests, giữ permission
  `document_cancel_approve`, sync-state response và reason; `UT-WEB-93..95`
  pass. Kết quả: `tests.test_flask_app` 95/95 pass, full unit 235/235 pass,
  `py_compile` và `git diff --check` pass; đã chốt thành commit riêng.
- Đang chuyển `orders/ship` và `purchases/receive`, giữ auth, actor/role, ngày
  giao dịch, status và response; `UT-WEB-96..99` pass. Kết quả:
  `tests.test_flask_app` 99/99 pass, full unit 239/239 pass, `py_compile` và
  `git diff --check` pass; đã chốt thành commit riêng.
- Đang chuyển quick purchase, mark-paid và payment update; `UT-WEB-100..102`
  pass. Kết quả: `tests.test_flask_app` 102/102 pass, full unit 242/242 pass,
  `py_compile` và `git diff --check` pass; đã chốt thành commit riêng.
- Đang chuyển cart item/payment và received-item expiry; `UT-WEB-103..105`
  pass. Kết quả: `tests.test_flask_app` 105/105 pass, full unit 245/245 pass,
  `py_compile` và `git diff --check` pass; đã chốt thành commit riêng.
- Đã chuyển purchase repair, inventory adjustment và customer/supplier returns;
  `UT-WEB-106..110` kiểm tra permission, actor, source fields và lỗi. Kết quả:
  `tests.test_flask_app` 110/110 pass, full unit 250/250 pass,
  `py_compile` và `git diff --check` pass; đã chốt thành commit riêng.
- Đã chuyển các mutation của procurement batch và tạo phiếu nhập đơn/lô;
  `UT-WEB-111..116` kiểm tra login/manager gate, actor, lock status, conflict,
  scope và danh sách tạo/bỏ qua. Kết quả: `tests.test_flask_app` 116/116 pass,
  full unit 256/256 pass, `py_compile` và `git diff --check` pass; chờ commit.
- Đã chuyển cập nhật mail/Public Web config và test-mail; `UT-WEB-117..122` kiểm
  tra Master Admin, persistence, bảo toàn password, validation và mock SMTP.
  Kết quả: `tests.test_flask_app` 122/122 pass, full unit 262/262 pass,
  `py_compile` và `git diff --check` pass; chờ commit.
- Đã chuyển legacy audit safe-fix và liên kết receipt/source cho phiếu nhập;
  `UT-WEB-123..126` kiểm tra Master Admin, actor, audit payload và validation.
  Kết quả: `tests.test_flask_app` 126/126 pass, full unit 266/266 pass,
  `py_compile` và `git diff --check` pass; chờ commit.
- Đã chuyển sửa đơn/phiếu nhập đã khóa, giữ Master Admin gate và
  `EnableAdminLockedEdit`; `UT-WEB-127..129` kiểm tra actor, payload, feature gate
  và lỗi validation. Kết quả: `tests.test_flask_app` 129/129 pass, full unit
  269/269 pass, `py_compile` và `git diff --check` pass; đã chốt thành commit riêng.
- Đã chuyển hard-delete customer/supplier với Master Admin gate và actor;
  `UT-WEB-130..132` kiểm tra permission, response và lỗi validation. Kết quả:
  `tests.test_flask_app` 132/132 pass, full unit 272/272 pass, `py_compile` và
  `git diff --check` pass; chờ commit.
