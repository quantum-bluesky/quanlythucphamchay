# Hướng Dẫn Sử Dụng Theo Luồng Nghiệp Vụ

Tài liệu này dành cho người trực tiếp dùng ứng dụng hằng ngày.

Nếu gặp các trạng thái hoặc thuật ngữ tiếng Anh như `draft`, `ordered`, `received`, `paid`, xem thêm bảng tra cứu tại [docs/TERM_GLOSSARY.md](/D:/Quan/quanlythucphamchay/docs/TERM_GLOSSARY.md).

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
- Có thể bấm nút `?` ở góc màn hình để xem hướng dẫn nhanh đúng theo màn hiện tại
- Có thể bấm `Version` ở đầu ứng dụng để mở màn `About` và kiểm tra phiên bản app đang chạy
- Trên điện thoại, nếu cần xem danh sách dài thì dùng `Thu gọn` hoặc nút chuyển trang `Trước / Sau`
- Trên điện thoại, menu nổi, tìm kiếm nhanh và cụm nút điều hướng sẽ tự thu vào mép màn hình khi bạn chạm ra ngoài; chạm lại vào phần mép còn lộ ra để mở đúng cụm cần dùng
- Trên PC/tablet, menu nghiệp vụ mặc định ở dạng gọn; hover hoặc bấm `Mở menu` để bung ra nhanh, rồi rê chuột hoặc bấm ra ngoài để menu tự thu lại
- Nếu có máy khác vừa cập nhật dữ liệu, app sẽ tự nạp lại khi bạn không còn gõ dở ở ô nhập hiện tại
- Khi đổi màn hình bằng menu, app vẫn giữ lịch sử `Quay lại / Tiến tới`, nên có thể nhảy qua lại giữa các màn đang xử lý mà không cần tìm lại từ đầu
- Ô `Tìm kiếm nhanh` nổi sẽ tự bám theo màn hiện tại; khi đổi màn, app sẽ tự nối lại đúng ô tìm kiếm của màn đó

## 2.1. Viết tắt màn hình

- `SP`: Sản phẩm
- `NH`: Nhập hàng
- `AD`: Admin
- `KP`: Khôi phục
- `XH`: Xuất hàng
- `TK`: Tồn kho
- `ĐH`: Đơn hàng
- `NCC`: Nhà cung cấp
- `KH`: Khách hàng

## 3. Luồng làm việc hằng ngày

### Luồng A: Kiểm tra tồn kho đầu ngày

Vào menu:

```text
1. Kiểm tra tồn kho
```

Thực hiện:

1. Gõ tên sản phẩm để tìm nhanh
2. Dùng dropdown `Sắp xếp` trong khung phân trang để đổi thứ tự theo `Tên A-Z`, `Tồn cao`, `Giá trị tồn`, `Ưu tiên nhập/xử lý` hoặc `Hạn còn ít`
3. Xem các mặt hàng có nhãn `Sắp hết`, `Sắp xuất hết`, `Sắp nhập về` hoặc `Không còn`
4. Nếu card có badge `Chờ xuất` hoặc `Chờ nhập`, badge sẽ hiện theo dạng `số phiếu / tổng số lượng` đang chờ cho đúng mặt hàng; bấm trực tiếp vào badge để sang đúng màn liên quan
5. Nếu cần xử lý một mặt hàng:
   - bấm `Xuất` để sang đơn chờ xuất hoặc tạo luồng xuất mới
   - bấm `Nhập` để sang phiếu nhập chờ hoặc tạo phiếu nhập mới

Lưu ý:

