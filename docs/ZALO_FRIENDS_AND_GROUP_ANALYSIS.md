# PHÂN TÍCH KỸ THUẬT & GIẢI PHÁP TÍCH HỢP ZALO: LỌC BẠN BÈ & NHÓM ZALO (FRIENDS & GROUP FILTERING)

**Tài liệu phân tích:** Dành cho tính năng kiểm soát quyền đặt hàng qua Zalo Friend & Zalo Group  
**Dự án:** Quản lý thực phẩm chay  
**Ngày lập:** 2026-08-21  

---

## 1. ĐẶT VẤN ĐỀ & MỤC TIÊU NGHIỆP VỤ

### Yêu cầu 1: Giới hạn theo danh sách bạn bè của Zalo Admin
- **Mục tiêu:** Tránh spam, bảo mật thông tin nội bộ. Chỉ những tài khoản Zalo đã kết bạn (Friends) với tài khoản Zalo Developer Admin của Project (hoặc tài khoản Zalo Đồng quản trị) mới được phép nhìn thấy link Zalo xác nhận / đặt hàng trên hệ thống.

### Yêu cầu 2: Giới hạn theo Nhóm Zalo (Zalo Group)
- **Mục tiêu:** Chỉ những khách hàng Zalo có tham gia vào các **Group Zalo** cụ thể (được cấu hình trong trang Quản trị Web Admin) mới được phép chốt đơn.
- Mỗi Group Zalo đóng vai trò như một **Chi nhánh vận chuyển** (Branch / Hub) giao hàng đến khách hàng.

---

## 2. PHÂN TÍCH KỸ THUẬT & RÀO CẢN CỦA ZALO OPEN API (HIỆN HÀNH)

Để triển khai đúng kỹ thuật và ổn định lâu dài, cần nắm rõ các chính sách bảo mật và hạn chế của nền tảng Zalo Platform:

### 2.1. Về cơ chế Zalo OAuth v4 trên Web thông thường:
- Khi khách hàng đăng nhập web bằng Zalo Login (OAuth 2.0 / v4):
  - Ứng dụng Web chỉ nhận được: `id` (Zalo App-scoped User ID), `name`, `picture` (ảnh đại diện).
  - Scope này **không** cung cấp quyền đọc toàn bộ danh bạ hay danh sách nhóm của người dùng cá nhân.

### 2.2. Về Zalo Friends API (Danh bạ bạn bè):
- Zalo đã **đóng hoàn toàn Open API truy vấn danh sách bạn bè** của tài khoản cá nhân thông qua Zalo Open API thông thường để tránh rò rỉ dữ liệu cá nhân.
- Zalo Open API **không có endpoint** công khai dạng `check_is_friend(user_A, admin_B)`.

### 2.3. Về Zalo Group API (Danh sách nhóm & thành viên):
- Zalo không cung cấp Open API cho bên thứ 3 truy cập tin nhắn hay danh sách thành viên của Group Zalo cá nhân.
- Nhóm Zalo thông thường thuộc phạm vi chat P2P / mã hóa đầu cuối nội bộ của ứng dụng Zalo.

---

## 3. CÁC PHƯƠNG ÁN KIẾN TRÚC KHẢ THI (ĐÁNH GIÁ & SO SÁNH)

---

### 🟢 PHƯƠNG ÁN 1: QUẢN LÝ WHITELIST BẰNG ZALO ID / SĐT KẾT HỢP CHI NHÁNH TRÊN WEB ADMIN (Khuyên dùng - An toàn, Ổn định nhất)

#### Cơ chế hoạt động:
1. Trong màn hình Admin (Quản lý Khách hàng / Nhóm Chi nhánh):
   - Thêm cột / thuộc tính **"Nhóm Zalo / Chi nhánh"** (ví dụ: `Chi nhánh Quận 1`, `Group Zalo Cư Xá Đô Thành`, `Group Bạn Bè Admin`).
   - Admin chỉ định Zalo ID hoặc SĐT của những người được phép đặt hàng vào nhóm tương ứng.
