#!/bin/bash
# scripts/update_qltp.sh
# Kịch bản cập nhật và restart an toàn trên máy chủ Debian (Staging & Production)
# #Issue183: Tự động sao lưu DB, kiểm tra dependencies và cú pháp trước khi restart.

set -e

branch=$1
app=$2
force_flag=$3

if [ -z "$branch" ] || [ -z "$app" ]; then
    echo "Cách sử dụng: $0 <branch> <qltp_test|qltp|qltpchay> [--force]"
    exit 1
fi

case "$app" in
  qltp_test)
    if [ -d "/home/quannd/QuanLyThucPham_Test" ]; then
        APP_DIR="/home/quannd/QuanLyThucPham_Test"
    else
        APP_DIR="/home/quan/QuanLyThucPham_Test"
    fi
    SERVICE="qltp_test"
    ;;

  qltp)
    if [ -d "/home/quannd/QuanLyThucPham" ]; then
        APP_DIR="/home/quannd/QuanLyThucPham"
    elif [ -d "/home/quan/quanlythucphamchay" ]; then
        APP_DIR="/home/quan/quanlythucphamchay"
    else
        APP_DIR="/home/quan/QuanLyThucPham"
    fi
    SERVICE="qltp"
    ;;

  qltpchay)
    if [ -d "/home/quannd/QuanLyDoChay" ]; then
        APP_DIR="/home/quannd/QuanLyDoChay"
    else
        APP_DIR="/home/quan/QuanLyDoChay"
    fi
    SERVICE="qltpchay"
    ;;

  *)
    echo "Ứng dụng không hợp lệ: $app. Chọn: qltp_test | qltp | qltpchay"
    exit 1
    ;;
esac

if [ ! -d "$APP_DIR" ]; then
    # Fallback về thư mục chứa script nếu không tìm thấy đường dẫn cố định
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    if [ -f "$SCRIPT_DIR/app.py" ]; then
        APP_DIR="$SCRIPT_DIR"
    else
        echo "[!] Không tìm thấy thư mục ứng dụng: $APP_DIR"
        exit 1
    fi
fi

cd "$APP_DIR" || exit 1
echo "==> Làm việc tại: $APP_DIR"

# 1. Xác định môi trường Python
if [ -f ".venv/bin/python" ]; then
    PYTHON_CMD=".venv/bin/python"
elif [ -f "venv/bin/python" ]; then
    PYTHON_CMD="venv/bin/python"
else
    PYTHON_CMD="python3"
fi

# 2. Tự động sao lưu SQLite Database trước khi thay đổi
if [ -f "data/inventory.db" ]; then
    mkdir -p data/backups
    BACKUP_FILE="data/backups/inventory_pre_update_$(date +%Y%m%d_%H%M%S).db"
    echo "==> Sao lưu an toàn database hiện tại -> $BACKUP_FILE"
    cp "data/inventory.db" "$BACKUP_FILE"
fi

# 3. Checkout branch & kéo code mới nhất
echo "==> Checkout nhánh: $branch"
git checkout "$branch" || exit 1

OLD_COMMIT=$(git rev-parse HEAD)

echo "==> Kéo mã nguồn mới nhất từ remote (git pull --rebase)"
git pull --rebase --autostash || exit 1

NEW_COMMIT=$(git rev-parse HEAD)

# 4. Kiểm tra xem có cần cập nhật & restart không
if [ "$OLD_COMMIT" != "$NEW_COMMIT" ] || [ "$force_flag" = "--force" ]; then
    echo "==> Phát hiện thay đổi mã nguồn ($OLD_COMMIT -> $NEW_COMMIT)"

    # Cập nhật dependency nếu requirements.txt thay đổi
    if git diff --name-only "$OLD_COMMIT" "$NEW_COMMIT" 2>/dev/null | grep -q "requirements.txt"; then
        echo "==> requirements.txt có thay đổi, đang cập nhật dependencies..."
        $PYTHON_CMD -m pip install -r requirements.txt || {
            echo "[!] Lỗi khi cài đặt dependencies!"
            exit 1
        }
    fi

    # Kiểm tra cú pháp trước khi restart dịch vụ
    echo "==> Kiểm tra cú pháp ứng dụng (py_compile)..."
    $PYTHON_CMD -m py_compile app.py || {
        echo "[!] Lỗi cú pháp mã nguồn trong app.py! Hủy restart để tránh gián đoạn dịch vụ."
        exit 1
    }

    echo "==> Đang restart service: $SERVICE ..."
    sudo systemctl restart "$SERVICE"

    sleep 2
    if systemctl is-active --quiet "$SERVICE"; then
        echo "==> [THÀNH CÔNG] Dịch vụ $SERVICE đã khởi động lại và đang hoạt động (active)."
    else
        echo "==> [LỖI] Dịch vụ $SERVICE khởi động thất bại!"
        sudo journalctl -u "$SERVICE" -n 30 --no-pager
        exit 1
    fi
else
    echo "==> Mã nguồn đã ở bản mới nhất ($NEW_COMMIT)."
    echo "==> Bỏ qua bước restart service (dùng thêm cờ --force nếu muốn restart bắt buộc)."
fi
