# Quản lý nhanh đồ thực phẩm chay

Ứng dụng web nhẹ để theo dõi tồn kho cá nhân cho thực phẩm chay đông lạnh. Hệ thống dùng Python chuẩn và SQLite, không cần cài thêm package ngoài.

## Tài liệu

- Deploy Windows: [docs/DEPLOY_WINDOWS.md](docs/DEPLOY_WINDOWS.md)
- Hướng dẫn sử dụng: [docs/HUONG_DAN_SU_DUNG.md](docs/HUONG_DAN_SU_DUNG.md)
- Hướng dẫn test: [docs/TESTING.md](docs/TESTING.md)
- Acceptance checklist: [docs/ACCEPTANCE_CHECKLIST.md](docs/ACCEPTANCE_CHECKLIST.md)
- Phân tích workflow: [docs/WORKFLOW_REVIEW.md](docs/WORKFLOW_REVIEW.md)

## Cấu trúc frontend để làm song song

- `static/app.js`: bootstrap app, orchestration dữ liệu dùng chung, ghép các module
- `static/modules/ui/`: renderer/UI helpers; ưu tiên sửa ở đây khi Issue chỉ đổi hiển thị
- `static/modules/controllers/`: đăng ký event handler/controller; ưu tiên sửa ở đây khi Issue chỉ đổi điều hướng hoặc tương tác
- `static/modules/`: state, DOM refs, config màn hình và utility dùng chung

Quy ước tách việc:

- Issue UI nên ưu tiên chạm `static/modules/ui/*`
- Issue controller nên ưu tiên chạm `static/modules/controllers/*`
- Chỉ sửa `static/app.js` khi cần đổi contract dùng chung hoặc wiring bootstrap

## Tính năng chính

- Dashboard tồn kho hiển thị toàn bộ sản phẩm và cảnh báo sắp hết
- Tồn kho liên kết trực tiếp với đơn chờ xuất và phiếu chờ nhập, thay cho nhập/xuất nhanh thủ công
- Quản lý riêng `giá nhập` và `giá bán mặc định` của sản phẩm
- Có badge `Chờ xuất` / `Chờ nhập` ngay trên card tồn kho để nhảy nhanh sang màn liên quan
- Quản lý khách hàng, giỏ hàng nháp và checkout nhiều mặt hàng trong một lần
- Ở màn xuất hàng và nhập hàng, các mặt hàng đã chọn sẽ được gom lên phần tóm tắt đơn/phiếu phía trên và ẩn khỏi danh sách chọn bên dưới để tránh sót dòng đã chọn
- Đơn đã chốt và phiếu đã nhập kho/đã thanh toán được khóa sửa trực tiếp để tránh thay đổi ngược lịch sử
- Lưu khách hàng, nhà cung cấp, giỏ hàng nháp và phiếu nhập vào SQLite để mở tiếp trên máy khác cùng server
- Tự nạp lại dữ liệu mới từ máy khác ở các màn chính khi màn hình đang rảnh thao tác, giúp thấy tồn kho và giá mới hơn mà không cần `F5`
- Có kiểm tra xung đột khi nhiều máy cùng lưu `giỏ nháp` hoặc `phiếu nhập nháp`; app sẽ chặn ghi đè và yêu cầu tải dữ liệu mới nhất trước khi lưu tiếp
- Trên mobile, menu nổi, ô tìm kiếm nhanh và cụm nút điều hướng sẽ tự thu vào mép màn hình khi chạm ra ngoài; chạm vào phần mép còn lộ ra để mở lại
- In nhanh danh sách hàng và tổng tiền cho khách ngay từ giỏ hàng hoặc từ lịch sử đơn
- Giao diện theo menu nghiệp vụ riêng cho tồn kho, tạo đơn, đơn hàng, khách hàng và sản phẩm
- Các màn chọn đối tượng đều có ô tìm kiếm/gõ tên để thao tác nhanh trên điện thoại
- Quản lý nhập hàng với phiếu nhập nháp, trạng thái đặt hàng/nhập kho và gợi ý sản phẩm cần nhập
- Có nút `NCC` ở màn nhập hàng để mở nhanh form tạo nhà cung cấp mới với tên đang gõ rồi quay lại áp ngay vào phiếu nhập
- Phiếu nhập chỉ được chuyển sang `Đã thanh toán` sau khi đã `Nhập kho`, để tránh trả tiền khi hàng chưa được nhận vào tồn
- Có API chứng từ điều chỉnh cho Phase B gồm: `phiếu điều chỉnh tồn`, `phiếu trả hàng khách`, `phiếu trả NCC` để không sửa ngược chứng từ cũ
- Có audit log Phase D cho thay đổi trạng thái đơn/phiếu, thay đổi giá chung và lưu người thao tác để truy vết
- Báo cáo nhập xuất theo tháng, xem xu hướng gần đây và dự báo mặt hàng nên nhập thêm
- Quản lý khách hàng có thêm số liên lạc, địa chỉ ship và link Zalo
- Màn Khách hàng và Nhà cung cấp ưu tiên hiển thị danh sách; form tạo/sửa được thu gọn và chỉ mở khi bấm `Thêm mới` hoặc `Sửa`
- Màn Sản phẩm cũng ưu tiên hiển thị danh sách; phần `Thêm sản phẩm` và `Lịch sử sản phẩm` được thu gọn sẵn và chỉ mở khi cần
- Quản lý đơn hàng có trạng thái thanh toán
- Quản lý danh mục sản phẩm gồm tên, loại thực phẩm, đơn vị tính, giá nhập, giá bán mặc định và ngưỡng cảnh báo
- Hỗ trợ đưa sản phẩm ngừng bán vào danh mục đã xóa khi tồn kho bằng 0, kèm khôi phục lại khi cần
- Có lịch sử quản lý sản phẩm và màn quản lý các đối tượng đã xóa để khôi phục an toàn
- Có module `Master Admin` để export/import file master và backup/restore toàn bộ database
- Chỉ `Master Admin` mới được chỉnh tồn kho trực tiếp ngoài quy trình đơn nhập / đơn xuất, và phải nhập lý do điều chỉnh để lưu audit
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
  "admin": {
    "username": "masteradmin",
    "password": "admin12345"
  }
}
```

Muốn đổi tài khoản admin hoặc host/port mặc định, hãy sửa file này rồi chạy lại app.

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

## API audit lịch sử sản phẩm (Phase D)

- `GET /api/products/history`
  - query hỗ trợ:
    - `limit`: số dòng lịch sử (mặc định 40, tối đa 200)
    - `actor`: lọc theo người thao tác
    - `start_date`: lọc từ mốc thời gian ISO (`YYYY-MM-DDTHH:MM:SS`)
    - `end_date`: lọc đến mốc thời gian ISO (`YYYY-MM-DDTHH:MM:SS`)
