# Business Flow

Tài liệu này gom luồng nghiệp vụ vận hành của app theo code và tài liệu hiện tại.

Nguồn tổng hợp:

- `README.md`
- `docs/HUONG_DAN_SU_DUNG.md`
- `docs/WORKFLOW_REVIEW.md`
- `docs/STATUS_TRANSITION_TABLE.md`
- `static/modules/screen-config.js`

Tài liệu này mô tả flow theo ngữ cảnh vận hành.

Khi cần confirm nhanh một nhánh `được chuyển / không được chuyển`, ưu tiên tra bảng ở [STATUS_TRANSITION_TABLE.md](STATUS_TRANSITION_TABLE.md) trước.

## 1. Luồng tổng quát

```text
Kiểm tra tồn kho
  -> nếu đủ hàng: Tạo đơn xuất hàng -> Quản lý đơn hàng -> Thanh toán
  -> nếu thiếu hàng: Quản lý nhập hàng -> Đã đặt -> Đã nhập kho -> Thanh toán
  -> nếu đang gom nhập batch: Xử lý nhập thiếu -> Quản lý nhập hàng -> Đã đặt -> Đã nhập kho

Nếu phát hiện sai sau khi chứng từ đã xử lý
  -> dùng phiếu điều chỉnh tồn / phiếu trả hàng khách / phiếu trả NCC

Nếu cần can thiệp đặc biệt
  -> Master Admin hoặc user có quyền điều chỉnh tồn khi chỉ cần sửa chênh lệch kho
```

## 2. Luồng tồn kho

- màn chính: `inventory`
- mục tiêu:
  - xem tồn hiện tại
  - phát hiện hàng sắp hết
  - phát hiện hàng đang chờ nhập/chờ xuất
- quy tắc:
  - user thường không chỉnh tồn trực tiếp
  - direct adjust là quyền riêng của `Master Admin` hoặc user có permission `inventory_adjust_manage`
  - direct adjust bắt buộc lý do
  - danh sách tồn kho có thể sắp xếp trong khu vực phân trang theo tên, tồn cao, giá trị tồn, ưu tiên nhập/xử lý hoặc hạn còn ít
  - `Ưu tiên nhập/xử lý` dùng sức bán thật đã chuẩn hóa theo tồn chuẩn và mức thiếu hàng
  - `Hạn còn ít` ưu tiên theo HSD thật của từng lô còn hàng; nếu chưa có HSD lô thì mới fallback về metadata cấp sản phẩm
  - nếu cần điều tra lệch tồn của một mặt hàng, user đi sang màn `product-movements` từ nút `Lịch sử biến động` hoặc từ action `Xem lịch sử` trong detail sản phẩm
  - màn `product-movements` chỉ đọc dữ liệu đã thực sự ảnh hưởng tồn kho; không tính phiếu nháp, phiếu hủy hoặc trạng thái chưa cộng/trừ kho
  - nếu tài khoản có quyền `inventory_adjust_manage`, màn `product-movements` có thêm CTA `Phiếu DC` để mở thẳng phiếu điều chỉnh tồn cho chính sản phẩm đang xem
  - công thức đối chiếu:
    - `tồn đầu kỳ = tồn ban đầu theo ledger trước from_date`
    - `tồn cuối kỳ = tồn đầu kỳ + tổng nhập trong kỳ - tổng xuất trong kỳ`
    - nếu `to_date` là hôm nay hoặc để trống, app mới so sánh tiếp với tồn hiện tại trên hệ thống để báo `OK/Cảnh báo`

## 3. Luồng bán hàng

### Bước 1: Mở giỏ theo khách

- chọn khách có sẵn hoặc gõ tên mới
- mặc định app tạo hoặc mở `draft cart`
- nếu user chủ động bấm `Tạo đơn mới`, hệ thống phải tạo một `draft cart` trắng tách biệt với đơn đang mở, không reuse draft cũ và không tự gộp vào preview hiện tại

### Bước 2: Chọn mặt hàng

- tick sản phẩm để đưa vào giỏ
- hàng đã chọn được gom lên trên
- hàng đã chọn ẩn khỏi danh sách dưới
- riêng dòng mà user chủ động bấm `...` thì vẫn được giữ lại ở danh sách dưới trong lúc thao tác

### Bước 3: Chỉnh dòng hàng

