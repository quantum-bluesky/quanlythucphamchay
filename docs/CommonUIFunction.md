# Common UI Function Reference

File: `tests/integration/support/ui.js`

Các function dưới đây là helper dùng chung cho các Playwright test trong dự án. Chúng giúp:

- quản lý trạng thái runtime và lỗi JavaScript
- tự động đăng nhập user/admin
- điều hướng menu front-end
- kiểm tra tiêu đề màn
- tải lại trang an toàn
- thu thập thông báo toast

## attachRuntimeTracking(page)

- Mục đích: bật theo dõi lỗi runtime trên trang.
- Hành vi:
  - lắng nghe sự kiện `pageerror` để lưu lỗi JS xuất hiện trong trang.
  - lắng nghe `console` và ghi lại các thông báo kiểu `error`, trừ lỗi favicon.
  - tự động chấp nhận dialog nếu trang mở hộp thoại.
- Trả về một object `state` chứa `errors` và `toasts`.

## expectScreenTitle(page, title)

- Mục đích: kiểm tra tiêu đề màn hiện tại.
- Hành vi: tìm selector `#activeScreenBarTitle` và so sánh nội dung với `title`.
- Dùng để đảm bảo app đã chuyển đến đúng màn UI.

## waitForAppReady(page)

- Mục đích: đảm bảo app không còn đang ở trạng thái tải.
- Hành vi: chờ `#appVersionButton` không chứa chữ `Đang tải` trong tối đa 10 giây.
- Sau đó chờ thêm 200ms để UI ổn định.

## switchMenu(page, menu)

- Mục đích: chuyển giữa các menu chính của ứng dụng.
- Hành vi:
  - gọi `waitForAppReady(page)` trước.
  - kiểm tra nếu menu panel đang ẩn bằng class `is-edge-hidden`, thì click vào khu vực gần góc trên cùng bên phải để mở.
  - nếu nút toggle menu hiển thị và chưa mở, click để mở nó.
  - click vào mục menu có attribute `data-menu="${menu}"`.
  - chờ thêm 500ms để trang ổn định.

## collectToast(page, runtime, label, options)

- Mục đích: thu thập thông báo toast hiển thị sau thao tác.
- Tham số:
  - `runtime`: object tracking runtime errors/toasts.
  - `label`: nhãn phân loại action để dễ debug.
  - `options.errorPattern`: regex kiểm tra thông báo nghi vấn lỗi.
- Hành vi:
  - chờ 900ms rồi tìm toast với selector `#toast:not([hidden])`.
  - nếu toast có nội dung, ghi nội dung vào `runtime.toasts`.
  - nếu nội dung match `errorPattern`, thêm `runtime.errors`.
- Trả về text toast hoặc chuỗi rỗng.

## reloadHealthy(page, runtime, label, expectedTitle)

- Mục đích: tải lại trang và xác nhận trạng thái vẫn khỏe.
- Hành vi:
  - reload trang với `waitUntil: "networkidle"`.
  - nếu `expectedTitle` được cung cấp, gọi `expectScreenTitle(page, expectedTitle)`.
  - gọi `collectToast(page, runtime, label)` để bắt toast sau reload.

## gotoWithRetry(page, url, options)

- Mục đích: mở URL với cơ chế thử lại khi gặp lỗi mạng tạm thời.
- Tham số:
  - `url`: đường dẫn cần mở, mặc định `/`.
  - `options.waitUntil`: trạng thái tải, mặc định `load`.
  - `retries`: số lần thử lại, mặc định 3.
  - `retryDelayMs`: thời gian chờ giữa lần thử, mặc định 1000ms.
- Hành vi:
  - nếu lỗi mạng tạm thời xảy ra (ví dụ `ERR_CONNECTION_REFUSED`, `ERR_CONNECTION_RESET`), chờ rồi thử lại.
  - nếu đã đạt số lần thử hoặc lỗi không retry được, ném lỗi ra.

## parseSetCookieHeader(setCookieHeader)

- Mục đích: phân tích header `Set-Cookie` từ response login.
- Hành vi: tách cặp `name=value` đầu tiên và trả về object `{ name, value }`.
- Dùng để thêm cookie session vào context test.

## resolveCookieUrl(page)

- Mục đích: tạo URL hợp lệ để thêm cookie vào context.
- Hành vi: lấy URL hiện tại của trang và chuyển thành root URL của trang đó.
- Nếu chưa điều hướng đến trang nào (`about:blank`), ném lỗi.

## autoLogin(page, request, options)

- Mục đích: đăng nhập user bằng API và thêm cookie session vào context page.
- Tham số:
  - `username`, `password`, `route`.
- Hành vi:
  - gửi POST tới route login với thông tin xác thực.
  - kiểm tra response thành công.
  - phân tích header `set-cookie`, xác thực cookie hợp lệ.
  - thêm cookie vào context page với `httpOnly: true`.

## autoLoginRequest(request, options)

- Mục đích: đăng nhập bằng HTTP request và trả về chuỗi cookie.
- Hành vi tương tự `autoLogin` nhưng không thêm cookie vào Page, chỉ trả về giá trị cookie.

## tryAutoLogin(page, request, candidates)

- Mục đích: thử login theo nhiều bộ credentials khác nhau.
- Hành vi: lần lượt gọi `autoLogin(page, request, candidate)` cho mỗi candidate.
- Nếu tất cả fail, ném lỗi cuối cùng.

## autoLoginAdmin(page, request)

- Mục đích: đăng nhập tài khoản admin mặc định.
- Hành vi: gọi `autoLogin` với route `/api/admin/login` và credentials admin hardcoded.

## autoLoginAdminRequest(request)

- Mục đích: lấy cookie admin từ HTTP request context.
- Trả về chuỗi cookie tương tự `autoLoginRequest`.

## autoLoginUser(page, request)

- Mục đích: đăng nhập user thường với một trong các credentials sẵn có.
- Hành vi: dùng `tryAutoLogin` với các candidate `user` và `staff`.

## autoLoginUserRequest(request)

- Mục đích: lấy cookie đăng nhập user thường trong context request.
- Hành vi: thử mỗi candidate và trả về cookie nếu thành công.

## expectNoRuntimeErrors(runtime)

- Mục đích: kiểm tra cuối test rằng không có lỗi runtime đã được thu thập.
- Hành vi: dùng `expect(runtime.errors).toEqual([])`.
- Nếu có lỗi, test fail và thông báo chứa các lỗi đã thu thập.
