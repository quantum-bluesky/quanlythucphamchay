# Test Build Guide

## 1. Tổng quan về hệ thống test cho project

Dự án này đang dùng hai loại test chính:

- `Python unittest` cho unit test backend: chạy bằng `python -m unittest discover -s tests`
- `Playwright` cho integration / acceptance test frontend: chạy bằng `npm run test:integration` hoặc `npm run test:acceptance`

Trong `package.json`, các lệnh quan trọng:
- `npm run test:integration` → chạy toàn bộ Playwright test
- `npm run test:acceptance` → chạy bộ test acceptance cụ thể
- `npm run test:integration:headed` → chạy cùng nhưng mở trình duyệt hiển thị

---

## 2. Các bước xây dựng áp dụng hệ thống test cho project

### Bước 1: Hiểu cấu trúc và mục tiêu test
- Xem `app.py`, `static/app.js` và các màn UI liên quan.
- Xác định mục tiêu: kiểm tra màn `Khách hàng`, `Đơn hàng`, `Nhà cung cấp`, `Báo cáo`, `Lịch sử`…
- Xác định loại test: acceptance test tập trung vào trải nghiệm người dùng, UI và luồng chức năng.

### Bước 2: Chuẩn bị môi trường
- Cài Node.js và npm.
- Cài dependency Playwright: `npm install`
- Nếu cần, chạy `npx playwright install` để cài browser.

### Bước 3: Thiết kế cấu trúc test
- Test frontend đặt trong `tests/integration/`
- Nên có file hỗ trợ chung `tests/integration/support/ui.js`
- Mỗi file test nên mô tả rõ case acceptance, ví dụ: `management-screens.spec.js`

### Bước 4: Viết test case trong file
- Dùng `test()` của Playwright
- Dùng `expect()` để kiểm tra title, input, heading, button, toast...
- Dùng helper chung để giảm lặp: login, chuyển menu, check title, reload, thu thập lỗi runtime.

### Bước 5: Chạy và xác nhận
- Chạy `npm run test:integration`
- Nếu sửa backend, chạy thêm `python -m py_compile app.py`
- Nếu sửa logic, chạy thêm `python -m unittest discover -s tests`

### Bước 6: Ghi lại test case
- Đặt mã case rõ ràng như `ACC-CUS-01`
- Mô tả mục tiêu bằng tiếng Việt, ví dụ: kiểm tra màn khách hàng render ổn định và thao tác cơ bản

---

## 3. Giải thích chi tiết `management-screens.spec.js`

Xem thêm chi tiết các helper dùng chung trong `tests/integration/support/ui.js` tại: [CommonUIFunction.md](./CommonUIFunction.md)

Dưới đây là giải thích từng đoạn code, câu lệnh và ý nghĩa:

```js
const { test, expect } = require("@playwright/test");
```
- Import hai API chính của Playwright.
- `test` dùng để khai báo case.
- `expect` dùng để kiểm tra điều kiện.

```js
const {
  attachRuntimeTracking,
  autoLoginUser,
  collectToast,
  expectNoRuntimeErrors,
  expectScreenTitle,
  reloadHealthy,
  switchMenu,
} = require("./support/ui");
```
- Import helper chung từ `tests/integration/support/ui.js`.
- Những helper này giúp:
  - `attachRuntimeTracking`: ghi lại lỗi runtime trên trang
  - `autoLoginUser`: đăng nhập tự động để test không bị chặn
  - `collectToast`: thu thập thông báo hiển thị
  - `expectNoRuntimeErrors`: kiểm tra không có lỗi JS
  - `expectScreenTitle`: kiểm tra tiêu đề màn
  - `reloadHealthy`: tải lại trang và xác nhận vẫn ổn
  - `switchMenu`: chuyển giữa menu chính