- trong `Giỏ hiện hành`, mỗi dòng hiển thị dưới dạng card gọn 2 dòng; bấm `...` để mở detail
- sửa số lượng
- sửa giá bán riêng cho đơn
- nhập hoặc sửa `ghi chú phiếu xuất` ở cấp toàn đơn
- sửa địa chỉ giao riêng của đơn
- có thể nhập thêm `giảm giá khuyến mại` cho toàn đơn; app tự tính lại số tiền cần thu
- nếu cần, cập nhật luôn giá bán mặc định nhưng UI phải hỏi confirm trước khi áp dụng
- trong lúc đơn còn `draft` hoặc `committed`, vẫn có thể thêm bớt dòng và chỉnh số lượng/giá; chỉ sau `completed` mới khóa nội dung
- từ `committed` trở đi, khách hàng của đơn bị khóa và không được đổi nữa
- đơn xuất có thể được in từ lúc còn `draft` cho tới khi `paid`

### Bước 4: Chốt đơn

- nếu đủ tồn:
  - kiểm tra tồn khả dụng để chốt theo công thức `tồn hiện tại + hàng đã đặt nhập - phần đã giữ cho các đơn committed khác`
  - nếu `Cần thanh toán` đang thấp hơn tổng `giá nhập mặc định` của các dòng hàng, app phải hiện cảnh báo xác nhận thêm trước khi cho chốt
  - ở màn `Đơn hàng`, user có thể tick nhiều phiếu rồi bấm `Chốt đơn`; hệ thống chốt các đơn `draft` hợp lệ và trả lại danh sách phiếu lỗi để xử lý tiếp
  - ở màn `Đơn hàng`, các phiếu `draft/committed` cùng khách có thể được chọn nhiều phiếu để mở flow `gộp đơn`; nếu khác khách thì không cho đi tiếp
  - cart chuyển `committed`
  - phát sinh `order_code` và `committed_at`
  - chưa trừ kho thật
- nếu thiếu tồn:
  - app phải báo trước khi tạo hoặc cập nhật phiếu nhập cho phần còn thiếu
  - nếu đã có phiếu `ordered` đủ số lượng đáp ứng phần thiếu thì vẫn cho `Chốt đơn`; tới bước `Xuất hàng` vẫn phải đợi hàng nhập kho thật
  - nếu phần thiếu mới đang nằm ở phiếu `draft` hoặc phiếu mở chưa đặt đủ thì chỉ thông báo và cho mở lại phiếu liên quan khi user xác nhận cần chỉnh
  - nếu đang ở Batch procurement mode thì không tạo/cập nhật phiếu nhập theo từng cart; app chuyển sang màn `Xử lý nhập thiếu` với phạm vi đơn hiện tại
  - user thường được dẫn sang luồng nhập hàng
  - không bypass chỉnh tồn

### Bước 5: Xuất hàng

- chỉ nhận đơn `committed`
- nếu đủ tồn thực tế:
  - tạo xuất kho
  - trừ kho theo FEFO từ lô có HSD sớm nhất trước
  - nếu `Cần thanh toán` vẫn thấp hơn tổng `giá nhập mặc định` của các dòng hàng, app phải hỏi xác nhận thêm trước khi xuất
  - cart chuyển `completed`
- nếu thiếu tồn thực tế:
  - app báo trước và cho mở/tạo phiếu nhập bù thiếu
  - nếu đang ở Batch procurement mode thì chuyển sang màn `Xử lý nhập thiếu`, không auto-create phiếu nhập theo đơn
- không tự động in phiếu sau khi xuất

### Bước 6: Theo dõi đơn

- màn `orders`
- chỉ xem/in/thanh toán/hủy theo rule
- với user mới, các đơn `completed/paid` còn được gom thêm ở màn `payments` để nhìn nhóm phiếu cần thu tiền riêng
- ở list đơn, nút `In` hiện cho các phiếu chưa thanh toán; với phiếu đã thanh toán thì mở detail để in lại
- từ đơn `completed/paid`, có thể bấm `Xuất lại` để tạo nhanh một đơn nháp mới với cùng khách hàng, địa chỉ giao, giảm giá và các dòng hàng của phiếu đã chọn; nếu khách đã có đơn `draft` thì app sẽ hỏi có dồn thêm vào đơn nháp hiện có để giảm số lần gửi hàng hay tạo nháp mới riêng
- nếu đi từ màn `customers`, app có thể lọc danh sách đơn đúng theo khách; nếu khách chỉ có 1 phiếu thì mở sẵn detail để xem ngay kể cả với đơn đã `completed/paid`
- đơn `draft` có nút `Chốt đơn`, đơn `committed` có nút `Xuất hàng`
- đơn `committed` vẫn cho sửa dòng hàng, địa chỉ giao, ghi chú và giảm giá; không đổi được khách, không được xóa
- đơn `draft/committed` cùng khách vẫn có thể đi vào flow `gộp đơn`; hệ thống giữ lại một phiếu đích rồi chuyển các phiếu nguồn sang `cancelled`
- khi gộp nhiều phiếu xuất cùng khách, phiếu đích sẽ hợp nhất `ghi chú phiếu xuất` theo danh sách duy nhất ngăn bằng ` | `
- đơn đã `completed` không sửa trực tiếp mặt hàng, số lượng, giá hay địa chỉ giao; trước thanh toán vẫn cho sửa `giảm giá khuyến mại`; riêng `ghi chú phiếu xuất` có thể sửa ở mọi trạng thái
- nếu đơn đã `completed/paid` bị nhập nhầm, user phải tạo `Yêu cầu hủy` có lý do; quản lý/Admin duyệt xong thì app mới chuyển đơn sang `cancelled`, hoàn lại tồn theo đúng lô đã xuất và loại trừ doanh thu/giá vốn của đơn ra khỏi báo cáo

