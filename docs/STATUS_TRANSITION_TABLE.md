# Bảng Chuyển Trạng Thái

Tài liệu này là bảng tham chiếu ngắn gọn cho các workflow trạng thái chính của app.

Mục tiêu:

- làm nguồn confirm nhanh trước khi code
- giảm tranh luận mơ hồ kiểu "được chuyển hay không"
- tách riêng rule trạng thái ra khỏi mô tả flow dài trong `BUSINESS_FLOW.md`

Ưu tiên tham chiếu:

1. file này
2. `docs/BUSINESS_FLOW.md`
3. `docs/DB_DESIGN.md`
4. code backend trong `qltpchay/store.py`

## 1. Quy ước đọc bảng

- `Allowed`: backend workflow chuẩn cho phép
- `Blocked`: backend phải chặn
- `Locked`: không được sửa ngược trực tiếp; nếu sai phải đi bằng chứng từ/luồng khác
- `Actor`: nhóm user được phép thực hiện
- `Side effect`: tác động nghiệp vụ bắt buộc khi transition xảy ra

## 2. Quy tắc chung

- mọi đổi trạng thái chính đều phải đi qua validate backend
- các nút đổi trạng thái trên UI phải hiện confirm trước khi gửi
- chứng từ đã xử lý xong không được "mở lại nháp"
- nếu dữ liệu legacy bị lệch marker, chỉ đi qua luồng `repair` / `Legacy Audit`, không coi là workflow thường ngày
- khi `Batch procurement mode` đang active, rule chuyển trạng thái của phiếu nhập phải đọc thêm mục 5

## 3. Đơn Hàng

Mô hình hiện tại của đơn hàng gồm:

- `status`: `draft | committed | completed | cancelled`
- `payment_status`: `unpaid | paid`

### 3.1. Chuyển trạng thái chính của đơn hàng

| Từ | Action UI / nghiệp vụ | Sang | Allowed | Điều kiện chính | Actor | Side effect |
| --- | --- | --- | --- | --- | --- | --- |
| `draft` | `Chốt đơn` | `committed` | Allowed | đủ hàng khả dụng theo rule `tồn hiện tại + ordered incoming - reserved committed khác` | user thường / admin | set `committed_at`, phát sinh `order_code`, chưa trừ kho thật |
| `draft` | `Hủy` | `cancelled` | Allowed | đơn chưa xử lý xong | user thường / admin | giữ lịch sử hủy |
| `draft` | `Xuất hàng` | `completed` | Blocked | phải đi qua `committed` trước | mọi actor | không hợp lệ |
| `committed` | `Xuất hàng` | `completed` | Allowed | đủ tồn vật lý thực tế để xuất | user thường / admin | trừ kho thật theo FEFO, set `completed_at` |
| `committed` | `Hủy` | `cancelled` | Allowed | đơn chưa xuất thật | user thường / admin | giải phóng reserved logic của đơn |
| `committed` | quay lại `draft` | `draft` | Blocked | không cho hạ trạng thái | mọi actor | không hợp lệ |
| `completed` | đổi `status` khác | bất kỳ | Locked | đơn đã xuất thật | mọi actor | nếu sai phải đi bằng chứng từ mới |
| `cancelled` | mở lại | bất kỳ | Locked | đơn đã hủy | mọi actor | nếu cần làm lại thì tạo đơn mới |

### 3.2. Chuyển trạng thái thanh toán của đơn hàng

| `status` hiện tại | `payment_status` từ | `payment_status` sang | Allowed | Điều kiện chính | Actor | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- |
| `draft` | `unpaid` | `paid` | Blocked | chưa xuất hàng | mọi actor | không được thu tiền hoàn tất ở đơn nháp |
| `committed` | `unpaid` | `paid` | Blocked | mới chốt đơn, chưa xuất thật | mọi actor | không hợp lệ |
| `completed` | `unpaid` | `paid` | Allowed | đơn đã xuất hàng | user thường / admin | set `paid_at` |
| `completed` | `paid` | `unpaid` | Locked | đã xác nhận thu tiền | mọi actor | không hạ thanh toán trực tiếp |
| `cancelled` | bất kỳ | bất kỳ | Locked | đơn đã hủy | mọi actor | không đổi thanh toán trực tiếp |