- user thường không chỉnh tăng/giảm tồn trực tiếp ở màn này nữa
- chỉ `Master Admin` mới có chế độ chỉnh tồn trực tiếp và sẽ thấy cảnh báo rõ khi dùng
- khi `Master Admin` chỉnh tồn trực tiếp, bắt buộc phải nhập lý do để lưu vào lịch sử và audit
- sort `Ưu tiên nhập/xử lý` dùng sức bán đã chuẩn hóa theo ngưỡng tồn và mức thiếu hàng, không so sánh thô theo số lượng tuyệt đối giữa các sản phẩm
- sort `Hạn còn ít` là ước tính theo sản phẩm từ lần nhập gần nhất, chưa phải hạn chính xác theo từng lô nhập
- nếu máy khác vừa nhập hoặc xuất hàng, trạng thái tồn kho sẽ tự cập nhật lại khi màn hình đang rảnh

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
4. Nút `...` trên card sản phẩm luôn hiện để bung / thu gọn detail

Lưu ý:

- nếu máy khác vừa nhập thêm hàng hoặc đổi giá nhập mặc định, danh sách chọn hàng sẽ tự cập nhật mà không cần refresh tay

Khi chọn, sản phẩm sẽ xuất hiện ở `Giỏ hiện hành`.

Các mặt hàng đã chọn sẽ được gom vào khối `Giỏ hiện hành` bên trên và mặc định ẩn khỏi danh sách phía dưới để tránh sót dòng đã chọn.

Nếu đang cần thao tác ngay trên card sản phẩm ở danh sách phía dưới, bấm `...` trên đúng dòng đang sửa; app sẽ giữ lại card đó thay vì tự ẩn mất.

### Bước 3: Sửa số lượng và giá bán

Trong `Giỏ hiện hành`:

1. Mỗi mặt hàng đã chọn hiển thị dưới dạng card gọn 2 dòng
2. Bấm `...` trên card để mở detail chỉnh sửa
3. Gõ trực tiếp số lượng
4. Gõ giá bán cho khách
5. Bấm `Lưu dòng`
6. Nếu muốn đổi luôn `giá bán mặc định` của sản phẩm cho các đơn sau, bấm `Giá chung` và xác nhận
7. Nếu không cần dòng hàng đó nữa, bấm `Bỏ khỏi giỏ`

### Bước 4: Chốt đơn

Bấm:

```text
Chốt xuất kho
```

Trước khi đổi trạng thái sang đơn đã xong, app sẽ hiện message confirm để tránh xuất nhầm.

Nếu đủ hàng:

- hệ thống trừ kho
- đơn chuyển sang trạng thái đã xong
- có thể in / gửi danh sách cho khách

Nếu thiếu hàng:

- với user thường, hệ thống sẽ chuyển sang `Quản lý nhập hàng` để tạo phiếu nhập dự kiến
- với `Master Admin`, hệ thống mới cho phép chọn sang màn tồn kho để chỉnh trực tiếp nếu thực sự cần
- nếu cần đối chiếu nhanh metadata phiếu xuất hiện hành, bấm `Detail` trong khối `Giỏ hiện hành`

## 5. Luồng xem lại và hoàn tất đơn hàng

Vào menu:

```text
3. Quản lý đơn hàng
```

Dùng màn này để:

- mở lại giỏ hàng đang chờ
- xuất nhanh giỏ nháp ra đơn
- in lại đơn
- đánh dấu `Đã thanh toán`
- hủy đơn
- xóa giỏ nháp tạo nhầm

### Khi nào dùng từng nút

- `Tiếp tục bán`: mở lại giỏ hàng nháp để sửa tiếp
- `Xuất`: chốt nhanh giỏ nháp thành đơn mà không cần mở lại giỏ; trên mobile mở `Detail` để hiện cụm action của card
- `Detail`: bung nhanh mã đơn, trạng thái, ngày tạo, mốc xử lý và danh sách dòng hàng của phiếu
- `In`: in hoặc gửi lại danh sách hàng cho khách
- `Đã thanh toán`: đánh dấu đơn đã thu tiền
- `Hủy`: dùng khi khách không lấy nữa
- `Xóa`: chỉ áp dụng cho giỏ nháp tạo nhầm; đơn đã chốt phải giữ lại lịch sử

Lưu ý:

