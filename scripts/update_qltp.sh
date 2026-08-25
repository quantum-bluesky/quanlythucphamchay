#!/bin/bash

branch=$1
app=$2

case "$app" in
  qltp_test)
    APP_DIR="/home/quannd/QuanLyThucPham_Test"
    SERVICE="qltp_test"
    ;;

  qltp)
    APP_DIR="/home/quannd/QuanLyThucPham"
    SERVICE="qltp"
    ;;

  qltpchay)
    APP_DIR="/home/quannd/QuanLyDoChay"
    SERVICE="qltpchay"
    ;;

  *)
    echo "Usage: $0 <branch> <qltp_test|qltp|qltpchay>"
    exit 1
    ;;
esac

cd "$APP_DIR" || exit 1

echo "==> Checkout $branch"
git checkout "$branch" || exit 1

OLD_COMMIT=$(git rev-parse HEAD)

echo "==> Pull latest source"
git pull --rebase --autostash || exit 1

NEW_COMMIT=$(git rev-parse HEAD)

if [ "$OLD_COMMIT" != "$NEW_COMMIT" ]; then
    echo "==> Source updated"
    echo "==> Restarting $SERVICE ..."
    sudo systemctl restart "$SERVICE"

    if systemctl is-active --quiet "$SERVICE"; then
        echo "==> Service restarted successfully"
    else
        echo "==> Service restart failed"
        exit 1
    fi
else
    echo "==> Already up-to-date"
    echo "==> Skip restart"
fi
