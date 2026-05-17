import base64
import csv
import html
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

from .auth import build_port_scoped_cookie_name, build_session_cookie_name_candidates, parse_cookie_header
from .constants import ADMIN_SESSION_COOKIE, APP_NAME, JS_ASSET_VERSIONS_PATH, STATIC_DIR
from .js_asset_versions import JavaScriptAssetVersionManager
from .store import ProcurementBatchStartConflictError, SyncConflictError


def create_handler(store, admin_sessions, system_config: dict | None = None):
    debug_config = (system_config or {}).get("debug", {})
    pagination_config = (system_config or {}).get("pagination", {})
    procurement_config = (system_config or {}).get("procurement", {})
    auth_enabled = bool((system_config or {}).get("EnableLogin"))
    app_version = str((system_config or {}).get("version") or "").strip() or "2.3.1"
    asset_versions_path = Path((system_config or {}).get("asset_versions_path") or JS_ASSET_VERSIONS_PATH)
    js_asset_versions = JavaScriptAssetVersionManager(
        static_root=STATIC_DIR,
        manifest_path=asset_versions_path,
        app_version=app_version,
    )
    js_asset_versions.refresh_all()
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
        def _get_procurement_public_config() -> dict:
            return {
                "batch_planner_enabled": bool(procurement_config.get("batch_planner_enabled", True)),
                "allow_daily_quick_shortage_flow": bool(
                    procurement_config.get("allow_daily_quick_shortage_flow", True)
                ),
                "required_login_for_batch_mode": bool(
                    procurement_config.get("required_login_for_batch_mode", True)
                ),
            }

        @staticmethod
        def _get_procurement_lock_timeout_minutes() -> int:
            try:
                return max(1, int(procurement_config.get("batch_lock_timeout_minutes", 180)))
            except (TypeError, ValueError):
                return 180

        @staticmethod
        def _procurement_requires_login() -> bool:
            return bool(procurement_config.get("required_login_for_batch_mode", True))

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

        @staticmethod
        def _normalize_route_path(raw_path: str) -> str:
            parsed_path = urlparse(raw_path).path or "/"
            if parsed_path == "/":
                return "/"
            if parsed_path.endswith("/favicon.ico"):
                return "/favicon.ico"
            for marker in ("/static/", "/api/"):
                marker_index = parsed_path.find(marker)
                if marker_index >= 0:
                    return parsed_path[marker_index:]
            last_segment = parsed_path.rsplit("/", 1)[-1]
            if not last_segment or "." not in last_segment:
                return "/"
            return parsed_path

        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            route = self._normalize_route_path(parsed.path)

            if route == "/":
                self._serve_static_file("index.html", request_path=parsed.path)
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

            if route.startswith("/api/") and self._is_login_enabled():
                session, expired = self._resolve_current_session()
                if not session:
                    self._send_json(
                        HTTPStatus.UNAUTHORIZED,
                        self._build_auth_required_payload(session_expired=expired),
                    )
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
                        "procurement": self._build_procurement_status_payload(),
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

            if route == "/api/procurement/status":
                self._send_json(HTTPStatus.OK, self._build_procurement_status_payload())
                return

            if route == "/api/procurement/planner":
                query = parse_qs(parsed.query)
                try:
                    planner = store.get_procurement_planner(
                        scope_type=query.get("scope", ["all"])[0],
                        scope_code=query.get("scope_code", query.get("cart_id", query.get("product_id", [""])))[0],
                        lock_timeout_minutes=self._get_procurement_lock_timeout_minutes(),
                    )
                    self._send_json(
                        HTTPStatus.OK,
                        {
                            **planner,
                            "config": self._get_procurement_public_config(),
                            "permissions": self._get_procurement_permission_payload(),
                        },
                    )
                except ValueError as exc:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
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

                if route == "/api/admin/legacy-audit":
                    self._send_json(
                        HTTPStatus.OK,
                        store.get_legacy_data_audit(),
                    )
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
            route = self._normalize_route_path(self.path)
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
                        extra_headers=self._build_session_cookie_headers(session_data["token"]),
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
                    extra_headers=self._build_logout_cookie_headers(),
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
                        extra_headers=self._build_session_cookie_headers(session_data["token"]),
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
                    extra_headers=self._build_logout_cookie_headers(),
                )
                return

            if route.startswith("/api/") and self._is_login_enabled() and not self._require_authenticated_session():
                return

            if route.startswith("/api/admin/"):
                if not self._require_admin():
                    return

                if route == "/api/admin/legacy-audit/apply-safe-fixes":
                    result = store.apply_safe_legacy_fixes(
                        actor=self._get_current_actor_name(),
                    )
                    self._send_json(
                        HTTPStatus.OK,
                        {
                            "message": result["message"],
                            "counts": result["counts"],
                            "audit": result["audit"],
                        },
                    )
                    return

                if route == "/api/admin/legacy-audit/link-purchase-receipt":
                    try:
                        payload = self._read_json_body()
                        result = store.attach_purchase_receipt_code(
                            payload.get("purchase_id", ""),
                            payload.get("receipt_code", ""),
                            actor=self._get_current_actor_name(),
                        )
                        self._send_json(
                            HTTPStatus.OK,
                            {
                                "message": result["message"],
                                "purchase": result["purchase"],
                                "purchases": result["purchases"],
                                "audit": result["audit"],
                                "summary": store.get_summary(),
                            },
                        )
                    except ValueError as exc:
                        self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                    return

                if route == "/api/admin/legacy-audit/link-purchase-source":
                    try:
                        payload = self._read_json_body()
                        result = store.attach_purchase_source_cart(
                            payload.get("purchase_id", ""),
                            payload.get("cart_id", ""),
                            actor=self._get_current_actor_name(),
                        )
                        self._send_json(
                            HTTPStatus.OK,
                            {
                                "message": result["message"],
                                "purchase": result["purchase"],
                                "purchases": result["purchases"],
                                "audit": result["audit"],
                                "summary": store.get_summary(),
                            },
                        )
                    except ValueError as exc:
                        self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
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
                        result = store.import_master_data(
                            import_entity_type,
                            records,
                            actor=self._get_current_actor_name(),
                        )
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

            if route.startswith("/api/procurement/"):
                if not self._require_procurement_manager():
                    return
                try:
                    payload = self._read_json_body()
                except ValueError as exc:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                    return

                try:
                    if route == "/api/procurement/batch/start":
                        try:
                            result = store.start_procurement_batch(
                                username=self._get_current_username() or "",
                                role=self._get_current_role(),
                                lock_timeout_minutes=self._get_procurement_lock_timeout_minutes(),
                            )
                        except ProcurementBatchStartConflictError as exc:
                            self._send_json(
                                HTTPStatus.BAD_REQUEST,
                                {
                                    "error": str(exc),
                                    "code": "procurement_batch_start_conflicts",
                                    "conflicts": exc.conflicts,
                                },
                            )
                            return
                        self._send_json(
                            HTTPStatus.OK,
                            {
                                "message": "Đã bắt đầu kỳ gom nhập.",
                                **self._build_procurement_status_payload(status_override=result),
                            },
                        )
                        return

                    if route == "/api/procurement/batch/finish":
                        result = store.finish_procurement_batch(
                            username=self._get_current_username() or "",
                            role=self._get_current_role(),
                        )
                        self._send_json(
                            HTTPStatus.OK,
                            {
                                "message": "Đã kết thúc kỳ gom nhập.",
                                **self._build_procurement_status_payload(status_override=result),
                            },
                        )
                        return

                    if route == "/api/procurement/batch/refresh-lock":
                        result = store.refresh_procurement_batch_lock(
                            username=self._get_current_username() or "",
                            role=self._get_current_role(),
                            lock_timeout_minutes=self._get_procurement_lock_timeout_minutes(),
                        )
                        self._send_json(
                            HTTPStatus.OK,
                            {
                                "message": "Đã gia hạn khóa kỳ gom nhập.",
                                **self._build_procurement_status_payload(status_override=result),
                            },
                        )
                        return

                    if route == "/api/procurement/purchases/create-draft":
                        result = store.create_procurement_purchase_for_product(
                            product_id=int(payload.get("product_id", 0)),
                            quantity=payload.get("quantity", 0),
                            supplier_name=payload.get("supplier_name", ""),
                            actor=self._get_current_username() or "",
                            role=self._get_current_role(),
                            scope_type=payload.get("scope_type", "all"),
                            scope_code=payload.get("scope_code", ""),
                        )
                        self._send_json(
                            HTTPStatus.CREATED,
                            {
                                "message": "Đã tạo phiếu nhập từ kỳ gom nhập.",
                                "purchase": result["purchase"],
                                "purchases": result["purchases"],
                                "planner": result["planner"],
                                "summary": store.get_summary(),
                            },
                        )
                        return

                    if route == "/api/procurement/purchases/create-drafts":
                        result = store.create_procurement_purchases(
                            lines=payload.get("lines", []),
                            actor=self._get_current_username() or "",
                            role=self._get_current_role(),
                            scope_type=payload.get("scope_type", "all"),
                            scope_code=payload.get("scope_code", ""),
                        )
                        created_count = len(result.get("created_purchases") or [])
                        self._send_json(
                            HTTPStatus.CREATED,
                            {
                                "message": f"Đã tạo/cập nhật {created_count} phiếu nhập từ kỳ gom nhập.",
                                "created_purchases": result["created_purchases"],
                                "created_purchase_ids": result["created_purchase_ids"],
                                "skipped": result["skipped"],
                                "purchases": result["purchases"],
                                "planner": result["planner"],
                                "summary": store.get_summary(),
                            },
                        )
                        return

                    self._send_json(HTTPStatus.NOT_FOUND, {"error": "Không tìm thấy API."})
                except (TypeError, ValueError) as exc:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                return

            restore_match = re.fullmatch(r"/api/products/(\d+)/restore", route)
            if restore_match:
                try:
                    product = store.restore_product(
                        restore_match.group(1),
                        actor=self._get_current_actor_name(),
                    )
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
                if route == "/api/products":
                    product = store.create_product(
                        name=payload.get("name"),
                        category=payload.get("category"),
                        unit=payload.get("unit"),
                        price=payload.get("price", 0),
                        sale_price=payload.get("sale_price"),
                        low_stock_threshold=payload.get("low_stock_threshold", 5),
                        shelf_life_days=payload.get("shelf_life_days"),
                        storage_life_days=payload.get("storage_life_days"),
                        actor=self._get_current_actor_name(),
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

                if route == "/api/transactions":
                    if not self._require_admin():
                        return
                    transaction = store.create_transaction(
                        product_id=int(payload.get("product_id", 0)),
                        transaction_type=payload.get("transaction_type"),
                        quantity=payload.get("quantity"),
                        note=payload.get("note", ""),
                        adjustment_reason=payload.get("adjustment_reason", ""),
                        actor=self._get_current_username() or "",
                        batch_code=payload.get("batch_code", ""),
                        expiry_date=payload.get("expiry_date"),
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

                if route == "/api/orders/checkout":
                    order = store.create_checkout_order(
                        customer_name=payload.get("customer_name"),
                        items=payload.get("items", []),
                        note=payload.get("note", ""),
                        discount_amount=payload.get("discount_amount", 0),
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

                if route == "/api/orders/commit":
                    result = store.commit_cart_order(
                        payload.get("cart_id", ""),
                        actor=self._get_current_username() or "",
                    )
                    self._send_json(
                        HTTPStatus.OK,
                        {
                            "message": "Đã chốt đơn.",
                            "cart": result["cart"],
                            "order": {
                                "order_code": result["order_code"],
                                "committed_at": result["committed_at"],
                            },
                            "summary": store.get_summary(),
                        },
                    )
                    return

                if route == "/api/orders/ship":
                    result = store.ship_cart_order(
                        payload.get("cart_id", ""),
                        actor=self._get_current_username() or "",
                    )
                    self._send_json(
                        HTTPStatus.OK,
                        {
                            "message": "Đã xuất hàng.",
                            "cart": result["cart"],
                            "order": result["order"],
                            "summary": store.get_summary(),
                        },
                    )
                    return

                if route == "/api/purchases/receive":
                    clean_supplier_name = str(payload.get("supplier_name", "")).strip()
                    if not clean_supplier_name:
                        raise ValueError("Phiếu nhập phải có nhà cung cấp trước khi nhập kho.")
                    receipt = store.create_purchase_receipt(
                        items=payload.get("items", []),
                        note=payload.get("note", ""),
                        supplier_name=clean_supplier_name,
                        discount_amount=payload.get("discount_amount", 0),
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

                if route == "/api/purchases/received-item-expiry":
                    result = store.update_received_purchase_item_expiry(
                        payload.get("purchase_id", ""),
                        payload.get("purchase_item_id", ""),
                        expiry_input_mode=payload.get("expiry_input_mode", "direct"),
                        manufacture_date=payload.get("manufacture_date"),
                        expiry_date=payload.get("expiry_date"),
                        expected_updated_at=payload.get("expected_updated_at", ""),
                        actor=self._get_current_username() or "",
                    )
                    self._send_json(
                        HTTPStatus.OK,
                        {
                            "message": "Đã cập nhật hạn dùng của dòng nhập hàng.",
                            "purchase": result["purchase"],
                            "item": result["item"],
                            "purchases": result["purchases"],
                            "summary": store.get_summary(),
                        },
                    )
                    return

                if route == "/api/purchases/repair":
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

                if route == "/api/adjustments/inventory":
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

                if route == "/api/returns/customers":
                    receipt = store.create_customer_return_receipt(
                        customer_name=payload.get("customer_name", ""),
                        items=payload.get("items", []),
                        note=payload.get("note", ""),
                        source_type=payload.get("source_type", ""),
                        source_code=payload.get("source_code", ""),
                        actor=self._get_current_actor_name(),
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

                if route == "/api/returns/suppliers":
                    receipt = store.create_supplier_return_receipt(
                        supplier_name=payload.get("supplier_name", ""),
                        items=payload.get("items", []),
                        note=payload.get("note", ""),
                        source_type=payload.get("source_type", ""),
                        source_code=payload.get("source_code", ""),
                        actor=self._get_current_actor_name(),
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
            route = self._normalize_route_path(self.path)
            if self._is_login_enabled() and not self._require_authenticated_session():
                return
            if route == "/api/state":
                try:
                    payload = self._read_json_body()
                    payload["actor"] = payload.get("actor") or self._get_current_actor_name()
                    self._log_sync_debug("PUT /api/state received", payload)
                    sync_state = store.save_sync_state(
                        payload,
                        actor_username=self._get_current_username() or "",
                        actor_role=self._get_current_role(),
                    )
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

            product_match = re.fullmatch(r"/api/products/(\d+)$", route)
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
                        shelf_life_days=payload.get("shelf_life_days"),
                        storage_life_days=payload.get("storage_life_days"),
                        actor=payload.get("actor") or self._get_current_actor_name(),
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

            match = re.fullmatch(r"/api/products/(\d+)/price", route)
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

            match = re.fullmatch(r"/api/products/(\d+)/sale-price", route)
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
            route = self._normalize_route_path(self.path)
            if self._is_login_enabled() and not self._require_authenticated_session():
                return
            match = re.fullmatch(r"/api/products/(\d+)$", route)
            if not match:
                self._send_json(HTTPStatus.NOT_FOUND, {"error": "Không tìm thấy API."})
                return

            try:
                deleted = store.delete_product(
                    match.group(1),
                    actor=self._get_current_actor_name(),
                )
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
                    "shelf_life_days",
                    "storage_life_days",
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
            if entity_type == "products":
                required_headers = {
                    "name",
                    "category",
                    "unit",
                    "price",
                    "sale_price",
                    "low_stock_threshold",
                }
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
                    shelf_life_days = cls._parse_csv_float(data.get("shelf_life_days", ""), "shelf_life_days", None)
                    storage_life_days = cls._parse_csv_float(data.get("storage_life_days", ""), "storage_life_days", None)
                    records.append(
                        {
                            "name": data.get("name", ""),
                            "category": data.get("category", ""),
                            "unit": data.get("unit", ""),
                            "price": 0 if price is None else price,
                            "sale_price": cls._parse_csv_float(data.get("sale_price", ""), "sale_price", None),
                            "low_stock_threshold": 5 if threshold is None else threshold,
                            "shelf_life_days": shelf_life_days,
                            "storage_life_days": storage_life_days,
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

        @staticmethod
        def _build_request_base_href(request_path: str | None) -> str | None:
            parsed_path = urlparse(request_path or "/").path or "/"
            if parsed_path == "/":
                return None
            if parsed_path.endswith("/"):
                return parsed_path
            return f"{parsed_path}/"

        @staticmethod
        def _inject_html_base_href(html_text: str, base_href: str | None) -> str:
            if not base_href:
                return re.sub(r"\s*<base\b[^>]*>", "", html_text, count=1, flags=re.IGNORECASE)
            escaped_base_href = html.escape(base_href, quote=True)
            base_tag = f'<base href="{escaped_base_href}">'
            if re.search(r"<base\b", html_text, flags=re.IGNORECASE):
                return re.sub(r"<base\b[^>]*>", base_tag, html_text, count=1, flags=re.IGNORECASE)
            return re.sub(r"(<head[^>]*>)", rf"\1\n  {base_tag}", html_text, count=1, flags=re.IGNORECASE)

        def _serve_static_file(self, relative_path: str, request_path: str | None = None) -> None:
            safe_path = (STATIC_DIR / relative_path).resolve()
            static_root = STATIC_DIR.resolve()
            if not safe_path.is_file() or (static_root not in safe_path.parents and safe_path != static_root):
                self._send_json(HTTPStatus.NOT_FOUND, {"error": "Không tìm thấy file."})
                return

            content_type, _ = mimetypes.guess_type(safe_path.name)
            payload = safe_path.read_bytes()
            cache_control = "public, max-age=3600"
            if safe_path.suffix == ".html":
                html_text = payload.decode("utf-8")
                html_text = self._inject_html_base_href(
                    html_text,
                    self._build_request_base_href(request_path),
                )
                payload = js_asset_versions.inject_index_versions(html_text).encode("utf-8")
                content_type = "text/html; charset=utf-8"
                cache_control = "no-cache, must-revalidate"
            elif safe_path.suffix == ".js":
                source_text = payload.decode("utf-8")
                relative_js_path = safe_path.relative_to(static_root).as_posix()
                payload = js_asset_versions.rewrite_module_imports(relative_js_path, source_text).encode("utf-8")
                content_type = "application/javascript; charset=utf-8"
                cache_control = "no-cache, must-revalidate"
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", content_type or "application/octet-stream")
            self.send_header("Cache-Control", cache_control)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        @staticmethod
        def _is_login_enabled() -> bool:
            return auth_enabled

        def _should_touch_session(self) -> bool:
            return str(self.headers.get("X-Session-Activity") or "").strip().lower() != "passive"

        def _get_session_cookie_name(self) -> str:
            return build_port_scoped_cookie_name(
                ADMIN_SESSION_COOKIE,
                self.headers.get("Host"),
            )

        def _get_session_token(self) -> str | None:
            cookies = parse_cookie_header(self.headers.get("Cookie"))
            for cookie_name in build_session_cookie_name_candidates(
                ADMIN_SESSION_COOKIE,
                self.headers.get("Host"),
            ):
                token = cookies.get(cookie_name)
                if token:
                    return token
            return None

        def _resolve_current_session(self, *, touch: bool | None = None) -> tuple[dict | None, bool]:
            return admin_sessions.resolve_session(
                self._get_session_token(),
                touch=self._should_touch_session() if touch is None else touch,
            )

        def _get_current_session(self, *, touch: bool | None = None) -> dict | None:
            session, _ = self._resolve_current_session(touch=touch)
            return session

        def _get_current_username(self) -> str | None:
            session = self._get_current_session(touch=False)
            return str(session.get("username") or "") if session else None

        def _get_current_role(self) -> str:
            session = self._get_current_session(touch=False)
            return str(session.get("role") or "") if session else ""

        def _get_current_permissions(self) -> list[str]:
            session = self._get_current_session(touch=False)
            if not session:
                return []
            raw_permissions = session.get("permissions") or []
            if not isinstance(raw_permissions, list):
                return []
            return [
                str(permission or "").strip()
                for permission in raw_permissions
                if str(permission or "").strip()
            ]

        def _get_current_actor_name(self) -> str:
            return self._get_current_username() or "Nhân viên"

        def _has_procurement_manage_permission(self) -> bool:
            if self._get_current_role() == "admin":
                return True
            username = self._get_current_username() or ""
            manager_usernames = procurement_config.get("planner_manager_usernames", [])
            if isinstance(manager_usernames, list) and username in {str(entry or "").strip() for entry in manager_usernames}:
                return True
            return "procurement_batch_manage" in set(self._get_current_permissions())

        def _get_procurement_permission_payload(self) -> dict:
            return {
                "can_manage_batch": self._has_procurement_manage_permission(),
                "is_lock_owner": self._is_current_procurement_lock_owner(),
            }

        def _build_procurement_status_payload(self, status_override: dict | None = None) -> dict:
            status = status_override or store.get_procurement_status(
                lock_timeout_minutes=self._get_procurement_lock_timeout_minutes(),
            )
            return {
                **status,
                "config": self._get_procurement_public_config(),
                "permissions": self._get_procurement_permission_payload(),
            }

        def _is_current_procurement_lock_owner(self) -> bool:
            username = self._get_current_username() or ""
            if not username:
                return False
            status = store.get_procurement_status(
                lock_timeout_minutes=self._get_procurement_lock_timeout_minutes(),
            )
            lock = status.get("lock") or {}
            return str(lock.get("owner_username") or "") == username

        def _get_session_status_payload(self, session_token: str | None = None) -> dict:
            token = session_token if session_token is not None else self._get_session_token()
            session = admin_sessions.get_session(token, touch=False)
            username = str(session.get("username") or "") if session else ""
            role = str(session.get("role") or "") if session else ""
            return {
                "authenticated": bool(session),
                "username": username,
                "role": role,
                "permissions": [
                    str(permission or "").strip()
                    for permission in ((session or {}).get("permissions") or [])
                    if str(permission or "").strip()
                ],
                "is_admin": role == "admin",
                "enable_login": auth_enabled,
                "session_started_at": str(session.get("started_at") or "") if session else "",
                "timeout_minutes": admin_session_timeout_minutes if role == "admin" else session_timeout_minutes,
                "app": self._get_app_info(),
                "debug": self._get_debug_info(),
                "pagination": self._get_pagination_info(),
            }

        @staticmethod
        def _build_auth_required_payload(*, session_expired: bool = False, admin_only: bool = False) -> dict:
            if session_expired:
                return {
                    "error": "Phiên đăng nhập đã hết hạn.",
                    "session_expired": True,
                }
            if admin_only:
                return {"error": "Cần đăng nhập Master Admin."}
            return {"error": "Cần đăng nhập hệ thống."}

        def _require_authenticated_session(self) -> bool:
            session, expired = self._resolve_current_session()
            if session:
                return True
            self._send_json(
                HTTPStatus.UNAUTHORIZED,
                self._build_auth_required_payload(session_expired=expired),
            )
            return False

        def _require_admin(self) -> bool:
            session, expired = self._resolve_current_session()
            if expired:
                self._send_json(
                    HTTPStatus.UNAUTHORIZED,
                    self._build_auth_required_payload(session_expired=True),
                )
                return False
            if session and str(session.get("role") or "") == "admin":
                return True
            self._send_json(
                HTTPStatus.UNAUTHORIZED,
                self._build_auth_required_payload(admin_only=True),
            )
            return False

        def _require_procurement_manager(self) -> bool:
            if self._procurement_requires_login() and self._is_login_enabled():
                session, expired = self._resolve_current_session()
                if expired:
                    self._send_json(
                        HTTPStatus.UNAUTHORIZED,
                        self._build_auth_required_payload(session_expired=True),
                    )
                    return False
                if not session:
                    self._send_json(HTTPStatus.UNAUTHORIZED, self._build_auth_required_payload())
                    return False
            if self._procurement_requires_login() and not self._is_login_enabled():
                self._send_json(
                    HTTPStatus.BAD_REQUEST,
                    {"error": "Batch mode cần bật EnableLogin để xác định người giữ khóa."},
                )
                return False
            if self._has_procurement_manage_permission():
                return True
            self._send_json(
                HTTPStatus.UNAUTHORIZED,
                {"error": "Tài khoản này không có quyền xử lý kỳ gom nhập."},
            )
            return False

        def _build_cookie_header(self, cookie_name: str, cookie_value: str, *, max_age: int | None = None) -> str:
            header = f"{cookie_name}={cookie_value}; Path=/; HttpOnly; SameSite=Lax"
            if max_age is not None:
                header += f"; Max-Age={max_age}"
            return header

        def _build_session_cookie_headers(self, token: str) -> list[tuple[str, str]]:
            cookie_name = self._get_session_cookie_name()
            headers = [("Set-Cookie", self._build_cookie_header(cookie_name, token))]
            if cookie_name != ADMIN_SESSION_COOKIE:
                headers.append(("Set-Cookie", self._build_cookie_header(ADMIN_SESSION_COOKIE, "", max_age=0)))
            return headers

        def _build_logout_cookie_headers(self) -> list[tuple[str, str]]:
            headers: list[tuple[str, str]] = []
            for cookie_name in build_session_cookie_name_candidates(
                ADMIN_SESSION_COOKIE,
                self.headers.get("Host"),
            ):
                headers.append(("Set-Cookie", self._build_cookie_header(cookie_name, "", max_age=0)))
            return headers

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
