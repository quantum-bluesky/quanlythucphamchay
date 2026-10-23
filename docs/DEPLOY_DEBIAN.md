# Cài đặt và chạy trên Debian

Tài liệu này hướng dẫn chạy ứng dụng bằng Flask/Waitress trên Debian, gồm chạy thử trực tiếp và chạy nền bằng `systemd`. Backend mặc định là Flask/Waitress; HTTP server legacy chỉ dùng khi cần rollback.

## 1. Điều kiện và đường dẫn

- Cài hoặc checkout source vào `/home/quan/quanlythucphamchay` (đổi đường dẫn trong các lệnh nếu thư mục thực tế khác).
- Python 3.13 và hỗ trợ tạo virtualenv. Nếu Python 3.13 được cài từ apt, cài gói `python3.13-venv`:

```bash
sudo apt update
sudo apt install -y python3.13-venv
python3.13 --version
```

Nếu Debian của máy không cung cấp lệnh `python3.13`, hãy dùng phiên bản Python đã được cài và hỗ trợ bởi môi trường triển khai; thay `python3.13` trong các bước dưới bằng đúng executable đó. Không tiếp tục nếu chưa xác nhận được phiên bản Python.

## 2. Cài dependency

```bash
cd /home/quan/quanlythucphamchay
python3.13 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Khi cập nhật source về sau, không tạo lại virtualenv nếu không cần; kích hoạt `.venv` và chạy lại `python -m pip install -r requirements.txt` để đồng bộ dependency.

## 3. Chọn cấu hình Production và chạy thử

`APP_ENV` phải có giá trị `production` **trong cùng môi trường của tiến trình app**. Giá trị này khiến ứng dụng đọc `data/system_config.production.json`; nếu không đặt, ứng dụng mặc định đọc `data/system_config.json` và log `Environment: test`.

Kiểm tra file production đã có trước khi chạy:

```bash
test -f data/system_config.production.json && echo "Production config exists" || echo "Missing data/system_config.production.json"
```

Chạy foreground để kiểm tra:

```bash
cd /home/quan/quanlythucphamchay
APP_ENV=production .venv/bin/python app.py
```

Hoặc export biến trong shell trước khi chạy:

```bash
export APP_ENV=production
.venv/bin/python app.py
```

Khi khởi động, log phải hiển thị `Environment: production`. Nhấn `Ctrl+C` để dừng lần chạy thử foreground. App dùng host/port trong file cấu hình đã chọn; có thể truyền `--host` và `--port` nếu muốn override khi chạy thủ công.

Không dùng `APP_ENV=production && python app.py` làm cách hướng dẫn chuẩn. Hãy đặt biến ngay trước lệnh chạy như ví dụ trên hoặc dùng `export`; cách này bảo đảm biến được truyền vào đúng tiến trình Python trong các shell và script khác nhau.

### Nếu vẫn thấy `Environment: test`

Trong code hiện tại, `APP_ENV` được chuẩn hóa bằng chữ thường. Vì vậy `Environment="APP_ENV=Production"` trong unit bạn gửi **được chấp nhận**; khác biệt chữ hoa không phải nguyên nhân. Unit cần được systemd nạp lại và service phải được restart để tiến trình mới nhận cấu hình.

1. Kiểm tra lệnh chạy có đang dùng đúng Python trong `.venv` và có `APP_ENV` không:

   ```bash
   APP_ENV=production .venv/bin/python -c 'import os; print(os.environ.get("APP_ENV"))'
   ```

   Kết quả phải là `production`.
2. Nếu chạy bằng systemd, xem nội dung unit đang được systemd nạp, sau đó nạp lại và restart service sau khi sửa:

   ```bash
   sudo systemctl cat qltp.service
   sudo systemctl show qltp.service -p Environment -p ExecStart -p WorkingDirectory
   sudo systemctl daemon-reload
   sudo systemctl restart qltp.service
   sudo journalctl -u qltp.service -n 80 --no-pager
   ```

3. Xác nhận log startup mới nhất là của lần restart vừa rồi và có `Environment: production`. `APP_ENV` được đọc lúc Python khởi động; sửa unit hoặc export biến trong một terminal không thay đổi môi trường của service đang chạy.
4. Nếu log đã là `production` nhưng nội dung cấu hình vẫn giống Test, kiểm tra `data/system_config.production.json` trong đúng thư mục source mà `WorkingDirectory`/`ExecStart` đang trỏ tới. `APP_ENV` chọn file cấu hình; nó không tự sao chép cấu hình Test sang Production.

## 4. Chạy bằng systemd

Tạo hoặc cập nhật `/etc/systemd/system/qltp.service`. Ví dụ dưới đây giữ user và thư mục hiện tại của service; `ExecStart` dùng Python trong virtualenv thay cho `/usr/bin/python3`, và đặt `APP_ENV` rõ ràng ở dạng chữ thường:

```ini
[Unit]
Description=Python app Quan ly thuc pham chay autostart service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/home/quan/quanlythucphamchay
Environment="APP_ENV=production"
ExecStart=/home/quan/quanlythucphamchay/.venv/bin/python /home/quan/quanlythucphamchay/app.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Đặt quyền đọc/ghi file và thư mục dữ liệu phù hợp với `User` trong unit. Ví dụ này dùng `root` để tương thích với cấu hình đang chạy; với cài đặt mới, nên cân nhắc một user hệ thống riêng và cấp quyền tối thiểu cần thiết cho thư mục ứng dụng, `data/`, backup và log.

Nạp unit, bật tự khởi động và chạy service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now qltp.service
sudo systemctl status qltp.service --no-pager
```

Sau khi deploy code hoặc sửa unit/config, restart và xem log:

```bash
sudo systemctl restart qltp.service
sudo journalctl -u qltp.service -n 100 --no-pager
sudo journalctl -u qltp.service -f
```

Thoát chế độ theo dõi log bằng `Ctrl+C`; thao tác này không dừng service. Dừng hoặc tắt tự khởi động bằng:

```bash
sudo systemctl stop qltp.service
sudo systemctl disable qltp.service
```

## 5. Cập nhật ứng dụng và bảo toàn dữ liệu

- Sao lưu DB và file cấu hình trước khi cập nhật source.
- Giữ nguyên `data/inventory.db`, `data/system_config.production.json`, `data/js_asset_versions.json`, thư mục backup và các file dữ liệu runtime hiện có khi thay source.
- Không chạy `python app.py init --reset` trên dữ liệu đang dùng; lệnh này có thể xóa/nạp lại dữ liệu.
- Sau khi cập nhật source, cài lại dependency nếu `requirements.txt` thay đổi, rồi restart `qltp.service`.
- Kiểm tra `systemctl status` và log startup để xác nhận service hoạt động, môi trường là `production`, và đang đọc đúng cấu hình.

## 6. Rollback tạm thời sang HTTP server legacy

Nếu cần rollback trong lúc xử lý sự cố, thêm biến môi trường này vào unit:

```ini
Environment="APP_HTTP_BACKEND=legacy"
```

Sau đó nạp lại unit và restart:

```bash
sudo systemctl daemon-reload
sudo systemctl restart qltp.service
```

Khi đã xử lý xong, bỏ `APP_HTTP_BACKEND=legacy` để quay lại Flask/Waitress mặc định, rồi reload và restart service.
