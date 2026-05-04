# Quản lý nhanh đồ thực phẩm chay

Ứng dụng web nhẹ để theo dõi tồn kho cá nhân cho thực phẩm chay đông lạnh. Hệ thống dùng Python chuẩn và SQLite, không cần cài thêm package ngoài.

## Tài liệu

- Deploy Windows: [docs/DEPLOY_WINDOWS.md](docs/DEPLOY_WINDOWS.md)
- Hướng dẫn sử dụng: [docs/HUONG_DAN_SU_DUNG.md](docs/HUONG_DAN_SU_DUNG.md)
- Bảng thuật ngữ Anh - Việt: [docs/TERM_GLOSSARY.md](docs/TERM_GLOSSARY.md)
- Design màn hình chung: [docs/SCREEN_DESIGN.md](docs/SCREEN_DESIGN.md)
- Design database: [docs/DB_DESIGN.md](docs/DB_DESIGN.md)
- Business flow: [docs/BUSINESS_FLOW.md](docs/BUSINESS_FLOW.md)
- Design hiển thị phiếu: [docs/PHIEU_DISPLAY_DESIGN.md](docs/PHIEU_DISPLAY_DESIGN.md)
- Hướng dẫn test: [docs/TESTING.md](docs/TESTING.md)
- Acceptance checklist: [docs/ACCEPTANCE_CHECKLIST.md](docs/ACCEPTANCE_CHECKLIST.md)
- Phân tích workflow: [docs/WORKFLOW_REVIEW.md](docs/WORKFLOW_REVIEW.md)

## Cấu trúc frontend để làm song song

- `static/app.js`: bootstrap app và wiring giữa các module
- `static/modules/ui/`: renderer/UI helpers; ưu tiên sửa ở đây khi Issue chỉ đổi hiển thị
- `static/modules/controllers/`: đăng ký event handler/controller; ưu tiên sửa ở đây khi Issue chỉ đổi điều hướng hoặc tương tác
- `static/modules/domain-helpers/`: helper nghiệp vụ theo domain như `sales`, `purchases`, `inventory`
- `static/modules/navigation-runtime.js`: menu history, floating search, help modal, edge-hidden navigation orchestration
- `static/modules/sync-runtime.js`: sync state nhiều máy, auto refresh, migrate dữ liệu cũ, persist queue
- `static/modules/entity-product-mutations.js`: mutate customer/supplier/product impact helpers
- `static/modules/`: state, DOM refs, config màn hình và utility dùng chung
- `data/js_asset_versions.json`: manifest version cache-busting cho từng file client `.js`

Quy ước tách việc:

- Issue UI nên ưu tiên chạm `static/modules/ui/*`
- Issue controller nên ưu tiên chạm `static/modules/controllers/*`
- Issue runtime điều hướng nên ưu tiên chạm `static/modules/navigation-runtime.js`
- Issue sync/runtime nhiều máy nên ưu tiên chạm `static/modules/sync-runtime.js`
- Issue helper nghiệp vụ nên ưu tiên chạm `static/modules/domain-helpers/*` hoặc `static/modules/entity-product-mutations.js`
- Chỉ sửa `static/app.js` khi cần đổi contract dùng chung hoặc wiring bootstrap

Pattern hiện tại đã áp dụng trước cho domain `products`:

- UI: `static/modules/ui/products-ui.js`
- Controller: `static/modules/controllers/products-controller.js`

Các domain đã có file UI riêng để giảm conflict khi làm song song:

- `static/modules/ui/inventory-ui.js`
- `static/modules/ui/sales-ui.js`
- `static/modules/ui/purchases-ui.js`
- `static/modules/ui/entities-ui.js`
- `static/modules/ui/reports-admin-ui.js`

Các domain đã có file controller riêng:

- `static/modules/controllers/inventory-controller.js`
- `static/modules/controllers/sales-controller.js`
- `static/modules/controllers/purchases-controller.js`
- `static/modules/controllers/entities-controller.js`
- `static/modules/controllers/reports-admin-controller.js`

Các helper/runtime đã được tách riêng:

- `static/modules/domain-helpers/sales-domain.js`
- `static/modules/domain-helpers/purchases-domain.js`
- `static/modules/domain-helpers/inventory-domain.js`
- `static/modules/navigation-runtime.js`
- `static/modules/sync-runtime.js`
- `static/modules/entity-product-mutations.js`

Contract chuẩn giữa các controller:

- `state`: shared app state
- `dom`: DOM refs và input/output element theo domain
- `actions`: hàm gây side-effect hoặc mutate state/server
- `renderers`: hàm render lại UI của domain hoặc màn liên quan
- `queries`: hàm getter/check điều kiện, không nên gây side-effect
- `utils`: formatter, helper hoặc constant nhẹ

Quy ước này giúp khi tách Issue song song, team UI chỉ bám `ui/*`, team controller chỉ bám `controllers/*`, còn dependency contract giữa các file vẫn đồng nhất.

## Viết tắt màn hình

- `SP`: Sản phẩm
- `NH`: Nhập hàng
- `AD`: Admin
- `KP`: Khôi phục
- `XH`: Xuất hàng
- `TK`: Tồn kho
- `ĐH`: Đơn hàng
- `NCC`: Nhà cung cấp
- `KH`: Khách hàng

## Tính năng chính

- Dashboard tồn kho hiển thị toàn bộ sản phẩm và cảnh báo sắp hết
- Màn tồn kho có dropdown sắp xếp trong khu vực phân trang để xem theo tên, tồn cao, giá trị tồn, ưu tiên nhập/xử lý hoặc hạn còn ít
- Tồn kho liên kết trực tiếp với đơn chờ xuất và phiếu chờ nhập, thay cho nhập/xuất nhanh thủ công
- Quản lý riêng `giá nhập` và `giá bán mặc định` của sản phẩm
- Có badge `Chờ xuất` / `Chờ nhập` ngay trên card tồn kho để nhảy nhanh sang màn liên quan, đồng thời hiện `số phiếu / tổng số lượng` đang chờ theo từng mặt hàng
- Quản lý khách hàng, giỏ hàng nháp và checkout nhiều mặt hàng trong một lần
- Ở màn xuất hàng và nhập hàng, các mặt hàng đã chọn sẽ được gom lên phần tóm tắt đơn/phiếu phía trên để thao tác nhanh
- Riêng màn xuất hàng giữ nút `...` luôn hiện trên card sản phẩm để mở/thu gọn detail; hàng đã chọn mặc định ẩn khỏi danh sách dưới để tránh sót, nhưng nếu user chủ động bấm `...` thì app vẫn giữ lại đúng card đang thao tác
- Khối `Giỏ hiện hành` ở màn xuất hàng hiển thị từng dòng đã chọn dưới dạng card gọn 2 dòng; bấm `...` trên từng card để mở detail sửa số lượng, giá bán hoặc bỏ khỏi giỏ
- Trước các thao tác đổi trạng thái hoặc xóa phiếu như `Xuất hàng`, `Đã thanh toán`, `Đã đặt hàng`, `Nhập kho`, `Hủy`, `Xóa`, app sẽ hiện message confirm để tránh bấm nhầm
- Nút `Detail` ở `Giỏ hiện hành` và `Đơn hàng` cho phép bung nhanh metadata phiếu xuất và danh sách dòng hàng mà không phải mở sang chỗ chỉnh sửa
- Đơn đã chốt và phiếu đã nhập kho/đã thanh toán được khóa sửa trực tiếp để tránh thay đổi ngược lịch sử
- Lưu khách hàng, nhà cung cấp, giỏ hàng nháp và phiếu nhập vào SQLite để mở tiếp trên máy khác cùng server
- Tự nạp lại dữ liệu mới từ máy khác ở các màn chính khi màn hình đang rảnh thao tác, giúp thấy tồn kho và giá mới hơn mà không cần `F5`
- Client `.js` được gắn version riêng theo dạng `version-chính.N`; trong cùng version chính, `N` tăng theo số lần nội dung file đổi, bỏ qua khác biệt `CRLF/LF`, còn khi version chính đổi thì `N` reset về `1`
- Có kiểm tra xung đột khi nhiều máy cùng lưu `giỏ nháp` hoặc `phiếu nhập nháp`; app sẽ chặn ghi đè và yêu cầu tải dữ liệu mới nhất trước khi lưu tiếp
- Trên mobile, menu nổi, ô tìm kiếm nhanh và cụm nút điều hướng sẽ tự thu vào mép màn hình khi chạm ra ngoài; chạm vào phần mép còn lộ ra để mở lại
- Trên PC/tablet, menu nghiệp vụ mặc định thu gọn; hover hoặc bấm `Mở menu` để bung ra nhanh, và menu sẽ tự gọn lại khi rê chuột hoặc bấm ra ngoài
- In nhanh danh sách hàng và tổng tiền cho khách ngay từ giỏ hàng hoặc từ lịch sử đơn
- Giao diện theo menu nghiệp vụ riêng cho tồn kho, tạo đơn, đơn hàng, khách hàng và sản phẩm
- Các màn chọn đối tượng đều có ô tìm kiếm/gõ tên để thao tác nhanh trên điện thoại
- Quản lý nhập hàng với phiếu nhập nháp, trạng thái đặt hàng/nhập kho và gợi ý sản phẩm cần nhập
- Phiếu nhập có nút `Detail` để bung/thu gọn metadata gồm mã phiếu, nhà cung cấp, trạng thái và các mốc ngày xử lý nhằm đối chiếu dữ liệu legacy/restore dễ hơn
- Có nút `NCC` ở màn nhập hàng để mở nhanh form tạo/sửa nhà cung cấp với tên đang gõ khi phiếu còn `Nháp`; từ `Đã đặt` trở đi app khóa đổi NCC để giữ đúng workflow
- Phiếu nhập chỉ được chuyển sang `Đã thanh toán` sau khi đã `Nhập kho`, để tránh trả tiền khi hàng chưa được nhận vào tồn
- Nếu dữ liệu cũ làm phiếu bị lệch trạng thái, ví dụ đang dính marker `Đã thanh toán` nhưng chưa có `Nhập kho` thật hoặc ngoài màn hình lại đang hiện như `Nháp`, app sẽ hiện cảnh báo và cho phép `Hủy phiếu` hoặc `Xóa phiếu` để dọn dữ liệu lỗi mà không khôi phục lại thành nháp
- Có API chứng từ điều chỉnh cho Phase B gồm: `phiếu điều chỉnh tồn`, `phiếu trả hàng khách`, `phiếu trả NCC` để không sửa ngược chứng từ cũ
- Có audit log Phase D cho thay đổi trạng thái đơn/phiếu, thay đổi giá chung và lưu người thao tác để truy vết
- Báo cáo nhập xuất theo tháng, tách riêng `hoàn khách`, `trả NCC`, `điều chỉnh tồn`, có thêm khối audit chứng từ để tra cứu ngay trong màn `Báo cáo`
- Khối audit chứng từ ở màn `Báo cáo` hỗ trợ tìm theo mã phiếu và mã tham chiếu nguồn để đối chiếu nhanh
- Quản lý khách hàng có thêm số liên lạc, địa chỉ ship và link Zalo
- Màn Khách hàng và Nhà cung cấp ưu tiên hiển thị danh sách; form tạo/sửa được thu gọn và chỉ mở khi bấm `Thêm mới` hoặc `Sửa`
- Màn Sản phẩm cũng ưu tiên hiển thị danh sách; phần `Thêm sản phẩm` và `Lịch sử sản phẩm` được thu gọn sẵn và chỉ mở khi cần
- Quản lý đơn hàng có trạng thái thanh toán và nút `Xuất` nhanh từ card giỏ nháp
- Quản lý danh mục sản phẩm gồm tên, loại thực phẩm, đơn vị tính, giá nhập, giá bán mặc định và ngưỡng cảnh báo
- Danh mục sản phẩm có thêm `hạn dùng` và `thời gian bảo quản` theo số ngày để app ước tính hạn còn lại khi sắp xếp tồn kho
- Hỗ trợ đưa sản phẩm ngừng bán vào danh mục đã xóa khi tồn kho bằng 0, kèm khôi phục lại khi cần
- Có lịch sử quản lý sản phẩm và màn quản lý các đối tượng đã xóa để khôi phục an toàn
- Có login hệ thống cho `user` thường và `Master Admin`; có thể bật `EnableLogin` để bắt buộc login mới dùng app
- Có module `Master Admin` để export/import file master (JSON/CSV) và backup/restore toàn bộ database
- Timeout phiên tách riêng trong config: `session_timeout_minutes` cho user thường và `admin_session_timeout_minutes` cho admin
- Chỉ `Master Admin` mới được chỉnh tồn kho trực tiếp ngoài quy trình đơn nhập / đơn xuất, và phải nhập lý do điều chỉnh để lưu audit
- Luồng Phase B đã có UI ngay trong app: `Phiếu DC` ở màn tồn kho, `Phiếu trả hàng khách` ở màn đơn hàng, `Phiếu trả NCC` ở màn nhập hàng
- Các chứng từ đã `completed/received/paid/cancelled` vẫn bị khóa xóa/hủy trực tiếp kể cả với `Master Admin`; muốn điều chỉnh phải lập phiếu mới để giữ audit
- Lịch sử giao dịch gần đây để kiểm tra lại thao tác mới nhất
- Các list dài có phân trang `Trước / Sau` để thao tác gọn hơn trên mobile
- Hiển thị `Version` ngay đầu ứng dụng; bấm vào để mở màn `About` và xem phiên bản đang chạy

