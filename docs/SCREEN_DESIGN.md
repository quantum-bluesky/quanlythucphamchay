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
- [STATUS_TRANSITION_TABLE.md](STATUS_TRANSITION_TABLE.md)

Liên kết detail hiện có:

- Hiển thị các phiếu/chứng từ: [PHIEU_DISPLAY_DESIGN.md](PHIEU_DISPLAY_DESIGN.md)
- Thiết kế planned cho workflow `Chốt đơn` / `Đã xuất hàng`: [ISSUE_110_ORDER_COMMIT_DESIGN.md](ISSUE_110_ORDER_COMMIT_DESIGN.md)
- Thiết kế planned cho `Batch procurement mode` / màn `Xử lý nhập thiếu`: [ISSUE_113_BATCH_PROCUREMENT_MODE_DESIGN.md](ISSUE_113_BATCH_PROCUREMENT_MODE_DESIGN.md)

## 1. Nguyên tắc UI chung

- ưu tiên mobile-first
- danh sách là trung tâm, form được thu gọn khi hợp lý
- mỗi màn có search nhanh riêng
- popup/help phải đóng được và có liên kết qua lại giữa các màn liên quan
- luồng chính ưu tiên thao tác nhanh cho cửa hàng nhỏ
- với action có ghi dữ liệu lên server hoặc đồng bộ SQLite/state, UI phải hiện loading overlay toàn cục và khóa tạm thao tác còn lại cho tới khi trạng thái mới render xong để tránh bấm chồng
- khi Batch procurement mode còn active lock, các màn liên quan như `inventory`, `create-order`, `orders`, `purchases`, `suppliers`, `procurement-planner` phải hiện cảnh báo ngắn cho biết owner của lock, thời điểm hết hạn gần nhất và impact chính trên màn hiện tại

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
  - danh sách lô còn hàng trong phần detail card
  - badge `Chờ xuất` / `Chờ nhập` có thêm `số phiếu / tổng số lượng` đang chờ theo sản phẩm
  - nút `Xử lý nhập thiếu` để mở planner batch khi cần gom nhập định kỳ
  - nút `Lịch sử` để nhảy nhanh xuống phần lịch sử
  - lịch sử gần đây
- hành động chính:
  - `Xuất`
  - `Nhập`
  - direct adjust chỉ cho Master Admin
- nguyên tắc UI:
  - search toolbar chỉ giữ ô tìm kiếm
  - sort nằm ở pagination đầu list; pagination cuối không lặp sort control
  - mode `Ưu tiên nhập/xử lý` hiển thị thêm điểm ưu tiên trên card
  - mode `Hạn còn ít` hiển thị theo HSD thật của lô gần nhất nếu có; chỉ fallback về ước tính sản phẩm khi chưa có lô nào có HSD
  - khối `Lịch sử gần đây` mặc định thu gọn, có nút `Mở lịch sử/Thu gọn`
  - nếu dòng lịch sử có mã `DH/PN/DC/THK/TNCC` thì mã đó là link nội bộ để mở đúng chứng từ liên quan
  - khi kỳ gom nhập còn active lock, màn này phải hiện cảnh báo cho biết thiếu hàng sẽ đi qua planner batch thay vì flow nhập thiếu nhanh

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
  - nếu `Cần thanh toán` thấp hơn tổng `giá nhập mặc định` của các dòng hàng, panel phải hiện cảnh báo ngắn và trước `Chốt đơn`/`Xuất hàng` phải hỏi xác nhận thêm
  - từ màn `orders`, user có thể tick nhiều phiếu `draft/committed` cùng khách để mở preview `gộp đơn`; nếu khác khách thì giữ nguyên list và báo lỗi thân thiện
  - khối `Giỏ hiện hành` có thêm button `Detail` để bung metadata phiếu xuất mà không chuyển màn
  - phiếu xuất được phép `In` từ lúc còn `Nháp` cho tới `Đã thanh toán`
  - detail đơn phải có thêm `Địa chỉ giao`; field này là snapshot riêng của đơn và cho sửa tới trước khi `Đã xuất hàng`
  - không dùng cụm nút tăng giảm nhanh trong `Giỏ hiện hành` để tránh rối trên mobile
  - sau khi đơn đã `Chốt đơn`, app khóa khách hàng nhưng vẫn cho sửa dòng hàng, địa chỉ giao và `Giảm giá khuyến mại`
  - sau khi đơn đã `Đã xuất hàng` nhưng chưa `Đã thanh toán`, chỉ còn cho sửa `Giảm giá khuyến mại`; không mở khóa lại dòng hàng
  - khi mở đơn mới cho khách đang có đơn `Chốt đơn`, panel phải hiện lựa chọn `Mở đơn đã chốt` hoặc `Tạo đơn mới`
  - khi chốt đơn, hệ thống được phép tính thêm phần hàng đã nằm trong phiếu nhập `Đã đặt`; chỉ khi phần thiếu còn lại chưa được `Đã đặt` cover đủ thì app mới báo trước khi tạo/cập nhật phiếu nhập
  - nếu phần thiếu mới đang nằm ở phiếu nhập `Nháp` hoặc phiếu mở chưa đặt đủ thì app chỉ mở lại phiếu liên quan sau khi user xác nhận cần chỉnh
  - khi hệ thống đang ở Batch procurement mode, shortage không được auto-create phiếu nhập theo từng cart mà phải chuyển sang màn `procurement-planner`
  - khi kỳ gom nhập còn active lock, màn này phải hiện cảnh báo cho biết đơn thiếu hàng sẽ được đẩy sang planner batch

