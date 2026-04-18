# Bảng Thuật Ngữ Anh - Việt

Tài liệu này dùng để map các thuật ngữ tiếng Anh đang xuất hiện trong tài liệu, test case, log, API hoặc một phần UI sang tiếng Việt dễ hiểu hơn.

Mục tiêu:

- giúp người dùng đọc tài liệu thống nhất
- tránh hiểu sai các trạng thái nghiệp vụ
- làm chuẩn tham chiếu khi cập nhật thêm tài liệu mới

Lưu ý:

- khi thêm thuật ngữ tiếng Anh mới vào tài liệu hoặc test, cần cập nhật luôn file này
- ưu tiên giữ nghĩa theo đúng ngữ cảnh nghiệp vụ của app này, không dịch quá sát theo nghĩa từ điển nếu làm lệch workflow

## 1. Trạng thái nghiệp vụ chính

| STT | Thuật ngữ tiếng Anh | Tiếng Việt đề xuất | Ghi chú ngữ cảnh |
| --- | --- | --- | --- |
| 1 | `draft` | nháp / đang chờ xử lý | Trạng thái chưa chốt, còn sửa được |
| 2 | `ordered` | đã đặt hàng | Phiếu nhập đã gửi đặt NCC nhưng chưa nhập kho |
| 3 | `received` | đã nhập kho / đã nhận hàng | Hàng đã vào kho |
| 4 | `paid` | đã thanh toán | Đã trả tiền xong |
| 5 | `unpaid` | chưa thanh toán | Chưa trả tiền |
| 6 | `completed` | đã xong / đã chốt | Đơn bán đã chốt xong |
| 7 | `cancelled` | đã hủy | Chứng từ hoặc đơn đã hủy |
| 8 | `active` | đang hoạt động | Đang dùng, còn hiệu lực |
| 9 | `deleted` | đã xóa | Thường là xóa mềm trong app |
| 10 | `restored` | đã khôi phục | Khôi phục từ trạng thái đã xóa |

## 2. Thuật ngữ chứng từ và tồn kho

| STT | Thuật ngữ tiếng Anh | Tiếng Việt đề xuất | Ghi chú ngữ cảnh |
| --- | --- | --- | --- |
| 1 | `inventory adjustment` | điều chỉnh tồn kho | Tạo phiếu tăng/giảm tồn mới, không sửa ngược chứng từ cũ |
| 2 | `adjustment` | điều chỉnh | Dùng chung cho thao tác điều chỉnh |
| 3 | `customer return` | trả hàng khách / hàng khách trả | Hàng khách trả lại, tồn kho tăng |
| 4 | `supplier return` | trả nhà cung cấp / trả NCC | Trả hàng ngược về NCC, tồn kho giảm |
| 5 | `receipt` | phiếu / chứng từ | Tùy ngữ cảnh có thể là phiếu nhập hoặc phiếu điều chỉnh |
| 6 | `purchase receipt` | phiếu nhập hàng | Phiếu nhập từ NCC |
| 7 | `order` | đơn hàng | Đơn bán cho khách |
| 8 | `checkout` | chốt đơn | Hoàn tất đơn bán và xuất kho |
| 9 | `stock` | tồn kho | Số lượng còn trong kho |
| 10 | `incoming` | đang chờ nhập | Hàng sắp vào kho |
| 11 | `outgoing` | đang chờ xuất | Hàng sắp xuất cho khách |

## 3. Thuật ngữ dữ liệu, hệ thống và quản trị

| STT | Thuật ngữ tiếng Anh | Tiếng Việt đề xuất | Ghi chú ngữ cảnh |
| --- | --- | --- | --- |
| 1 | `history` | lịch sử | Lịch sử thao tác hoặc lịch sử chứng từ |
| 2 | `audit` | audit / nhật ký truy vết | Ghi nhận để tra cứu ai làm gì |
| 3 | `actor` | người thao tác | Người thực hiện thay đổi |
| 4 | `sync` | đồng bộ | Đồng bộ dữ liệu giữa nhiều máy |
| 5 | `sync state` | trạng thái đồng bộ | Dữ liệu app đang chia sẻ qua server |
| 6 | `conflict` | xung đột | Hai nơi cùng sửa, không thể ghi đè trực tiếp |
| 7 | `backup` | sao lưu | Tạo bản sao database |
| 8 | `restore` | phục hồi | Khôi phục từ file backup |
| 9 | `import` | nhập file | Nạp dữ liệu từ file vào hệ thống |
| 10 | `export` | xuất file | Xuất dữ liệu từ hệ thống ra file |
| 11 | `runtime` | lúc đang chạy | Cấu hình hoặc trạng thái dùng khi app đang chạy |
| 12 | `fixture` | dữ liệu mẫu test | Dữ liệu tạm cho test, không phải dữ liệu thật |

## 4. Thuật ngữ test và kỹ thuật hay gặp trong tài liệu

| STT | Thuật ngữ tiếng Anh | Tiếng Việt đề xuất | Ghi chú ngữ cảnh |
| --- | --- | --- | --- |
| 1 | `unit test` | kiểm thử đơn vị | Test logic backend nhỏ |
| 2 | `integration test` | kiểm thử tích hợp | Test xuyên UI + API + DB |
| 3 | `acceptance` | kiểm thử nghiệm thu | Bám checklist bàn giao |
| 4 | `regression` | kiểm thử hồi quy | Đảm bảo lỗi cũ không quay lại |
| 5 | `spec` | file test / đặc tả test | Thường là file `.spec.js` |
| 6 | `case code` | mã test case | Ví dụ `ACC-PHB-04` |

## 5. Gợi ý cách đọc nhanh trạng thái

- `draft -> ordered -> received -> paid`
  Nghĩa là: `nháp -> đã đặt hàng -> đã nhập kho -> đã thanh toán`

- `draft -> completed -> paid`
  Nghĩa là: `nháp -> đã chốt đơn -> đã thanh toán`

- `cancelled`
  Nghĩa là: chứng từ hoặc đơn đã bị hủy, không tiếp tục workflow đó nữa
