# Issue 110 - Prototype Xác Nhận Trước Khi Implement

Mục tiêu file này:

- chốt nhanh hình thái UI/UX trước khi sửa code thật
- tách rõ phần `prototype confirm` khỏi `design triển khai`
- tránh cập nhật nhầm tài liệu vận hành khi runtime chưa đổi

Tài liệu design đầy đủ đang ở:

- [ISSUE_110_ORDER_COMMIT_DESIGN.md](ISSUE_110_ORDER_COMMIT_DESIGN.md)

Mockup tĩnh để xem nhanh:

- [docs/assets/issue-110-order-commit-prototype.html](/D:/QUAN/Program/QuanLyThucPhamChay/docs/assets/issue-110-order-commit-prototype.html)

## 1. Mục tiêu prototype

Prototype này chốt 5 điểm trước khi code:

1. trạng thái mới hiển thị ra sao
2. nút chính của mỗi trạng thái nằm ở đâu
3. phần nào còn sửa được ở `Chốt đơn`
4. flow cảnh báo `gộp đơn`
5. phần metadata nào phải có ở cấp đơn

## 2. Trạng thái prototype

Prototype chốt theo hướng:

```text
Nháp -> Chốt đơn -> Đã xuất hàng -> Đã thanh toán
Nháp -> Đã hủy
Chốt đơn -> Đã hủy
```

Map nội bộ đề xuất:

- `draft` -> `Nháp`
- `committed` -> `Chốt đơn`
- `completed` -> `Đã xuất hàng`
- `payment_status = paid` -> `Đã thanh toán`

## 3. Prototype màn `Tạo đơn xuất hàng`

### 3.1. Trạng thái `Nháp`

Hiển thị:

- pill `Nháp`
- nút chính: `Chốt đơn`
- nút phụ:
  - `Detail`
  - `In nháp`
  - `Hủy`
  - `Xóa`

Cho sửa:

- khách hàng
- địa chỉ giao
- dòng hàng
- giảm giá khuyến mại

### 3.2. Trạng thái `Chốt đơn`

Hiển thị:

- pill `Chốt đơn`
- thêm dòng metadata `Ngày chốt`
- nút chính: `Xuất hàng`
- nút phụ:
  - `In phiếu`
  - `Detail`
  - `Hủy đơn`

Cho sửa:

- địa chỉ giao
- dòng hàng
- giảm giá khuyến mại

Không cho sửa:

- khách hàng
- xóa phiếu

### 3.3. Trạng thái `Đã xuất hàng`

Hiển thị:

- pill `Đã xuất hàng`
- thêm metadata `Ngày xuất`
- nút phụ:
  - `In lại`
  - `Đã thanh toán`
  - `Trả hàng`

Không cho sửa:

- khách hàng
- địa chỉ giao
- dòng hàng
- xóa
- hủy

## 4. Prototype màn `Đơn hàng`

List card cần phân biệt rõ:

- `Nháp`
- `Chốt đơn`
- `Đã xuất hàng`
- `Đã thanh toán`
- `Đã hủy`

Khuyến nghị filter:

- `Hiện đơn nháp`
- `Hiện đơn đã chốt`
- `Hiện đơn đã xuất`
- `Hiện đơn đã thanh toán`
- `Hiện đơn đã hủy`

Action theo card:

- `Nháp`:
  - `Mở`
  - `Chốt`
  - `Hủy`
  - `Xóa`
- `Chốt đơn`:
  - `Mở sửa`
  - `Xuất hàng`
  - `In`
  - `Hủy`
- `Đã xuất hàng`:
  - `In lại`
  - `Đã thanh toán`
  - `Trả hàng`
- `Đã thanh toán`:
  - `In lại`
  - `Trả hàng`

## 5. Prototype phần `Địa chỉ giao`

Field mới ở cấp đơn:

- `Địa chỉ giao`

Hành vi prototype:

- khi mở giỏ cho khách:
  - auto copy từ `Khách hàng.address`
- sau đó đơn giữ snapshot riêng
- sửa trong đơn không làm đổi master khách hàng
- sửa địa chỉ master khách hàng không làm đổi ngược đơn đã chốt/đã xuất

Khuyến nghị hiển thị:

- ở panel đầu đơn, ngay dưới `Khách hàng`
- trong `Detail phiếu xuất`
- trong bản in phiếu từ trạng thái `Chốt đơn` trở đi

## 6. Prototype modal `Gộp đơn`

Khi user mở giỏ mới cho khách mà:

- không có `Nháp`
- có ít nhất 1 đơn `Chốt đơn`

thì hiện modal:

```text
Khách này đang có đơn đã chốt

[DH-001] 08:30 - 3 dòng - Cần thu 320.000
[DH-002] 10:15 - 2 dòng - Cần thu 180.000

[Gộp vào đơn đã chốt]
[Tạo đơn mới]
[Mở xem danh sách đơn]
```

Hành vi:

- `Gộp vào đơn đã chốt`: user chọn một đơn cụ thể, mở lại đúng đơn đó để thêm hàng
- `Tạo đơn mới`: tạo `draft` mới cho cùng khách
- `Mở xem danh sách đơn`: nhảy sang màn `Đơn hàng` đã filter theo khách

Khuyến nghị confirm:

- vẫn cho `Tạo đơn mới`
- không ép auto-gộp

## 7. Prototype bản in

Prototype chốt theo hướng:

- `Chốt đơn`: có thể `In phiếu`
- `Đã xuất hàng`: có thể `In lại`
- `Xuất hàng` không auto bật popup in

Thông tin trên phiếu in:

- mã đơn
- khách hàng
- địa chỉ giao
- trạng thái
- ngày chốt hoặc ngày xuất
- danh sách hàng
- tạm tính
- giảm giá
- cần thanh toán

## 8. Prototype tồn kho

Prototype này chốt logic nhìn thấy trên UI:

- badge `Chờ xuất` vẫn tính cả:
  - `Nháp`
  - `Chốt đơn`
- detail tồn kho nên hiện tách:
  - `Nháp: x phiếu / y SL`
  - `Đã chốt: x phiếu / y SL`

Lý do:

- giúp user phân biệt hàng mới đang soạn và hàng đã hứa giao

## 9. Điểm confirm cần user chốt

Prototype đang đề xuất mặc định:

1. `Chốt đơn` vẫn cho sửa item trực tiếp trước khi `Đã xuất hàng`
2. vẫn cho tạo `draft` mới dù đã có đơn `Chốt đơn` của cùng khách
3. `Đã thanh toán` chỉ sau `Đã xuất hàng`
4. `Xuất hàng` không auto-in
5. địa chỉ giao là snapshot riêng ở cấp đơn

## 10. Nếu confirm prototype này, phase implement nên chia như sau

### Phase 1

- schema + backend state machine
- thêm `committed_at`
- thêm `ship_address`
- bỏ auto-print

### Phase 2

- UI `create-order` + `orders`
- filter, pill, metadata, confirm message

### Phase 3

- modal `gộp đơn`
- reserved/availability check
- badge tồn kho tách `nháp` và `đã chốt`

### Phase 4

- cập nhật toàn bộ docs vận hành
- cập nhật test unit/integration/acceptance

## 11. Kết luận

Prototype này nghiêng về hướng an toàn:

- tách riêng `Chốt đơn` và `Đã xuất hàng`
- giữ quyền sửa có kiểm soát ở `Chốt đơn`
- khóa hoàn toàn sau `Đã xuất hàng`
- thêm snapshot `Địa chỉ giao`
- không làm auto-print ở action trạng thái

Nếu anh confirm đúng hướng này, tôi sẽ implement theo phase an toàn thay vì đổi toàn bộ một lượt.