### `bulk-orders` - Tạo nhiều đơn / Xuất nhanh

- mục tiêu:
  - thêm nhiều khách trong một màn
  - mỗi khách có nhiều mặt hàng riêng
  - lưu nháp hàng loạt hoặc chốt các đơn hợp lệ
- thành phần chính:
  - ô thêm khách nhanh
  - list card theo khách
  - item picker sản phẩm
  - khối `Yêu cầu xuất nhanh` hiển thị request gần đây và action `Approve/Reject/Xử lý`
  - popup `Lịch sử` dùng chung cho request và detail đơn
  - thanh kết quả batch
  - footer action cố định
- nguyên tắc UI:
  - ưu tiên mobile-first, dùng card theo khách; không dùng bảng nhiều cột làm giao diện chính
  - mỗi card phải hiển thị ngắn gọn `khách`, `tổng món`, `cần thanh toán`, `địa chỉ giao`, `trạng thái kiểm tra`
  - action trực tiếp trên card chỉ giữ các thao tác gọn như `Sửa`, `Thêm hàng`, `Xóa khách`
  - cuối màn chỉ có đúng 2 CTA chính: `Lưu nháp` và `Chốt đơn hợp lệ`
  - `Lưu nháp` chỉ tạo/cập nhật cart `draft`; không giữ hàng, không trừ kho và không nhảy thẳng sang `completed`
  - `Chốt đơn hợp lệ` phải kiểm từng khách theo đúng rule availability của bước `Chốt đơn` hiện tại; đơn đủ điều kiện sang `committed`, đơn lỗi giữ nguyên ở màn để user sửa tiếp
  - khi login bật và user không có `order_batch_manage`, 2 CTA cuối màn phải đổi nghĩa thành `gửi request chờ duyệt`; request card phải hiện rõ `người tạo`, `trạng thái`, `số đơn`, `lý do reject` nếu có và warning trùng request active
  - user có `order_batch_manage` hoặc `Master Admin` phải thấy badge pending ngay từ menu và có action `Approve/Reject`; owner của request đã `approved` cũng phải thấy nút `Xử lý`
  - request card và detail đơn phải có nút `Lịch sử`; popup audit hiển thị mới nhất trước, tối thiểu có `thời gian`, `user`, `hành động`, `trạng thái trước/sau`, `ghi chú`
  - lỗi phải hiển thị được theo từng khách và từng sản phẩm, ví dụ `Thiếu ...: cần ..., còn ...`
  - nếu khách đã có đơn nháp trên server, card phải cho user chọn `dồn vào nháp hiện có` hoặc `tạo nháp mới riêng`
  - import Excel nếu có chỉ là action phụ; dữ liệu sau import vẫn phải đổ về list card để user review/sửa trước khi lưu hoặc chốt

### `orders` - Quản lý đơn hàng

- mục tiêu:
  - xem đơn nháp và đơn đã chốt
  - theo dõi đơn đã xuất hàng
  - cập nhật thanh toán
