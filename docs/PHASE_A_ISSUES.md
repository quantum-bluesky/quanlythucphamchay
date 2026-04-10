# Phase A - Thiết Kế Theo Issue

Nguồn tổng hợp:

- `docs/WORKFLOW_REVIEW.md`
- `tests/integration/workflow-phase-a.spec.js`
- `qltpchay/store.py`
- `qltpchay/http_handler.py`

## Mục tiêu phase

Siết rule workflow tối thiểu để ngăn sửa sai trực tiếp trên chứng từ đã xử lý và buộc admin có lý do khi bypass chỉnh tồn.

## A-1: Chỉ cho phép phiếu nhập thanh toán sau khi đã nhập kho

### Bài toán

Phiếu nhập nếu được đánh dấu `paid` trước khi `received` sẽ làm sai quy trình nhận hàng và đối soát công nợ.

### Thiết kế

- giữ luồng trạng thái:
  - `draft -> ordered -> received -> paid`
  - `draft -> cancelled`
  - `ordered -> cancelled`
- backend chặn payload `purchase.status = paid` nếu chưa có bước `received`
- UI disable nút `Đã thanh toán` cho phiếu chưa nhập kho

### Điểm chạm

- `qltpchay/store.py`
- `static/modules/ui/purchases-ui.js`
- `tests/integration/workflow-phase-a.spec.js`

### Tiêu chí hoàn thành

- API `PUT /api/state` trả `400` nếu cố lưu `paid` trước `received`
- UI không cho thao tác sớm

### Trạng thái hiện tại

- Đã triển khai
- Có spec: `tests/integration/workflow-phase-a.spec.js`

## A-2: Khóa sửa trực tiếp đơn đã chốt và phiếu nhập đã nhập kho / đã thanh toán

### Bài toán

Chứng từ đã hoàn tất mà vẫn sửa trực tiếp sẽ phá lịch sử và làm tồn kho/audit khó tin cậy.

### Thiết kế

- cart:
  - `completed` chỉ cho xem/in/đánh dấu thanh toán
  - không cho sửa `items`, số lượng, giá, hay rollback trạng thái
- purchase:
  - `received`, `paid`, `cancelled` chuyển sang chế độ khóa logic
  - chỉ `draft` và `ordered` được sửa dòng hàng
- backend snapshot dữ liệu cần khóa rồi so sánh khi nhận payload mới

### Điểm chạm

- `qltpchay/store.py`
- `static/modules/ui/sales-ui.js`
- `static/modules/ui/purchases-ui.js`
- `tests/integration/workflow-phase-a.spec.js`

### Tiêu chí hoàn thành

- sửa trực tiếp đơn đã `completed` bị chặn ở backend
- sửa trực tiếp phiếu nhập `paid` bị chặn ở backend
- UI chuyển chứng từ sang view-only đúng lúc

### Trạng thái hiện tại

- Đã triển khai
- Có spec: `tests/integration/workflow-phase-a.spec.js`

## A-3: Direct stock adjustment bắt buộc là luồng admin có lý do

### Bài toán

Chỉnh tồn trực tiếp là đường bypass nguy hiểm, nếu không giới hạn sẽ làm sai ledger và mất audit.

### Thiết kế

- endpoint `POST /api/transactions` yêu cầu admin session
- nếu request là direct adjustment bởi admin thì bắt buộc `adjustment_reason`
- note transaction ghi rõ:
  - người chỉnh
  - lý do
- đồng thời ghi `audit_logs`

### Điểm chạm

- `qltpchay/http_handler.py`
- `qltpchay/store.py`
- màn `inventory`
- `tests/integration/workflow-phase-a.spec.js`

### Tiêu chí hoàn thành

- anonymous call bị `401`
- admin call thiếu lý do bị chặn
- transaction note và audit có đủ actor + reason

### Trạng thái hiện tại

- Đã triển khai
- Có spec: `tests/integration/workflow-phase-a.spec.js`

## Kết quả phase A

- workflow tối thiểu đã được siết ở backend
- UI/help đã phản ánh việc khóa chứng từ và giới hạn direct adjust
- phase này là nền cho Phase B và C