### Luồng xử lý nhanh xuất hàng

- card `Xử lý nhanh` nằm ngay trong màn `create-order`; đây là luồng tạo một phiếu xuất đã xử lý xong ngoài thực tế rồi mới ghi lại vào app
- flow này không thay thế `draft -> committed -> completed -> paid`; nó chỉ tự chạy nhanh các bước sẵn có trên một màn và lưu một lần
- user nhập `khách / ngày xuất / ghi chú / mặt hàng`; sau khi chọn khách, UI ưu tiên đưa focus sang khu vực thêm hàng để thao tác nhanh trên mobile
- mỗi dòng hàng hiển thị `số lượng / giá bán / thành tiền / tồn hiện tại`
- validation:
  - bắt buộc có khách
  - bắt buộc có ít nhất một dòng hàng
  - số lượng phải `> 0`
  - nếu giá bán bằng `0` hoặc bỏ trống thì UI chỉ cảnh báo/confirm theo rule hiện tại
  - nếu số lượng xuất vượt tồn hiện tại thì chặn lưu; Issue này chưa mở nhánh override theo quyền riêng
- trạng thái cuối cùng chỉ dùng trạng thái sẵn có của repo:
  - chọn `Chỉ chốt đơn` -> tạo phiếu `committed`, chưa trừ tồn
  - chọn `Đã xuất hàng` -> tạo phiếu `completed`, trừ tồn và ghi stock movement `OUT`
  - chọn `Đã xuất hàng` + `Đã thanh toán luôn` -> tạo phiếu `paid`, vẫn đi nội bộ qua `draft -> committed -> completed -> paid`
- mọi phiếu tạo từ flow này đều gắn `created_mode = quick_export`
- audit/history phải ghi rõ `Tạo bằng Xử lý nhanh xuất hàng`, người thực hiện, thời gian thực hiện và các bước tự động đã chạy
- sau khi lưu thành công, card hiển thị summary `mã phiếu / số mặt hàng / tổng tiền / trạng thái / thanh toán` cùng CTA `Tiếp tục xuất nhanh / Xem phiếu / Về danh sách`
- shortcut hiện có trong card:
  - `Lấy từ đơn đang mở`
  - `Thêm hàng mới`
- flow `bulk-orders` vẫn là luồng khác để tạo nhiều đơn cùng lúc; không dùng chung dữ liệu trạng thái với card `Xử lý nhanh`

### Luồng tạo nhiều đơn mobile-first

- màn `bulk-orders` vừa là chỗ nhập nhanh nhiều cart, vừa có thêm lớp request approval khi login bật cho user không có quyền `order_batch_manage`
- user thêm nhiều khách, mỗi khách có nhiều mặt hàng trên card riêng
- action `Lưu nháp`:
  - với user quản lý hoặc `Master Admin`: tạo hoặc cập nhật từng cart ở trạng thái `draft`
  - với user thường: tạo `bulk_order_request` ở trạng thái `pending_approval`
  - cả 2 đường đều không giữ hàng, không trừ kho
  - nếu khách đang có draft cart và user chọn merge thì hệ thống vẫn giữ rule dồn vào draft hiện có ở bước xử lý thực tế
- action `Chốt đơn hợp lệ`:
  - backend luôn validate lại toàn bộ payload và tồn khả dụng, không tin dữ liệu frontend
  - với user quản lý hoặc `Master Admin`: với từng khách, hệ thống tạo hoặc cập nhật draft trước, rồi mới kiểm tồn theo đúng công thức `tồn hiện tại + hàng đã đặt nhập - phần đã giữ cho các đơn committed khác`
  - với user thường: backend chỉ lưu request `pending_approval`, chưa ghi cart chính thức
  - request đang `pending_approval` hoặc `approved` nhưng chưa `processed` phải hiện cho mọi user để tránh tạo trùng
  - user có `order_batch_manage` được `Approve/Reject`; owner của request hoặc user quản lý được `Xóa` khi request còn `pending_approval`; owner của request đã `approved` hoặc user quản lý đều có thể `Xử lý`
  - khi request được xử lý thật, đơn đủ điều kiện mới chuyển `draft -> committed`; đơn lỗi giữ ở `draft` để user sửa tiếp và response vẫn trả chi tiết theo từng khách, từng sản phẩm thiếu