```js
test("ACC-ORD-01 / ACC-CUS-01 / ACC-SUP-01 / ACC-REP-01 / ACC-HIS-01 orders, customers, suppliers, reports and history stay healthy", async ({ page, request }) => {
```
- Khai báo một test case duy nhất chứa nhiều mã case acceptance.
- Dùng `async` để thao tác bất đồng bộ với browser.
- `page`: đối tượng trình duyệt của Playwright.
- `request`: đối tượng HTTP, thường dùng để gọi API login hoặc request bổ trợ.

```js
  const runtime = attachRuntimeTracking(page);
```
- Bật theo dõi runtime trên trang.
- `runtime` là đối tượng lưu thông tin lỗi JS và toast.

```js
  await page.goto("/");
  await page.waitForLoadState("networkidle");
```
- Mở trang gốc `/`.
- Chờ khi không còn request mạng để đảm bảo trang đã tải xong.

```js
  await autoLoginUser(page, request);
  await page.reload({ waitUntil: "networkidle" });
```
- Đăng nhập tự động bằng helper.
- Tải lại trang để vào trạng thái sau login và đảm bảo không còn request đang chạy.

---

### Khối kiểm tra màn `Đơn hàng`

```js
  await switchMenu(page, "orders");
  await expectScreenTitle(page, "Đơn hàng");
```
- Chuyển sang menu `orders` bằng helper.
- Kiểm tra tiêu đề màn phải là `Đơn hàng`.

```js
  const orderDetailToggle = page.locator('[data-queue-action="toggle-detail"]').first();
  if (await orderDetailToggle.count()) {
    await orderDetailToggle.click();
    await page.waitForTimeout(500);
  }
```
- Tìm nút mở rộng chi tiết đơn đầu tiên trên danh sách.
- Nếu có, click vào để đảm bảo thao tác mở rộng detail hoạt động.
- Chờ 500ms để UI ổn định.

```js
  await collectToast(page, runtime, "orders-action");
```
- Thu thập toast/nội dung thông báo phát sinh trong thao tác.
- Giúp xác nhận không có thông báo lỗi không mong muốn.

---

### Khối kiểm tra màn `Khách hàng`

```js
  await switchMenu(page, "customers");
  await expectScreenTitle(page, "Khách hàng");
```
- Chuyển sang menu `customers`.
- Kiểm tra tiêu đề là `Khách hàng`.

```js
  const customerEdit = page.locator('[data-customer-action="edit"]').first();
  if (await customerEdit.count()) {
    await customerEdit.click();
    await page.waitForTimeout(500);
    await expect(page.locator("#customerNameInput")).not.toHaveValue("");
  }
```
- Tìm nút edit đầu tiên của khách hàng.
- Nếu tồn tại, click vào.
- Chờ 500ms để modal/form mở.
- Kiểm tra trường `#customerNameInput` không để trống, nghĩa là form đang hiển thị đúng.

```js
  await collectToast(page, runtime, "customers-action");
  await reloadHealthy(page, runtime, "customers-reload", "Khách hàng");
```
- Thu thập toast liên quan actions khách hàng.
- Tải lại trang và kiểm tra vẫn ở màn `Khách hàng` khỏe mạnh.

---

### Khối kiểm tra màn `Nhà cung cấp`

```js
  await switchMenu(page, "suppliers");
  await expectScreenTitle(page, "Nhà cung cấp");
```
- Chuyển sang menu `suppliers` và kiểm tra tiêu đề.

```js
  const supplierEdit = page.locator('[data-supplier-action="edit"]').first();
  if (await supplierEdit.count()) {
    await supplierEdit.click();
    await page.waitForTimeout(500);
    await expect(page.locator("#supplierNameInput")).not.toHaveValue("");
  }
```
- Tương tự màn khách hàng: mở form chỉnh sửa nhà cung cấp rồi kiểm tra input hiển thị.

```js
  await collectToast(page, runtime, "suppliers-action");
  await reloadHealthy(page, runtime, "suppliers-reload", "Nhà cung cấp");
```
- Thu thập toast và reload để đảm bảo không lỗi.