- đơn đã `Đã xong` sẽ không còn cho sửa trực tiếp mặt hàng, số lượng hay giá
- nếu đã chốt đơn rồi mới phát hiện sai, nên xử lý bằng luồng điều chỉnh mới thay vì sửa ngược đơn cũ
- kể cả `Master Admin` cũng không được xóa hoặc hủy ngược đơn đã chốt
- trên mobile hoặc tablet, có thể dùng `Detail` để bung rồi thu gọn nhanh nội dung phiếu ngay trong danh sách
- trước khi `Xuất`, `Đã thanh toán`, `Hủy` hoặc `Xóa`, app sẽ hiện message confirm để tránh đổi trạng thái hoặc xóa nhầm

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

1. Mở màn là thấy ngay danh sách khách hàng để tìm nhanh
2. Khi cần tạo mới, bấm `Thêm mới` để mở form
3. Điền thông tin rồi bấm `Lưu khách hàng`
4. Khi cần sửa, bấm `Sửa`; form sẽ tự mở ra với dữ liệu hiện tại
5. Khi cần mở giỏ hàng nhanh cho khách, bấm `Mở giỏ`

Khuyến nghị:

- luôn lưu số liên lạc và địa chỉ ship cho khách thường xuyên đặt hàng

## 7. Luồng quản lý sản phẩm

Vào menu:

```text
5. Quản lý sản phẩm
```

Màn này dùng để:

- thêm mặt hàng mới
- sửa tên / loại / đơn vị / giá nhập / giá bán mặc định / ngưỡng cảnh báo / hạn dùng / thời gian bảo quản
- xóa mặt hàng chưa có giao dịch
- xem lịch sử thay đổi giá/trạng thái liên quan và lọc theo người thao tác, khoảng ngày

### Cách sửa nhanh

1. Tìm sản phẩm
2. Khi cần thêm mới, bấm `Mở form` ở khối `Thêm sản phẩm`
3. Khi cần xem audit, bấm `Mở lịch sử` ở khối `Lịch sử sản phẩm`
4. Bấm `Sửa` trên đúng dòng sản phẩm cần chỉnh
5. Đổi thông tin ngay trên dòng sản phẩm
6. Đọc kỹ nhãn bên trái từng dòng để tránh nhập nhầm giữa `Giá nhập` và `Giá bán`
7. Nếu muốn sort tồn kho theo hạn còn lại, nhập `Hạn dùng` hoặc `Bảo quản` theo số ngày
8. Bấm `Lưu nhanh`
9. Ở khối `Lịch sử sản phẩm`, có thể nhập tên người thao tác hoặc chọn `Từ ngày/Đến ngày` để lọc nhanh audit gần đây

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
3. Các mặt hàng đã thêm sẽ tự ẩn khỏi danh sách gợi ý phía dưới và được gom vào phần tóm tắt `Phiếu nhập hiện hành`; bấm `...` để sổ danh sách dòng đã chọn ra nếu cần sửa nhanh
4. Chọn nhà cung cấp
5. Ghi chú phiếu nếu cần
6. Sửa trực tiếp số lượng và giá nhập từng dòng
7. Bấm `Lưu dòng` nếu có chỉnh
8. Nếu muốn đổi luôn `giá nhập mặc định` của sản phẩm cho các phiếu sau, bấm `Giá chung` và xác nhận
9. Phiếu nhập nháp chỉ được lưu thật sau khi đã có ít nhất một mặt hàng; nếu phiếu đang trống thì app chỉ giữ trạng thái mở tạm trên màn hình
10. Nếu đang gõ tên nhà cung cấp chưa có trong danh bạ, chỉ khi phiếu còn `Nháp` mới bấm được `NCC` để mở form nhà cung cấp với tên đang nhập; nếu tên đó đã tồn tại thì app sẽ mở thẳng chế độ sửa NCC
11. Lưu xong app sẽ quay lại phiếu nhập và điền sẵn NCC đó
12. Khi đã gửi đặt hàng, bấm `Đã đặt hàng`; từ lúc này phiếu vẫn còn chỉnh được nếu nhà cung cấp yêu cầu đổi số lượng hoặc giá, nhưng không còn được đổi NCC
13. Khi hàng về thực tế và phiếu đã là `Đã đặt`, bấm `Nhập kho`
14. Chỉ sau khi phiếu đã ở trạng thái `Đã nhập kho`, mới bấm `Đã thanh toán`
15. Nếu gặp phiếu cũ bị lệch trạng thái, ví dụ thực tế đã dính `Đã thanh toán` nhưng không có mốc `Nhập kho` hợp lệ hoặc ngoài màn hình lại đang hiện như `Nháp`, đó là dữ liệu lỗi; có thể bấm `Hủy phiếu` hoặc `Xóa phiếu` để dọn lỗi ngay, app sẽ không khôi phục lại thành `Nháp`
16. Khi mở detail phiếu, xem thêm khối `Ngày xử lý và mã phiếu` để đối chiếu `Ngày tạo`, `Nhập kho`, `Thanh toán` và `Cập nhật cuối`
17. Trước khi đổi trạng thái `Đã đặt hàng`, `Nhập kho`, `Đã thanh toán`, `Hủy phiếu` hoặc `Xóa phiếu`, app sẽ hiện message confirm để tránh thao tác nhầm

