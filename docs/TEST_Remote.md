# Hướng dẫn chạy test trỏ vào Remote Server / Môi trường Staging

Tài liệu chi tiết đầy đủ đã được hợp nhất và chuẩn hóa tại: **[docs/TESTING.md (Mục 2.3)](TESTING.md#23-test-trên-môi-trường-staging--remote-server)**.

Tài liệu này tóm tắt nhanh các bước thực hiện khi muốn chạy test trỏ vào một server đang chạy từ xa (máy A chạy app, máy B chạy test; hoặc test lên server Staging/Production qua domain/reverse proxy).

---

## 1. Cơ chế tự động của repo hiện tại

Hiện tại repo đã tích hợp sẵn cơ chế tự động hoá:
- Không cần tạo file config `playwright.remote.config.js` thủ công.
- Runner `scripts/run-remote-tests.js` tự động nhận URL mục tiêu, tắt server tạm, gọi API `/api/session/status` để lấy `admin_path` thực tế, và truyền tham số trực tiếp cho Playwright.

---

## 2. Các lệnh chạy nhanh theo nhu cầu

### Cú pháp:
```powershell
npm run test:staging:<level> -- <URL> [playwright-options]
# hoặc dùng alias:
npm run test:remote:<level> -- <URL> [playwright-options]
```

### Các cấp độ:
- **`smoke`**: Kiểm tra khói nhanh (Public products + Login). An toàn 100% cho dữ liệu.
- **`readonly`**: Kiểm tra toàn bộ UI đọc dữ liệu (cuộn, phân trang, sort tồn kho, feedback). An toàn 100% cho dữ liệu.
- **`full`**: Chạy toàn bộ integration test suite (chỉ khuyến nghị cho staging test DB).

### Ví dụ thực tế:

#### A. Test server qua domain / reverse proxy (subpath)
```powershell
# Chạy kiểm tra nhanh
npm run test:staging:smoke -- https://qts-home.duckdns.org/qltp/

# Chạy kiểm tra chỉ đọc (an toàn dữ liệu)
npm run test:staging:readonly -- https://qts-home.duckdns.org/qltp/

# Chạy có mở trình duyệt quan sát trực tiếp
npm run test:staging:readonly -- https://qts-home.duckdns.org/qltp/ --headed
```

#### B. Test giữa 2 máy trong mạng LAN (Máy A chạy app, Máy B chạy test)
1. Trên **Máy A** (chạy server):
   ```powershell
   python app.py --host 0.0.0.0 --port 4000
   ```
2. Trên **Máy B** (chạy test):
   ```powershell
   npm run test:remote:smoke -- http://192.168.1.10:4000/
   npm run test:remote:readonly -- http://192.168.1.10:4000/
   ```

---

## 3. Lưu ý quan trọng

1. **Dấu gạch chéo `/` ở cuối URL**:
   Luôn đảm bảo URL kết thúc bằng dấu `/` khi triển khai dưới subpath (ví dụ: `https://.../qltp/`).
2. **Xem chi tiết**:
   Vui lòng tham khảo [docs/TESTING.md](TESTING.md) để xem hướng dẫn đầy đủ về tất cả các lớp test (Unit, Local Integration, Acceptance, Staging/Remote).