- request batch phải có `request_id` duy nhất để chống double-submit; nếu server nhận lại cùng `request_id` thì replay kết quả cũ, không tạo trùng đơn
- request approval cũng phải có `request_id` duy nhất; duplicate request active phải chặn user thường, còn user có `order_batch_manage` chỉ bị cảnh báo và có thể xác nhận đi tiếp
- mỗi request và mỗi đơn thực tế tạo từ flow này đều có popup `Lịch sử`; dữ liệu log đọc riêng theo chứng từ khi user mở detail, không nạp sẵn vào list
- v1 không có bước xuất hàng hàng loạt; nếu sau này cần, đó phải là action riêng và vẫn chỉ được đi tiếp `committed -> completed`

## 4. Luồng nhập hàng

### Bước 1: Tạo hoặc mở phiếu nhập

- từ màn `purchases`
- có thể đi từ shortage flow của bán hàng
- phiếu nháp chỉ được lưu thật khi đã có ít nhất một mặt hàng; phiếu trống chỉ là trạng thái mở tạm trên giao diện

### Bước 2: Chọn hàng cần nhập

- thêm từ danh sách gợi ý
- có thể sửa nhanh ô `SL` ngay trên card gợi ý trước khi bấm `+ Phiếu`
- hàng đã chọn được gom vào phần tóm tắt phiếu

### Bước 3: Chọn NCC và chỉnh dòng nhập

- gán nhà cung cấp
- mỗi nhà cung cấp chỉ giữ tối đa 1 phiếu `draft`; nếu chọn lại đúng NCC đã có nháp thì app mở lại phiếu đó để nhập tiếp, còn nếu chọn NCC khác thì phiếu cũ được giữ nguyên và app mở nháp riêng cho NCC mới
- nếu phiếu `draft` chưa có NCC, app được tự gán NCC khi các mặt hàng vừa thêm chỉ từng nhập thực tế từ đúng 1 NCC; nếu có nhiều NCC từng nhập thì chỉ sắp xếp gợi ý NCC theo tổng số lượng/số lần nhập, không tự đổi NCC
- nếu khi chọn mặt hàng vào phiếu mà mặt hàng đó đang nằm ở phiếu `draft/ordered` của NCC khác, app phải cảnh báo ngay và cho user chọn mở danh sách các phiếu liên quan để review trước khi quyết định dồn về một NCC hay giữ nguyên hiện trạng
- phiếu `draft` đang trống vẫn có thể xóa ngay trên UI mà không cần lưu xuống DB
- nếu phiếu được tạo từ đơn thiếu hàng, app giữ liên kết nguồn đơn riêng trong metadata của phiếu, không nhét sẵn vào ô ghi chú
- các phiếu `draft/ordered` cùng NCC có thể được chọn nhiều phiếu để mở flow `gộp đơn`
- sửa số lượng, giá nhập, mã lô và HSD của từng dòng; mặc định nhập trực tiếp HSD, hoặc có thể chuyển sang nhập gián tiếp bằng `Ngày sản xuất` để app tự tính HSD theo thời gian bảo quản
- nếu cùng một sản phẩm về nhiều lô khác nhau thì tách thành nhiều dòng riêng
- bắt buộc có nhà cung cấp trước khi chuyển phiếu sang `ordered`
- có thể nhập thêm `giảm giá khuyến mại` cho toàn phiếu để phản ánh số tiền thực trả NCC
- phiếu nhập có thể được in từ lúc còn `draft` cho tới khi `paid`; ở list phiếu, nút `In` được ẩn khi phiếu đã thanh toán để giao diện gọn hơn
- có thể đổi giá nhập mặc định nhưng UI phải hỏi confirm trước khi áp dụng
- nếu mở luồng tạo NCC khi phiếu chưa có mặt hàng, app chỉ giữ giá trị NCC trên UI để quay lại tiếp tục nhập hàng, không lưu phiếu nháp rỗng xuống DB; nếu phiếu đang là `draft` và đã có NCC thì bấm nút `NCC` vẫn phải cho chọn NCC khác
- nhà cung cấp chỉ được đổi khi phiếu còn `draft`; từ `ordered` trở đi phải giữ nguyên NCC đã chốt
- ngoại lệ compatibility: nếu DB cũ còn phiếu `ordered` nhưng thiếu `supplierName` hoặc thiếu item hợp lệ, app phải nhận diện đó là phiếu lỗi dữ liệu có thể repair để cho sửa NCC hoặc hủy/xóa dọn dữ liệu, thay vì khóa chết UI
- nếu bỏ trống mã lô thì app tự sinh batch code khi nhập kho; nếu không nhập HSD thì app có thể fallback sang HSD tự tính `ngày nhập kho + thời gian bảo quản`, còn nếu cũng không có metadata bảo quản thì lô vẫn được quản lý nhưng không có hạn thật

