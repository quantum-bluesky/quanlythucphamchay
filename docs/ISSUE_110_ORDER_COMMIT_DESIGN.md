# Issue 110 - Thiết Kế Trạng Thái `Chốt đơn` Cho Đơn Xuất

Nguồn gốc:

- Task: `No. 110`
- Phạm vi tài liệu này là `design + checklist`, chưa phản ánh là app runtime đã triển khai.

Tài liệu prototype để confirm trước khi code:

- [ISSUE_110_ORDER_COMMIT_PROTOTYPE.md](ISSUE_110_ORDER_COMMIT_PROTOTYPE.md)
- [Mockup HTML tĩnh](/D:/QUAN/Program/QuanLyThucPhamChay/docs/assets/issue-110-order-commit-prototype.html)

## 1. Tóm tắt yêu cầu

Đơn xuất cần tách thêm trạng thái trung gian `Chốt đơn`:

- `Chốt đơn` nằm sau trạng thái `chờ/nháp` và trước `xuất hàng`
- từ lúc `Chốt đơn`:
  - không đổi được khách hàng
  - không xóa được phiếu
  - vẫn hủy đơn được
  - có thể in phiếu
- đổi tên trạng thái đang hiểu là `chốt xuất hàng` thành `đã xuất hàng`
- khi `Xuất hàng` không tự động in nữa
- vẫn cho tạo phiếu mới cho cùng khách nếu khách đó không còn phiếu `nháp`
- được phép có nhiều phiếu `Chốt đơn` cho cùng một khách
- nếu tạo phiếu mới cho khách mà khách đang có đơn `Chốt đơn`, app phải cảnh báo và cho chọn `gộp đơn`
- địa chỉ gửi hàng của đơn xuất được sửa cho đến trước khi `Đã xuất hàng`

## 2. Khảo sát hiện trạng

### 2.1. Workflow hiện tại

Luồng đơn xuất đang là:

```text
draft -> completed
draft -> cancelled
completed + payment_status=paid
```

Hiện tại:

- `checkout` vừa chốt đơn vừa trừ kho ngay
- sau khi `completed`, backend khóa sửa trực tiếp mặt hàng, số lượng, giá và trạng thái
- sau khi `completed`, frontend vẫn cho sửa riêng `giảm giá khuyến mại` nếu chưa `paid`
- `checkout` đang tự mở popup in phiếu ngay sau khi thành công

### 2.2. Dữ liệu header đơn hiện tại

Bảng `carts` đang có các cột chính:

- `customer_id`
- `customer_name`
- `status`
- `payment_status`
- `discount_amount`
- `created_at`
- `updated_at`
- `completed_at`
- `cancelled_at`
- `paid_at`
- `order_code`

Hiện chưa có:

- `committed_at`
- `ship_address`
- field snapshot riêng cho thông tin giao hàng ở cấp đơn

### 2.3. Điểm lệch so với yêu cầu mới

1. App chưa có trạng thái trung gian giữa `draft` và `completed`.
2. `checkout` đang đồng thời làm 2 việc:
   - khóa đơn
   - xuất kho
3. App chưa có snapshot địa chỉ giao ở cấp đơn; địa chỉ hiện nằm ở master `customers.address`.
4. Một đơn `completed` hiện đang bị khóa gần như hoàn toàn, không phù hợp với nhu cầu:
   - còn sửa `địa chỉ giao`
   - có thể `gộp đơn`
   - có bước `xuất hàng` tách riêng
5. `openCartForCustomer()` hiện chỉ đảm bảo mỗi khách tối đa 1 `draft`, nhưng chưa có nhánh cảnh báo/gộp khi cùng khách đang có đơn `đã chốt`.

## 3. Mục tiêu thiết kế

Thiết kế mới cần đạt đồng thời:

- tách rõ `quyết định danh mục` và `xuất kho thực tế`
- giữ tương thích ngược với dữ liệu `completed` cũ
- không làm phát sinh sửa ngược lịch sử sau khi đã `Đã xuất hàng`
- giữ UX gọn trên mobile
- giảm rủi ro oversell khi có nhiều đơn đang chờ xuất

## 4. Quyết định design đề xuất

