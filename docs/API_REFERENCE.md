# Tài liệu tham chiếu API

Tài liệu này gom các API hiện có trong backend để tra cứu nhanh khi làm việc với app, frontend hoặc integration test. Nguồn thực tế được đối chiếu từ `qltpchay/http_handler.py`, `static/app.js`, `static/public_products.js` và các tài liệu nghiệp vụ liên quan.

## Quy ước chung

- Base path: app có thể chạy ở subpath, nên mọi endpoint đều nên hiểu theo đường dẫn hiện hành, ví dụ `/qltp/api/...`.
- Kiểu trả về: đa số endpoint trả JSON; một số endpoint admin trả file tải xuống.
- Xác thực:
  - Khi `EnableLogin=false`, phần lớn API cho app chính không yêu cầu session.
  - Khi `EnableLogin=true`, các route dưới `/api/*` cần session hợp lệ, trừ các route public và route đăng nhập.
  - Các route dưới `/api/admin/*` luôn yêu cầu quyền admin hoặc Master Admin tương ứng.

## Public

| Method | Endpoint | Mục đích | Query / Body | Ghi chú |
|---|---|---|---|---|
| `GET` | `/api/public/products` | Lấy danh sách sản phẩm public | - | Chỉ lấy `is_public=1` và chưa xóa. |
| `GET` | `/api/public/orders` | Tra cứu đơn hàng public | Query: `phone` hoặc `zalo_id` | Phải có ít nhất một giá trị. |
| `POST` | `/api/public/orders` | Tạo đơn hàng public | Body: `customer_name`, `customer_phone`, `customer_address`, `zalo_id`, `avatar_url`, `note`, `items`, `force_new_order` | Từ chối nếu config yêu cầu Zalo login mà thiếu `zalo_id`. |
| `GET` | `/api/public/zalo-login` | Khởi tạo luồng đăng nhập Zalo | - | Redirect đến Zalo OAuth hoặc mock callback khi test. |
| `GET` | `/api/public/zalo-callback` | Nhận callback từ Zalo OAuth | Query: `code` | - |

## Session

| Method | Endpoint | Mục đích | Query / Body | Ghi chú |
|---|---|---|---|---|
| `GET` | `/api/session/status` | Lấy trạng thái session hiện tại | - | Trả info phiên, quyền, app info, config liên quan. |
| `POST` | `/api/session/login` | Đăng nhập user thường | Body: `username` + `password`, hoặc `account_type`/`accountType` + `password` | - |
| `POST` | `/api/session/logout` | Đăng xuất session hiện tại | - | - |
| `POST` | `/api/admin/login` | Đăng nhập Master Admin | Body: `username`, `password` | - |
| `POST` | `/api/admin/logout` | Đăng xuất Master Admin | - | - |

## State / Runtime / Dashboard

| Method | Endpoint | Mục đích | Query / Body | Ghi chú |
|---|---|---|---|---|
| `GET` | `/api/state` | Lấy snapshot đồng bộ cho toàn app | Query: `transaction_limit` | Mặc định `16`. |
| `PUT` | `/api/state` | Lưu sync state | Body: payload đồng bộ từ client | Trả `409` khi có xung đột `updated_at`. |
| `GET` | `/api/runtime-version` | Lấy version runtime/app/pagination/debug | - | Dùng để client kiểm tra cập nhật. |
| `GET` | `/api/reports/monthly` | Báo cáo tháng | Query: `months`, `start_date`, `end_date`, `focus_month` | - |
| `GET` | `/api/procurement/status` | Lấy trạng thái kỳ gom nhập hiện tại | - | - |
| `GET` | `/api/procurement/planner` | Lấy dữ liệu planner cho Xử lý nhập thiếu | Query: `scope`, `scope_code` hoặc alias `cart_id` / `product_id` | `scope` mặc định `all`. |

## Sản phẩm

| Method | Endpoint | Mục đích | Query / Body | Ghi chú |
|---|---|---|---|---|
| `GET` | `/api/products` | Lấy danh sách sản phẩm và summary | - | - |
| `POST` | `/api/products` | Tạo sản phẩm mới | Body: `name`, `category`, `unit`, `price`, `sale_price`, `low_stock_threshold`, `shelf_life_days`, `storage_life_days`, `images`, `details`, `recipe`, `note`, `unit_conversions`, `default_purchase_unit`, `default_sale_unit` | - |
| `PUT` | `/api/products/{id}` | Cập nhật sản phẩm | Body: như trên | - |
| `DELETE` | `/api/products/{id}` | Chuyển sản phẩm sang danh mục đã xóa | - | - |
| `DELETE` | `/api/admin/products/{id}/hard` | Xóa cứng sản phẩm | - | Admin only. |
| `POST` | `/api/products/{id}/restore` | Khôi phục sản phẩm đã xóa | - | - |
| `GET` | `/api/products/deleted` | Lấy danh sách sản phẩm đã xóa | - | - |
| `GET` | `/api/products/history` | Lịch sử chỉnh sửa sản phẩm | Query: `limit`, `actor`, `start_date`, `end_date` | - |
| `POST` | `/api/products/{id}/price` | Cập nhật giá nhập mặc định | Body: `price` | - |
| `POST` | `/api/products/{id}/sale-price` | Cập nhật giá bán mặc định | Body: `sale_price` | - |
| `POST` | `/api/products/images/upload` | Upload ảnh sản phẩm | Query: `filename`; Body: binary file | - |
| `GET` | `/api/product-movements` | Xem lịch sử biến động theo sản phẩm | Query: `product_id`, `from_date`, `to_date`, `movement_type`, `keyword` | `product_id` bắt buộc. |

