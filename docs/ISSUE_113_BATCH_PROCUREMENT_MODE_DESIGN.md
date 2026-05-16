# Issue 113 - Thiết Kế `Batch Procurement Mode` Cho Xử Lý Nhập Thiếu

Nguồn gốc:

- Task: `No. 113`
- Phạm vi tài liệu này là `design + checklist`, chưa phản ánh là app runtime đã triển khai.

Mục tiêu của phương án này:

- giữ flow nhanh theo đơn cho nhóm `1-3 user` trong ngày thường
- chỉ bật flow gom nhu cầu nhập tổng khi thực sự cần
- cho phép `1 super user nghiệp vụ` xử lý batch mà không phải nâng quyền thành `Master Admin`
- tránh tách một mặt hàng thiếu ra nhiều phiếu nhập trong lúc xử lý batch

## 1. Tóm tắt yêu cầu

Nghiệp vụ nhập hàng hiện có 2 kiểu sử dụng khác nhau:

1. ngày thường:
   - user xử lý nhanh theo từng đơn
   - thiếu hàng thì cần thao tác gọn, không nên thêm nhiều bước
2. định kỳ:
   - thỉnh thoảng, ví dụ `1 tháng 1 lần`, cần gom toàn bộ nhu cầu nhập
   - lúc này chỉ nên cho `1 người phụ trách nghiệp vụ` xử lý batch để tránh conflict

Yêu cầu thiết kế mới cần đạt:

- không phá flow nhanh theo cart của ngày thường
- có thể bật chế độ `gom nhu cầu nhập`
- khi vào chế độ batch, app phải:
  - tắt nhánh auto-create phiếu nhập theo từng cart trong shortage flow
  - gom thiếu hàng ở mức toàn hệ thống
  - khóa chỉnh planner cho đúng `1 user`
  - enforce rule `1 sản phẩm thiếu -> 1 phiếu nhập mở` trong phạm vi batch

## 2. Khảo sát hiện trạng

### 2.1. Thiếu hàng hiện đang đi theo cart nguồn

Frontend hiện xử lý shortage chủ yếu theo đơn nguồn:

- [getCartShortagePlan](/D:/QUAN/Program/QuanLyThucPhamChay/static/app.js:2400)
- [createPurchaseSuggestionFromCart](/D:/QUAN/Program/QuanLyThucPhamChay/static/app.js:2462)
- [commitActiveCart](/D:/QUAN/Program/QuanLyThucPhamChay/static/app.js:3897)
- [shipActiveCart](/D:/QUAN/Program/QuanLyThucPhamChay/static/app.js:3980)

Điểm mạnh:

- nhanh cho case thiếu hàng đơn lẻ
- dễ hiểu với user ngày thường

Điểm yếu:

- dễ sinh phiếu nhập trùng khi nhiều cart cùng thiếu một sản phẩm
- header purchase chỉ có `source_type/source_code/source_name`, không phù hợp để biểu diễn một phiếu nhập phục vụ nhiều cart
- chưa có cơ chế điều phối tập trung khi đi vào từ nhiều màn hình khác nhau

### 2.2. Tính thiếu hàng đã có dấu hiệu nhìn theo toàn hệ thống

Logic tồn kho hiện đã tính:

- `draft demand`
- `committed demand`
- `incoming open purchases`

Nguồn tham chiếu:

- [inventory-domain.js](/D:/QUAN/Program/QuanLyThucPhamChay/static/modules/domain-helpers/inventory-domain.js:15)
- [store.py - reserved quantity for committed orders](/D:/QUAN/Program/QuanLyThucPhamChay/qltpchay/store.py:2739)

Nghĩa là phần `đọc tín hiệu thiếu hàng` đã nghiêng về mức `product`, nhưng phần `tạo phiếu nhập` vẫn còn ở mức `cart`.

### 2.3. Quyền truy cập hiện tại còn quá thô

Code auth/session hiện chỉ có 2 role thực tế:

- `user`
- `admin`

Nguồn:

- [qltpchay/auth.py](/D:/QUAN/Program/QuanLyThucPhamChay/qltpchay/auth.py)
- [qltpchay/config.py](/D:/QUAN/Program/QuanLyThucPhamChay/qltpchay/config.py)

Điểm lệch với yêu cầu mới:

1. chưa có `super user nghiệp vụ` riêng
2. nếu tái dùng `admin`, user đó sẽ có thêm quyền backup/restore, legacy audit và direct adjust tồn, là quá rộng
3. nếu `EnableLogin = false` thì app không nhận diện được ai đang giữ lock batch

