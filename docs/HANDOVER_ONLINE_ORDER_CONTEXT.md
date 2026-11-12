# BỐI CẢNH DỰ ÁN VÀ TIẾP TỤC XỬ LÝ (HANDOVER CONTEXT)

**Thời gian tạo:** 2026-08-21  
**Mục đích:** Bàn giao bối cảnh, lịch sử thay đổi, lỗi hiện tại và hướng dẫn xử lý tiếp theo cho Agent / Developer tiếp quản.

---

## 1. Tổng quan hệ thống & Nghiệp vụ liên quan
- **Hệ thống:** Quản lý thực phẩm chay (Python standard library HTTP server + SQLite + SPA / Vanilla JS).
- **Môi trường chạy:** Server được triển khai phía sau Reverse Proxy tại đường dẫn con (subpath): `https://qts-home.duckdns.org/qltp/`.
- **Màn hình liên quan:** 
  - Trang đặt hàng công khai (Public Catalog / Online Order): `static/public_products.html`, `static/public_products.js` (truy cập qua route `/ProductList`).
  - Backend xử lý: `qltpchay/http_handler.py`, `qltpchay/store.py`.

---

## 2. Các công việc vừa thực hiện gần nhất (Lịch sử session)

1. **Xử lý đăng nhập Zalo qua Reverse Proxy (`/qltp/`):**
   - Đã sửa callback Zalo OAuth dùng relative redirect (`../../ProductList`) để tránh mất tiền tố subpath `/qltp/`.
   - Lưu thông tin khách (`public_customer_info`) vào `localStorage` gồm: `name`, `phone`, `address`, `zalo_id`.
   - Thêm nút **Đăng xuất (Thoát)** ở header trang chủ bên cạnh lời chào `👋 Tên khách`.

2. **Gộp đơn hàng tự động (Draft Cart Merge):**
   - Trong `store.py` (`create_online_order`): Nếu khách hàng đã có đơn online ở trạng thái `draft` (chưa duyệt), khi chọn thêm món và chốt đơn, hệ thống sẽ tự động gộp số lượng sản phẩm vào đơn cũ thay vì tạo đơn mới rời rạc.

3. **Cải tiến Modal Xác nhận đơn hàng (Checkout Review Modal):**
   - Hiển thị danh sách món đã chọn + Tổng tiền tạm tính.
   - Nếu khách đã đăng nhập / có lưu thông tin: Tự động ẩn 2 ô nhập Tên và SĐT để tránh trùng lặp, chỉ hiển thị thông tin Profile và ô Địa chỉ / Ghi chú + Nút **"Gửi đơn hàng"**.
   - Bỏ thuộc tính `required` khi ẩn trường để không bị chặn submit HTML5.

4. **Sửa lỗi `sqlite3.Row` object has no attribute 'get':**
   - Trong `store.py` (`_serialize_customer_row`), đã sửa `row.get("zalo_id")` thành `row["zalo_id"] if "zalo_id" in row.keys() else None`.

5. **Sửa lỗi hiển thị đơn hàng (`undefined x 1 undefined`):**
   - Trong `public_products.js` (`setupMyOrders`): Đã sửa logic mapping tên món và đơn vị tính từ `allProducts` theo `productId`.

---

## 3. VẤN ĐỀ HIỆN TẠI CẦN XỬ LÝ (ISSUE CỦA USER)

### Triệu chứng:
> **"Đã thấy đơn hàng được tạo phía backend, nhưng mở đơn ra thì thấy giá bán = 0, tổng giá cũng vậy."**

### Nguyên nhân gốc rễ (Root Cause Analysis):
1. Khi client `public_products.js` gửi payload lên `POST /api/public/orders`, danh sách `items` chỉ gồm:
   ```json
   [
     { "product_id": 1, "quantity": 2 },
     { "product_id": 3, "quantity": 1 }
   ]
   ```
   (Client không gửi kèm `unit_price` hoặc giá bán).
