# Hướng dẫn test

## Mục tiêu

Project có 2 lớp test:

- `unit test` cho logic backend nhỏ
- `integration test` cho toàn bộ giao diện và API theo luồng nghiệp vụ thật

Ngoài ra có thêm `acceptance checklist` để kiểm soát case bàn giao:

- checklist: `docs/ACCEPTANCE_CHECKLIST.md`
- automation bundle: `npm run test:acceptance`
- mapping mã test: `docs/TEST_CASE_INDEX.md`
- mô tả ngắn test case: `docs/TEST_CASE_DESCRIPTIONS.md`

## 0. Setup tool trước khi test

Máy mới nên chạy script setup chung của repo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
```

Script sẽ kiểm tra và cài nếu thiếu:

- `Python 3.11+`
- `PyYAML` cho tooling Python như Git Issue / `quick_validate.py`
- `Node.js LTS + npm`
- `Git`
- `GitHub CLI (gh)` cho workflow GitHub
- `Playwright Chromium`

Có thể chạy lại nhiều lần. Nếu chỉ muốn xem máy còn thiếu gì:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1 -CheckOnly
```

## 1. Unit test

Chạy:

```powershell
python -m unittest discover -s tests
```

Quy ước mã case unit:

- `UT-DB-*`: case dữ liệu / DB / receipt ledger
- `UT-NORM-*`: case migration / bảng quan hệ chuẩn hóa
- `UT-SYNC-*`: case sync state / conflict
- `UT-AUD-*`: case audit
- `UT-HIS-*`: case history filter

Tên method đã được chuẩn hóa theo mã case ở đầu, ví dụ:

- `test_ut_db_01_create_product_and_stock_summary`
- `test_ut_sync_02_save_sync_state_rejects_stale_expected_updated_at`

Phù hợp khi sửa:

- logic `InventoryStore`
- validate dữ liệu
- tính tồn kho / báo cáo
- sync state `purchases`, đặc biệt rule không lưu phiếu nhập nháp nếu chưa có mặt hàng

## 2. Integration test

Integration test dùng `Playwright`.

### Cài dependency test

```powershell
npm install
npx playwright install chromium
```

### Chạy toàn bộ suite

```powershell
npm run test:integration
```

Quy ước mã case integration/acceptance:

- `ACC-*`: acceptance case hoặc regression đang map trực tiếp với checklist bàn giao
- `IT-*`: integration regression bổ sung ngoài checklist chính

Tên test Playwright đã được chuẩn hóa với mã ở đầu title để có thể lọc bằng `--grep`/`--grep-invert`.

### Chạy acceptance automation theo checklist

```powershell
npm run test:acceptance
```

### Chạy acceptance có giao diện browser

```powershell
npm run test:acceptance:headed
```

### Chạy có giao diện browser

```powershell
npm run test:integration:headed
```

## 2.1. Chạy theo mã test case

### Chạy 1 case Playwright

```powershell
npm run test:integration -- --grep "ACC-SALE-01"
```

### Chạy nhiều case Playwright

```powershell
npm run test:integration -- --grep "ACC-SALE-01|ACC-PUR-01|ACC-PUR-03|ACC-SYNC-01"
```

### Loại trừ một nhóm case Playwright

Ví dụ bỏ toàn bộ case Phase D:

```powershell
npm run test:integration -- --grep-invert "IT-PHD-"
```

### Chạy 1 unit case cụ thể

```powershell
python -m unittest tests.test_app.InventoryStoreTests.test_ut_db_01_create_product_and_stock_summary
```

## 2.2. Script chuẩn để include / exclude theo mã

