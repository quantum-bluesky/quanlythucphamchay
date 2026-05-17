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

workflow_locks
procurement_assignments
  giữ khóa kỳ gom nhập và rule một sản phẩm thiếu chỉ được gán vào một phiếu nhập batch mở
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
- `shelf_life_days`: REAL nullable, hạn dùng chuẩn theo số ngày
- `storage_life_days`: REAL nullable, thời gian bảo quản ước tính theo số ngày
- `is_deleted`: INTEGER, soft delete flag
- `deleted_at`: TEXT, thời điểm xóa mềm
- `created_at`: TEXT, timestamp ISO
- `updated_at`: TEXT, timestamp ISO

### Vai trò nghiệp vụ

- là nguồn sự thật cho danh mục sản phẩm
- không lưu tồn kho tĩnh; tồn hiện tại được tính từ `transactions`
- hỗ trợ ngừng bán bằng `is_deleted = 1` thay vì xóa cứng
- `shelf_life_days` và `storage_life_days` là metadata fallback ở cấp sản phẩm khi lô chưa có HSD thật, không thay thế dữ liệu tồn theo lô

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
- mọi chi tiết lô và phân bổ FEFO bám theo transaction nhưng được lưu riêng ở bảng lô để không làm phình ledger chính
- Phase B vẫn tái sử dụng bảng này cho:
  - phiếu điều chỉnh tồn
  - phiếu trả hàng khách
  - phiếu trả NCC

## 5A. Bảng tồn theo lô

### `inventory_batches`

- lưu từng lô tồn của một sản phẩm
- cột chính:
  - `product_id`
  - `batch_code`
  - `expiry_date`
  - `received_at`
  - `source_receipt_code`, `source_receipt_type`, `source_transaction_id`
  - `unit_cost`
  - `initial_quantity`, `remaining_quantity`
  - `note`, `created_at`, `updated_at`

### `inventory_batch_allocations`

- lưu việc một transaction đã cộng/trừ vào lô nào
- cột chính:
  - `batch_id`
  - `transaction_id`
  - `product_id`
  - `quantity`
  - `direction`
  - `created_at`

### Vai trò nghiệp vụ

- `inventory_batches` là nguồn sự thật cho tồn theo lô
- lô có `expiry_date` sẽ được ưu tiên trong FEFO trước lô chưa có HSD
- nếu người dùng không nhập `batch_code`, hệ thống có thể tự sinh mã lô khi ghi nhận nhập kho
- `inventory_batch_allocations` giúp truy vết ngược từ một giao dịch sang đúng các lô đã bị cộng/trừ

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

- header đơn hàng nháp / đã chốt / đã xuất
- cột chính:
  - `id`, `customer_id`, `customer_name`
  - `status`, `payment_status`, `discount_amount`
  - `ship_address`
  - `created_at`, `updated_at`, `committed_at`, `completed_at`, `cancelled_at`, `paid_at`
  - `order_code`

### Vai trò nghiệp vụ bổ sung

- `discount_amount` là giảm giá khuyến mại ở cấp toàn đơn
- không đổi số lượng tồn kho hay line item, chỉ ảnh hưởng số tiền cần thu và báo cáo doanh thu net
- `ship_address` là snapshot địa chỉ giao ở cấp đơn; không phụ thuộc động vào hồ sơ khách hàng
- `committed_at` là mốc đơn được chốt để giữ hàng logic trước khi xuất thật
- `status` hiện dùng theo workflow:
  - `draft`: đơn nháp
  - `committed`: đã chốt, khóa khách hàng nhưng chưa trừ kho
  - `completed`: đã xuất hàng, đã trừ kho
  - `cancelled`: đơn đã hủy

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
  - `note`, `source_type`, `source_code`, `source_name`, `status`, `discount_amount`
  - `created_at`, `updated_at`, `received_at`, `paid_at`
  - `receipt_code`

### Vai trò nghiệp vụ bổ sung

- `discount_amount` là giảm giá khuyến mại ở cấp toàn phiếu nhập
- không đổi tồn kho đã nhận hay từng dòng nhập, chỉ ảnh hưởng số tiền thực trả NCC và báo cáo chi nhập net
- khi load sync state, backend phải suy ra thêm cờ repair cho phiếu nhập legacy lỗi dữ liệu, tối thiểu gồm:
  - phiếu `paid` nhưng không tìm được receipt nhập kho hợp lệ
  - phiếu `draft/ordered` còn marker `received_at` / `paid_at` / `receipt_code` không khớp workflow mở
  - phiếu `ordered` nhưng thiếu `supplier_name` hoặc không còn item hợp lệ
- cờ repair này chỉ dùng để mở đường sửa/xóa/hủy dữ liệu cũ đang lệch, không đổi workflow chuẩn của phiếu nhập mới
- ngoài cờ repair, backend còn có `legacy audit` để quét:
  - `carts.completed + payment_status=paid` nhưng thiếu `paid_at`
  - `purchases.received/paid` nhưng thiếu `received_at` hoặc `paid_at` ở raw DB
  - `purchases.source_type='cart'` nhưng thiếu `source_code`
