# Design Hiển Thị Các Phiếu

Tài liệu common liên quan:

- [SCREEN_DESIGN.md](SCREEN_DESIGN.md)

## 1. Bối cảnh

Project đang có nhiều loại chứng từ/phiếu hiển thị trên UI:

- `Phiếu xuất hàng` / `Đơn hàng`
- `Phiếu nhập`
- `Phiếu điều chỉnh tồn`
- `Phiếu trả hàng khách`
- `Phiếu trả NCC`

Sau khi restore dữ liệu thật từ server remote về local, xuất hiện thêm nhóm dữ liệu legacy không hoàn toàn theo flow mới:

- phiếu có `status` đã xử lý nhưng thiếu mốc thời gian tương ứng
- phiếu còn sót marker `paid_at`, `received_at`, `receipt_code` dù trạng thái ngoài UI lại là `draft`
- có receipt chuẩn hóa trong `inventory_receipts` nhưng purchase row không còn link đầy đủ

Mục tiêu của design này là chuẩn hóa cách hiển thị phiếu để user vẫn đọc, tra cứu và xử lý được dữ liệu cũ mà không phải đoán trạng thái thật.

## 2. Mục tiêu

- Giữ list phiếu gọn, thao tác nhanh trên mobile.
- Mỗi loại phiếu đều có metadata riêng nhưng cùng một khung hiển thị chung để user không phải học lại cách đọc.
- Trong detail phiếu phải hiện đủ mốc thời gian xử lý để đối chiếu.
- Audit chứng từ phải lọc được theo `mã phiếu` và `mã tham chiếu nguồn`.
- Data cũ bị thiếu timestamp không được làm kẹt flow hiện hành nếu có thể suy ra an toàn.
- Không tự đoán/link lại `receipt_code` khi không có bằng chứng chắc chắn trong DB.

## 3. Nguyên tắc hiển thị

### 3.1. List phiếu

List chỉ ưu tiên:

- đối tượng chính: khách hàng / nhà cung cấp
- trạng thái
- mã phiếu nếu có
- tổng tiền net sau khuyến mại hoặc tổng SL

Không nhồi nhiều mốc thời gian vào list để giữ UI gọn trên mobile.

### 3.2. Detail phiếu

Khi bấm button `Detail`, phải có khối metadata riêng hiển thị:

- `Mã phiếu`
- `Tạm tính`
- `Giảm KM`
- `Cần thanh toán`
- `Ngày tạo`
- `Ngày nhập kho`
- `Ngày thanh toán`
- `Cập nhật cuối`

Nếu thiếu dữ liệu thật thì hiện:

- `Chưa có` nếu hoàn toàn không suy ra được
- giá trị suy ra từ DB nếu đó là fallback an toàn

Button `Detail` phải cho phép expand/collapse ngay trong card hoặc panel hiện tại để giữ list phiếu gọn trên mobile.
Detail của phiếu xuất phải vẫn mở được với đơn `Chốt đơn`, `Đã xuất hàng` và `Đã thanh toán`, kể cả khi người dùng đi từ màn khách hàng sang bằng link nội bộ.

Khi chứng từ có dữ liệu theo lô, phần danh sách dòng hoặc note đi kèm nên hiện thêm:

- `Mã lô`
- `HSD` nếu có
- với phiếu xuất / trả NCC, có thể hiện thêm dấu vết `Lô xuất FIFO` để user đối chiếu lô đã bị trừ

### 3.3. Các nhóm phiếu chính

#### Phiếu xuất hàng / Đơn hàng

Nguồn màn hình:

- `create-order`
- `orders`

Mục đích:

- tạo và theo dõi phiếu xuất hàng theo khách
- cho user xem lại trạng thái đặt hàng, chốt đơn và thanh toán

Thông tin nên hiện trong detail:

- mã đơn / mã phiếu
- khách hàng
- địa chỉ giao
- trạng thái xử lý
- tạm tính / giảm khuyến mại / cần thanh toán
- ngày tạo
- ngày chốt / ngày xuất / ngày thanh toán nếu có
- cập nhật cuối

#### Phiếu nhập

Nguồn màn hình:

- `purchases`
- `procurement-planner`

Mục đích:

- lập phiếu nhập theo nhà cung cấp
- theo dõi đặt hàng, nhập kho và thanh toán
- nhận phiếu nháp được tạo từ kỳ gom nhập batch nếu cần gom nhu cầu thiếu theo sản phẩm

Thông tin nên hiện trong detail:

- mã phiếu
- nhà cung cấp
- trạng thái xử lý
- tạm tính / giảm khuyến mại / cần thanh toán
- dòng hàng nên cho sửa/xem `Mã lô`, `Hạn dùng` hoặc `Ngày sản xuất` theo từng lô nhập; nếu user chọn nhập qua NSX thì UI phải hiện HSD tự tính tương ứng
- ngày tạo
- ngày nhập kho
- ngày thanh toán
- cập nhật cuối
- nếu phiếu được tạo từ planner batch, detail nên giữ nguồn `procurement_batch` để đối chiếu với màn xử lý nhập thiếu; ghi chú vẫn dành cho nội dung user nhập tay

#### Phiếu điều chỉnh tồn

Nguồn màn hình:

- `inventory`

