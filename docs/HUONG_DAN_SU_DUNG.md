# Hướng Dẫn Sử Dụng Theo Luồng Nghiệp Vụ

Tài liệu này dành cho người trực tiếp dùng ứng dụng hằng ngày.

## 1. Mục tiêu sử dụng

Ứng dụng dùng để:

- theo dõi tồn kho
- nhập hàng
- tạo đơn xuất cho khách
- quản lý khách hàng
- quản lý nhà cung cấp
- xem báo cáo nhập xuất theo tháng

## 2. Nguyên tắc thao tác

- Mỗi lần làm việc chỉ chọn đúng `Menu nghiệp vụ`
- Mỗi màn hình đều có ô tìm kiếm, nên gõ tên để thao tác nhanh
- Trên điện thoại, nếu cần xem danh sách dài thì dùng `Thu gọn` hoặc nút chuyển trang `Trước / Sau`

## 3. Luồng làm việc hằng ngày

### Luồng A: Kiểm tra tồn kho đầu ngày

Vào menu:

```text
1. Kiểm tra tồn kho
```

Thực hiện:

1. Gõ tên sản phẩm để tìm nhanh
2. Xem các mặt hàng có nhãn `Sắp hết`
3. Nếu cần điều chỉnh nhanh, dùng nút `+1`, `-1`, `+5`, `-5`
4. Nếu cần nhập/xuất chính xác hơn, dùng khung `Nhập / xuất nhanh`

Khi dùng:

- `Nhập kho`: tăng tồn
- `Xuất kho`: giảm tồn

## 4. Luồng bán hàng cho khách

Vào menu:

```text
2. Tạo đơn xuất hàng
```

### Bước 1: Chọn khách hàng

1. Gõ tên khách hàng
2. Nếu khách đã có sẵn, chọn đúng tên
3. Nếu khách chưa có, cứ gõ tên rồi bấm `Mở giỏ hàng`

Ứng dụng sẽ tự tạo giỏ hàng nháp cho khách đó.

### Bước 2: Chọn hàng vào giỏ

1. Ở cột `Danh sách để thêm vào giỏ`
2. Tìm sản phẩm theo tên
3. Tick chọn sản phẩm cần bán

Khi chọn, sản phẩm sẽ xuất hiện ở `Giỏ hiện hành`.

### Bước 3: Sửa số lượng và giá bán

Trong `Giỏ hiện hành`:

1. Tăng giảm số lượng bằng nút nhanh
2. Hoặc gõ trực tiếp số lượng
3. Gõ giá bán cho khách
4. Bấm `Lưu dòng`

### Bước 4: Chốt đơn

Bấm:

```text
Chốt xuất kho
```

Nếu đủ hàng:

- hệ thống trừ kho
- đơn chuyển sang trạng thái đã xong
- có thể in / gửi danh sách cho khách

Nếu thiếu hàng:

- hệ thống sẽ hỏi có muốn sang sửa tồn kho hay không
- nếu không sửa tồn kho, hệ thống tạo sẵn đề xuất nhập hàng

## 5. Luồng xem lại và hoàn tất đơn hàng

Vào menu:

```text
3. Quản lý đơn hàng
```

Dùng màn này để:

- mở lại giỏ hàng đang chờ
- in lại đơn
- đánh dấu `Đã thanh toán`
- hủy đơn
- xóa đơn

### Khi nào dùng từng nút

- `Tiếp tục bán`: mở lại giỏ hàng nháp để sửa tiếp
- `In`: in hoặc gửi lại danh sách hàng cho khách
- `Đã thanh toán`: đánh dấu đơn đã thu tiền
- `Hủy`: dùng khi khách không lấy nữa
- `Xóa`: xóa hẳn khỏi danh sách

## 6. Luồng quản lý khách hàng

Vào menu:

```text
4. Quản lý khách hàng
```

Thông tin nên lưu:

- tên khách hàng
- số liên lạc
- địa chỉ ship
- link Zalo

### Cách dùng

1. Điền thông tin vào form
2. Bấm `Lưu khách hàng`
3. Khi cần sửa, bấm `Sửa`
4. Khi cần mở giỏ hàng nhanh cho khách, bấm `Mở giỏ`

Khuyến nghị:

- luôn lưu số liên lạc và địa chỉ ship cho khách thường xuyên đặt hàng

## 7. Luồng quản lý sản phẩm

Vào menu:

```text
5. Quản lý sản phẩm
```

Màn này dùng để:

- thêm mặt hàng mới
- sửa tên / loại / đơn vị / giá / ngưỡng cảnh báo
- xóa mặt hàng chưa có giao dịch

### Cách sửa nhanh

