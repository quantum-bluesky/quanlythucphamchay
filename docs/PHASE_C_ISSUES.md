# Phase C - Thiết Kế Theo Issue

Nguồn tổng hợp:

- `docs/WORKFLOW_REVIEW.md`
- `tests/integration/workflow-phase-c.spec.js`
- `qltpchay/store.py`
- `qltpchay/http_handler.py`

## Mục tiêu phase

Chống ghi đè stale data khi nhiều máy cùng sửa một collection đồng bộ.

## C-1: Optimistic concurrency cho `carts`

### Bài toán

Hai máy cùng mở và lưu một giỏ nháp có thể gây mất dữ liệu nếu lưu sau ghi đè lưu trước.

### Thiết kế

- client đọc `GET /api/state` để lấy `updated_at.carts`
- khi lưu `PUT /api/state`, client gửi:
  - `carts`
  - `expected_updated_at.carts`
- backend so sánh `expected_updated_at.carts` với `app_state.updated_at`
- nếu lệch, trả `409 conflict`

### Response conflict

- `error`
- `conflict.state_key`
- `conflict.expected_updated_at`
- `conflict.actual_updated_at`

### Trạng thái hiện tại

- Đã triển khai
- Có spec: `workflow-phase-c.spec.js`

## C-2: Optimistic concurrency cho `purchases`

### Bài toán

Phiếu nhập nháp cũng có nguy cơ bị ghi đè bởi nhiều máy cùng sửa.

### Thiết kế

- giống `carts`, nhưng áp dụng cho key `purchases`
- dùng chung cơ chế `expected_updated_at`

### Trạng thái hiện tại

- Đã triển khai
- Có spec: `workflow-phase-c.spec.js`

## C-3: Tự gắn actor vào luồng lưu state

### Bài toán

Khi có conflict hoặc đổi trạng thái thì cần biết ai là người vừa lưu.

### Thiết kế

- `PUT /api/state` tự gắn:
  - admin username nếu đang đăng nhập admin
  - nếu không thì fallback `Nhân viên`
- actor này được dùng để audit cart/purchase status changes

### Trạng thái hiện tại

- Đã triển khai
- Dùng làm nền cho Phase D audit

## C-4: Hành vi UI mong muốn

### Thiết kế UI

- khi nhận `409`, UI phải báo rõ dữ liệu đã bị cập nhật từ máy khác
- app tải lại dữ liệu mới nhất để tránh người dùng ghi đè mù
- auto refresh chỉ chạy khi người dùng không đang gõ

### Trạng thái hiện tại

- Đã triển khai theo mô tả README/HDSD
- Spec hiện tại tập trung vào backend contract; còn UX chi tiết chủ yếu được kiểm qua integration suite chung

## Kết quả phase C

- giảm rủi ro “lần lưu sau thắng”
- giữ mô hình đồng bộ JSON hiện tại nhưng có lớp bảo vệ thực dụng
- tạo nền cho audit theo actor ở Phase D