Nếu phiếu được tạo từ một đơn đang thiếu hàng:

- app giữ liên kết `đơn thiếu nguồn` ở phần `Detail`
- ô `Ghi chú phiếu nhập` vẫn mặc định để trống để bạn tự nhập nội dung riêng nếu cần

### Ý nghĩa trạng thái phiếu nhập

- `Nháp`: đang chuẩn bị
- `Đã đặt`: đã gửi đơn cho nhà cung cấp
- `Đã nhập kho`: hàng đã về và tồn kho đã tăng
- `Đã thanh toán`: đã trả tiền sau khi hàng đã được nhập kho
- `Đã hủy`: không tiếp tục phiếu đó nữa

Lưu ý:

- chỉ `Nháp` và `Đã đặt` mới được sửa trực tiếp dòng hàng
- chỉ `Nháp` mới được đổi nhà cung cấp; từ `Đã đặt` trở đi ô NCC và nút `NCC` sẽ bị khóa
- phiếu đã `Đã nhập kho`, `Đã thanh toán` hoặc `Đã hủy` sẽ chuyển sang chế độ chỉ xem để giữ lịch sử đúng workflow
- kể cả `Master Admin` cũng không được xóa hoặc hủy ngược các phiếu đã khóa, trừ ngoại lệ phiếu lỗi dữ liệu bị lệch marker/trạng thái nói ở trên
- các nút đổi trạng thái và xóa phiếu đều có thêm bước confirm trước khi app ghi nhận thay đổi

## Version file JS phía client

- App dùng `version` chính trong [data/system_config.json](/D:/QUAN/Program/QuanLyThucPhamChay/data/system_config.json) làm tiền tố cho cache-busting client.
- Mỗi file `.js` ở frontend có version riêng theo dạng `version-chính.N`, ví dụ `2.8.8.3`.
- Khi nội dung một file `.js` đổi trong cùng version chính, `N` của đúng file đó sẽ tự tăng thêm `1`; sau `N` lần thay đổi nội dung của cùng file trong cùng version chính, URL của file đó sẽ là `version-chính.N`.
- Nếu chỉ đổi line ending khi chuyển môi trường Windows/Unix, ví dụ `CRLF -> LF` hoặc `LF -> CRLF`, manifest vẫn giữ nguyên counter `N`.
- Khi `version` chính đổi, counter `N` của các file `.js` sẽ tự reset về `1` cho version mới.
- Khi deploy code mới, restart server để app đọc lại `system_config.json` và refresh manifest trước khi client reload trang.
- Manifest được lưu ở [data/js_asset_versions.json](/D:/QUAN/Program/QuanLyThucPhamChay/data/js_asset_versions.json).
- Vì các URL module được gắn version tự động, sau khi cập nhật code client chỉ cần reload trang bình thường, không cần `Ctrl+F5`.

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