1. Tìm sản phẩm
2. Bấm `Sửa`
3. Đổi thông tin ngay trên dòng sản phẩm
4. Bấm `Lưu nhanh`

## 8. Luồng nhập hàng

Vào menu:

```text
6. Quản lý nhập hàng
```

Màn này có 2 phần:

- `Gợi ý nhập`
- `Phiếu nhập`

### Luồng nhập hàng chuẩn

1. Xem `Gợi ý nhập`
2. Bấm `Thêm vào phiếu nhập` cho các mặt hàng cần nhập
3. Chọn nhà cung cấp
4. Ghi chú phiếu nếu cần
5. Sửa trực tiếp số lượng và giá nhập từng dòng
6. Bấm `Lưu dòng` nếu có chỉnh
7. Khi đã gửi đặt hàng, bấm `Đã đặt hàng`
8. Khi hàng về thực tế, bấm `Nhập kho`
9. Khi đã thanh toán cho nhà cung cấp, bấm `Đã thanh toán`

### Ý nghĩa trạng thái phiếu nhập

- `Nháp`: đang chuẩn bị
- `Đã đặt`: đã gửi đơn cho nhà cung cấp
- `Đã nhập kho`: hàng đã về và tồn kho đã tăng
- `Đã thanh toán`: đã trả tiền
- `Đã hủy`: không tiếp tục phiếu đó nữa

## 9. Luồng quản lý nhà cung cấp

Vào menu:

```text
7. Quản lý nhà cung cấp
```

Nên lưu:

- tên nhà cung cấp
- số liên lạc
- địa chỉ
- ghi chú

### Cách dùng

1. Tạo nhà cung cấp mới
2. Khi vào phiếu nhập, chọn lại nhà cung cấp đó
3. Có thể bấm `Dùng cho phiếu nhập` để chuyển nhanh sang màn nhập hàng

## 10. Luồng báo cáo tháng

Vào menu:

```text
8. Báo cáo tháng
```

Màn này dùng để:

- xem tổng nhập / tổng xuất trong tháng
- xem xu hướng nhiều tháng gần đây
- xem mặt hàng nào biến động mạnh
- xem dự báo mặt hàng cần nhập

### Cách đọc nhanh

1. Chọn `Tháng xem chính`
2. Chọn `Số tháng gần nhất`
3. Xem 4 thẻ tổng quan ở trên
4. Xem `Xu hướng tháng`
5. Xem `Dự báo nhập`
6. Xem `Chi tiết tháng`

### Ý nghĩa phần dự báo

Dự báo nhập dựa trên:

- tồn hiện tại
- ngưỡng sắp hết
- lượng xuất trung bình gần đây
- đơn hàng nháp đang chờ
- phiếu nhập draft / ordered đang mở

## 11. Các tình huống thường gặp

### Khách gọi đặt hàng nhưng chưa chốt ngay

Làm như sau:

1. Vào `Tạo đơn xuất hàng`
2. Mở giỏ cho khách
3. Chọn hàng trước
4. Chưa cần chốt

Giỏ sẽ nằm ở trạng thái chờ để mở lại sau.

### Thiếu hàng khi đang chốt đơn

Ứng dụng sẽ báo thiếu.

Khi đó:

- nếu chỉ cần sửa lại số tồn: sang `Kiểm tra tồn kho`
- nếu thực sự thiếu hàng: sang `Quản lý nhập hàng`

### Muốn xem lại đơn cũ đã xong

Vào `Quản lý đơn hàng` rồi bật:

```text
Hiện đơn đã xong
```

### Muốn xem lại phiếu nhập đã thanh toán

Vào `Quản lý nhập hàng` rồi bật:

```text
Hiện phiếu đã thanh toán
```

## 12. Lưu ý sử dụng chung nhiều máy

- Tất cả thiết bị phải mở cùng một địa chỉ app/server
- Không nên có nhiều máy cùng sửa đúng một đơn hoặc một phiếu nhập tại cùng một thời điểm
- Nên có một người chính thao tác nhập kho và một người chính thao tác chốt đơn để tránh đè dữ liệu

## 13. Quy trình đề xuất cho cửa hàng nhỏ

### Đầu ngày

1. Vào `Kiểm tra tồn kho`
2. Xem hàng sắp hết
3. Vào `Quản lý nhập hàng` nếu cần đặt thêm

### Trong ngày

1. Tạo đơn cho khách ở `Tạo đơn xuất hàng`
2. Theo dõi đơn ở `Quản lý đơn hàng`
3. Cập nhật thanh toán khi khách đã trả tiền

### Cuối ngày

1. Kiểm tra lại `Lịch sử gần đây`
2. Xem `Báo cáo tháng`
3. Ghi nhận mặt hàng bán mạnh để chuẩn bị nhập tiếp
