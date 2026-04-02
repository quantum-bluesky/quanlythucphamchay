import base64
import json
import mimetypes
import re
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .auth import parse_cookie_header
from .constants import ADMIN_SESSION_COOKIE, STATIC_DIR


def create_handler(store, admin_sessions):
    class InventoryRequestHandler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            route = parsed.path

            if route == "/":
                self._serve_static_file("index.html")
                return

            if route == "/favicon.ico":
                self.send_response(HTTPStatus.NO_CONTENT)
                self.end_headers()
                return

            if route.startswith("/static/"):
                self._serve_static_file(route.removeprefix("/static/"))
                return

            if route == "/api/products":
                self._send_json(
                    HTTPStatus.OK,
                    {"products": store.get_products(), "summary": store.get_summary()},
                )
                return

            if route == "/api/products/deleted":
                self._send_json(
                    HTTPStatus.OK,
                    {"products": store.get_deleted_products()},
                )
                return

            if route == "/api/products/history":
                query = parse_qs(parsed.query)
                limit = query.get("limit", ["40"])[0]
                self._send_json(
                    HTTPStatus.OK,
                    {"history": store.get_product_history(limit=int(limit))},
                )
                return

            if route == "/api/transactions":
                query = parse_qs(parsed.query)
                limit = query.get("limit", ["20"])[0]
                self._send_json(
                    HTTPStatus.OK,
                    {"transactions": store.get_transactions(limit=int(limit))},
                )
                return

            if route == "/api/state":
                query = parse_qs(parsed.query)
                limit = query.get("transaction_limit", ["16"])[0]
                self._send_json(
                    HTTPStatus.OK,
                    {
                        "products": store.get_products(),
                        "summary": store.get_summary(),
                        "transactions": store.get_transactions(limit=int(limit)),
                        **store.get_sync_state(),
                    },
                )
                return

            if route == "/api/reports/monthly":
                query = parse_qs(parsed.query)
                try:
                    months = int(query.get("months", ["6"])[0])
                    start_date = query.get("start_date", [None])[0]
                    end_date = query.get("end_date", [None])[0]
                    focus_month = query.get("focus_month", [None])[0]
                    payload = store.get_monthly_report(
                        months=months,
                        focus_month=focus_month,
                        start_date=start_date,
                        end_date=end_date,
                    )
                except ValueError:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Bộ lọc báo cáo không hợp lệ."})
                    return
                self._send_json(HTTPStatus.OK, payload)
                return

            if route == "/api/admin/status":
                username = self._get_admin_username()
                self._send_json(
                    HTTPStatus.OK,
                    {"authenticated": bool(username), "username": username or ""},
                )
                return

            if route.startswith("/api/admin/"):
                if not self._require_admin():
                    return

                if route == "/api/admin/backup":
                    backup_path = store.create_database_backup()
                    self._send_binary_file(
                        backup_path,
                        content_type="application/octet-stream",
                        download_name=backup_path.name,
                    )
                    return

                export_match = re.fullmatch(r"/api/admin/export/(products|customers|suppliers)", route)
                if export_match:
                    entity_type = export_match.group(1)
                    payload = store.export_master_data(entity_type)
                    filename = f"{entity_type}-master-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
                    self._send_binary(
                        HTTPStatus.OK,
                        json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8"),
                        content_type="application/json; charset=utf-8",
                        download_name=filename,
                    )
                    return

            self._send_json(HTTPStatus.NOT_FOUND, {"error": "Không tìm thấy tài nguyên."})

        def do_POST(self) -> None:
            route = urlparse(self.path).path
            if route == "/api/admin/login":
                try:
                    payload = self._read_json_body()
                    token = admin_sessions.login(
                        str(payload.get("username", "")).strip(),
                        str(payload.get("password", "")).strip(),
                    )
                    self._send_json(
                        HTTPStatus.OK,
                        {
                            "message": "Đã đăng nhập Master Admin.",
                            "authenticated": True,
                            "username": admin_sessions.username,
                        },
                        extra_headers=[("Set-Cookie", self._build_session_cookie(token))],
                    )
                except ValueError as exc:
                    self._send_json(HTTPStatus.UNAUTHORIZED, {"error": str(exc)})
                return

            if route == "/api/admin/logout":
                admin_sessions.logout(self._get_admin_session_token())
                self._send_json(
                    HTTPStatus.OK,
                    {"message": "Đã đăng xuất Master Admin.", "authenticated": False},
                    extra_headers=[("Set-Cookie", self._build_logout_cookie())],
                )
                return

            if route.startswith("/api/admin/"):
                if not self._require_admin():
                    return

                import_match = re.fullmatch(r"/api/admin/import/(products|customers|suppliers)", route)
                if import_match:
                    try:
                        payload = self._read_json_body()
                        records = payload.get("records", [])
                        result = store.import_master_data(import_match.group(1), records)
                        self._send_json(
                            HTTPStatus.OK,
                            {
                                "message": "Đã import dữ liệu master.",
                                "result": result,
                                "summary": store.get_summary(),
                            },
                        )
                    except ValueError as exc:
                        self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                    return

                if route == "/api/admin/restore":
                    try:
                        payload = self._read_json_body()
                        encoded = payload.get("content_base64", "")
                        if not encoded:
                            raise ValueError("Thiếu file restore.")
                        raw_bytes = base64.b64decode(encoded)
                        previous_backup = store.restore_database_from_bytes(raw_bytes)
                        self._send_json(
                            HTTPStatus.OK,
                            {
                                "message": "Đã restore database toàn hệ thống.",
                                "previous_backup": previous_backup.name,
                            },
                        )
                    except (ValueError, base64.binascii.Error) as exc:
                        self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                    return

            restore_match = re.fullmatch(r"/api/products/(\d+)/restore", urlparse(self.path).path)
            if restore_match:
                try:
                    product = store.restore_product(restore_match.group(1))
                    self._send_json(
                        HTTPStatus.OK,
                        {
                            "message": "Đã khôi phục sản phẩm.",
                            "product": product,
                            "summary": store.get_summary(),
                        },
                    )
                except ValueError as exc:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                return

            try:
                payload = self._read_json_body()
            except ValueError as exc:
                self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                return

            try:
                if self.path == "/api/products":
                    product = store.create_product(
                        name=payload.get("name"),
                        category=payload.get("category"),
                        unit=payload.get("unit"),
                        price=payload.get("price", 0),
                        sale_price=payload.get("sale_price"),
                        low_stock_threshold=payload.get("low_stock_threshold", 5),
                    )
                    self._send_json(
                        HTTPStatus.CREATED,
                        {
                            "message": "Đã thêm sản phẩm.",
                            "product": product,
                            "summary": store.get_summary(),
                        },
                    )
                    return

                if self.path == "/api/transactions":
                    transaction = store.create_transaction(
                        product_id=int(payload.get("product_id", 0)),
                        transaction_type=payload.get("transaction_type"),
                        quantity=payload.get("quantity"),
                        note=payload.get("note", ""),
                    )
                    self._send_json(
                        HTTPStatus.CREATED,
                        {
                            "message": "Đã cập nhật tồn kho.",
                            "transaction": transaction,
                            "summary": store.get_summary(),
                        },
                    )
                    return

                if self.path == "/api/orders/checkout":
                    order = store.create_checkout_order(
                        customer_name=payload.get("customer_name"),
                        items=payload.get("items", []),
                        note=payload.get("note", ""),
                    )
                    self._send_json(
                        HTTPStatus.CREATED,
                        {
                            "message": "Đã chốt giỏ hàng và xuất kho.",
                            "order": order,
                            "summary": store.get_summary(),
                        },
                    )
                    return

                if self.path == "/api/purchases/receive":
                    receipt = store.create_purchase_receipt(
                        items=payload.get("items", []),
                        note=payload.get("note", ""),
                        supplier_name=payload.get("supplier_name", ""),
                    )
                    self._send_json(
                        HTTPStatus.CREATED,
                        {
                            "message": "Đã nhập hàng vào kho.",
                            "receipt": receipt,
                            "summary": store.get_summary(),
                        },
                    )
                    return

                self._send_json(HTTPStatus.NOT_FOUND, {"error": "Không tìm thấy API."})
            except ValueError as exc:
                self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})

        def do_PUT(self) -> None:
            if urlparse(self.path).path == "/api/state":
                try:
                    payload = self._read_json_body()
                    sync_state = store.save_sync_state(payload)
                    self._send_json(
                        HTTPStatus.OK,
                        {
                            "message": "Đã lưu dữ liệu đồng bộ.",
                            **sync_state,
                        },
                    )
                except ValueError as exc:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                return

            product_match = re.fullmatch(r"/api/products/(\d+)$", urlparse(self.path).path)
            if product_match:
                try:
                    payload = self._read_json_body()
                    product = store.update_product(
                        product_id=product_match.group(1),
                        name=payload.get("name"),
                        category=payload.get("category"),
                        unit=payload.get("unit"),
                        price=payload.get("price", 0),
                        sale_price=payload.get("sale_price"),
                        low_stock_threshold=payload.get("low_stock_threshold", 5),
                    )
                    self._send_json(
                        HTTPStatus.OK,
                        {
                            "message": "Đã cập nhật sản phẩm.",
                            "product": product,
                            "summary": store.get_summary(),
                        },
                    )
                except ValueError as exc:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                return

            match = re.fullmatch(r"/api/products/(\d+)/price", urlparse(self.path).path)
            if match:
                try:
                    payload = self._read_json_body()
                    product = store.update_product_price(match.group(1), payload.get("price", 0))
                    self._send_json(
                        HTTPStatus.OK,
                        {
                            "message": "Đã cập nhật giá nhập.",
                            "product": product,
                            "summary": store.get_summary(),
                        },
                    )
                except ValueError as exc:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                return

            match = re.fullmatch(r"/api/products/(\d+)/sale-price", urlparse(self.path).path)
            if match:
                try:
                    payload = self._read_json_body()
                    product = store.update_product_sale_price(match.group(1), payload.get("sale_price", 0))
                    self._send_json(
                        HTTPStatus.OK,
                        {
                            "message": "Đã cập nhật giá bán.",
                            "product": product,
                            "summary": store.get_summary(),
                        },
                    )
                except ValueError as exc:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                return

            self._send_json(HTTPStatus.NOT_FOUND, {"error": "Không tìm thấy API."})

        def do_DELETE(self) -> None:
            match = re.fullmatch(r"/api/products/(\d+)$", urlparse(self.path).path)
            if not match:
                self._send_json(HTTPStatus.NOT_FOUND, {"error": "Không tìm thấy API."})
                return

            try:
                deleted = store.delete_product(match.group(1))
                self._send_json(
                    HTTPStatus.OK,
                    {
                        "message": "Đã chuyển sản phẩm sang danh mục đã xóa.",
                        "deleted": deleted,
                        "summary": store.get_summary(),
                    },
                )
            except ValueError as exc:
                self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})

        def log_message(self, format_string: str, *args) -> None:
            return

        def _read_json_body(self) -> dict:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0:
                raise ValueError("Thiếu dữ liệu gửi lên.")

            raw_body = self.rfile.read(content_length).decode("utf-8")
            try:
                return json.loads(raw_body)
            except json.JSONDecodeError as exc:
                raise ValueError("Dữ liệu JSON không hợp lệ.") from exc

        def _serve_static_file(self, relative_path: str) -> None:
            safe_path = (STATIC_DIR / relative_path).resolve()
            static_root = STATIC_DIR.resolve()
            if not safe_path.is_file() or (static_root not in safe_path.parents and safe_path != static_root):
                self._send_json(HTTPStatus.NOT_FOUND, {"error": "Không tìm thấy file."})
                return

            content_type, _ = mimetypes.guess_type(safe_path.name)
            payload = safe_path.read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", content_type or "application/octet-stream")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def _get_admin_session_token(self) -> str | None:
            cookies = parse_cookie_header(self.headers.get("Cookie"))
            return cookies.get(ADMIN_SESSION_COOKIE)

        def _get_admin_username(self) -> str | None:
            return admin_sessions.get_username(self._get_admin_session_token())

        def _require_admin(self) -> bool:
            if self._get_admin_username():
                return True
            self._send_json(HTTPStatus.UNAUTHORIZED, {"error": "Cần đăng nhập Master Admin."})
            return False

        def _build_session_cookie(self, token: str) -> str:
            return f"{ADMIN_SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite=Lax"

        def _build_logout_cookie(self) -> str:
            return f"{ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"

        def _send_binary(
            self,
            status: HTTPStatus,
            payload: bytes,
            *,
            content_type: str,
            download_name: str | None = None,
        ) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(payload)))
            if download_name:
                self.send_header("Content-Disposition", f'attachment; filename="{download_name}"')
            self.end_headers()
            self.wfile.write(payload)

        def _send_binary_file(self, file_path: Path, *, content_type: str, download_name: str | None = None) -> None:
            self._send_binary(
                HTTPStatus.OK,
                file_path.read_bytes(),
                content_type=content_type,
                download_name=download_name,
            )

        def _send_json(self, status: HTTPStatus, payload: dict, extra_headers: list[tuple[str, str]] | None = None) -> None:
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            for key, value in extra_headers or []:
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(data)

    return InventoryRequestHandler