## Tồn kho / Điều chỉnh / Lịch sử

| Method | Endpoint | Mục đích | Query / Body | Ghi chú |
|---|---|---|---|---|
| `GET` | `/api/transactions` | Lấy lịch sử giao dịch tồn kho | Query: `limit` | - |
| `POST` | `/api/transactions` | Tạo giao dịch tồn kho trực tiếp | Body: `product_id`, `transaction_type`, `quantity`, `note`, `adjustment_reason`, `batch_code`, `expiry_date` | Cần `Master Admin` hoặc `inventory_adjust_manage`. |
| `POST` | `/api/adjustments/inventory` | Tạo phiếu điều chỉnh tồn | Body: `items`, `reason`, `note` | - |
| `POST` | `/api/returns/customers` | Tạo phiếu trả hàng khách | Body: `customer_name`, `items`, `note`, `source_type`, `source_code` | - |
| `POST` | `/api/returns/suppliers` | Tạo phiếu trả nhà cung cấp | Body: `supplier_name`, `items`, `note`, `source_type`, `source_code` | - |
| `GET` | `/api/receipts/history` | Audit lịch sử các phiếu Phase B | Query: `limit`, `receipt_type`, `start_date`, `end_date` | - |

## Đơn hàng / Xuất hàng

| Method | Endpoint | Mục đích | Query / Body | Ghi chú |
|---|---|---|---|---|
| `POST` | `/api/orders/checkout` | Chốt giỏ hàng và xuất kho | Body: `customer_name`, `items`, `note`, `discount_amount` | - |
| `POST` | `/api/orders/quick-create` | Tạo nhanh đơn xuất hoặc cập nhật đơn hiện có | Body: `target_cart_id`, `customer_id`, `customer_name`, `document_date`, `note`, `items`, `discount_amount`, `final_status`, `mark_paid`, `payment_method`, `payment_note` | - |
| `POST` | `/api/orders/commit` | Chốt một đơn nháp | Body: `cart_id` | - |
| `POST` | `/api/orders/ship` | Chuyển đơn sang trạng thái đã xuất hàng | Body theo handler | - |
| `POST` | `/api/orders/{id}/cancel-request` | Tạo yêu cầu hủy đơn | Body: `reason` | - |
| `GET` | `/api/orders/{id}/history` | Xem history của đơn | Query: `limit` | - |
| `POST` | `/api/orders/bulk-create` | Lưu/chốt nhiều đơn cùng lúc | Body: `mode`, `request_id`, `orders`, `allow_duplicates` | Có thể sinh request chờ duyệt nếu login bật nhưng user không đủ quyền. |
| `GET` | `/api/orders/bulk-requests/{id}/history` | Xem lịch sử request xuất nhanh | Query: `limit` | - |
| `POST` | `/api/orders/bulk-requests/{id}/approve` | Duyệt request xuất nhanh | - | Permission `order_batch_manage`. |
| `POST` | `/api/orders/bulk-requests/{id}/reject` | Từ chối request xuất nhanh | Body: `reason` | Permission `order_batch_manage`. |
| `POST` | `/api/orders/bulk-requests/{id}/delete` | Xóa request chờ duyệt | - | Owner hoặc user quản lý. |
| `POST` | `/api/orders/bulk-requests/{id}/process` | Xử lý request đã duyệt | - | Owner hoặc user quản lý. |
| `POST` | `/api/carts/payment` | Cập nhật thanh toán cho đơn xuất | Body: `cart_id`, `payment_status`, `paid_at`, `payment_method`, `payment_note` | - |

## Nhập hàng / Mua hàng