## 4.1. Mô hình trạng thái mới

Đề xuất workflow đơn xuất:

```text
draft -> committed -> completed
draft -> cancelled
committed -> cancelled

payment_status:
unpaid -> paid, chỉ cho phép khi status = completed
```

Quy ước hiển thị:

- `draft` = `Nháp`
- `committed` = `Chốt đơn`
- `completed` = `Đã xuất hàng`
- `payment_status = paid` vẫn hiển thị lớp trạng thái ngoài cùng là `Đã thanh toán`

Lý do giữ `completed` là trạng thái nội bộ cho bước cuối:

- tương thích tốt hơn với DB và test hiện tại
- giảm số lượng migration logic phải đổi sâu
- cho phép map dữ liệu legacy `completed` cũ sang đúng nghĩa mới là `Đã xuất hàng`

## 4.2. Ý nghĩa nghiệp vụ từng trạng thái

### `draft`

- là giỏ đang soạn
- được đổi khách hàng
- được thêm/xóa dòng
- được xóa hẳn nếu tạo nhầm
- chưa in phiếu chính thức
- chưa trừ kho

### `committed` (`Chốt đơn`)

- đã xác nhận danh mục hàng dự kiến gửi khách
- khóa đổi `khách hàng`
- không cho `xóa hẳn`
- vẫn cho `hủy đơn`
- cho `in phiếu`
- chưa trừ kho thực tế
- vẫn cho sửa `địa chỉ giao`
- cho phép chỉnh nội dung đơn trước khi xuất hàng, nhưng phải giữ cùng khách hàng

Lưu ý:

- nếu không cho chỉnh dòng hàng ở `committed` thì yêu cầu `gộp đơn vào đơn đã chốt` sẽ tự mâu thuẫn
- vì vậy thiết kế nên xem `committed` là trạng thái `đã chốt để chuẩn bị giao`, chưa phải trạng thái khóa tuyệt đối

### `completed` (`Đã xuất hàng`)

- là thời điểm hàng đã ra kho thực tế
- backend tạo transaction `out` ở bước này, không phải ở `committed`
- không đổi khách hàng
- không đổi địa chỉ giao
- không xóa
- không hủy trực tiếp
- nếu sai sau đó phải đi qua luồng `trả hàng khách` hoặc chứng từ điều chỉnh phù hợp
- vẫn cho in lại phiếu, nhưng không tự động bật popup in

## 4.3. Quy tắc về tồn kho và giữ hàng

Theo tiêu chuẩn nghiệp vụ hiện đại, nên tách:

- `physical stock`: tồn kho vật lý, chỉ đổi khi `Đã xuất hàng`
- `reserved stock`: số lượng đã giữ cho đơn `Chốt đơn`

Đề xuất áp dụng:

- `draft`:
  - vẫn được tính vào nhu cầu chờ xử lý của UI
  - chưa giữ hàng cứng
- `committed`:
  - được tính là `reserved`
  - làm giảm `available to commit`
- `completed`:
  - trừ kho vật lý thật
  - đồng thời giải phóng phần `reserved` tương ứng

Hệ quả:

- lúc `Chốt đơn`, app phải check tồn khả dụng sau khi trừ các đơn `committed` khác
- lúc `Xuất hàng`, app phải check lại lần cuối vì tồn vật lý có thể đã thay đổi trong lúc chờ giao

Đây là điểm quan trọng nhất để tránh oversell khi nhiều máy cùng thao tác.

## 4.4. Quy tắc đổi khách hàng và địa chỉ giao

Đề xuất rule:

- `customer_id` và `customer_name`:
  - đổi được ở `draft`
  - khóa từ `committed`
- `ship_address`:
  - mặc định lấy từ `customers.address` khi mở giỏ cho khách
  - sau đó trở thành snapshot riêng của đơn
  - sửa được ở `draft` và `committed`
  - khóa từ `completed`

Lý do cần snapshot `ship_address`:

- địa chỉ giao theo từng đơn có thể khác địa chỉ mặc định của khách
- sửa địa chỉ master khách hàng không được làm đổi ngược các đơn đã chốt hoặc đã giao
- yêu cầu mới nói rõ `cho phép thay đổi địa chỉ gửi hàng của đơn xuất cho đến khi đã xuất hàng`, nghĩa là địa chỉ phải sống ở cấp đơn chứ không chỉ ở master khách

Khuyến nghị phạm vi tối thiểu:

- thêm `ship_address`

Khuyến nghị mở rộng nếu muốn làm đúng chuẩn hơn:

- thêm `ship_contact_name`
- thêm `ship_phone`

Nhưng 2 field mở rộng này không bắt buộc cho Issue 110 nếu muốn giữ patch nhỏ.

## 4.5. Quy tắc `gộp đơn` cùng khách

Rule nghiệp vụ đề xuất:

- một khách vẫn chỉ có tối đa `1 draft`
- một khách có thể có `n committed`
- nếu user mở giỏ mới cho khách mà khách đang có đơn `committed`, app hiện dialog lựa chọn:
  - `Tạo đơn mới`
  - `Gộp vào đơn đã chốt`
  - `Mở xem đơn đã chốt`

Thiết kế UX đề xuất:

1. user chọn khách ở màn `Tạo đơn xuất hàng`
2. nếu khách có `draft`, mở lại `draft` như logic hiện tại
3. nếu không có `draft` nhưng có `committed`, hiện modal liệt kê:
   - `mã đơn`
   - `ngày chốt`
   - `tổng dòng`
   - `cần thanh toán`
4. nếu chọn `gộp`, app mở đúng đơn `committed` đó ở chế độ chỉnh trước xuất hàng
5. hàng mới được thêm vào chính đơn đó, không tạo thêm `draft` thứ hai

Lý do không nên tự gộp thẳng:

- một khách có thể có nhiều đơn đã chốt cho các chuyến giao khác nhau
- hệ thống phải để user chọn đúng đơn cần gộp

## 4.6. Quy tắc in phiếu

Đề xuất:

- `draft`: không xem là bản in chính thức
- `committed`: được bấm `In phiếu`
- `completed`: vẫn được bấm `In lại`
- `checkout/ship` không tự động in

Tức là cần thay đổi từ mô hình hiện tại:

- `checkout -> refresh -> auto print`

sang:

- `commit -> refresh`
- `ship -> refresh`
- in là hành động thủ công, chủ động

Lý do:

- tránh popup in tự bật khi user chỉ muốn đổi trạng thái
- phù hợp hơn với thao tác trên mobile/tablet và khi dùng nhiều máy

## 4.7. Tương thích ngược dữ liệu cũ

Đề xuất migration mềm:

- thêm cột `committed_at TEXT NULL`
- thêm cột `ship_address TEXT NOT NULL DEFAULT ''`

Rule backfill:

- đơn cũ `status = completed`:
  - tiếp tục coi là `Đã xuất hàng`
  - `committed_at` có thể để `NULL` hoặc backfill bằng `completed_at`
- đơn `draft` và `cancelled` cũ:
  - không cần backfill đặc biệt
- `ship_address`:
  - đơn cũ để rỗng hoặc copy từ master customer nếu có thể match chắc chắn
  - không nên cố suy đoán mạnh nếu dữ liệu lịch sử không đủ

Để giữ backward compatibility cho sync payload:

- client cũ gửi thiếu `committedAt` hoặc `shipAddress` vẫn không làm hỏng save
- server normalize mặc định:
  - `committedAt = null`
  - `shipAddress = ''`

## 4.8. Đề xuất API và backend

Thiết kế nên tách rõ action:

- `POST /api/orders/commit`
- `POST /api/orders/ship`

Không nên tiếp tục dồn tất cả vào `checkout`, vì:

- semantics cũ của `checkout` là `trừ kho + in`
- semantics mới cần 2 bước riêng

Rule backend đề xuất:

- `commit`:
  - validate khách hàng
  - validate item
  - validate khả dụng sau khi trừ reserved của đơn `committed` khác
  - set `status = committed`
  - set `committed_at`
  - chưa ghi transaction `out`
- `ship`:
  - chỉ nhận đơn `committed`
  - re-check tồn vật lý thực tế
  - ghi transaction `out`
  - set `status = completed`
  - set `completed_at`
