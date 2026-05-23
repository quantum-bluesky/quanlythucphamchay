# Hướng Dẫn Sử Dụng Theo Luồng Nghiệp Vụ

Tài liệu này dành cho người trực tiếp dùng ứng dụng hằng ngày.

Nếu gặp các trạng thái hoặc thuật ngữ tiếng Anh như `draft`, `ordered`, `received`, `paid`, xem thêm bảng tra cứu tại [docs/TERM_GLOSSARY.md](/D:/Quan/quanlythucphamchay/docs/TERM_GLOSSARY.md).

## 1. Mục tiêu sử dụng

Ứng dụng dùng để:

- theo dõi tồn kho
- nhập hàng
- tạo đơn xuất cho khách
- tạo nhiều đơn nhanh theo card trên điện thoại
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
- Khi bấm các action có lưu thay đổi như `Lưu`, `Chốt đơn`, `Xuất hàng`, `Nhập kho`, `Đã thanh toán`, app sẽ hiện `Loading` và khóa tạm thao tác khác tới khi trạng thái mới cập nhật xong; không cần bấm lặp lại

## 2.1. Viết tắt màn hình

- `SP`: Sản phẩm
- `NH`: Nhập hàng
- `AD`: Admin
- `KP`: Khôi phục
- `XH`: Xuất hàng
- `TK`: Tồn kho
- `ĐH`: Đơn hàng
- `XL`: Xử lý nhập thiếu
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
6. Nếu cần đối chiếu nhập/xuất mới nhất, bấm `Lịch sử` để nhảy nhanh xuống khối `Lịch sử gần đây`; khối này mặc định thu gọn nên có thể bấm `Mở lịch sử` để bung ra
7. Với các dòng lịch sử có mã `DH/PN/DC/THK/TNCC`, bấm trực tiếp vào mã để mở đúng đơn hoặc phiếu liên quan

Lưu ý:

- user thường không chỉnh tăng/giảm tồn trực tiếp ở màn này nữa
- chỉ `Master Admin` mới có chế độ chỉnh tồn trực tiếp và sẽ thấy cảnh báo rõ khi dùng
- khi `Master Admin` chỉnh tồn trực tiếp, bắt buộc phải nhập lý do để lưu vào lịch sử và audit
- sort `Ưu tiên nhập/xử lý` dùng sức bán đã chuẩn hóa theo ngưỡng tồn và mức thiếu hàng, không so sánh thô theo số lượng tuyệt đối giữa các sản phẩm
- sort `Hạn còn ít` ưu tiên theo HSD thật của từng lô còn hàng; nếu mặt hàng chưa có lô nào có HSD thì app mới fallback về ước tính từ metadata sản phẩm
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
8. Nếu có khuyến mại cho cả đơn, nhập thêm `Giảm giá khuyến mại`; app sẽ tự tính lại `Tạm tính / Giảm KM / Cần thanh toán`
9. Nếu cần gửi trước cho khách, có thể bấm `In` ngay từ lúc đơn còn `Nháp`

### Bước 4: Chốt đơn

Ở đơn nháp, bấm:

```text
Chốt đơn
```

Trước khi đổi trạng thái sang `Chốt đơn`, app sẽ hiện message confirm để tránh bấm nhầm.

Nếu đủ hàng:

- trong bước `Chốt đơn`, `đủ hàng` được hiểu là đủ từ `tồn hiện tại + số lượng đã được NCC xác nhận ở phiếu nhập Đã đặt`, sau khi trừ phần đã giữ cho các đơn đã chốt khác
- hệ thống giữ hàng logic cho đơn này nhưng chưa trừ kho thật
- đơn chuyển sang trạng thái `Chốt đơn`
- khóa khách hàng của đơn, không cho xóa phiếu
- vẫn cho sửa dòng hàng, địa chỉ giao và `Giảm giá khuyến mại` cho tới trước khi xuất hàng
- vẫn có thể in / gửi phiếu cho khách; app cũng cho in từ lúc đơn còn `Nháp`
- nếu đã nhập `Giảm giá khuyến mại`, số `Cần thanh toán` trên phiếu và bản in sẽ là số đã trừ khuyến mại
- nếu `Cần thanh toán` đang thấp hơn tổng `giá nhập mặc định` của các dòng hàng, app sẽ hiện thêm cảnh báo xác nhận trước khi chốt để bạn rà lại giá bán
- trong màn `Đơn hàng`, bạn có thể tick nhiều phiếu rồi bấm `Chốt đơn` để xử lý hàng loạt các đơn nháp hợp lệ; đơn thiếu hàng hoặc không còn ở trạng thái nháp sẽ được giữ nguyên và app báo lại theo từng phiếu
- trong màn `Đơn hàng`, bạn có thể tick nhiều phiếu `Nháp/Chốt đơn` cùng khách rồi bấm `Gộp đơn`; app sẽ mở phiếu được giữ lại để bạn rà lại trước khi xác nhận

### Bước 5: Xuất hàng

Khi giao thật, mở lại đơn đang ở trạng thái `Chốt đơn` rồi bấm:

```text
Xuất hàng
```

Nếu đủ hàng:

- hệ thống mới trừ kho ở bước này
- đơn chuyển sang trạng thái `Đã xuất hàng`
- không tự in phiếu nữa; nếu cần in thì bấm `In`
- nếu sau khi rà lại mà `Cần thanh toán` vẫn thấp hơn tổng `giá nhập mặc định`, app sẽ hỏi xác nhận thêm một lần trước khi xuất hàng

Nếu thiếu hàng:

- app sẽ báo thiếu hàng khả dụng trước khi chốt hoặc thiếu hàng thực tế trước khi xuất
- nếu phần thiếu khi `Chốt đơn` đã được cover đủ bởi phiếu nhập `Đã đặt`, app vẫn cho chốt đơn; tới bước `Xuất hàng` vẫn phải chờ hàng nhập kho thật
- nếu mới chỉ có phiếu `Nháp` hoặc phiếu nhập mở chưa đủ số lượng cho các mặt hàng đang thiếu, app sẽ báo và chỉ mở lại phiếu đó nếu bạn xác nhận cần chỉnh
- với user thường, sau khi xác nhận app mới chuyển sang `Quản lý nhập hàng` để tạo hoặc mở phiếu nhập tương ứng
- với `Master Admin`, hệ thống mới cho phép chọn sang màn tồn kho để chỉnh trực tiếp nếu thực sự cần
- nếu đang bật kỳ gom nhập, app sẽ không tạo phiếu nhập tự động theo từng đơn; app chuyển sang màn `Xử lý nhập thiếu` để người giữ khóa xử lý tập trung
- nếu cần đối chiếu nhanh metadata phiếu xuất hiện hành, bấm `Detail` trong khối `Giỏ hiện hành`

### Màn tạo nhiều đơn mobile-first

Vào menu:

```text
3. Xuất nhanh
```

Thực hiện:

1. Gõ tên khách rồi bấm `+ Thêm khách`; mỗi khách sẽ thành một card riêng
2. Với từng card, bấm `Thêm hàng` để chọn sản phẩm và nhập số lượng
3. Nếu khách đang có đơn nháp trên server, chọn `Dồn vào đơn nháp hiện có` hoặc `Tạo đơn nháp mới riêng`
4. Nếu tài khoản không có quyền `order_batch_manage`, các nút cuối màn sẽ gửi `yêu cầu xuất nhanh` ở trạng thái `Chờ duyệt`; chưa tạo đơn chính thức ngay
5. Nếu tài khoản có quyền `order_batch_manage` hoặc là `Master Admin`, có thể duyệt/từ chối request ngay trong khối `Yêu cầu xuất nhanh`
6. Request còn `Chờ duyệt` mà tạo nhầm có thể bấm `Xóa`; owner của request hoặc user quản lý đều làm được
7. Sau khi request đã `Đã duyệt`, owner tạo request hoặc user quản lý có thể bấm `Xử lý` để chạy tiếp luồng lưu nháp/chốt đơn
8. Bấm `Lưu nháp` để lưu nhanh từng card xuống đơn `Nháp`; card lưu thành công vẫn ở lại ngay trên màn để bạn sửa tiếp và lưu lại đúng đơn nháp đó
9. Bấm `Chốt đơn hợp lệ` nếu muốn kiểm tra tồn theo cùng rule `Chốt đơn` hiện tại; đơn đủ điều kiện sẽ sang `Chốt đơn`, đơn lỗi giữ lại trên màn để sửa tiếp

Lưu ý:

- màn này không cho đi thẳng `Nháp -> Đã xuất hàng`; mọi đơn vẫn phải đi theo đúng workflow `draft -> committed -> completed`
- sau khi `Lưu nháp` hoặc `Chốt đơn hợp lệ`, card thành công không bị biến mất; bạn có thể sửa tiếp rồi bấm lưu/chốt lại để cập nhật đúng đơn đang mở
- nếu card đã là `Chốt đơn`, bấm lưu lại cũng không làm tụt trạng thái về `Nháp`; app chỉ cập nhật nội dung đơn đã chốt
- nếu thiếu hàng, app sẽ báo theo từng khách và từng sản phẩm, ví dụ `Thiếu Đậu hũ non: cần 10, còn 6`
- khi `Chốt đơn hợp lệ` có đơn thiếu hàng, khối `Kết quả gần nhất` sẽ hiện nút chuyển sang xử lý nhập cho các đơn vừa lỗi; bình thường nút sẽ mở `Nhập hàng`, còn nếu kỳ gom nhập đang bật thì app chuyển sang `Xử lý nhập thiếu`
- request đang `Chờ duyệt` hoặc `Đã duyệt` nhưng chưa `Đã xử lý` sẽ hiện cho tất cả user để tránh tạo trùng đơn xuất nhanh
- user quản lý có permission `order_batch_manage` sẽ thấy badge số request chờ duyệt ngay trên menu `Xuất nhanh`
- khi request còn `Chờ duyệt`, owner của request hoặc user quản lý có thể `Xóa` để bỏ yêu cầu tạo nhầm; app xóa hẳn request thay vì thêm trạng thái mới
- nút `Lịch sử` trong card request và detail đơn sẽ mở popup xem nhanh các mốc `tạo request / approve / reject / xử lý / sửa đơn`
- trong v1 không có xuất kho hàng loạt; nếu cần xuất thật thì mở các đơn đã chốt ở `Quản lý đơn hàng` hoặc `Tạo đơn xuất hàng`
- nếu tài khoản chỉ có quyền tạo nhiều đơn mà chưa có quyền chốt, cuối màn chỉ dùng được `Lưu nháp`

## 5. Luồng xem lại và hoàn tất đơn hàng

Vào menu:

```text
4. Quản lý đơn hàng
```

Dùng màn này để:

- mở lại giỏ hàng đang chờ
- chốt nhanh đơn nháp
- xuất hàng cho đơn đã chốt
- in lại đơn
- đánh dấu `Đã thanh toán`
- hủy đơn
- xóa giỏ nháp tạo nhầm

### Khi nào dùng từng nút