## 3. Mục tiêu thiết kế

Thiết kế mới cần đạt đồng thời:

- giữ `daily workflow` nhanh như hiện tại
- thêm `batch procurement mode` để gom nhu cầu nhập khi cần
- chỉ yêu cầu siết chặt rule khi đang ở batch mode
- không bắt `quản lý kinh doanh` phải là `Master Admin`
- giảm phiếu nhập trùng
- giảm conflict khi nhiều màn hình cùng dẫn đến thao tác nhập thiếu
- tương thích ngược với purchases/cart hiện có

## 4. Quyết định design đề xuất

## 4.1. Tách `config tĩnh` và `runtime mode`

Thiết kế nên tách làm 2 lớp:

### Lớp 1: `config tĩnh`

Là policy hệ thống, lưu trong `data/system_config.json`.

Ví dụ:

```json
{
  "procurement": {
    "batch_planner_enabled": true,
    "batch_lock_timeout_minutes": 180,
    "allow_daily_quick_shortage_flow": true,
    "required_login_for_batch_mode": true,
    "planner_manager_usernames": ["masteradmin", "bizmanager"]
  }
}
```

Ý nghĩa:

- `batch_planner_enabled`: bật tính năng planner
- `batch_lock_timeout_minutes`: timeout lock batch
- `allow_daily_quick_shortage_flow`: cho phép giữ flow nhanh theo cart khi ở daily mode
- `required_login_for_batch_mode`: batch mode chỉ hoạt động khi có login
- `planner_manager_usernames`: danh sách user được quyền bật/tắt batch mode và cầm lock planner

### Lớp 2: `runtime mode`

Là trạng thái vận hành hiện tại, không nên để user sửa tay trong file config.

Đề xuất:

- `daily`
- `batch`

Runtime mode phải lưu server-side để mọi máy nhìn cùng một trạng thái.

## 4.2. Mô hình vận hành mới

Đề xuất:

```text
Daily mode
  - giữ flow hiện tại
  - thiếu hàng theo cart vẫn được xử lý nhanh
  - không cần lock planner

Batch mode
  - mọi shortage flow chuyển sang planner
  - tắt auto-create phiếu nhập theo từng cart
  - chỉ 1 user có quyền sửa planner
  - enforce 1 sản phẩm thiếu -> 1 phiếu nhập mở trong planner
```

Batch mode không nên là `setting đổi tay trong file`.

Thay vào đó:

1. user có quyền vào màn planner
2. bấm `Bắt đầu kỳ gom nhập`
3. server acquire lock và chuyển runtime mode sang `batch`
4. sau khi xử lý xong, user bấm `Kết thúc kỳ gom nhập`
5. server release lock và trả runtime mode về `daily`

## 4.3. Yêu cầu về login

Đề xuất rule:

- `daily mode` vẫn cho phép chạy khi `EnableLogin = false`
- `batch mode` bắt buộc yêu cầu `EnableLogin = true`

Lý do:

- lock batch cần biết rõ `ai` đang giữ
- audit thao tác planner cần username
- nếu không login thì không thể phân biệt user thường với `bizmanager`

Nếu config bật planner nhưng chưa bật login:

- app vẫn hiện feature planner ở mức đọc tài liệu hoặc disabled state
- khi user bấm vào batch mode, app phải báo bật login trước

## 4.4. Quyền người dùng đề xuất

Không nên biến `quản lý kinh doanh` thành `admin`.

Đề xuất mở rộng user config theo hướng `permission-based`, nhưng tối giản:

```json
{
  "users": [
    {
      "username": "staff",
      "password": "staff12345"
    },
    {
      "username": "bizmanager",
      "password": "biz12345",
      "permissions": ["procurement_batch_manage"]
    }
  ]
}
```

Permission mới tối thiểu:

- `procurement_batch_manage`

Permission này cho phép:

- mở màn planner batch
- bắt đầu kỳ gom nhập
- acquire/release lock
- tạo/chuyển/gán mặt hàng thiếu vào phiếu nhập trong planner

Permission này không cho phép:

- direct adjust tồn kho
- backup/restore DB
- legacy audit
- import/export admin

`Master Admin` mặc định có toàn quyền, bao gồm cả `procurement_batch_manage`.

## 4.5. Màn hình mới: `procurement-planner`

Đề xuất thêm màn riêng:

- menu id: `procurement-planner`
- tên hiển thị: `Xử lý nhập thiếu`

