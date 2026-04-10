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

customers
suppliers
  1 --- n carts / purchases (tham chiếu mềm theo id hoặc tên tại thời điểm lưu)

carts
  1 --- n cart_items

purchases
  1 --- n purchase_items

inventory_receipts
  1 --- n inventory_receipt_items
  gói receipt chuẩn hóa cho:
  - purchase receipt
  - inventory adjustment
  - customer return
  - supplier return

app_state
  giữ version + legacy cache cho customers / suppliers / carts / purchases

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

- sau chuẩn hóa DB, bảng này giữ:
  - `updated_at` làm version cho optimistic concurrency
  - `state_value` làm legacy cache tương thích ngược
- nguồn sự thật chính cho `customers/suppliers/carts/purchases` đã chuyển sang bảng quan hệ riêng

## 7. Các bảng quan hệ cho sync collections

### `customers`

- `id`, `name`, `phone`, `address`, `zalo_url`
- `created_at`, `updated_at`, `deleted_at`

### `suppliers`

- `id`, `name`, `phone`, `address`, `note`
- `created_at`, `updated_at`, `deleted_at`

### `carts`

- header đơn hàng nháp/đã chốt
- cột chính:
  - `id`, `customer_id`, `customer_name`
  - `status`, `payment_status`
  - `created_at`, `updated_at`, `completed_at`, `cancelled_at`, `paid_at`
  - `order_code`

### `cart_items`

- detail của `carts`
- cột chính:
  - `id`, `cart_id`
  - `product_id`, `product_name`
  - `quantity`, `unit_price`, `note`, `sort_order`

### `purchases`

- header phiếu nhập
- cột chính:
  - `id`, `supplier_id`, `supplier_name`
  - `note`, `status`
  - `created_at`, `updated_at`, `received_at`, `paid_at`
  - `receipt_code`

### `purchase_items`

- detail của `purchases`
- cột chính:
  - `id`, `purchase_id`
  - `product_id`, `product_name`
  - `quantity`, `unit_cost`, `sort_order`

## 8. Bảng receipt chuẩn hóa

### `inventory_receipts`

- header receipt chuẩn hóa cho nhiều loại chứng từ
- `receipt_type` hiện hỗ trợ:
  - `purchase`
  - `inventory_adjustment`
  - `customer_return`
  - `supplier_return`
- cột chính:
  - `receipt_code`
  - `customer_id`, `customer_name`
  - `supplier_id`, `supplier_name`
  - `actor`, `reason`, `note`
  - `created_at`

### `inventory_receipt_items`

- detail line của receipt
- cột chính:
  - `receipt_id`
  - `product_id`, `product_name`, `unit`
  - `transaction_type`
  - `quantity`
  - `unit_amount`, `line_total`
  - `stock_after`
  - `transaction_id`

## 9. Bảng `audit_logs`

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

## 10. Cách tính tồn kho

App không có cột `current_stock` trong bảng `products`.

Tồn kho hiện tại được suy ra:

- cộng toàn bộ `transactions.transaction_type = 'in'`
- trừ toàn bộ `transactions.transaction_type = 'out'`

Hệ quả thiết kế:

- tránh lệch tồn do cập nhật kép
- giúp truy vết theo lịch sử giao dịch
- buộc workflow điều chỉnh phải đi qua chứng từ hoặc transaction hợp lệ

## 11. Chiến lược migration

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
- thêm bảng quan hệ cho `customers/suppliers/carts/purchases`
- backfill tự động từ `app_state`
- thêm bảng `inventory_receipts` và `inventory_receipt_items`
- backfill receipt lịch sử từ `transactions.note` khi nhận diện được mã `PN/DC/THK/TNCC`

## 12. Ràng buộc nghiệp vụ chính gắn với DB

- `products.price` là giá nhập mặc định
- `products.sale_price` là giá bán mặc định
- chỉ `Master Admin` mới được chỉnh tồn trực tiếp qua `POST /api/transactions`
- direct adjustment bắt buộc có `adjustment_reason`
- đơn đã `completed` và phiếu nhập đã `received/paid` không được sửa ngược trực tiếp
- `app_state.updated_at` được dùng để chặn ghi đè stale save

## 13. Điểm mạnh và giới hạn hiện tại

### Điểm mạnh

- schema nhỏ, dễ backup/restore
- tương thích ngược tốt cho cửa hàng nhỏ
- audit và workflow lock đã bám vào data model hiện tại
- state chính đã có bảng quan hệ nên dễ query/report hơn trước
- receipt đã có header/detail riêng để mở rộng báo cáo điều chỉnh/trả hàng

### Giới hạn

- app vẫn giữ `app_state` làm legacy cache để tương thích ngược
- `supplier_id` và `customer_id` trong một số receipt cũ có thể chưa backfill đầy đủ nếu dữ liệu lịch sử chỉ có tên
- reporting sâu cho receipt lịch sử cũ phụ thuộc chất lượng `transactions.note`

## 14. Định hướng nếu mở rộng sau này

- giữ `transactions` làm ledger trung tâm
- cân nhắc tách bảng quan hệ cho `carts`, `purchases`, `customers`, `suppliers`
- cân nhắc tách bảng receipt riêng cho adjustment/return nếu cần lọc báo cáo và đối soát sâu hơn
