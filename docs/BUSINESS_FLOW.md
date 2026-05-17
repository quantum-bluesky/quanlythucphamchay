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
  -> nếu đủ hàng: Tạo đơn xuất hàng -> Quản lý đơn hàng -> Đã thanh toán
  -> nếu thiếu hàng: Quản lý nhập hàng -> Đã đặt -> Đã nhập kho -> Đã thanh toán
  -> nếu đang gom nhập batch: Xử lý nhập thiếu -> Quản lý nhập hàng -> Đã đặt -> Đã nhập kho

Nếu phát hiện sai sau khi chứng từ đã xử lý
  -> dùng phiếu điều chỉnh tồn / phiếu trả hàng khách / phiếu trả NCC

Nếu cần can thiệp đặc biệt
  -> Master Admin
```

## 2. Luồng tồn kho

- màn chính: `inventory`
- mục tiêu:
  - xem tồn hiện tại
  - phát hiện hàng sắp hết
  - phát hiện hàng đang chờ nhập/chờ xuất
- quy tắc:
  - user thường không chỉnh tồn trực tiếp
  - direct adjust là quyền riêng của Master Admin
  - direct adjust bắt buộc lý do
  - danh sách tồn kho có thể sắp xếp trong khu vực phân trang theo tên, tồn cao, giá trị tồn, ưu tiên nhập/xử lý hoặc hạn còn ít
  - `Ưu tiên nhập/xử lý` dùng sức bán thật đã chuẩn hóa theo tồn chuẩn và mức thiếu hàng
  - `Hạn còn ít` ưu tiên theo HSD thật của từng lô còn hàng; nếu chưa có HSD lô thì mới fallback về metadata cấp sản phẩm

## 3. Luồng bán hàng

### Bước 1: Mở giỏ theo khách

- chọn khách có sẵn hoặc gõ tên mới
- app tạo hoặc mở `draft cart`

### Bước 2: Chọn mặt hàng

- tick sản phẩm để đưa vào giỏ
- hàng đã chọn được gom lên trên
- hàng đã chọn ẩn khỏi danh sách dưới
- riêng dòng mà user chủ động bấm `...` thì vẫn được giữ lại ở danh sách dưới trong lúc thao tác

### Bước 3: Chỉnh dòng hàng

- trong `Giỏ hiện hành`, mỗi dòng hiển thị dưới dạng card gọn 2 dòng; bấm `...` để mở detail
- sửa số lượng
- sửa giá bán riêng cho đơn
- sửa địa chỉ giao riêng của đơn
- có thể nhập thêm `giảm giá khuyến mại` cho toàn đơn; app tự tính lại số tiền cần thu
- nếu cần, cập nhật luôn giá bán mặc định
- trong lúc đơn còn `draft` hoặc `committed`, vẫn có thể thêm bớt dòng và chỉnh số lượng/giá; chỉ sau `completed` mới khóa nội dung
- từ `committed` trở đi, khách hàng của đơn bị khóa và không được đổi nữa

### Bước 4: Chốt đơn

- nếu đủ tồn:
  - kiểm tra tồn khả dụng để chốt theo công thức `tồn hiện tại + hàng đã đặt nhập - phần đã giữ cho các đơn committed khác`
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
  - cart chuyển `completed`
- nếu thiếu tồn thực tế:
  - app báo trước và cho mở/tạo phiếu nhập bù thiếu
  - nếu đang ở Batch procurement mode thì chuyển sang màn `Xử lý nhập thiếu`, không auto-create phiếu nhập theo đơn
- không tự động in phiếu sau khi xuất

### Bước 6: Theo dõi đơn

- màn `orders`
- chỉ xem/in/thanh toán/hủy theo rule
- nếu đi từ màn `customers`, app có thể lọc danh sách đơn đúng theo khách; nếu khách chỉ có 1 phiếu thì mở sẵn detail để xem ngay kể cả với đơn đã `completed/paid`
- đơn `draft` có nút `Chốt đơn`, đơn `committed` có nút `Xuất hàng`
- đơn `committed` vẫn cho sửa dòng hàng, địa chỉ giao và giảm giá; không đổi được khách, không được xóa
- đơn đã `completed` không sửa trực tiếp mặt hàng, số lượng, giá hay địa chỉ giao; ngoại lệ duy nhất trước thanh toán là vẫn cho sửa `giảm giá khuyến mại` của toàn đơn

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
- phiếu `draft` đang trống vẫn có thể xóa ngay trên UI mà không cần lưu xuống DB
- nếu phiếu được tạo từ đơn thiếu hàng, app giữ liên kết nguồn đơn riêng trong metadata của phiếu, không nhét sẵn vào ô ghi chú
- sửa số lượng, giá nhập, mã lô và HSD của từng dòng; mặc định nhập trực tiếp HSD, hoặc có thể chuyển sang nhập gián tiếp bằng `Ngày sản xuất` để app tự tính HSD theo thời gian bảo quản
- nếu cùng một sản phẩm về nhiều lô khác nhau thì tách thành nhiều dòng riêng
- bắt buộc có nhà cung cấp trước khi chuyển phiếu sang `ordered`
- có thể nhập thêm `giảm giá khuyến mại` cho toàn phiếu để phản ánh số tiền thực trả NCC
- có thể đổi giá nhập mặc định
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
- từ `ordered` trở đi không được đổi `supplierName`; UI phải khóa ô NCC và nút `NCC` trên mọi thiết bị
- ngoại lệ duy nhất là phiếu legacy bị đánh dấu `repairableInvalid`; trường hợp này UI mở lại thao tác sửa NCC hoặc xóa/hủy để cứu dữ liệu cũ, nhưng không coi là workflow chuẩn hằng ngày
- các metadata legacy khác như thiếu `paid_at`, thiếu `received_at` raw DB, hoặc thiếu `source_code` của phiếu nhập sinh ra từ đơn thiếu hàng phải đi qua khối `Legacy Audit` ở `Master Admin`
- `Legacy Audit` chỉ auto-fix các mốc thời gian chắc chắn; các thao tác gắn `receipt_code` hoặc `đơn nguồn` luôn cần admin xác nhận thủ công
- chỉ `received` mới được `paid`
- `received` chỉ còn cho sửa `giảm giá khuyến mại` và metadata HSD/NSX của từng dòng; từ `paid` / `cancelled` trở đi chuyển sang chỉ xem hoàn toàn
- khi Batch procurement mode đang bật, chỉ người giữ khóa batch hoặc `Master Admin` mới được tạo mới, sửa cấu trúc, đổi NCC, đổi giảm giá, hủy hoặc xóa phiếu `draft/ordered`; user khác chỉ được đi tiếp `ordered -> received` nếu phiếu không phải batch và đã `ordered` trước lúc lock hiện tại được acquire, rồi mới đi tiếp `received -> paid`
- trước mọi thao tác đổi trạng thái hoặc xóa hẳn chứng từ nháp như `draft -> completed`, `draft -> ordered`, `ordered -> received`, `received -> paid`, chuyển sang `cancelled` hoặc xóa phiếu được phép xóa, UI phải hiện message confirm trước khi ghi nhận

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
- chỉ admin

### Phiếu trả hàng khách

- dùng khi khách trả hàng
- tồn kho tăng lại

### Phiếu trả NCC

- dùng khi trả ngược hàng lỗi cho NCC
- tồn kho giảm
- mặc định trừ theo FEFO; nếu dòng trả chỉ rõ mã lô thì ưu tiên trừ đúng lô đó

### Nguyên tắc chung

- không sửa ngược chứng từ cũ
- tạo chứng từ mới để giữ lịch sử

## 7. Luồng quản lý danh mục

### Sản phẩm

- thêm mới
- sửa giá nhập / giá bán mặc định
- soft delete khi ngừng bán
- xem audit lịch sử sản phẩm
- khai báo hạn dùng / thời gian bảo quản theo ngày để làm fallback khi lô chưa có HSD thật

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
- chỉ `Master Admin` mới được bypass quy trình chuẩn để chỉnh tồn trực tiếp
- sai sót sau khi chứng từ đã xử lý phải đi qua chứng từ điều chỉnh
- trong Batch procurement mode, không auto-create phiếu nhập theo từng cart và không tách 1 sản phẩm thiếu sang nhiều phiếu nhập mở
- trước khi bật Batch procurement mode, backend phải audit nhanh các phiếu nhập `draft/ordered`; nếu một sản phẩm đang bị cover bởi nhiều phiếu mở thì chặn acquire lock và yêu cầu dọn conflict trước
- khi bị chặn vì conflict đầu kỳ gom, app phải hiện ngay danh sách phiếu nhập mở liên quan để user mở đúng chứng từ và dọn conflict