Màn này là `planner`, không thay thế màn `Nhập hàng`.

Phân vai:

- `procurement-planner`: tính thiếu, gán thiếu vào phiếu, điều phối theo NCC
- `purchases`: chỉnh chi tiết phiếu nhập, theo dõi ordered/received/paid

### Thành phần chính của planner

1. thanh trạng thái mode:
   - `Đang ở Daily mode`
   - `Đang ở Batch mode`
   - `Người giữ lock`
   - `Bắt đầu kỳ gom nhập` / `Kết thúc kỳ gom nhập`
2. bộ lọc scope:
   - `Toàn hệ thống`
   - `Theo đơn đang mở`
   - `Theo sản phẩm`
3. bảng thiếu hàng theo `product`
4. panel danh sách phiếu nhập đích
5. hành động gán:
   - `Tạo phiếu mới cho NCC này`
   - `Gán vào phiếu draft NCC này`
   - `Chuyển sang phiếu khác`
6. cảnh báo tồn sau nhập:
   - `Sau nhập vẫn dưới ngưỡng cảnh báo`
   - `Đã đủ cho đơn chốt nhưng chưa đủ ngưỡng`

### Dữ liệu hiển thị trên từng dòng planner

- sản phẩm
- tồn hiện tại
- nhu cầu `draft`
- nhu cầu `committed`
- tổng nhu cầu
- đang chờ nhập
- cần nhập thêm
- tồn dự kiến sau nhập và xuất
- ngưỡng cảnh báo
- trạng thái cảnh báo
- NCC đề xuất
- phiếu nhập đang gán

## 4.6. Các nơi đi vào planner

### Từ `inventory`

Thêm button:

- `Xử lý nhập thiếu`

Hành vi:

- mở planner với `scope = all`

### Từ `create-order`

Khi thiếu hàng:

- nếu đang `daily mode` và policy cho phép flow nhanh, vẫn có thể giữ lựa chọn:
  - xử lý nhanh theo cart
  - sang planner
- nếu đang `batch mode`, bắt buộc sang planner với `scope = cart`

### Từ `orders`

Đơn `draft` hoặc `committed` đang thiếu hàng có thêm:

- `Xử lý nhập thiếu`

Hành vi:

- mở planner với `scope = cart`
- chỉ highlight các dòng liên quan cart đó
- nhưng số lượng đề xuất vẫn tính theo tổng hệ thống

### Từ `purchases`

Thêm banner:

- `Còn mặt hàng thiếu chưa được điều phối`

Hành vi:

- mở lại planner để xử lý tiếp

## 4.7. Quy tắc tính shortage trong planner

Planner phải tính ở mức `product`, không ở mức `cart header`.

Đề xuất:

```text
gross_demand = demand_draft + demand_committed
effective_available = current_stock + incoming_open_purchases
required_purchase = max(0, gross_demand - effective_available)
forecast_after_purchase = current_stock + assigned_incoming - gross_demand
warning_if forecast_after_purchase < low_stock_threshold
```

Rule ưu tiên:

1. đảm bảo đủ cho `committed`
2. sau đó cover `draft`
3. cuối cùng mới xét cảnh báo `low_stock_threshold`

Lưu ý:

- `discount` của đơn hoặc phiếu nhập không ảnh hưởng số lượng thiếu
- low stock chỉ là `warning`, không ép thành hard block

## 4.8. Quy tắc assignment khi ở batch mode

Khi runtime mode là `batch`, planner phải enforce:

- `1 sản phẩm thiếu -> 1 phiếu nhập mở`

Nghĩa chính xác:

- một `product_id` đang được planner quản lý không được đồng thời nằm trong hai `purchase draft/ordered` khác nhau thuộc batch scope

Rule này chỉ nên áp vào `batch planner scope`, không áp cứng cho mọi purchase lịch sử hoặc purchase tay ngoài planner.

### Vì sao không áp cứng toàn hệ thống ngay

- ngày thường user vẫn có thể đang xử lý tay một số phiếu riêng
- app hiện đã có dữ liệu cũ và flow cart-source
- nếu khóa cứng toàn bộ ngay từ đầu sẽ tăng nguy cơ chặn sai

### Rule thao tác

- muốn đổi NCC cho một sản phẩm trong batch:
  - chuyển cả dòng sản phẩm sang phiếu khác
  - không được split một phần sang phiếu A, phần còn lại sang phiếu B
- nếu phiếu đích đã có dòng cùng product:
  - merge vào đúng dòng đó