1. Mở màn là thấy ngay danh sách nhà cung cấp để tìm nhanh
2. Khi cần tạo mới, bấm `Thêm mới` để mở form
3. Lưu nhà cung cấp rồi dùng lại trong phiếu nhập
4. Khi cần sửa, bấm `Sửa`; form sẽ tự mở ra với dữ liệu hiện tại
5. Nếu đi từ màn `NH` sang bằng nút `NCC`, app sẽ mở sẵn form theo tên đang gõ; thao tác này chỉ dùng được khi phiếu nhập còn là `Nháp`
6. Có thể bấm `Dùng cho phiếu nhập` để chuyển nhanh sang màn nhập hàng

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

## 11. Luồng điều chỉnh tồn và trả hàng (Phase B)

Khi đã chốt đơn hoặc đã nhập kho mà phát hiện sai, không sửa ngược chứng từ cũ.

Dùng 1 trong 3 loại chứng từ điều chỉnh:

- `Phiếu điều chỉnh tồn`: tăng/giảm trực tiếp theo kiểm kho thực tế, bắt buộc có lý do
- `Phiếu trả hàng khách`: khi khách trả hàng, hàng quay lại tồn kho
- `Phiếu trả NCC`: khi trả ngược hàng về nhà cung cấp, tồn kho sẽ giảm

Lưu ý:

- `Phiếu điều chỉnh tồn` nên dùng bởi `Master Admin` khi cần xử lý chênh lệch gấp
- Mỗi phiếu đều lưu thành giao dịch kho mới để giữ lịch sử và audit
- Các chứng từ cũ vẫn giữ nguyên, không bị sửa đè

### Cách tạo từng loại phiếu trên màn hình

#### Phiếu điều chỉnh tồn

1. Vào `Kiểm tra nhập xuất hàng tồn`
2. Nếu cần điều chỉnh từ đúng một mặt hàng đang thấy trên card, bấm `Phiếu DC`
3. Hoặc mở khối `Phiếu điều chỉnh tồn` và gõ tên sản phẩm bằng tay
4. Nhập số lượng tăng/giảm bằng số dương hoặc âm
5. Nhập `Lý do điều chỉnh`
6. Bấm `Thêm dòng`
7. Kiểm tra lại danh sách rồi bấm `Tạo phiếu điều chỉnh`

#### Phiếu trả hàng khách

1. Vào `Quản lý đơn hàng`
2. Nếu có đơn nguồn, tìm đơn đã chốt rồi bấm `Trả hàng`
3. App sẽ tạo sẵn danh sách dòng hàng theo đơn đó; có thể sửa số lượng trả, giá hoàn hoặc bỏ bớt dòng
4. Nếu không có đơn nguồn, mở khối `Phiếu trả hàng khách`, nhập `Khách hàng`, `Sản phẩm`, `SL trả`, `Giá hoàn` rồi bấm `Thêm dòng`
5. Bấm `Tạo phiếu trả khách`

#### Phiếu trả NCC

1. Vào `Quản lý nhập hàng`
2. Nếu có phiếu nguồn, mở phiếu đã `Đã nhập kho` hoặc `Đã thanh toán` rồi bấm `Trả NCC`
3. App sẽ tạo sẵn danh sách dòng hàng theo phiếu đó; có thể sửa số lượng trả, giá trả NCC hoặc bỏ bớt dòng
4. Nếu không có phiếu nguồn, mở khối `Phiếu trả NCC`, nhập `Nhà cung cấp`, `Sản phẩm`, `SL trả`, `Giá trả NCC` rồi bấm `Thêm dòng`
5. Bấm `Tạo phiếu trả NCC`

#### Báo cáo và audit chứng từ Phase B

