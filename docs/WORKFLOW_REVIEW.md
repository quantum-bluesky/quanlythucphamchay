# Phân tích Workflow Nghiệp Vụ

Tài liệu này tổng hợp những điểm đang ổn, những khoảng trống còn lại và hướng cải tiến workflow để giảm sai sót khi nhập hàng, xuất hàng, thanh toán và chỉnh sai sót.

## 1. Những điểm hiện tại đã đúng hướng

- Tồn kho của user thường không còn cho chỉnh tay trực tiếp; luồng chính đi qua `đơn xuất` hoặc `phiếu nhập`
- Dữ liệu nghiệp vụ chính đã lưu tập trung trên server SQLite, dùng chung nhiều máy
- Có tách `giá nhập` và `giá bán mặc định`
- Có phân biệt trạng thái:
  - đơn hàng: `draft`, `completed`, `cancelled`, `paid`
  - phiếu nhập: `draft`, `ordered`, `received`, `paid`, `cancelled`
- Có `Master Admin` để xử lý các tác vụ hệ thống đặc biệt
- Có `soft delete` và khôi phục cho sản phẩm, khách hàng, nhà cung cấp

## 2. Các rủi ro workflow còn lại

### 2.1 Sau khi đã chốt hoặc nhập kho, dữ liệu vẫn có thể bị chỉnh theo cách chưa đủ chặt

Hiện tại app đã giảm nhiều thao tác sai, nhưng về mặt quy tắc nghiệp vụ vẫn còn thiếu lớp “khóa chứng từ” rõ ràng cho:

- đơn hàng đã chốt
- phiếu nhập đã nhập kho
- chứng từ đã thanh toán

Rủi ro:

- người dùng có thể hiểu nhầm là chứng từ cũ vẫn nên sửa trực tiếp
- việc sửa sai sót sau khi đã chốt chưa có luồng “điều chỉnh” riêng, nên khó audit

### 2.2 Chưa có chứng từ điều chỉnh riêng

Khi nhập sai hoặc xuất sai, app hiện thiên về:

- mở lại giỏ nháp
- tạo phiếu nhập bổ sung
- hoặc với admin thì chỉnh tồn trực tiếp

Thiếu:

- phiếu điều chỉnh tăng/giảm tồn
- phiếu trả hàng từ khách
- phiếu trả hàng cho nhà cung cấp
- ghi nhận lý do điều chỉnh có cấu trúc

Rủi ro:

- lịch sử có thể đúng về số lượng cuối cùng nhưng khó truy vết vì sao thay đổi

### 2.3 Thanh toán mới ở mức một cờ trạng thái

Hiện tại:

- đơn hàng: `paymentStatus = paid/unpaid`
- phiếu nhập: trạng thái có `paid`

Thiếu:

- thanh toán một phần
- ngày giờ và người xác nhận thanh toán theo chuẩn thống nhất
- số tiền thanh toán thực tế nếu khác tổng chứng từ

Rủi ro:

- khó đối chiếu nợ phải thu / phải trả nếu vận hành lớn hơn

### 2.4 Chưa có chống ghi đè đồng thời ở mức chứng từ

Issue `#2` đã được cải thiện bằng auto refresh nhiều máy, nhưng xung đột chỉnh cùng một `draft cart` hoặc `draft purchase` vẫn chưa được khóa theo kiểu version/conflict rõ ràng.

Rủi ro:

- 2 máy cùng mở đúng một giỏ nháp hoặc phiếu nháp vẫn có thể ghi đè nhau theo kiểu “lần lưu sau thắng”

### 2.5 Xóa và chỉnh sửa lịch sử vẫn cần siết quy tắc hơn nữa nếu quy mô tăng

Với cửa hàng nhỏ, hành vi hiện tại còn chấp nhận được. Nhưng nếu tăng số người dùng hoặc muốn audit chặt, cần chuyển dần từ:

- “xóa / sửa trực tiếp”

sang:

- “khóa chứng từ”
- “điều chỉnh bằng chứng từ mới”

## 3. Workflow rule đề xuất

## 3.1 Đơn hàng xuất

Luồng nên là:

```text
draft -> completed -> paid
draft -> cancelled
```

Quy tắc:

- chỉ `draft` mới được sửa mặt hàng, số lượng, giá
- `completed` không sửa trực tiếp nữa
- `paid` chỉ là xác nhận thanh toán của đơn đã `completed`
- nếu đã `completed` nhưng phát hiện sai:
  - không sửa ngược đơn cũ
  - tạo `phiếu điều chỉnh` hoặc `phiếu trả hàng`

## 3.2 Phiếu nhập

Luồng nên là:

```text
draft -> ordered -> received -> paid
draft -> cancelled
ordered -> cancelled
```

Quy tắc:

- chỉ `draft` và `ordered` mới được sửa dòng hàng
- chỉ `received` mới được phép chuyển sang `paid`
- `received` không nên sửa trực tiếp số lượng/giá nữa
- nếu nhập sai sau khi đã `received`:
  - tạo `phiếu điều chỉnh nhập`
  - hoặc `phiếu trả NCC`

## 3.3 Tồn kho

Quy tắc nên là:

- user thường không được chỉnh trực tiếp
- `Master Admin` vẫn có thể chỉnh trực tiếp, nhưng:
  - phải có cảnh báo rõ
  - nên bắt buộc nhập lý do điều chỉnh
  - nên được ghi thành một loại transaction riêng: `adjustment`

## 3.4 Xóa dữ liệu

Quy tắc nên là:

- chỉ xóa cứng các `draft` rỗng hoặc bản ghi tạo nhầm
- chứng từ đã xử lý nên:
  - không xóa cứng
  - chỉ `ẩn` hoặc `archive`

## 4. Cách sửa sai mà vẫn giữ đúng workflow

## 4.1 Nếu đơn xuất đã chốt nhưng sai số lượng

Không sửa trực tiếp đơn cũ.

Nên dùng một trong các cách:

- tạo `phiếu trả hàng` nếu khách trả lại
- tạo `phiếu điều chỉnh xuất` nếu ghi nhận thiếu/thừa nội bộ

## 4.2 Nếu phiếu nhập đã nhập kho nhưng sai số lượng

Không sửa trực tiếp phiếu nhập cũ.

Nên dùng:

- `phiếu điều chỉnh nhập`
- hoặc `phiếu trả NCC`

## 4.3 Nếu sai giá mặc định của sản phẩm

Được phép cập nhật `giá chung`, nhưng:

- chỉ ảnh hưởng chứng từ mới về sau
- không được làm thay đổi ngược chứng từ lịch sử đã chốt

## 4.4 Nếu cần sửa tồn gấp

Chỉ `Master Admin` dùng chỉnh tồn trực tiếp.

Đề xuất:

- bắt buộc nhập `lý do`
- log rõ:
  - ai chỉnh
  - lúc nào chỉnh
  - trước và sau khi chỉnh

## 5. Các cải tiến nên làm theo pha

## Pha A: Siết rule tối thiểu

- chỉ cho `paid` phiếu nhập sau khi đã `received`
- chặn sửa trực tiếp chứng từ sau khi đã `completed/received`
- thêm lý do bắt buộc khi admin chỉnh tồn trực tiếp

## Pha B: Tạo chứng từ điều chỉnh

- `phiếu điều chỉnh tồn`
- `phiếu trả hàng khách`
- `phiếu trả NCC`

## Pha C: Chống ghi đè đồng thời

- thêm `version` hoặc `updatedAt` check trước khi lưu `draft`
- nếu dữ liệu đã đổi từ máy khác, báo conflict rõ cho user

## Pha D: Audit chặt hơn

- log ai thao tác chứng từ nào
- log thay đổi trạng thái
- log thay đổi giá chung
- lọc lịch sử theo người thao tác / khoảng thời gian

## 6. Kết luận

Với trạng thái hiện tại, app đã đủ tốt cho vận hành cửa hàng nhỏ và đã giảm nhiều sai sót thao tác so với giai đoạn đầu.

Tuy nhiên, để tiến lên workflow chặt hơn và ít rủi ro hơn, 3 hướng nên ưu tiên tiếp theo là:

1. khóa chứng từ sau khi hoàn tất
2. thêm chứng từ điều chỉnh thay vì sửa ngược lịch sử
3. thêm kiểm tra xung đột khi nhiều máy cùng sửa một bản nháp

Đây là 3 hạng mục có tác động workflow lớn nhất và đáng làm tiếp sau các lỗi runtime / đồng bộ hiện tại.