## 4.9. Server-side lock cho batch mode

Lock là bắt buộc.

Không được chỉ khóa ở frontend.

### Hành vi lock đề xuất

1. user có quyền bấm `Bắt đầu kỳ gom nhập`
2. server acquire lock:
   - `lock_key = procurement_batch`
   - `owner_username`
   - `acquired_at`
   - `expires_at`
3. khi lock thành công:
   - runtime mode chuyển sang `batch`
4. chỉ lock owner hoặc admin mới được:
   - sửa planner
   - gán hàng vào phiếu
   - kết thúc batch mode
5. user khác:
   - chỉ được xem planner ở read-only
   - hoặc bị chặn hẳn tùy policy
6. lock hết hạn:
   - server tự cho acquire lại
   - runtime mode về `daily` nếu không còn lock hợp lệ

### Chỗ lưu lock

Đề xuất thêm bảng mới:

```text
workflow_locks
  lock_key TEXT PRIMARY KEY
  owner_username TEXT NOT NULL
  owner_role TEXT NOT NULL
  acquired_at TEXT NOT NULL
  expires_at TEXT NOT NULL
  updated_at TEXT NOT NULL
  note TEXT NOT NULL DEFAULT ''
```

Lý do chọn bảng riêng:

- rõ nghĩa hơn `app_state`
- dễ audit và mở rộng cho lock khác sau này
- dễ enforce atomic bằng SQLite transaction

## 4.10. Dữ liệu assignment đề xuất

Để hỗ trợ rule `1 sản phẩm thiếu -> 1 phiếu nhập mở`, header `purchase.source_type/source_code` là không đủ.

Đề xuất thêm bảng:

```text
procurement_assignments
  id INTEGER PRIMARY KEY AUTOINCREMENT
  product_id INTEGER NOT NULL
  purchase_id TEXT NOT NULL
  mode TEXT NOT NULL
  scope_type TEXT NOT NULL
  scope_code TEXT NOT NULL DEFAULT ''
  assigned_quantity REAL NOT NULL
  assigned_by TEXT NOT NULL
  assigned_at TEXT NOT NULL
  released_at TEXT
  status TEXT NOT NULL DEFAULT 'active'
```

Giải thích:

- `product_id`: mặt hàng đang thiếu
- `purchase_id`: phiếu nhập đang chịu trách nhiệm xử lý
- `mode`: `batch`
- `scope_type`: `all`, `cart`, hoặc `product`
- `scope_code`: mã cart hoặc product nếu mở planner theo phạm vi hẹp
- `assigned_quantity`: số lượng shortage app đang giao phiếu này cover
- `status`: `active` hoặc `released`

Đề xuất thêm unique rule:

- chỉ cho `1 assignment active / 1 product / mode=batch`

Lợi ích:

- biết một sản phẩm đang được phiếu nào xử lý
- tránh duplicate assignment khi nhiều máy cùng mở
- không cần lạm dụng header `source_type/source_code` cho case nhiều cart

## 4.11. Quan hệ với bảng `purchases`

Màn `purchases` vẫn là nguồn sự thật cho phiếu nhập.

Planner không tạo loại chứng từ mới.

Planner chỉ:

- tạo phiếu draft mới nếu cần
- mở phiếu draft cùng NCC nếu phù hợp
- gán responsibility của `product shortage` sang phiếu đó

Không khuyến nghị thêm nhiều cột mới vào `purchases` ở phase đầu.

Nếu cần hiển thị badge `Batch planner`, có thể suy ra từ `procurement_assignments`.

## 4.12. API đề xuất

### Runtime mode và lock

- `GET /api/procurement/status`
- `POST /api/procurement/batch/start`
- `POST /api/procurement/batch/finish`
- `POST /api/procurement/batch/refresh-lock`

### Planner data

- `GET /api/procurement/planner?scope=all`
- `GET /api/procurement/planner?scope=cart&cart_id=...`
- `GET /api/procurement/planner?scope=product&product_id=...`

### Assignment actions

- `POST /api/procurement/assignments/assign`
- `POST /api/procurement/assignments/move`
- `POST /api/procurement/assignments/release`

### Purchase helper actions

- `POST /api/procurement/purchases/create-draft`
- `POST /api/procurement/purchases/attach-existing-draft`

Các action này phải validate server-side:

- mode hiện tại
- quyền user
- lock owner
- product đã có assignment active chưa
- phiếu đích có hợp lệ không

## 4.13. Ứng xử của shortage flow theo mode