### 3.3. Quyền sửa nội dung đơn theo trạng thái

| Trạng thái | Dòng hàng | Khách hàng | Địa chỉ giao | Giảm giá KM |
| --- | --- | --- | --- | --- |
| `draft` | sửa được | sửa được | sửa được | sửa được |
| `committed` | sửa được | khóa | sửa được | sửa được |
| `completed` + `unpaid` | khóa | khóa | khóa | sửa được |
| `completed` + `paid` | khóa | khóa | khóa | khóa |
| `cancelled` | khóa | khóa | khóa | khóa |

## 4. Phiếu Nhập

Mô hình hiện tại của phiếu nhập:

- `status`: `draft | ordered | received | paid | cancelled`

### 4.1. Chuyển trạng thái chính của phiếu nhập

| Từ | Action UI / nghiệp vụ | Sang | Allowed | Điều kiện chính | Actor | Side effect |
| --- | --- | --- | --- | --- | --- | --- |
| `draft` | `Đã đặt hàng` | `ordered` | Allowed | có NCC, có ít nhất 1 dòng hàng hợp lệ | user thường / admin | set/giữ `ordered_at` |
| `draft` | `Nhập kho` | `received` | Blocked | phải đặt hàng trước | mọi actor | không hợp lệ |
| `draft` | `Đã thanh toán` | `paid` | Blocked | chưa nhập kho | mọi actor | không hợp lệ |
| `draft` | `Hủy phiếu` | `cancelled` | Allowed | phiếu chưa xử lý xong | user thường / admin | giữ lịch sử hủy |
| `ordered` | `Nhập kho` | `received` | Allowed | có NCC, có timestamp nhận hàng | user thường / admin, nhưng phải đọc thêm rule batch mode ở mục 5 | ghi receipt nhập kho, cộng tồn thật, set `received_at`, giữ `ordered_at` |
| `ordered` | `Đã thanh toán` | `paid` | Blocked | phải nhập kho trước | mọi actor | không hợp lệ |
| `ordered` | `Hủy phiếu` | `cancelled` | Allowed | phiếu chưa nhập kho | user thường / admin, nhưng phải đọc thêm rule batch mode ở mục 5 | release assignment batch nếu có |
| `ordered` | quay lại `draft` | `draft` | Blocked | không cho hạ trạng thái | mọi actor | không hợp lệ |
| `received` | `Đã thanh toán` | `paid` | Allowed | phiếu đã nhập kho | user thường / admin, kể cả khi batch mode đang active | set `paid_at` |
| `received` | đổi `status` khác ngoài `paid` | bất kỳ | Locked | hàng đã vào kho | mọi actor | nếu sai phải dùng chứng từ khác |
| `paid` | đổi `status` khác | bất kỳ | Locked | phiếu đã thanh toán | mọi actor | không sửa ngược trực tiếp |
| `cancelled` | mở lại | bất kỳ | Locked | phiếu đã hủy | mọi actor | nếu cần nhập lại thì tạo phiếu mới |

### 4.2. Quyền sửa nội dung phiếu nhập theo trạng thái

| Trạng thái | Dòng hàng / số lượng / giá | NCC | Giảm giá KM | HSD / NSX / metadata lô |
| --- | --- | --- | --- | --- |
| `draft` | sửa được | sửa được | sửa được | sửa được |
| `ordered` | sửa được | khóa | sửa được | sửa được |
| `received` | khóa | khóa | sửa được | sửa được |
| `paid` | khóa | khóa | khóa | khóa |
| `cancelled` | khóa | khóa | khóa | khóa |

