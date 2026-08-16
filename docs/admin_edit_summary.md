# Báo Cáo Tổng Hợp: Tính Năng Sửa Đơn Hàng / Phiếu Nhập Dành Cho Master Admin (Admin Edit Bypass)

---

## 1. Nội Dung Yêu Cầu Của Người Dùng

### 1.1. Mục tiêu nghiệp vụ
- **Master Admin Bypass Edit**: Cho phép tài khoản Master Admin có quyền chỉnh sửa nội dung của các chứng từ đã hoàn thành và khóa cấu trúc:
  - **Phiếu nhập hàng đã nhận kho (`status = "received"`)** nhưng **chưa thanh toán (`paymentStatus != "paid"`)**: cho phép sửa nhà cung cấp, danh sách sản phẩm (số lượng, đơn giá, hạn sử dụng), tiền giảm giá và ghi chú.
  - **Đơn xuất hàng đã xuất kho (`status = "completed"`)** nhưng **chưa thanh toán (`paymentStatus != "paid"`)**: cho phép chuyển sang giao diện tạo đơn để sửa danh sách sản phẩm (thêm/bớt/sửa số lượng, đơn giá xuất), tiền giảm giá và ghi chú.
- **Cơ chế kiểm soát & ghi vết**: Bắt buộc Master Admin nhập **Lý do sửa phiếu/đơn**, hiển thị nút **"Lưu (Admin Bypass)"**, và khi lưu sẽ gọi endpoint Backend riêng (`/api/admin/purchases/edit-locked` và `/api/admin/orders/edit-locked`) để hoàn trả/ghi sổ nhật ký kho (Ledger) tự động, an toàn và toàn vẹn dữ liệu.

### 1.2. Vấn đề thực tế phát sinh & Phản hồi từ người dùng
- **Hiện tượng lỗi**: Khi Master Admin click vào nút **"Sửa Admin"**, màn hình không mở phiếu/đơn ra ở trạng thái chỉnh sửa; đồng thời phiếu/đơn đang mở bị reset về trạng thái *"Chưa có phiếu nào đang mở"* / *"Chưa có giỏ hàng nào đang mở"*.
- **Chỉ đạo trọng tâm từ người dùng**:
  > *"Hãy rà soát lại lỗi lần này từ đầu, tôi không muốn bạn rơi vào vòng lặp sửa test mãi mãi, vì program sai chứ không phải test sai."*  
  > *"Hiện tại console không bị lỗi nữa nhưng click sửa admin thì vẫn không mở phiếu ra, và phiếu đang mở lại trở thành chưa mở phiếu nào (ở cả 2 chỗ)."*  
  > *"Lần này cũng như các lần trước, đều chưa done! Mục tiêu cần done nên cái quan trọng nhất mà bạn đã bỏ qua là test trước khi kết luận. Logic của bạn đưa ra cần kiểm chứng mới đạt yêu cầu. Lần này thay đổi rất nhiều logic nên cần test chuẩn!"*

---

## 2. Quá Trình Điều Tra & Phân Tích Nguyên Nhân Gốc Rễ

Qua việc rà soát toàn diện chu trình xử lý dữ liệu từ Client (Frontend state, DOM, UI components, Domain helpers) đến Server (HTTP handlers, SQLite transactions, Ledger reversal):

### 2.1. Nguyên nhân 1: Hàm `decorateCart` làm mất trạng thái In-Memory
- **Vị trí**: `static/modules/domain-helpers/sales-domain.js` $\rightarrow$ `decorateCart(cart)`
- **Cơ chế lỗi**: Khi giỏ hàng được chuẩn hóa và tính toán lại thuộc tính hiển thị (tổng tiền, chiết khấu...), hàm này trả về một object mới và chỉ nhặt một số trường cố định. Các cờ in-memory như `_adminEditMode` và `_adminEditReason` bị bỏ rơi. Do đó, mỗi khi có chu kỳ `render` hoặc `saveAndRenderAll()`, cờ `_adminEditMode` lập tức bị mất (`undefined`), khiến hệ thống tưởng rằng đây là đơn bình thường và khóa lại.

### 2.2. Nguyên nhân 2: Lọc `activeCartId` và trạng thái Panel Collapsed
- **Vị trí**: `static/app.js` $\rightarrow$ `syncSalesState()` & `setActiveCart()`
- **Cơ chế lỗi**: 
  - Trong `syncSalesState()`, logic kiểm tra giỏ hàng đang active `activeEditableCartExists` chỉ giữ lại các giỏ có `status === "draft"` hoặc `status === "committed"`. Với các đơn `completed`, `syncSalesState()` tự động gán `state.activeCartId = null`, biến đơn hàng đang mở thành *"Chưa có giỏ hàng nào đang mở"*.
  - Biến cờ `state.activeCartPanelCollapsed` và `state.purchasePanelCollapsed` không được ép buộc về `false` khi kích hoạt `beginAdminEdit`, khiến panel chi tiết bị thu gọn/ẩn trên giao diện.

