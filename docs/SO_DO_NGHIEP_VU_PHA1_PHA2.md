# Sơ đồ Nghiệp vụ & Cơ chế Vận hành: Pha 1 & Pha 2

Tài liệu này mô tả chi tiết kiến trúc, luồng dữ liệu và cơ chế phối hợp đồng bộ giữa **Pha 1 (Môi trường trung gian & Thẩm định qua Agent)** và **Pha 2 (Portal Quản lý Vận hành Chuyên biệt)** nhằm giúp chủ cửa hàng và đội ngũ kỹ thuật triển khai hoàn chỉnh, an toàn, không có độ trễ hay sai sót dữ liệu.

---

## 1. Tổng quan Kiến trúc Hai Pha

```mermaid
flowchart TD
    subgraph SOURCEDATA["Nguồn Dữ liệu Đầu vào"]
        A1["Tin nhắn Zalo NCC / Khách"]
        A2["Bảng tính Excel / Báo giá"]
        A3["Văn bản tự nhiên / Ghi chú kiểm kho"]
    end

    subgraph PHASE1["PHA 1: Môi trường Trung gian & Thẩm định (Chat Workspace + Headless Bridge)"]
        B1["Agent Intake: Tiếp nhận & Chuẩn hóa cấu trúc"]
        B2["Live Scrutiny: Đối soát dữ liệu thực với Debian"]
        B3["Audit Table & Warnings: Báo cáo xem trước & Cảnh báo rủi ro"]
        B4["User Approval: Chủ cửa hàng duyệt 'OK đưa lên'"]
        B5["Headless Execution: scripts/remote_ops.py"]
    end

    subgraph DEBIAN["Máy chủ Production (Debian 12 / Trixie)"]
        C1["Reverse Proxy Nginx (SSL/TLS)"]
        C2["Flask / Waitress Backend (Port 4000)"]
        C3["Database SQLite (inventory.db)"]
    end

    subgraph PHASE2["PHA 2: Manager Operations Portal (Giao diện Vận hành Độc lập)"]
        D1["Web Ingestion UI: Upload Excel / Dán Batch Data"]
        D2["Staging Table UI: Hiển thị trạng thái New/Update & Cảnh báo"]
        D3["Action Bar: Nút bấm Phê duyệt & Đẩy trực tiếp"]
        D4["Batch Audit Logs: Lịch sử thao tác & Phiên vận hành"]
    end

    SOURCEDATA -->|"Nhập liệu qua Chat"| B1
    SOURCEDATA -->|"Tải file / Nhập trực tiếp"| D1

    B1 --> B2
    B2 <-->|"Tra cứu DB thực"| C2
    B2 --> B3
    B3 --> B4
    B4 --> B5
    B5 -->|"Gọi Headless REST APIs"| C1

    D1 --> D2
    D2 <-->|"API Kiểm tra đối soát"| C2
    D2 --> D3
    D3 -->|"Sync trực tiếp"| C1
    D3 --> D4

    C1 --> C2 --> C3
```

---

## 2. Pha 1: Cơ chế Tiếp nhận & Xét kỹ (Intake & Scrutiny Protocol)

Pha 1 là môi trường trung gian hoạt động như **người gác cổng (gatekeeper)** an toàn nhất. Mọi yêu cầu được thẩm định đối chiếu với dữ liệu thực trước khi ghi vào máy chủ Debian.

```mermaid
sequenceDiagram
    autonumber
    actor User as Chủ Cửa Hàng
    participant Agent as Agent Tiếp Nhận
    participant Bridge as Remote Ops Bridge (Python CLI)
    participant Server as Debian Server (Nginx + Flask)
    participant DB as SQLite (inventory.db)

    User->>Agent: Gửi nội dung thô (tin nhắn, bảng giá, danh sách nhập hàng)
    Note over Agent: Bóc tách thực thể: Tên món, ĐVT, Giá nhập, Giá bán, Tồn kho
    Agent->>Bridge: Yêu cầu thẩm định dữ liệu (preview_scrutiny)
    Bridge->>Server: GET /api/session/status + Login Admin
    Server-->>Bridge: Trả về Session Cookie
    Bridge->>Server: GET /api/products
    Server->>DB: Truy vấn 45 sản phẩm và tồn kho hiện hữu
    DB-->>Server: Trả về kết quả
    Server-->>Bridge: Danh sách sản phẩm thực tế trên hệ thống

    Note over Bridge: Thuật toán đối soát:<br/>1. Phân loại Món Mới vs Món Cập Nhật<br/>2. Kiểm tra biên độ giá (> 30%)<br/>3. Kiểm tra logic giá (Giá bán < Giá nhập)

    Bridge-->>Agent: Trả về kết quả thẩm định + Cảnh báo rủi ro
    Agent->>User: Hiển thị Bảng Thẩm Định Xem Trước (Review Sheet) + Cảnh báo

    alt Dữ liệu có sai sót hoặc người dùng muốn điều chỉnh
        User->>Agent: Yêu cầu sửa giá/tên/ĐVT
        Note over Agent: Cập nhật lại payload và chạy lại thẩm định
    else Người dùng đồng ý
        User->>Agent: Xác nhận duyệt: "OK đưa lên hệ thống"
        Agent->>Bridge: Thực thi push dữ liệu (push_products / push_purchase / push_adjustment)
        Bridge->>Server: POST /api/admin/import/products (hoặc quick-create)
        Server->>DB: Thực hiện Migration/Giao dịch Atomic SQLite
        DB-->>Server: Ghi thành công
        Server-->>Bridge: HTTP 200 (Số lượng tạo mới, cập nhật, mã phiếu)
        Bridge-->>Agent: Trả về trạng thái hoàn thành
        Agent->>User: Thông báo kết quả chi tiết & cập nhật tồn kho mới
    end
```