## 5. Ngoại Lệ Khi Batch Procurement Mode Đang Active

### 5.1. Rule cấu trúc phiếu nhập mở

| Actor | Tạo mới `draft/ordered` | Sửa cấu trúc `draft/ordered` | Đổi NCC | Đổi giảm giá | Hủy / Xóa `draft/ordered` |
| --- | --- | --- | --- | --- | --- |
| lock owner | Allowed | Allowed | Allowed theo rule trạng thái | Allowed theo rule trạng thái | Allowed |
| `Master Admin` | Allowed | Allowed | Allowed theo rule trạng thái | Allowed theo rule trạng thái | Allowed |
| user thường không phải owner | Blocked | Blocked | Blocked | Blocked | Blocked |

### 5.2. Ngoại lệ cho user thường khi batch đang active

| Transition | Phiếu áp dụng | Actor | Allowed | Điều kiện xác nhận |
| --- | --- | --- | --- | --- |
| `ordered -> received` | phiếu `source_type <> procurement_batch` | user thường không phải owner/admin | Allowed | `ordered_at < workflow_locks.procurement_batch.acquired_at` |
| `ordered -> received` | phiếu `source_type = procurement_batch` | user thường không phải owner/admin | Blocked | chỉ owner/admin xử lý |
| `ordered -> received` | phiếu non-batch nhưng `ordered_at >= acquired_at` | user thường không phải owner/admin | Blocked | bị coi là phiếu mở phát sinh trong kỳ batch |
| `received -> paid` | bất kỳ phiếu nhập nào | user thường không phải owner/admin | Allowed | phiếu đã ở `received` hợp lệ |

### 5.3. Ghi chú design quan trọng cho batch mode

- mốc so sánh phải dùng `ordered_at`, không dùng `updated_at`
- nếu DB cũ chưa có `ordered_at`, migration/backfill phải cố gắng suy ra từ audit; nếu vẫn không có thì chỉ fallback cho phiếu còn dấu hiệu đã ở nhánh `ordered/received/paid`
- phiếu `draft -> cancelled` chưa từng qua `ordered` phải giữ `ordered_at = rỗng`
- mục tiêu của lock batch là khóa `cấu trúc phiếu mở`, không khóa bước hậu cần cuối như `received -> paid`

## 6. Workflow Lock Của Batch Procurement

| Từ mode | Action | Sang mode | Allowed | Actor |
| --- | --- | --- | --- | --- |
| `daily` | `Bắt đầu kỳ gom` | `batch` | Allowed | `Master Admin` hoặc user có quyền `procurement_batch_manage` |
| `batch` | `Kết thúc kỳ gom` | `daily` | Allowed | lock owner hoặc `Master Admin` |
| `batch` | acquire lock lần nữa | `batch` | Blocked | user khác | chỉ 1 lock active tại một thời điểm |

## 7. Các Nhánh Không Đi Qua Status Change Trực Tiếp

- sửa sai sau `completed / received / paid`: dùng chứng từ mới
- đơn đã xuất sai: `phiếu trả hàng khách` hoặc chứng từ phù hợp
- phiếu nhập đã nhận sai: `phiếu trả NCC` hoặc điều chỉnh phù hợp
- tài khoản có quyền chỉnh tồn trực tiếp: không phải status transition của đơn/phiếu; đây là workflow đặc biệt riêng

## 8. Checklist Confirm Nhanh Trước Khi Code

- đang nói về `status` hay `payment_status`
- transition có phải nhánh chuẩn hay đang là legacy repair
- có side effect nào bắt buộc phải set không: `committed_at`, `ordered_at`, `received_at`, `paid_at`, `order_code`, receipt kho
- có batch mode active không
- nếu có batch mode: actor có phải owner/admin không
- nếu không phải owner/admin: phiếu đó có phải `procurement_batch` không, và `ordered_at` có trước `acquired_at` không
- sau transition đó, phần nào của chứng từ phải bị khóa
