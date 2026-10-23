"""Flask application factory for the staged HTTP migration."""

from __future__ import annotations

import hashlib
import csv
import io
import json
import mimetypes
import uuid
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path

from flask import Flask, Response, current_app, jsonify, request, send_file
from werkzeug.exceptions import HTTPException

from .auth import (
    AdminSessionManager,
    build_port_scoped_cookie_name,
    build_session_cookie_name_candidates,
)
from .config import load_system_config
from .constants import ADMIN_SESSION_COOKIE, APP_ENV, APP_NAME, CONFIG_PATH, DATA_DIR, STATIC_DIR
from .helpers import get_product_min_unit, resize_image_bytes
from .js_asset_versions import JavaScriptAssetVersionManager
from .logger import log_error
from .lunar_calendar import (
    PREORDER_REMINDER_WINDOW_DAYS,
    next_preorder_lunar_date,
    solar_to_vietnamese_lunar,
)
from .mailer import send_mail_notification
from .store import BulkOrderRequestDuplicateError, InventoryStore, SyncConflictError


LONG_LIVED_CACHE = "public, max-age=31536000, immutable"
SHORT_LIVED_CACHE = "public, max-age=3600"
REVALIDATED_CACHE = "no-cache, must-revalidate"


def _public_mail_config(mail_config: dict | None) -> dict:
    config = mail_config if isinstance(mail_config, dict) else {}
    return {
        "enabled": bool(config.get("enabled")),
        "smtp_host": str(config.get("smtp_host") or ""),
        "smtp_port": int(config.get("smtp_port") or 587),
        "username": str(config.get("username") or ""),
        "has_password": bool(config.get("password")),
        "from_email": str(config.get("from_email") or ""),
        "to_emails": [
            str(email or "").strip()
            for email in (config.get("to_emails") or [])
            if str(email or "").strip()
        ],
        "use_tls": bool(config.get("use_tls")),
        "use_ssl": bool(config.get("use_ssl")),
        "subject_prefix": str(config.get("subject_prefix") or ""),
    }


def _master_csv_columns(entity_type: str) -> list[str]:
    if entity_type == "products":
        return [
            "id", "global_id", "name", "category", "unit", "price", "sale_price",
            "low_stock_threshold", "shelf_life_days", "storage_life_days", "images",
            "details", "recipe", "note", "is_public", "is_deleted", "deleted_at",
            "created_at", "updated_at",
        ]
    if entity_type == "customers":
        return ["id", "name", "phone", "address", "zaloUrl", "createdAt", "updatedAt", "deletedAt"]
    if entity_type == "suppliers":
        return ["id", "name", "phone", "address", "note", "createdAt", "updatedAt", "deletedAt"]
    raise ValueError("Loại dữ liệu master không hợp lệ.")


def _build_master_csv_bytes(entity_type: str, records: list[dict]) -> bytes:
    output = io.StringIO()
    columns = _master_csv_columns(entity_type)
    writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    for record in records:
        row = {}
        for key in columns:
            value = record.get(key)
            if value is None:
                row[key] = ""
            elif key == "images" and isinstance(value, list):
                row[key] = json.dumps(value, ensure_ascii=False)
            else:
                row[key] = str(value)
        writer.writerow(row)
    return output.getvalue().encode("utf-8-sig")