- `paid`:
  - chỉ cho phép khi `status = completed`

Rule khóa dữ liệu đề xuất:

- `draft`: cho sửa toàn bộ
- `committed`: khóa `customerId/customerName`, cho sửa `shipAddress`, items, discount
- `completed`: khóa items, customer, shipAddress; nếu sai phải qua chứng từ khác
- `cancelled`: khóa như hiện tại

## 4.9. Đề xuất UI theo màn

### `create-order`

- button chính của giỏ:
  - `draft` -> `Chốt đơn`
  - `committed` -> `Xuất hàng`
- thêm field `Địa chỉ giao`
- status pill cần có `Nháp` / `Chốt đơn`
- có nút `In phiếu` từ `committed`

### `orders`

- đổi label hiển thị:
  - `Đã xong` -> `Đã xuất hàng`
- thêm badge/trạng thái `Chốt đơn`
- cho filter riêng ít nhất:
  - `Hiện đơn đã chốt`
  - `Hiện đơn đã xuất`
  - `Hiện đơn đã hủy`
- đơn `committed` phải có action:
  - `Mở sửa`
  - `Xuất hàng`
  - `In`
  - `Hủy`

### `customers`

- badge `đơn` vẫn gom cả:
  - `committed`
  - `completed`
  - `paid`
- nếu khách có nhiều đơn `committed`, điều hướng sang `orders` phải để user chọn chứ không tự mở nhầm đơn

### `inventory`

- badge `Chờ xuất` nên tính ít nhất cả `draft + committed`
- khuyến nghị hiện breakdown trong detail:
  - `nháp`
  - `đã chốt chờ xuất`

## 5. Open Questions Cần Chốt Trước Khi Code

1. `Chốt đơn` có cho sửa item trực tiếp hay chỉ cho gộp?
   - khuyến nghị: cho sửa item trước `Đã xuất hàng`, vì nếu không thì flow `gộp đơn` sẽ rất gượng
2. `Đã thanh toán` có bắt buộc sau `Đã xuất hàng` như hiện tại không?
   - khuyến nghị: giữ nguyên, không cho thanh toán khi mới `Chốt đơn`
3. `Hủy đơn` ở `committed` có cần hoàn giải phóng reserved stock ngay không?
   - khuyến nghị: có
4. `Chốt đơn` có cần sinh mã đơn ngay không?
   - khuyến nghị: có, để in phiếu và chọn gộp dễ hơn
5. đơn `draft` hiện có auto-sync nhiều máy; khi chuyển `committed` có cần chống stale mạnh hơn không?
   - khuyến nghị: có, vẫn dùng `expected_updated_at` như hiện tại và tăng kiểm tra server-side ở bước `commit`/`ship`

## 6. Checklist Thiết Kế Và Triển Khai

## 6.1. Checklist business rule

- [ ] Xác nhận luồng cuối cùng là `draft -> committed -> completed`
- [ ] Xác nhận `completed` hiển thị là `Đã xuất hàng`
- [ ] Xác nhận `paid` chỉ được sau `Đã xuất hàng`
- [ ] Xác nhận `committed` vẫn cho `hủy`, không cho `xóa`
- [ ] Xác nhận `committed` khóa khách hàng nhưng vẫn cho sửa địa chỉ giao
- [ ] Xác nhận `committed` có cho sửa items trực tiếp trước `Đã xuất hàng`
- [ ] Xác nhận quy tắc gộp đơn cùng khách khi có nhiều đơn `committed`

## 6.2. Checklist schema và migration

- [ ] Thêm `committed_at` vào bảng `carts`
- [ ] Thêm `ship_address` vào bảng `carts`
- [ ] Update serializer/load/save sync state cho 2 field mới
- [ ] Backward compatible với DB cũ không có cột mới
- [ ] Backward compatible với payload client cũ thiếu field mới
- [ ] Xác nhận cách hiển thị đơn legacy `completed` cũ

## 6.3. Checklist backend

