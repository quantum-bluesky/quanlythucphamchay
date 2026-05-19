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
- quản lý tồn theo lô, FEFO theo HSD thật và phân bổ lô khi xuất/trả hàng
- sync state `purchases`, đặc biệt rule không lưu phiếu nhập nháp nếu chưa có mặt hàng
- workflow phiếu nhập: thiếu NCC thì không được `Đã đặt hàng` hoặc `Nhập kho`
- workflow gom nhập batch: chỉ một user giữ khóa, user có permission batch không có quyền chỉnh tồn trực tiếp, và một sản phẩm thiếu chỉ được gán vào một phiếu nhập batch mở
- lock màn `Nhập hàng` trong Batch mode: user không giữ khóa không được tạo/sửa phiếu `draft/ordered`, nhưng vẫn đi tiếp được các bước hậu cần như `received/paid`
- lock workflow của `giảm giá khuyến mại` trước/sau thanh toán ở đơn xuất và phiếu nhập
- audit actor cho import master và message diff chi tiết ở lịch sử sản phẩm

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
Mỗi lần chạy Playwright sẽ tự khởi động lại test server fixture mới; không tái dùng server cũ để tránh state tạm từ lượt fail trước làm bẩn kết quả.

Các nhóm kiểm tra chính:

- `Tồn kho -> Nhập hàng -> Xuất hàng -> Sản phẩm`
- `Tạo đơn xuất hàng`: chốt đơn hoàn chỉnh, cho phép chốt khi phần thiếu đã được phiếu nhập `Đã đặt` cover đủ, còn với thiếu hàng chưa đặt đủ thì user thường có confirm trước khi tạo/cập nhật phiếu nhập và không tạo trùng khi đã có phiếu mở liên quan
- `Reload số lượng sau đổi trạng thái`: sau `Xuất kho` hoặc `Nhập kho`, các màn `Tồn kho`, `Xuất hàng`, `Nhập hàng` phải nạp lại dữ liệu server mới mà không cần F5
- `Xử lý nhập thiếu batch`: bật batch mode từ user có quyền, kiểm tra planner gom cả đơn nháp/đơn chốt, chặn bắt đầu kỳ gom khi đang có conflict phiếu nhập mở, và không cho tạo trùng phiếu nhập cho cùng sản phẩm thiếu
- `Conflict đầu kỳ gom`: khi app chặn `Bắt đầu kỳ gom`, màn planner phải hiện danh sách conflict có thể bấm mở thẳng các phiếu nhập liên quan
- `Extra rows trong planner batch`: batch owner thêm được mặt hàng `Ngoài nhu cầu đơn`, gom chung theo NCC với shortage rows, nhưng không tạo assignment shortage
- `Khóa màn Nhập hàng theo batch owner`: user không giữ khóa phải bị khóa create/edit `draft/ordered`; ngoại lệ duy nhất là vẫn được `Nhập kho` rồi `Đã thanh toán` với phiếu không phải batch đã `Đã đặt` từ trước lúc kỳ gom hiện tại bắt đầu, kể cả khi owner có sửa lại phiếu sau đó hoặc dữ liệu legacy còn thiếu `ordered_at`
- `Thoát flow batch khi còn khóa`: owner rời `Xử lý nhập thiếu` sang màn ngoài flow phải thấy dialog hỏi kết thúc kỳ gom; nếu không kết thúc thì app hỏi tiếp để chọn `ở lại` hoặc `đi tiếp mà vẫn giữ batch mode`, còn nếu `OK` ngay từ dialog đầu thì release lock rồi mới điều hướng
- `Confirm đổi trạng thái/xóa chứng từ`: trước khi `Xuất`, `Đã thanh toán`, `Đã đặt hàng`, `Nhập kho`, `Hủy`, `Xóa` app phải hiện dialog confirm
- `Version cache-busting client JS`: HTML entrypoint và các module import phải được serve kèm query `?v=version-chính.N`, counter phải tăng đúng khi file `.js` đổi nội dung và không tăng nếu chỉ đổi line ending `CRLF/LF`
- `Đơn hàng -> Khách hàng -> Nhà cung cấp -> Báo cáo -> Lịch sử & khôi phục`
- `Xuất lại / Nhập lại`: từ đơn đã `Đã xuất hàng` tạo được đơn nháp mới cùng nội dung, và từ phiếu đã `Đã nhập kho` tạo được phiếu nháp mới cùng NCC/nội dung nhưng reset metadata lô
- `Nhập hàng -> NCC mới`: mở form nhà cung cấp từ phiếu nhập, lưu xong quay lại áp vào phiếu
- `Nhập hàng theo NCC`: mỗi NCC chỉ có 1 phiếu nháp riêng; chọn lại cùng NCC phải mở nháp sẵn có và không được tạo trùng khi đổi qua lại giữa các NCC
- `Nhập hàng -> nháp tạm`: phiếu nháp còn trống phải xóa được ngay trên UI, và nút `NCC` vẫn phải cho đổi sang NCC khác khi phiếu còn `Nháp`
- `Nhập hàng -> gợi ý NCC`: phiếu chưa có NCC phải tự chọn NCC nếu mặt hàng chỉ có 1 NCC từng nhập thực tế; nếu có nhiều NCC thì datalist NCC phải ưu tiên NCC nhập nhiều hơn nhưng không tự điền
- `Nhập hàng -> cảnh báo nhiều NCC`: khi một mặt hàng đang nằm ở phiếu `draft/ordered` của NCC khác, màn `Nhập hàng` phải cảnh báo, mở được danh sách phiếu liên quan để review, và vẫn cho giữ nguyên hiện trạng nếu user chấp nhận
- `Nhà cung cấp có lịch sử phiếu đã thanh toán`: sửa NCC không được làm vỡ sync hay đụng vào phiếu nhập lịch sử đã khóa
- `Phiếu nhập legacy`: purchase `received/paid` thiếu timestamp vẫn phải hiển thị được ngày xử lý fallback để không kẹt flow thanh toán
- `Master Admin -> Legacy Audit`: phải quét ra đúng phần `fix an toàn` và `review thủ công`; apply safe fix xong thì số anomaly tương ứng phải giảm ngay
- `Legacy manual repair`: gắn lại `receipt_code` hoặc `đơn nguồn` xong thì record phải biến mất khỏi khối review thủ công sau khi refresh
- `Giảm giá khuyến mại`: đơn đã chốt chưa thanh toán và phiếu đã nhập kho chưa thanh toán phải sửa được tổng giảm giá, đồng thời báo cáo và bản in phải phản ánh số net sau khuyến mại
- `Báo cáo`: nút shortcut `Audit` phải tự cuộn xuống khung `Audit chứng từ` để xem ngay lịch sử chứng từ
- `Audit chứng từ`: phải tra cứu được theo mã phiếu và mã tham chiếu nguồn trong kỳ đang xem
- `Điều hướng mở phiếu/detail`: khi mở giỏ nháp hoặc phiếu nhập từ danh sách, viewport phải tự cuộn lên khối thông tin của phiếu vừa mở
- `Menu PC/tablet`: nút `Mở menu` phải bung menu, menu tự thu gọn khi rê chuột hoặc bấm ra ngoài, và chiều rộng menu không bị bung quá rộng
- `Điều hướng sau khi xoay màn hình`: đổi giữa dọc/ngang vẫn phải bấm được menu nghiệp vụ để sang màn khác
- `Tablet touch sau login`: vừa đăng nhập xong vẫn phải tap được nút `Mở menu` và item menu nghiệp vụ, không bị header menu chặn touch
- `Input Tablet + bàn phím ảo`: khi viewport chỉ đổi chiều cao vì bàn phím bật/tắt, ô input đang nhập vẫn phải giữ focus và nhập tiếp được
- `Phân trang PC/tablet`: list tự lấy số mục mặc định theo thiết bị và cho đổi nhanh `25/50/100` trên thanh phân trang
- `Sắp xếp tồn kho`: dropdown sort nằm trong phân trang đầu list, không nằm trong search toolbar, và sắp đúng theo tồn, giá trị tồn, ưu tiên, hạn còn lại
- `Đăng nhập hệ thống`: header `Login/Logout`, user thường, admin, timeout session, role-based access; user thường vẫn xem được detail tồn kho nhưng không thấy panel chỉnh tồn trực tiếp hay action admin như `Phiếu DC` / sửa giá
- `Master Admin`: login admin, export/import file master (`JSON` + `CSV`), backup, restore
- `CLI legacy-audit`: `python app.py legacy-audit` và `python app.py legacy-audit --apply-safe-fixes` phải chạy được trên DB thật mà không cần package ngoài
- `Phase B API`: phiếu điều chỉnh tồn, phiếu trả hàng khách, phiếu trả NCC
- `Phase B UI`: tạo phiếu điều chỉnh trên màn tồn kho, tạo phiếu trả khách từ đơn cũ hoặc nhập tay, tạo phiếu trả NCC từ phiếu nhập cũ hoặc nhập tay
- `Phase B.4 report/audit`: báo cáo tháng tách riêng hoàn khách, trả NCC, điều chỉnh tồn và API tra cứu lịch sử chứng từ
- `Lot/FEFO`: nhập nhiều lô cho cùng sản phẩm, hiển thị lô còn hàng ở tồn kho và trừ kho đúng theo HSD thật hoặc đúng batch chỉ định
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
  - `tests/integration/orders-actions.spec.js`
  - `tests/integration/reports-shortcuts.spec.js`
  - `tests/integration/purchase-supplier-flow.spec.js`
  - `tests/integration/pagination-settings.spec.js`
  - `tests/integration/inventory-sort.spec.js`
  - `tests/integration/login.spec.js`
  - `tests/integration/mobile-floating-ui.spec.js`
  - `tests/integration/admin.spec.js`
  - `tests/integration/acceptance-checklist.spec.js`
  - `tests/integration/acceptance-sales-phase-b.spec.js`
  - `tests/integration/procurement-batch-lock.spec.js`
  - `tests/integration/workflow-phase-b.spec.js`
  - `tests/integration/cross-client-sync.spec.js`
  - `tests/integration/workflow-phase-a.spec.js`
  - `tests/integration/workflow-phase-c.spec.js`