---

### Khối kiểm tra màn `Báo cáo`

```js
  await switchMenu(page, "reports");
  await expectScreenTitle(page, "Báo cáo");
```
- Chuyển sang menu `reports`, kiểm tra tiêu đề.

```js
  await page.locator("#reportFiltersToggleButton").click();
  await page.waitForTimeout(300);
  await page.locator("#refreshReportsButton").click();
```
- Click mở bộ lọc báo cáo.
- Chờ UI nhỏ và click refresh báo cáo.

```js
  await collectToast(page, runtime, "reports-refresh");
  await reloadHealthy(page, runtime, "reports-reload", "Báo cáo");
```
- Thu thập toast báo cáo.
- Reload để đảm bảo màn reports vẫn ổn.

---

### Khối kiểm tra màn `Lịch sử & khôi phục`

```js
  await switchMenu(page, "history");
  await expectScreenTitle(page, "Lịch sử & khôi phục");
```
- Chuyển menu `history`, kiểm tra tiêu đề chính.

```js
  await expect(page.getByRole("heading", { name: "Khôi phục mặt hàng ngừng bán" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Khôi phục danh bạ khách hàng" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Khôi phục nguồn hàng" })).toBeVisible();
```
- Kiểm tra các heading quan trọng trên màn lịch sử tồn tại.
- Đây là kiểm tra nhanh rằng nội dung chính đã render đúng.

```js
  await collectToast(page, runtime, "history-restore");
  await reloadHealthy(page, runtime, "history-reload", "Lịch sử & khôi phục");
```
- Thu thập toast và reload màn.
- Đảm bảo thao tác restore và render ổn.

---

### Kết thúc test

```js
  expectNoRuntimeErrors(runtime);
});
```
- Kiểm tra kết quả runtime của toàn bộ test.
- Nếu có lỗi JS hoặc crash trong quá trình, test sẽ fail.

---

## 4. Ý nghĩa tổng quát của test mẫu này

- Đây là một acceptance test tổng hợp nhiều màn `management` trong một case.
- Mỗi bước:
  1. vào trang chính
  2. login
  3. chuyển menu
  4. kiểm tra title / nội dung
  5. thực hiện thao tác đơn giản
  6. thu thập toast / kiểm tra reload
  7. xác nhận không có lỗi runtime

- Mục tiêu chính của `ACC-CUS-01` trong file:
  - màn `Khách hàng` hiển thị ổn định
  - thao tác edit cơ bản không bị lỗi
  - dữ liệu đầu vào form được load
  - trang có thể reload mà vẫn giữ được trạng thái healthy

---

## 5. Nếu bạn muốn viết test mới theo mẫu này

1. Tạo file mới trong `tests/integration/` như `customers-screen.spec.js`
2. Dùng `const { test, expect } = require("@playwright/test");`
3. Import helper chung từ `./support/ui`
4. Viết `test("ACC-CUS-XX ...", async ({ page, request }) => { ... })`
5. Giống như mẫu:
   - `await page.goto("/")`
   - `await autoLoginUser(page, request)`
   - `await switchMenu(page, "customers")`
   - `await expectScreenTitle(page, "Khách hàng")`
   - kiểm tra button/input/heading cụ thể
   - `await collectToast(...)`
   - `await reloadHealthy(...)`
   - `expectNoRuntimeErrors(runtime)`

---

## 6. Kết luận

Bạn có thể dùng `management-screens.spec.js` như một mẫu chung:
- Mỗi test case kiểm tra một màn nhất định
- Dùng helper để giảm code và đảm bảo test rõ ràng
- Chia test thành:
  - setup (go to page, login)
  - action (chuyển menu, click, mở form)
  - assert (title, input, heading, toast)
  - cleanup / verify (reload, no runtime errors)

Nếu cần, tôi có thể tiếp tục hướng dẫn cụ thể cách tạo một test case mới cho riêng màn `Khách hàng` trong dự án.
