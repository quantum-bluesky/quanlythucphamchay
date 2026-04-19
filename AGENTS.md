# AGENTS.md

## Mục tiêu project

Ứng dụng này là hệ thống quản lý thực phẩm chay chạy bằng Python stdlib + SQLite + SPA frontend.

Mục tiêu khi làm việc trong repo này:

- giữ app chạy được ngay bằng `python app.py`
- ưu tiên luồng nghiệp vụ thật cho cửa hàng nhỏ trên mobile
- thay đổi nhỏ, đúng chỗ, tránh phá dữ liệu đang dùng
- luôn giữ đồng bộ giữa code, help trong app và tài liệu người dùng

## Stack và cấu trúc chính

- Backend: `app.py`
- Backend package phụ trợ: `qltpchay/`
- Frontend: `static/index.html`, `static/app.js`, `static/styles.css`
- Frontend shared modules: `static/modules/`
- DB: `data/inventory.db`
- Config hệ thống runtime: `data/system_config.json`
- Tài liệu người dùng: `README.md`, `docs/HUONG_DAN_SU_DUNG.md`, `docs/DEPLOY_WINDOWS.md`
- Tài liệu design: `docs/SCREEN_DESIGN.md`, `docs/DB_DESIGN.md`, `docs/BUSINESS_FLOW.md`, các tài liệu detail `docs/*_DESIGN.md`
- Tài liệu test: `docs/TESTING.md`
- Dữ liệu seed: `data/List.txt`, `data/List_price.txt`
- Test unit + integration: `tests/`

### Module backend hiện tại

- `qltpchay/constants.py`: đường dẫn và hằng số hệ thống
- `qltpchay/helpers.py`: parse/format helpers dùng chung
- `qltpchay/config.py`: đọc/ghi config hệ thống
- `qltpchay/auth.py`: session và cookie admin
- `qltpchay/importer.py`: seed/import sản phẩm ban đầu
- `qltpchay/store.py`: logic kho, báo cáo, sync state, import/export
- `qltpchay/http_handler.py`: request handler HTTP
- `app.py`: entrypoint/CLI bootstrap mỏng

### Module frontend hiện tại

- `static/app.js`: entrypoint chính và orchestration UI
- `static/modules/app-state.js`: state dùng chung và storage keys
- `static/modules/dom.js`: DOM refs dùng chung
- `static/modules/screen-config.js`: help/meta/search config theo màn
- `static/modules/utils.js`: format/escape/utility dùng chung

## Nguồn sự thật của nghiệp vụ

Khi cần hiểu logic hiện tại, đọc theo thứ tự:

1. `README.md`
2. `docs/HUONG_DAN_SU_DUNG.md`
3. `docs/SCREEN_DESIGN.md`
4. `docs/DB_DESIGN.md`
5. `docs/BUSINESS_FLOW.md`
6. tài liệu design detail liên quan, ví dụ `docs/PHIEU_DISPLAY_DESIGN.md`
7. `qltpchay/store.py`
8. `app.py`
9. `static/app.js`

Không giả định từ trí nhớ cũ nếu code hiện tại nói khác.

## Quy ước nghiệp vụ hiện tại

- `products.price` là `giá nhập mặc định`
- `products.sale_price` là `giá bán mặc định`
- user thường không được chỉnh tồn kho trực tiếp ở màn `Tồn kho`
- luồng tồn kho chuẩn phải đi qua `đơn chờ xuất` hoặc `phiếu chờ nhập`
- chỉ `Master Admin` mới được bypass quy trình chuẩn để chỉnh tồn trực tiếp
- khi sửa workflow nghiệp vụ, phải cập nhật cả:
  - help trong app ở `SCREEN_HELP` trong `static/app.js`
  - `README.md`
  - `docs/HUONG_DAN_SU_DUNG.md`
  - `docs/SCREEN_DESIGN.md` nếu thay đổi common design / layout / field hiển thị / điều hướng giữa màn
  - `docs/DB_DESIGN.md` nếu thay đổi schema, migration, ledger, state sync, audit hoặc cách tính tồn
  - `docs/BUSINESS_FLOW.md` nếu thay đổi workflow nghiệp vụ, trạng thái chứng từ hoặc rule xử lý
  - tài liệu design detail liên quan như `docs/PHIEU_DISPLAY_DESIGN.md` nếu thay đổi chi tiết theo domain
  - nếu có thay đổi deploy/config, cập nhật thêm `docs/DEPLOY_WINDOWS.md`

## Cách chạy

Chạy app:

```powershell
python app.py
```

Chạy với host/port cụ thể:

```powershell
python app.py --host 0.0.0.0 --port 8000
```

Xem config runtime:

```powershell
python app.py config
```

Khởi tạo dữ liệu:

```powershell
python app.py init
python app.py init --reset
```

## Kiểm tra bắt buộc sau khi sửa

Ít nhất phải chạy:

```powershell
node --check static/app.js
python -m py_compile app.py
```

Nếu thay logic backend hoặc schema, ưu tiên chạy thêm:

```powershell
python -m unittest discover -s tests
```

Nếu thay workflow UI, menu, selector, sync state hoặc điều hướng, ưu tiên chạy thêm:

```powershell
npm run test:integration
```

Suite integration dùng `Playwright` và fixture DB tạm, được cấu hình ở:

- `playwright.config.js`
- `tests/integration/run_test_server.py`

Nếu không chạy được test, phải nói rõ lý do trong báo cáo cuối.

## Nguyên tắc sửa code

- không thêm package runtime ngoài nếu chưa thật cần; app hiện vẫn chạy tốt bằng stdlib
- không đổi schema DB mà bỏ quên migration trong `_initialize_schema()`
- không phá dữ liệu cũ; mọi cột mới phải có hướng tương thích ngược
- giữ patch nhỏ, sửa đúng nguồn gốc thay vì workaround ở UI
- không revert thay đổi của user nếu không được yêu cầu
- ưu tiên mobile UX vì app được dùng nhiều trên điện thoại
- khi thêm button/action mới trên mobile, cân nhắc thu gọn, sticky, overflow `...` và tránh che nội dung

## Quy ước UI/UX cho repo này

- ưu tiên gọn, rõ, thao tác nhanh trên mobile
- trong list/card mobile:
  - chỉ để 1-2 hành động chính hiện trực tiếp
  - hành động phụ gom vào `...` khi hợp lý
- các list dài nên có phân trang `Trước / Sau`
- các màn chính nên có search linh hoạt theo tên đối tượng
- popup/help phải đóng được bằng click ra ngoài hoặc nút đóng

## Những điểm cần cẩn trọng

- `data/system_config.json` là config runtime thật, không hardcode lại username/password admin vào nơi khác
- module `Master Admin` có import/export và backup/restore DB, nên mọi thay đổi liên quan dữ liệu phải cân nhắc tương thích
- phần `state` đồng bộ qua SQLite/server đang dùng để chia sẻ giữa nhiều máy; tránh đưa dữ liệu nghiệp vụ quan trọng trở lại `localStorage`
- nếu thay đổi semantics của giá:
  - kiểm tra màn `Sản phẩm`
  - kiểm tra `Tạo đơn xuất hàng`
  - kiểm tra `Quản lý nhập hàng`
  - kiểm tra `Báo cáo`

## Khi nhận task mới

Mặc định nên:

1. đọc file liên quan
2. đọc `docs/SCREEN_DESIGN.md`, `docs/DB_DESIGN.md`, `docs/BUSINESS_FLOW.md` và tài liệu design detail liên quan nếu task đụng UI / workflow / hiển thị / dữ liệu
3. xác định ảnh hưởng tới backend/frontend/docs
4. sửa code
5. chạy kiểm tra cú pháp tối thiểu
6. cập nhật help/docs nếu workflow, label hoặc design thay đổi
7. nếu thêm/sửa test case hoặc test spec, cập nhật ngay tài liệu test trong repo gồm `docs/TESTING.md`, `docs/TEST_CASE_INDEX.md`, `docs/TEST_CASE_DESCRIPTIONS.md` để quy ước được giữ ở mức global, không chỉ trong session hiện tại

## Quy ước bổ sung cho tooling/setup

- nếu trong lúc làm task phát hiện thiếu tool hoặc dependency môi trường, không chỉ báo miệng rồi bỏ qua
- mặc định phải đề xuất bổ sung và nếu hợp lý thì cập nhật luôn vào script setup + tài liệu setup/test/deploy để máy khác dùng lại được
- ưu tiên giữ setup có thể chạy lặp lại nhiều lần an toàn
- đã biết một dependency tooling cần có: `PyYAML` cho workflow Git Issue / `quick_validate.py`

## Prompt khởi động tốt cho Codex ở repo này

```text
Read AGENTS.md, README.md, docs/HUONG_DAN_SU_DUNG.md, docs/SCREEN_DESIGN.md, and .codex/config.toml first.
Then inspect app.py and static/app.js for the affected workflow before editing.
Keep changes minimal, preserve mobile UX, and run node --check static/app.js plus python -m py_compile app.py before finishing.
```