Case mới cho Phase A:

- `ACC-PUR-03`: phiếu nhập nháp phải được đặt hàng trước khi nhập kho, phiếu đã đặt hàng vẫn còn chỉnh sửa được trước khi nhận hàng, và tồn kho phải cập nhật ngay trên màn `Tồn kho` sau khi nhập kho mà không cần F5
- `IT-PUR-01`: card gợi ý ở màn `Nhập hàng` cho đổi nhanh ô `SL` trước khi bấm `+ Phiếu`; nếu mặt hàng có cảnh báo nhiều NCC thì test chọn giữ hiện trạng, và phiếu nháp vẫn phải nhận đúng số lượng vừa nhập
- `IT-PURSUP-01`: tạo nhà cung cấp từ màn nhập hàng rồi quay lại phiếu nhập vẫn giữ được giá trị NCC trên UI, nhưng phiếu nháp rỗng không còn persist
- `IT-PURSUP-05`: kiểm tra gợi ý NCC khi thêm hàng vào phiếu nhập chưa có NCC sẽ tự chọn nếu chỉ có 1 NCC lịch sử
- `IT-PURSUP-06`: kiểm tra gợi ý NCC khi có nhiều NCC lịch sử sẽ ưu tiên thứ tự datalist nhưng không tự điền NCC
- `IT-PURSUP-07`: kiểm tra cảnh báo khi một mặt hàng đang nằm ở phiếu mở của NCC khác, cho mở danh sách phiếu liên quan để review và vẫn giữ được hiện trạng nếu user muốn
- `IT-PURSUP-08`: kiểm tra `Nhập lại` từ phiếu `Đã nhập kho` tạo được phiếu nháp mới cùng NCC/nội dung nhưng reset `Mã lô` / `HSD` / `NSX`
- `IT-ORD-03`: kiểm tra `Xuất lại` từ đơn `Đã xuất hàng` tạo được đơn nháp mới cùng khách hàng, địa chỉ giao, giảm giá và các dòng hàng
- `UT-DB-11`: backend chặn `draft -> received`, cho phép `ordered` chỉnh tiếp rồi mới chuyển sang `received`
- `UT-DB-12`: backend chỉ cho xóa phiếu nhập `draft`, cho hủy phiếu `draft/ordered`, và chặn xóa trực tiếp phiếu `ordered`
- `UT-DB-16`: backend tự tính HSD của phiếu nhập theo `ngày nhập kho + thời gian bảo quản` hoặc `ngày sản xuất + thời gian bảo quản`
- `UT-DB-17`: backend cho cập nhật lại HSD/NSX của dòng phiếu `received`, đồng thời đồng bộ lại `purchase_items`, `inventory_batches`, `inventory_receipt_items`
- `UT-SYNC-04`: backend chặn `draft -> paid` ở đơn hàng, cho `draft -> cancelled`, cho `completed -> paid`, rồi khóa hẳn nhánh mở lại/hạ trạng thái sau khi đã `cancelled/paid`
- `UT-SYNC-05`: backend khóa `customerId/customerName` từ lúc đơn ở `committed`, vẫn cho sửa `ship_address`, và chặn đổi `committed -> completed` qua sync thẳng
- `UT-ORD-15`: backend `commit_cart_order()` không trừ kho, còn `ship_cart_order()` mới trừ kho và chuyển đơn sang `completed`
- `UT-DB-18`: backend nhận diện phiếu nhập `ordered` nhưng thiếu NCC là dữ liệu lỗi có thể repair để không khóa chết UI trên DB cũ
- `UT-DB-19`: backend legacy audit tách đúng `safe fixes` và `manual review`
- `UT-DB-20`: apply safe legacy fixes backfill được `cart.paid_at` và `purchase.received_at`
- `UT-DB-21`: admin attach lại `receipt_code` cho purchase legacy `paid` đang thiếu receipt
- `UT-DB-22`: admin attach lại `source_code` cho purchase legacy sinh từ đơn thiếu hàng
- `UT-PROC-01`: backend chỉ cho một người giữ khóa kỳ gom nhập active
- `UT-PROC-02`: backend planner gom nhu cầu thiếu và chặn một sản phẩm thiếu bị gán vào nhiều phiếu nhập batch mở
- `UT-PROC-03`: backend tạo batch nhiều dòng và gom các mặt hàng cùng NCC vào một phiếu nhập batch draft
- `UT-PROC-04`: backend khóa tạo/sửa phiếu `draft/ordered` trên màn `Nhập hàng` cho user không giữ khóa batch, nhưng vẫn cho tiếp bước `received/paid` cả ở nhánh sync state lẫn action trực tiếp từng phiếu
- `UT-PROC-05`: assignment batch tự release khi phiếu batch bị hủy hoặc đã chuyển sang `received`
- `UT-PROC-07`: batch create hỗ trợ mixed lines `shortage + extra`, vẫn gom đúng theo NCC và chỉ tạo assignment cho dòng shortage
- `UT-PROC-08`: extra row cùng sản phẩm với shortage row phải merge vào cùng phiếu batch/NCC đang xử lý, không tạo extra assignment
- `UT-AUTH-04B`: user thường có permission `procurement_batch_manage` được bắt đầu kỳ gom nhập nhưng vẫn không có quyền chỉnh tồn trực tiếp
- `IT-PROC-03`: batch owner thêm extra product trong planner, thấy badge `Ngoài nhu cầu đơn`, tạo phiếu thành công và review chung với shortage row cùng NCC

