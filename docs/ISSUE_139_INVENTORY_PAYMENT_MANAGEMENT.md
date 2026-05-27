# Issue 139 — Màn hình quản lý thanh toán & công nợ đơn giản (Hệ thống quản lý tồn kho & xuất hàng)

## Bối cảnh hệ thống

Đây là hệ thống quản lý tồn kho, nhập hàng, xuất hàng.
Đối tượng sử dụng chủ yếu là user nội bộ, user mới (newbie), thường thao tác trên mobile/tablet.

Yêu cầu ưu tiên:
- Giao diện đơn giản.
- Dễ hiểu.
- Ít thao tác.
- Hạn chế thuật ngữ khó.
- Ngôn ngữ hiển thị: tiếng Việt.
- Backend/database/service có thể dùng naming tiếng Anh.

---

# Issue 139: Thêm màn hình quản lý thanh toán & công nợ

## Mục tiêu

Bổ sung chức năng quản lý thanh toán và công nợ ở mức đơn giản.

Mục tiêu chính:
- User dễ biết phiếu nào đã thanh toán.
- Phiếu nào chưa thanh toán.
- Không cần theo dõi thủ công bằng Excel.
- Giao diện dễ dùng cho user mới.

Lưu ý:
- Giai đoạn hiện tại CHƯA cần hỗ trợ thanh toán nhiều lần.
- Mỗi phiếu chỉ cần hỗ trợ 1 trạng thái thanh toán.
- Chỉ cần nhập thông tin thanh toán một lần.
- Tuy nhiên backend/database nên thiết kế để sau này có thể mở rộng thêm nhiều lần thanh toán nếu cần.

---

# Phạm vi nghiệp vụ

## 1. Công nợ khách hàng (phải thu)

Phát sinh từ:
- Phiếu xuất hàng.

Cần quản lý:
- Trạng thái thanh toán.
- Ngày thanh toán.
- Phương thức thanh toán.
- Ghi chú thanh toán.

---

## 2. Công nợ nhà cung cấp (phải trả)

Phát sinh từ:
- Phiếu nhập hàng.

Cần quản lý:
- Trạng thái thanh toán.
- Ngày thanh toán.
- Phương thức thanh toán.
- Ghi chú thanh toán.

---

# Yêu cầu UI/UX

Ưu tiên:
- Mobile-first.
- Dễ thao tác.
- Ít bước.
- User mới cũng hiểu được.

Không dùng thuật ngữ kế toán phức tạp.

Ví dụ:
- Dùng “Còn nợ” thay vì “Công nợ tồn”.
- Dùng “Đã thanh toán” thay vì “Đã đối soát”.

---

# Màn hình quản lý thanh toán

## Chia 2 tab

### Tab 1: Khách hàng
Hiển thị các phiếu xuất hàng.

### Tab 2: Nhà cung cấp
Hiển thị các phiếu nhập hàng.

---

# Thông tin hiển thị trên danh sách

Mỗi dòng hiển thị:

- Mã phiếu
- Ngày tạo
- Tên khách hàng hoặc NCC
- Tổng tiền
- Trạng thái
- Ngày thanh toán
- Phương thức thanh toán

Trạng thái hiển thị:
- Chưa thanh toán
- Đã thanh toán

Ưu tiên highlight:
- Phiếu chưa thanh toán.

---

# Chức năng chính

## 1. Tìm kiếm

Cho phép search theo:
- Mã phiếu
- Tên khách hàng
- Tên nhà cung cấp

---

## 2. Filter

Cho phép lọc:
- Chưa thanh toán
- Đã thanh toán

---

## 3. Xem chi tiết phiếu

Cho phép mở nhanh:
- Phiếu nhập
- Phiếu xuất

Từ màn hình quản lý thanh toán.

---

## 4. Cập nhật thanh toán

User có thể cập nhật:
- Trạng thái thanh toán
- Ngày thanh toán
- Phương thức thanh toán
  - Tiền mặt
  - Chuyển khoản
  - Khác
- Ghi chú

Phạm vi hiện tại:
- Mỗi phiếu chỉ lưu 1 trạng thái thanh toán.
- Không hỗ trợ thanh toán nhiều lần.
- Không hỗ trợ thanh toán một phần.
- Không cần lưu transaction payment.

Ví dụ:
- Phiếu chưa thanh toán.
- User chuyển trạng thái sang “Đã thanh toán”.
- Nhập ngày thanh toán.
- Chọn phương thức thanh toán.

UI cần đơn giản, thao tác nhanh, dễ hiểu.

UI cần đơn giản, thao tác nhanh, dễ hiểu.

---

## 5. Ghi chú mở rộng sau này

Hiện tại chưa cần:
- Thanh toán nhiều lần.
- Lịch sử nhiều transaction.
- Đối soát phức tạp.

Nhưng backend/database nên thiết kế để sau này có thể mở rộng thêm nếu nghiệp vụ phát sinh.

---

# Logic tính toán

## Tổng tiền

Lấy từ:
- Phiếu nhập.
- Phiếu xuất.

Không cho sửa tay trực tiếp ở màn hình thanh toán.

---



---

## Trạng thái thanh toán

### Chưa thanh toán
Khi:
- payment_status = unpaid

### Đã thanh toán
Khi:
- payment_status = paid
Khi:
- Đã thanh toán >= Tổng tiền

---

# Các case cần xử lý

## Case 1
Phiếu chưa thanh toán.

## Case 2
Đã thanh toán.

## Case 3
Đổi trạng thái từ chưa thanh toán sang đã thanh toán.

## Case 4
Chuẩn bị khả năng mở rộng cho thanh toán nhiều lần trong tương lai.

Hiện tại chưa cần implement UI/logic thanh toán nhiều lần.

## Case 5
Phiếu bị sửa tổng tiền sau khi đã thanh toán.
→ Không được làm sai trạng thái thanh toán.

## Case 6
Phiếu bị hủy/xóa.
→ Cần kiểm tra ảnh hưởng dữ liệu thanh toán.

---

# Đề xuất backend

Hiện tại ưu tiên structure đơn giản.

Có thể bổ sung trực tiếp vào phiếu nhập/xuất:
- payment_status
- payment_date
- payment_method
- payment_note

Hoặc tách bảng payment_summary nếu muốn.

Lưu ý:
- Chưa cần bảng transaction/payment history phức tạp.
- Nhưng naming/structure nên chuẩn bị để sau này mở rộng được.

---

# Yêu cầu kỹ thuật

- Không làm ảnh hưởng flow nhập hàng/xuất hàng hiện tại.
- Không degrade performance list.
- Mobile/tablet phải thao tác tốt.
- Ưu tiên giao diện đơn giản.
- Hạn chế popup nhiều tầng.
- Nếu có modal thì phải dễ dùng trên mobile.

---

# Sau khi implement

Yêu cầu:
- Chạy toàn bộ test hiện có.
- Nếu có Playwright thì bổ sung test cơ bản:
  - Cập nhật trạng thái thanh toán.
  - Chuyển sang đã thanh toán.
  - Filter chưa thanh toán.

- Kiểm tra responsive:
  - PC
  - Tablet
  - Mobile

- Commit rõ ràng theo Issue 139.