1. Vào `Báo cáo`
2. Chọn `Tháng xem chính` hoặc dùng `Từ ngày` - `Đến ngày`
3. Xem các thẻ tổng hợp `Hoàn khách`, `Trả NCC`, `Điều chỉnh tồn` để biết chứng từ Phase B phát sinh trong kỳ
4. Xem `Xu hướng tháng` để đối chiếu từng tháng gần đây
5. Xem `Chi tiết tháng` để biết từng sản phẩm bị ảnh hưởng bởi trả hàng hay điều chỉnh tồn
6. Kéo xuống `Audit chứng từ` để xem mã phiếu, đối tượng, tổng SL, tổng tiền và liên kết `Đơn nguồn` / `Phiếu nguồn` nếu có
7. Dùng ô tìm kiếm ở khối `Audit chứng từ` để gõ hoặc chọn nhanh `mã phiếu` / `mã tham chiếu nguồn` cần tra cứu

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
- Ở phiên bản hiện tại, các màn chính cũng sẽ tự kiểm tra và nạp lại dữ liệu mới khi màn hình đang rảnh thao tác, nên thường không cần `F5`
- Trong lúc người dùng đang nhập dở vào ô text/number/date, app sẽ tạm hoãn tự refresh để tránh mất nội dung đang gõ
- Nếu 2 máy cùng lưu vào cùng một giỏ nháp hoặc phiếu nháp, app sẽ báo xung đột đồng bộ và tự tải lại dữ liệu mới nhất để tránh ghi đè lẫn nhau

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

## 14. Module Master Admin

Vào menu:

```text
10. Master Admin
```

Chỉ người quản trị hệ thống mới nên dùng màn này.

Từ phiên bản này, màn `Master Admin` cũng là nơi login hệ thống:

- `user` thường: dùng các màn nghiệp vụ chung
- `Master Admin`: có thêm phần quản trị master data, backup/restore và chỉnh tồn trực tiếp
- nếu `EnableLogin = true` trong `system_config.json`, người dùng phải login thì mới dùng được app

Màn này có 2 nhóm chức năng:

- export / import file master:
  - mặt hàng
  - khách hàng
  - nhà cung cấp
  - định dạng hỗ trợ: `JSON` hoặc `CSV`
- backup / restore database toàn hệ thống
- trạng thái phiên: nút `Login` / `Logout` nằm ở thanh header nổi; khi đã login sẽ hiện tên user bên cạnh

Lưu ý timeout phiên:

- `session_timeout_minutes`: timeout chung cho user thường
- `admin_session_timeout_minutes`: timeout riêng cho tài khoản admin
- khi đủ timeout, app sẽ hiện hộp thoại nhắc logout
- chọn `OK`: logout ngay
- chọn `Cancel`: vẫn giữ phiên hiện tại và hẹn nhắc lại sau đúng chu kỳ timeout tương ứng

Lưu ý cấu hình phân trang trong `system_config.json`:

- `pagination.items_per_page`: base cho các list item/card như mặt hàng, khách hàng, nhà cung cấp
- `pagination.documents_per_page`: base cho các list phiếu/đơn/chứng từ
- khi mở app, hệ thống tự scale từ base này theo thiết bị:
  - `Mobile`: mặc định giữ base config, chuẩn là `10`
  - `Tablet`: mặc định scale lên mức chuẩn `25`
  - `PC`: mặc định scale lên mức chuẩn `100`
- trên `PC/Tablet`, thanh phân trang có combobox `25/50/100` để đổi nhanh số mục hiển thị trên mỗi trang
- mobile không hiện combobox này, vẫn giữ phân trang gọn theo màn hình nhỏ

### Khi nào dùng export / import master

- chuyển danh mục sang máy khác
- chuẩn hóa lại danh sách mặt hàng / khách hàng / nhà cung cấp
- nhập dữ liệu chuẩn bị sẵn từ file `JSON` hoặc `CSV`

### Khi nào dùng backup / restore

- backup trước khi chỉnh sửa lớn
- backup định kỳ để lưu trữ
- restore khi cần quay lại một trạng thái hệ thống cũ

### Cảnh báo

- `Restore DB` sẽ ghi đè toàn bộ dữ liệu hiện tại
- luôn backup trước khi restore
- chỉ dùng file backup đúng của hệ thống này