### Khi `daily mode`

Nếu `allow_daily_quick_shortage_flow = true`:

- user vẫn được dùng flow nhanh theo cart như hiện tại
- UI nên thêm lựa chọn phụ `Sang màn xử lý nhập thiếu`

Nếu policy tắt flow nhanh:

- mọi shortage flow đều mở planner dù đang daily mode

### Khi `batch mode`

Bắt buộc:

- tắt auto-create purchase theo cart ở shortage flow
- mọi entry point shortage chỉ được mở planner
- màn planner là nơi duy nhất được tạo/gán purchase cho shortage

## 4.14. Tương thích ngược dữ liệu cũ

### Purchase cũ có `source_type=cart`

Giữ nguyên, không migration cưỡng bức.

Batch planner không được tự ý convert purchase cũ.

### Khi bật batch mode mà đang có purchase mở cũ

Trước khi acquire lock, server nên audit nhanh:

- có product nào đang nằm trong nhiều purchase `draft/ordered` mở không
- có purchase cart-source nào đang cover cùng product với purchase khác không

Nếu có:

- app báo `cần dọn conflict trước khi bắt đầu kỳ gom nhập`
- cho mở danh sách phiếu liên quan để user quyết định

### Khi batch mode kết thúc

Không bắt buộc convert assignment thành cấu trúc khác.

Chỉ cần:

- release lock
- trả runtime mode về `daily`
- giữ assignment active để còn biết product nào đang do phiếu nào phụ trách

Assignment sẽ tự release khi:

- phiếu bị hủy
- product bị gỡ khỏi phiếu
- phiếu chuyển sang `received`
- hoặc user chủ động move/release trong planner

## 4.15. Quy tắc conflict và multi-screen

Thiết kế mới phải coi đây là luồng nhiều entry point:

- `inventory`
- `create-order`
- `orders`
- `purchases`

Nguyên tắc:

1. mọi entry point chỉ được truyền `scope/context`
2. mọi mutate thật phải đi qua API planner chung
3. không để từng màn tự sửa `state.purchases` rồi persist theo collection cho case batch

Lý do:

- cơ chế `expected_updated_at + 409` hiện tại là cần, nhưng chưa đủ để bảo vệ invariant `1 product = 1 active batch assignment`

## 5. Open Questions Cần Chốt Trước Khi Code

1. User khác trong batch mode được `read-only planner` hay bị chặn hoàn toàn?
   - khuyến nghị: cho read-only để vẫn nhìn thấy ai đang xử lý
2. Khi lock hết hạn mà owner vẫn đang thao tác dở, có tự renew định kỳ không?
   - khuyến nghị: có heartbeat nhẹ từ client khi owner đang ở planner
3. Product đã gán vào purchase `ordered` nhưng NCC báo thiếu hàng, có được move sang purchase khác không?
   - khuyến nghị: có, nhưng phải đi qua action `move assignment` và chỉ khi purchase đích còn mở hợp lệ
4. Batch mode có cần khóa luôn nhánh tạo purchase tay ở màn `purchases` không?
   - khuyến nghị: không khóa hoàn toàn, nhưng với product đang có assignment active thì phải báo và chặn thêm trùng
5. Có cần thêm menu riêng hay chỉ hiện màn qua nút điều hướng?
   - khuyến nghị: có menu riêng để user dễ quay lại trong lúc xử lý batch kéo dài

## 6. Checklist Thiết Kế Và Triển Khai

## 6.1. Checklist config và quyền

- [ ] Thêm namespace `procurement` vào `system_config.json`
- [ ] Mở rộng user config để nhận `permissions`
- [ ] Xác nhận `procurement_batch_manage` không kéo theo quyền admin khác
- [ ] Xác nhận batch mode yêu cầu `EnableLogin = true`

## 6.2. Checklist runtime mode và lock

- [ ] Thêm runtime mode `daily/batch`
- [ ] Thêm bảng `workflow_locks`
- [ ] Batch mode chỉ cho 1 owner sửa
- [ ] Có timeout lock
- [ ] Có release lock an toàn
- [ ] Có heartbeat hoặc renew lock

## 6.3. Checklist planner

- [ ] Thêm màn `procurement-planner`
- [ ] Có scope `all/cart/product`
- [ ] Tính shortage ở mức product
- [ ] Hiện cảnh báo `sau nhập vẫn dưới ngưỡng`
- [ ] Hiện purchase đang được gán cho mỗi product
- [ ] Có thao tác tạo phiếu mới / gán phiếu cũ / chuyển phiếu