## Chạy ứng dụng

```powershell
python app.py
```

Sau đó mở trình duyệt tại `http://127.0.0.1:8000`.

Dữ liệu nghiệp vụ được lưu trong `data\inventory.db`. Nếu nhiều máy cùng mở vào cùng một địa chỉ app/server thì sẽ dùng chung một nguồn dữ liệu.

Khi một máy khác vừa nhập hàng, xuất hàng, sửa giá hoặc cập nhật đơn/phiếu, các màn hình chính sẽ tự nạp lại dữ liệu mới khi người dùng đang không gõ dở vào ô nhập.

File cấu hình hệ thống:

```text
data\system_config.json
```

App sẽ tự tạo file này nếu chưa có.

Ví dụ:

```text
{
  "server": {
    "host": "127.0.0.1",
    "port": 8000
  },
  "EnableLogin": false,
  "session_timeout_minutes": 360,
  "admin_session_timeout_minutes": 30,
  "admin": {
    "username": "masteradmin",
    "password": "admin12345"
  },
  "users": [
    {
      "username": "staff",
      "password": "staff12345"
    }
  ],
  "debug": {
    "sync_state": false
  },
  "pagination": {
    "items_per_page": 10,
    "documents_per_page": 10
  }
}
```

Muốn đổi tài khoản user/admin, bật `EnableLogin`, đổi timeout phiên, hoặc đổi base phân trang thì sửa trực tiếp `system_config.json`. App không tự ghi đè lại các giá trị này trong lúc đang chạy.