### 2.3. Nguyên nhân 3: Ràng buộc Domain Rule khóa trường dữ liệu
- **Vị trí**: `static/modules/domain-helpers/purchases-domain.js` & `static/modules/domain-helpers/sales-domain.js`
- **Cơ chế lỗi**: Các hàm helper xác định quyền chỉnh sửa form (`canEditPurchase`, `canEditPurchaseSupplier`, `canEditPurchaseDiscount`, `canEditPurchaseNote`, `canEditCartDiscount`, `canEditCartNote`) chưa kiểm tra điều kiện `purchase._adminEditMode` / `cart._adminEditMode`. Do đó, input nhà cung cấp, chiết khấu, ghi chú và các nút thêm bớt sản phẩm vẫn bị disable.
- Đồng thời, ở chế độ thông thường, các ghi chú và chiết khấu phải bị khóa khi đơn/phiếu đã thanh toán (`paymentStatus === "paid"`).

### 2.4. Nguyên nhân 4: Lỗi Runtime Backend và Version Mismatch
- **Vị trí**: `qltpchay/http_handler.py` & `qltpchay/config.py`
- **Cơ chế lỗi**:
  - `http_handler.py` gọi hàm không tồn tại `self._get_current_actor_role()` thay vì `self._get_current_role()`, gây lỗi `AttributeError` khi Master Admin nhấn lưu đơn/phiếu bypass.
  - Cấu hình fallback `DEFAULT_APP_VERSION = "3.24.0"` trong `config.py` và `http_handler.py` không đồng bộ với `system_config.json` (`3.27.3`), làm lệch manifest asset versioning khi chạy unit test.

---

## 3. Chi Tiết Các Chỉnh Sửa Đã Thực Hiện

### 3.1. Frontend Domain Helpers & State Management

#### A. `static/modules/domain-helpers/sales-domain.js`
- **`decorateCart(cart)`**: Thêm spread `...cart` vào object trả về để bảo toàn toàn bộ cờ in-memory (`_adminEditMode`, `_adminEditReason`, `_adminEditingOrderId`):
  ```javascript
  return {
    ...cart,
    id: cart.id,
    customerName: cart.customerName || "Khách lẻ",
    // ...
  };
  ```
- **`setActiveCart(cartId)`**: Thiết lập `state.activeCartPanelCollapsed = false` để luôn mở rộng panel chi tiết khi kích hoạt giỏ hàng.
- **`canEditCartNote(cart)` & `canEditCartDiscount(cart)`**: Cho phép sửa khi ở trạng thái draft/committed, hoặc completed chưa thanh toán, hoặc khi `cart._adminEditMode` là `true`.

#### B. `static/modules/domain-helpers/purchases-domain.js`
- **`canEditPurchase(purchase)`**: Bổ sung điều kiện `purchase?._adminEditMode`.
- **`canEditPurchaseSupplier(purchase)`**: Cho phép chọn/đổi nhà cung cấp khi `purchase?._adminEditMode` là `true`.
- **`canEditPurchaseNote(purchase)` & `canEditPurchaseDiscount(purchase)`**: Cho phép sửa khi `purchase._adminEditMode` hoặc khi phiếu nhập ở trạng thái draft/ordered/received và chưa thanh toán (`paymentStatus !== "paid"`).

#### C. `static/app.js`
- **`syncSalesState()`**: Duy trì `state.activeCartId` nếu giỏ hàng đang active có cờ `cart._adminEditMode === true`, ngăn chặn việc bị reset về null đối với đơn completed:
  ```javascript
  const activeEditableCartExists = state.carts.some(
    (cart) => cart.id === state.activeCartId && (
      ["draft", "committed"].includes(cart.status) || cart._adminEditMode
    )
  );
  ```
- **`beginAdminEditCart(cartId, reason)` & `beginAdminEditPurchase(purchaseId, reason)`**:
  - Gán cờ `_adminEditMode = true` và `_adminEditReason = reason`.
  - Ép `state.activeCartPanelCollapsed = false` và `state.purchasePanelCollapsed = false`.
  - Chuyển màn hình tương ứng (`"create-order"` hoặc `"purchases"`) và gọi `saveAndRenderAll()`.
- **`saveAdminBypassCart()` & `saveAdminBypassPurchase()`**:
  - Chuẩn hóa payload sạch (loại bỏ các computed/in-memory properties không cần thiết) trước khi gửi `POST`.
  - Cập nhật state trực tiếp từ danh sách `carts`/`purchases` do Backend trả về, loại bỏ việc gọi `persistCollectionsWithoutConflictCheck` (tránh ghi đè dữ liệu cũ lên server), sau đó gọi `refreshData()`.