- `legacy audit` phải tách rõ:
  - `safe fixes`: chỉ backfill timestamp chắc chắn
  - `manual review`: cần admin đối chiếu rồi gắn `receipt_code` hoặc `cart_id`

### `purchase_items`

- detail của `purchases`
- cột chính:
  - `id`, `purchase_id`
  - `product_id`, `product_name`
  - `source_kind`: `shortage` hoặc `extra`
  - `source_note`: ghi chú nhẹ cho dòng `extra`, mặc định có thể là `Ngoài nhu cầu đơn`
  - `quantity`, `unit_cost`
  - `batch_code`
  - `expiry_input_mode`: `direct`, `manufacture`, hoặc `received_fallback`
  - `manufacture_date`
  - `expiry_date`: HSD hiệu lực đã resolve để dùng cho FEFO/lô
  - `sort_order`

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
  - `actor`, `reason`, `note`, `discount_amount`
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
  - `transaction_id`, `purchase_item_id`
  - `batch_id`, `batch_code`, `expiry_date`

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
- audit create/update/delete/restore sản phẩm với actor thực hiện; riêng update sản phẩm ghi rõ field cũ/mới thay vì chỉ ghi tên
- audit direct adjustment bởi Master Admin
- audit chuyển trạng thái cart và purchase
- audit tạo chứng từ điều chỉnh/trả hàng và giữ đúng actor khi tạo/import từ các luồng quản trị

## 10. Bảng workflow lock và procurement assignment

### `workflow_locks`

- dùng để khóa các flow không được xử lý song song
- cột chính:
  - `lock_key`: khóa nghiệp vụ, hiện dùng `procurement_batch`
  - `owner_username`
  - `owner_role`
  - `metadata`: JSON mở rộng
  - `created_at`, `updated_at`, `expires_at`, `released_at`

### `procurement_assignments`

- gán một sản phẩm đang thiếu vào một phiếu nhập batch mở
- cột chính:
  - `product_id`
  - `purchase_id`
  - `mode`: hiện dùng `batch`
  - `source_scope_type`, `source_scope_code`
  - `created_by`
  - `created_at`, `released_at`

### Ràng buộc

- unique partial index trên `(product_id, mode)` khi `released_at IS NULL`, nên một sản phẩm thiếu chỉ có một assignment active trong batch mode
- khi tạo purchase từ planner, backend gom các dòng cùng NCC vào cùng purchase `draft`, tạo assignment trong cùng transaction và reuse purchase batch `draft` đang mở của NCC đó nếu có
- assignment active sẽ được release khi phiếu batch chuyển `received`, bị `cancelled`, bị xóa, hoặc dòng sản phẩm bị gỡ khỏi phiếu batch
- assignment chỉ đại diện cho logistics gom nhập; tồn kho thật vẫn chỉ tăng khi purchase đi qua bước `Nhập kho`

## 11. Cách tính tồn kho

App không có cột `current_stock` trong bảng `products`.

Tồn kho hiện tại được suy ra:

- cộng toàn bộ `transactions.transaction_type = 'in'`
- trừ toàn bộ `transactions.transaction_type = 'out'`

Hệ quả thiết kế:

- tránh lệch tồn do cập nhật kép
- giúp truy vết theo lịch sử giao dịch
- buộc workflow điều chỉnh phải đi qua chứng từ hoặc transaction hợp lệ
- tồn theo lô được suy ra song song qua `inventory_batches.remaining_quantity`; nếu lệch thì phải sửa bằng chứng từ mới thay vì sửa tay số dư lô

## 12. Chiến lược migration

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
- thêm `shelf_life_days` và `storage_life_days` vào `products`
- thêm `actor` vào `audit_logs`
- thêm bảng quan hệ cho `customers/suppliers/carts/purchases`
- thêm `discount_amount` vào `carts`, `purchases`, `inventory_receipts`
- backfill tự động từ `app_state`
- thêm bảng `inventory_receipts` và `inventory_receipt_items`
- backfill receipt lịch sử từ `transactions.note` khi nhận diện được mã `PN/DC/THK/TNCC`
- thêm `batch_code`, `expiry_date` vào `purchase_items`
- thêm `source_kind`, `source_note` vào `purchase_items` để phân biệt dòng shortage với dòng extra của planner batch
- thêm `batch_id`, `batch_code`, `expiry_date` vào `inventory_receipt_items`
- thêm bảng `inventory_batches` và `inventory_batch_allocations`
- backfill mềm lô từ transaction/receipt cũ khi schema mới được khởi tạo trên DB đang dùng
- thêm bảng `workflow_locks` và `procurement_assignments` cho Batch procurement mode

## 13. Ràng buộc nghiệp vụ chính gắn với DB

