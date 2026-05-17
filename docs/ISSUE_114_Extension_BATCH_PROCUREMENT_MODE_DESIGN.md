# No.114 — Mở rộng màn `Xử lý nhập thiếu` bằng khối phụ `Chọn thêm sản phẩm khác`

## Tóm tắt
Giữ nguyên định vị của màn hiện tại là **shortage planner**, không tạo thêm một mode “nhập hàng loạt không lock”. Thay vào đó, mở rộng ngay trên màn `procurement-planner` bằng một khối phụ `Chọn thêm sản phẩm khác` để người giữ khóa batch có thể thêm các mặt hàng ngoài nhu cầu đơn vào cùng luồng gom phiếu hiện có.

Quyết định đã chốt:
- Khối `Chọn thêm sản phẩm khác` chỉ dùng trong **Batch mode** và chỉ cho **lock owner / Master Admin** thao tác tạo phiếu.
- Button ở màn `Tồn kho` **giữ tên cũ** là `Xử lý nhập thiếu`.

## Thay đổi thiết kế chính

### 1. Mô hình màn hình
- Giữ nguyên **shortage rows** là list chính của planner: vẫn hiển thị tồn hiện tại, nhu cầu đơn nháp/chốt, chờ nhập, cần nhập, dự kiến sau nhập.
- Thêm một khối phụ riêng bên dưới hoặc sau list chính: `Chọn thêm sản phẩm khác`.
- Khối phụ này không trộn trực tiếp vào `rows` hiện tại để tránh làm mờ nghĩa của các cột `Cần nhập`, `Nhu cầu`, `Dự kiến sau nhập`.
- Khi tạo phiếu, hệ thống vẫn gom theo NCC chung giữa:
  - các dòng shortage đã tick
  - các dòng extra do user thêm tay

### 2. Rule backend cho các dòng “ngoài nhu cầu đơn”
- Extra rows **không đi qua rule assignment shortage** hiện tại.
- Không tạo `procurement_assignment` cho extra rows, vì chúng không đại diện cho một “mặt hàng thiếu” phát sinh từ demand.
- Rule `1 sản phẩm thiếu -> 1 phiếu nhập batch mở` chỉ tiếp tục áp dụng cho **shortage rows**.
- Với extra rows, backend chỉ áp dụng các check chuẩn của purchase draft:
  - sản phẩm phải tồn tại và còn active
  - số lượng > 0
  - NCC phải hợp lệ
  - giá nhập và giảm KM phải hợp lệ
- Khi user thêm một extra row có product đang:
  - đã có assignment shortage active trong batch, hoặc
  - đã nằm trong một purchase batch draft hiện có  
  thì backend không chặn tuyệt đối, nhưng phải **merge vào đúng phiếu batch draft đang có** nếu cùng NCC; không tạo phiếu mới tách riêng cho cùng product trong cùng kỳ gom.
- Nếu product extra đang có purchase mở ngoài batch hoặc purchase thường của flow khác:
  - không áp invariant assignment
  - chỉ hiện cảnh báo mềm trên UI: `Mặt hàng này đang có phiếu nhập mở khác, cần kiểm tra trước khi tạo thêm`
- API tạo phiếu từ planner cần phân biệt line type:
  - `source_kind: "shortage"` cho dòng từ planner list
  - `source_kind: "extra"` cho dòng thêm tay
- Purchase header vẫn giữ `source_type = procurement_batch`; line-level chỉ cần metadata nhẹ để biết dòng nào là `extra`, không cần đổi workflow purchase chung.

### 3. UI/UX cho khối `Chọn thêm sản phẩm khác`
- Chỉ hiện khi:
  - đang ở `Batch mode`
  - user là `lock owner` hoặc `Master Admin`
- Dạng UI đề xuất:
  - một khối collapse riêng với tiêu đề `Chọn thêm sản phẩm khác`
  - ô tìm sản phẩm theo tên
  - nút `+ Thêm vào danh sách nhập`
  - list các extra rows đã chọn
- Mỗi extra row hiển thị tối thiểu:
  - tên sản phẩm
  - tồn hiện tại
  - NCC
  - số lượng
  - giá nhập
  - giảm KM dòng hoặc note ngắn nếu cần
  - badge `Ngoài nhu cầu đơn`
  - nút bỏ dòng
- Không hiển thị các cột demand như shortage rows; thay vào đó hiển thị note rõ:
  - `Dòng này không đến từ nhu cầu đơn, không tham gia tính cần nhập`
- Nếu product extra cũng đang xuất hiện ở shortage rows:
  - không tạo một card riêng biệt thứ hai trong list chính
  - UI báo rõ đây là `đang thêm ngoài nhu cầu đơn cho cùng sản phẩm`
  - khi tạo phiếu, backend hợp nhất theo NCC như rule trên
- Trên mobile:
  - khối phụ mặc định thu gọn
  - chỉ mở khi user bấm rõ
  - mỗi extra row giữ 1 hành động chính trực tiếp, phần phụ gom gọn
- Trên desktop/tablet:
  - cho nhập nhanh NCC, SL, giá nhập ngay trên row
- Nút `Tạo phiếu đã chọn` vẫn dùng chung cho cả hai nhóm dòng.
- Button ở màn `Tồn kho` giữ nguyên `Xử lý nhập thiếu`; trong help của màn planner bổ sung câu giải thích:
  - `Ngoài các mặt hàng thiếu, người giữ khóa batch cũng có thể chọn thêm sản phẩm khác để gom nhập cùng kỳ.`

## API / hành vi công khai cần đổi
- `GET /api/procurement/planner` giữ nguyên shape cho shortage rows; có thể bổ sung payload phụ nếu cần:
  - `extra_candidates` không bắt buộc, có thể lấy từ product search phía client
- `POST /api/procurement/purchases/create-drafts` mở rộng để nhận mixed lines:
  - shortage lines như hiện tại
  - extra lines có `source_kind="extra"`
- Không đổi workflow purchase chuẩn sau khi phiếu được tạo:
  - `draft -> ordered -> received -> paid`

## Kiểm thử cần có
- Unit:
  - tạo phiếu batch với mixed lines `shortage + extra` vẫn gom đúng theo NCC
  - extra row không tạo `procurement_assignment`
  - shortage row vẫn tạo assignment như cũ
  - extra row cùng product với shortage row không làm tạo phiếu trùng sai NCC
- Integration / Playwright:
  - owner vào planner batch, thêm một extra product và tạo phiếu thành công
  - mixed lines cùng NCC được review trong cùng một phiếu
  - extra row hiển thị badge `Ngoài nhu cầu đơn`
  - non-owner không thấy hoặc không thao tác được khối `Chọn thêm sản phẩm khác`
  - button ở `Tồn kho` vẫn mở đúng màn hiện tại và tên vẫn là `Xử lý nhập thiếu`
- Docs/help:
  - cập nhật help của `procurement-planner`
  - cập nhật README / hướng dẫn sử dụng / business flow để phân biệt shortage rows và extra rows

## Giả định và mặc định đã chốt
- Không tạo thêm một màn “Nhập hàng loạt” riêng.
- Không có chế độ “bulk import không lock”.
- Extra rows chỉ khả dụng trong **Batch mode**.
- Entry-point ở màn `Tồn kho` giữ nguyên tên `Xử lý nhập thiếu`.
- Semantics của shortage planner phải được giữ rõ; extra rows là khối phụ, không thay thế list chính.
