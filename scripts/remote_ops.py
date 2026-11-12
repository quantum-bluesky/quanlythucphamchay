#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/remote_ops.py
Môi trường trung gian kết nối và thực thi headless operations lên Debian server.
#Issue183: Thiết lập cầu nối vận hành trung gian (Intermediate Bridge) giữa Agent/Portal và Debian Server.
"""

from __future__ import annotations

import argparse
import http.cookiejar
import json
import os
import ssl
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

# Đường dẫn config mặc định
ROOT_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT_DIR / "data" / "system_config.json"


def _strip_accents(text: str) -> str:
    """Loại bỏ dấu tiếng Việt để tìm kiếm mờ không dấu."""
    if not text:
        return ""
    normalized = unicodedata.normalize("NFD", text)
    return "".join(c for c in normalized if unicodedata.category(c) != "Mn").lower()


def load_default_credentials() -> tuple[str, str, str]:
    """Lấy cấu hình URL và thông tin đăng nhập mặc định từ env hoặc system_config.json."""
    default_url = os.environ.get("REMOTE_APP_URL", os.environ.get("PROD_APP_URL", "https://qts-home.duckdns.org/qltp/"))
    default_user = os.environ.get("REMOTE_ADMIN_USER", os.environ.get("PROD_ADMIN_USER", ""))
    default_pass = os.environ.get("REMOTE_ADMIN_PASSWORD", os.environ.get("PROD_ADMIN_PASSWORD", ""))

    if (not default_user or not default_pass) and CONFIG_PATH.is_file():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                admin_cfg = cfg.get("admin", {})
                if not default_user:
                    default_user = admin_cfg.get("username", "masteradmin")
                if not default_pass:
                    default_pass = admin_cfg.get("password", "admin12345")
        except Exception:
            pass

    return default_url, default_user or "masteradmin", default_pass or "admin12345"


class RemoteStoreClient:
    """Client giao tiếp headless API với máy chủ Debian Quản lý Thực phẩm Chay."""

    def __init__(
        self,
        base_url: str | None = None,
        username: str | None = None,
        password: str | None = None,
        insecure_ssl: bool = True,
    ):
        def_url, def_user, def_pass = load_default_credentials()
        self.base_url = (base_url or def_url).rstrip("/") + "/"
        self.username = username or def_user
        self.password = password or def_pass
        self.insecure_ssl = insecure_ssl
        self.admin_path = "/qlht"
        self.is_authenticated = False
        self.session_data: dict[str, Any] = {}

        # Cấu hình cookie jar và SSL context
        self.cookie_jar = http.cookiejar.CookieJar()
        self.ssl_context = ssl.create_default_context()
        if self.insecure_ssl:
            self.ssl_context.check_hostname = False
            self.ssl_context.verify_mode = ssl.CERT_NONE

        cookie_handler = urllib.request.HTTPCookieProcessor(self.cookie_jar)
        https_handler = urllib.request.HTTPSHandler(context=self.ssl_context)
        self.opener = urllib.request.build_opener(cookie_handler, https_handler)

    def _build_url(self, endpoint: str) -> str:
        endpoint = endpoint.lstrip("/")
        return urllib.parse.urljoin(self.base_url, endpoint)

    def _request(
        self,
        method: str,
        endpoint: str,
        payload: dict[str, Any] | list[Any] | None = None,
        headers: dict[str, str] | None = None,
        raw_data: bytes | None = None,
    ) -> dict[str, Any]:
        url = self._build_url(endpoint)
        req_headers = {"User-Agent": "RemoteStoreClient/1.0", "Accept": "application/json"}
        if headers:
            req_headers.update(headers)

        data = None
        if raw_data is not None:
            data = raw_data
        elif payload is not None:
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            req_headers["Content-Type"] = "application/json; charset=utf-8"

        request = urllib.request.Request(url, data=data, headers=req_headers, method=method.upper())

        try:
            with self.opener.open(request, timeout=20) as resp:
                body = resp.read().decode("utf-8")
                if not body.strip():
                    return {}
                return json.loads(body)
        except urllib.error.HTTPError as error:
            error_body = error.read().decode("utf-8", errors="replace")
            try:
                err_json = json.loads(error_body)
                msg = err_json.get("error") or err_json.get("message") or error_body
            except Exception:
                msg = error_body
            raise RuntimeError(f"HTTP {error.code} khi gọi {url}: {msg}") from error
        except Exception as error:
            raise RuntimeError(f"Lỗi kết nối tới {url}: {error}") from error

    def get_status(self) -> dict[str, Any]:
        """Lấy trạng thái cấu hình hệ thống từ máy chủ từ xa."""
        res = self._request("GET", "api/session/status")
        if "admin_path" in res:
            self.admin_path = res["admin_path"]
        return res

    def login(self) -> dict[str, Any]:
        """Thực hiện đăng nhập Master Admin để lấy session cookie."""
        self.get_status()
        payload = {"username": self.username, "password": self.password}
        res = self._request("POST", "api/admin/login", payload=payload)
        self.is_authenticated = bool(res.get("authenticated", False))
        self.session_data = res
        return res

    def ensure_authenticated(self) -> None:
        if not self.is_authenticated:
            self.login()

    def get_products(self) -> list[dict[str, Any]]:
        """Lấy danh sách tất cả sản phẩm đang có trên server."""
        self.ensure_authenticated()
        res = self._request("GET", "api/products")
        if isinstance(res, dict) and "products" in res:
            return res["products"]
        if isinstance(res, list):
            return res
        return []

    def get_summary(self) -> dict[str, Any]:
        """Lấy thông tin tóm tắt tồn kho và sản phẩm."""
        self.ensure_authenticated()
        res = self._request("GET", "api/products")
        return res.get("summary", {}) if isinstance(res, dict) else {}

    def get_suppliers(self) -> list[dict[str, Any]]:
        """Lấy danh sách các nhà cung cấp đang hoạt động trên hệ thống."""
        self.ensure_authenticated()
        state = self._request("GET", "api/state")
        raw_suppliers = state.get("suppliers", []) if isinstance(state, dict) else []
        return [
            s for s in raw_suppliers
            if not s.get("deleted_at") and not s.get("deletedAt")
        ]

    def resolve_supplier(self, query: str) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
        """
        Tìm nhà cung cấp theo ID hoặc tên:
        - Nếu khớp chính xác ID hoặc tên: trả về (supplier, [])
        - Nếu tìm thấy nhiều kết quả gần đúng: trả về (None, matches)
        - Nếu không tìm thấy: trả về (None, [])
        """
        suppliers = self.get_suppliers()
        q = query.strip().lower()
        if not q:
            return None, suppliers

        # 1. Khớp chính xác ID
        for s in suppliers:
            if s.get("id") == query.strip():
                return s, []

        # 2. Khớp chính xác Tên (không phân biệt hoa thường)
        for s in suppliers:
            if s.get("name", "").strip().lower() == q:
                return s, []

        # 3. Khớp một phần có dấu (partial / contains có dấu)
        matches = [
            s for s in suppliers
            if q in s.get("name", "").lower() or q in s.get("phone", "").lower() or q in s.get("address", "").lower()
        ]
        if len(matches) == 1:
            return matches[0], []
        if len(matches) > 1:
            return None, matches

        # 4. Tìm kiếm mờ không phân biệt dấu và tìm theo từng từ (Fuzzy matching)
        q_no_acc = _strip_accents(query)
        fuzzy_matches = []
        for s in suppliers:
            s_name_no = _strip_accents(s.get("name", ""))
            s_addr_no = _strip_accents(s.get("address", ""))
            s_phone = s.get("phone", "")
            if q_no_acc in s_name_no or q_no_acc in s_addr_no or q_no_acc in s_phone:
                fuzzy_matches.append(s)
                continue
            # Token search: tất cả các từ trong query có mặt trong tên/địa chỉ
            tokens = [t for t in q_no_acc.split() if len(t) > 1]
            if tokens and all(t in s_name_no or t in s_addr_no for t in tokens):
                fuzzy_matches.append(s)

        if len(fuzzy_matches) == 1:
            return fuzzy_matches[0], []
        return None, fuzzy_matches

    def preview_scrutiny_products(
        self, new_records: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """
        Cơ chế Tiếp nhận & Xét kỹ (Intake & Scrutiny):
        Đối chiếu danh sách sản phẩm mới/cập nhật với dữ liệu trên live server.
        Trả về phân tích: món mới, món cập nhật, thay đổi giá, cảnh báo rủi ro.
        """
        existing_products = self.get_products()
        by_name = {p["name"].strip().lower(): p for p in existing_products}
        by_id = {str(p.get("id")): p for p in existing_products}
        by_global_id = {str(p.get("global_id")): p for p in existing_products if p.get("global_id")}

        created_items = []
        updated_items = []
        warnings = []

        for idx, rec in enumerate(new_records, start=1):
            name = str(rec.get("name") or "").strip()
            if not name:
                warnings.append(f"Mục #{idx}: Thiếu tên sản phẩm.")
                continue

            # Tìm đối tượng tương ứng trên server
            match = None
            if rec.get("global_id") and str(rec["global_id"]) in by_global_id:
                match = by_global_id[str(rec["global_id"])]
            elif rec.get("id") and str(rec["id"]) in by_id:
                match = by_id[str(rec["id"])]
            elif name.lower() in by_name:
                match = by_name[name.lower()]

            price = float(rec.get("price") or 0)
            sale_price = float(rec.get("sale_price") or 0)
            stock = float(rec.get("stock") or 0)
            unit = str(rec.get("unit") or "cái").strip()

            # Kiểm tra logic nghiệp vụ
            if price > 0 and sale_price > 0 and sale_price < price:
                warnings.append(f"[{name}] Giá bán ({sale_price:,.0f}đ) thấp hơn giá nhập ({price:,.0f}đ)!")

            if match:
                old_price = float(match.get("price") or 0)
                old_sale = float(match.get("sale_price") or 0)
                old_stock = float(match.get("stock") or 0)

                # Cảnh báo biến động giá lớn (> 30%)
                if old_price > 0 and price > 0:
                    diff_pct = abs(price - old_price) / old_price * 100
                    if diff_pct >= 30:
                        warnings.append(
                            f"[{name}] Giá nhập thay đổi mạnh: {old_price:,.0f}đ -> {price:,.0f}đ ({diff_pct:.1f}%)"
                        )
                if old_sale > 0 and sale_price > 0:
                    diff_pct = abs(sale_price - old_sale) / old_sale * 100
                    if diff_pct >= 30:
                        warnings.append(
                            f"[{name}] Giá bán thay đổi mạnh: {old_sale:,.0f}đ -> {sale_price:,.0f}đ ({diff_pct:.1f}%)"
                        )

                updated_items.append({
                    "id": match.get("id"),
                    "global_id": match.get("global_id"),
                    "name": name,
                    "unit": unit,
                    "old_price": old_price,
                    "new_price": price or old_price,
                    "old_sale_price": old_sale,
                    "new_sale_price": sale_price or old_sale,
                    "current_stock": old_stock,
                    "suggested_stock": stock if "stock" in rec else old_stock,
                    "category": rec.get("category") or match.get("category") or "Khác",
                })
            else:
                created_items.append({
                    "name": name,
                    "unit": unit,
                    "price": price,
                    "sale_price": sale_price,
                    "stock": stock,
                    "category": rec.get("category") or "Khác",
                    "secondary_unit": rec.get("secondary_unit"),
                    "conversion_factor": rec.get("conversion_factor"),
                })

        return {
            "total_input": len(new_records),
            "new_count": len(created_items),
            "update_count": len(updated_items),
            "new_items": created_items,
            "updated_items": updated_items,
            "warnings": warnings,
        }

    def push_products_batch(self, records: list[dict[str, Any]]) -> dict[str, Any]:
        """Gọi API /api/admin/import/products để cập nhật hoặc tạo mới hàng loạt."""
        self.ensure_authenticated()
        payload = {
            "entity_type": "products",
            "records": records,
        }
        res = self._request("POST", "api/admin/import/products", payload=payload)
        return res

    def push_inventory_adjustment(
        self, items: list[dict[str, Any]], reason: str = "Kiểm kê định kỳ từ Agent Portal"
    ) -> dict[str, Any]:
        """
        Gửi điều chỉnh tồn kho trực tiếp qua POST /api/adjustments/inventory.
        Mỗi item: {"product_id": int, "adjusted_quantity": float, "system_quantity": float}
        """
        self.ensure_authenticated()
        payload = {
            "reason": reason,
            "items": items,
        }
        return self._request("POST", "api/adjustments/inventory", payload=payload)

    def upload_image(self, file_path_or_url: str | Path) -> str:
        """Tải ảnh lên máy chủ qua POST /api/products/images/upload và trả về image URL."""
        self.ensure_authenticated()
        s_target = str(file_path_or_url).strip()
        filename = "image.jpg"

        if s_target.startswith("http://") or s_target.startswith("https://"):
            req = urllib.request.Request(s_target, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, context=self.ssl_context) as resp:
                data = resp.read()
            filename = s_target.split("/")[-1].split("?")[0] or "image.jpg"
        else:
            p = Path(s_target)
            if not p.is_file():
                raise FileNotFoundError(f"Không tìm thấy file ảnh: {s_target}")
            data = p.read_bytes()
            filename = p.name

        res = self._request(
            "POST",
            f"api/products/images/upload?filename={urllib.parse.quote(filename)}",
            headers={"Content-Type": "application/octet-stream"},
            raw_data=data,
        )
        return res.get("url", "")

    def create_product(self, product_data: dict[str, Any]) -> dict[str, Any]:
        """Tạo sản phẩm mới qua POST /api/products."""
        self.ensure_authenticated()
        return self._request("POST", "api/products", payload=product_data)

    def update_product(self, product_id: int, product_data: dict[str, Any]) -> dict[str, Any]:
        """Cập nhật sản phẩm qua PUT /api/products/<id>."""
        self.ensure_authenticated()
        return self._request("PUT", f"api/products/{product_id}", payload=product_data)

    def push_quick_purchase(
        self,
        supplier_name: str = "",
        supplier_id: str = "",
        items: list[dict[str, Any]] | None = None,
        note: str = "Tạo phiếu nhập từ Agent Portal",
    ) -> dict[str, Any]:
        """
        Tạo và commit phiếu nhập hàng trực tiếp qua POST /api/purchases/quick-create.
        items: [{"product_id": int, "quantity": float, "unit_price": float}]
        Ưu tiên dùng supplier_id để tránh nhầm lẫn hoặc tạo trùng lặp.
        """
        self.ensure_authenticated()
        payload = {
            "supplier_id": supplier_id,
            "supplier_name": supplier_name,
            "items": items or [],
            "note": note,
        }
        return self._request("POST", "api/purchases/quick-create", payload=payload)

    def push_quick_order(
        self,
        customer_name: str,
        items: list[dict[str, Any]],
        note: str = "Đơn xuất từ Agent Portal",
        payment_status: str = "paid",
    ) -> dict[str, Any]:
        """
        Tạo và commit đơn hàng xuất trực tiếp qua POST /api/orders/quick-create.
        items: [{"product_id": int, "quantity": float, "unit_price": float}]
        """
        self.ensure_authenticated()
        payload = {
            "customer_name": customer_name,
            "items": items,
            "note": note,
            "payment_status": payment_status,
        }
        return self._request("POST", "api/orders/quick-create", payload=payload)


def _format_table(headers: list[str], rows: list[list[str]]) -> str:
    """Format bảng markdown đẹp mắt."""
    col_widths = [len(h) for h in headers]
    for row in rows:
        for idx, val in enumerate(row):
            col_widths[idx] = max(col_widths[idx], len(str(val)))

    header_line = " | ".join(h.ljust(col_widths[i]) for i, h in enumerate(headers))
    sep_line = "-|-".join("-" * col_widths[i] for i in range(len(headers)))
    row_lines = [
        " | ".join(str(val).ljust(col_widths[i]) for i, val in enumerate(row))
        for row in rows
    ]
    return f"| {header_line} |\n| {sep_line} |\n" + "\n".join(f"| {r} |" for r in row_lines)


def main():
    parser = argparse.ArgumentParser(description="Quản lý Vận hành Headless Remote cho Debian Server")
    parser.add_argument("--url", default=None, help="URL máy chủ (mặc định từ env hoặc config)")
    parser.add_argument("--user", default=None, help="Tài khoản Master Admin")
    parser.add_argument("--password", default=None, help="Mật khẩu Master Admin")
    subparsers = parser.add_subparsers(dest="action", help="Lệnh thao tác")

    # 1. status
    subparsers.add_parser("status", help="Kiểm tra kết nối và trạng thái máy chủ")

    # 2. products
    prod_parser = subparsers.add_parser("products", help="Xem danh sách sản phẩm trên server")
    prod_parser.add_argument("--search", default="", help="Từ khóa tìm kiếm")
    prod_parser.add_argument("--limit", type=int, default=20, help="Số lượng tối đa")

    # 3. preview
    prev_parser = subparsers.add_parser("preview", help="Xét kỹ & thẩm định dữ liệu trước khi đẩy lên")
    prev_parser.add_argument("file_or_json", help="Đường dẫn file JSON hoặc chuỗi JSON")

    # 4. push-products
    push_prod_parser = subparsers.add_parser("push-products", help="Đẩy dữ liệu sản phẩm lên server")
    push_prod_parser.add_argument("file_or_json", help="Đường dẫn file JSON hoặc chuỗi JSON")

    # 5. push-adjustment
    adj_parser = subparsers.add_parser("push-adjustment", help="Đẩy phiếu kiểm kê điều chỉnh kho")
    adj_parser.add_argument("file_or_json", help="Đường dẫn file JSON chứa items và reason")

    # 6. push-purchase
    pur_parser = subparsers.add_parser("push-purchase", help="Đẩy phiếu nhập hàng")
    pur_parser.add_argument("file_or_json", help="File JSON chứa supplier_name, items, note")

    # 7. push-order
    ord_parser = subparsers.add_parser("push-order", help="Đẩy đơn hàng xuất kho")
    ord_parser.add_argument("file_or_json", help="File JSON chứa customer_name, items, note")

    # 8. suppliers
    sup_parser = subparsers.add_parser("suppliers", help="Xem danh sách nhà cung cấp trên server")
    sup_parser.add_argument("--search", default="", help="Từ khóa tìm kiếm theo tên hoặc SĐT")

    # 9. deploy-release
    dep_parser = subparsers.add_parser("deploy-release", help="Triển khai gói sản phẩm bảo lưu lên máy chủ")
    dep_parser.add_argument("--manifest", default="data/staged_releases/cha_bao_rong_bien.json", help="Đường dẫn file manifest JSON")
    dep_parser.add_argument("--supplier-id", default="", help="Mã ID nhà cung cấp chính xác trên server đích")
    dep_parser.add_argument("--supplier-query", default="", help="Tên hoặc từ khóa NCC để đối soát tự động")

    args = parser.parse_args()
    if not args.action:
        parser.print_help()
        sys.exit(0)

    client = RemoteStoreClient(base_url=args.url, username=args.user, password=args.password)

    try:
        if args.action == "status":
            print(f"[*] Đang kết nối tới máy chủ: {client.base_url}")
            status = client.get_status()
            print(f"[+] Trạng thái hệ thống: {status.get('app', {}).get('name')} v{status.get('app', {}).get('version')}")
            print(f"    Admin path: {status.get('admin_path')}")
            print(f"    Enable Login: {status.get('enable_login')}")

            print("[*] Thử nghiệm đăng nhập quản trị...")
            login_res = client.login()
            print(f"[+] Đăng nhập thành công với vai trò: {login_res.get('role')} (User: {login_res.get('username')})")

            summary = client.get_summary()
            print("[+] Tổng quan tồn kho thực tế:")
            print(f"    - Tổng số mặt hàng: {summary.get('product_count')}")
            print(f"    - Tổng số lượng tồn: {summary.get('total_stock')}")
            print(f"    - Tổng giá trị kho: {summary.get('total_inventory_value', 0):,.0f} VNĐ")
            print(f"    - Số món sắp hết hàng: {summary.get('low_stock_count')}")

        elif args.action == "products":
            products = client.get_products()
            kw = args.search.strip().lower()
            if kw:
                products = [p for p in products if kw in p.get("name", "").lower() or kw in p.get("category", "").lower()]

            total_found = len(products)
            limited_prods = products[: args.limit]
            print(f"\n[+] Tìm thấy {total_found} sản phẩm trên hệ thống (Hiển thị {len(limited_prods)}):")

            headers = ["ID", "Tên sản phẩm", "ĐVT", "Giá nhập", "Giá bán", "Tồn kho", "Danh mục"]
            rows = []
            for p in limited_prods:
                rows.append([
                    str(p.get("id")),
                    p.get("name", ""),
                    p.get("unit", ""),
                    f"{float(p.get('price') or 0):,.0f}",
                    f"{float(p.get('sale_price') or 0):,.0f}",
                    str(p.get("stock", 0)),
                    p.get("category", ""),
                ])
            print(_format_table(headers, rows))

        elif args.action == "preview":
            # Đọc dữ liệu
            raw_input = args.file_or_json.strip()
            if os.path.isfile(raw_input):
                with open(raw_input, "r", encoding="utf-8") as f:
                    records = json.load(f)
            else:
                records = json.loads(raw_input)

            if isinstance(records, dict) and "records" in records:
                records = records["records"]

            report = client.preview_scrutiny_products(records)
            print("\n=======================================================")
            print("   BÁO CÁO THẨM ĐỊNH DỮ LIỆU ĐỐI SOÁT VỚI LIVE SERVER  ")
            print("=======================================================")
            print(f"Tổng số mặt hàng yêu cầu: {report['total_input']}")
            print(f"- Mặt hàng TẠO MỚI: {report['new_count']}")
            print(f"- Mặt hàng CẬP NHẬT: {report['update_count']}")

            if report["warnings"]:
                print("\n[!] CÁC CẢNH BÁO CẦN LƯU Ý:")
                for w in report["warnings"]:
                    print(f"  * {w}")

            if report["new_items"]:
                print("\n[*] DANH SÁCH MẶT HÀNG MỚI SẼ TẠO:")
                headers = ["Tên sản phẩm", "ĐVT", "Giá nhập", "Giá bán", "Tồn ban đầu", "Danh mục"]
                rows = [
                    [
                        i["name"],
                        i["unit"],
                        f"{i['price']:,.0f}",
                        f"{i['sale_price']:,.0f}",
                        str(i["stock"]),
                        i["category"],
                    ]
                    for i in report["new_items"]
                ]
                print(_format_table(headers, rows))

            if report["updated_items"]:
                print("\n[*] DANH SÁCH MẶT HÀNG CẬP NHẬT:")
                headers = ["ID", "Tên sản phẩm", "Giá nhập cũ -> mới", "Giá bán cũ -> mới", "Tồn hiện tại"]
                rows = [
                    [
                        str(i["id"]),
                        i["name"],
                        f"{i['old_price']:,.0f} -> {i['new_price']:,.0f}",
                        f"{i['old_sale_price']:,.0f} -> {i['new_sale_price']:,.0f}",
                        str(i["current_stock"]),
                    ]
                    for i in report["updated_items"]
                ]
                print(_format_table(headers, rows))

        elif args.action == "push-products":
            raw_input = args.file_or_json.strip()
            if os.path.isfile(raw_input):
                with open(raw_input, "r", encoding="utf-8") as f:
                    records = json.load(f)
            else:
                records = json.loads(raw_input)

            if isinstance(records, dict) and "records" in records:
                records = records["records"]

            print(f"[*] Đang đẩy {len(records)} mặt hàng lên hệ thống Debian...")
            res = client.push_products_batch(records)
            print("[+] KẾT QUẢ TỪ MÁY CHỦ:")
            print(f"    - Message: {res.get('message')}")
            print(f"    - Đã tạo mới: {res.get('imported_count', 0)}")
            print(f"    - Đã cập nhật: {res.get('updated_count', 0)}")
            if res.get("skipped_count"):
                print(f"    - Bỏ qua: {res.get('skipped_count')}")

        elif args.action == "push-adjustment":
            raw_input = args.file_or_json.strip()
            data = json.load(open(raw_input, "r", encoding="utf-8")) if os.path.isfile(raw_input) else json.loads(raw_input)
            res = client.push_inventory_adjustment(data.get("items", []), data.get("reason", "Kiểm kê từ Agent"))
            print(f"[+] Điều chỉnh tồn kho thành công: {res.get('message', 'OK')}")

        elif args.action == "push-purchase":
            raw_input = args.file_or_json.strip()
            data = json.load(open(raw_input, "r", encoding="utf-8")) if os.path.isfile(raw_input) else json.loads(raw_input)
            res = client.push_quick_purchase(
                supplier_id=data.get("supplier_id", ""),
                supplier_name=data.get("supplier_name", "Nhà cung cấp chung"),
                items=data.get("items", []),
                note=data.get("note", "Nhập hàng từ Agent Portal"),
            )
            print(f"[+] Tạo phiếu nhập hàng thành công! Mã chứng từ: {res.get('document_id') or res.get('id')}")

        elif args.action == "push-order":
            raw_input = args.file_or_json.strip()
            data = json.load(open(raw_input, "r", encoding="utf-8")) if os.path.isfile(raw_input) else json.loads(raw_input)
            res = client.push_quick_order(
                customer_name=data.get("customer_name", "Khách lẻ"),
                items=data.get("items", []),
                note=data.get("note", "Đơn hàng từ Agent Portal"),
                payment_status=data.get("payment_status", "paid"),
            )
            print(f"[+] Tạo đơn hàng thành công! Mã đơn: {res.get('document_id') or res.get('id')}")

        elif args.action == "suppliers":
            suppliers = client.get_suppliers()
            kw = args.search.strip().lower()
            if kw:
                suppliers = [
                    s for s in suppliers
                    if kw in s.get("name", "").lower() or kw in s.get("phone", "").lower() or kw in s.get("address", "").lower()
                ]
            print(f"\n[+] Tìm thấy {len(suppliers)} nhà cung cấp trên hệ thống:")
            headers = ["STT", "ID", "Tên nhà cung cấp", "Số điện thoại", "Địa chỉ"]
            rows = []
            for idx, s in enumerate(suppliers, start=1):
                rows.append([
                    str(idx),
                    s.get("id", ""),
                    s.get("name", ""),
                    s.get("phone", ""),
                    s.get("address", ""),
                ])
            print(_format_table(headers, rows))

        elif args.action == "deploy-release":
            manifest_path = Path(args.manifest)
            if not manifest_path.is_file():
                print(f"[!] Không tìm thấy manifest: {manifest_path}", file=sys.stderr)
                sys.exit(1)
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            print(f"[*] Đang chuẩn bị triển khai gói: {manifest.get('release_code')}")
            print(f"[*] Máy chủ mục tiêu: {client.base_url}")

            client.ensure_authenticated()

            # 1. Đối soát NCC
            sup_query = args.supplier_query or manifest.get("initial_inventory", {}).get("supplier_query", "")
            target_sup = None
            if args.supplier_id:
                sup, _ = client.resolve_supplier(args.supplier_id)
                target_sup = sup
            elif sup_query:
                sup, matches = client.resolve_supplier(sup_query)
                if sup:
                    target_sup = sup
                elif matches:
                    print(f"[!] Tìm thấy nhiều NCC khớp với '{sup_query}':")
                    for m in matches:
                        print(f"    - ID: {m.get('id')} | Tên: {m.get('name')}")
                    print("[!] Vui lòng chỉ định chính xác --supplier-id để tránh nhầm lẫn.", file=sys.stderr)
                    sys.exit(1)

            if not target_sup:
                print(f"[!] Không tìm thấy NCC khớp với '{args.supplier_id or sup_query}'.", file=sys.stderr)
                print("[*] Danh sách NCC đang có trên server:")
                for s in client.get_suppliers():
                    print(f"    - ID: {s.get('id')} | Tên: {s.get('name')}")
                sys.exit(1)

            print(f"[+] Đã khớp chính xác NCC: {target_sup.get('name')} (ID: {target_sup.get('id')})")

            # 2. Upload ảnh
            uploaded_urls = []
            for item in manifest.get("source_images", []):
                target_img = item
                if isinstance(item, dict):
                    loc = item.get("local_path", "")
                    if loc and Path(loc).is_file():
                        target_img = loc
                    else:
                        target_img = item.get("fallback_url", "")
                print(f"[*] Đang tải ảnh: {target_img}...")
                url = client.upload_image(target_img)
                uploaded_urls.append(url)
                print(f"    -> Đã tải thành công: {url}")

            # 3. Tạo sản phẩm
            prod_payload = dict(manifest.get("product", {}))
            prod_payload["images"] = uploaded_urls
            print(f"[*] Đang tạo sản phẩm: {prod_payload.get('name')}...")
            created_prod = client.create_product(prod_payload)
            prod_id = created_prod.get("id") or created_prod.get("product_id")
            print(f"[+] Tạo sản phẩm thành công! ID mới trên server: {prod_id}")

            # 4. Nhập kho ban đầu nếu có
            init_inv = manifest.get("initial_inventory", {})
            qty = float(init_inv.get("quantity_base_units", 0))
            cost = float(init_inv.get("unit_cost", 0))
            if qty > 0 and cost > 0:
                print(f"[*] Đang tạo phiếu nhập kho ban đầu ({qty} đơn vị x {cost:,.0f} đ)...")
                pur_res = client.push_quick_purchase(
                    supplier_id=target_sup.get("id", ""),
                    supplier_name=target_sup.get("name", ""),
                    items=[{"product_id": prod_id, "quantity": qty, "unit_price": cost}],
                    note=f"Nhập hàng ban đầu cho sản phẩm mới {prod_payload.get('name')}"
                )
                pur_id = pur_res.get("document_id") or pur_res.get("id")
                print(f"[+] Đã tạo phiếu nhập kho thành công! Mã phiếu: {pur_id}")

            print("\n" + "="*50)
            print("[V] HOÀN TẤT TRIỂN KHAI LÊN SERVER THÀNH CÔNG!")
            print(f"    - Tên sản phẩm : {prod_payload.get('name')}")
            print(f"    - ID Sản phẩm  : {prod_id}")
            print(f"    - Giá bán      : {prod_payload.get('sale_price'):,.0f} đ / {prod_payload.get('unit')}")
            print(f"    - Nhà cung cấp : {target_sup.get('name')} (Mã: {target_sup.get('id')})")
            print(f"    - Tồn ban đầu  : {qty} {prod_payload.get('unit')}")
            print(f"    - Số ảnh đã gắn: {len(uploaded_urls)}")
            print("="*50 + "\n")

    except Exception as exc:
        print(f"\n[!] LỖI THỰC THI: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
