# Hướng dẫn test

## Mục tiêu

Project có 2 lớp test:

- `unit test` cho logic backend nhỏ
- `integration test` cho toàn bộ giao diện và API theo luồng nghiệp vụ thật

Ngoài ra có thêm `acceptance checklist` để kiểm soát case bàn giao:

- checklist: `docs/ACCEPTANCE_CHECKLIST.md`
- automation bundle: `npm run test:acceptance`

## 1. Unit test

Chạy:

```powershell
python -m unittest discover -s tests
```

Phù hợp khi sửa:

- logic `InventoryStore`
- validate dữ liệu
- tính tồn kho / báo cáo

## 2. Integration test

Integration test dùng `Playwright`.

### Cài dependency test

```powershell
npm install
npx playwright install chromium
```

### Chạy toàn bộ suite

```powershell
npm run test:integration
```

### Chạy acceptance automation theo checklist

```powershell
npm run test:acceptance
```

### Chạy acceptance có giao diện browser

```powershell
npm run test:acceptance:headed
```

### Chạy có giao diện browser

```powershell
npm run test:integration:headed
```

## Integration suite đang kiểm tra gì

Suite hiện tại chạy trên `fixture DB` tạm, không đụng vào `data\inventory.db` thật.

Các nhóm kiểm tra chính:

- `Tồn kho -> Nhập hàng -> Xuất hàng -> Sản phẩm`
- `Đơn hàng -> Khách hàng -> Nhà cung cấp -> Báo cáo -> Lịch sử & khôi phục`
- `Master Admin`: login, export, import, backup, restore

Ngoài click thao tác, suite còn kiểm tra:

- refresh lại ngay trên từng màn
- lỗi runtime kiểu `... is not defined`
- toast lỗi đồng bộ hoặc lỗi JS

## File chính của suite

- Config Playwright: `playwright.config.js`
- Server test riêng: `tests/integration/run_test_server.py`
- Helper UI/runtime: `tests/integration/support/ui.js`
- Spec chính:
  - `tests/integration/core-workflows.spec.js`
  - `tests/integration/management-screens.spec.js`
  - `tests/integration/admin.spec.js`
  - `tests/integration/acceptance-checklist.spec.js`
  - `tests/integration/cross-client-sync.spec.js`
  - `tests/integration/workflow-phase-a.spec.js`
  - `tests/integration/workflow-phase-c.spec.js`

## Lưu ý

- App runtime thật vẫn chỉ cần `Python stdlib + SQLite`
- `Node.js` và `Playwright` chỉ cần cho bộ test integration
- Nếu sửa workflow, label, selector hoặc menu, hãy cập nhật test tương ứng
- Nếu thêm hoặc đổi workflow nghiệp vụ, hãy cập nhật luôn checklist acceptance để người test và agent dùng chung một chuẩn