### Bước 4: Chạy trạng thái workflow

```text
draft -> ordered -> received -> paid
draft -> cancelled
ordered -> cancelled
```

### Rule chính

- `draft` chỉ là trạng thái chuẩn bị, chưa cho nhập kho
- `ordered` mới được nhập kho và vẫn cho sửa trực tiếp để thêm bớt theo biến động thực tế
- nếu chưa có nhà cung cấp thì không được chuyển `draft -> ordered` hoặc `ordered -> received`
- ở màn `Nhập hàng`, user có thể tick nhiều phiếu rồi bấm `Đặt hàng`; hệ thống chỉ chuyển các phiếu `draft` có NCC hợp lệ sang `ordered`, còn phiếu lỗi giữ nguyên để user rà lại
- từ `ordered` trở đi không được đổi `supplierName`; UI phải khóa ô NCC và nút `NCC` trên mọi thiết bị
- nếu sau khi review mà một mặt hàng vẫn còn nằm ở nhiều NCC mở khác nhau thì đây chỉ là cảnh báo nghiệp vụ cho user biết, không phải lỗi chặn workflow
- ngoại lệ duy nhất là phiếu legacy bị đánh dấu `repairableInvalid`; trường hợp này UI mở lại thao tác sửa NCC hoặc xóa/hủy để cứu dữ liệu cũ, nhưng không coi là workflow chuẩn hằng ngày
- các metadata legacy khác như thiếu `paid_at`, thiếu `received_at` raw DB, hoặc thiếu `source_code` của phiếu nhập sinh ra từ đơn thiếu hàng phải đi qua khối `Legacy Audit` ở `Master Admin`
- `Legacy Audit` chỉ auto-fix các mốc thời gian chắc chắn; các thao tác gắn `receipt_code` hoặc `đơn nguồn` luôn cần admin xác nhận thủ công
- chỉ `received` mới được `paid`
- `received` chỉ còn cho sửa `giảm giá khuyến mại` và metadata HSD/NSX của từng dòng; riêng `ghi chú` có thể sửa ở mọi trạng thái; từ `paid` / `cancelled` trở đi chuyển sang chỉ xem đối với các field còn lại
- nếu phiếu `received/paid` bị nhập nhầm, user phải tạo `Yêu cầu hủy` có lý do; chỉ quản lý/Admin mới được duyệt, và khi duyệt app sẽ rút lại đúng lượng đã nhập từ lô gốc nếu chưa bị dùng mất, đồng thời loại chi phí mua của phiếu ra khỏi báo cáo
- với user mới, các phiếu `received/paid` còn được gom thêm ở màn `payments` để nhìn nhóm phiếu cần trả tiền riêng
- từ phiếu `received/paid`, có thể bấm `Nhập lại` để tạo nhanh một phiếu nháp mới cùng NCC, ghi chú, giảm giá và các dòng hàng; nếu NCC đã có phiếu `draft` thì app dồn thêm vào phiếu nháp hiện có để không tạo draft thứ hai
- khi `Nhập lại`, app chỉ sao chép nội dung đặt hàng; metadata lô như `batchCode`, `expiryDate`, `manufactureDate` phải reset về trống để nhập lại theo lô mới
- flow `gộp đơn` phiếu nhập giữ lại một phiếu đích, dồn tất cả dòng hàng và giảm giá vào phiếu đó, hợp nhất `ghi chú` theo danh sách duy nhất ngăn bằng ` | `, rồi chuyển các phiếu nguồn sang `cancelled`
- khi Batch procurement mode đang bật, chỉ người giữ khóa batch hoặc `Master Admin` mới được tạo mới, sửa cấu trúc, đổi NCC, đổi giảm giá, hủy hoặc xóa phiếu `draft/ordered`; user khác chỉ được đi tiếp `ordered -> received` nếu phiếu không phải batch và đã `ordered` trước lúc lock hiện tại được acquire, rồi mới đi tiếp `received -> paid`
- trước mọi thao tác đổi trạng thái hoặc xóa hẳn chứng từ nháp như `draft -> completed`, `draft -> ordered`, `ordered -> received`, `received -> paid`, chuyển sang `cancelled` hoặc xóa phiếu được phép xóa, UI phải hiện message confirm trước khi ghi nhận

### Luồng xử lý nhanh nhập hàng

