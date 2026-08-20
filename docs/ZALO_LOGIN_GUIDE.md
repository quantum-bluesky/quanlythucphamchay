# Hướng dẫn Cấu hình Zalo Login (OAuth2)

Hệ thống đã được tích hợp tính năng đăng nhập bằng tài khoản Zalo. Do Zalo có chính sách bảo mật chặt chẽ, bạn cần tạo và cấu hình một Zalo App để ứng dụng web của chúng ta có thể kết nối.

## Bước 1: Đăng ký ứng dụng Zalo (Zalo App)

1. Truy cập [Zalo for Developers](https://developers.zalo.me/).
2. Đăng nhập bằng tài khoản Zalo của bạn.
3. Nhấp vào nút **Thêm ứng dụng mới** (Góc trên bên phải).
4. Nhập tên ứng dụng (VD: `Cửa hàng Thực Phẩm Chay`) và chọn danh mục phù hợp.

## Bước 2: Kích hoạt Zalo Login và Cấu hình Callback URL

1. Trong giao diện quản lý ứng dụng Zalo, chọn mục **Sản phẩm** -> **Zalo Login**.
2. Nhấn **Đăng ký** để bật tính năng Zalo Login.
3. Trong phần cấu hình Zalo Login, mục **Official Callback URL** (hoặc Web Callback URL), nhập địa chỉ API callback của hệ thống:
   - Ví dụ khi chạy ở localhost: `http://localhost:4000/api/public/zalo-callback`
   - Ví dụ khi đã deploy lên host thực: `https://thucphamchay.yourdomain.com/api/public/zalo-callback`
4. Lưu cấu hình.

## Bước 3: Cấu hình App ID và Secret Key vào Hệ thống

1. Mở trang quản lý ứng dụng trên Zalo Developers, vào mục **Cài đặt chung** (Settings).
2. Bạn sẽ thấy **App ID** (ID Ứng dụng) và **Secret Key** (Khóa bí mật).
3. Mở file `data/system_config.json` của project này. Tìm mục `"zalo_login"`, sửa lại thông tin:

```json
"zalo_login": {
  "app_id": "NHẬP_APP_ID_VÀO_ĐÂY",
  "secret_key": "NHẬP_SECRET_KEY_VÀO_ĐÂY",
  "mock_test_mode": false
}
```

*Lưu ý:* Khi đã có thông tin thực tế, hãy đổi `mock_test_mode` thành `false` để kết nối thật tới Zalo.

## Bước 4: Lưu ý về Quyền Số điện thoại

- Theo mặc định, tính năng Zalo Login chỉ trả về: Zalo ID, Tên, Avatar.
- **Để lấy được Số Điện Thoại**, Zalo yêu cầu ứng dụng của bạn phải là ứng dụng kết nối với Zalo Official Account (Zalo OA) đã được xác thực, và người dùng phải đồng ý cấp quyền.
- Nếu không có quyền đọc SĐT, hệ thống sẽ tạm thời tạo một chuỗi định danh dạng `Zalo:123456...` vào trường số điện thoại để hệ thống không bị lỗi.

## Testing (Chế độ Mock)

Hệ thống cung cấp sẵn chế độ Test (Mock mode) mà không cần bạn phải thiết lập Zalo App.
Chỉ cần để config:

```json
"zalo_login": {
  "app_id": "123",
  "secret_key": "123",
  "mock_test_mode": true
}
```

Khi bấm nút Đăng nhập Zalo, hệ thống sẽ tự động gán tài khoản thử nghiệm "Khách Zalo Test" với SĐT "0999999999".
