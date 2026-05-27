#!/usr/bin/env bash
set -Eeuo pipefail

#Cài đặt
# 1. Tạo virtual environment
# sudo apt install python3-full python3-venv -y
# python3 -m venv ~/mkdocs-env
# source ~/mkdocs-env/bin/activate

# 2. Cài MkDocs 2.0 trong môi trường ảo
# pip install git+https://github.com/encode/mkdocs.git


#build doc mỗi khi update tài liệu
source ~/mkdocs-env/bin/activate
mkdocs build

#đồng bộ html file sang thư mục web public của tài liệu
rsync -aL /home/quannd/QuanLyThucPham_Test/site/ /armbian/swag/config/www/hdsd_qltp/