- card `Xử lý nhanh` nằm ngay trong màn `purchases`; đây là luồng ghi nhanh một phiếu nhập đã đặt/nhận hàng xong ngoài thực tế rồi mới cập nhật app
- flow này không thay thế `draft -> ordered -> received -> paid`; nó chỉ gom thao tác vào một màn và tự đi các bước nội bộ cần thiết
- user nhập `NCC / ngày nhập / ghi chú / mặt hàng`; sau khi chọn NCC, UI ưu tiên đưa focus sang khu vực thêm hàng
- mỗi dòng hàng hiển thị `số lượng / giá nhập / thành tiền`
- validation:
  - bắt buộc có NCC
  - bắt buộc có ít nhất một dòng hàng
  - số lượng phải `> 0`
  - nếu giá nhập bằng `0` hoặc bỏ trống thì UI chỉ cảnh báo/confirm theo rule hiện tại
- trạng thái cuối cùng chỉ dùng trạng thái sẵn có của repo:
  - chọn `Chỉ đặt hàng` -> tạo phiếu `ordered`, chưa cộng tồn
  - chọn `Đã nhập hàng` -> tạo phiếu `received`, cộng tồn và ghi stock movement `IN`
  - chọn `Đã nhập hàng` + `Đã thanh toán luôn` -> tạo phiếu `paid`, vẫn đi nội bộ qua `draft -> ordered -> received -> paid`
- mọi phiếu tạo từ flow này đều gắn `created_mode = quick_import`
- audit/history phải ghi rõ `Tạo bằng Xử lý nhanh nhập hàng`, người thực hiện, thời gian thực hiện và các bước tự động đã chạy
- sau khi lưu thành công, card hiển thị summary `mã phiếu / số mặt hàng / tổng tiền / trạng thái / thanh toán` cùng CTA `Tiếp tục nhập nhanh / Xem phiếu / Về danh sách`
- shortcut hiện có trong card:
  - `Lấy từ phiếu đang mở`
  - `Thêm hàng mới`

## 4A. Luồng quản lý thanh toán đơn giản

- màn chính: `payments`
- mục tiêu:
  - gom riêng các phiếu đã tới bước thu/chi tiền để user mới không phải rà lẫn trong toàn bộ list đơn và phiếu nhập
  - cho cập nhật nhanh `ngày thanh toán`, `phương thức`, `ghi chú`
- phạm vi phase hiện tại:
  - mỗi phiếu chỉ có một trạng thái thanh toán `unpaid/paid`
  - không có thanh toán nhiều lần
  - không có thanh toán một phần
- tab `Khách hàng`:
  - lấy các đơn `completed` hoặc `paid`
  - phiếu `completed + payment_status=unpaid` hiện là `Chưa thanh toán`
  - khi user bấm `Đánh dấu đã thanh toán`, hệ thống lưu `payment_status=paid`, `paid_at`, `payment_method`, `payment_note`
- tab `Nhà cung cấp`:
  - lấy các phiếu nhập `received` hoặc `paid`
  - phiếu `received` hiện là `Chưa thanh toán`
  - khi user bấm `Đánh dấu đã thanh toán`, hệ thống chuyển `status=paid` đồng thời lưu `paid_at`, `payment_method`, `payment_note`
- cả 2 tab đều phải cho:
  - search theo mã phiếu và tên đối tượng
  - filter `Chưa thanh toán / Đã thanh toán / Tất cả`
  - mở nhanh lại phiếu gốc ở màn `orders` hoặc `purchases`

## 5. Luồng xử lý nhập thiếu batch

### Mục tiêu

- dùng cho kỳ gom nhập định kỳ hoặc lúc có nhiều đơn đang thiếu hàng
- tổng hợp nhu cầu theo sản phẩm từ cả đơn `draft` và `committed`
- tạo phiếu nhập đủ để đáp ứng nhu cầu xuất dự kiến, đồng thời cảnh báo nếu sau nhập vẫn thấp hơn ngưỡng tồn kho

### Mode vận hành

- Daily mode:
  - phù hợp 1-3 user thao tác nhanh theo từng đơn
  - shortage flow vẫn dùng luồng nhanh ở màn `Quản lý nhập hàng`
- Batch mode:
  - do `Master Admin` hoặc user có quyền `procurement_batch_manage` bắt đầu
  - hệ thống tạo `workflow_locks.lock_key = procurement_batch`
  - chỉ một người giữ khóa xử lý tạo phiếu nhập batch tại một thời điểm
  - shortage từ chốt/xuất đơn chuyển về màn `Xử lý nhập thiếu`
  - nếu planner đang hiện khối phiếu liên quan có thể gộp, app cho mở flow `gộp đơn` nhưng chặn trộn phiếu nhập và phiếu xuất trong cùng một lần thao tác

