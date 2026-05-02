# Business Flow

Tài liệu này gom luồng nghiệp vụ vận hành của app theo code và tài liệu hiện tại.

Nguồn tổng hợp:

- `README.md`
- `docs/HUONG_DAN_SU_DUNG.md`
- `docs/WORKFLOW_REVIEW.md`
- `static/modules/screen-config.js`

## 1. Luồng tổng quát

```text
Kiểm tra tồn kho
  -> nếu đủ hàng: Tạo đơn xuất hàng -> Quản lý đơn hàng -> Đã thanh toán
  -> nếu thiếu hàng: Quản lý nhập hàng -> Đã đặt -> Đã nhập kho -> Đã thanh toán

Nếu phát hiện sai sau khi chứng từ đã xử lý
  -> dùng phiếu điều chỉnh tồn / phiếu trả hàng khách / phiếu trả NCC

Nếu cần can thiệp đặc biệt
  -> Master Admin
```

## 2. Luồng tồn kho

- màn chính: `inventory`
- mục tiêu:
  - xem tồn hiện tại
  - phát hiện hàng sắp hết
  - phát hiện hàng đang chờ nhập/chờ xuất
- quy tắc:
  - user thường không chỉnh tồn trực tiếp
  - direct adjust là quyền riêng của Master Admin
  - direct adjust bắt buộc lý do

## 3. Luồng bán hàng

### Bước 1: Mở giỏ theo khách

- chọn khách có sẵn hoặc gõ tên mới
- app tạo hoặc mở `draft cart`

### Bước 2: Chọn mặt hàng

- tick sản phẩm để đưa vào giỏ
- hàng đã chọn được gom lên trên
- hàng đã chọn ẩn khỏi danh sách dưới
- riêng dòng mà user chủ động bấm `...` thì vẫn được giữ lại ở danh sách dưới trong lúc thao tác

### Bước 3: Chỉnh dòng hàng

- trong `Giỏ hiện hành`, mỗi dòng hiển thị dưới dạng card gọn 2 dòng; bấm `...` để mở detail
- sửa số lượng
- sửa giá bán riêng cho đơn
- nếu cần, cập nhật luôn giá bán mặc định
- trong lúc phiếu còn `Nháp` hoặc `Đã đặt`, vẫn có thể thêm bớt dòng và chỉnh số lượng/giá; chỉ sau `Đã nhập kho` mới khóa nội dung

### Bước 4: Chốt đơn

- nếu đủ tồn:
  - tạo xuất kho
  - cart chuyển `completed`
- nếu thiếu tồn:
  - user thường được dẫn sang luồng nhập hàng
  - không bypass chỉnh tồn

### Bước 5: Theo dõi đơn

- màn `orders`
- chỉ xem/in/thanh toán/hủy theo rule
- giỏ nháp đang chờ xuất có thể bấm `Xuất` ngay trên card để chốt nhanh mà không cần mở lại giỏ; trên mobile nút này nằm trong `...`
- đơn đã `completed` không sửa trực tiếp

## 4. Luồng nhập hàng

### Bước 1: Tạo hoặc mở phiếu nhập

- từ màn `purchases`
- có thể đi từ shortage flow của bán hàng
- phiếu nháp chỉ được lưu thật khi đã có ít nhất một mặt hàng; phiếu trống chỉ là trạng thái mở tạm trên giao diện

### Bước 2: Chọn hàng cần nhập

- thêm từ danh sách gợi ý
- hàng đã chọn được gom vào phần tóm tắt phiếu

### Bước 3: Chọn NCC và chỉnh dòng nhập

- gán nhà cung cấp
- sửa số lượng, giá nhập
- có thể đổi giá nhập mặc định
- nếu mở luồng tạo NCC khi phiếu chưa có mặt hàng, app chỉ giữ giá trị NCC trên UI để quay lại tiếp tục nhập hàng, không lưu phiếu nháp rỗng xuống DB
- nhà cung cấp chỉ được đổi khi phiếu còn `draft`; từ `ordered` trở đi phải giữ nguyên NCC đã chốt

### Bước 4: Chạy trạng thái workflow

```text
draft -> ordered -> received -> paid
draft -> cancelled
ordered -> cancelled
```

### Rule chính

- `draft` chỉ là trạng thái chuẩn bị, chưa cho nhập kho
- `ordered` mới được nhập kho và vẫn cho sửa trực tiếp để thêm bớt theo biến động thực tế
- từ `ordered` trở đi không được đổi `supplierName`; UI phải khóa ô NCC và nút `NCC` trên mọi thiết bị
- chỉ `received` mới được `paid`
- `received` / `paid` / `cancelled` chuyển sang chỉ xem
- trước mọi thao tác đổi trạng thái hoặc xóa hẳn chứng từ nháp như `draft -> completed`, `draft -> ordered`, `ordered -> received`, `received -> paid`, chuyển sang `cancelled` hoặc xóa phiếu được phép xóa, UI phải hiện message confirm trước khi ghi nhận

## 5. Luồng sửa sai sau khi đã xử lý chứng từ

### Phiếu điều chỉnh tồn

- dùng khi kiểm kho lệch hoặc chênh lệch nội bộ
- có thể tăng hoặc giảm tồn
- chỉ admin

### Phiếu trả hàng khách

- dùng khi khách trả hàng
- tồn kho tăng lại

### Phiếu trả NCC

- dùng khi trả ngược hàng lỗi cho NCC
- tồn kho giảm

### Nguyên tắc chung

- không sửa ngược chứng từ cũ
- tạo chứng từ mới để giữ lịch sử

## 6. Luồng quản lý danh mục

### Sản phẩm

- thêm mới
- sửa giá nhập / giá bán mặc định
- soft delete khi ngừng bán
- xem audit lịch sử sản phẩm

### Khách hàng

- lưu danh bạ giao hàng
- mở nhanh giỏ hàng

### Nhà cung cấp

- lưu nguồn hàng
- tái sử dụng cho phiếu nhập

## 7. Luồng nhiều máy

- tất cả máy dùng chung cùng server/app
- state chính cho `customers/suppliers/carts/purchases` lưu ở SQLite
- app tự refresh khi người dùng đang rảnh
- khi lưu draft, client gửi version `expected_updated_at`
- nếu stale:
  - server trả `409`
  - UI phải tải lại để tránh ghi đè

## 8. Luồng báo cáo

- chọn tháng chính hoặc khoảng ngày
- xem:
  - chi nhập
  - doanh thu
  - giá vốn
  - lãi gộp
  - xu hướng tháng
  - forecast nhập hàng

## 9. Luồng quản trị hệ thống

- màn `admin`
- đăng nhập bằng cấu hình runtime
- chức năng:
  - export/import master data
  - backup database
  - restore database

## 10. Rule business cốt lõi

- `products.price` là giá nhập mặc định
- `products.sale_price` là giá bán mặc định
- tồn kho chuẩn phải đi qua `đơn chờ xuất` hoặc `phiếu chờ nhập`
- chỉ `Master Admin` mới được bypass quy trình chuẩn để chỉnh tồn trực tiếp
- sai sót sau khi chứng từ đã xử lý phải đi qua chứng từ điều chỉnh
