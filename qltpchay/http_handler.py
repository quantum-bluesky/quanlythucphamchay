import base64
import csv
import io
import json
import mimetypes
import re
import sys
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .auth import parse_cookie_header
from .constants import ADMIN_SESSION_COOKIE, APP_NAME, STATIC_DIR
from .store import SyncConflictError


def create_handler(store, admin_sessions, system_config: dict | None = None):
    debug_config = (system_config or {}).get("debug", {})
    pagination_config = (system_config or {}).get("pagination", {})
    auth_enabled = bool((system_config or {}).get("EnableLogin"))
    app_version = str((system_config or {}).get("version") or "").strip() or "2.3.1"
    try:
        session_timeout_minutes = max(1, int((system_config or {}).get("session_timeout_minutes", 360)))
    except (TypeError, ValueError):
        session_timeout_minutes = 360
    try:
        admin_session_timeout_minutes = max(1, int((system_config or {}).get("admin_session_timeout_minutes", 30)))
    except (TypeError, ValueError):
        admin_session_timeout_minutes = 30

    class InventoryRequestHandler(BaseHTTPRequestHandler):
        @staticmethod
        def _get_app_info() -> dict:
            return {
                "name": APP_NAME,
                "version": app_version,
            }

        @staticmethod
        def _get_pagination_info() -> dict:
            try:
                items_per_page = max(1, int(pagination_config.get("items_per_page", 10)))
            except (TypeError, ValueError):
                items_per_page = 10
            try:
                documents_per_page = max(1, int(pagination_config.get("documents_per_page", 10)))
            except (TypeError, ValueError):
                documents_per_page = 10
            return {
                "items_per_page": items_per_page,
                "documents_per_page": documents_per_page,
            }

        @staticmethod
        def _get_debug_info() -> dict:
            return {
                "sync_state": bool(debug_config.get("sync_state")),
            }

        @classmethod
        def _is_sync_debug_enabled(cls) -> bool:
            return cls._get_debug_info()["sync_state"]

        def _build_sync_debug_summary(self, payload: dict | None) -> dict:
            payload = payload or {}
            keys = [
                key
                for key in ("customers", "suppliers", "carts", "purchases")
                if isinstance(payload.get(key), list)
            ]
            purchase_statuses: dict[str, int] = {}
            for purchase in payload.get("purchases", []) if isinstance(payload.get("purchases"), list) else []:
                status = str(purchase.get("status") or "draft")
                purchase_statuses[status] = purchase_statuses.get(status, 0) + 1

            return {
                "client": f"{self.client_address[0]}:{self.client_address[1]}",
                "actor": str(payload.get("actor") or ""),
                "keys": keys,
                "counts": {
                    key: len(payload.get(key) or [])
                    for key in keys
                },
                "purchase_statuses": purchase_statuses,
                "expected_updated_at": payload.get("expected_updated_at", {}),
            }

        def _log_sync_debug(self, message: str, payload: dict | None = None) -> None:
            if not self._is_sync_debug_enabled():
                return
            timestamp = datetime.now().isoformat(timespec="seconds")
            summary = self._build_sync_debug_summary(payload)
            line = f"[sync-debug] {timestamp} {message}: {json.dumps(summary, ensure_ascii=False)}"
            try:
                sys.stdout.buffer.write(line.encode(sys.stdout.encoding or "utf-8", errors="backslashreplace") + b"\n")
                sys.stdout.flush()
            except Exception:
                pass

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

            if route == "/api/session/status":
                self._send_json(HTTPStatus.OK, self._get_session_status_payload())
                return

            if route == "/api/admin/status":
                self._send_json(HTTPStatus.OK, self._get_session_status_payload())
                return

            if route.startswith("/api/") and self._is_login_enabled() and not self._get_current_session():
                self._send_json(HTTPStatus.UNAUTHORIZED, {"error": "Cần đăng nhập hệ thống."})
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
                actor = query.get("actor", [""])[0]
                start_date = query.get("start_date", [None])[0]
                end_date = query.get("end_date", [None])[0]
                self._send_json(
                    HTTPStatus.OK,
                    {
                        "history": store.get_product_history(
                            limit=int(limit),
                            actor=actor,
                            start_date=start_date,
                            end_date=end_date,
                        )
                    },
                )
                return

            if route == "/api/receipts/history":
                query = parse_qs(parsed.query)
                limit = query.get("limit", ["40"])[0]
                receipt_type = query.get("receipt_type", [""])[0]
                start_date = query.get("start_date", [None])[0]
                end_date = query.get("end_date", [None])[0]
                self._send_json(
                    HTTPStatus.OK,
                    {
                        "history": store.get_receipt_history(
                            limit=int(limit),
                            receipt_type=receipt_type,
                            start_date=start_date,
                            end_date=end_date,
                        )
                    },
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
                        "app": self._get_app_info(),
                        "debug": self._get_debug_info(),
                        "pagination": self._get_pagination_info(),
                        "products": store.get_products(),
                        "summary": store.get_summary(),
                        "transactions": store.get_transactions(limit=int(limit)),
                        "runtime_version": store.get_runtime_version(),
                        **store.get_sync_state(),
                    },
                )
                return

            if route == "/api/runtime-version":
                self._send_json(
                    HTTPStatus.OK,
                    {
                        **store.get_runtime_version(),
                        "app": self._get_app_info(),
                        "debug": self._get_debug_info(),
                        "pagination": self._get_pagination_info(),
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
                    query = parse_qs(parsed.query)
                    export_format = str(query.get("format", ["json"])[0]).strip().lower()
                    if export_format not in {"json", "csv"}:
                        self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Định dạng export không hợp lệ. Chỉ hỗ trợ json/csv."})
                        return
                    payload = store.export_master_data(entity_type)
                    timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
                    if export_format == "csv":
                        self._send_binary(
                            HTTPStatus.OK,
                            self._build_master_csv_bytes(entity_type, payload.get("records", [])),
                            content_type="text/csv; charset=utf-8",
                            download_name=f"{entity_type}-master-{timestamp}.csv",
                        )
                    else:
                        self._send_binary(
                            HTTPStatus.OK,
                            json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8"),
                            content_type="application/json; charset=utf-8",
                            download_name=f"{entity_type}-master-{timestamp}.json",
                        )
                    return

            self._send_json(HTTPStatus.NOT_FOUND, {"error": "Không tìm thấy tài nguyên."})

        def do_POST(self) -> None:
            route = urlparse(self.path).path
            if route == "/api/session/login":
                try:
                    payload = self._read_json_body()
                    session_data = admin_sessions.login(
                        str(payload.get("username", "")).strip(),
                        str(payload.get("password", "")).strip(),
                    )
                    self._send_json(
                        HTTPStatus.OK,
                        {
                            "message": "Đã đăng nhập hệ thống.",
                            **self._get_session_status_payload(session_token=session_data["token"]),
                        },
                        extra_headers=[("Set-Cookie", self._build_session_cookie(session_data["token"]))],
                    )
                except ValueError as exc:
                    self._send_json(HTTPStatus.UNAUTHORIZED, {"error": str(exc)})
                return

            if route == "/api/session/logout":
                admin_sessions.logout(self._get_session_token())
                self._send_json(
                    HTTPStatus.OK,
                    {
                        "message": "Đã đăng xuất hệ thống.",
                        **self._get_session_status_payload(session_token=""),
                    },
                    extra_headers=[("Set-Cookie", self._build_logout_cookie())],
                )
                return

            if route == "/api/admin/login":
                try:
                    payload = self._read_json_body()
                    session_data = admin_sessions.login(
                        str(payload.get("username", "")).strip(),
                        str(payload.get("password", "")).strip(),
                        require_admin=True,
                    )
                    self._send_json(
                        HTTPStatus.OK,
                        {
                            "message": "Đã đăng nhập Master Admin.",
                            **self._get_session_status_payload(session_token=session_data["token"]),
                        },
                        extra_headers=[("Set-Cookie", self._build_session_cookie(session_data["token"]))],
                    )
                except ValueError as exc:
                    self._send_json(HTTPStatus.UNAUTHORIZED, {"error": str(exc)})
                return

            if route == "/api/admin/logout":
                admin_sessions.logout(self._get_session_token())
                self._send_json(
                    HTTPStatus.OK,
                    {
                        "message": "Đã đăng xuất Master Admin.",
                        **self._get_session_status_payload(session_token=""),
                    },
                    extra_headers=[("Set-Cookie", self._build_logout_cookie())],
                )
                return

            if route.startswith("/api/") and self._is_login_enabled() and not self._require_authenticated_session():
                return

            if route.startswith("/api/admin/"):
                if not self._require_admin():
                    return

                import_match = re.fullmatch(r"/api/admin/import/(products|customers|suppliers)", route)
                if import_match:
                    try:
                        payload = self._read_json_body()
                        import_entity_type = import_match.group(1)
                        self._validate_import_entity_match(import_entity_type, payload)
                        import_format = str(payload.get("format") or "json").strip().lower()
                        if import_format == "json":
                            records = payload.get("records", [])
                        elif import_format == "csv":
                            records = self._parse_master_csv_records(
                                import_entity_type,
                                str(payload.get("content") or ""),
                            )
                        else:
                            raise ValueError("Định dạng import không hợp lệ. Chỉ hỗ trợ json/csv.")
                        if not isinstance(records, list):
                            raise ValueError("Dữ liệu import không hợp lệ.")
                        if not records:
                            raise ValueError("File import không có bản ghi hợp lệ.")
                        result = store.import_master_data(import_entity_type, records)
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
                    if not self._require_admin():
                        return
                    transaction = store.create_transaction(
                        product_id=int(payload.get("product_id", 0)),
                        transaction_type=payload.get("transaction_type"),
                        quantity=payload.get("quantity"),
                        note=payload.get("note", ""),
                        adjustment_reason=payload.get("adjustment_reason", ""),
                        actor=self._get_current_username() or "",
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

                if self.path == "/api/purchases/repair":
                    result = store.repair_purchase_document(
                        payload.get("purchase_id", ""),
                        action=payload.get("action", ""),
                        actor=self._get_current_username() or "",
                    )
                    self._send_json(
                        HTTPStatus.OK,
                        {
                            "message": result["message"],
                            "purchases": result["purchases"],
                            "detached_receipt_codes": result["detached_receipt_codes"],
                            "summary": store.get_summary(),
                        },
                    )
                    return

                if self.path == "/api/adjustments/inventory":
                    if not self._require_admin():
                        return
                    receipt = store.create_inventory_adjustment_receipt(
                        items=payload.get("items", []),
                        reason=payload.get("reason", ""),
                        note=payload.get("note", ""),
                        actor=self._get_current_username() or "",
                    )
                    self._send_json(
                        HTTPStatus.CREATED,
                        {
                            "message": "Đã tạo phiếu điều chỉnh tồn.",
                            "receipt": receipt,
                            "summary": store.get_summary(),
                        },
                    )
                    return

                if self.path == "/api/returns/customers":
                    receipt = store.create_customer_return_receipt(
                        customer_name=payload.get("customer_name", ""),
                        items=payload.get("items", []),
                        note=payload.get("note", ""),
                        source_type=payload.get("source_type", ""),
                        source_code=payload.get("source_code", ""),
                    )
                    self._send_json(
                        HTTPStatus.CREATED,
                        {
                            "message": "Đã tạo phiếu trả hàng khách.",
                            "receipt": receipt,
                            "summary": store.get_summary(),
                        },
                    )
                    return

                if self.path == "/api/returns/suppliers":
                    receipt = store.create_supplier_return_receipt(
                        supplier_name=payload.get("supplier_name", ""),
                        items=payload.get("items", []),
                        note=payload.get("note", ""),
                        source_type=payload.get("source_type", ""),
                        source_code=payload.get("source_code", ""),
                    )
                    self._send_json(
                        HTTPStatus.CREATED,
                        {
                            "message": "Đã tạo phiếu trả nhà cung cấp.",
                            "receipt": receipt,
                            "summary": store.get_summary(),
                        },
                    )
                    return

                self._send_json(HTTPStatus.NOT_FOUND, {"error": "Không tìm thấy API."})
            except ValueError as exc:
                self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})

        def do_PUT(self) -> None:
            if self._is_login_enabled() and not self._require_authenticated_session():
                return
            if urlparse(self.path).path == "/api/state":
                try:
                    payload = self._read_json_body()
                    payload["actor"] = payload.get("actor") or self._get_current_actor_name()
                    self._log_sync_debug("PUT /api/state received", payload)
                    sync_state = store.save_sync_state(payload)
                    self._log_sync_debug("PUT /api/state saved", payload)
                    self._send_json(
                        HTTPStatus.OK,
                        {
                            "message": "Đã lưu dữ liệu đồng bộ.",
                            "app": self._get_app_info(),
                            "debug": self._get_debug_info(),
                            "pagination": self._get_pagination_info(),
                            "runtime_version": store.get_runtime_version(),
                            **sync_state,
                        },
                    )
                except SyncConflictError as exc:
                    self._log_sync_debug(f"PUT /api/state conflict: {exc}", payload if 'payload' in locals() else None)
                    self._send_json(
                        HTTPStatus.CONFLICT,
                        {
                            "error": str(exc),
                            "conflict": {
                                "state_key": exc.state_key,
                                "expected_updated_at": exc.expected_updated_at,
                                "actual_updated_at": exc.actual_updated_at,
                            },
                        },
                    )
                except ValueError as exc:
                    self._log_sync_debug(f"PUT /api/state bad-request: {exc}", payload if 'payload' in locals() else None)
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
                    product = store.update_product_price(
                        match.group(1),
                        payload.get("price", 0),
                        actor=payload.get("actor") or self._get_current_actor_name(),
                    )
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
                    product = store.update_product_sale_price(
                        match.group(1),
                        payload.get("sale_price", 0),
                        actor=payload.get("actor") or self._get_current_actor_name(),
                    )
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
            if self._is_login_enabled() and not self._require_authenticated_session():
                return
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

        @staticmethod
        def _master_csv_columns(entity_type: str) -> list[str]:
            if entity_type == "products":
                return [
                    "name",
                    "category",
                    "unit",
                    "price",
                    "sale_price",
                    "low_stock_threshold",
                ]
            if entity_type == "customers":
                return [
                    "id",
                    "name",
                    "phone",
                    "address",
                    "zaloUrl",
                    "createdAt",
                    "updatedAt",
                    "deletedAt",
                ]
            if entity_type == "suppliers":
                return [
                    "id",
                    "name",
                    "phone",
                    "address",
                    "note",
                    "createdAt",
                    "updatedAt",
                    "deletedAt",
                ]
            raise ValueError("Loại dữ liệu master không hợp lệ.")

        @classmethod
        def _build_master_csv_bytes(cls, entity_type: str, records: list[dict]) -> bytes:
            output = io.StringIO()
            columns = cls._master_csv_columns(entity_type)
            writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore")
            writer.writeheader()
            for record in records:
                row = {
                    key: "" if record.get(key) is None else str(record.get(key))
                    for key in columns
                }
                writer.writerow(row)
            return output.getvalue().encode("utf-8-sig")

        @staticmethod
        def _parse_csv_float(value: str, field_name: str, default: float | None = None) -> float | None:
            cleaned = str(value or "").strip()
            if not cleaned:
                return default
            try:
                return float(cleaned)
            except ValueError as exc:
                raise ValueError(f"Giá trị số không hợp lệ ở cột '{field_name}': {cleaned}") from exc

        @classmethod
        def _parse_master_csv_records(cls, entity_type: str, raw_csv: str) -> list[dict]:
            raw_text = str(raw_csv or "").lstrip("\ufeff").strip()
            if not raw_text:
                raise ValueError("File CSV import đang trống.")

            try:
                reader = csv.DictReader(io.StringIO(raw_text))
            except csv.Error as exc:
                raise ValueError("Không đọc được định dạng CSV.") from exc

            if not reader.fieldnames:
                raise ValueError("File CSV thiếu dòng tiêu đề (header).")
            normalized_headers = {str(field or "").strip() for field in reader.fieldnames if field}
            required_headers = set(cls._master_csv_columns(entity_type))
            missing_headers = sorted(required_headers - normalized_headers)
            if missing_headers:
                raise ValueError(
                    "File CSV không đúng mẫu cho dữ liệu "
                    f"{entity_type}. Thiếu cột: {', '.join(missing_headers)}."
                )

            records: list[dict] = []
            for row in reader:
                data = {str(key or "").strip(): str(value or "").strip() for key, value in row.items() if key}
                if not any(data.values()):
                    continue
                if entity_type == "products":
                    price = cls._parse_csv_float(data.get("price", ""), "price", 0)
                    threshold = cls._parse_csv_float(data.get("low_stock_threshold", ""), "low_stock_threshold", 5)
                    records.append(
                        {
                            "name": data.get("name", ""),
                            "category": data.get("category", ""),
                            "unit": data.get("unit", ""),
                            "price": 0 if price is None else price,
                            "sale_price": cls._parse_csv_float(data.get("sale_price", ""), "sale_price", None),
                            "low_stock_threshold": 5 if threshold is None else threshold,
                        }
                    )
                    continue

                base_record = {
                    "id": data.get("id", ""),
                    "name": data.get("name", ""),
                    "phone": data.get("phone", ""),
                    "address": data.get("address", ""),
                    "createdAt": data.get("createdAt", ""),
                    "updatedAt": data.get("updatedAt", ""),
                    "deletedAt": data.get("deletedAt", "") or None,
                }
                if entity_type == "customers":
                    base_record["zaloUrl"] = data.get("zaloUrl", "")
                else:
                    base_record["note"] = data.get("note", "")
                records.append(base_record)

            return records

        @staticmethod
        def _validate_import_entity_match(import_entity_type: str, payload: dict) -> None:
            source_entity_type = str(payload.get("entity_type") or "").strip().lower()
            if source_entity_type and source_entity_type != import_entity_type:
                raise ValueError(
                    "File import không đúng loại dữ liệu. "
                    f"Bạn đang import '{source_entity_type}' vào '{import_entity_type}'."
                )

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

        @staticmethod
        def _is_login_enabled() -> bool:
            return auth_enabled

        def _get_session_token(self) -> str | None:
            cookies = parse_cookie_header(self.headers.get("Cookie"))
            return cookies.get(ADMIN_SESSION_COOKIE)

        def _get_current_session(self) -> dict | None:
            return admin_sessions.get_session(self._get_session_token())

        def _get_current_username(self) -> str | None:
            return admin_sessions.get_username(self._get_session_token())

        def _get_current_role(self) -> str:
            return str(admin_sessions.get_role(self._get_session_token()) or "")

        def _get_current_actor_name(self) -> str:
            return self._get_current_username() or "Nhân viên"

        def _get_session_status_payload(self, session_token: str | None = None) -> dict:
            token = session_token if session_token is not None else self._get_session_token()
            session = admin_sessions.get_session(token)
            username = str(session.get("username") or "") if session else ""
            role = str(session.get("role") or "") if session else ""
            return {
                "authenticated": bool(session),
                "username": username,
                "role": role,
                "is_admin": role == "admin",
                "enable_login": auth_enabled,
                "session_started_at": str(session.get("started_at") or "") if session else "",
                "timeout_minutes": admin_session_timeout_minutes if role == "admin" else session_timeout_minutes,
                "app": self._get_app_info(),
                "debug": self._get_debug_info(),
                "pagination": self._get_pagination_info(),
            }

        def _require_authenticated_session(self) -> bool:
            if self._get_current_session():
                return True
            self._send_json(HTTPStatus.UNAUTHORIZED, {"error": "Cần đăng nhập hệ thống."})
            return False

        def _require_admin(self) -> bool:
            if admin_sessions.is_admin(self._get_session_token()):
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