### Rule gom phiếu

- một sản phẩm thiếu chỉ được có một assignment active tới một phiếu nhập batch mở
- không tách cùng một sản phẩm thiếu thành nhiều phiếu nhập trong kỳ gom
- người xử lý tick chọn nhiều dòng, chọn NCC từ danh bạ và nhập số lượng dự kiến trước khi tạo phiếu
- người giữ khóa batch có thể thêm extra rows trong khối `Chọn thêm sản phẩm khác` để gom vài mặt hàng ngoài nhu cầu đơn vào cùng kỳ nhập
- dòng chưa chọn NCC hợp lệ bị bỏ qua và phải thông báo rõ cho user
- nếu NCC chưa có trong danh bạ, user được chuyển sang màn `Nhà cung cấp` để tạo mới rồi quay lại planner
- các dòng chọn cùng một NCC phải gom vào cùng một phiếu nhập batch `draft`
- extra rows không tạo assignment shortage; chúng chỉ đi qua check chuẩn của purchase draft và được merge vào đúng phiếu batch draft đang có nếu cùng NCC
- nếu extra row trùng sản phẩm đang có assignment batch active hoặc đã nằm trong purchase batch draft khác, hệ thống không tách phiếu mới mà buộc dùng cùng NCC/phiếu đang xử lý
- sau khi tạo phiếu, user review/chỉnh detail các phiếu nhập batch bằng luồng detail/list rồi quay lại planner refresh trạng thái
- nếu cần đổi nhà cung cấp hoặc số lượng sau khi đã tạo, xử lý trên phiếu đang được gán thay vì tạo phiếu khác
- phiếu tạo từ planner vẫn là purchase `draft`; workflow sau đó giữ nguyên `draft -> ordered -> received -> paid`
- assignment active của phiếu batch sẽ tự release khi phiếu chuyển sang `received`, bị `cancelled`, bị xóa, hoặc dòng sản phẩm bị gỡ khỏi phiếu
- khi kết thúc batch, lock được đóng và hệ thống quay về Daily mode
- khi lock batch còn active, các màn `inventory`, `create-order`, `orders`, `purchases`, `suppliers`, `procurement-planner` phải hiện cảnh báo cho biết owner của lock và impact chính trên màn hiện tại
- nếu owner rời các màn trong flow batch (`procurement-planner`, `purchases`, `suppliers`) sang màn ngoài flow khi lock còn active, UI phải hỏi có muốn kết thúc batch ngay không; nếu user không kết thúc batch thì phải hỏi tiếp để chọn `ở lại` hay `chuyển sang màn khác mà vẫn giữ nguyên batch mode`

## 6. Luồng sửa sai sau khi đã xử lý chứng từ

### Phiếu điều chỉnh tồn

- dùng khi kiểm kho lệch hoặc chênh lệch nội bộ
- có thể tăng hoặc giảm tồn
- chỉ `Master Admin` hoặc user có permission `inventory_adjust_manage`

### Phiếu trả hàng khách

- dùng khi khách trả hàng
- tồn kho tăng lại
- luôn khởi tạo từ detail của đúng đơn `completed`; không còn form trả hàng độc lập ở ngoài list đơn

### Phiếu trả NCC

- dùng khi trả ngược hàng lỗi cho NCC
- tồn kho giảm
- mặc định trừ theo FEFO; nếu dòng trả chỉ rõ mã lô thì ưu tiên trừ đúng lô đó
- luôn khởi tạo từ detail của đúng phiếu `received/paid`; không còn form trả NCC độc lập ở ngoài list nhập hàng

### Nguyên tắc chung

- không sửa ngược chứng từ cũ
- tạo chứng từ mới để giữ lịch sử
- hủy sai chứng từ đã khóa cũng đi theo nguyên tắc này: tạo `Yêu cầu hủy`, chờ duyệt, rồi backend sinh chứng từ bù trừ thay vì mở khóa đơn/phiếu cũ

## 7. Luồng quản lý danh mục

### Sản phẩm

- thêm mới
- cấu hình Đơn vị cơ sở (`base_unit`), Đơn vị nhập mặc định (`default_purchase_unit`), Đơn vị bán mặc định (`default_sale_unit`)
- cấu hình bảng Quy đổi đơn vị (`product_unit_conversion`) cho từng sản phẩm
- sửa giá nhập / giá bán mặc định
- soft delete khi ngừng bán
- xem audit lịch sử sản phẩm
- khai báo hạn dùng / thời gian bảo quản theo ngày để làm fallback khi lô chưa có HSD thật

### 7A. Luồng quy đổi đa đơn vị tính (Multi-Unit Conversion)

