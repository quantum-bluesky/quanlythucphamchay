# Quy tắc bắt buộc cho AI Agent

Các quy tắc này áp dụng trước khi Agent đọc sâu, sửa code hoặc chạy bất kỳ test nào. Không tự suy diễn kiến trúc từ tên dependency hay từ ví dụ Flask chung trên Internet. Khi code, cấu hình và tài liệu mâu thuẫn, ghi nhận mâu thuẫn và xác minh nguồn đang chạy trước khi thay đổi hành vi.

## 1. Đọc và xác minh bối cảnh

- Đọc `AGENTS.md`, `README.md`, `docs/TESTING.md`, rồi đọc tài liệu nghiệp vụ/design liên quan đến phạm vi thay đổi. Quét cây thư mục bằng `rg --files` và tìm mẫu triển khai/test tương tự trước khi thêm file hoặc abstraction.
- Với thay đổi backend, đọc `app.py` và module `qltpchay/` liên quan. Với thay đổi route/auth, lần theo `qltpchay/http_handler.py`, `qltpchay/auth.py`, config và test tương ứng. Với SQL/schema, đọc `docs/DB_DESIGN.md`, `_initialize_schema()` và kiểm tra schema DB thực tế theo quy định trong `AGENTS.md`.
- Kiểm tra `requirements.txt`, `package.json`, virtualenv hiện có và scripts test trước khi đề xuất dependency. Không thêm thư viện mới nếu stdlib hoặc dependency hiện có giải quyết được việc đó. Dependency phục vụ test không được đưa thành runtime dependency nếu không cần.
- Xác minh phiên bản Python, framework, test runner và fixture từ source/config tại thời điểm làm việc. Không khẳng định repo có Flask, `TestingConfig`, SQLAlchemy models, pytest hay Flask test client chỉ vì chúng được nêu trong yêu cầu hoặc nằm trong requirements.
- Repo hiện tại được xác minh là ứng dụng Python dùng `http.server.ThreadingHTTPServer` và `BaseHTTPRequestHandler`; backend chia thành các module `qltpchay/`, truy cập SQLite qua `InventoryStore` (`qltpchay/store.py`). Unit/integration HTTP dùng `unittest`; browser integration và acceptance dùng Playwright. `requirements.txt` có khai báo Flask và Flask-SQLAlchemy, nhưng chưa thấy Flask app/Blueprint/TestingConfig trong luồng backend hiện hành. Nếu kiến trúc đã được chuyển đổi, cập nhật tài liệu này dựa trên code thực tế.

## 2. Coding và kiến trúc backend

### Quy tắc áp dụng cho kiến trúc hiện tại

- Giữ `app.py` làm entrypoint/CLI mỏng. Đặt cấu hình ở `qltpchay/config.py`, hằng số/đường dẫn ở `qltpchay/constants.py`, auth ở `qltpchay/auth.py`, logic dữ liệu/nghiệp vụ ở `qltpchay/store.py`, và HTTP routing/serialization ở `qltpchay/http_handler.py`. Chỉ tạo module/service mới khi có ranh giới trách nhiệm rõ và mẫu hiện tại không phù hợp.
- Không thêm Flask Blueprint, controller, model ORM hoặc lớp app factory vào backend đang chạy nếu không có yêu cầu chuyển kiến trúc đã được thống nhất. `InventoryStore` là lớp truy cập và nghiệp vụ SQLite hiện tại; không tạo một mô hình database song song.
- Import nội bộ theo mẫu package hiện có: dùng relative import trong `qltpchay` (ví dụ `from .store import InventoryStore`), và import tuyệt đối từ package gốc ở entrypoint/test (ví dụ `from qltpchay.store import InventoryStore`). Không sửa `sys.path` để che lỗi package/import.
- Đọc config qua API trong `qltpchay/config.py` và constants trong `qltpchay/constants.py`; không tự đọc nhầm config production hoặc hardcode credential. `APP_ENV=production` chọn `data/system_config.production.json`; mặc định là `data/system_config.json`. Giá trị `APP_ENV` mặc định là `test` nhưng **không tự làm DB thành database test**.
- HTTP handler hiện tại không có Flask `request`, `g`, `current_app` hay application/request context. Truyền dependencies rõ ràng qua `create_handler(store, admin_sessions, system_config=...)`; không truy cập state toàn cục hoặc giả lập context Flask.
- Giữ format response JSON theo endpoint lân cận và test hiện có. Trước khi đổi field/status/error payload, tìm các consumer frontend/test và cập nhật đồng bộ. Lỗi HTTP phải có status phù hợp; exception hệ thống cần log bằng `qltpchay.logger` với `exc_info=True` theo `AGENTS.md`, không trả traceback/secret cho client.
- Không log mật khẩu, token, cookie, dữ liệu nhạy cảm hoặc toàn bộ request body tùy tiện. Dùng logger hiện hành `qltpchay.logger`; không thêm logging framework khác hoặc chuyển ngầm sang `app.logger`.

