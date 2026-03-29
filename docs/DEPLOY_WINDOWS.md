# Hướng Dẫn Deploy Trên Windows

Tài liệu này dành cho người cài và vận hành ứng dụng trên Windows.

## 1. Mục tiêu deploy

- Chạy ứng dụng trên 1 máy Windows.
- Các điện thoại / máy tính khác trong cùng mạng nội bộ mở cùng một địa chỉ IP để dùng chung dữ liệu.
- Dữ liệu được lưu trong file `data\inventory.db`.

## 2. Yêu cầu trước khi cài

- Windows 10 hoặc Windows 11
- Python 3.11 trở lên
- Trình duyệt web: Edge, Chrome hoặc Safari trên điện thoại
- Máy deploy nên có IP nội bộ cố định hoặc ít thay đổi

## 3. Cài Python

Nếu máy chưa có Python:

1. Tải Python từ trang chính thức: [python.org](https://www.python.org/downloads/windows/)
2. Khi cài, chọn `Add python.exe to PATH`
3. Mở PowerShell và kiểm tra:

```powershell
python --version
```

Nếu thấy hiện phiên bản Python là được.

## 4. Chép ứng dụng lên máy Windows

Ví dụ thư mục cài:

```text
D:\QUAN\Program\QuanLyThucPhamChay
```

Mở PowerShell tại thư mục dự án:

```powershell
cd D:\QUAN\Program\QuanLyThucPhamChay
```

## 5. Khởi tạo dữ liệu danh mục ban đầu

Nếu đã chuẩn bị `data\List_price.txt`, chạy:

```powershell
python app.py init
```

Nếu muốn xóa sạch và nạp lại từ đầu:

```powershell
python app.py init --reset
```

## 6. Chạy ứng dụng để dùng trong mạng nội bộ

Ví dụ chạy để thiết bị khác trong mạng có thể truy cập:

```powershell
python app.py --host 0.0.0.0 --port 8000
```

Sau đó:

- Trên máy chủ: mở `http://127.0.0.1:8000`
- Trên điện thoại / máy khác: mở `http://IP_MAY_CHU:8000`

Ví dụ:

```text
http://192.168.1.18:8000
```

## 6.1. Tài khoản Master Admin

Hệ thống dùng file cấu hình:

```text
data\system_config.json
```

App sẽ tự tạo file này nếu chưa có.

Ví dụ:

```json
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

Nếu muốn đổi tài khoản admin hoặc host/port mặc định, sửa trực tiếp file này rồi chạy lại app.

Có thể xem config hiện tại bằng:

```powershell
python app.py config
```

Nên đổi mật khẩu admin trước khi đưa vào sử dụng thật.

## 7. Cho phép qua Windows Firewall

Nếu máy khác không vào được, mở port trên Windows Firewall.

Chạy PowerShell với quyền Administrator:

```powershell
New-NetFirewallRule -DisplayName "QuanLyThucPhamChay 8000" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000
```

Nếu dùng port khác thì đổi lại số port.

## 8. Cách dùng ổn định trong thực tế

Nên cố định:

- 1 máy chủ chính
- 1 port cố định, ví dụ `8000`
- 1 địa chỉ IP nội bộ cố định, ví dụ `192.168.1.18`

Khi đó người dùng chỉ cần nhớ:

```text
http://192.168.1.18:8000
```

## 9. Chạy tự động khi mở máy

Cách đơn giản nhất là dùng Task Scheduler.

### 9.1. Tạo file chạy

Tạo file `start-server.bat` trong thư mục dự án với nội dung:

```bat
@echo off
cd /d D:\QUAN\Program\QuanLyThucPhamChay
python app.py --host 0.0.0.0 --port 8000
```

### 9.2. Tạo Scheduled Task

1. Mở `Task Scheduler`
2. Chọn `Create Task`
3. Tab `General`
   - Đặt tên: `QuanLyThucPhamChay`
   - Chọn `Run whether user is logged on or not`
4. Tab `Triggers`
   - `New...`
   - `Begin the task`: `At startup`
5. Tab `Actions`
   - `New...`
   - `Program/script`: đường dẫn tới `start-server.bat`
6. Lưu task

Sau đó mỗi lần mở máy, ứng dụng sẽ tự chạy.

## 10. Sao lưu dữ liệu

File dữ liệu chính:

```text
data\inventory.db
```

Nên sao lưu định kỳ file này sang nơi khác:

- ổ D/E khác
- USB
- thư mục cloud như OneDrive / Google Drive

Chỉ cần copy file `inventory.db` là đủ.

## 11. Cập nhật ứng dụng

Khi cập nhật mã nguồn:

1. Dừng app đang chạy
2. Chép file mới đè lên
3. Chạy lại:

```powershell
python app.py --host 0.0.0.0 --port 8000
```

SQLite sẽ tự giữ lại dữ liệu cũ trong `data\inventory.db`.

## 12. Kiểm tra nhanh sau deploy

Sau khi deploy, cần thử 5 việc sau:

1. Mở được từ máy chủ
2. Mở được từ điện thoại trong cùng mạng
3. Tạo thử 1 khách hàng
4. Tạo thử 1 giỏ hàng / đơn hàng
5. Tắt mở lại app và xác nhận dữ liệu vẫn còn

## 13. Lỗi thường gặp

### Không mở được từ điện thoại

Kiểm tra:

- Máy chủ và điện thoại có cùng Wi-Fi không
- Đã mở firewall port chưa
- Có dùng đúng IP của máy chủ không
- App có đang chạy với `--host 0.0.0.0` không

### Gõ `python` không chạy

Python chưa được thêm vào `PATH`. Cài lại Python và chọn `Add python.exe to PATH`.

### Đổi máy chủ thì mất dữ liệu

Vì dữ liệu nằm ở file:

```text
data\inventory.db
```

Khi chuyển máy, phải copy cả thư mục dự án hoặc ít nhất là file DB sang máy mới.

## 14. Khuyến nghị vận hành

- Chỉ nên có 1 máy chủ chính chạy app
- Người dùng khác chỉ mở bằng trình duyệt, không nên chạy thêm app server khác
- Nên backup `inventory.db` mỗi ngày hoặc mỗi tuần tùy tần suất sử dụng
