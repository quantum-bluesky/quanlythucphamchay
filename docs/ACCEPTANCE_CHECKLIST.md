# Acceptance Checklist

Tài liệu này là nguồn chuẩn để kiểm soát `acceptance test` của hệ thống.

Mục tiêu:

- giúp người vận hành biết cần kiểm tra gì trước khi dùng thật
- giúp Codex agent biết bộ case nào phải chạy tự động
- tách rõ case `Auto` và `Manual`

## 1. Quy tắc dùng checklist

- `P0`: case chặn release, phải pass
- `P1`: case quan trọng, nên pass trước khi bàn giao
- `P2`: case mở rộng, có thể chạy theo đợt
- `Auto`: đã có thể chạy bằng Playwright hoặc unit/integration test
- `Manual`: hiện chưa tự động hóa hoàn toàn, cần người dùng xác nhận

## 2. Bộ case chuẩn

| STT | ID           | Priority | Màn / luồng                    | Mục tiêu                                                                  | Type | Nguồn chạy / ghi nhận                                                                            |
| --- | ------------ | -------- | ------------------------------ | ------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------ |
| 1   | ACC-ABOUT-01 | P1       | About / Version                | Bấm `Version` mở đúng màn `About`, version khớp backend                   | Auto | `tests/integration/acceptance-checklist.spec.js`                                                 |
| 2   | ACC-INV-01   | P0       | Tồn kho -> Nhập hàng           | Bấm `Nhập` từ card tồn kho mở đúng màn `Nhập hàng`                        | Auto | `tests/integration/acceptance-checklist.spec.js`                                                 |
| 3   | ACC-INV-02   | P0       | Tồn kho -> Xuất hàng           | Bấm `Xuất` từ card tồn kho mở đúng màn `Tạo đơn xuất hàng`                | Auto | `tests/integration/core-workflows.spec.js`                                                       |
| 4   | ACC-SALE-01  | P0       | Tạo đơn xuất hàng              | Tạo giỏ, thêm hàng, chốt đơn và đối chiếu tồn kho / đơn hàng              | Auto | `tests/integration/acceptance-sales-phase-b.spec.js`                                             |
| 5   | ACC-SALE-02  | P0       | Tạo đơn xuất hàng              | Khi thiếu hàng, user thường không được bypass sang chỉnh tồn trực tiếp    | Auto | `tests/integration/acceptance-sales-phase-b.spec.js`                                             |
| 6   | ACC-ORD-01   | P1       | Đơn hàng                       | Mở đơn, xem chi tiết, không lỗi runtime sau reload                        | Auto | `tests/integration/management-screens.spec.js`                                                   |
| 7   | ACC-CUS-01   | P1       | Khách hàng                     | Mở sửa khách hàng, form nạp dữ liệu đúng, reload không lỗi                | Auto | `tests/integration/management-screens.spec.js`                                                   |
| 8   | ACC-PROD-01  | P1       | Sản phẩm                       | Mở sửa nhanh sản phẩm, màn không lỗi runtime                              | Auto | `tests/integration/core-workflows.spec.js`                                                       |
| 9   | ACC-PUR-01   | P0       | Nhập hàng                      | Phiếu chỉ được `paid` sau khi `received`                                  | Auto | `tests/integration/workflow-phase-a.spec.js`                                                     |
| 10  | ACC-PUR-02   | P0       | Nhập hàng                      | Phiếu `received/paid` không cho sửa trực tiếp                             | Auto | `tests/integration/workflow-phase-a.spec.js`                                                     |
| 11  | ACC-PHB-01   | P1       | Phase B / Phiếu điều chỉnh tồn | Tạo phiếu điều chỉnh tồn, cập nhật tồn kho và audit đúng receipt          | Auto | `tests/integration/acceptance-sales-phase-b.spec.js`                                             |
| 12  | ACC-PHB-02   | P1       | Phase B / Phiếu trả hàng khách | Tạo phiếu trả hàng khách, hàng quay lại tồn kho và có giao dịch tương ứng | Auto | `tests/integration/acceptance-sales-phase-b.spec.js`                                             |
| 13  | ACC-PHB-03   | P1       | Phase B / Phiếu trả NCC        | Tạo phiếu trả NCC, tồn kho giảm và có giao dịch tương ứng                 | Auto | `tests/integration/acceptance-sales-phase-b.spec.js`                                             |
| 14  | ACC-SUP-01   | P1       | Nhà cung cấp                   | Mở sửa nhà cung cấp, form nạp dữ liệu đúng, reload không lỗi              | Auto | `tests/integration/management-screens.spec.js`                                                   |
| 15  | ACC-REP-01   | P1       | Báo cáo                        | Làm mới báo cáo, đổi bộ lọc, màn không lỗi runtime                        | Auto | `tests/integration/acceptance-checklist.spec.js`, `tests/integration/management-screens.spec.js` |
| 16  | ACC-HIS-01   | P1       | Khôi phục                      | Màn khôi phục hiển thị đủ nhóm đã xóa và thao tác không lỗi               | Auto | `tests/integration/acceptance-checklist.spec.js`, `tests/integration/management-screens.spec.js` |
| 17  | ACC-ADM-01   | P0       | Master Admin                   | Đăng nhập admin thành công, mở module quản trị                            | Auto | `tests/integration/admin.spec.js`                                                                |
| 18  | ACC-ADM-02   | P0       | Master Admin                   | Export / import / backup / restore chạy trên fixture DB                   | Auto | `tests/integration/admin.spec.js`                                                                |
| 19  | ACC-ADM-03   | P0       | Tồn kho admin                  | Chỉnh tồn trực tiếp phải có đăng nhập admin và lý do                      | Auto | `tests/integration/workflow-phase-a.spec.js`                                                     |
| 20  | ACC-SYNC-01  | P0       | Nhiều máy / create-order       | Màn bán hàng tự refresh tồn kho và giá sau thay đổi từ máy khác           | Auto | `tests/integration/cross-client-sync.spec.js`                                                    |
| 21  | ACC-SYNC-02  | P0       | Nhiều máy / draft cart         | Lưu dữ liệu stale bị chặn với conflict metadata                           | Auto | `tests/integration/workflow-phase-c.spec.js`                                                     |
| 22  | ACC-SYNC-03  | P0       | Nhiều máy / draft purchase     | Lưu dữ liệu stale bị chặn với conflict metadata                           | Auto | `tests/integration/workflow-phase-c.spec.js`                                                     |

