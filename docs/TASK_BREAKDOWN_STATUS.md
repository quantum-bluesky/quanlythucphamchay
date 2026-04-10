# Task Breakdown Và Status

Tài liệu này tổng hợp breakdown ở mức phase/nhóm việc theo trạng thái hiện tại của repo ngày 2026-04-10.

## 1. Tổng quan status

| Hạng mục | Mục tiêu | Trạng thái |
| --- | --- | --- |
| Phase A | Siết workflow tối thiểu | Done |
| Phase B | Chứng từ điều chỉnh | Done |
| Phase C | Chống ghi đè đồng thời | Done |
| Phase D | Audit chặt hơn | In progress |
| Tài liệu DB | Gom schema + migration hiện tại | Done |
| Tài liệu màn hình | Gom screen design từ frontend config | Done |
| Business Flow | Gom luồng nghiệp vụ vận hành | Done |

## 2. Breakdown theo phase

### Phase A

- khóa sửa trực tiếp đơn đã chốt
- khóa sửa trực tiếp phiếu nhập đã nhập kho / đã thanh toán
- chỉ cho thanh toán phiếu nhập sau khi đã nhập kho
- bắt buộc lý do khi admin chỉnh tồn trực tiếp

Status:

- Done
- bằng chứng:
  - `tests/integration/workflow-phase-a.spec.js`
  - rule ở `qltpchay/store.py`

### Phase B

- thêm API phiếu điều chỉnh tồn
- thêm API phiếu trả hàng khách
- thêm API phiếu trả NCC
- giữ tương thích bằng `transactions` + `audit_logs`

Status:

- Done
- bằng chứng:
  - `README.md`
  - `qltpchay/http_handler.py`
  - `tests/integration/acceptance-sales-phase-b.spec.js`

### Phase C

- thêm optimistic concurrency cho `carts`
- thêm optimistic concurrency cho `purchases`
- trả `409 conflict` với metadata rõ
- tự gắn actor vào luồng save sync state

Status:

- Done
- bằng chứng:
  - `tests/integration/workflow-phase-c.spec.js`
  - `qltpchay/store.py`
  - `qltpchay/http_handler.py`

### Phase D

- audit actor cho thay đổi workflow chứng từ
- audit thay đổi giá chung sản phẩm
- lọc lịch sử theo actor / khoảng thời gian
- cập nhật test + tài liệu

Status:

- In progress
- bằng chứng:
  - file issue design đã có: `docs/PHASE_D_ISSUES.md`
  - một phần implementation đã xuất hiện trong code và docs
  - cần tiếp tục chốt phạm vi issue/test nếu muốn xem như hoàn tất toàn phase

## 3. Breakdown theo nhóm kỹ thuật

### Backend data/workflow

- schema bootstrap và migration mềm
- API transaction/adjustment/return
- sync state save + conflict handling
- audit logging

Status:

- phần lõi đã có
- còn dư địa chuẩn hóa thêm receipt/state về bảng quan hệ nếu app lớn hơn

### Frontend screens

- screen help/meta
- floating search
- controller/ui tách theo domain
- mobile navigation runtime

Status:

- đang ổn định
- đã đủ basis để làm song song theo domain

### Test

- unit + integration + acceptance
- phase A/C có spec riêng
- phase B có acceptance spec
- phase D đã có issue doc và một phần test/doc update

Status:

- có coverage cho workflow chính
- vẫn nên mở rộng thêm regression suite cho audit/history filter nếu phase D tiếp tục mở rộng

## 4. Backlog đề xuất sau trạng thái hiện tại

- chuẩn hóa receipt tables nếu cần báo cáo điều chỉnh/trả hàng sâu hơn
- chuẩn hóa `customers/suppliers/carts/purchases` ra bảng quan hệ nếu cần scale
- chốt nốt Definition of Done cho toàn Phase D
