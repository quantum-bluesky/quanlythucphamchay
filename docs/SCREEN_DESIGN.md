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
  - dropdown sắp xếp trong khu vực phân trang
  - card sản phẩm
  - badge `Chờ xuất` / `Chờ nhập` có thêm `số phiếu / tổng số lượng` đang chờ theo sản phẩm
  - lịch sử gần đây
- hành động chính:
  - `Xuất`
  - `Nhập`
  - direct adjust chỉ cho Master Admin
- nguyên tắc UI:
  - search toolbar chỉ giữ ô tìm kiếm
  - sort nằm ở pagination đầu list; pagination cuối không lặp sort control
  - mode `Ưu tiên nhập/xử lý` hiển thị thêm điểm ưu tiên trên card
  - mode `Hạn còn ít` hiển thị thêm hạn còn lại ước tính hoặc nhãn chưa có dữ liệu hạn

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
  - nút `...` luôn hiện trên card sản phẩm để toggle detail
  - hàng đã chọn được gom lên trên dưới dạng card trong khối `Giỏ hiện hành`
  - hàng đã chọn mặc định ẩn khỏi danh sách dưới để tránh sót; riêng dòng mà user chủ động bấm `...` thì được giữ lại ở danh sách dưới trong lúc thao tác
  - khối `Giỏ hiện hành` hiển thị card gọn mặc định chỉ 2 dòng; bấm `...` trên từng card để mở detail input trực tiếp số lượng/giá bán
  - khối `Giỏ hiện hành` và detail đơn phải hiển thị `Tạm tính / Giảm KM / Cần thanh toán`; giảm giá là field cấp toàn phiếu, không phải per-line
  - khối `Giỏ hiện hành` có thêm button `Detail` để bung metadata phiếu xuất mà không chuyển màn
  - không dùng cụm nút tăng giảm nhanh trong `Giỏ hiện hành` để tránh rối trên mobile
  - sau khi đơn đã `Đã xong` nhưng chưa `Đã thanh toán`, chỉ còn cho sửa `Giảm giá khuyến mại`; không mở khóa lại dòng hàng
  - khi chốt đơn bị thiếu hàng, app phải báo trước khi tạo/cập nhật phiếu nhập; nếu đã có phiếu chờ nhập đủ số lượng thì chỉ mở lại phiếu liên quan sau khi user xác nhận cần chỉnh

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
  - card đơn có button `Detail` để bung metadata và danh sách dòng hàng ngay trong list
  - card đơn chưa thanh toán có thể hiện thêm input `Giảm giá khuyến mại` trong detail; đây là ngoại lệ duy nhất được sửa sau khi đơn đã chốt
  - trên mobile, `Xuất` và các action phụ vẫn nằm trong khối detail mở rộng để tránh quá tải nút trực tiếp
  - các nút đổi trạng thái hoặc xóa phiếu như `Xuất`, `Đã thanh toán`, `Hủy`, `Xóa` phải hiện message confirm trước khi app cập nhật

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
  - field `Hạn dùng (ngày)` và `Bảo quản (ngày)` để phục vụ sort hạn còn lại ở tồn kho

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
  - phiếu nhập hiện hành phải hiển thị `Tạm tính / Giảm KM / Cần thanh toán`; giảm giá là field cấp toàn phiếu để đối chiếu số tiền thực trả NCC
  - metadata phiếu nhập được bung/thu gọn bằng button `Detail` thay vì badge tĩnh để phần đầu phiếu gọn hơn
  - nếu phiếu nhập sinh ra từ một đơn đang thiếu hàng, phần metadata `Detail` phải hiện nguồn đơn thiếu riêng; không dùng ô ghi chú để nhét sẵn nội dung này
  - nếu shortage từ màn xuất hàng đã được cover bởi phiếu `draft/ordered` hiện có, màn nhập hàng chỉ mở lại phiếu liên quan khi user xác nhận; không tự tạo thêm phiếu trùng
  - nút `Nhập kho` chỉ hiện khi phiếu đã ở trạng thái `Đã đặt`; phiếu `Nháp` vẫn còn chỉnh sửa được nhưng chưa cho nhập kho
  - ô NCC và nút `NCC` chỉ bật khi phiếu đang là `Nháp`; từ `Đã đặt` trở đi phải disable trên cả desktop và mobile
  - sau khi phiếu đã `Đã nhập kho` nhưng chưa `Đã thanh toán`, chỉ còn cho sửa `Giảm giá khuyến mại`; không mở khóa lại NCC hay dòng nhập
  - các nút đổi trạng thái hoặc xóa phiếu như `Đã đặt hàng`, `Nhập kho`, `Đã thanh toán`, `Hủy phiếu`, `Xóa phiếu` phải hiện message confirm trước khi app cập nhật
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