Mục đích:

- sửa chênh lệch tồn do kiểm kho hoặc xử lý đặc biệt

Thông tin nên hiện trong detail:

- mã phiếu
- người tạo
- lý do điều chỉnh
- danh sách dòng tăng/giảm
- ngày xử lý
- cập nhật cuối

#### Phiếu trả hàng khách

Nguồn màn hình:

- `orders`
- `reports`

Mục đích:

- ghi nhận khách trả hàng và cộng lại tồn

Thông tin nên hiện trong detail:

- mã phiếu
- khách hàng
- mã đơn / mã nguồn nếu có
- lý do trả
- lô nhập lại và HSD nếu người dùng có nhập
- ngày xử lý
- cập nhật cuối

#### Phiếu trả NCC

Nguồn màn hình:

- `purchases`
- `reports`

Mục đích:

- ghi nhận hàng trả ngược về nhà cung cấp và trừ tồn

Thông tin nên hiện trong detail:

- mã phiếu
- nhà cung cấp
- mã phiếu nhập / mã nguồn nếu có
- lý do trả
- mã lô bị trả nếu người dùng chỉ rõ, hoặc dấu vết `Lô xuất FIFO` nếu hệ thống tự phân bổ theo FEFO
- ngày xử lý
- cập nhật cuối

### 3.4. Audit chứng từ

Khối audit chứng từ ở màn `Báo cáo` phải hiển thị:

- mã phiếu
- loại phiếu
- ngày xử lý
- đối tượng liên quan
- số dòng / tổng SL
- tổng tiền
- liên kết nguồn nếu có (`Đơn nguồn` / `Phiếu nguồn`)

## 4. Quy tắc dữ liệu legacy

### 4.1. Purchase đang `received/paid` nhưng thiếu `received_at`

Thứ tự suy ra:

1. lấy `inventory_receipts.created_at` nếu `receipt_code` khớp receipt loại `purchase`
2. nếu không có receipt chuẩn hóa, fallback về `purchases.updated_at`

Mục đích:

- tránh bị chặn thanh toán chỉ vì thiếu timestamp cũ
- giữ lại khả năng đối chiếu thời điểm xử lý gần nhất

### 4.2. Purchase đang `paid` nhưng thiếu `paid_at`

Fallback:

- dùng `purchases.updated_at`

### 4.3. Purchase lệch marker/trạng thái

Nếu `status` là `draft/ordered/paid` nhưng còn sót marker xử lý không hợp lệ và không có receipt nhập kho thật, hệ thống coi đó là `phiếu lỗi`.

Phiếu lỗi được phép:

- `Hủy`
- `Xóa`

Nhưng:

- không khôi phục về `nháp`
- không cho sửa ngược lịch sử như phiếu hợp lệ

### 4.4. Tooling vận hành cho legacy

`Master Admin` có khối `Legacy Audit` để:

- quét DB hiện hành
- áp dụng `safe fixes` chỉ cho timestamp chắc chắn
- liệt kê record cần review thủ công
- cho gắn lại `receipt_code` hoặc `cart_id` sau khi admin đối chiếu đúng chứng từ thật

## 5. Tìm kiếm mã phiếu tham chiếu

Khối `Audit chứng từ` cần có ô tìm kiếm riêng với datalist để user có thể:

- gõ `mã phiếu`
- gõ `mã tham chiếu nguồn`
- chọn nhanh từ danh sách mã đã có trong kỳ đang xem

Nguồn dữ liệu gợi ý:

- `receipt_code`
- `source_code`

Rule lọc:

- match theo chuỗi chứa trong `receipt_code`, `source_code`, `note`, `reason`, `audit_message`, và tên đối tượng liên quan

## 6. Tác động UI hiện tại

### Màn `Quản lý nhập hàng`

- list phiếu vẫn giữ compact
- detail phiếu thêm khối `Ngày xử lý và mã phiếu`
- detail phiếu thêm trường `Tạm tính / Giảm KM / Cần thanh toán`
- phiếu legacy thiếu timestamp nhưng có status xử lý sẽ không còn bị kẹt thanh toán chỉ vì thiếu `receivedAt`
- phiếu nháp tạo từ `Xử lý nhập thiếu` vẫn hiển thị trong danh sách nhập hàng và đi tiếp theo workflow chuẩn

### Màn `Xử lý nhập thiếu`

- card planner hiển thị trạng thái gán phiếu batch cho từng sản phẩm thiếu
- nếu một sản phẩm đã có assignment active, màn này chỉ hiển thị phiếu đang xử lý, không cho tạo thêm phiếu nhập mở thứ hai cho cùng sản phẩm

### Màn `Báo cáo`

- audit chứng từ thêm ô tìm kiếm mã phiếu / mã tham chiếu
- card audit hiển thị thêm `Ngày xử lý`

## 7. Ngoài phạm vi

Design này không tự động:

- đoán lại `receipt_code` bị mất nếu DB không còn link chắc chắn
- ghép purchase row với receipt orphan chỉ dựa trên tên NCC hoặc thời gian gần nhau
- biến phiếu lỗi thành phiếu hợp lệ mới

Nếu cần phục hồi sâu hơn cho orphan data, phải có luồng repair riêng và tiêu chí match chặt hơn.
