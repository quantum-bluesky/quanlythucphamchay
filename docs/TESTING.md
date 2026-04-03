# Hướng dẫn test

## Mục tiêu

Project có 2 lớp test:

- `unit test` cho logic backend nhỏ
- `integration test` cho toàn bộ giao diện và API theo luồng nghiệp vụ thật

Ngoài ra có thêm `acceptance checklist` để kiểm soát case bàn giao:

- checklist: `docs/ACCEPTANCE_CHECKLIST.md`
- automation bundle: `npm run test:acceptance`

## 0. Setup tool trước khi test

Máy mới nên chạy script setup chung của repo:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
```

Script sẽ kiểm tra và cài nếu thiếu:

- `Python 3.11+`
- `PyYAML` cho tooling Python như Git Issue / `quick_validate.py`
- `Node.js LTS + npm`
- `Git`
- `GitHub CLI (gh)` cho workflow GitHub
- `Playwright Chromium`

Có thể chạy lại nhiều lần. Nếu chỉ muốn xem máy còn thiếu gì:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1 -CheckOnly
```

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
- `Tạo đơn xuất hàng`: chốt đơn hoàn chỉnh, thiếu hàng của user thường
- `Đơn hàng -> Khách hàng -> Nhà cung cấp -> Báo cáo -> Lịch sử & khôi phục`
- `Master Admin`: login, export, import, backup, restore
- `Phase B API`: phiếu điều chỉnh tồn, phiếu trả hàng khách, phiếu trả NCC
- `UI mobile floating`: menu nổi, tìm kiếm nhanh và cụm nút điều hướng auto-hide vào mép màn hình rồi mở lại an toàn

Ngoài click thao tác, suite còn kiểm tra:

- refresh lại ngay trên từng màn
- lỗi runtime kiểu `... is not defined`
- toast lỗi đồng bộ hoặc lỗi JS
- đối chiếu lại stock / order / transaction sau khi chạy case nghiệp vụ chính

## File chính của suite

- Config Playwright: `playwright.config.js`
- Server test riêng: `tests/integration/run_test_server.py`
- Helper UI/runtime: `tests/integration/support/ui.js`
- Spec chính:
  - `tests/integration/core-workflows.spec.js`
  - `tests/integration/management-screens.spec.js`
  - `tests/integration/mobile-floating-ui.spec.js`
  - `tests/integration/admin.spec.js`
  - `tests/integration/acceptance-checklist.spec.js`
  - `tests/integration/acceptance-sales-phase-b.spec.js`
  - `tests/integration/cross-client-sync.spec.js`
  - `tests/integration/workflow-phase-a.spec.js`
  - `tests/integration/workflow-phase-c.spec.js`

## Lưu ý

- App runtime thật vẫn chỉ cần `Python stdlib + SQLite`
- `Node.js` và `Playwright` chỉ cần cho bộ test integration
- Nếu sửa workflow, label, selector hoặc menu, hãy cập nhật test tương ứng
- Nếu thêm hoặc đổi workflow nghiệp vụ, hãy cập nhật luôn checklist acceptance để người test và agent dùng chung một chuẩn