def create_app(
    *,
    database_path: str | Path,
    system_config: dict | None = None,
    testing: bool = False,
    store: InventoryStore | None = None,
    admin_sessions: AdminSessionManager | None = None,
) -> Flask:
    """Build an isolated Flask app; callers must choose the database explicitly."""
    if database_path is None or not str(database_path).strip():
        raise ValueError("database_path is required; Flask must not select a runtime DB implicitly.")
    if system_config is None:
        if testing:
            raise ValueError("Testing apps must receive an explicit system_config.")
        # Runtime selection follows APP_ENV via CONFIG_PATH; no config is read at import time.
        system_config = load_system_config(CONFIG_PATH)
    if not isinstance(system_config, dict):
        raise ValueError("system_config must be supplied explicitly.")

    resolved_db_path = Path(database_path).expanduser().resolve()
    if testing and resolved_db_path.is_relative_to(DATA_DIR.resolve()):
        raise ValueError("Testing apps must not use a database under the runtime data directory.")

    config = deepcopy(system_config)
    admin_path = str(config.get("admin_path") or "/admin").strip()
    admin_path = "/" + admin_path.strip("/")
    if admin_path == "/":
        raise ValueError("admin_path must not overlap the public root route.")
    config["admin_path"] = admin_path

    asset_manifest = Path(
        config.get("asset_versions_path") or (DATA_DIR / "js_asset_versions.json")
    ).expanduser().resolve()
    if testing and asset_manifest.is_relative_to(DATA_DIR.resolve()):
        raise ValueError("Testing apps must use a temporary JavaScript asset manifest.")

    configured_runtime_config = config.get("config_path")
    if testing and configured_runtime_config:
        resolved_config_path = Path(configured_runtime_config).expanduser().resolve()
        if resolved_config_path.is_relative_to(DATA_DIR.resolve()):
            raise ValueError("Testing apps cannot read or write runtime system config files.")

    image_root = Path(config.get("image_root") or (DATA_DIR / "images")).expanduser().resolve()
    if testing and image_root.is_relative_to(DATA_DIR.resolve()):
        raise ValueError("Testing apps must use a temporary image directory.")

    app = Flask(__name__, static_folder=None)
    app.config.update(
        TESTING=bool(testing),
        DATABASE_PATH=str(resolved_db_path),
        SYSTEM_CONFIG=config,
        STATIC_ROOT=str(STATIC_DIR.resolve()),
        IMAGE_ROOT=str(image_root),
        ASSET_VERSIONS_PATH=str(asset_manifest),
    )

    resolved_store = store if store is not None else InventoryStore(resolved_db_path)
    resolved_store.enable_multiuser_conflict_check = bool(
        config.get("EnableMultiuserConflictCheck", True)
    )
    resolved_sessions = admin_sessions
    if resolved_sessions is None:
        resolved_sessions = AdminSessionManager(
            str(config.get("admin", {}).get("username") or ""),
            str(config.get("admin", {}).get("password") or ""),
            users=config.get("users", []),
            user_timeout_minutes=config.get("session_timeout_minutes", 360),
            admin_timeout_minutes=config.get("admin_session_timeout_minutes", 30),
        )
    asset_versions = JavaScriptAssetVersionManager(
        static_root=Path(app.config["STATIC_ROOT"]),
        manifest_path=asset_manifest,
        app_version=str(config.get("version") or "3.38.0"),
    )
    asset_versions.refresh_all()

    app.extensions["qltpchay.store"] = resolved_store
    app.extensions["qltpchay.admin_sessions"] = resolved_sessions
    app.extensions["qltpchay.asset_versions"] = asset_versions

    @app.errorhandler(Exception)
    def handle_unexpected_error(error: Exception):
        if isinstance(error, HTTPException):
            return error
        log_error(
            f"Flask request failed: {request.method} {request.path}",
            exc_info=True,
        )
        return jsonify({"error": "Lỗi hệ thống nội bộ."}), 500

    def get_session_token() -> str | None:
        cookie_names = build_session_cookie_name_candidates(
            ADMIN_SESSION_COOKIE,
            request.host,
        )
        for cookie_name in cookie_names:
            token = request.cookies.get(cookie_name)
            if token:
                return token
        return None

    def require_authenticated_session() -> Response | tuple[Response, int] | None:
        # #Issue182: Match the legacy API login gate and preserve passive sync session behavior.
        if not current_app.config["SYSTEM_CONFIG"].get("EnableLogin"):
            return None
        should_touch = (
            str(request.headers.get("X-Session-Activity") or "").strip().lower()
            != "passive"
        )
        session, expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=should_touch,
        )
        if session:
            return None
        if expired:
            payload = {"error": "Phiên đăng nhập đã hết hạn.", "session_expired": True}
        else:
            payload = {"error": "Cần đăng nhập hệ thống."}
        return jsonify(payload), 401

    def require_admin_session() -> Response | tuple[Response, int] | None:
        # Issue #182: base-unit conversion is always restricted to Master Admin, matching legacy.
        should_touch = (
            str(request.headers.get("X-Session-Activity") or "").strip().lower()
            != "passive"
        )
        session, expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=should_touch,
        )
        if session and str(session.get("role") or "") == "admin":
            return None
        if expired:
            payload = {"error": "Phiên đăng nhập đã hết hạn.", "session_expired": True}
        else:
            payload = {"error": "Cần đăng nhập Master Admin."}
        return jsonify(payload), 401

    def require_inventory_adjust_session() -> Response | tuple[Response, int] | None:
        should_touch = (
            str(request.headers.get("X-Session-Activity") or "").strip().lower()
            != "passive"
        )
        session, expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=should_touch,
        )
        if expired:
            return jsonify({"error": "Phiên đăng nhập đã hết hạn.", "session_expired": True}), 401
        if not session:
            return jsonify({
                "error": "Cần đăng nhập tài khoản có quyền điều chỉnh tồn."
            }), 401
        permissions = {
            str(permission or "").strip()
            for permission in (session.get("permissions") or [])
            if str(permission or "").strip()
        }
        if str(session.get("role") or "") == "admin" or "inventory_adjust_manage" in permissions:
            return None
        return jsonify({"error": "Tài khoản này không có quyền điều chỉnh tồn trực tiếp."}), 401

    def require_named_permission(
        permission_name: str,
        error_message: str,
    ) -> Response | tuple[Response, int] | None:
        if not current_app.config["SYSTEM_CONFIG"].get("EnableLogin"):
            return None
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        permissions = {
            str(permission or "").strip()
            for permission in ((session or {}).get("permissions") or [])
            if str(permission or "").strip()
        }
        if str((session or {}).get("role") or "") == "admin" or permission_name in permissions:
            return None
        return jsonify({"error": error_message}), 401

    def require_document_cancel_approval() -> Response | tuple[Response, int] | None:
        if not current_app.config["SYSTEM_CONFIG"].get("EnableLogin"):
            return jsonify({
                "error": "Cần bật EnableLogin để dùng luồng hủy có phê duyệt."
            }), 400
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        permissions = {
            str(permission or "").strip()
            for permission in ((session or {}).get("permissions") or [])
            if str(permission or "").strip()
        }
        if (
            str((session or {}).get("role") or "") == "admin"
            or "document_cancel_approve" in permissions
        ):
            return None
        return jsonify({"error": "Tài khoản này không có quyền duyệt yêu cầu hủy chứng từ."}), 401

    def current_actor_name() -> str:
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        return str((session or {}).get("username") or "Nhân viên")

    def procurement_public_config() -> dict:
        procurement = current_app.config["SYSTEM_CONFIG"].get("procurement", {})
        return {
            "batch_planner_enabled": bool(procurement.get("batch_planner_enabled", True)),
            "allow_daily_quick_shortage_flow": bool(
                procurement.get("allow_daily_quick_shortage_flow", True)
            ),
            "required_login_for_batch_mode": bool(
                procurement.get("required_login_for_batch_mode", True)
            ),
        }

    def procurement_lock_timeout() -> int:
        procurement = current_app.config["SYSTEM_CONFIG"].get("procurement", {})
        try:
            return max(1, int(procurement.get("batch_lock_timeout_minutes", 180)))
        except (TypeError, ValueError):
            return 180

    def procurement_permission_payload(
        status: dict | None = None,
        *,
        include_lock_owner: bool = True,
    ) -> dict:
        config = current_app.config["SYSTEM_CONFIG"].get("procurement", {})
        store = current_app.extensions["qltpchay.store"]
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        username = str((session or {}).get("username") or "")
        role = str((session or {}).get("role") or "")
        permissions = {
            str(permission or "").strip()
            for permission in ((session or {}).get("permissions") or [])
            if str(permission or "").strip()
        }
        manager_usernames = config.get("planner_manager_usernames", [])
        can_manage = (
            role == "admin"
            or "procurement_batch_manage" in permissions
            or (
                isinstance(manager_usernames, list)
                and username in {str(entry or "").strip() for entry in manager_usernames}
            )
        )
        current_status = status
        if include_lock_owner and current_status is None:
            current_status = store.get_procurement_status(
                lock_timeout_minutes=procurement_lock_timeout(),
            )
        return {
            "can_manage_batch": can_manage,
            "is_lock_owner": bool(username)
            and include_lock_owner
            and str(((current_status or {}).get("lock") or {}).get("owner_username") or "") == username,
        }

    def procurement_status_payload() -> dict:
        store = current_app.extensions["qltpchay.store"]
        status = store.get_procurement_status(
            lock_timeout_minutes=procurement_lock_timeout(),
        )
        return {
            **status,
            "config": procurement_public_config(),
            "permissions": procurement_permission_payload(status),
        }

    def session_status_payload(session_token: str | None = None) -> dict:
        token = session_token if session_token is not None else get_session_token()
        session = current_app.extensions["qltpchay.admin_sessions"].get_session(
            token,
            touch=False,
        )
        config = current_app.config["SYSTEM_CONFIG"]
        role = str((session or {}).get("role") or "")

        def timeout_minutes(key: str, fallback: int) -> int:
            try:
                return max(1, int(config.get(key, fallback)))
            except (TypeError, ValueError):
                return fallback

        user_timeout = timeout_minutes("session_timeout_minutes", 360)
        admin_timeout = timeout_minutes("admin_session_timeout_minutes", 30)
        admin_path = str(config.get("admin_path", "/admin")).lower()
        if not admin_path.startswith("/"):
            admin_path = "/" + admin_path
        pagination = config.get("pagination", {})

        def page_size(key: str) -> int:
            try:
                return max(1, int(pagination.get(key, 10)))
            except (TypeError, ValueError):
                return 10

        return {
            "authenticated": bool(session),
            "username": str((session or {}).get("username") or ""),
            "role": role,
            "admin_path": admin_path,
            "permissions": [
                str(permission or "").strip()
                for permission in ((session or {}).get("permissions") or [])
                if str(permission or "").strip()
            ],
            "is_admin": role == "admin",
            "enable_login": bool(config.get("EnableLogin")),
            "enable_admin_locked_edit": bool(config.get("EnableAdminLockedEdit", False)),
            "session_started_at": str((session or {}).get("started_at") or ""),
            "timeout_minutes": admin_timeout if role == "admin" else user_timeout,
            "app": {"name": APP_NAME, "version": str(config.get("version") or "3.38.0")},
            "debug": {"sync_state": bool(config.get("debug", {}).get("sync_state"))},
            "pagination": {
                "items_per_page": page_size("items_per_page"),
                "documents_per_page": page_size("documents_per_page"),
            },
        }

    def add_login_cookies(response: Response, token: str, role: str) -> None:
        config = current_app.config["SYSTEM_CONFIG"]
        timeout = config.get("admin_session_timeout_minutes", 30) if role == "admin" else config.get("session_timeout_minutes", 360)
        try:
            max_age = max(1, int(timeout)) * 60
        except (TypeError, ValueError):
            max_age = (30 if role == "admin" else 360) * 60
        cookie_name = build_port_scoped_cookie_name(ADMIN_SESSION_COOKIE, request.host)
        response.headers.add(
            "Set-Cookie",
            f"{cookie_name}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={max_age}",
        )
        if cookie_name != ADMIN_SESSION_COOKIE:
            response.headers.add(
                "Set-Cookie",
                f"{ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
            )

    def clear_session_cookies(response: Response) -> None:
        for cookie_name in build_session_cookie_name_candidates(
            ADMIN_SESSION_COOKIE,
            request.host,
        ):
            response.headers.add(
                "Set-Cookie",
                f"{cookie_name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
            )

    def perform_login(*, require_admin: bool, message: str):
        payload = request.get_json(silent=True) or {}
        password = str(payload.get("password", "")).strip()
        sessions = current_app.extensions["qltpchay.admin_sessions"]
        try:
            account_type = str(payload.get("account_type", "") or payload.get("accountType", "")).strip()
            if require_admin:
                session = sessions.login(
                    str(payload.get("username", "")).strip(),
                    password,
                    require_admin=True,
                )
            elif account_type:
                session = sessions.login_by_account_type(account_type, password)
            else:
                session = sessions.login(str(payload.get("username", "")).strip(), password)
        except ValueError as error:
            return jsonify({"error": str(error)}), 401

        response = jsonify({
            "message": message,
            **session_status_payload(session_token=session["token"]),
        })
        add_login_cookies(response, session["token"], str(session.get("role") or ""))
        return response

    @app.get("/api/session/status")
    @app.get(f"{admin_path}/api/session/status")
    @app.get("/api/admin/status")
    @app.get(f"{admin_path}/api/admin/status")
    def get_auth_status():
        return jsonify(session_status_payload())

    @app.post("/api/session/login")
    @app.post(f"{admin_path}/api/session/login")
    def login_session():
        return perform_login(require_admin=False, message="Đã đăng nhập hệ thống.")

    @app.post("/api/admin/login")
    @app.post(f"{admin_path}/api/admin/login")
    def login_admin():
        return perform_login(require_admin=True, message="Đã đăng nhập Master Admin.")

    @app.post("/api/session/logout")
    @app.post(f"{admin_path}/api/session/logout")
    @app.post("/api/admin/logout")
    @app.post(f"{admin_path}/api/admin/logout")
    def logout_session():
        current_app.extensions["qltpchay.admin_sessions"].logout(get_session_token())
        message = (
            "Đã đăng xuất Master Admin."
            if request.path.lower().endswith("/api/admin/logout")
            else "Đã đăng xuất hệ thống."
        )
        response = jsonify({
            "message": message,
            **session_status_payload(session_token=""),
        })
        clear_session_cookies(response)
        return response

    def serve_static(
        relative_path: str,
        *,
        is_asset: bool = True,
    ) -> Response | tuple[Response, int]:
        root = Path(app.config["STATIC_ROOT"] if is_asset else app.config["IMAGE_ROOT"]).resolve()
        target = (root / relative_path).resolve()
        if (target != root and root not in target.parents) or not target.is_file():
            return jsonify({"error": "Không tìm thấy file."}), 404

        payload = target.read_bytes()
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        cache_control = SHORT_LIVED_CACHE
        if is_asset and target.suffix.lower() == ".html":
            payload = asset_versions.inject_index_versions(payload.decode("utf-8")).encode("utf-8")
            content_type = "text/html; charset=utf-8"
            cache_control = REVALIDATED_CACHE
        elif is_asset and target.suffix.lower() == ".js":
            relative_js_path = target.relative_to(root).as_posix()
            payload = asset_versions.rewrite_module_imports(
                relative_js_path, payload.decode("utf-8")
            ).encode("utf-8")
            content_type = "application/javascript; charset=utf-8"
            cache_control = (
                LONG_LIVED_CACHE
                if request.args.get("v")
                else REVALIDATED_CACHE
            )
        elif request.args.get("v"):
            cache_control = LONG_LIVED_CACHE

        etag = hashlib.sha256(payload).hexdigest()
        if request.if_none_match.contains(etag):
            response = Response(status=304)
        else:
            response = Response(payload, status=200, mimetype=content_type)
        response.set_etag(etag)
        response.headers["Cache-Control"] = cache_control
        return response

    @app.get("/")
    def public_home() -> Response:
        return serve_static("public_products.html")

    @app.get(admin_path)
    @app.get(admin_path + "/")
    def admin_home() -> Response:
        return serve_static("index.html")

    @app.get("/ProductList")
    def product_list() -> Response:
        return serve_static("public_products.html")

    @app.get("/favicon.ico")
    def favicon() -> Response:
        return Response(status=204)

    @app.get("/static/<path:relative_path>")
    @app.get(f"{admin_path}/static/<path:relative_path>")
    def static_asset(relative_path: str) -> Response:
        return serve_static(relative_path)

    @app.get("/images/<path:relative_path>")
    @app.get(f"{admin_path}/images/<path:relative_path>")
    def uploaded_image(relative_path: str) -> Response:
        return serve_static(relative_path, is_asset=False)

    @app.get("/api/public/products")
    @app.get(f"{admin_path}/api/public/products")
    def public_products():
        # Preserve the legacy public catalog fields during the route migration.
        vietnam_now = datetime.now(timezone(timedelta(hours=7)))
        lunar_day, lunar_month, lunar_year, is_leap_month = solar_to_vietnamese_lunar(
            vietnam_now.date()
        )
        (
            days_until_reminder,
            reminder_day,
            reminder_month,
            reminder_year,
            reminder_is_leap_month,
        ) = next_preorder_lunar_date(vietnam_now.date())
        store = current_app.extensions["qltpchay.store"]
        all_products = store.get_products()
        sales_stats = store.get_product_sales_stats()
        products = [
            {
                "id": product["id"],
                "name": product["name"],
                "category": product["category"],
                "unit": product["unit"],
                "default_sale_unit": product.get("default_sale_unit") or product["unit"],
                "sale_price": product["sale_price"],
                "current_stock": product.get("current_stock", 0),
                "is_low_stock": bool(product.get("is_low_stock", False)),
                "incoming_open_purchases": product.get("incoming_open_purchases", 0),
                "sold_count": sales_stats.get(product["id"], 0),
                "images": product["images"],
                "details": product["details"],
                "recipe": product.get("recipe", ""),
                "note": product.get("note", ""),
                "unit_conversions": product.get("unit_conversions", []),
                "min_unit": get_product_min_unit(product),
            }
            for product in all_products
            if product.get("is_public", 1) and not product.get("is_deleted", 0)
        ]
        config = current_app.config["SYSTEM_CONFIG"]
        public_web = config.get("public_web", {})
        zalo = config.get("zalo_login", {})
        return jsonify(
            {
                "products": products,
                "lunar_calendar": {
                    "day": lunar_day,
                    "month": lunar_month,
                    "year": lunar_year,
                    "is_leap_month": is_leap_month,
                    "days_until_reminder": days_until_reminder,
                    "show_preorder_reminder": days_until_reminder <= PREORDER_REMINDER_WINDOW_DAYS,
                    "reminder_window_days": PREORDER_REMINDER_WINDOW_DAYS,
                    "next_reminder": {
                        "day": reminder_day,
                        "month": reminder_month,
                        "year": reminder_year,
                        "is_leap_month": reminder_is_leap_month,
                    },
                },
                "settings": {
                    **public_web,
                    "require_zalo_login": bool(zalo.get("require_zalo_login", True)),
                    "seller_zalo_url": str(zalo.get("seller_zalo_url", "")).strip(),
                    "order_note_shipping": str(
                        zalo.get("order_note_shipping", "Chưa bao gồm chi phí vận chuyển")
                    ).strip(),
                    "zalo_confirm_template": str(zalo.get("zalo_confirm_template", "")).strip(),
                },
            }
        )

    @app.get("/api/products")
    @app.get(f"{admin_path}/api/products")
    def get_products():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        store = current_app.extensions["qltpchay.store"]
        return jsonify({"products": store.get_products(), "summary": store.get_summary()})

    @app.post("/api/products")
    @app.post(f"{admin_path}/api/products")
    def create_product():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            payload = {}
        store = current_app.extensions["qltpchay.store"]
        try:
            product = store.create_product(
                name=payload.get("name"),
                category=payload.get("category"),
                unit=payload.get("unit"),
                price=payload.get("price", 0),
                sale_price=payload.get("sale_price"),
                low_stock_threshold=payload.get("low_stock_threshold", 5),
                shelf_life_days=payload.get("shelf_life_days"),
                storage_life_days=payload.get("storage_life_days"),
                images=payload.get("images"),
                details=payload.get("details"),
                recipe=payload.get("recipe"),
                note=payload.get("note", ""),
                actor=current_actor_name(),
                unit_conversions=payload.get("unit_conversions"),
                default_purchase_unit=payload.get("default_purchase_unit"),
                default_sale_unit=payload.get("default_sale_unit"),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": "Đã thêm sản phẩm.",
            "product": product,
            "summary": store.get_summary(),
        }), 201

    @app.put("/api/products/<int:product_id>")
    @app.put(f"{admin_path}/api/products/<int:product_id>")
    def update_product(product_id: int):
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            payload = {}
        store = current_app.extensions["qltpchay.store"]
        try:
            product = store.update_product(
                product_id=product_id,
                name=payload.get("name"),
                category=payload.get("category"),
                unit=payload.get("unit"),
                price=payload.get("price", 0),
                sale_price=payload.get("sale_price"),
                low_stock_threshold=payload.get("low_stock_threshold", 5),
                shelf_life_days=payload.get("shelf_life_days"),
                storage_life_days=payload.get("storage_life_days"),
                images=payload.get("images"),
                details=payload.get("details"),
                recipe=payload.get("recipe"),
                note=payload.get("note"),
                is_public=payload.get("is_public"),
                actor=payload.get("actor") or current_actor_name(),
                unit_conversions=payload.get("unit_conversions"),
                default_purchase_unit=payload.get("default_purchase_unit"),
                default_sale_unit=payload.get("default_sale_unit"),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": "Đã cập nhật sản phẩm.",
            "product": product,
            "summary": store.get_summary(),
        })

    @app.delete("/api/products/<int:product_id>")
    @app.delete(f"{admin_path}/api/products/<int:product_id>")
    def delete_product(product_id: int):
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        store = current_app.extensions["qltpchay.store"]
        try:
            deleted = store.delete_product(product_id, actor=current_actor_name())
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": "Đã chuyển sản phẩm sang danh mục đã xóa.",
            "deleted": deleted,
            "summary": store.get_summary(),
        })

    # Issue #182: preserve the legacy product price and restore endpoint contracts.
    @app.put("/api/products/<int:product_id>/price")
    @app.put(f"{admin_path}/api/products/<int:product_id>/price")
    def update_product_price(product_id: int):
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            payload = {}
        store = current_app.extensions["qltpchay.store"]
        try:
            product = store.update_product_price(
                product_id,
                payload.get("price", 0),
                actor=payload.get("actor") or current_actor_name(),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": "Đã cập nhật giá nhập.",
            "product": product,
            "summary": store.get_summary(),
        })

    @app.put("/api/products/<int:product_id>/sale-price")
    @app.put(f"{admin_path}/api/products/<int:product_id>/sale-price")
    def update_product_sale_price(product_id: int):
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            payload = {}
        store = current_app.extensions["qltpchay.store"]
        try:
            product = store.update_product_sale_price(
                product_id,
                payload.get("sale_price", 0),
                actor=payload.get("actor") or current_actor_name(),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": "Đã cập nhật giá bán.",
            "product": product,
            "summary": store.get_summary(),
        })

    @app.post("/api/products/<int:product_id>/restore")
    @app.post(f"{admin_path}/api/products/<int:product_id>/restore")
    def restore_product(product_id: int):
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        store = current_app.extensions["qltpchay.store"]
        try:
            product = store.restore_product(product_id, actor=current_actor_name())
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": "Đã khôi phục sản phẩm.",
            "product": product,
            "summary": store.get_summary(),
        })

    @app.post("/api/products/images/upload")
    @app.post(f"{admin_path}/api/products/images/upload")
    def upload_product_image():
        # Issue #182: keep the legacy raw-binary upload contract and isolated image root.
        try:
            filename = request.args.get("filename", "image.jpg")
            extension = Path(filename).suffix
            if extension.lower() not in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}:
                extension = ".jpg"
            payload = request.get_data(cache=False)
            if extension.lower() != ".svg":
                payload, optimized_extension = resize_image_bytes(payload, max_dim=1024)
                if optimized_extension:
                    extension = optimized_extension
            unique_name = f"{uuid.uuid4().hex}{extension}"
            image_directory = Path(current_app.config["IMAGE_ROOT"]) / "products"
            image_directory.mkdir(parents=True, exist_ok=True)
            (image_directory / unique_name).write_bytes(payload)
        except Exception as error:
            log_error("Product image upload failed", exc_info=True)
            return jsonify({"error": str(error)}), 400
        return jsonify({"url": f"/images/products/{unique_name}"})

    @app.post("/api/products/<int:product_id>/change-base-unit")
    @app.post("/api/admin/products/<int:product_id>/change-base-unit")
    @app.post(f"{admin_path}/api/products/<int:product_id>/change-base-unit")
    @app.post(f"{admin_path}/api/admin/products/<int:product_id>/change-base-unit")
    def change_product_base_unit(product_id: int):
        auth_error = require_admin_session()
        if auth_error is not None:
            return auth_error
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            payload = {}
        store = current_app.extensions["qltpchay.store"]
        try:
            product = store.change_product_base_unit(
                product_id=product_id,
                new_unit=payload.get("new_unit"),
                conversion_rate=payload.get("conversion_rate"),
                add_old_unit_to_conversions=bool(payload.get("add_old_unit_to_conversions", True)),
                default_purchase_unit=payload.get("default_purchase_unit"),
                default_sale_unit=payload.get("default_sale_unit"),
                actor=payload.get("actor") or current_actor_name(),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": f"Đã chuyển đổi đơn vị chính thành công sang '{product.get('unit')}'.",
            "product": product,
            "summary": store.get_summary(),
        })

    @app.delete("/api/admin/products/<int:product_id>/hard")
    @app.delete(f"{admin_path}/api/admin/products/<int:product_id>/hard")
    def hard_delete_product(product_id: int):
        # Issue #182: legacy admin mutations apply login gate, then require Master Admin.
        if current_app.config["SYSTEM_CONFIG"].get("EnableLogin"):
            auth_error = require_authenticated_session()
            if auth_error is not None:
                return auth_error
        auth_error = require_admin_session()
        if auth_error is not None:
            return auth_error
        store = current_app.extensions["qltpchay.store"]
        try:
            deleted = store.hard_delete_product(product_id, actor=current_actor_name())
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify(deleted)

    @app.get("/api/admin/public-web-config")
    @app.get(f"{admin_path}/api/admin/public-web-config")
    def get_admin_public_web_config():
        auth_error = require_admin_session()
        if auth_error is not None:
            return auth_error
        config = current_app.config["SYSTEM_CONFIG"]
        return jsonify({
            "public_web": config.get("public_web", {}),
            "zalo_login": config.get("zalo_login", {}),
        })

    @app.get("/api/admin/mail-config")
    @app.get(f"{admin_path}/api/admin/mail-config")
    def get_admin_mail_config():
        auth_error = require_admin_session()
        if auth_error is not None:
            return auth_error
        config = current_app.config["SYSTEM_CONFIG"]
        return jsonify({
            "mail": _public_mail_config(config.get("mail")),
            "environment": APP_ENV,
        })

    @app.get("/api/admin/legacy-audit")
    @app.get(f"{admin_path}/api/admin/legacy-audit")
    def get_admin_legacy_audit():
        auth_error = require_admin_session()
        if auth_error is not None:
            return auth_error
        store = current_app.extensions["qltpchay.store"]
        return jsonify(store.get_legacy_data_audit())

    @app.get("/api/admin/export/<entity_type>")
    @app.get(f"{admin_path}/api/admin/export/<entity_type>")
    def export_master_data(entity_type: str):
        auth_error = require_admin_session()
        if auth_error is not None:
            return auth_error
        if entity_type not in {"products", "customers", "suppliers"}:
            return jsonify({"error": "Không tìm thấy tài nguyên."}), 404
        export_format = str(request.args.get("format", "json")).strip().lower()
        if export_format not in {"json", "csv"}:
            return jsonify({
                "error": "Định dạng export không hợp lệ. Chỉ hỗ trợ json/csv."
            }), 400
        store = current_app.extensions["qltpchay.store"]
        payload = store.export_master_data(entity_type)
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        if export_format == "csv":
            body = _build_master_csv_bytes(entity_type, payload.get("records", []))
            content_type = "text/csv; charset=utf-8"
            filename = f"{entity_type}-master-{timestamp}.csv"
        else:
            body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
            content_type = "application/json; charset=utf-8"
            filename = f"{entity_type}-master-{timestamp}.json"
        response = Response(body, status=200, content_type=content_type)
        response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

    @app.get("/api/admin/backup")
    @app.get(f"{admin_path}/api/admin/backup")
    def download_database_backup():
        auth_error = require_admin_session()
        if auth_error is not None:
            return auth_error
        store = current_app.extensions["qltpchay.store"]
        backup_path = store.create_database_backup()
        return send_file(
            backup_path,
            mimetype="application/octet-stream",
            as_attachment=True,
            download_name=Path(backup_path).name,
        )

    @app.get("/api/products/deleted")
    @app.get(f"{admin_path}/api/products/deleted")
    def get_deleted_products():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        store = current_app.extensions["qltpchay.store"]
        return jsonify({"products": store.get_deleted_products()})

    @app.get("/api/products/history")
    @app.get(f"{admin_path}/api/products/history")
    def get_product_history():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        store = current_app.extensions["qltpchay.store"]
        history = store.get_product_history(
            limit=int(request.args.get("limit", "40")),
            actor=request.args.get("actor", ""),
            start_date=request.args.get("start_date"),
            end_date=request.args.get("end_date"),
        )
        return jsonify({"history": history})

    @app.get("/api/product-movements")
    @app.get(f"{admin_path}/api/product-movements")
    def get_product_movements():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        store = current_app.extensions["qltpchay.store"]
        try:
            result = store.get_product_movements(
                product_id=int(request.args.get("product_id", "")),
                from_date=request.args.get("from_date"),
                to_date=request.args.get("to_date"),
                movement_type=request.args.get("movement_type", ""),
                keyword=request.args.get("keyword", ""),
            )
        except (TypeError, ValueError) as error:
            return jsonify({"error": str(error)}), 400
        return jsonify(result)

    @app.get("/api/receipts/history")
    @app.get(f"{admin_path}/api/receipts/history")
    def get_receipt_history():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        store = current_app.extensions["qltpchay.store"]
        history = store.get_receipt_history(
            limit=int(request.args.get("limit", "40")),
            receipt_type=request.args.get("receipt_type", ""),
            start_date=request.args.get("start_date"),
            end_date=request.args.get("end_date"),
        )
        return jsonify({"history": history})

    @app.get("/api/transactions")
    @app.get(f"{admin_path}/api/transactions")
    def get_transactions():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        store = current_app.extensions["qltpchay.store"]
        return jsonify(
            {"transactions": store.get_transactions(limit=int(request.args.get("limit", "20")))}
        )

    @app.post("/api/transactions")
    @app.post(f"{admin_path}/api/transactions")
    def create_transaction():
        auth_error = require_inventory_adjust_session()
        if auth_error is not None:
            return auth_error
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Dữ liệu JSON không hợp lệ."}), 400
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        store = current_app.extensions["qltpchay.store"]
        try:
            transaction = store.create_transaction(
                product_id=int(payload.get("product_id", 0)),
                transaction_type=payload.get("transaction_type"),
                quantity=payload.get("quantity"),
                note=payload.get("note", ""),
                adjustment_reason=payload.get("adjustment_reason", ""),
                actor=str((session or {}).get("username") or ""),
                batch_code=payload.get("batch_code", ""),
                expiry_date=payload.get("expiry_date"),
            )
        except (TypeError, ValueError) as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": "Đã cập nhật tồn kho.",
            "transaction": transaction,
            "summary": store.get_summary(),
        }), 201

    @app.post("/api/orders/checkout")
    @app.post(f"{admin_path}/api/orders/checkout")
    def checkout_order():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Dữ liệu JSON không hợp lệ."}), 400
        store = current_app.extensions["qltpchay.store"]
        try:
            order = store.create_checkout_order(
                customer_name=payload.get("customer_name"),
                items=payload.get("items", []),
                note=payload.get("note", ""),
                discount_amount=payload.get("discount_amount", 0),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": "Đã chốt giỏ hàng và xuất kho.",
            "order": order,
            "summary": store.get_summary(),
        }), 201

    @app.post("/api/orders/quick-create")
    @app.post(f"{admin_path}/api/orders/quick-create")
    def quick_create_order():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Dữ liệu JSON không hợp lệ."}), 400
        store = current_app.extensions["qltpchay.store"]
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        try:
            result = store.create_quick_sale(
                target_cart_id=payload.get("target_cart_id", ""),
                customer_id=payload.get("customer_id", ""),
                customer_name=payload.get("customer_name", ""),
                document_date=payload.get("document_date", ""),
                note=payload.get("note", ""),
                items=payload.get("items", []),
                discount_amount=payload.get("discount_amount", 0),
                final_status=payload.get("final_status", "completed"),
                mark_paid=bool(payload.get("mark_paid")),
                payment_method=payload.get("payment_method", ""),
                payment_note=payload.get("payment_note", ""),
                actor_username=str((session or {}).get("username") or ""),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": result["message"],
            "cart": result["cart"],
            "order": result["order"],
            "quick_summary": result["summary"],
            "carts": result["carts"],
            "customers": result["customers"],
            "summary": store.get_summary(),
        }), 201

    @app.post("/api/orders/commit")
    @app.post(f"{admin_path}/api/orders/commit")
    def commit_order():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Dữ liệu JSON không hợp lệ."}), 400
        store = current_app.extensions["qltpchay.store"]
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        try:
            result = store.commit_cart_order(
                payload.get("cart_id", ""),
                actor=str((session or {}).get("username") or ""),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": "Đã chốt đơn.",
            "cart": result["cart"],
            "order": {
                "order_code": result["order_code"],
                "committed_at": result["committed_at"],
            },
            "summary": store.get_summary(),
        })

    @app.post("/api/orders/ship")
    @app.post(f"{admin_path}/api/orders/ship")
    def ship_order():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Dữ liệu JSON không hợp lệ."}), 400
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        store = current_app.extensions["qltpchay.store"]
        try:
            result = store.ship_cart_order(
                payload.get("cart_id", ""),
                actor=str((session or {}).get("username") or ""),
                shipped_at=payload.get("shipped_at", ""),
                ship_date=payload.get("ship_date", ""),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": "Đã xuất hàng.",
            "cart": result["cart"],
            "order": result["order"],
            "summary": store.get_summary(),
        })

    @app.post("/api/purchases/receive")
    @app.post(f"{admin_path}/api/purchases/receive")
    def receive_purchase():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Dữ liệu JSON không hợp lệ."}), 400
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        store = current_app.extensions["qltpchay.store"]
        try:
            result = store.receive_purchase(
                payload.get("purchase_id", ""),
                discount_amount=payload.get("discount_amount"),
                actor_username=str((session or {}).get("username") or ""),
                actor_role=str((session or {}).get("role") or ""),
                received_at=payload.get("received_at", ""),
                received_date=payload.get("received_date", ""),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": result["message"],
            "receipt": result["receipt"],
            "purchase": result["purchase"],
            "purchases": result["purchases"],
            "summary": store.get_summary(),
        }), 201

    @app.post("/api/purchases/quick-create")
    @app.post(f"{admin_path}/api/purchases/quick-create")
    def quick_create_purchase():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Dữ liệu JSON không hợp lệ."}), 400
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        store = current_app.extensions["qltpchay.store"]
        try:
            result = store.create_quick_purchase(
                supplier_id=payload.get("supplier_id", ""),
                supplier_name=payload.get("supplier_name", ""),
                document_date=payload.get("document_date", ""),
                note=payload.get("note", ""),
                items=payload.get("items", []),
                discount_amount=payload.get("discount_amount", 0),
                final_status=payload.get("final_status", "received"),
                mark_paid=bool(payload.get("mark_paid")),
                payment_method=payload.get("payment_method", ""),
                payment_note=payload.get("payment_note", ""),
                actor_username=str((session or {}).get("username") or ""),
                actor_role=str((session or {}).get("role") or ""),
                target_purchase_id=payload.get("target_purchase_id", ""),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": result["message"],
            "purchase": result["purchase"],
            "receipt": result["receipt"],
            "quick_summary": result["summary"],
            "purchases": result["purchases"],
            "suppliers": result["suppliers"],
            "summary": store.get_summary(),
        }), 201

    @app.post("/api/purchases/mark-paid")
    @app.post(f"{admin_path}/api/purchases/mark-paid")
    def mark_purchase_paid():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Dữ liệu JSON không hợp lệ."}), 400
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        store = current_app.extensions["qltpchay.store"]
        try:
            result = store.mark_purchase_paid(
                payload.get("purchase_id", ""),
                discount_amount=payload.get("discount_amount"),
                paid_at=payload.get("paid_at"),
                payment_method=payload.get("payment_method", ""),
                payment_note=payload.get("payment_note", ""),
                actor_username=str((session or {}).get("username") or ""),
                actor_role=str((session or {}).get("role") or ""),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": result["message"],
            "purchase": result["purchase"],
            "purchases": result["purchases"],
            "summary": store.get_summary(),
        })

    @app.post("/api/purchases/payment")
    @app.post(f"{admin_path}/api/purchases/payment")
    def update_purchase_payment():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Dữ liệu JSON không hợp lệ."}), 400
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        store = current_app.extensions["qltpchay.store"]
        try:
            result = store.update_purchase_payment(
                payload.get("purchase_id", ""),
                discount_amount=payload.get("discount_amount"),
                paid_at=payload.get("paid_at"),
                payment_method=payload.get("payment_method", ""),
                payment_note=payload.get("payment_note", ""),
                actor_username=str((session or {}).get("username") or ""),
                actor_role=str((session or {}).get("role") or ""),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": result["message"],
            "purchase": result["purchase"],
            "purchases": result["purchases"],
            "summary": store.get_summary(),
        })

    @app.post("/api/carts/item")
    @app.post(f"{admin_path}/api/carts/item")
    def update_cart_item():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Dữ liệu JSON không hợp lệ."}), 400
        store = current_app.extensions["qltpchay.store"]
        try:
            result = store.update_cart_item(
                payload.get("cart_id", ""),
                payload.get("item_id", ""),
                payload,
                actor=current_actor_name(),
            )
        except SyncConflictError as error:
            return jsonify({"error": str(error), "conflict": True}), 409
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify(result)

    @app.post("/api/carts/payment")
    @app.post(f"{admin_path}/api/carts/payment")
    def update_cart_payment():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Dữ liệu JSON không hợp lệ."}), 400
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        store = current_app.extensions["qltpchay.store"]
        try:
            result = store.update_cart_payment(
                payload.get("cart_id", ""),
                payment_status=payload.get("payment_status", "paid"),
                paid_at=payload.get("paid_at"),
                payment_method=payload.get("payment_method", ""),
                payment_note=payload.get("payment_note", ""),
                actor_username=str((session or {}).get("username") or ""),
                actor_role=str((session or {}).get("role") or ""),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": result["message"],
            "cart": result["cart"],
            "carts": result["carts"],
            "summary": store.get_summary(),
        })

    @app.post("/api/purchases/received-item-expiry")
    @app.post(f"{admin_path}/api/purchases/received-item-expiry")
    def update_received_purchase_item_expiry():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Dữ liệu JSON không hợp lệ."}), 400
        store = current_app.extensions["qltpchay.store"]
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        try:
            result = store.update_received_purchase_item_expiry(
                payload.get("purchase_id", ""),
                payload.get("purchase_item_id", ""),
                expiry_input_mode=payload.get("expiry_input_mode", "direct"),
                manufacture_date=payload.get("manufacture_date"),
                expiry_date=payload.get("expiry_date"),
                expected_updated_at=payload.get("expected_updated_at", ""),
                actor=str((session or {}).get("username") or ""),
            )
        except SyncConflictError as error:
            return jsonify({"error": str(error), "conflict": True}), 409
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": "Đã cập nhật hạn dùng của dòng nhập hàng.",
            "purchase": result["purchase"],
            "item": result["item"],
            "purchases": result["purchases"],
            "summary": store.get_summary(),
        })

    # Issue #182: Preserve legacy actor, permission, and receipt response contracts.
    @app.post("/api/purchases/repair")
    @app.post(f"{admin_path}/api/purchases/repair")
    def repair_purchase():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Dữ liệu JSON không hợp lệ."}), 400
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        store = current_app.extensions["qltpchay.store"]
        try:
            result = store.repair_purchase_document(
                payload.get("purchase_id", ""),
                action=payload.get("action", ""),
                actor=str((session or {}).get("username") or ""),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": result["message"],
            "purchases": result["purchases"],
            "detached_receipt_codes": result["detached_receipt_codes"],
            "summary": store.get_summary(),
        })

    @app.post("/api/adjustments/inventory")
    @app.post(f"{admin_path}/api/adjustments/inventory")
    def create_inventory_adjustment():
        auth_error = require_inventory_adjust_session()
        if auth_error is not None:
            return auth_error
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Dữ liệu JSON không hợp lệ."}), 400
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        store = current_app.extensions["qltpchay.store"]
        try:
            receipt = store.create_inventory_adjustment_receipt(
                items=payload.get("items", []),
                reason=payload.get("reason", ""),
                note=payload.get("note", ""),
                actor=str((session or {}).get("username") or ""),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": "Đã tạo phiếu điều chỉnh tồn.",
            "receipt": receipt,
            "summary": store.get_summary(),
        }), 201

    @app.post("/api/returns/customers")
    @app.post(f"{admin_path}/api/returns/customers")
    def create_customer_return():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Dữ liệu JSON không hợp lệ."}), 400
        store = current_app.extensions["qltpchay.store"]
        try:
            receipt = store.create_customer_return_receipt(
                customer_name=payload.get("customer_name", ""),
                items=payload.get("items", []),
                note=payload.get("note", ""),
                source_type=payload.get("source_type", ""),
                source_code=payload.get("source_code", ""),
                actor=current_actor_name(),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": "Đã tạo phiếu trả hàng khách.",
            "receipt": receipt,
            "summary": store.get_summary(),
        }), 201

    @app.post("/api/returns/suppliers")
    @app.post(f"{admin_path}/api/returns/suppliers")
    def create_supplier_return():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Dữ liệu JSON không hợp lệ."}), 400
        store = current_app.extensions["qltpchay.store"]
        try:
            receipt = store.create_supplier_return_receipt(
                supplier_name=payload.get("supplier_name", ""),
                items=payload.get("items", []),
                note=payload.get("note", ""),
                source_type=payload.get("source_type", ""),
                source_code=payload.get("source_code", ""),
                actor=current_actor_name(),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": "Đã tạo phiếu trả nhà cung cấp.",
            "receipt": receipt,
            "summary": store.get_summary(),
        }), 201

    def submit_document_cancel_request(document_type: str, document_id: str):
        config = current_app.config["SYSTEM_CONFIG"]
        if not config.get("EnableLogin"):
            return jsonify({
                "error": "Cần bật EnableLogin để dùng luồng hủy có phê duyệt."
            }), 400
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            payload = {}
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        store = current_app.extensions["qltpchay.store"]
        try:
            request_doc = store.create_document_cancel_request(
                document_type=document_type,
                document_id=document_id,
                reason=payload.get("reason", ""),
                actor=str((session or {}).get("username") or ""),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        document_label = "đơn xuất" if document_type == "order" else "phiếu nhập"
        subject = (
            f"Yêu cầu hủy {document_label} "
            f"{request_doc.get('document_code') or request_doc.get('document_id') or ''}"
        ).strip()
        body = "\n".join([
            "Có yêu cầu hủy chứng từ mới cần phê duyệt.",
            f"Request: {request_doc.get('request_code') or request_doc.get('request_id') or ''}",
            f"Loại chứng từ: {document_label}",
            f"Mã chứng từ: {request_doc.get('document_code') or request_doc.get('document_id') or ''}",
            f"Người yêu cầu: {request_doc.get('requested_by') or ''}",
            f"Lý do: {request_doc.get('cancel_reason') or ''}",
            f"Thời gian: {request_doc.get('created_at') or ''}",
            "Mở màn Xuất hàng hoặc Nhập hàng trong app để duyệt/từ chối yêu cầu.",
        ])
        try:
            mail_result = send_mail_notification(
                mail_config=config.get("mail", {}),
                subject=subject,
                body=body,
            )
        except Exception as error:
            mail_result = {"sent": False, "skipped": False, "reason": str(error)}
        message = (
            "Đã gửi yêu cầu hủy đơn chờ phê duyệt."
            if document_type == "order"
            else "Đã gửi yêu cầu hủy phiếu nhập chờ phê duyệt."
        )
        response_payload = {
            "message": message,
            "request": request_doc,
            "mail_notification": mail_result,
            "document_cancel_requests": store.list_document_cancel_requests(limit=30),
        }
        if mail_result.get("sent"):
            response_payload["notification_message"] = "Đã gửi mail thông báo phê duyệt."
        elif not mail_result.get("skipped"):
            response_payload["notification_warning"] = (
                "Không gửi được mail thông báo, nhưng yêu cầu hủy đã được lưu."
            )
        return jsonify(response_payload), 201

    @app.post("/api/orders/<document_id>/cancel-request")
    @app.post(f"{admin_path}/api/orders/<document_id>/cancel-request")
    def create_order_cancel_request(document_id: str):
        return submit_document_cancel_request("order", document_id)

    @app.post("/api/purchases/<document_id>/cancel-request")
    @app.post(f"{admin_path}/api/purchases/<document_id>/cancel-request")
    def create_purchase_cancel_request(document_id: str):
        return submit_document_cancel_request("purchase", document_id)

    @app.post("/api/document-cancel-requests/<request_id>/approve")
    @app.post(f"{admin_path}/api/document-cancel-requests/<request_id>/approve")
    def approve_document_cancel_request(request_id: str):
        auth_error = require_document_cancel_approval()
        if auth_error is not None:
            return auth_error
        store = current_app.extensions["qltpchay.store"]
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        try:
            result = store.approve_document_cancel_request(
                request_id,
                actor=str((session or {}).get("username") or ""),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": "Đã duyệt và hủy chứng từ.",
            **result,
            "document_cancel_requests": store.list_document_cancel_requests(limit=30),
            "summary": store.get_summary(),
            **store.get_sync_state(),
        })

    @app.post("/api/document-cancel-requests/<request_id>/reject")
    @app.post(f"{admin_path}/api/document-cancel-requests/<request_id>/reject")
    def reject_document_cancel_request(request_id: str):
        auth_error = require_document_cancel_approval()
        if auth_error is not None:
            return auth_error
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            payload = {}
        store = current_app.extensions["qltpchay.store"]
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        try:
            request_doc = store.reject_document_cancel_request(
                request_id,
                actor=str((session or {}).get("username") or ""),
                reason=payload.get("reason", ""),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": "Đã từ chối yêu cầu hủy chứng từ.",
            "request": request_doc,
            "document_cancel_requests": store.list_document_cancel_requests(limit=30),
        })

    @app.post("/api/orders/bulk-create")
    @app.post(f"{admin_path}/api/orders/bulk-create")
    def bulk_create_orders():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Dữ liệu JSON không hợp lệ."}), 400
        config = current_app.config["SYSTEM_CONFIG"]
        login_enabled = bool(config.get("EnableLogin"))
        if login_enabled:
            auth_error = require_authenticated_session()
            if auth_error is not None:
                return auth_error
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        role = str((session or {}).get("role") or "")
        permissions = {
            str(permission or "").strip()
            for permission in ((session or {}).get("permissions") or [])
            if str(permission or "").strip()
        }

        def has_permission(permission: str) -> bool:
            return role == "admin" or permission in permissions

        mode = str(payload.get("mode") or "").strip()
        if mode == "commit_valid" and not has_permission("bulk_order_commit"):
            return jsonify({"error": "Tài khoản này không có quyền chốt nhiều đơn."}), 401
        if (
            login_enabled
            and mode != "commit_valid"
            and not has_permission("bulk_order_create")
            and not has_permission("bulk_order_commit")
        ):
            return jsonify({"error": "Tài khoản này không có quyền tạo nhiều đơn."}), 401

        can_manage_requests = has_permission("order_batch_manage")
        approval_required = login_enabled and not can_manage_requests
        request_id = payload.get("request_id") or payload.get("requestId") or ""
        orders = payload.get("orders") or []
        allow_duplicates = bool(payload.get("allow_duplicates") or payload.get("allowDuplicates"))
        actor = str((session or {}).get("username") or "")
        store = current_app.extensions["qltpchay.store"]
        try:
            if approval_required:
                result = store.create_bulk_order_request(
                    mode=mode,
                    request_id=request_id,
                    orders=orders,
                    actor=actor,
                )
                message = (
                    "Đã gửi yêu cầu chốt nhiều đơn để chờ duyệt."
                    if mode == "commit_valid"
                    else "Đã gửi yêu cầu lưu nhiều đơn nháp để chờ duyệt."
                )
            else:
                result = store.bulk_create_orders(
                    mode=mode,
                    request_id=request_id,
                    orders=orders,
                    actor=actor,
                    allow_duplicates=allow_duplicates,
                )
                message = "Đã chốt các đơn hợp lệ." if mode == "commit_valid" else "Đã lưu các đơn nháp."
        except BulkOrderRequestDuplicateError as error:
            return jsonify({
                "error": str(error),
                "code": "bulk_order_duplicate_request",
                "duplicates": error.duplicates,
                "approval_required": approval_required,
                "can_continue": can_manage_requests,
            }), 409
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": message,
            **result,
            "inventory_summary": store.get_summary(),
        })

    @app.post("/api/orders/bulk-requests/<request_id>/approve")
    @app.post(f"{admin_path}/api/orders/bulk-requests/<request_id>/approve")
    def approve_bulk_order_request(request_id: str):
        auth_error = require_named_permission(
            "order_batch_manage",
            "Tài khoản này không có quyền duyệt yêu cầu xuất nhanh.",
        )
        if auth_error is not None:
            return auth_error
        store = current_app.extensions["qltpchay.store"]
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        try:
            request_doc = store.approve_bulk_order_request(
                request_id,
                actor=str((session or {}).get("username") or ""),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": "Đã approve yêu cầu xuất nhanh.",
            "request": request_doc,
            "bulk_order_requests": store.list_bulk_order_requests(limit=30),
        })

    @app.post("/api/orders/bulk-requests/<request_id>/reject")
    @app.post(f"{admin_path}/api/orders/bulk-requests/<request_id>/reject")
    def reject_bulk_order_request(request_id: str):
        auth_error = require_named_permission(
            "order_batch_manage",
            "Tài khoản này không có quyền từ chối yêu cầu xuất nhanh.",
        )
        if auth_error is not None:
            return auth_error
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            payload = {}
        store = current_app.extensions["qltpchay.store"]
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        try:
            request_doc = store.reject_bulk_order_request(
                request_id,
                actor=str((session or {}).get("username") or ""),
                reason=payload.get("reason") or "",
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": "Đã reject yêu cầu xuất nhanh.",
            "request": request_doc,
            "bulk_order_requests": store.list_bulk_order_requests(limit=30),
        })

    @app.post("/api/orders/bulk-requests/<request_id>/delete")
    @app.post(f"{admin_path}/api/orders/bulk-requests/<request_id>/delete")
    def delete_bulk_order_request(request_id: str):
        if current_app.config["SYSTEM_CONFIG"].get("EnableLogin"):
            auth_error = require_authenticated_session()
            if auth_error is not None:
                return auth_error
        store = current_app.extensions["qltpchay.store"]
        request_doc = store.get_bulk_order_request(request_id)
        if not request_doc:
            return jsonify({"error": "Không tìm thấy yêu cầu xuất nhanh."}), 400
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        username = str((session or {}).get("username") or "")
        permissions = {
            str(permission or "").strip()
            for permission in ((session or {}).get("permissions") or [])
            if str(permission or "").strip()
        }
        can_manage = str((session or {}).get("role") or "") == "admin" or "order_batch_manage" in permissions
        if not (can_manage or username == str(request_doc.get("requested_by") or "").strip()):
            return jsonify({
                "error": "Chỉ owner hoặc user quản lý mới được xóa yêu cầu xuất nhanh này."
            }), 401
        try:
            deleted_request = store.delete_bulk_order_request(
                request_id,
                actor=username,
                can_manage=can_manage,
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": "Đã xóa yêu cầu xuất nhanh chờ duyệt.",
            "request": deleted_request,
            "bulk_order_requests": store.list_bulk_order_requests(limit=30),
        })

    @app.post("/api/orders/bulk-requests/<request_id>/process")
    @app.post(f"{admin_path}/api/orders/bulk-requests/<request_id>/process")
    def process_bulk_order_request(request_id: str):
        if current_app.config["SYSTEM_CONFIG"].get("EnableLogin"):
            auth_error = require_authenticated_session()
            if auth_error is not None:
                return auth_error
        store = current_app.extensions["qltpchay.store"]
        request_doc = store.get_bulk_order_request(request_id)
        if not request_doc:
            return jsonify({"error": "Không tìm thấy yêu cầu xuất nhanh."}), 400
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        username = str((session or {}).get("username") or "")
        permissions = {
            str(permission or "").strip()
            for permission in ((session or {}).get("permissions") or [])
            if str(permission or "").strip()
        }
        can_manage = str((session or {}).get("role") or "") == "admin" or "order_batch_manage" in permissions
        if not (can_manage or username == str(request_doc.get("requested_by") or "").strip()):
            return jsonify({
                "error": "Tài khoản này không có quyền xử lý yêu cầu xuất nhanh đã duyệt."
            }), 401
        try:
            result = store.process_bulk_order_request(request_id, actor=username)
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            "message": "Đã xử lý yêu cầu xuất nhanh đã duyệt.",
            **result,
            "bulk_order_requests": store.list_bulk_order_requests(limit=30),
            "inventory_summary": store.get_summary(),
        })

    @app.get("/api/orders/bulk-requests/<request_id>/history")
    @app.get(f"{admin_path}/api/orders/bulk-requests/<request_id>/history")
    def get_bulk_order_request_history(request_id: str):
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        store = current_app.extensions["qltpchay.store"]
        limit = int(request.args.get("limit", "30"))
        request_doc = store.get_bulk_order_request(request_id)
        if not request_doc:
            return jsonify({"error": "Không tìm thấy yêu cầu xuất nhanh."}), 400
        return jsonify({
            "request": request_doc,
            "history": store.get_bulk_order_request_change_history(request_id, limit=limit),
        })

    @app.get("/api/document-cancel-requests/<request_id>/history")
    @app.get(f"{admin_path}/api/document-cancel-requests/<request_id>/history")
    def get_document_cancel_request_history(request_id: str):
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        store = current_app.extensions["qltpchay.store"]
        limit = int(request.args.get("limit", "30"))
        request_doc = store.get_document_cancel_request(request_id)
        if not request_doc:
            return jsonify({"error": "Không tìm thấy yêu cầu hủy."}), 400
        return jsonify({
            "request": request_doc,
            "history": store.get_document_cancel_request_change_history(request_id, limit=limit),
        })

    @app.get("/api/orders/<cart_id>/history")
    @app.get(f"{admin_path}/api/orders/<cart_id>/history")
    def get_order_history(cart_id: str):
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        store = current_app.extensions["qltpchay.store"]
        limit = int(request.args.get("limit", "30"))
        carts = store.get_sync_state().get("carts", [])
        cart = next(
            (entry for entry in carts if str(entry.get("id") or "").strip() == cart_id.strip()),
            None,
        )
        if not cart:
            return jsonify({"error": "Không tìm thấy đơn hàng."}), 400
        return jsonify({
            "cart": cart,
            "history": store.get_cart_change_history(cart_id, limit=limit),
        })

    @app.get("/api/purchases/<purchase_id>/history")
    @app.get(f"{admin_path}/api/purchases/<purchase_id>/history")
    def get_purchase_history(purchase_id: str):
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        store = current_app.extensions["qltpchay.store"]
        limit = int(request.args.get("limit", "30"))
        purchases = store.get_sync_state().get("purchases", [])
        purchase = next(
            (entry for entry in purchases if str(entry.get("id") or "").strip() == purchase_id.strip()),
            None,
        )
        if not purchase:
            return jsonify({"error": "Không tìm thấy phiếu nhập."}), 400
        return jsonify({
            "purchase": purchase,
            "history": store.get_purchase_change_history(purchase_id, limit=limit),
        })

    @app.get("/api/runtime-version")
    @app.get(f"{admin_path}/api/runtime-version")
    def get_runtime_version():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        store = current_app.extensions["qltpchay.store"]
        metadata = session_status_payload(session_token="")
        return jsonify({
            **store.get_runtime_version(),
            "app": metadata["app"],
            "debug": metadata["debug"],
            "pagination": metadata["pagination"],
        })

    @app.get("/api/reports/monthly")
    @app.get(f"{admin_path}/api/reports/monthly")
    def get_monthly_report():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        store = current_app.extensions["qltpchay.store"]
        try:
            payload = store.get_monthly_report(
                months=int(request.args.get("months", "6")),
                focus_month=request.args.get("focus_month"),
                start_date=request.args.get("start_date"),
                end_date=request.args.get("end_date"),
            )
        except ValueError:
            return jsonify({"error": "Bộ lọc báo cáo không hợp lệ."}), 400
        return jsonify(payload)

    @app.get("/api/procurement/status")
    @app.get(f"{admin_path}/api/procurement/status")
    def get_procurement_status():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        return jsonify(procurement_status_payload())

    @app.get("/api/procurement/planner")
    @app.get(f"{admin_path}/api/procurement/planner")
    def get_procurement_planner():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        config = current_app.config["SYSTEM_CONFIG"]
        procurement = config.get("procurement", {})
        if (
            procurement.get("required_login_for_batch_mode", True)
            and not config.get("EnableLogin")
        ):
            return jsonify(
                {"error": "Batch mode cần bật EnableLogin để xác định người giữ khóa."}
            ), 400
        permissions = procurement_permission_payload(include_lock_owner=False)
        if not permissions["can_manage_batch"]:
            return jsonify({"error": "Tài khoản này không có quyền xử lý kỳ gom nhập."}), 401
        store = current_app.extensions["qltpchay.store"]
        try:
            planner = store.get_procurement_planner(
                scope_type=request.args.get("scope", "all"),
                scope_code=request.args.get(
                    "scope_code",
                    request.args.get("cart_id", request.args.get("product_id", "")),
                ),
                lock_timeout_minutes=procurement_lock_timeout(),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        return jsonify({
            **planner,
            "config": procurement_public_config(),
            "permissions": procurement_permission_payload(),
        })

    @app.get("/api/state")
    @app.get(f"{admin_path}/api/state")
    def get_application_state():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        store = current_app.extensions["qltpchay.store"]
        metadata = session_status_payload(session_token="")
        sync_state = store.get_sync_state()
        return jsonify({
            "app": metadata["app"],
            "debug": metadata["debug"],
            "pagination": metadata["pagination"],
            "products": store.get_products(),
            "summary": store.get_summary(),
            "transactions": store.get_transactions(
                limit=int(request.args.get("transaction_limit", "16")),
            ),
            "runtime_version": store.get_runtime_version(),
            "procurement": procurement_status_payload(),
            "bulk_order_requests": store.list_bulk_order_requests(limit=30),
            "document_cancel_requests": store.list_document_cancel_requests(limit=30),
            **sync_state,
        })

    @app.put("/api/state")
    @app.put(f"{admin_path}/api/state")
    def save_application_state():
        auth_error = require_authenticated_session()
        if auth_error is not None:
            return auth_error
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Dữ liệu JSON không hợp lệ."}), 400
        payload["actor"] = payload.get("actor") or current_actor_name()
        store = current_app.extensions["qltpchay.store"]
        session, _expired = current_app.extensions["qltpchay.admin_sessions"].resolve_session(
            get_session_token(),
            touch=False,
        )
        try:
            sync_state = store.save_sync_state(
                payload,
                actor_username=str((session or {}).get("username") or ""),
                actor_role=str((session or {}).get("role") or ""),
            )
        except SyncConflictError as error:
            return jsonify({
                "error": str(error),
                "conflict": {
                    "state_key": error.state_key,
                    "expected_updated_at": error.expected_updated_at,
                    "actual_updated_at": error.actual_updated_at,
                },
            }), 409
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        metadata = session_status_payload(session_token="")
        return jsonify({
            "message": "Đã lưu dữ liệu đồng bộ.",
            "app": metadata["app"],
            "debug": metadata["debug"],
            "pagination": metadata["pagination"],
            "runtime_version": store.get_runtime_version(),
            **sync_state,
        })

    @app.get("/api/public/orders")
    @app.get(f"{admin_path}/api/public/orders")
    def public_orders():
        phone = str(request.args.get("phone") or "").strip()
        zalo_id = str(request.args.get("zalo_id") or "").strip()
        if not phone and not zalo_id:
            return jsonify({"error": "Cần số điện thoại hoặc Zalo ID để tra cứu."}), 400
        store = current_app.extensions["qltpchay.store"]
        return jsonify({"orders": store.get_public_orders(phone=phone, zalo_id=zalo_id)})

    @app.post("/api/public/orders")
    @app.post(f"{admin_path}/api/public/orders")
    def submit_public_order():
        # #Issue182: Keep online-order creation on InventoryStore and use the app's injected config.
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            payload = {}
        config = current_app.config["SYSTEM_CONFIG"]
        zalo_config = config.get("zalo_login", {})
        if zalo_config.get("require_zalo_login", True) and not payload.get("zalo_id"):
            return jsonify(
                {"error": "Hệ thống yêu cầu đăng nhập bằng Zalo để xác thực đặt hàng."}
            ), 400

        store = current_app.extensions["qltpchay.store"]
        try:
            result = store.create_online_order(
                customer_name=payload.get("customer_name") or "",
                customer_phone=payload.get("customer_phone") or "",
                customer_address=payload.get("customer_address") or "",
                zalo_id=payload.get("zalo_id") or "",
                avatar_url=payload.get("avatar_url") or "",
                note=payload.get("note") or "",
                items=payload.get("items") or [],
                force_new_order=bool(payload.get("force_new_order", False)),
            )
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        except Exception:
            log_error("Flask public order creation failed.", exc_info=True)
            return jsonify({"error": "Lỗi hệ thống nội bộ."}), 500
        return jsonify(result), 201

    return app