- [ ] Tách action `commit` và `ship`
- [ ] `commit` không ghi transaction `out`
- [ ] `ship` mới ghi transaction `out`
- [ ] Check tồn khả dụng ở bước `commit`
- [ ] Re-check tồn vật lý ở bước `ship`
- [ ] Sửa workflow lock cho `committed`
- [ ] Khóa customer từ `committed`
- [ ] Khóa ship address từ `completed`
- [ ] Cập nhật audit log cho `commit`, `ship`, `cancel`, `merge`, `paid`

## 6.4. Checklist frontend

- [ ] Đổi label `Đã xong` thành `Đã xuất hàng`
- [ ] Thêm status pill `Chốt đơn`
- [ ] Thêm input `Địa chỉ giao` ở đơn xuất
- [ ] Không auto-print khi `ship`
- [ ] Cho in phiếu từ `committed`
- [ ] Update confirm message cho `Chốt đơn` và `Xuất hàng`
- [ ] Update filter màn `orders`
- [ ] Update modal cảnh báo/gộp đơn cùng khách
- [ ] Update list/detail metadata để hiện `Ngày chốt` và `Ngày xuất`

## 6.5. Checklist tồn kho và báo cáo

- [ ] Tách đúng `reserved` và `physical stock` trong logic suy diễn
- [ ] Badge `Chờ xuất` không bỏ sót đơn `committed`
- [ ] Report doanh thu/giá vốn chỉ ghi nhận ở `Đã xuất hàng`, không ghi nhận ở `Chốt đơn`
- [ ] Nếu có thống kê shortage, phải tính phần reserved của đơn `committed`

## 6.6. Checklist docs

- [ ] Cập nhật `README.md` phần docs/link
- [ ] Cập nhật `docs/SCREEN_DESIGN.md` để link tài liệu detail này
- [ ] Khi code được triển khai thật, cập nhật tiếp:
  - `docs/HUONG_DAN_SU_DUNG.md`
  - `docs/BUSINESS_FLOW.md`
  - `docs/DB_DESIGN.md`
  - `docs/PHIEU_DISPLAY_DESIGN.md`
  - help trong `static/modules/screen-config.js`

## 6.7. Checklist test đề xuất

- [ ] Unit: chặn `paid` khi `draft/committed`
- [ ] Unit: `commit` không làm giảm tồn vật lý
- [ ] Unit: `ship` mới làm giảm tồn vật lý
- [ ] Unit: `committed` không đổi được customer nhưng đổi được `ship_address`
- [ ] Unit: `completed` khóa `ship_address`
- [ ] Unit: đơn `committed` hủy thì giải phóng reserved
- [ ] Integration: commit xong không auto-print
- [ ] Integration: có thể in từ `committed`
- [ ] Integration: tạo draft mới cho khách đang có `committed` hiện modal gộp
- [ ] Integration: chọn gộp mở đúng đơn `committed` để thêm hàng
- [ ] Integration: nhiều đơn `committed` cùng khách vẫn render và filter đúng
- [ ] Regression: đơn legacy `completed` cũ vẫn xem/in/paid được như `Đã xuất hàng`

## 7. Kết luận

Issue 110 không phải đổi label đơn thuần. Đây là thay đổi workflow lõi của `sales order`.

Nếu làm đúng chuẩn nghiệp vụ hiện đại, cần tách ít nhất 4 lớp nghĩa:

1. `draft`: đang soạn
2. `committed`: đã chốt để chuẩn bị giao
3. `completed`: đã xuất hàng thật
4. `paid`: đã thu tiền

Điểm bắt buộc về data model là phải có snapshot `ship_address` ở cấp đơn và phải dời thao tác trừ kho từ bước `chốt` sang bước `xuất`.

Nếu muốn patch nhỏ nhưng vẫn đúng hướng, phạm vi tối thiểu nên là:

- thêm `committed`
- thêm `committed_at`
- thêm `ship_address`
- bỏ auto-print ở bước xuất
- thêm modal gộp đơn cùng khách

Các phần như `reserved stock`, breakdown badge tồn kho, hay mở rộng contact giao hàng có thể làm ngay trong cùng issue hoặc tách phase kế tiếp, nhưng không nên bỏ qua trong thiết kế vì chúng ảnh hưởng trực tiếp đến độ an toàn vận hành.