Repo có thêm script:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-test-cases.ps1
```

Hoặc gọi qua npm:

```powershell
npm run test:cases -- -Target all
```

Ví dụ:

### Chỉ chạy nhóm sync

```powershell
npm run test:cases -- -Target all -IncludeCode UT-SYNC,ACC-SYNC
```

### Chạy integration nhưng loại trừ Phase D

```powershell
npm run test:cases -- -Target integration -ExcludeCode IT-PHD
```

### Chạy unit nhưng loại trừ toàn bộ case DB

```powershell
npm run test:cases -- -Target unit -ExcludeCode UT-DB
```

### Chạy toàn bộ trừ nhóm DB

```powershell
npm run test:cases -- -Target all -ExcludeCode UT-DB
```

## Integration suite đang kiểm tra gì

Suite hiện tại chạy trên `fixture DB` tạm, không đụng vào `data\inventory.db` thật.

Các nhóm kiểm tra chính:

- `Tồn kho -> Nhập hàng -> Xuất hàng -> Sản phẩm`
- `Tạo đơn xuất hàng`: chốt đơn hoàn chỉnh, thiếu hàng của user thường
- `Đơn hàng -> Khách hàng -> Nhà cung cấp -> Báo cáo -> Lịch sử & khôi phục`
- `Nhập hàng -> NCC mới`: mở form nhà cung cấp từ phiếu nhập, lưu xong quay lại áp vào phiếu
- `Nhà cung cấp có lịch sử phiếu đã thanh toán`: sửa NCC không được làm vỡ sync hay đụng vào phiếu nhập lịch sử đã khóa
- `Phiếu nhập legacy`: purchase `received/paid` thiếu timestamp vẫn phải hiển thị được ngày xử lý fallback để không kẹt flow thanh toán
- `Báo cáo`: nút shortcut `Audit` phải tự cuộn xuống khung `Audit chứng từ` để xem ngay lịch sử chứng từ
- `Audit chứng từ`: phải tra cứu được theo mã phiếu và mã tham chiếu nguồn trong kỳ đang xem
- `Điều hướng mở phiếu/detail`: khi mở giỏ nháp hoặc phiếu nhập từ danh sách, viewport phải tự cuộn lên khối thông tin của phiếu vừa mở
- `Menu PC/tablet`: nút `Mở menu` phải bung menu, menu tự thu gọn khi rê chuột hoặc bấm ra ngoài, và chiều rộng menu không bị bung quá rộng
- `Điều hướng sau khi xoay màn hình`: đổi giữa dọc/ngang vẫn phải bấm được menu nghiệp vụ để sang màn khác
- `Tablet touch sau login`: vừa đăng nhập xong vẫn phải tap được nút `Mở menu` và item menu nghiệp vụ, không bị header menu chặn touch
- `Input Tablet + bàn phím ảo`: khi viewport chỉ đổi chiều cao vì bàn phím bật/tắt, ô input đang nhập vẫn phải giữ focus và nhập tiếp được
- `Phân trang PC/tablet`: list tự lấy số mục mặc định theo thiết bị và cho đổi nhanh `25/50/100` trên thanh phân trang
- `Đăng nhập hệ thống`: header `Login/Logout`, user thường, admin, timeout session, role-based access
- `Master Admin`: login admin, export/import file master (`JSON` + `CSV`), backup, restore
- `Phase B API`: phiếu điều chỉnh tồn, phiếu trả hàng khách, phiếu trả NCC
- `Phase B UI`: tạo phiếu điều chỉnh trên màn tồn kho, tạo phiếu trả khách từ đơn cũ hoặc nhập tay, tạo phiếu trả NCC từ phiếu nhập cũ hoặc nhập tay
- `Phase B.4 report/audit`: báo cáo tháng tách riêng hoàn khách, trả NCC, điều chỉnh tồn và API tra cứu lịch sử chứng từ
- `UI mobile floating`: menu nổi, tìm kiếm nhanh và cụm nút điều hướng auto-hide vào mép màn hình rồi mở lại an toàn

Ngoài click thao tác, suite còn kiểm tra:

- refresh lại ngay trên từng màn
- lỗi runtime kiểu `... is not defined`
- toast lỗi đồng bộ hoặc lỗi JS
- đối chiếu lại stock / order / transaction sau khi chạy case nghiệp vụ chính

## File chính của suite

- Config Playwright: `playwright.config.js`
- Server test riêng: `tests/integration/run_test_server.py`
- Helper UI/runtime: `tests/integration/support/ui.js`
- Spec chính:
  - `tests/integration/core-workflows.spec.js`
  - `tests/integration/management-screens.spec.js`
  - `tests/integration/detail-scroll.spec.js`
  - `tests/integration/reports-shortcuts.spec.js`
  - `tests/integration/purchase-supplier-flow.spec.js`
  - `tests/integration/pagination-settings.spec.js`
  - `tests/integration/login.spec.js`
  - `tests/integration/mobile-floating-ui.spec.js`
  - `tests/integration/admin.spec.js`
  - `tests/integration/acceptance-checklist.spec.js`
  - `tests/integration/acceptance-sales-phase-b.spec.js`
  - `tests/integration/workflow-phase-b.spec.js`
  - `tests/integration/cross-client-sync.spec.js`
  - `tests/integration/workflow-phase-a.spec.js`
  - `tests/integration/workflow-phase-c.spec.js`

Case mới cho Phase A:

- `ACC-PUR-03`: phiếu nhập nháp phải được đặt hàng trước khi nhập kho, và phiếu đã đặt hàng vẫn còn chỉnh sửa được trước khi nhận hàng
- `IT-PURSUP-01`: tạo nhà cung cấp từ màn nhập hàng rồi quay lại phiếu nhập vẫn giữ được giá trị NCC trên UI, nhưng phiếu nháp rỗng không còn persist
- `UT-DB-11`: backend chặn `draft -> received`, cho phép `ordered` chỉnh tiếp rồi mới chuyển sang `received`

Case mới cho Phase B.4:

- `ACC-PHB-04`: báo cáo tháng và audit chứng từ phản ánh đúng `phiếu trả khách`, `phiếu trả NCC`, `phiếu điều chỉnh tồn`
- `UT-REP-01`: backend report tách riêng sale/purchase với customer return / supplier return / adjustment
- `UT-AUD-03`: receipt history trả về source link và audit message cho 3 loại phiếu Phase B
- `UT-NORM-04`: sync state không persist phiếu nhập nháp rỗng, chỉ lưu draft khi đã có ít nhất một mặt hàng

Case regression UI báo cáo:

- `IT-REP-01`: click shortcut `Audit` ở màn `Báo cáo` phải scroll xuống đúng khối `Audit chứng từ`

Case regression điều hướng/detail:

- `IT-NAV-01`: mở giỏ nháp hoặc phiếu nhập từ list phải tự scroll đến khối thông tin của phiếu vừa mở

## Lưu ý

- App runtime thật vẫn chỉ cần `Python stdlib + SQLite`
- `Node.js` và `Playwright` chỉ cần cho bộ test integration
- Nếu sửa workflow, label, selector hoặc menu, hãy cập nhật test tương ứng
- Nếu thêm hoặc đổi workflow nghiệp vụ, hãy cập nhật luôn checklist acceptance để người test và agent dùng chung một chuẩn
- Nếu thêm test mới, hãy đặt mã case ở đầu tên test hoặc method name để có thể lọc theo mã
- Nếu thêm/sửa/xóa mã test, hãy cập nhật đồng thời `docs/TEST_CASE_INDEX.md` và `docs/TEST_CASE_DESCRIPTIONS.md`
- Việc bổ sung tài liệu test phải được ghi trực tiếp vào repo để dùng lại cho mọi máy và mọi session, không chỉ nhắc tạm trong một lần làm việc
- Nếu cần điều tra lỗi sync nhiều máy, có thể bật `debug.sync_state=true` trong `data/system_config.json` để xem log `/api/state` ở console server và browser