2. Tại backend `qltpchay/store.py`:
   - Hàm `_group_sale_items(items)` đọc `unit_price = float(raw_item.get("unit_price") or raw_item.get("unitPrice") or 0)` -> dẫn đến `unit_price = 0.0`.
   - Trong hàm `_build_cart_items_from_grouped_sale_items(connection, grouped_items)` (dòng ~1750 trong `store.py`):
     ```python
     for product_id, grouped_item in grouped_items.items():
         product = self._get_product_or_raise(connection, product_id)
         # Đang lấy trực tiếp grouped_item["unit_price"] (là 0.0) mà KHÔNG fallback về giá bán của sản phẩm trong DB!
         cart_items.append({
             ...
             "unitPrice": round(float(grouped_item["unit_price"]), 2),
             "unit_price": round(float(grouped_item["unit_price"]), 2),
             ...
         })
     ```
3. Hậu quả:
   - Các dòng `cart_items` trong database được lưu với `unit_price = 0`.
   - Khi Master Admin hoặc nhân viên mở đơn hàng ra xem, toàn bộ đơn có đơn giá = 0đ và tổng tiền = 0đ.

---

## 4. Hướng dẫn giải pháp cụ thể cho Agent kế thừa

### Bước 1: Sửa logic tính giá trong `qltpchay/store.py`
Trong hàm `_build_cart_items_from_grouped_sale_items`:
```python
    def _build_cart_items_from_grouped_sale_items(
        self,
        connection: sqlite3.Connection,
        grouped_items: dict[int, dict],
    ) -> list[dict]:
        cart_items: list[dict] = []
        for product_id, grouped_item in grouped_items.items():
            product = self._get_product_or_raise(connection, product_id)
            raw_unit_price = float(grouped_item.get("unit_price") or 0)
            # Nếu unit_price <= 0 (như đơn từ web công khai), fallback lấy giá bán sale_price hoặc price của sản phẩm trong DB
            if raw_unit_price <= 0:
                raw_unit_price = float(product.get("sale_price") or product.get("price") or 0)
            
            cart_items.append(
                {
                    "id": f"cart_item_{secrets.token_hex(6)}",
                    "productId": int(product_id),
                    "product_id": int(product_id),
                    "productName": str(product["name"] or "").strip(),
                    "product_name": str(product["name"] or "").strip(),
                    "quantity": round(float(grouped_item["quantity"]), 2),
                    "unitPrice": round(raw_unit_price, 2),
                    "unit_price": round(raw_unit_price, 2),
                    "note": str(grouped_item.get("note") or "").strip(),
                }
            )
        return cart_items
```

*(Kiểm tra thêm hàm `create_cart` hoặc `_group_sale_items` xem có chỗ nào cần giá trị mặc định tương tự không).*

### Bước 2: Kiểm tra phía client `public_products.js` (Optional & Good practice)
Khi gửi payload lên `/api/public/orders`, có thể gửi kèm `unit_price` từ `allProducts` (tuy nhiên backend vẫn là nguồn chân lý chính để xác thực giá sản phẩm).

### Bước 3: Tuân thủ quy tắc Repository (`AGENTS.md`)
1. **Kiểm tra cú pháp:**
   ```powershell
   node --check static/public_products.js
   python -m py_compile qltpchay/store.py
   ```
2. **Tăng version:**
   - Tăng version patch `z` trong `data/system_config.json`.
   - Tăng counter trong `data/js_asset_versions.json` nếu có sửa file `.js`.
3. **Commit Git:**
   - Tạo commit với message mô tả rõ ràng.

---

## 5. Danh sách các file trọng yếu
- `qltpchay/store.py`: Logic giỏ hàng, đơn hàng online (`create_online_order`, `_build_cart_items_from_grouped_sale_items`, `_group_sale_items`).
- `qltpchay/http_handler.py`: Handler cho `/api/public/orders`, `/api/public/zalo-callback`.
- `static/public_products.js`: UI đặt hàng công khai, review cart, modal đơn hàng.
- `static/public_products.html`: Template HTML đặt hàng công khai.
- `data/system_config.json`: Cấu hình hệ thống & phiên bản runtime.
- `data/js_asset_versions.json`: Cache-busting manifest cho JS.