- thành phần chính:
  - search đơn hàng
  - filter hiện đơn lưu trữ / đã hủy / đã thanh toán
  - danh sách order card
  - detail panel có nút `Lịch sử`
- nguyên tắc UI:
  - đơn đã hủy mặc định ẩn để list gọn hơn; user chỉ bật lại khi cần tra cứu
  - list đơn là trung tâm; detail của đơn mở ở panel riêng khi user chọn card, có nút `Previous / Next` để đi theo đúng danh sách đang lọc và có nút `Đóng` để ẩn panel
  - đơn `draft` có nút `Chốt đơn` nhanh ngay trên card trên tablet/PC
  - đơn `committed` có nút `Xuất hàng` nhanh ngay trên card trên tablet/PC
  - list đơn có thêm nút `In` cho các phiếu chưa thanh toán; riêng phiếu đã thanh toán chỉ giữ `In` trong phần detail để list gọn hơn
  - card đơn có button `Detail` để mở panel detail; trong panel này metadata hiện đầy đủ, còn danh sách mặt hàng mặc định thu gọn và chỉ mở ra khi user cần xem
  - khi đi từ màn `customers`, list có thể tự lọc đúng theo `customerId`; nếu chỉ còn 1 phiếu phù hợp thì detail của phiếu đó phải tự mở kể cả với đơn `Đã xuất hàng` hoặc `Đã thanh toán`
  - card đơn `committed` có thể hiện thêm input `Địa chỉ giao` và `Giảm giá khuyến mại` trong detail
  - card/detail của đơn `draft/committed` nên giữ cảnh báo rõ khi `Cần thanh toán` đang thấp hơn tổng `giá nhập mặc định`
  - preview `gộp đơn` của phiếu xuất tái sử dụng màn `create-order`: chọn một phiếu làm đích, hiển thị danh sách phiếu sẽ nhập vào, cho `Thực hiện gộp` hoặc `Hủy`
  - card đơn `completed` chưa thanh toán chỉ còn hiện input `Giảm giá khuyến mại` trong detail
  - card đơn `completed` hoặc `paid` có action `Xuất lại` để tạo nhanh một đơn nháp mới với cùng khách, địa chỉ giao, giảm giá và danh sách dòng hàng của phiếu đã chọn; nếu khách đã có đơn `draft` thì UI phải hỏi có dồn thêm vào đơn nháp hiện có hay tạo nháp mới riêng
  - action `Trả hàng` chỉ hiện trong detail của đơn `completed`; không đặt form hay button trả hàng độc lập ở ngoài list để tránh bấm nhầm
  - trên mobile, `Chốt đơn`, `Xuất hàng` và các action phụ vẫn nằm trong khối detail mở rộng để tránh quá tải nút trực tiếp
  - các nút đổi trạng thái hoặc xóa phiếu như `Chốt đơn`, `Xuất hàng`, `Đã thanh toán`, `Hủy`, `Xóa` phải hiện message confirm trước khi app cập nhật
  - khi kỳ gom nhập còn active lock, màn này phải hiện cảnh báo cho biết các case thiếu hàng sẽ được xử lý tập trung ở planner batch

### `customers` - Quản lý khách hàng

- mục tiêu:
  - quản lý danh bạ khách
  - mở nhanh giỏ hàng cho khách
- thành phần chính:
  - search khách hàng
  - danh sách khách
  - form tạo/sửa thu gọn
- nguyên tắc UI:
  - trên mobile, card khách nên giữ ở khoảng 3 dòng để ưu tiên mật độ danh sách
  - dòng cuối của card mobile ưu tiên `số liên lạc` và các action ngắn cùng hàng để thấy được nhiều khách hơn
  - detail của khách mở ở panel riêng khi user chọn card; panel này hiện đủ liên hệ/ship/Zalo, có `Previous / Next` theo danh sách đang lọc và có nút `Đóng`
  - badge `giỏ chờ` hoặc `đơn` trên card là link nội bộ sang màn `orders`; nếu chỉ có 1 phiếu liên quan thì app mở thẳng detail phiếu đó

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
  - card lịch sử ghi rõ field thay đổi, giá trị cũ/mới, actor và thời gian
  - field `Hạn dùng (ngày)` và `Bảo quản (ngày)` để làm metadata fallback cho sort hạn còn lại khi lô chưa có HSD thật