| Method | Endpoint | Mục đích | Query / Body | Ghi chú |
|---|---|---|---|---|
| `POST` | `/api/purchases/quick-create` | Tạo nhanh phiếu nhập hoặc cập nhật phiếu hiện có | Body: `supplier_id`, `supplier_name`, `document_date`, `note`, `items`, `discount_amount`, `final_status`, `mark_paid`, `payment_method`, `payment_note`, `target_purchase_id` | - |
| `POST` | `/api/purchases/receive` | Nhập kho phiếu mua hàng | Body theo handler | - |
| `POST` | `/api/purchases/mark-paid` | Đánh dấu đã thanh toán cho phiếu nhập | Body: `purchase_id`, `discount_amount`, `paid_at`, `payment_method`, `payment_note` | - |
| `POST` | `/api/purchases/payment` | Cập nhật thông tin thanh toán phiếu nhập | Body theo handler | - |
| `POST` | `/api/purchases/received-item-expiry` | Cập nhật hạn dùng của một dòng nhập đã nhận | Body: `purchase_id`, `purchase_item_id`, `expiry_input_mode`, `manufacture_date`, `expiry_date`, `expected_updated_at` | - |
| `POST` | `/api/purchases/repair` | Sửa dữ liệu legacy của phiếu nhập | Body: `purchase_id`, `action` | - |
| `POST` | `/api/purchases/{id}/cancel-request` | Tạo yêu cầu hủy phiếu nhập | Body: `reason` | - |
| `GET` | `/api/purchases/{id}/history` | Xem history của phiếu nhập | Query: `limit` | - |

## Thanh toán

| Method | Endpoint | Mục đích | Query / Body | Ghi chú |
|---|---|---|---|---|
| `POST` | `/api/purchases/payment` | Cập nhật thanh toán cho phiếu nhập | Body theo handler | Trùng luồng với nhóm Nhập hàng. |
| `POST` | `/api/carts/payment` | Cập nhật thanh toán cho đơn xuất | Body theo handler | Trùng luồng với nhóm Đơn hàng. |

## Admin

| Method | Endpoint | Mục đích | Query / Body | Ghi chú |
|---|---|---|---|---|
| `GET` | `/api/admin/status` | Lấy lại session status cho khu admin | - | - |
| `GET` | `/api/admin/zalo-groups` | Lấy danh sách nhóm Zalo | - | - |
| `POST` | `/api/admin/zalo-groups` | Tạo hoặc cập nhật nhóm Zalo | Body: `id`, `name`, `zalo_url` | - |
| `DELETE` | `/api/admin/zalo-groups/{id}` | Xóa nhóm Zalo | - | - |
| `GET` | `/api/admin/public-web-config` | Lấy cấu hình public web và Zalo login | - | - |
| `POST` | `/api/admin/public-web-config` | Cập nhật cấu hình public web và Zalo login | Body theo handler | - |
| `GET` | `/api/admin/legacy-audit` | Quét legacy audit | - | - |
| `POST` | `/api/admin/legacy-audit/apply-safe-fixes` | Áp dụng các sửa an toàn cho dữ liệu legacy | - | - |
| `POST` | `/api/admin/legacy-audit/link-purchase-receipt` | Gắn `receipt_code` cho phiếu nhập | Body: `purchase_id`, `receipt_code` | - |
| `POST` | `/api/admin/legacy-audit/link-purchase-source` | Gắn đơn nguồn cho phiếu nhập | Body: `purchase_id`, `cart_id` | - |
| `GET` | `/api/admin/backup` | Tải file backup database | - | Trả file tải xuống. |
| `POST` | `/api/admin/restore` | Restore database từ nội dung base64 | Body: `content_base64` | - |
| `GET` | `/api/admin/export/{products|customers|suppliers}` | Export master data | Query: `format=json|csv` | Trả file tải xuống. |
| `POST` | `/api/admin/import/{products|customers|suppliers}` | Import master data | Body: `format`, `records` hoặc `content` | - |
| `DELETE` | `/api/admin/customers/{id}/hard` | Xóa cứng khách hàng | - | - |
| `DELETE` | `/api/admin/suppliers/{id}/hard` | Xóa cứng nhà cung cấp | - | - |
| `POST` | `/api/admin/orders/edit-locked` | Master Admin sửa phiếu xuất đã khóa | Body: `cart`, `adminEditReason` | Chỉ khi bật `EnableAdminLockedEdit`. |
| `POST` | `/api/admin/purchases/edit-locked` | Master Admin sửa phiếu nhập đã khóa | Body: `purchase`, `adminEditReason` | Chỉ khi bật `EnableAdminLockedEdit`. |

## Ghi chú triển khai

- Các route `bulk-*`, `cancel-request`, `approve/reject/process` là các luồng nghiệp vụ có kiểm tra permission riêng.
- Những endpoint trả file tải xuống gồm `backup`, `export`.
- Endpoint public Zalo có luồng redirect/callback riêng, không nên gọi như API JSON thuần.
- Nếu cần chi tiết payload sâu hơn cho một endpoint cụ thể, đọc thêm `qltpchay/http_handler.py` và các hàm tương ứng trong `qltpchay/store.py`.
