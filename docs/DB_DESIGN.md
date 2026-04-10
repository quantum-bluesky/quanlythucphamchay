# Thiết Kế Database

Tài liệu này mô tả database runtime thực tế của ứng dụng theo code hiện tại trong `qltpchay/store.py`.

## 1. Mục tiêu thiết kế

- giữ runtime đơn giản, chạy bằng SQLite file local/server share
- tách rõ dữ liệu danh mục, giao dịch kho, state đồng bộ SPA và audit
- hỗ trợ tương thích ngược khi thêm cột mới mà không phá DB cũ

## 2. Công nghệ và file dữ liệu

- Engine: SQLite
- Runtime DB mặc định: `data/inventory.db`
- Bootstrap schema + migration: `qltpchay/store.py`, hàm `initialize_schema()`

## 3. Mô hình dữ liệu tổng quan

```text
products (danh mục sản phẩm)
  1 --- n transactions (giao dịch nhập/xuất kho)

app_state
  lưu JSON cho customers / suppliers / carts / purchases

audit_logs
  lưu audit cho product price, direct adjustment, trạng thái cart/purchase,
  và chứng từ adjustment / return
```

## 4. Bảng `products`

Nguồn: `CREATE TABLE IF NOT EXISTS products` trong `qltpchay/store.py`.

### Cột

- `id`: INTEGER PK AUTOINCREMENT
- `name`: TEXT, unique, không phân biệt hoa thường
- `category`: TEXT, loại thực phẩm
- `unit`: TEXT, đơn vị tính
- `price`: REAL, giá nhập mặc định
- `sale_price`: REAL, giá bán mặc định
- `low_stock_threshold`: REAL, ngưỡng cảnh báo sắp hết
- `is_deleted`: INTEGER, soft delete flag
- `deleted_at`: TEXT, thời điểm xóa mềm
- `created_at`: TEXT, timestamp ISO
- `updated_at`: TEXT, timestamp ISO

### Vai trò nghiệp vụ

- là nguồn sự thật cho danh mục sản phẩm
- không lưu tồn kho tĩnh; tồn hiện tại được tính từ `transactions`
- hỗ trợ ngừng bán bằng `is_deleted = 1` thay vì xóa cứng

## 5. Bảng `transactions`

Nguồn: `CREATE TABLE IF NOT EXISTS transactions` trong `qltpchay/store.py`.

### Cột

- `id`: INTEGER PK AUTOINCREMENT
- `product_id`: INTEGER FK tới `products.id`
- `transaction_type`: TEXT, chỉ nhận `in` hoặc `out`
- `quantity`: REAL, > 0
- `note`: TEXT
- `created_at`: TEXT, timestamp ISO

### Index

- `idx_transactions_product_id` trên `product_id`
- `idx_transactions_created_at` trên `created_at DESC`

### Vai trò nghiệp vụ

- là ledger kho
- mọi thay đổi tồn kho đều phải quy đổi thành dòng `in` hoặc `out`
- Phase B vẫn tái sử dụng bảng này cho:
  - phiếu điều chỉnh tồn
  - phiếu trả hàng khách
  - phiếu trả NCC

## 6. Bảng `app_state`

Nguồn: `CREATE TABLE IF NOT EXISTS app_state` trong `qltpchay/store.py`.

### Cột

- `state_key`: TEXT PK
- `state_value`: TEXT, JSON string
- `updated_at`: TEXT, version timestamp

### Các key đang dùng

- `customers`
- `suppliers`
- `carts`
- `purchases`

### Vai trò nghiệp vụ

- lưu các collection nghiệp vụ dạng JSON để SPA dùng chung nhiều máy
- dùng `updated_at` cho optimistic concurrency ở Phase C

## 7. Bảng `audit_logs`

Nguồn: `CREATE TABLE IF NOT EXISTS audit_logs` trong `qltpchay/store.py`.

### Cột

- `id`: INTEGER PK AUTOINCREMENT
- `entity_type`: TEXT
- `entity_id`: TEXT
- `entity_name`: TEXT
- `action`: TEXT
- `actor`: TEXT
- `message`: TEXT
- `created_at`: TEXT, timestamp ISO

### Index

- `idx_audit_logs_entity` trên `(entity_type, created_at DESC)`

### Vai trò nghiệp vụ

- audit thay đổi giá nhập/giá bán mặc định
- audit direct adjustment bởi Master Admin
- audit chuyển trạng thái cart và purchase
- audit tạo chứng từ điều chỉnh/trả hàng

## 8. Cách tính tồn kho

App không có cột `current_stock` trong bảng `products`.

Tồn kho hiện tại được suy ra:

- cộng toàn bộ `transactions.transaction_type = 'in'`
- trừ toàn bộ `transactions.transaction_type = 'out'`

Hệ quả thiết kế:

- tránh lệch tồn do cập nhật kép
- giúp truy vết theo lịch sử giao dịch
- buộc workflow điều chỉnh phải đi qua chứng từ hoặc transaction hợp lệ

## 9. Chiến lược migration

Schema được migrate inline trong `initialize_schema()` bằng:

- `CREATE TABLE IF NOT EXISTS`
- `PRAGMA table_info(...)`
- `ALTER TABLE ... ADD COLUMN ...`
- backfill mềm cho dữ liệu cũ

### Migration đã thấy trong code

- thêm `price` vào `products`
- thêm `sale_price` vào `products` rồi backfill từ `price`
- thêm `is_deleted`
- thêm `deleted_at`
- thêm `actor` vào `audit_logs`

## 10. Ràng buộc nghiệp vụ chính gắn với DB

- `products.price` là giá nhập mặc định
- `products.sale_price` là giá bán mặc định
- chỉ `Master Admin` mới được chỉnh tồn trực tiếp qua `POST /api/transactions`
- direct adjustment bắt buộc có `adjustment_reason`
- đơn đã `completed` và phiếu nhập đã `received/paid` không được sửa ngược trực tiếp
- `app_state.updated_at` được dùng để chặn ghi đè stale save

## 11. Điểm mạnh và giới hạn hiện tại

### Điểm mạnh

- schema nhỏ, dễ backup/restore
- tương thích ngược tốt cho cửa hàng nhỏ
- audit và workflow lock đã bám vào data model hiện tại

### Giới hạn

- `customers`, `suppliers`, `carts`, `purchases` vẫn là JSON trong `app_state`, chưa chuẩn hóa thành bảng quan hệ riêng
- chứng từ Phase B chưa có bảng header/detail riêng, đang encode vào `transactions.note` + `audit_logs`
- báo cáo tài chính chi tiết hơn trong tương lai sẽ khó hơn nếu tiếp tục chỉ dựa vào JSON + note text

## 12. Định hướng nếu mở rộng sau này

- giữ `transactions` làm ledger trung tâm
- cân nhắc tách bảng quan hệ cho `carts`, `purchases`, `customers`, `suppliers`
- cân nhắc tách bảng receipt riêng cho adjustment/return nếu cần lọc báo cáo và đối soát sâu hơn