### `purchases` - Quản lý nhập hàng

- mục tiêu:
  - lập phiếu nhập
  - theo dõi trạng thái đặt/nhập kho/thanh toán
- thành phần chính:
  - search phiếu nhập
  - gợi ý nhập
  - phiếu nhập hiện hành
  - danh sách phiếu
  - filter hiện phiếu đã hủy / đã thanh toán
  - nút `NCC`
- nguyên tắc UI:
  - phiếu đã hủy mặc định ẩn để list gọn hơn; user chỉ bật lại khi cần tra cứu
  - khi user chọn một phiếu trong danh sách, panel phiếu nhập hiện hành đóng vai trò detail panel riêng: có `Previous / Next`, `Đóng`, metadata đầy đủ và danh sách dòng hàng hiện trọn vẹn
  - ngay trên từng card gợi ý nhập phải có ô `SL` để đổi nhanh số lượng trước khi bấm `+ Phiếu`
  - hàng đã thêm vào phiếu được gom lên tóm tắt phía trên
  - hàng đã thêm ẩn khỏi danh sách gợi ý phía dưới
  - phiếu nhập hiện hành phải hiển thị `Tạm tính / Giảm KM / Cần thanh toán`; giảm giá là field cấp toàn phiếu để đối chiếu số tiền thực trả NCC
  - mỗi dòng nhập cần có input `Mã lô` và phần nhập HSD hỗ trợ 2 mode: nhập trực tiếp `Hạn dùng` hoặc nhập gián tiếp `Ngày sản xuất`; mode mặc định là nhập trực tiếp HSD, còn mode gián tiếp sẽ tự tính `HSD = NSX + thời gian bảo quản`
  - metadata phiếu nhập được bung/thu gọn bằng button `Detail` thay vì badge tĩnh để phần đầu phiếu gọn hơn
  - phiếu nhập được phép `In` từ lúc còn `Nháp` cho tới `Đã thanh toán`; ở list chỉ hiện nút `In` tới trước khi phiếu đã thanh toán, còn phiếu đã thanh toán thì in lại từ detail
  - nếu phiếu nhập sinh ra từ một đơn đang thiếu hàng, phần metadata `Detail` phải hiện nguồn đơn thiếu riêng; không dùng ô ghi chú để nhét sẵn nội dung này
  - nếu shortage từ màn xuất hàng đã được cover bởi phiếu `draft/ordered` hiện có, màn nhập hàng chỉ mở lại phiếu liên quan khi user xác nhận; không tự tạo thêm phiếu trùng
  - nếu khi chọn mặt hàng vào phiếu mà mặt hàng đó đang nằm ở phiếu `draft/ordered` của NCC khác, UI phải hiện cảnh báo và cho user chọn mở danh sách các phiếu liên quan để review; từ danh sách này user có thể mở từng phiếu để dồn lại về một NCC hoặc giữ nguyên hiện trạng
  - mỗi nhà cung cấp chỉ giữ tối đa 1 phiếu `draft`; nếu user chọn lại đúng NCC đã có nháp thì màn nhập hàng phải mở lại phiếu đó để nhập tiếp, còn nếu chọn NCC khác thì phải giữ nguyên phiếu cũ và mở nháp riêng cho NCC mới
  - khi phiếu `draft` chưa có NCC, thêm mặt hàng vào phiếu được phép tự chọn NCC nếu lịch sử nhập thực tế của mặt hàng chỉ có 1 NCC; nếu có nhiều NCC thì datalist của ô NCC phải ưu tiên NCC có tổng số lượng/số lần nhập mặt hàng đó cao hơn
  - nếu sau khi review mà một mặt hàng vẫn còn đang nằm ở nhiều NCC mở khác nhau thì UI chỉ cần giữ cảnh báo ngắn cho user biết tình trạng hiện tại, không bắt buộc phải chặn tiếp
  - phiếu `draft` đang trống vẫn phải cho `Xóa phiếu` ngay trên UI dù chưa persist xuống DB
  - nút `Nhập kho` chỉ hiện khi phiếu đã ở trạng thái `Đã đặt`; phiếu `Nháp` vẫn còn chỉnh sửa được nhưng chưa cho nhập kho
  - khi Batch procurement mode đang bật, chỉ người giữ khóa batch hoặc `Master Admin` mới được tạo mới, sửa cấu trúc, đổi NCC, đổi giảm giá, hủy hoặc xóa phiếu `Nháp/Đã đặt`; user khác chỉ được tiếp tục `Nhập kho` với phiếu không phải batch đã `Đã đặt` trước lúc batch hiện tại bắt đầu, rồi đi tiếp `Đã thanh toán`
  - màn này phải có cảnh báo active lock riêng để user biết ai đang giữ batch mode và vì sao phiếu `Nháp/Đã đặt` đang bị siết quyền
  - nếu chưa có `Nhà cung cấp`, button `Đã đặt hàng` và `Nhập kho` phải bị khóa; UI cần hiện cảnh báo ngắn để user biết thiếu dữ liệu gì
  - ô NCC và nút `NCC` chỉ bật khi phiếu đang là `Nháp`; từ `Đã đặt` trở đi phải disable trên cả desktop và mobile
  - list phiếu nhập cho phép tick nhiều phiếu `draft/ordered` cùng NCC để mở preview `gộp đơn`; nếu khác NCC thì app báo lỗi và không điều hướng
  - khi phiếu còn `Nháp`, bấm nút `NCC` từ một phiếu đã có NCC vẫn phải cho sang danh sách NCC để đổi sang NCC khác, không được kẹt ở chế độ sửa NCC hiện tại
  - nếu bỏ trống `Mã lô`, app tự sinh batch code khi nhập kho; nếu bỏ trống `Hạn dùng`, app có thể fallback sang HSD tự tính `ngày nhập kho + thời gian bảo quản` để FEFO vẫn có mốc hạn
  - sau khi phiếu đã `Đã nhập kho` nhưng chưa `Đã thanh toán`, chỉ cho sửa `Ghi chú`, `Giảm giá khuyến mại` và metadata HSD/NSX của từng dòng; không mở khóa lại số lượng, giá, mã lô, NCC hay cấu trúc dòng nhập
  - phiếu `received/paid` có action `Nhập lại` để tạo nhanh phiếu nháp mới với cùng NCC, ghi chú, giảm giá và các dòng hàng; nếu NCC đó đã có phiếu `draft` thì app dồn thêm vào phiếu nháp hiện có thay vì tạo draft thứ hai
  - preview `gộp đơn` của phiếu nhập tái sử dụng panel chi tiết hiện hành, giữ lại phiếu ưu tiên `ordered` trước `draft`, rồi mới xét phiếu đang mở và thời điểm cập nhật
  - khi `Nhập lại`, metadata theo lô như `Mã lô`, `Hạn dùng`, `Ngày sản xuất` phải được reset về trống để user nhập lại theo lô hàng mới
  - action `Trả NCC` chỉ hiện trong detail của phiếu `received/paid`; không đặt form hay button trả NCC độc lập ở ngoài list để tránh nhầm với thao tác mở phiếu nhập
  - các nút đổi trạng thái hoặc xóa phiếu như `Đã đặt hàng`, `Nhập kho`, `Đã thanh toán`, `Hủy phiếu`, `Xóa phiếu` phải hiện message confirm trước khi app cập nhật