## 6.4. Checklist rule shortage

- [ ] Daily mode vẫn giữ được flow nhanh nếu policy cho phép
- [ ] Batch mode tắt auto-create purchase theo cart
- [ ] Batch mode enforce `1 product -> 1 active assignment`
- [ ] Không split một product sang nhiều purchase trong batch
- [ ] `committed demand` được ưu tiên cover trước `draft demand`

## 6.5. Checklist schema và compatibility

- [ ] Thêm bảng `procurement_assignments`
- [ ] Không phá purchase cũ có `source_type=cart`
- [ ] Có audit conflict trước khi bắt đầu batch mode
- [ ] Có rule release assignment khi purchase đóng hoặc đổi trạng thái

## 6.6. Checklist API/backend

- [ ] API status/start/finish batch mode
- [ ] API planner data
- [ ] API assign/move/release assignment
- [ ] Check quyền theo username/permission
- [ ] Check lock owner
- [ ] Check invariant `1 product -> 1 active batch assignment`

## 6.7. Checklist frontend

- [ ] Thêm menu hoặc entry point `Xử lý nhập thiếu`
- [ ] Update confirm/toast khi shortage flow đang ở batch mode
- [ ] Chặn nhánh auto-create purchase theo cart trong batch mode
- [ ] Hiện rõ lock owner và mode hiện tại
- [ ] Nếu current user không có quyền, render planner ở read-only hoặc disabled state

## 6.8. Checklist docs

- [ ] Cập nhật `README.md` phần docs/link
- [ ] Cập nhật `docs/SCREEN_DESIGN.md` để link tài liệu detail này
- [ ] Khi code được triển khai thật, cập nhật tiếp:
  - `docs/HUONG_DAN_SU_DUNG.md`
  - `docs/BUSINESS_FLOW.md`
  - `docs/DB_DESIGN.md`
  - `docs/PHIEU_DISPLAY_DESIGN.md`
  - help trong `static/modules/screen-config.js`

## 6.9. Checklist test đề xuất

- [ ] Unit: config user có permission mới vẫn load backward compatible
- [ ] Unit: user `bizmanager` không phải admin nhưng vào được batch planner
- [ ] Unit: user `bizmanager` không được direct adjust tồn
- [ ] Unit: batch mode bị chặn khi `EnableLogin = false`
- [ ] Unit: 2 request cùng lúc acquire lock chỉ 1 request thành công
- [ ] Unit: 2 request cùng lúc assign cùng `product_id` chỉ 1 request thành công
- [ ] Integration: daily mode vẫn dùng flow shortage nhanh như cũ nếu policy cho phép
- [ ] Integration: batch mode mở từ `inventory/create-order/orders` đều vào planner đúng scope
- [ ] Integration: user không cầm lock không sửa được planner
- [ ] Integration: owner release lock xong runtime mode về `daily`
- [ ] Regression: purchase cũ gắn `source_type=cart` vẫn mở/sửa theo flow cũ

## 7. Lộ Trình Triển Khai Đề Xuất

### Phase 1

- thêm config `procurement`
- thêm permission user
- thêm runtime mode + lock API
- chưa enforce assignment

### Phase 2

- thêm màn planner
- thêm scope `all/cart/product`
- batch mode chuyển toàn bộ shortage flow sang planner

### Phase 3

- thêm bảng `procurement_assignments`
- enforce `1 product -> 1 active batch assignment`
- chặn duplicate assignment server-side

### Phase 4

- tinh chỉnh read-only mode cho user khác
- thêm audit, banner, report hỗ trợ planner

## 8. Kết luận

Phương án phù hợp nhất với nhóm `1-3 user` không phải là ép toàn bộ app sang planner-driven workflow.

Thiết kế tối ưu hơn là:

1. giữ `daily mode` cho thao tác nhanh theo đơn
2. thêm `batch mode` cho kỳ gom nhu cầu nhập
3. dùng `exclusive lock` để chỉ 1 người phụ trách nghiệp vụ xử lý batch
4. áp rule chặt `1 sản phẩm thiếu -> 1 phiếu nhập mở` chỉ trong batch mode

Nhờ vậy:

- ngày thường không bị nặng thao tác
- kỳ gom nhập vẫn có kiểm soát chặt
- `quản lý kinh doanh` không cần thành `Master Admin`
- hệ thống giảm đáng kể rủi ro tạo phiếu nhập trùng và conflict nhiều màn hình