---

## 3. Pha 2: Portal Quản lý Vận hành (Store Manager Portal)

Khi nhu cầu vận hành thường xuyên hơn và mở rộng cho nhiều người quản lý (Business Manager / Kho trưởng), Pha 2 đóng gói toàn bộ quy trình từ Pha 1 lên một giao diện Web Portal riêng biệt.

```mermaid
flowchart LR
    subgraph UI["Portal Quản Lý (Màn hình riêng)"]
        U1["Khung Nhập Liệu Nhanh (Paste text / Drag Excel)"]
        U2["Bộ Phân Tích Cú Pháp Trực Quan (Live Parser)"]
        U3["Lưới Đối Soát Dữ Liệu (Staging Grid)"]
        U4["Bảng Điều Khiển Cảnh Báo (Risk Flags)"]
        U5["Nút 'Phê Duyệt & Đẩy Lên Server'"]
        U6["Nhật Ký Đợt Nhập (Batch History Log)"]
    end

    subgraph BACKEND["Debian Backend API"]
        API1["POST /api/admin/import/preview"]
        API2["POST /api/admin/import/commit"]
        API3["GET /api/admin/import/history"]
    end

    U1 --> U2 --> U3
    U3 <-->|"Gửi dữ liệu thô để kiểm tra"| API1
    API1 -->|"Trả về New vs Update + Cảnh báo"| U4
    U4 --> U5
    U5 -->|"Xác nhận đẩy thật"| API2
    API2 --> U6
    U6 <--> API3
```

---

## 4. Bảng So sánh & Phối hợp Đồng bộ Giữa 2 Pha

| Tiêu chí | Pha 1 (Hiện tại - Agent Bridge) | Pha 2 (Tiến tới - Manager Portal) |
| :--- | :--- | :--- |
| **Giao diện** | Trò chuyện tự nhiên (Chat), dán text tự do | Web Portal chuyên nghiệp, form lưới, upload file kéo thả |
| **Đối tượng dùng** | Chủ shop + Kỹ sư hệ thống (Agent) | Chủ shop, Quản lý kinh doanh (`bizmanager`), Thủ kho |
| **Công cụ lõi** | `scripts/remote_ops.py` (CLI + Python Client) | REST APIs chuyên dụng tích hợp vào Flask app |
| **Ưu điểm** | - Linh hoạt tuyệt đối (hiểu mọi định dạng văn bản thô)<br/>- Kiểm tra bằng ngôn ngữ tự nhiên<br/>- Không cần sửa frontend UI ngay | - Trực quan, nhiều nhân sự cùng làm việc<br/>- Nhanh chóng với số lượng hàng trăm mã<br/>- Lưu vết phiên thao tác (Batch sessions) |
| **Tính đồng bộ** | **Dùng chung 1 DB & 1 hệ thống quy tắc** | **Dùng chung 1 DB & 1 hệ thống quy tắc** |

---

## 5. Kế hoạch Triển khai Từng Bước

1. **Bước 1 (Đã hoàn thành - Pha 1 sẵn sàng)**:
   - Cầu nối `scripts/remote_ops.py` đã kết nối an toàn với máy chủ Debian (`https://qts-home.duckdns.org/qltp/`).
   - Đã cấu hình và test thành công các nghiệp vụ: Đăng nhập Master Admin, tra cứu sản phẩm, thẩm định cảnh báo rủi ro giá, đẩy cập nhật lên server.
   - Bạn có thể bắt đầu sử dụng ngay để đưa dữ liệu thực tế lên cửa hàng.

2. **Bước 2 (Vận hành Pha 1 thực tế để chuẩn hóa nghiệp vụ)**:
   - Đưa các danh mục hàng thật, bảng giá và tồn kho thực tế vào chat để chuẩn hóa danh sách sản phẩm.
   - Ghi nhận những tình huống thực tế (các biến thể đơn vị tính, cách đặt tên của các nhà cung cấp khác nhau).

3. **Bước 3 (Thiết kế & Xây dựng Pha 2 - Manager Portal)**:
   - Xây dựng màn hình `/portal` hoặc `/admin/operations` trên frontend.
   - Tận dụng logic đối soát `preview_scrutiny` của Pha 1 chuyển thành endpoint backend `/api/admin/operations/preview`.
   - Bàn giao giao diện cho chủ shop và nhân sự quản trị sử dụng trực tiếp trên trình duyệt hoặc điện thoại.