- tài liệu detail:
  - [PHIEU_DISPLAY_DESIGN.md](PHIEU_DISPLAY_DESIGN.md)

### `procurement-planner` - Xử lý nhập thiếu

- mục tiêu:
  - gom nhu cầu nhập thiếu từ đơn nháp và đơn đã chốt
  - cho một người giữ khóa batch tạo phiếu nhập theo mặt hàng
  - tránh tách cùng một sản phẩm thiếu ra nhiều phiếu nhập mở
- thành phần chính:
  - panel trạng thái Daily/Batch mode và người giữ khóa
  - nút `Làm mới`, `Tạo phiếu đã chọn`, `Review phiếu`, `Bắt đầu kỳ gom`, `Kết thúc kỳ gom`
  - danh sách mặt hàng thiếu theo tồn, nhu cầu đơn chốt, nhu cầu đơn nháp, chờ nhập, cần nhập và dự kiến sau nhập
  - khối phụ `Chọn thêm sản phẩm khác` dạng collapse cho batch owner tick chọn nhanh các dòng ngoài nhu cầu đơn
  - review panel detail phiếu nhập batch với nút `Trước / Sau`
- nguyên tắc UI:
  - Daily mode vẫn ưu tiên flow nhanh theo đơn ở màn `purchases`
  - Batch mode chỉ cho user có quyền quản lý batch tạo phiếu nhập từ planner
  - trước khi acquire lock batch, backend phải audit nhanh conflict phiếu nhập mở theo sản phẩm và chặn vào batch nếu còn cover trùng
  - khi bị chặn bởi conflict đầu kỳ gom, màn planner phải hiện ngay danh sách sản phẩm và các phiếu nhập mở liên quan để user bấm mở xử lý