- **Nguyên tắc Base Unit**:
  - Mỗi sản phẩm có một `Đơn vị cơ sở` (Base Unit) cố định (ví dụ: `hũ`, `gói`, `lạng`...).
  - Mọi biến động kho, số lượng tồn kho vật lý và sổ kho (Ledger) luôn luôn được tính toán và lưu trữ theo Đơn vị cơ sở.
- **Quy đổi linh hoạt theo từng sản phẩm**:
  - Không dùng tỷ lệ quy đổi chung cho toàn hệ thống vì mỗi loại thực phẩm có quy cách đóng gói khác nhau (vd: 1 thùng = 12 hũ đối với Nấm kho, nhưng 1 thùng = 24 lon đối với Nước sâm).
  - Từng sản phẩm có thể định nghĩa nhiều đơn vị quy đổi (`from_unit`) với hệ số quy đổi ra đơn vị cơ sở (`conversion_factor`) kèm giá bán và giá nhập riêng biệt.
- **Bảo toàn số lượng khi đổi đơn vị trên giao diện**:
  - Khi người dùng đổi đơn vị tính trong giỏ hàng hoặc phiếu nhập:
    $$\text{base\_quantity} = \text{old\_quantity} \times \text{old\_factor}$$
    $$\text{new\_quantity} = \text{round}\left(\frac{\text{base\_quantity}}{\text{new\_factor}}, 4\right)$$
  - Đơn giá tự động được điền theo bảng giá của đơn vị mới được chọn.
- **Bảo toàn lịch sử chứng từ (Snapshotting)**:
  - Trên từng dòng chi tiết của đơn hàng (`cart_items`), phiếu nhập (`purchase_items`) và phiếu kho (`inventory_receipt_items`), hệ thống lưu snapshot:
    - `input_quantity`: Số lượng theo đơn vị người dùng nhập.
    - `input_unit`: Tên đơn vị người dùng đã chọn tại thời điểm thao tác.
    - `conversion_factor`: Hệ số quy đổi tại thời điểm tạo/chốt dòng hàng.
    - `unit_price` / `unit_cost`: Đơn giá tại thời điểm tạo dòng hàng.
  - Khi danh mục sản phẩm sau này có thay đổi tỉ lệ quy đổi (ví dụ nhà sản xuất đổi quy cách 1 thùng từ 12 lên 14), các chứng từ đã phát sinh trong quá khứ vẫn giữ nguyên giá trị lịch sử và số lượng tồn kho đã trừ/cộng.

### Khách hàng

- lưu danh bạ giao hàng
- mở nhanh giỏ hàng
- từ badge `giỏ chờ` / `đơn` trên card khách có thể mở nhanh list phiếu của đúng khách hoặc nhảy thẳng vào detail nếu chỉ có 1 phiếu

### Nhà cung cấp

- lưu nguồn hàng
- tái sử dụng cho phiếu nhập

## 8. Luồng nhiều máy

- tất cả máy dùng chung cùng server/app
- state chính cho `customers/suppliers/carts/purchases` lưu ở SQLite
- app tự refresh khi người dùng đang rảnh
- khi lưu draft, client gửi version `expected_updated_at`
- Batch procurement dùng workflow lock ở server để tránh nhiều user cùng gom nhập song song
- nếu stale:
  - server trả `409`
  - UI phải tải lại để tránh ghi đè

## 9. Luồng báo cáo

- chọn tháng chính hoặc khoảng ngày
- xem:
  - chi nhập
  - doanh thu
  - giá vốn
  - lãi gộp
  - xu hướng tháng
  - forecast nhập hàng

## 10. Luồng quản trị hệ thống

- màn `admin`
- đăng nhập bằng cấu hình runtime
- chức năng:
  - export/import master data
  - backup database
  - restore database

## 11. Rule business cốt lõi

- `products.price` là giá nhập mặc định
- `products.sale_price` là giá bán mặc định
- tồn kho chuẩn phải đi qua `đơn chờ xuất` hoặc `phiếu chờ nhập`
- chỉ `Master Admin` hoặc user có permission `inventory_adjust_manage` mới được bypass quy trình chuẩn để chỉnh tồn trực tiếp
- sai sót sau khi chứng từ đã xử lý phải đi qua chứng từ điều chỉnh
- trong Batch procurement mode, không auto-create phiếu nhập theo từng cart và không tách 1 sản phẩm thiếu sang nhiều phiếu nhập mở
- trước khi bật Batch procurement mode, backend phải audit nhanh các phiếu nhập `draft/ordered`; nếu một sản phẩm đang bị cover bởi nhiều phiếu mở thì chặn acquire lock và yêu cầu dọn conflict trước
- khi bị chặn vì conflict đầu kỳ gom, app phải hiện ngay danh sách phiếu nhập mở liên quan để user mở đúng chứng từ và dọn conflict