2. Khi khách hàng đăng nhập Zalo trên web:
   - Hệ thống lấy `zalo_id` (hoặc đối chiếu SĐT).
   - Kiểm tra xem khách đã được Admin kích hoạt trong Whitelist / Nhóm hợp lệ hay chưa.
   - Nếu chưa: Hệ thống hiển thị thông báo *"Tài khoản Zalo của bạn chưa được cấp quyền đặt hàng trong nhóm. Vui lòng liên hệ Admin để được thêm vào nhóm."*
   - Nếu hợp lệ: Đơn hàng tự động gán đúng Chi nhánh / Nhóm vận chuyển tương ứng.

#### Ưu điểm:
- 100% chuẩn quy chuẩn bảo mật Zalo, không lo bị khóa tài khoản Zalo cá nhân.
- Chạy hoàn toàn trên Python stdlib + SQLite, không phụ thuộc thư viện ngoài.
- Dễ dàng phân loại chi nhánh, quản lý tập trung và phân quyền chi tiết.

---

### 🟡 PHƯƠNG ÁN 2: TỰ ĐỘNG HÓA QUA ZALO BOT CHẠY NỀN (Zalo Client Automation / PyZalo / zca-js)

#### Cơ chế hoạt động:
1. Sử dụng tài khoản Zalo Developer Admin (hoặc nick Zalo phụ đóng vai trò Bot) đăng nhập vào một dịch vụ Bot Zalo nội bộ (chạy daemon trên cùng VPS/Server).
2. Dịch vụ Bot này có quyền truy cập trực tiếp vào danh bạ bạn bè và các Group Zalo mà nick Admin đang tham gia:
   - Tự động quét danh sách Bạn bè của Admin.
   - Tự động quét danh sách Thành viên của các Group Zalo chi nhánh (theo `group_id`).
3. Định kỳ (mỗi 5-15 phút), Bot tự động đồng bộ danh sách Zalo ID thành viên vào bảng `group_members` trong SQLite của app.
4. Khi khách vào web đặt hàng: App đối chiếu tự động với dữ liệu sync mới nhất từ Bot.

#### Ưu điểm:
- Tự động hóa 100%, không cần Admin nhập tay từng thành viên.
- Khách hễ được add vào Group Zalo hoặc kết bạn với Admin là tự động được cấp quyền đặt hàng ngay.

#### Nhược điểm & Rủi ro:
- Cần duy trì cookie/session của tài khoản Zalo và có rủi ro Zalo checkpoint nếu bot gửi quá nhiều request.
- Cần thêm module service chạy nền.

---

### 🔵 PHƯƠNG ÁN 3: TÍCH HỢP ZALO MINI APP HOẶC ZALO OA (OFFICIAL ACCOUNT) DOANH NGHIỆP

#### Cơ chế hoạt động:
1. Tạo Zalo Mini App chạy trực tiếp bên trong Zalo.
2. Đăng ký Zalo Official Account (Doanh nghiệp).
3. Người dùng đặt hàng trực tiếp trong Zalo Mini App, hệ thống tận dụng các tính năng tương tác của OA để gửi tin nhắn thông báo xác nhận đơn trực tiếp vào hộp chat Zalo của khách hàng và Admin.

#### Đánh giá:
- Thích hợp cho giai đoạn mở rộng quy mô doanh nghiệp bài bản.

---

## 4. ĐỀ XUẤT LỘ TRÌNH TRIỂN KHAI CHO PROJECT

1. **Giai đoạn 1 (Đã hoàn thành ngay trong lượt này):**
   - Bật setting Bắt buộc đăng nhập Zalo (`require_zalo_login: true`).
   - Thêm ghi chú *"Chưa bao gồm chi phí vận chuyển"*.
   - Tạo Popup thông báo đặt hàng thành công + Link Zalo xác nhận người bán + Nút Sao chép thông tin đơn hàng gửi Zalo.

2. **Giai đoạn 2 (Xử lý Issue riêng - Nhóm Chi Nhánh & Whitelist):**
   - Triển khai **Phương án 1 (Whitelist Nhóm & Chi nhánh trên Admin)** để hệ thống hoạt động ổn định, chính xác tuyệt đối.
   - Bổ sung bảng cấu hình `zalo_groups` và liên kết với `customers.zalo_group_id`.

3. **Giai đoạn 3 (Nếu cần tự động hóa hoàn toàn):**
   - Xây dựng module Bot Reader đồng bộ danh sách thành viên Group Zalo vào database.