## 3. Bộ chạy tự động chuẩn cho Codex agent

Chạy tối thiểu:

```powershell
node --check static/app.js
python -m py_compile app.py
python -m unittest discover -s tests
```

Chạy acceptance automation:

```powershell
npm install
npx playwright install chromium
npm run test:acceptance
```

`npm run test:acceptance` là bộ chạy chuẩn cho agent. Bộ này gồm:

- case acceptance cốt lõi theo checklist
- các spec regression quan trọng đã có
- một số case bổ sung ngoài checklist để bắt lỗi runtime, reload, health màn hình

## 4. Mẫu ghi nhận cho case Manual

Ghi theo mẫu này khi kiểm thử thủ công:

```text
ID:
Ngày test:
Người test:
Dữ liệu test:
Các bước:
1.
2.
3.
Kết quả mong đợi:
1.
2.
Kết quả thực tế:
Pass/Fail:
Ghi chú / ảnh chụp / log:
```

## 5. Đề xuất ưu tiên tự động hóa tiếp

Checklist hiện đã phủ tự động các case P0 chính. Các phần nên mở rộng tiếp nếu tăng scope release:

- luồng `in / gửi khách` sau khi chốt đơn
- nhánh thiếu hàng của `Master Admin` khi chọn sang màn tồn kho để bypass bằng điều chỉnh trực tiếp
- các case validate âm cho Phase B:
  - phiếu điều chỉnh thiếu lý do
  - phiếu trả NCC vượt tồn
  - phiếu trả hàng / điều chỉnh nhiều dòng cùng lúc

## 6. Tiêu chuẩn pass cho một đợt bàn giao

- tất cả `P0 Auto` phải pass
- các `P1 Auto` nên pass hoặc có giải trình rõ
- các `Manual` còn lại nếu có phải được ghi nhận kết quả
- help trong app, README và hướng dẫn sử dụng phải khớp workflow đang test