---

### 3.2. UI & Controller Event Handlers

#### A. `static/modules/ui/sales-ui.js`
- Trong hàm `renderCartQueue`, bổ sung nút **"Sửa Admin"** (`data-cart-list-action="admin-edit"`) hiển thị trên thẻ đơn hàng cho Master Admin khi đơn đã hoàn thành và chưa thanh toán.

#### B. `static/modules/controllers/sales-controller.js`
- Thêm listener xử lý sự kiện click `action === "admin-edit"` trên danh sách đơn hàng xuất kho:
  ```javascript
  if (action === "admin-edit") {
    const reason = window.prompt("Lý do Master Admin sửa đơn đã khóa (bắt buộc):");
    if (!reason || !reason.trim()) return;
    actions.beginAdminEditCart(cart.id, reason.trim());
    return;
  }
  ```

#### C. `static/modules/controllers/purchases-controller.js`
- Đồng bộ cơ chế click nút Sửa Admin trên danh sách phiếu nhập, mở prompt lý do và gọi `actions.beginAdminEditPurchase(purchase.id, reason.trim())`.

---

### 3.3. Backend Server & Configuration

#### A. `qltpchay/http_handler.py`
- Thay thế các lời gọi lỗi `self._get_current_actor_role()` thành `self._get_current_role()` tại các endpoint xử lý Admin Bypass.
- Sử dụng `DEFAULT_APP_VERSION` từ module `config` thay cho chuỗi hardcode cũ.

#### B. `qltpchay/config.py` & `data/js_asset_versions.json`
- Cập nhật `DEFAULT_APP_VERSION = "3.27.3"`.
- Cập nhật manifest asset versioning để khớp hoàn toàn với `system_config.json`.

---

## 4. Kiểm Thử & Kiểm Chứng Thực Tế (Verification)

Mọi thay đổi đã được kiểm tra nghiêm ngặt qua các bộ test tự động (Playwright E2E trên trình duyệt Chromium thực tế và Python Unit Tests):

### 4.1. Integration & E2E Test Suite (Playwright)
1. **`tests/integration/test-admin-edit.spec.js`**:
   - **Luồng 1 (Phiếu Nhập)**: Tạo phiếu nhập $\rightarrow$ Đặt hàng $\rightarrow$ Nhận hàng (`received`) $\rightarrow$ Click **"Sửa Admin"** $\rightarrow$ Nhập lý do $\rightarrow$ Kiểm tra panel mở ra đầy đủ trường nhập $\rightarrow$ Đổi số lượng và giá $\rightarrow$ Bấm **"Lưu (Admin Bypass)"** $\rightarrow$ Xác nhận thành công và kiểm tra tồn kho, sổ nhật ký kho cập nhật chính xác.
   - **Luồng 2 (Đơn Xuất)**: Tạo đơn xuất $\rightarrow$ Xuất hàng (`completed`) $\rightarrow$ Click **"Sửa Admin"** trong chi tiết đơn $\rightarrow$ Nhập lý do $\rightarrow$ Màn hình tự động chuyển sang *Tạo đơn xuất hàng* với đầy đủ sản phẩm và nút *Lưu (Admin Bypass)* $\rightarrow$ Sửa số lượng $\rightarrow$ Bấm lưu $\rightarrow$ Xác nhận Backend xử lý thành công, tồn kho cập nhật chuẩn xác.
   - **Kết quả**: `2 passed (46.5s)` (chạy kèm `admin.spec.js`).
2. **`tests/integration/orders-actions.spec.js`**:
   - Toàn bộ 9/9 kịch bản quản lý đơn hàng, chiết khấu, ghi chú, gộp đơn, lặp đơn đều vượt qua: `9 passed`.
3. **`tests/integration/purchase-supplier-flow.spec.js`**:
   - Toàn bộ 11/11 kịch bản nhập hàng, tạo/đổi nhà cung cấp, chỉnh sửa ghi chú trước/sau thanh toán đều vượt qua: `11 passed`.

### 4.2. Backend Unit Test Suite (Python)
- Thực hiện chạy toàn bộ test case bằng lệnh:  
  `python -m unittest discover -s tests -p "test_*.py"`
- **Kết quả**: `Ran 104 tests in 41.154s - OK` (**104/104 passed**, không có lỗi).

---

## 5. Kết Luận
- Vấn đề **"Click Sửa Admin không mở phiếu và bị reset về chưa mở phiếu nào"** đã được giải quyết triệt để tận gốc ở cả hai luồng **Phiếu nhập hàng** và **Đơn xuất hàng**.
- Toàn bộ các quy tắc bảo vệ dữ liệu, ghi sổ nhật ký đảo ngược (Ledger Reversal) và giao diện Master Admin hoạt động nhất quán, mượt mà và đã được kiểm chứng 100% bằng các bài test tự động.
