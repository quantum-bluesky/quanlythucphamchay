# Phase D - Danh sách issue đề xuất (theo WORKFLOW_REVIEW)

> Ghi chú: môi trường local hiện chưa cấu hình `git remote`/`gh`, nên danh sách này được chuẩn bị sẵn để copy tạo GitHub Issue.

## D-1: Audit actor cho thay đổi workflow chứng từ

- Mục tiêu:
  - log người thao tác (`actor`) khi lưu state đồng bộ
  - log chuyển trạng thái đơn hàng và phiếu nhập
- Phạm vi:
  - backend `save_sync_state`
  - bảng `audit_logs`

## D-2: Audit thay đổi giá chung sản phẩm

- Mục tiêu:
  - log đầy đủ actor khi đổi `giá nhập` và `giá bán` mặc định
- Phạm vi:
  - API cập nhật giá sản phẩm
  - hiển thị actor ở lịch sử sản phẩm

## D-3: Lọc lịch sử theo người thao tác / khoảng thời gian

- Mục tiêu:
  - bổ sung filter `actor`, `start_date`, `end_date` cho API lịch sử
  - hỗ trợ đối soát audit theo ca/người
- Phạm vi:
  - backend query lịch sử
  - frontend filter form trong màn `Sản phẩm`

## D-4: Cập nhật test + tài liệu Phase D

- Mục tiêu:
  - thêm unit test cho audit/status/filter
  - cập nhật README + hướng dẫn người dùng + help trong app