Case mới cho Phase B.4:

- `ACC-PHB-04`: báo cáo tháng và audit chứng từ phản ánh đúng `phiếu trả khách`, `phiếu trả NCC`, `phiếu điều chỉnh tồn`, với phiếu nhập nguồn được seed ở trạng thái `ordered` rồi mới gọi API `Nhập kho`
- `UT-REP-01`: backend report tách riêng sale/purchase với customer return / supplier return / adjustment
- `UT-AUD-03`: receipt history trả về source link và audit message cho 3 loại phiếu Phase B
- `UT-NORM-04`: sync state không persist phiếu nhập nháp rỗng, chỉ lưu draft khi đã có ít nhất một mặt hàng
- `UT-SYNC-03`: chỉ cho sửa `giảm giá khuyến mại` trước thanh toán, và khóa lại sau khi chứng từ đã được đánh dấu thanh toán
- `UT-SYNC-04`: đơn hàng chỉ được thanh toán sau khi đã `Đã xuất hàng`, vẫn cho hủy khi còn `draft`, và khóa luôn nhánh mở lại/hạ thanh toán sau khi đã `cancelled/paid`
- `UT-SYNC-05`: đơn `Chốt đơn` khóa khách hàng nhưng còn sửa được `Địa chỉ giao`; sync thẳng không được phép tự đổi sang `Đã xuất hàng`
- `UT-ORD-15`: test trực tiếp API backend cho flow `draft -> committed -> completed`
- `IT-STS-01`: sau `Chốt đơn -> Xuất hàng`, test chuyển sang `Tồn kho` và kiểm tra số lượng mới hiển thị ngay, đồng thời vẫn bắt confirm cho các action trạng thái/xóa/hủy