- khi Batch mode đang bật, màn `purchases` phải bị khóa phần tạo/sửa cấu trúc phiếu `Nháp/Đã đặt` cho user không giữ khóa để tránh bypass planner
- nếu owner rời `procurement-planner`, `purchases` hoặc `suppliers` sang màn ngoài flow khi batch còn active, UI phải hỏi có muốn `Kết thúc kỳ gom` ngay hay không; nếu user không kết thúc batch thì phải hỏi tiếp để chọn `ở lại` hoặc `đi tiếp mà vẫn giữ batch mode`
- list shortage chính chỉ render các dòng còn `Cần nhập > 0`; các dòng planner đang theo dõi nhưng đã về `Cần nhập = 0` không lặp lại ở block shortage
- mỗi dòng mặc định chưa tick; chỉ khi tick mới hiện NCC, số lượng và cảnh báo sau nhập
- trên tablet/desktop hiện thêm input `Giá nhập` và `Giảm KM` để tận dụng không gian rộng hơn
- khối `Chọn thêm sản phẩm khác` chỉ hiện khi đang ở Batch mode và user là lock owner hoặc `Master Admin`
- khối extra phải có ô lọc nhanh và 2 nhóm: sản phẩm planner đang theo dõi nhưng hiện `Cần nhập = 0`, rồi tới các sản phẩm active còn lại ngoài planner
  - extra rows phải tách khỏi list shortage chính, có badge `Ngoài nhu cầu đơn`, không dùng lại các cột `Cần nhập / Dự kiến sau nhập`
  - các dòng chọn cùng NCC phải gom vào cùng một phiếu nhập batch draft
  - planner có thể hiện thêm khối `Phiếu liên quan có thể gộp`; khối này chỉ cho gộp cùng loại phiếu, nghĩa là toàn bộ là phiếu nhập cùng NCC hoặc toàn bộ là phiếu xuất cùng KH
  - extra rows vẫn được gom chung vào phiếu batch theo NCC với shortage rows, nhưng không tạo assignment shortage
  - nếu NCC chưa tồn tại, app hỏi chuyển sang màn `suppliers` để tạo NCC mới rồi quay lại planner
  - nếu sản phẩm đã được gán vào một phiếu nhập batch mở, dòng planner phải hiện mã phiếu/NCC đang xử lý thay vì cho tạo trùng
  - cảnh báo `Sau nhập vẫn dưới ngưỡng` chỉ hiện sau khi dòng đã được tick và có số lượng dự kiến; đây là cảnh báo tồn kho, không phải lỗi chặn tạo phiếu
  - trên mobile, action phụ giữ trong card; không thêm quá nhiều nút trực tiếp vào header

### `suppliers` - Quản lý nhà cung cấp

- mục tiêu:
  - quản lý nguồn hàng
  - dùng lại trong phiếu nhập
- thành phần chính:
  - search NCC
  - danh sách NCC
  - form tạo/sửa thu gọn
- nguyên tắc UI:
  - khi kỳ gom nhập còn active lock, màn này phải hiện cảnh báo để user biết đang tạo/sửa NCC trong bối cảnh batch mode còn mở
  - detail của NCC mở ở panel riêng khi user chọn card; panel này hiện đủ liên hệ, ghi chú, số phiếu liên quan, có `Previous / Next` và `Đóng`

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
  - rà soát và xử lý dữ liệu legacy đang dùng
- thành phần chính:
  - login panel
  - export/import master
  - backup/restore database
  - panel `Legacy Audit` gồm:
    - summary card số lượng anomaly
    - khối `fix an toàn`
    - khối `review thủ công`
    - action gắn `receipt_code`, gắn `đơn nguồn`, mở phiếu, hủy/xóa phiếu lỗi

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