- `products.price` là giá nhập mặc định
- `products.sale_price` là giá bán mặc định
- chỉ `Master Admin` mới được chỉnh tồn trực tiếp qua `POST /api/transactions`
- direct adjustment bắt buộc có `adjustment_reason`
- đơn đã `completed` và phiếu nhập đã `received/paid` không được sửa ngược trực tiếp
- phiếu nhập sinh ra từ đơn thiếu hàng lưu liên kết nguồn riêng ở `source_type/source_code/source_name`; `note` vẫn dành cho ghi chú user nhập tay
- `discount_amount` của `carts/purchases` phải nhỏ hơn hoặc bằng tạm tính của chính phiếu
- đơn `completed` chưa thanh toán vẫn được sửa `discount_amount`; sau khi `payment_status = paid` thì khóa hẳn
- phiếu nhập `received` chưa thanh toán vẫn được sửa `discount_amount` và metadata HSD/NSX của từng dòng; sau khi `status = paid` thì khóa hẳn
- nếu dòng nhập không có HSD trực tiếp thì backend có thể resolve `expiry_date` tự động từ `received_at + storage_life_days`; nếu user chọn mode `manufacture` thì resolve từ `manufacture_date + storage_life_days`
- `app_state.updated_at` được dùng để chặn ghi đè stale save
- sort ưu tiên tồn kho dùng metric suy diễn từ ledger bán hàng thật, không persist score vào DB
- sort hạn còn lại ưu tiên theo HSD thật sớm nhất trong các lô còn hàng; chỉ khi chưa có HSD lô mới fallback về metadata sản phẩm và lần nhập gần nhất
- Batch procurement mode được suy ra từ `workflow_locks.lock_key = procurement_batch` còn hiệu lực
- `procurement_assignments` chặn tạo trùng nhiều phiếu nhập mở cho cùng một sản phẩm thiếu trong batch mode
- phiếu nhập batch có `source_type = procurement_batch`; nhiều assignment có thể cùng trỏ tới một purchase nếu cùng NCC
- các dòng `purchase_items.source_kind = 'extra'` là dòng được thêm tay ngoài nhu cầu đơn, không tạo `procurement_assignment`
- nếu `source_kind = 'extra'` trùng sản phẩm đã có assignment batch active hoặc đã nằm trong purchase batch draft, backend chỉ cho merge vào đúng phiếu/NCC tương ứng thay vì tách phiếu batch mới
- khi Batch procurement mode còn hiệu lực, chỉ lock owner hoặc `Master Admin` mới được mutate cấu trúc `purchases` ở trạng thái `draft/ordered`; user khác chỉ được phép đổi `ordered -> received` nếu phiếu không phải batch và timestamp `ordered` của phiếu cũ nhỏ hơn `workflow_locks.acquired_at` của lock đang active, sau đó mới đi tiếp `received -> paid`

## 14. Config liên quan

`system_config.json` có nhóm `procurement`:

- `batch_planner_enabled`: bật màn xử lý nhập thiếu batch
- `batch_lock_timeout_minutes`: thời gian khóa batch trước khi hết hạn
- `allow_daily_quick_shortage_flow`: giữ flow nhanh theo đơn khi không ở batch mode
- `required_login_for_batch_mode`: bắt buộc login để xác định người giữ khóa
- `planner_manager_usernames`: danh sách user thường được phép xử lý batch ngoài permission trực tiếp

User thường có thể có permission `procurement_batch_manage`; quyền này chỉ cho xử lý kỳ gom nhập, không cho chỉnh tồn trực tiếp.

## 15. Điểm mạnh và giới hạn hiện tại

### Điểm mạnh

- schema nhỏ, dễ backup/restore
- tương thích ngược tốt cho cửa hàng nhỏ
- audit và workflow lock đã bám vào data model hiện tại
- state chính đã có bảng quan hệ nên dễ query/report hơn trước
- receipt đã có header/detail riêng để mở rộng báo cáo điều chỉnh/trả hàng
- tồn theo lô và phân bổ FEFO đã có bảng riêng nên có thể truy vết ngược từng chứng từ kho
- workflow lock giúp giới hạn batch gom nhập cho một người xử lý, phù hợp cửa hàng ít user

### Giới hạn

- app vẫn giữ `app_state` làm legacy cache để tương thích ngược
- mọi thao tác `legacy audit` có mutate DB phải refresh lại `app_state` canonical của collection liên quan sau khi ghi bảng chuẩn
- `supplier_id` và `customer_id` trong một số receipt cũ có thể chưa backfill đầy đủ nếu dữ liệu lịch sử chỉ có tên
- reporting sâu cho receipt lịch sử cũ phụ thuộc chất lượng `transactions.note`
- lô chưa có HSD vẫn quản lý được nhưng không thể tham gia FEFO theo ngày hết hạn thật
- planner batch hiện ưu tiên theo shortage rows và chỉ cho thêm extra rows khi đang có lock batch; việc chuyển assignment giữa NCC/phiếu khác vẫn chưa mở tự do

## 16. Định hướng nếu mở rộng sau này

- giữ `transactions` làm ledger trung tâm
- cân nhắc tách bảng quan hệ cho `carts`, `purchases`, `customers`, `suppliers`
- cân nhắc tách bảng receipt riêng cho adjustment/return nếu cần lọc báo cáo và đối soát sâu hơn
