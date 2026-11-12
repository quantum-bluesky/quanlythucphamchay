# Hướng Dẫn Khắc Phục Lỗi & Cấu Hình Zalo OAuth v4
**Dự án:** Quản lý thực phẩm chay  
**Tài liệu tham khảo:** Troubleshooting Guide & Configuration Reference (Zalo Social API v4)

---

## 1. Tổng quan kiến trúc Zalo OAuth v4 (PKCE Flow)

Theo chuẩn Zalo Social API v4, cơ chế xác thực sử dụng luồng OAuth 2.0 kết hợp với **PKCE (Proof Key for Code Exchange)** để tăng tính bảo mật:

1. **Khởi tạo Code Verifier & Code Challenge**:
   - `code_verifier`: Chuỗi ngẫu nhiên (43 - 128 ký tự bao gồm `a-z`, `A-Z`, `0-9`, dấu chấm, gạch ngang, gạch dưới).
   - `code_challenge`: Chuỗi SHA-256 hash của `code_verifier` sau đó Base64 URL-encode (loại bỏ padding `=`).
2. **Xin cấp Authorization Code (`/v4/permission`)**:
   - Web App chuyển hướng người dùng tới:
     ```text
     [https://oauth.zaloapp.com/v4/permission?app_id=](https://oauth.zaloapp.com/v4/permission?app_id=){APP_ID}&redirect_uri={ENCODED_REDIRECT_URI}&code_challenge={CODE_CHALLENGE}&state={STATE}
     ```
   - **Lưu ý quan trọng**: Ở API v4, **không** truyền tham số `scope=user.name,user.avatar` vào URL permission. Các quyền cơ bản được gán mặc định theo cấu hình ứng dụng.
3. **Đổi Authorization Code lấy Access Token (`/v4/access_token`)**:
   - Server gửi request POST tới:
     ```text
     POST [https://oauth.zaloapp.com/v4/access_token](https://oauth.zaloapp.com/v4/access_token)
     Headers:
       secret_key: {SECRET_KEY}
       Content-Type: application/x-www-form-urlencoded
     Body:
       app_id={APP_ID}&code={AUTH_CODE}&code_verifier={CODE_VERIFIER}&grant_type=authorization_code
     ```

---

## 2. Chi tiết các mã lỗi thường gặp & Cách xử lý

### 2.1. Lỗi `-14029: The application is not approved`
> **Mô tả**: *"Your application might be not approve or disable by admin"*

