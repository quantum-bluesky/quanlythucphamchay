# Thiết Kế Các Màn Hình

Nguồn tổng hợp:

- `static/modules/screen-config.js`
- `static/app.js`
- `README.md`
- `docs/HUONG_DAN_SU_DUNG.md`
- `docs/DB_DESIGN.md`
- `docs/BUSINESS_FLOW.md`

## 0. Sơ đồ tài liệu design

`SCREEN_DESIGN.md` là tài liệu common design để base khi sửa UI/workflow.

Khi thay đổi ở mức tổng quát, cập nhật ngay file này. Khi thay đổi sâu theo domain, cập nhật thêm tài liệu detail liên quan.

Tài liệu common liên quan:

- [DB_DESIGN.md](DB_DESIGN.md)
- [BUSINESS_FLOW.md](BUSINESS_FLOW.md)

Liên kết detail hiện có:

- Hiển thị các phiếu/chứng từ: [PHIEU_DISPLAY_DESIGN.md](PHIEU_DISPLAY_DESIGN.md)

## 1. Nguyên tắc UI chung

- ưu tiên mobile-first
- danh sách là trung tâm, form được thu gọn khi hợp lý
- mỗi màn có search nhanh riêng
- popup/help phải đóng được và có liên kết qua lại giữa các màn liên quan
- luồng chính ưu tiên thao tác nhanh cho cửa hàng nhỏ

## 2. Danh sách màn hình

### `inventory` - Kiểm tra tồn kho

- mục tiêu:
  - xem tồn hiện tại
  - biết mặt hàng chờ nhập/chờ xuất
  - nhảy nhanh sang luồng xử lý liên quan
- thành phần chính:
  - ô tìm kiếm tồn kho
  - card sản phẩm
  - badge `Chờ xuất` / `Chờ nhập`
  - lịch sử gần đây
- hành động chính:
  - `Xuất`
  - `Nhập`
  - direct adjust chỉ cho Master Admin

### `create-order` - Tạo đơn xuất hàng

- mục tiêu:
  - chọn khách
  - thêm mặt hàng vào giỏ
  - chỉnh số lượng/giá bán
  - chốt đơn
- thành phần chính:
  - khu chọn khách
  - danh sách chọn hàng
  - giỏ hiện hành
  - search sản phẩm trong bán hàng
- nguyên tắc UI:
  - hàng đã chọn được gom lên trên
  - hàng đã chọn ẩn khỏi danh sách dưới

### `orders` - Quản lý đơn hàng

- mục tiêu:
  - xem giỏ nháp
  - theo dõi đơn đã chốt
  - cập nhật thanh toán
- thành phần chính:
  - search đơn hàng
  - filter hiện đơn đã xong / đã thanh toán
  - danh sách order card
- nguyên tắc UI:
  - giỏ nháp đang chờ xuất có nút `Xuất` nhanh ngay trên card trên tablet/PC
  - trên mobile, `Xuất` nằm trong menu `...` để tránh quá tải nút trực tiếp nhưng vẫn thao tác nhanh được

### `customers` - Quản lý khách hàng

- mục tiêu:
  - quản lý danh bạ khách
  - mở nhanh giỏ hàng cho khách
- thành phần chính:
  - search khách hàng
  - danh sách khách
  - form tạo/sửa thu gọn

### `products` - Quản lý sản phẩm

- mục tiêu:
  - sửa nhanh danh mục và giá
  - thêm mới sản phẩm
  - xem lịch sử sản phẩm
- thành phần chính:
  - search sản phẩm
  - danh sách edit inline
  - khối `Thêm sản phẩm`
  - khối `Lịch sử sản phẩm`
  - filter audit theo actor/date

### `purchases` - Quản lý nhập hàng

- mục tiêu:
  - lập phiếu nhập
  - theo dõi trạng thái đặt/nhập kho/thanh toán
- thành phần chính:
  - search phiếu nhập
  - gợi ý nhập
  - phiếu nhập hiện hành
  - danh sách phiếu
  - nút `NCC`
- nguyên tắc UI:
  - hàng đã thêm vào phiếu được gom lên tóm tắt phía trên
  - hàng đã thêm ẩn khỏi danh sách gợi ý phía dưới
- tài liệu detail:
  - [PHIEU_DISPLAY_DESIGN.md](PHIEU_DISPLAY_DESIGN.md)

### `suppliers` - Quản lý nhà cung cấp

- mục tiêu:
  - quản lý nguồn hàng
  - dùng lại trong phiếu nhập
- thành phần chính:
  - search NCC
  - danh sách NCC
  - form tạo/sửa thu gọn

### `reports` - Báo cáo

- mục tiêu:
  - xem nhập/xuất, doanh thu, giá vốn, lãi gộp
  - xem forecast nhập hàng
- thành phần chính:
  - bộ lọc tháng hoặc khoảng ngày
  - summary cards
  - trend chart/list
  - forecast list
  - chi tiết hoạt động sản phẩm
  - audit chứng từ
- tài liệu detail:
  - [PHIEU_DISPLAY_DESIGN.md](PHIEU_DISPLAY_DESIGN.md)

### `history` - Lịch sử & khôi phục

- mục tiêu:
  - xem đối tượng đã xóa mềm
  - khôi phục khi đủ điều kiện
- thành phần chính:
  - danh sách sản phẩm/khách/NCC đã xóa
  - cảnh báo ràng buộc trước khi restore

### `admin` - Master Admin

- mục tiêu:
  - quản trị dữ liệu master
  - backup/restore DB
- thành phần chính:
  - login panel
  - export/import master
  - backup/restore database

### `about` - About ứng dụng

- mục tiêu:
  - xem version chạy thực tế
  - đối chiếu khi support
- thành phần chính:
  - version/app info
  - điều hướng nhanh về các màn chính

## 3. Search nổi theo màn

Theo `FLOATING_SEARCH_CONFIG`, các màn có floating search chuyên biệt:

- `inventory`
- `create-order`
- `orders`
- `customers`
- `products`
- `purchases`
- `suppliers`

## 4. Điều hướng giữa màn

Các cặp điều hướng chính:

- `inventory` <-> `create-order`
- `inventory` <-> `purchases`
- `create-order` <-> `orders`
- `create-order` <-> `customers`
- `purchases` <-> `suppliers`
- `products` <-> `history`
- `admin` <-> `history`
- `about` <-> `inventory` / `reports` / `admin`

## 5. Quy ước layout quan trọng

- menu nổi và dock tìm kiếm có thể thu vào mép màn hình trên mobile
- các list dài dùng phân trang `Trước / Sau`
- action phụ nên gom vào `...` khi cần
- form quản trị đối tượng không nên che mất phần danh sách

## 6. Quy ước cập nhật tài liệu

- đổi common layout, điều hướng, field hiển thị dùng lại nhiều màn: cập nhật `SCREEN_DESIGN.md`
- đổi detail theo domain: cập nhật file design detail tương ứng và giữ liên kết từ file common sang file detail
- khi thêm tài liệu design detail mới, bổ sung link ngay trong mục `Sơ đồ tài liệu design`
