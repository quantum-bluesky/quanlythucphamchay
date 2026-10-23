"""Flask application factory for the staged HTTP migration."""

from __future__ import annotations

import hashlib
import mimetypes
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path

from flask import Flask, Response, current_app, jsonify, request
from werkzeug.exceptions import HTTPException

from .auth import (
    AdminSessionManager,
    build_port_scoped_cookie_name,
    build_session_cookie_name_candidates,
)
from .config import load_system_config
from .constants import ADMIN_SESSION_COOKIE, APP_NAME, CONFIG_PATH, DATA_DIR, STATIC_DIR
from .helpers import get_product_min_unit
from .js_asset_versions import JavaScriptAssetVersionManager
from .logger import log_error
from .lunar_calendar import (
    PREORDER_REMINDER_WINDOW_DAYS,
    next_preorder_lunar_date,
    solar_to_vietnamese_lunar,
)
from .store import InventoryStore


LONG_LIVED_CACHE = "public, max-age=31536000, immutable"
SHORT_LIVED_CACHE = "public, max-age=3600"
REVALIDATED_CACHE = "no-cache, must-revalidate"


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