#### Nguyên nhân 1: Tài khoản người dùng chưa được phân quyền khi App đang ở trạng thái Dev
- **Hiện tượng**: Tài khoản tạo Zalo Developer đăng nhập được, nhưng tài khoản Zalo khác đăng nhập thì bị báo lỗi `-14029`.
- **Giải pháp**:
  - **Cách A (Thử nghiệm nội bộ)**: Vào [Zalo Developers](https://developers.zalo.me/) > Chọn App > **Vai trò / Quản lý thành viên** > Thêm số điện thoại của người cần test vào danh sách **Tester / Developer**.
  - **Cách B (Phát hành công khai)**: Bổ sung đầy đủ Icon, Chính sách bảo mật (Privacy Policy), Điều khoản sử dụng > Chuyển trạng thái App sang **Hoạt động (Live)** hoặc gửi yêu cầu xét duyệt.

#### Nguyên nhân 2: App đang trong trạng thái gửi duyệt (Pending Review)
- **Hiện tượng**: Cả tài khoản Developer lẫn Tester đều bị lỗi `-14029`.
- **Giải pháp**: Khi gửi duyệt, Zalo có thể tạm thời đóng băng quyền truy cập để đội ngũ kiểm duyệt thao tác. Cần đợi hoàn tất xét duyệt hoặc hủy gửi duyệt để tiếp tục test.

#### Nguyên nhân 3: Xin quyền vượt mức cấp phép (Scope không hợp lệ)
- **Hiện tượng**: Mã nguồn thêm tham số `scope` (ví dụ xin số điện thoại `scope=phone`) khi ứng dụng chưa kết nối và xác thực với Zalo Official Account (Zalo OA).
- **Giải pháp**: Tạm thời loại bỏ các tham số `scope` nâng cao, chỉ sử dụng quyền cơ bản mặc định.

---

### 2.2. Lỗi `-14003: Invalid redirect uri`
> **Mô tả**: *"Invalid redirect uri"*

#### Nguyên nhân & Giải pháp:
1. **Sai lệch URL Callback (Strict String Matching)**:
   - Zalo kiểm tra chuỗi `redirect_uri` chính xác 100%.
   - **Cần đối chiếu kỹ**:
     - Giao thức: `http://` hay `https://`
     - Tên miền & Cổng: `localhost:4000` vs `127.0.0.1:4000` vs domain thực tế
     - Dấu gạch chéo cuối chuỗi (`/`): `/api/public/zalo-callback` khác với `/api/public/zalo-callback/`
2. **Mã hóa URL (URL Encoding)**:
   - Khi truyền `redirect_uri` vào query param của URL Zalo OAuth, cần dùng `urllib.parse.quote(redirect_uri, safe='')` để mã hóa cả dấu `:` và `/`.
3. **Không chèn tham số sai chuẩn**:
   - Không tự ý thêm `scope=user.name,user.avatar` vào URL v4 vì có thể làm parser query của Zalo hiểu sai redirect URI.

---

## 3. Cấu hình mẫu hệ thống (`data/system_config.json`)

```json
{
  "zalo_login": {
    "app_id": "YOUR_ACTUAL_APP_ID",
    "secret_key": "YOUR_ACTUAL_SECRET_KEY",
    "redirect_uri": "http://localhost:4000/api/public/zalo-callback",
    "mock_test_mode": false
  }
}
```
---

## 4. Mã nguồn chuẩn tạo URL xác thực (Python Example)

```python
import urllib.parse
import hashlib
import base64
import os

def generate_pkce_codes():
    # 1. Tạo code_verifier ngẫu nhiên
    code_verifier = base64.urlsafe_b64encode(os.urandom(32)).decode('utf-8').rstrip('=')
    
    # 2. Tạo code_challenge = Base64URL(SHA256(code_verifier))
    sha256_digest = hashlib.sha256(code_verifier.encode('utf-8')).digest()
    code_challenge = base64.urlsafe_b64encode(sha256_digest).decode('utf-8').rstrip('=')
    
    return code_verifier, code_challenge

def build_zalo_auth_url(app_id: str, redirect_uri: str, state: str = "zalo_login"):
    code_verifier, code_challenge = generate_pkce_codes()
    
    # Mã hóa redirect_uri hoàn chỉnh
    encoded_redirect = urllib.parse.quote(redirect_uri, safe="")
    
    auth_url = (
        f"[https://oauth.zaloapp.com/v4/permission](https://oauth.zaloapp.com/v4/permission)"
        f"?app_id={app_id}"
        f"&redirect_uri={encoded_redirect}"
        f"&code_challenge={code_challenge}"
        f"&state={state}"
    )
    
    return auth_url, code_verifier

```

---

## 5. Bảng kiểm tra nhanh (Checklist khi gặp lỗi)

| Kiểm tra | Yêu cầu chuẩn |
| --- | --- |
| **Callback URL** | Khớp 100% giữa Zalo Developers Portal và Web App (cả port & protocol). |
| **Vai trò Tester** | Nếu App ở chế độ Development, tài khoản Zalo người dùng phải nằm trong danh sách Quản lý thành viên. |
| **Quyền Scope** | Không truyền `scope=user.name...` trên URL `/v4/permission`. |
| **PKCE** | Truyền đúng `code_challenge` khi xin permission và `code_verifier` khi đổi token. |
| **Secret Key** | Khớp với Secret Key hiện tại trên cổng Zalo Developers. |
| """ |  |



---