### Flask khi được đưa vào trong tương lai

Chỉ áp dụng mục này sau khi xác nhận app factory, Flask version và cấu hình Flask đã thực sự tồn tại trong repo. Khi đó, tuân theo convention hiện hành của project; nếu chưa có convention thì trước khi mở rộng Flask routes, thống nhất một mẫu duy nhất: route/Blueprint mỏng, validation/HTTP mapping ở tầng web, nghiệp vụ ở service, persistence ở model/repository. Không nhét SQL/nghiệp vụ vào route.

```python
# DO: chỉ dùng context proxy trong request/app context; truyền dependency ngoài request.
from flask import Blueprint, current_app, jsonify, request

bp = Blueprint("products", __name__)

@bp.get("/api/products/<int:product_id>")
def get_product(product_id: int):
    service = current_app.extensions["product_service"]
    product = service.get(product_id)
    if product is None:
        return jsonify({"error": "Không tìm thấy sản phẩm."}), 404
    return jsonify({"data": product}), 200
```

```python
# DON'T: gọi current_app/request trong import-time hoặc hàm chạy ngoài context.
from flask import current_app

DATABASE_URL = current_app.config["DATABASE_URL"]  # RuntimeError khi import module
```

- Không gọi `request`, `g`, `current_app` trong thread/background task sau khi request kết thúc. Truyền dữ liệu cần thiết vào task; nếu thật sự cần app context, đẩy app instance và dùng `with app.app_context()` theo lifecycle có kiểm soát.
- Không tạo/cấu hình app khi import module. Dùng app factory nếu kiến trúc Flask được xác nhận; đăng ký Blueprint và extension một lần trong factory.
- Không bắt mọi exception rồi trả HTTP 200 hoặc nuốt lỗi. Dùng error handler thống nhất và response schema đã có; nếu project chưa có schema, thiết kế/mô tả schema trước khi áp dụng rộng.

## 3. Test: runner, môi trường, fixtures và cô lập

### Runner hiện có

- Unit test Python: `python scripts/run_tests_summary.py unit` hoặc `python -m unittest discover -s tests`. Chạy test cụ thể theo cú pháp tại `docs/TESTING.md`.
- Integration/acceptance giao diện: Playwright qua `python scripts/run_tests_summary.py integration`, `npm run test:integration`, hoặc `npm run test:acceptance` theo phạm vi. Xem `playwright.config.js`, `tests/integration/run_test_server.py` và helper trong `tests/integration/support/` trước khi thêm test.
- Đây không phải pytest project hiện tại. Không dùng lệnh `pytest` hoặc thêm pytest fixture/conftest như thể đã được cấu hình. Chỉ đổi runner sau khi yêu cầu và cấu hình repo được cập nhật.

### Database và config test

- Không bao giờ chạy test tự động lên `data/inventory.db`, database production, server staging/remote hoặc file config production. Trước khi chạy, kiểm tra command, URL đích và nguồn DB. Integration server phải đặt cả SQLite fixture lẫn manifest asset JS vào thư mục tạm, không được ghi vào `data/`. Nếu không chứng minh được test đang cô lập, dừng trước khi thực thi lệnh có thể ghi dữ liệu.
- `APP_ENV=test` không đủ để bảo đảm an toàn: `qltpchay/constants.py` vẫn trỏ `DB_PATH` vào `data/inventory.db`. Unit test hiện tạo SQLite file riêng bằng `tempfile`; integration server tạo DB trong thư mục tạm và seed fixture. Giữ cơ chế này hoặc thay bằng cơ chế cô lập đã được xác minh.
- Integration harness dùng cấu hình test riêng ở `tests/integration/test_runtime_config.json`; không đọc `system_config.json` hoặc `system_config.production.json` để chạy integration test. `playwright.config.js` và test server cùng lấy `TEST_ADMIN_PATH` từ cấu hình này (hoặc override tường minh qua environment).
- Với UI admin, dùng `openAdminPage(page)` từ `tests/integration/support/ui.js`. Helper điều hướng theo `TEST_ADMIN_PATH` và assert `#adminLoginForm` hiện ra trước khi cho phép thao tác đăng nhập. Không tự gọi `page.goto("/")`/`page.goto("/admin")` trong test admin hoặc tiếp tục thao tác nếu assertion route thất bại.

```js
// DO: dùng origin của Playwright và path cấu hình dành riêng cho test.
await openAdminPage(page); // Đọc path test dùng chung và xác nhận đúng UI admin.
```

```js
// DON'T: nhầm trang public root với trang admin hoặc tiếp tục test khi route sai.
await page.goto("/");
await page.getByLabel("Mật khẩu quản trị").fill(password);
```

### Fixture và auth

