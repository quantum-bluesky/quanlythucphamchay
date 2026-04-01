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
- Frontend: `static/index.html`, `static/app.js`, `static/styles.css`
- DB: `data/inventory.db`
- Config hệ thống runtime: `data/system_config.json`
- Tài liệu người dùng: `README.md`, `docs/HUONG_DAN_SU_DUNG.md`, `docs/DEPLOY_WINDOWS.md`
- Dữ liệu seed: `data/List.txt`, `data/List_price.txt`
- Test: `tests/`

## Nguồn sự thật của nghiệp vụ

Khi cần hiểu logic hiện tại, đọc theo thứ tự:

1. `README.md`
2. `docs/HUONG_DAN_SU_DUNG.md`
3. `app.py`
4. `static/app.js`

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

Nếu không chạy được test, phải nói rõ lý do trong báo cáo cuối.

## Nguyên tắc sửa code

- không thêm package ngoài nếu chưa thật cần; project đang chạy tốt bằng stdlib
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
2. xác định ảnh hưởng tới backend/frontend/docs
3. sửa code
4. chạy kiểm tra cú pháp tối thiểu
5. cập nhật help/docs nếu workflow hoặc label thay đổi

## Prompt khởi động tốt cho Codex ở repo này

```text
Read AGENTS.md, README.md, docs/HUONG_DAN_SU_DUNG.md, and .codex/config.toml first.
Then inspect app.py and static/app.js for the affected workflow before editing.
Keep changes minimal, preserve mobile UX, and run node --check static/app.js plus python -m py_compile app.py before finishing.
```