Ý nghĩa cấu hình phân trang:

- `pagination.items_per_page`: base cho các danh sách item/card như mặt hàng, khách hàng, nhà cung cấp.
- `pagination.documents_per_page`: base cho các danh sách phiếu/đơn/chứng từ.
- Khi mở app, frontend tự suy ra số mục mặc định theo thiết bị hiện hành từ base này:
  - `Mobile`: giữ nguyên base config, mặc định là `10`
  - `Tablet`: scale lên mức chuẩn khoảng `25`
  - `PC`: scale lên mức chuẩn khoảng `100`
- Trên `PC/Tablet`, thanh phân trang có thêm combobox `25/50/100` để đổi nhanh số mục hiển thị trên mỗi trang.

Nếu cần điều tra lỗi đồng bộ nhiều máy như `PUT /api/state 400`, bật:

```text
"debug": {
  "sync_state": true
}
```

Khi bật, server sẽ in log tóm tắt request `/api/state` ra console và browser cũng ghi thêm log debug sync để dễ đối chiếu payload, collection và lỗi trả về.

Có thể xem nhanh config hiện tại bằng:

```powershell
python app.py config
```

Có thể bind theo IP / domain / port tùy ý:

```powershell
python app.py --host 0.0.0.0 --port 8080
```

Hoặc:

```powershell
python app.py --host 192.168.1.10 --port 9000 serve
```

## Setup môi trường trên máy mới

Các tool nên có khi làm việc với project này:

- `Python 3.11+` để chạy app, unit test và script backend
- `PyYAML` cho Python tooling của bộ skill Git Issue, ví dụ `quick_validate.py`
- `Node.js LTS + npm` để cài tooling test frontend/integration
- `Playwright Chromium` để chạy integration test và chụp ảnh UI
- `Git` để pull/push mã nguồn
- `GitHub CLI (gh)` để tạo issue / branch / PR từ máy local
- `winget` trên Windows để script setup tự cài phần còn thiếu

Script setup idempotent:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
```

Có thể chạy lại nhiều lần. Script sẽ:

- bỏ qua tool đã có sẵn
- chỉ cài phần còn thiếu
- cài thêm Python package `PyYAML` nếu môi trường chưa có
- chạy `npm install`
- chạy `npx playwright install chromium`
- kiểm tra nhanh bằng `python -m py_compile app.py` và `node --check static/app.js`

Chế độ chỉ kiểm tra:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1 -CheckOnly
```

Nếu đã có `Node.js`, có thể gọi nhanh qua `npm`:

```powershell
npm run setup:windows
```

Riêng workflow GitHub cần đăng nhập `gh` sau khi cài:

```powershell
gh auth login
```

## Khởi tạo danh mục từ `data\List.txt`

```powershell
python app.py init
```

Mặc định lệnh này sẽ đọc `data\List_price.txt`. Mỗi dòng có thể ở dạng:

```text
1. Tên sản phẩm | 0
```

Hoặc dạng đầy đủ:

```text
Tên sản phẩm | Loại thực phẩm | Đơn vị | Ngưỡng cảnh báo | Giá
```

Nếu muốn khai báo thêm dữ liệu hạn dùng để màn tồn kho sắp xếp theo hạn còn lại, dùng dạng:

```text
Tên sản phẩm | Loại thực phẩm | Đơn vị | Ngưỡng cảnh báo | Giá nhập | Hạn dùng ngày | Bảo quản ngày
```

Hệ thống sẽ tự bỏ số thứ tự đầu dòng như `1.` hoặc `2.`, rồi thêm sản phẩm vào database. Nếu chạy lại, các tên đã có sẽ được tự động bỏ qua.

Nếu muốn xóa toàn bộ dữ liệu hiện có rồi import lại sạch từ `List.txt`:

```powershell
python app.py init --reset
```

## Chạy test

Test unit:

```powershell
python -m unittest discover -s tests
```

Integration test UI trên fixture DB riêng:

```powershell
npm install
npx playwright install chromium
npm run test:integration
```

Acceptance automation theo checklist:

```powershell
npm run test:acceptance
```

Suite integration sẽ:

- tự dựng server test riêng trên `fixture DB` tạm
- không dùng `data\inventory.db` đang vận hành
- kiểm tra các màn chính, điều hướng, refresh, và luồng `Master Admin`
- có thêm bộ acceptance automation bám checklist ở `docs/ACCEPTANCE_CHECKLIST.md`

## API chứng từ điều chỉnh (Phase B)

Các API mới để tạo chứng từ điều chỉnh, giữ tương thích dữ liệu cũ vì vẫn ghi vào bảng `transactions` hiện có:

- `POST /api/adjustments/inventory` (yêu cầu Master Admin)
  - tạo `phiếu điều chỉnh tồn`, nhận `items[].quantity_delta` âm/dương và `reason`
- `POST /api/returns/customers`
  - tạo `phiếu trả hàng khách`, cộng tồn kho theo danh sách hàng khách trả
- `POST /api/returns/suppliers`
  - tạo `phiếu trả NCC`, trừ tồn kho khi trả hàng lỗi/không đạt về nhà cung cấp

UI tương ứng:

- màn `Tồn kho`: `Phiếu DC` hoặc khối `Phiếu điều chỉnh tồn`
- màn `Đơn hàng`: khối `Phiếu trả hàng khách`, có thể mở sẵn từ nút `Trả hàng` trên đơn đã chốt hoặc nhập tay độc lập
- màn `Nhập hàng`: khối `Phiếu trả NCC`, có thể mở sẵn từ nút `Trả NCC` trên phiếu đã nhập kho / đã thanh toán hoặc nhập tay độc lập
- màn `Báo cáo`: thẻ tổng hợp, xu hướng tháng, chi tiết sản phẩm và khối `Audit chứng từ` để tra cứu 3 loại phiếu Phase B

Quy tắc workflow vẫn giữ nguyên:

- không sửa ngược đơn đã chốt
- không sửa ngược phiếu đã nhập kho / đã thanh toán
- không mở quyền `Master Admin` để xóa hoặc hủy ngược các chứng từ đã khóa

API tra cứu audit chứng từ Phase B:

- `GET /api/receipts/history`
  - query hỗ trợ:
    - `limit`: số dòng lịch sử (mặc định 40, tối đa 200)
    - `receipt_type`: lọc theo `inventory_adjustment`, `customer_return`, `supplier_return`
    - `start_date`: lọc từ mốc thời gian ISO (`YYYY-MM-DDTHH:MM:SS`)
    - `end_date`: lọc đến mốc thời gian ISO (`YYYY-MM-DDTHH:MM:SS`)

## API audit lịch sử sản phẩm (Phase D)

- `GET /api/products/history`
  - query hỗ trợ:
    - `limit`: số dòng lịch sử (mặc định 40, tối đa 200)
    - `actor`: lọc theo người thao tác
    - `start_date`: lọc từ mốc thời gian ISO (`YYYY-MM-DDTHH:MM:SS`)
    - `end_date`: lọc đến mốc thời gian ISO (`YYYY-MM-DDTHH:MM:SS`)
