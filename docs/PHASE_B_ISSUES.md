# Phase B - Thiết Kế Theo Issue

Nguồn tổng hợp:

- `docs/WORKFLOW_REVIEW.md`
- `README.md`
- `tests/integration/acceptance-sales-phase-b.spec.js`
- `qltpchay/store.py`
- `qltpchay/http_handler.py`

## Mục tiêu phase

Bổ sung chứng từ điều chỉnh để sửa sai bằng chứng từ mới thay vì sửa ngược chứng từ cũ.

## B-1: Phiếu điều chỉnh tồn

### Bài toán

Kiểm kho lệch hoặc sai lệch nội bộ cần tăng/giảm tồn nhanh nhưng vẫn phải có lý do và audit.

### Thiết kế

- API: `POST /api/adjustments/inventory`
- quyền: chỉ `Master Admin`
- input:
  - `reason`
  - `note`
  - `items[].product_id`
  - `items[].quantity_delta`
- output:
  - `receipt_code` dạng `DC-*`
  - actor, created_at, tổng tăng/giảm
- persist:
  - ghi thành nhiều dòng `transactions`
  - ghi `audit_logs`

### Quy ước dữ liệu

- `quantity_delta > 0` tạo transaction `in`
- `quantity_delta < 0` tạo transaction `out`
- note transaction phải chứa mã phiếu, lý do và người chỉnh

### Trạng thái hiện tại

- Đã triển khai
- Có acceptance: `ACC-PHB-01`

## B-2: Phiếu trả hàng khách

### Bài toán

Khi khách trả hàng, tồn kho phải tăng lại nhưng không được sửa ngược đơn xuất đã chốt.

### Thiết kế

- API: `POST /api/returns/customers`
- input:
  - `customer_name`
  - `note`
  - `items[].product_id`
  - `items[].quantity`
  - `items[].unit_refund`
- output:
  - `receipt_code` dạng `THK-*`
- persist:
  - ghi transaction `in`
  - ghi audit tạo chứng từ

### Trạng thái hiện tại

- Đã triển khai
- Có acceptance: `ACC-PHB-02`

## B-3: Phiếu trả nhà cung cấp

### Bài toán

Hàng lỗi hoặc không đạt chất lượng cần trả NCC, tồn kho phải giảm bằng chứng từ mới.

### Thiết kế

- API: `POST /api/returns/suppliers`
- input:
  - `supplier_name`
  - `note`
  - `items[].product_id`
  - `items[].quantity`
  - `items[].unit_cost`
- output:
  - `receipt_code` dạng `TNCC-*`
- persist:
  - ghi transaction `out`
  - ghi audit tạo chứng từ

### Trạng thái hiện tại

- Đã triển khai
- Có acceptance: `ACC-PHB-03`

## B-4: Giữ tương thích bằng cách tái sử dụng ledger hiện có

### Quyết định thiết kế

- không thêm bảng receipt riêng ở Phase B
- tiếp tục dùng:
  - `transactions` cho biến động kho
  - `audit_logs` cho chứng từ và actor
  - `note` để encode metadata chứng từ

### Lý do

- patch nhỏ, ít rủi ro migration
- giữ app tiếp tục chạy với data cũ
- phù hợp quy mô cửa hàng nhỏ

### Đánh đổi

- lọc báo cáo receipt-level sẽ khó hơn
- muốn mở rộng accounting sau này có thể phải tách bảng chuẩn hóa

## Kết quả phase B

- app đã có luồng điều chỉnh chính thức
- hạn chế sửa ngược lịch sử
- tăng khả năng truy vết sai lệch kho