Case regression UI báo cáo:

- `IT-REP-01`: click shortcut `Audit` ở màn `Báo cáo` phải scroll xuống đúng khối `Audit chứng từ`

Case regression điều hướng/detail:

- `IT-NAV-01`: mở giỏ nháp hoặc phiếu nhập từ list phải tự scroll đến khối thông tin của phiếu vừa mở

Case mới cho Issue 70:

- `UT-INVSORT-01`: product metadata hạn dùng/bảo quản và metric ưu tiên tồn kho được chuẩn hóa đúng, không tính nhầm trả NCC hoặc điều chỉnh tồn vào demand
- `UT-INVSORT-02`: master CSV và seed pipe-format hỗ trợ `shelf_life_days` / `storage_life_days`, đồng thời vẫn nhận file cũ
- `IT-INV-SORT-01`: dropdown sort nằm trong pagination mobile và sắp đúng theo tồn, giá trị tồn, ưu tiên, hạn còn lại
- `IT-INV-SORT-02`: dropdown sort vẫn nằm trong pagination desktop cùng page-size picker
- `IT-PROD-LIFE-01`: màn `Sản phẩm` lưu được metadata hạn dùng/bảo quản bằng inline edit và render lại đúng nhãn

## Lưu ý

- App runtime thật vẫn chỉ cần `Python stdlib + SQLite`
- `Node.js` và `Playwright` chỉ cần cho bộ test integration
- Nếu sửa workflow, label, selector hoặc menu, hãy cập nhật test tương ứng
- Nếu thêm hoặc đổi workflow nghiệp vụ, hãy cập nhật luôn checklist acceptance để người test và agent dùng chung một chuẩn
- Nếu thêm test mới, hãy đặt mã case ở đầu tên test hoặc method name để có thể lọc theo mã
- Nếu thêm/sửa/xóa mã test, hãy cập nhật đồng thời `docs/TEST_CASE_INDEX.md` và `docs/TEST_CASE_DESCRIPTIONS.md`
- Việc bổ sung tài liệu test phải được ghi trực tiếp vào repo để dùng lại cho mọi máy và mọi session, không chỉ nhắc tạm trong một lần làm việc
- Nếu cần điều tra lỗi sync nhiều máy, có thể bật `debug.sync_state=true` trong `data/system_config.json` để xem log `/api/state` ở console server và browser