- `unittest.TestCase.setUp/tearDown` phải tạo và đóng tài nguyên cho từng test. Ưu tiên DB file riêng trong `tempfile` khi SQLite WAL/locking hoặc nhiều connection có liên quan; `:memory:` chỉ dùng khi mọi connection dùng chung cùng connection/database và hành vi tương ứng production.
- Khởi tạo `InventoryStore` trỏ rõ ràng vào DB tạm; khởi tạo HTTP server loopback trên cổng tự do (`port=0`) khi cần test HTTP, chạy thread nền và luôn `shutdown`, `server_close`, `join`, xóa DB/WAL/SHM trong `tearDown`, kể cả khi assertion lỗi.
- Truyền `system_config`/session manager trực tiếp vào `create_handler`; test credential/session phải là dữ liệu giả riêng test, không lấy hay in thông tin xác thực thực. Với Playwright, dùng fixture server/DB của `run_test_server.py`, API helper và cookies do login helper tạo; tránh session/cookie dùng chung giữa test.
- Seed dữ liệu tối thiểu cần thiết mỗi test. Mỗi test phải tự sở hữu dữ liệu nó tạo và dọn lại; nếu suite hiện có dùng shared fixture/state, tuân theo helper/cleanup hiện hành và không chạy song song khi chưa chứng minh an toàn.

### Isolation, rollback và mock

- Test độc lập thứ tự là yêu cầu bắt buộc; dọn fixture/resource sau mỗi test. Không mặc định rằng rollback transaction sẽ cô lập được: `InventoryStore` dùng SQLite connection/context riêng cho operation. Cô lập bằng DB tạm riêng là chuẩn hiện tại; chỉ dùng rollback nếu test thật sự giữ một connection/transaction xuyên suốt.
- Mock third-party API, SMTP/mail, Zalo/OAuth, thời gian, network ngoài, tác vụ nền hoặc dịch vụ tốn phí/không xác định khi test unit. Dùng fake/mock ở boundary; không mock logic nội bộ mà test đang cần xác minh.
- Integration test của ứng dụng phải đi qua HTTP server cục bộ và test database. Mock external dependency tại điểm tích hợp nếu không có sandbox đáng tin; không gọi dịch vụ production. Test staging/remote chỉ chạy theo lệnh rõ trong `docs/TESTING.md` với mode an toàn phù hợp, không dùng như unit/integration mặc định.
- Nếu bổ sung harness dùng chung có thể đảm bảo `setUp/tearDown`/fixture an toàn, hãy dùng nó. Không thêm option “rollback mỗi test” nếu mỗi test đã có DB riêng hoặc nếu transaction semantics không bao phủ mọi connection; ghi rõ cơ chế cô lập thực tế trong test docs khi thay đổi.

## 4. Checklist trước khi bàn giao

- [ ] Đã đọc `AGENTS.md`, tài liệu nghiệp vụ/design/test liên quan và tìm mẫu code/test hiện có.
- [ ] Đã xác minh kiến trúc thực tế; không dùng Flask/pytest/TestingConfig giả định khi project chưa triển khai chúng.
- [ ] Mọi import theo package hiện hành; không có `sys.path` workaround, import-time side effect hoặc context proxy ngoài context.
- [ ] Mọi test chỉ trỏ tới temp DB/test fixture và loopback; không trỏ DB/config production hay staging/remote ngoài chủ đích.
- [ ] Nếu test admin UI: dùng đúng `admin_path` của test harness, assert trang admin hiện ra trước khi đăng nhập.
- [ ] Fixture, server, thread, connection, DB sidecar và state auth được dọn sau test; test không phụ thuộc thứ tự.
- [ ] External service được mock/fake ở boundary trong unit test; integration không tự gửi mail/gọi API production.
- [ ] Chạy đúng runner hiện có, không tự dùng `pytest`; ghi lại lệnh và kết quả. Nếu chưa chạy được, nêu rõ nguyên nhân.
- [ ] Kiểm tra backward compatibility của endpoint, payload, auth, config và SQLite schema; nếu đổi schema, tuân thủ quy trình DB/migration trong `AGENTS.md`.
- [ ] Cập nhật help/tài liệu liên quan khi đổi workflow; nếu thay client `.js`, cập nhật manifest version theo `AGENTS.md`.
- [ ] Đã chạy kiểm tra tối thiểu phù hợp theo `AGENTS.md` (`node --check static/app.js`, `python -m py_compile app.py`, và test unit/integration liên quan).

## 5. Cập nhật quy tắc

Khi kiến trúc, config test, fixture, schema hoặc runner thay đổi, cập nhật tài liệu này cùng thay đổi code. Chỉ ghi convention như quy tắc hiện hành sau khi xác minh bằng code, config và một test chạy được. Các ví dụ minh họa phải dùng dữ liệu giả và không được chứa secret thật.