- `Tiếp tục xử lý`: mở lại đơn nháp hoặc đơn đã chốt để sửa tiếp trước khi xuất
- `Chốt đơn`: khóa khách hàng và giữ hàng logic cho đơn nháp
- `Xuất hàng`: trừ kho thật cho đơn đã chốt
- `Detail`: mở panel detail riêng của đơn đang chọn, hiện mã đơn, trạng thái, ngày tạo, mốc xử lý và danh sách dòng hàng của phiếu
- `Lịch sử`: mở popup audit của đúng đơn đang xem để tra nhanh ai đổi trạng thái, đổi địa chỉ giao, đổi giảm giá hay sửa số lượng hàng
- `In`: in hoặc gửi lại phiếu cho khách từ `Nháp` tới `Đã thanh toán`; ở list, nút `In` không hiện với phiếu đã thanh toán nên nếu cần in lại thì mở `Detail`
- `Xuất lại`: tạo nhanh một đơn nháp mới từ đơn đã `Đã xuất hàng` hoặc `Đã thanh toán`
- `Đã thanh toán`: đánh dấu đơn đã thu tiền
- `Hủy`: dùng khi khách không lấy nữa
- `Xóa`: chỉ áp dụng cho giỏ nháp tạo nhầm; đơn đã chốt phải giữ lại lịch sử
- `Lưu giảm giá`: chỉnh lại tổng khuyến mại của cả đơn khi đơn chưa thanh toán
- `Lưu địa chỉ giao`: cập nhật địa chỉ giao riêng của đơn cho tới trước khi đã xuất hàng

Lưu ý:

- mặc định danh sách không hiện đơn đã hủy; chỉ bật checkbox `Hiện đơn đã hủy` khi cần tra cứu lại lịch sử hủy
- một khách có thể có nhiều đơn `Chốt đơn`; khi mở đơn mới cho khách mà khách chưa có đơn nháp nhưng đang có đơn đã chốt, app sẽ hiện khối chọn để `Mở đơn đã chốt` hoặc `Tạo đơn mới`
- đơn đã `Chốt đơn` không đổi được khách hàng và không được xóa, nhưng vẫn hủy được nếu khách không lấy nữa
- đơn đã `Đã xuất hàng` sẽ không còn cho sửa trực tiếp mặt hàng, số lượng, giá hay địa chỉ giao
- nếu khách cần mua lại gần giống một đơn cũ, bấm `Xuất lại`; app sẽ tạo một đơn nháp mới với cùng khách hàng, địa chỉ giao, giảm giá khuyến mại và các dòng hàng của phiếu đã chọn. Nếu khách đó đã có đơn nháp sẵn thì app sẽ hỏi có dồn thêm vào đơn nháp hiện có hay tạo nháp mới riêng
- trước khi `Đã thanh toán`, vẫn được sửa riêng `Giảm giá khuyến mại` của cả đơn; riêng địa chỉ giao chỉ được sửa tới trước `Đã xuất hàng`
- nếu đã chốt đơn rồi mới phát hiện sai, nên xử lý bằng luồng điều chỉnh mới thay vì sửa ngược đơn cũ
- kể cả `Master Admin` cũng không được xóa hoặc hủy ngược đơn đã chốt
- panel detail có nút `Previous / Next` để chuyển nhanh giữa các đơn trong đúng danh sách đang lọc; nút `Đóng` chỉ ẩn detail, không làm mất search/filter hiện tại
- trong panel detail của đơn, danh sách mặt hàng mặc định thu gọn để màn mobile gọn hơn; bấm `Mở mặt hàng` khi cần rà từng dòng
- nếu đi từ màn `Khách hàng` sang bằng badge `đơn chờ` hoặc `đơn`, app sẽ tự lọc đúng các phiếu của khách; khi khách chỉ có 1 phiếu thì detail sẽ tự mở sẵn kể cả nếu đơn đã `Đã xuất hàng` hoặc `Đã thanh toán`
- trước khi `Chốt đơn`, `Xuất hàng`, `Đã thanh toán`, `Hủy` hoặc `Xóa`, app sẽ hiện message confirm để tránh đổi trạng thái hoặc xóa nhầm
- nếu cần chốt nhanh nhiều đơn cùng lúc, tick các phiếu cần xử lý trong danh sách rồi bấm `Chốt đơn`; app sẽ chốt các đơn nháp hợp lệ trước, còn phiếu lỗi sẽ tiếp tục được giữ lại để bạn rà lại

## 6. Luồng quản lý khách hàng

Vào menu:

```text
5. Quản lý khách hàng
```

Thông tin nên lưu:

- tên khách hàng
- số liên lạc
- địa chỉ ship
- link Zalo

### Cách dùng

1. Mở màn là thấy ngay danh sách khách hàng để tìm nhanh
2. Chạm vào một khách trong list để mở panel detail riêng; panel này hiện đủ liên hệ, địa chỉ ship, link Zalo và có `Previous / Next` để chuyển nhanh giữa các khách đang hiện trên list
3. Khi cần tạo mới, bấm `Thêm mới` để mở form
4. Điền thông tin rồi bấm `Lưu khách hàng`
5. Khi cần sửa, bấm `Sửa`; form sẽ tự mở ra với dữ liệu hiện tại
6. Khi cần mở giỏ hàng nhanh cho khách, bấm `Mở giỏ`
7. Nếu muốn xem lại phiếu hàng của khách, bấm badge `giỏ chờ` hoặc `đơn`; nếu khách chỉ có 1 phiếu thì app sẽ mở thẳng detail của phiếu đó ở màn `Quản lý đơn hàng`

Khuyến nghị:

- luôn lưu số liên lạc và địa chỉ ship cho khách thường xuyên đặt hàng

## 7. Luồng quản lý sản phẩm

Vào menu:

```text
6. Quản lý sản phẩm
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
9. Ở khối `Lịch sử sản phẩm`, mỗi dòng sẽ ghi rõ field nào đã đổi, giá trị cũ/mới, người thao tác và thời gian xử lý
10. Có thể nhập tên người thao tác hoặc chọn `Từ ngày/Đến ngày` để lọc nhanh audit gần đây, kể cả các lần import master bằng `Admin`

## 8. Luồng nhập hàng

Vào menu:

```text
7. Quản lý nhập hàng
```

Màn này có 2 phần:

- `Gợi ý nhập`
- `Phiếu nhập`

### Luồng nhập hàng chuẩn

1. Xem `Gợi ý nhập`
2. Nếu cần, sửa nhanh ô `SL` ngay trên từng card gợi ý
3. Bấm `+ Phiếu` để thêm đúng số lượng đó vào phiếu nhập
4. Các mặt hàng đã thêm sẽ tự ẩn khỏi danh sách gợi ý phía dưới và được gom vào phần tóm tắt `Phiếu nhập hiện hành`; bấm `...` để sổ danh sách dòng đã chọn ra nếu cần sửa nhanh
5. Nếu phiếu chưa có NCC, app sẽ tự điền NCC khi mặt hàng vừa thêm chỉ từng nhập từ một NCC; nếu có nhiều NCC từng nhập mặt hàng đó, ô NCC vẫn để trống nhưng danh sách gợi ý sẽ đưa NCC nhập nhiều hơn lên trước
6. Nếu mặt hàng đang nằm ở phiếu `Nháp/Đã đặt` của NCC khác, app sẽ hiện cảnh báo; chọn `OK` để mở danh sách phiếu liên quan và review, hoặc chọn `Cancel` để giữ nguyên hiện trạng rồi thêm tiếp vào phiếu hiện tại
7. Sau khi chọn `OK`, ngay trong màn `Nhập hàng` sẽ hiện khối review các phiếu chờ nhập của đúng mặt hàng đó; có thể bấm `Mở phiếu` để vào từng phiếu sửa đặt hàng, dồn lại về một NCC nếu phù hợp, hoặc bấm `Giữ hiện trạng`
8. Chọn nhà cung cấp nếu app không tự chọn hoặc bạn muốn nhập NCC khác
9. Ghi chú phiếu nếu cần
10. Mỗi NCC sẽ giữ 1 phiếu nháp riêng: nếu bạn chọn lại đúng NCC đã có phiếu nháp thì app mở lại phiếu đó để nhập tiếp và báo đang tiếp tục trên phiếu nháp hiện có; nếu chọn NCC khác thì phiếu cũ được giữ nguyên và app mở một phiếu nháp riêng cho NCC mới
11. Sửa trực tiếp số lượng, giá nhập, `Mã lô` và thông tin `Hạn dùng` của từng dòng
12. Với mỗi dòng, mặc định app để cách nhập HSD là nhập trực tiếp `Hạn dùng`; nếu muốn nhập gián tiếp thì đổi sang `Ngày sản xuất` để app tự tính `HSD = NSX + thời gian bảo quản`
13. Nếu cùng một sản phẩm về nhiều lô khác nhau, bấm `+ Lô` để nhân dòng đó thành dòng mới rồi nhập lại `Mã lô` / `HSD` hoặc `NSX` riêng
14. Bấm `Lưu dòng` nếu có chỉnh
15. Nếu muốn đổi luôn `giá nhập mặc định` của sản phẩm cho các phiếu sau, bấm `Giá chung` và xác nhận
16. Nếu có khuyến mại cho cả phiếu, nhập thêm `Giảm giá khuyến mại`; app sẽ tự tính lại `Tạm tính / Giảm KM / Cần thanh toán`
17. Phiếu nhập nháp chỉ được lưu thật sau khi đã có ít nhất một mặt hàng; nếu phiếu đang trống thì app chỉ giữ trạng thái mở tạm trên màn hình
18. Nếu đổi ý ngay lúc phiếu nháp còn trống, có thể bấm `Xóa phiếu` để đóng phiếu nháp tạm mà không cần lưu xuống DB
19. Nếu đang gõ tên nhà cung cấp chưa có trong danh bạ, chỉ khi phiếu còn `Nháp` mới bấm được `NCC` để mở form nhà cung cấp với tên đang nhập; nếu muốn đổi sang NCC khác đã có sẵn thì cũng dùng chính nút này để sang danh sách NCC và chọn lại
20. Lưu xong app sẽ quay lại phiếu nhập và điền sẵn NCC đó
21. Chỉ khi phiếu đã có `Nhà cung cấp`, app mới cho bấm `Đã đặt hàng`
22. Khi đã gửi đặt hàng, bấm `Đã đặt hàng`; từ lúc này phiếu vẫn còn chỉnh được nếu nhà cung cấp yêu cầu đổi số lượng hoặc giá, nhưng không còn được đổi NCC
23. Ngay trong danh sách phiếu nhập, có thể tick nhiều phiếu rồi bấm `Đặt hàng` để chuyển nhanh các phiếu nháp hợp lệ sang `Đã đặt hàng`; phiếu thiếu NCC hoặc không còn sửa được sẽ được giữ nguyên và app báo lại theo từng phiếu
24. Cũng trong danh sách đó, có thể tick nhiều phiếu `Nháp/Đã đặt` cùng NCC rồi bấm `Gộp đơn`; nếu khác NCC, app sẽ báo lỗi và giữ nguyên màn hiện tại
25. Khi hàng về thực tế và phiếu đã là `Đã đặt`, bấm `Nhập kho`
26. Nếu chưa có `Nhà cung cấp`, app cũng sẽ chặn luôn bước `Nhập kho`
27. Nếu bỏ trống `Mã lô`, app sẽ tự sinh mã lô lúc nhập kho; nếu bỏ trống `Hạn dùng`, app có thể fallback sang giá trị tự tính `ngày nhập kho + thời gian bảo quản`
28. Chỉ sau khi phiếu đã ở trạng thái `Đã nhập kho`, mới bấm `Đã thanh toán`
29. Sau khi phiếu đã `Đã nhập kho` nhưng chưa `Đã thanh toán`, vẫn được sửa `Ghi chú`, `Giảm giá khuyến mại` và cập nhật lại `Hạn dùng` hoặc `Ngày sản xuất`; app không mở khóa lại số lượng, giá, mã lô hay NCC
30. Nếu cần nhập lại gần giống một phiếu cũ đã `Đã nhập kho` hoặc `Đã thanh toán`, bấm `Nhập lại`; app sẽ tạo nhanh một phiếu nháp mới với cùng NCC, ghi chú, giảm giá và các dòng hàng. Nếu NCC đó đang có phiếu nháp sẵn thì app sẽ dồn thêm vào phiếu nháp hiện có để giữ đúng rule mỗi NCC tối đa một phiếu nháp
31. Có thể bấm `In` để in phiếu gửi NCC từ lúc phiếu còn `Nháp` cho tới `Đã thanh toán`; ở list phiếu, nút `In` không hiện khi phiếu đã thanh toán nên nếu cần in lại thì mở detail của phiếu
32. Khi `Nhập lại`, app chỉ sao chép các dòng hàng và thông tin mức phiếu; `Mã lô`, `HSD` và `Ngày sản xuất` sẽ để trống để bạn nhập lại theo lô hàng mới
33. Nếu gặp phiếu cũ bị lệch trạng thái, ví dụ thực tế đã dính `Đã thanh toán` nhưng không có mốc `Nhập kho` hợp lệ hoặc ngoài màn hình lại đang hiện như `Nháp`, đó là dữ liệu lỗi; có thể bấm `Hủy phiếu` hoặc `Xóa phiếu` để dọn lỗi ngay, app sẽ không khôi phục lại thành `Nháp`
34. Khi mở detail phiếu, xem thêm khối `Ngày xử lý và mã phiếu` để đối chiếu `Ngày tạo`, `Nhập kho`, `Thanh toán` và `Cập nhật cuối`
35. Panel detail của phiếu nhập có nút `Previous / Next` để chuyển nhanh theo đúng danh sách phiếu đang lọc; nút `Đóng` chỉ ẩn detail, không làm mất filter/search
36. Trước khi đổi trạng thái `Đã đặt hàng`, `Nhập kho`, `Đã thanh toán`, `Hủy phiếu` hoặc `Xóa phiếu`, app sẽ hiện message confirm để tránh thao tác nhầm

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

- mặc định danh sách không hiện phiếu đã hủy; chỉ bật checkbox `Hiện phiếu đã hủy` khi cần tra cứu lại lịch sử hủy
- chỉ `Nháp` và `Đã đặt` mới được sửa trực tiếp số lượng, giá, mã lô và cấu trúc dòng hàng
- khi `Batch mode` đang bật, chỉ người giữ khóa batch hoặc `Master Admin` mới được tạo mới, đổi NCC, sửa cấu trúc, đổi giảm giá, hủy hoặc xóa phiếu `Nháp/Đã đặt`; user khác chỉ còn được bấm `Nhập kho` với phiếu không phải batch và đã ở trạng thái `Đã đặt` từ trước lúc kỳ gom hiện tại bắt đầu, sau đó vẫn đi tiếp `Đã thanh toán` như bình thường
- nếu chưa có nhà cung cấp thì không được chuyển sang `Đã đặt` hoặc `Nhập kho`
- nếu phiếu nháp chưa có NCC, app chỉ tự chọn NCC khi các mặt hàng liên quan suy ra đúng một NCC từ lịch sử `Đã nhập kho/Đã thanh toán`; nếu có nhiều NCC thì chỉ ưu tiên thứ tự trong gợi ý, không tự đổi
- nếu một mặt hàng vẫn còn đang nằm ở phiếu mở của nhiều NCC khác nhau sau khi review, app chỉ hiện cảnh báo để user biết tình trạng hiện tại; không bắt buộc phải dồn ngay về một NCC
- mỗi nhà cung cấp chỉ có 1 phiếu `Nháp` đang mở; chọn lại đúng NCC sẽ mở phiếu đó, còn chọn NCC khác sẽ giữ nguyên phiếu cũ và tạo/mở nháp riêng cho NCC mới
- chỉ `Nháp` mới được đổi nhà cung cấp; từ `Đã đặt` trở đi ô NCC và nút `NCC` sẽ bị khóa
- ngoại lệ: nếu app nhận diện một phiếu `Đã đặt` trên DB cũ đang bị lỗi dữ liệu, ví dụ thiếu NCC hoặc marker trạng thái lệch, app sẽ mở lại thao tác sửa NCC hoặc xóa/hủy để cứu phiếu đó
- khi xuất kho hoặc trả NCC, app sẽ tự trừ theo FEFO từ lô có HSD sớm nhất; nếu lô chưa có HSD thì hệ thống để sau các lô có HSD
- phiếu đã `Đã nhập kho` vẫn cho cập nhật lại `Ghi chú`, `Hạn dùng` hoặc `Ngày sản xuất` của từng dòng và sửa `Giảm giá khuyến mại`; từ `Đã thanh toán` hoặc `Đã hủy` trở đi mới chuyển sang chế độ chỉ xem hoàn toàn
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

## 9. Luồng xử lý nhập thiếu batch

Vào menu:

```text
8. Xử lý nhập thiếu
```

Màn này dùng khi cần gom nhu cầu nhập định kỳ, ví dụ cuối tháng hoặc khi có nhiều đơn cần xử lý cùng lúc.

### Khi nào dùng

- hằng ngày ít người thao tác: cứ dùng flow nhanh ở `Quản lý nhập hàng`
- khi cần gom nhiều đơn: người quản lý bấm `Bắt đầu kỳ gom`
- trong kỳ gom, shortage từ `Chốt đơn` hoặc `Xuất hàng` sẽ đi về màn này thay vì tự tạo phiếu nhập theo từng đơn

### Cách xử lý

1. Login bằng `Master Admin` hoặc user được cấp quyền xử lý kỳ gom nhập.
2. Bấm `Bắt đầu kỳ gom` để giữ khóa xử lý.
3. Trước khi bật batch mode, app sẽ quét nhanh các phiếu nhập mở; nếu cùng một sản phẩm đang nằm trong nhiều phiếu mở thì app chặn và yêu cầu dọn conflict trước.
4. Khi bị chặn vì conflict, ngay trên màn này sẽ hiện danh sách sản phẩm và các mã phiếu nhập mở liên quan; bấm vào từng mã phiếu để sang `Quản lý nhập hàng` xử lý.
5. Nếu đang xử lý lâu trên màn này, app sẽ tự gia hạn khóa định kỳ cho đúng user đang giữ khóa.
6. Danh sách shortage chính chỉ hiện các mặt hàng còn `Cần nhập > 0`; trên từng dòng xem tồn hiện tại, nhu cầu đơn chốt, nhu cầu đơn nháp, số đang chờ nhập và số cần nhập.
7. Tick chọn những dòng cần xử lý. Dòng chưa tick sẽ không hiện cảnh báo sau nhập vì chưa có số lượng dự kiến.
8. Với từng dòng đã tick, chọn NCC từ danh bạ và nhập số lượng; số lượng mặc định là mức đủ đáp ứng nhu cầu.
9. Nếu cần gom thêm vài mặt hàng ngoài nhu cầu đơn, mở khối `Chọn thêm sản phẩm khác`. Khối này sẽ hiện trước các sản phẩm planner đang theo dõi nhưng hiện `Cần nhập = 0`, rồi hiện tiếp các sản phẩm active còn lại ngoài planner.
10. Gõ tên vào ô lọc nếu cần, rồi tick chọn nhanh ngay trên dòng sản phẩm muốn nhập thêm. Khi tick, dòng đó sẽ bung sẵn ô NCC, số lượng, giá nhập, giảm KM và ghi chú.
11. Mỗi dòng thêm tay sẽ có badge `Ngoài nhu cầu đơn`; các dòng này không tham gia tính `Cần nhập`, nhưng vẫn được gom vào phiếu batch theo NCC.
12. Trên tablet/desktop có thể nhập thêm `Giá nhập` và `Giảm KM`; khi nhiều dòng cùng NCC, giảm giá sẽ được gom vào phiếu của NCC đó.
13. Nếu NCC chưa có trong danh bạ, app sẽ hỏi để chuyển sang màn `Nhà cung cấp` tạo mới. Lưu xong app quay lại planner để chọn tiếp.
14. Bấm `Tạo phiếu đã chọn`; các dòng shortage và các dòng `Ngoài nhu cầu đơn` hợp lệ cùng NCC sẽ được gom vào cùng một phiếu nhập nháp.
15. Nếu khối `Phiếu liên quan có thể gộp` xuất hiện, bạn có thể tick nhiều phiếu rồi bấm `Gộp đơn`; app chỉ cho gộp khi toàn bộ đều là phiếu nhập cùng NCC hoặc toàn bộ đều là phiếu xuất cùng KH.
16. Bấm `Review phiếu` để mở detail các phiếu vừa tạo; dùng `Trước / Sau` để chuyển giữa các phiếu trong list và bấm `Lưu chi tiết` nếu cần sửa thêm.
17. Bấm `Quay lại batch` để refresh lại planner, kiểm tra trạng thái còn thiếu, rồi bấm `Kết thúc kỳ gom` khi đã xử lý xong.
18. Nếu đang là owner mà bấm sang màn ngoài flow batch như `Tồn kho`, app sẽ hỏi có muốn kết thúc kỳ gom ngay không. Chọn `OK` để release lock và rời flow.
19. Nếu ở bước trên chọn `Cancel`, app sẽ hỏi tiếp để bạn chọn `ở lại` màn hiện tại hoặc `chuyển sang màn khác mà vẫn giữ nguyên batch mode`.

Lưu ý:

- tổng nhu cầu tính cả đơn nháp và đơn đã chốt
- chỉ một người giữ khóa batch tại một thời điểm; user khác nên xem trạng thái để tránh xử lý song song trùng
- khi kỳ gom còn active lock, các màn `Tồn kho`, `Xuất hàng`, `Đơn hàng`, `Nhập hàng`, `Nhà cung cấp` sẽ hiện cảnh báo cho biết ai đang giữ khóa batch và màn đó đang bị ảnh hưởng gì
- nếu app báo conflict trước lúc bắt đầu kỳ gom, cần dọn các phiếu nhập mở đang cover trùng cùng sản phẩm rồi mới vào batch mode
- trong lúc kỳ gom còn hiệu lực, màn `Quản lý nhập hàng` cũng bị siết theo khóa này: user không giữ khóa không được tự tạo mới hay sửa phiếu `Nháp/Đã đặt` ngoài planner
- ngoại lệ duy nhất cho user không giữ khóa là bước `Nhập kho` trên phiếu không phải batch đã `Đã đặt` từ trước lúc kỳ gom hiện tại bắt đầu; phiếu batch hoặc phiếu `Đã đặt` phát sinh sau thời điểm lock vẫn bị khóa
- nếu một dòng đã tick nhưng chưa chọn NCC, app bỏ qua dòng đó và thông báo rõ
- khối `Chọn thêm sản phẩm khác` chỉ hiện cho người đang giữ khóa batch hoặc `Master Admin`; user khác không được dùng để tránh bypass planner
- các dòng `Ngoài nhu cầu đơn` không tạo assignment shortage; nếu sản phẩm đó đang có phiếu batch draft khác hoặc đang được gán vào phiếu batch cùng kỳ, app sẽ chỉ cho gom tiếp vào đúng phiếu/NCC đang xử lý thay vì tách phiếu mới
- phiếu nhập tạo từ màn này vẫn đi tiếp qua `Quản lý nhập hàng`: `Nháp -> Đã đặt -> Đã nhập kho -> Đã thanh toán`

## 10. Luồng quản lý nhà cung cấp

Vào menu:

```text
9. Quản lý nhà cung cấp
```

Nên lưu:

- tên nhà cung cấp
- số liên lạc
- địa chỉ
- ghi chú

### Cách dùng

1. Mở màn là thấy ngay danh sách nhà cung cấp để tìm nhanh
2. Chạm vào một NCC trong list để mở panel detail riêng; panel này hiện đủ liên hệ, ghi chú và số phiếu liên quan, có `Previous / Next` để duyệt nhanh giữa các NCC đang hiện
3. Khi cần tạo mới, bấm `Thêm mới` để mở form
4. Lưu nhà cung cấp rồi dùng lại trong phiếu nhập
5. Khi cần sửa, bấm `Sửa`; form sẽ tự mở ra với dữ liệu hiện tại
6. Nếu đi từ màn `NH` sang bằng nút `NCC`, app sẽ mở sẵn form theo tên đang gõ; thao tác này chỉ dùng được khi phiếu nhập còn là `Nháp`
7. Có thể bấm `Dùng cho phiếu nhập` để chuyển nhanh sang màn nhập hàng

## 11. Luồng báo cáo tháng

Vào menu:

```text
10. Báo cáo tháng
```

Màn này dùng để:

- xem tổng nhập / tổng xuất trong tháng
- xem xu hướng nhiều tháng gần đây
- xem mặt hàng nào biến động mạnh
- xem dự báo mặt hàng cần nhập

### Cách đọc nhanh

## 12. Luồng điều chỉnh tồn và trả hàng (Phase B)

Khi đã chốt đơn hoặc đã nhập kho mà phát hiện sai, không sửa ngược chứng từ cũ.

Dùng 1 trong 3 loại chứng từ điều chỉnh:

- `Phiếu điều chỉnh tồn`: tăng/giảm trực tiếp theo kiểm kho thực tế, bắt buộc có lý do
- `Phiếu trả hàng khách`: khi khách trả hàng, hàng quay lại tồn kho
- `Phiếu trả NCC`: khi trả ngược hàng về nhà cung cấp, tồn kho sẽ giảm

Lưu ý:

- `Phiếu điều chỉnh tồn` nên dùng bởi `Master Admin` khi cần xử lý chênh lệch gấp
- Mỗi phiếu đều lưu thành giao dịch kho mới để giữ lịch sử và audit
- Các phiếu tăng/giảm tồn có thể nhập thêm `Mã lô` và `HSD`; riêng phiếu trả NCC có thể chỉ rõ `Mã lô` để trừ đúng lô thay vì FEFO chung
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
2. Tìm đúng đơn đã `Đã xuất hàng` rồi bấm `Detail`
3. Trong detail của đơn đó, bấm `Trả hàng`
4. App sẽ tạo sẵn danh sách dòng hàng theo đơn nguồn; có thể sửa số lượng trả, giá hoàn hoặc bỏ bớt dòng
5. Bấm `Tạo phiếu trả khách`
6. Form trả hàng không còn hiện độc lập ngoài list để tránh bấm nhầm sang một phiếu không liên quan

#### Phiếu trả NCC

1. Vào `Quản lý nhập hàng`
2. Mở đúng phiếu đã `Đã nhập kho` hoặc `Đã thanh toán`, rồi bấm `Detail`
3. Trong detail của phiếu đó, bấm `Trả NCC`
4. App sẽ tạo sẵn danh sách dòng hàng theo phiếu nguồn; có thể sửa số lượng trả, giá trả NCC hoặc bỏ bớt dòng
5. Bấm `Tạo phiếu trả NCC`
6. Form trả NCC không còn hiện độc lập ngoài list để tránh nhầm với thao tác mở phiếu nhập thông thường

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

## 13. Các tình huống thường gặp

### Khách gọi đặt hàng nhưng chưa chốt ngay

Làm như sau:

1. Vào `Tạo đơn xuất hàng`
2. Mở giỏ cho khách
3. Chọn hàng trước
4. Chưa cần chốt

Giỏ sẽ nằm ở trạng thái chờ để mở lại sau.

### Thiếu hàng khi đang chốt đơn

Ứng dụng chỉ báo thiếu khi phần còn thiếu chưa được phiếu nhập `Đã đặt` cover đủ.

Khi đó:

- nếu phần còn thiếu đang nằm ở phiếu nhập `Nháp` hoặc phiếu mở chưa đặt đủ, app sẽ báo để bạn kiểm tra lại phiếu đó trước rồi chuyển sang `Đã đặt` khi phù hợp
- nếu đang trong kỳ gom nhập: sang `Xử lý nhập thiếu` để tạo phiếu nhập batch, không tạo phiếu tự động theo từng đơn
- nếu chỉ cần sửa lại số tồn và bạn là `Master Admin`: sang `Kiểm tra tồn kho`
- nếu thực sự còn thiếu hàng: xác nhận rồi sang `Quản lý nhập hàng`

### Muốn xem lại đơn cũ đã xuất hàng

Vào `Quản lý đơn hàng` rồi bật:

```text
Hiện đơn lưu trữ
```

### Muốn xem lại đơn đã hủy

Vào `Quản lý đơn hàng` rồi bật:

```text
Hiện đơn đã hủy
```

### Muốn xem lại phiếu nhập đã thanh toán

Vào `Quản lý nhập hàng` rồi bật:

```text
Hiện phiếu đã thanh toán
```

### Muốn xem lại phiếu nhập đã hủy

Vào `Quản lý nhập hàng` rồi bật:

```text
Hiện phiếu đã hủy
```

## 14. Lưu ý sử dụng chung nhiều máy

- Tất cả thiết bị phải mở cùng một địa chỉ app/server
- Không nên có nhiều máy cùng sửa đúng một đơn hoặc một phiếu nhập tại cùng một thời điểm
- Nên có một người chính thao tác nhập kho và một người chính thao tác chốt đơn để tránh đè dữ liệu
- Khi bật kỳ gom nhập, chỉ người giữ khóa batch xử lý tạo phiếu nhập thiếu; user khác không nên mở song song nhiều flow shortage để tránh trùng logistics
- Ở phiên bản hiện tại, các màn chính cũng sẽ tự kiểm tra và nạp lại dữ liệu mới khi màn hình đang rảnh thao tác, nên thường không cần `F5`
- Trong lúc người dùng đang nhập dở vào ô text/number/date, app sẽ tạm hoãn tự refresh để tránh mất nội dung đang gõ
- Nếu 2 máy cùng lưu vào cùng một giỏ nháp hoặc phiếu nháp, app sẽ báo xung đột đồng bộ và tự tải lại dữ liệu mới nhất để tránh ghi đè lẫn nhau

## 15. Quy trình đề xuất cho cửa hàng nhỏ

### Đầu ngày

1. Vào `Kiểm tra tồn kho`
2. Xem hàng sắp hết
3. Vào `Quản lý nhập hàng` nếu cần đặt thêm
4. Nếu là kỳ gom định kỳ, user quản lý vào `Xử lý nhập thiếu` và giữ khóa batch trước khi tạo phiếu nhập

### Trong ngày

1. Tạo đơn cho khách ở `Tạo đơn xuất hàng`
2. Theo dõi đơn ở `Quản lý đơn hàng`
3. Cập nhật thanh toán khi khách đã trả tiền

### Cuối ngày

1. Kiểm tra lại `Lịch sử gần đây`
2. Xem `Báo cáo tháng`
3. Ghi nhận mặt hàng bán mạnh để chuẩn bị nhập tiếp

## 16. Module Master Admin

Vào menu:

```text
12. Master Admin
```

Chỉ người quản trị hệ thống mới nên dùng màn này.

Từ phiên bản này, màn `Master Admin` cũng là nơi login hệ thống:

- `user` thường: dùng các màn nghiệp vụ chung
- `Master Admin`: có thêm phần quản trị master data, backup/restore, legacy audit và chỉnh tồn trực tiếp
- user quản lý kinh doanh có thể được cấp riêng quyền `procurement_batch_manage` để xử lý kỳ gom nhập mà không có quyền chỉnh tồn trực tiếp
- user quản lý xuất nhanh có thể được cấp quyền `order_batch_manage` để duyệt/từ chối/xử lý tiếp các yêu cầu xuất nhanh của user thường
- nếu `EnableLogin = true` trong `system_config.json`, người dùng phải login thì mới dùng được app

Màn này có 3 nhóm chức năng:

- export / import file master:
  - mặt hàng
  - khách hàng
  - nhà cung cấp
  - định dạng hỗ trợ: `JSON` hoặc `CSV`
- backup / restore database toàn hệ thống
- `Legacy Audit` để quét dữ liệu legacy đang dùng:
  - tách phần `fix an toàn` có thể auto backfill timestamp
  - liệt kê các record còn phải admin review thủ công
  - cho gắn lại `receipt_code` hoặc `đơn nguồn` nếu đã đối chiếu chắc chắn
- trạng thái phiên: nút `Login` / `Logout` nằm ở thanh header nổi; khi đã login sẽ hiện tên user bên cạnh

Lưu ý timeout phiên:

- `session_timeout_minutes`: timeout chung cho user thường
- `admin_session_timeout_minutes`: timeout riêng cho tài khoản admin
- nếu cùng một domain đang chạy nhiều app ở các port khác nhau như `:4000` và `:9999`, mỗi port sẽ giữ session login riêng
- timeout này được tính theo thời gian không có thao tác trong phiên hiện tại
- khi đủ timeout, phiên sẽ tự hết hạn thật và app quay về trạng thái cần login lại, không hiện hộp thoại hỏi tiếp tục dùng

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

### Khi nào dùng Legacy Audit

- sau khi restore DB thật từ máy khác hoặc từ server remote về local
- khi thấy phiếu legacy bị khóa sai do thiếu `NCC`, thiếu `receipt_code`, thiếu `paid_at`, hoặc thiếu link `đơn nguồn`
- trước khi can thiệp tay vào SQLite

### Cách dùng Legacy Audit

1. Đăng nhập `Master Admin`
2. Vào màn `Master Admin`
3. Bấm `Làm mới audit` để quét DB hiện hành
4. Nếu khối `Fix an toàn` có dữ liệu, bấm `Áp dụng fix an toàn`
5. Xem khối `Record cần review thủ công`
6. Với phiếu nhập legacy lỗi workflow:
   - bấm `Mở phiếu` để sang màn `Nhập hàng`
   - hoặc gắn lại `receipt_code`
   - hoặc `Hủy/Xóa` nếu chắc chắn đó là phiếu lỗi không còn giá trị
7. Với phiếu nhập thiếu link `đơn nguồn`, nhập hoặc chọn `cart_id` rồi bấm `Gắn đơn nguồn`

Nguyên tắc:

- fix an toàn chỉ backfill các mốc thời gian chắc chắn, không tự đoán `receipt_code` hay `cart_id`
- các thao tác gắn lại receipt / đơn nguồn luôn phải do admin xác nhận sau khi đối chiếu chứng từ thật

### Cảnh báo

- `Restore DB` sẽ ghi đè toàn bộ dữ liệu hiện tại
- luôn backup trước khi restore
- chỉ dùng file backup đúng của hệ thống này
