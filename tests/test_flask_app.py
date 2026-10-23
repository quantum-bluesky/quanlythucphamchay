import json
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from urllib.request import urlopen
from wsgiref.simple_server import make_server

from qltpchay.auth import build_port_scoped_cookie_name
from qltpchay.constants import ADMIN_SESSION_COOKIE
from qltpchay.constants import DATA_DIR, DB_PATH


class FlaskAppFactoryTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(prefix="qltpchay-flask-test-")
        self.root = Path(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def build_app(self, name: str, admin_path: str = "/control-room"):
        from qltpchay.flask_app import create_app

        config = {
            "admin_path": admin_path,
            "version": "test",
            "admin": {"username": "test-admin", "password": "test-password"},
            "users": [
                {
                    "username": "staff",
                    "password": "staff-test-password",
                    "permissions": ["procurement_batch_manage"],
                }
            ],
            "image_root": str(self.root / f"{name}-images"),
            "public_web": {"thumbnail_size_mobile": 77},
            "zalo_login": {
                "require_zalo_login": False,
                "seller_zalo_url": "https://example.test/seller",
                "order_note_shipping": "Phí ship báo sau",
                "zalo_confirm_template": "Mã {order_id}",
            },
        }
        config["asset_versions_path"] = str(self.root / f"{name}-assets.json")
        return create_app(
            database_path=self.root / f"{name}.db",
            system_config=config,
            testing=True,
        )

    def test_ut_web_01_custom_admin_path_serves_admin_ui_and_root_stays_public(self):
        app = self.build_app("first")
        client = app.test_client()

        admin_response = client.get("/control-room")
        public_response = client.get("/")

        self.assertEqual(admin_response.status_code, 200)
        self.assertIn(b"adminLoginForm", admin_response.data)
        self.assertEqual(public_response.status_code, 200)
        self.assertNotIn(b"adminLoginForm", public_response.data)
        self.assertEqual(client.get("/admin").status_code, 404)

    def test_ut_web_02_factory_instances_keep_database_and_admin_route_independent(self):
        first = self.build_app("first", "/first-admin")
        second = self.build_app("second", "/second-admin")

        self.assertNotEqual(first.config["DATABASE_PATH"], second.config["DATABASE_PATH"])
        self.assertEqual(first.test_client().get("/first-admin").status_code, 200)
        self.assertEqual(first.test_client().get("/second-admin").status_code, 404)
        self.assertEqual(second.test_client().get("/second-admin").status_code, 200)
        self.assertFalse(DB_PATH.resolve().samefile(Path(first.config["DATABASE_PATH"])))

    def test_ut_web_03_testing_factory_rejects_runtime_database(self):
        from qltpchay.flask_app import create_app

        with self.assertRaisesRegex(ValueError, "runtime data directory"):
            create_app(
                database_path=DB_PATH,
                system_config={
                    "admin_path": "/admin",
                    "asset_versions_path": str(self.root / "assets.json"),
                },
                testing=True,
            )

    def test_ut_web_09_testing_factory_rejects_any_database_under_data_dir(self):
        from qltpchay.flask_app import create_app

        with self.assertRaisesRegex(ValueError, "runtime data directory"):
            create_app(
                database_path=DATA_DIR / "migration-test.db",
                system_config={},
                testing=True,
            )

    def test_ut_web_10_admin_subpath_static_asset_aliases(self):
        app = self.build_app("admin-assets", "/backoffice")
        client = app.test_client()

        root_asset = client.get("/static/styles.css")
        admin_asset = client.get("/backoffice/static/styles.css")

        self.assertEqual(root_asset.status_code, 200)
        self.assertEqual(admin_asset.status_code, 200)
        self.assertEqual(admin_asset.data, root_asset.data)

    def test_ut_web_11_admin_session_login_cookie_status_and_logout(self):
        app = self.build_app("admin-session", "/backoffice")
        client = app.test_client()

        login_response = client.post(
            "http://localhost:8130/backoffice/api/admin/login",
            json={"username": "test-admin", "password": "test-password"},
        )

        self.assertEqual(login_response.status_code, 200)
        self.assertEqual(login_response.get_json()["role"], "admin")
        self.assertIn(
            "qltpchay_admin_session_p8130=",
            " ".join(login_response.headers.getlist("Set-Cookie")),
        )
        status_response = client.get("http://localhost:8130/backoffice/api/session/status")
        self.assertTrue(status_response.get_json()["authenticated"])
        self.assertTrue(status_response.get_json()["is_admin"])

        logout_response = client.post("http://localhost:8130/api/admin/logout")

        self.assertEqual(logout_response.status_code, 200)
        self.assertEqual(logout_response.get_json()["message"], "Đã đăng xuất Master Admin.")
        self.assertFalse(logout_response.get_json()["authenticated"])
        self.assertTrue(
            any("Max-Age=0" in cookie for cookie in logout_response.headers.getlist("Set-Cookie"))
        )

    def test_ut_web_12_admin_login_rejects_normal_user_but_session_login_allows_it(self):
        app = self.build_app("user-session")
        client = app.test_client()

        rejected = client.post(
            "/api/admin/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        accepted = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )

        self.assertEqual(rejected.status_code, 401)
        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(accepted.get_json()["role"], "user")
        self.assertEqual(accepted.get_json()["permissions"], ["procurement_batch_manage"])

    def test_ut_web_13_wsgi_request_smoke_for_admin_and_public_routes(self):
        app = self.build_app("wsgi-smoke", "/admin-panel")
        server = make_server("127.0.0.1", 0, app)
        server_thread = threading.Thread(target=server.serve_forever, daemon=True)
        server_thread.start()
        try:
            with urlopen(f"http://127.0.0.1:{server.server_port}/admin-panel") as response:
                admin_html = response.read()
            with urlopen(f"http://127.0.0.1:{server.server_port}/") as response:
                public_html = response.read()
        finally:
            server.shutdown()
            server.server_close()
            server_thread.join(timeout=5)

        self.assertIn(b"adminLoginForm", admin_html)
        self.assertNotIn(b"adminLoginForm", public_html)

    def test_ut_web_14_session_status_matches_legacy_handler_contract(self):
        from qltpchay.flask_app import create_app
        from qltpchay.http_handler import create_handler

        config = {
            "admin_path": "/backoffice",
            "version": "test-parity",
            "admin": {"username": "test-admin", "password": "test-password"},
            "users": [],
            "asset_versions_path": str(self.root / "legacy-assets.json"),
            "image_root": str(self.root / "legacy-images"),
        }
        app = create_app(
            database_path=self.root / "session-parity.db",
            system_config=config,
            testing=True,
        )
        legacy_server = ThreadingHTTPServer(
            ("127.0.0.1", 0),
            create_handler(
                app.extensions["qltpchay.store"],
                app.extensions["qltpchay.admin_sessions"],
                system_config=config,
            ),
        )
        server_thread = threading.Thread(target=legacy_server.serve_forever, daemon=True)
        server_thread.start()
        try:
            with urlopen(
                f"http://127.0.0.1:{legacy_server.server_port}/backoffice/api/session/status"
            ) as response:
                legacy_payload = json.loads(response.read().decode("utf-8"))
        finally:
            legacy_server.shutdown()
            legacy_server.server_close()
            server_thread.join(timeout=5)

        flask_payload = app.test_client().get(
            "/backoffice/api/session/status"
        ).get_json()
        self.assertEqual(flask_payload, legacy_payload)

    def test_ut_web_15_public_order_submission_creates_online_cart(self):
        app = self.build_app("public-order-submit")
        store = app.extensions["qltpchay.store"]
        product = store.create_product(
            name="Sản phẩm đặt online",
            category="Đồ chay",
            unit="gói",
            price=10000,
            sale_price=15000,
        )

        response = app.test_client().post(
            "/api/public/orders",
            json={
                "customer_name": "Khách đặt Flask",
                "customer_phone": "0900000001",
                "items": [{"product_id": product["id"], "quantity": 2}],
            },
        )

        self.assertEqual(response.status_code, 201)
        result = response.get_json()
        self.assertEqual(result["message"], "Đã ghi nhận đơn hàng.")
        self.assertEqual(result["cart"]["created_mode"], "online")
        self.assertEqual(result["cart"]["items"][0]["quantity"], 2)

    def test_ut_web_16_public_order_submission_requires_zalo_from_injected_config(self):
        app = self.build_app("public-order-zalo")
        app.config["SYSTEM_CONFIG"]["zalo_login"]["require_zalo_login"] = True

        response = app.test_client().post(
            "/api/public/orders",
            json={
                "customer_name": "Khách thiếu Zalo",
                "items": [{"product_id": 1, "quantity": 1}],
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json(),
            {"error": "Hệ thống yêu cầu đăng nhập bằng Zalo để xác thực đặt hàng."},
        )

    def test_ut_web_17_public_order_submission_maps_store_validation_to_400(self):
        app = self.build_app("public-order-invalid")

        response = app.test_client().post(
            "/api/public/orders",
            json={"customer_name": "Khách không có hàng", "items": []},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "Giỏ hàng đang trống."})

    def test_ut_web_18_public_order_submission_logs_and_hides_unexpected_error(self):
        import qltpchay.flask_app as flask_app

        app = self.build_app("public-order-error")
        with patch.object(
            app.extensions["qltpchay.store"],
            "create_online_order",
            side_effect=RuntimeError("private backend detail"),
        ), patch.object(flask_app, "log_error") as log_error:
            response = app.test_client().post(
                "/api/public/orders",
                json={"customer_name": "Khách", "items": [{"product_id": 1, "quantity": 1}]},
            )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.get_json(), {"error": "Lỗi hệ thống nội bộ."})
        self.assertNotIn(b"private backend detail", response.data)
        self.assertTrue(log_error.call_args.kwargs["exc_info"])

    def test_ut_web_19_public_order_submission_supports_admin_prefix_alias(self):
        app = self.build_app("public-order-admin-alias", "/backoffice")
        store = app.extensions["qltpchay.store"]
        product = store.create_product(
            name="Sản phẩm qua prefix",
            category="Đồ chay",
            unit="gói",
            price=10000,
            sale_price=15000,
        )

        response = app.test_client().post(
            "/backoffice/api/public/orders",
            json={
                "customer_name": "Khách qua prefix",
                "items": [{"product_id": product["id"], "quantity": 1}],
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["cart"]["created_mode"], "online")

    def test_ut_web_20_products_route_returns_products_and_summary(self):
        app = self.build_app("products-list")
        store = app.extensions["qltpchay.store"]
        product = store.create_product(
            name="Sản phẩm danh mục",
            category="Đồ chay",
            unit="gói",
            price=10000,
            sale_price=15000,
        )

        response = app.test_client().get("/api/products")

        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual([row["id"] for row in result["products"]], [product["id"]])
        self.assertEqual(result["summary"]["product_count"], 1)

    def test_ut_web_21_products_route_requires_session_when_login_is_enabled(self):
        app = self.build_app("products-auth-required")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True

        response = app.test_client().get("/api/products")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json(), {"error": "Cần đăng nhập hệ thống."})

    def test_ut_web_22_products_route_accepts_authenticated_session(self):
        app = self.build_app("products-authenticated")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)

        response = client.get("/api/products")

        self.assertEqual(response.status_code, 200)
        self.assertIn("products", response.get_json())
        self.assertIn("summary", response.get_json())

    def test_ut_web_23_passive_products_request_does_not_extend_session(self):
        app = self.build_app("products-passive-session")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        sessions = app.extensions["qltpchay.admin_sessions"]
        session = sessions.login("staff", "staff-test-password")
        client = app.test_client()
        cookie_name = build_port_scoped_cookie_name(ADMIN_SESSION_COOKIE, "localhost")
        client.set_cookie(cookie_name, session["token"])
        last_activity_before = sessions._sessions[session["token"]]["last_activity_at"]

        response = client.get("/api/products", headers={"X-Session-Activity": "passive"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            sessions._sessions[session["token"]]["last_activity_at"],
            last_activity_before,
        )

    def test_ut_web_24_deleted_products_route_returns_soft_deleted_products(self):
        app = self.build_app("deleted-products")
        store = app.extensions["qltpchay.store"]
        product = store.create_product(
            name="Sản phẩm đã xóa",
            category="Đồ chay",
            unit="gói",
            price=10000,
            sale_price=15000,
        )
        store.delete_product(product["id"], actor="test-agent")

        response = app.test_client().get("/api/products/deleted")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [row["id"] for row in response.get_json()["products"]],
            [product["id"]],
        )

    def test_ut_web_25_product_history_route_preserves_filters_and_shape(self):
        app = self.build_app("product-history")
        store = app.extensions["qltpchay.store"]
        product = store.create_product(
            name="Sản phẩm lịch sử",
            category="Đồ chay",
            unit="gói",
            price=10000,
            sale_price=15000,
        )
        store.update_product_price(product["id"], 12000, actor="flask-history-user")

        response = app.test_client().get(
            "/api/products/history?limit=5&actor=flask-history-user"
        )

        self.assertEqual(response.status_code, 200)
        history = response.get_json()["history"]
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["product_id"], product["id"])
        self.assertEqual(history[0]["action"], "update-price")
        self.assertEqual(history[0]["actor"], "flask-history-user")

    def test_ut_web_26_product_movements_route_forwards_filters_and_response(self):
        app = self.build_app("product-movements-route")
        store = app.extensions["qltpchay.store"]
        expected = {"product": {"id": 12}, "movements": [], "summary": {"total_in": 0}}
        with patch.object(store, "get_product_movements", return_value=expected) as get_movements:
            response = app.test_client().get(
                "/api/product-movements?product_id=12&from_date=2026-01-01"
                "&to_date=2026-10-01&movement_type=in&keyword=receipt"
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), expected)
        get_movements.assert_called_once_with(
            product_id=12,
            from_date="2026-01-01",
            to_date="2026-10-01",
            movement_type="in",
            keyword="receipt",
        )

    def test_ut_web_27_product_movements_route_maps_invalid_product_id_to_400(self):
        app = self.build_app("product-movements-invalid")

        response = app.test_client().get("/api/product-movements")

        self.assertEqual(response.status_code, 400)
        self.assertIn("invalid literal", response.get_json()["error"])

    def test_ut_web_28_receipt_history_route_forwards_filters(self):
        app = self.build_app("receipt-history-route")
        store = app.extensions["qltpchay.store"]
        expected = [{"receipt_code": "receipt-test", "receipt_type": "purchase"}]
        with patch.object(store, "get_receipt_history", return_value=expected) as get_history:
            response = app.test_client().get(
                "/api/receipts/history?limit=12&receipt_type=purchase"
                "&start_date=2026-01-01&end_date=2026-10-01"
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"history": expected})
        get_history.assert_called_once_with(
            limit=12,
            receipt_type="purchase",
            start_date="2026-01-01",
            end_date="2026-10-01",
        )

    def test_ut_web_29_transactions_route_forwards_limit_and_response(self):
        app = self.build_app("transactions-route")
        store = app.extensions["qltpchay.store"]
        expected = [{"id": "transaction-test", "quantity": 3}]
        with patch.object(store, "get_transactions", return_value=expected) as get_transactions:
            response = app.test_client().get("/api/transactions?limit=37")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"transactions": expected})
        get_transactions.assert_called_once_with(limit=37)

    def test_ut_web_30_order_history_route_returns_cart_and_limited_history(self):
        app = self.build_app("order-history-route")
        store = app.extensions["qltpchay.store"]
        cart = {"id": "cart-history-1", "status": "draft"}
        history = [{"action": "created"}]
        with patch.object(store, "get_sync_state", return_value={"carts": [cart]}), patch.object(
            store, "get_cart_change_history", return_value=history
        ) as get_history:
            response = app.test_client().get("/api/orders/cart-history-1/history?limit=17")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"cart": cart, "history": history})
        get_history.assert_called_once_with("cart-history-1", limit=17)

    def test_ut_web_31_order_history_route_returns_400_when_cart_is_missing(self):
        app = self.build_app("order-history-missing")
        store = app.extensions["qltpchay.store"]
        with patch.object(store, "get_sync_state", return_value={"carts": []}):
            response = app.test_client().get("/api/orders/missing-cart/history")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "Không tìm thấy đơn hàng."})

    def test_ut_web_32_purchase_history_route_returns_document_and_limited_history(self):
        app = self.build_app("purchase-history-route")
        store = app.extensions["qltpchay.store"]
        purchase = {"id": "purchase-history-1", "status": "draft"}
        history = [{"action": "created"}]
        with patch.object(store, "get_sync_state", return_value={"purchases": [purchase]}), patch.object(
            store, "get_purchase_change_history", return_value=history
        ) as get_history:
            response = app.test_client().get("/api/purchases/purchase-history-1/history?limit=13")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"purchase": purchase, "history": history})
        get_history.assert_called_once_with("purchase-history-1", limit=13)

    def test_ut_web_33_purchase_history_route_returns_400_when_purchase_is_missing(self):
        app = self.build_app("purchase-history-missing")
        store = app.extensions["qltpchay.store"]
        with patch.object(store, "get_sync_state", return_value={"purchases": []}):
            response = app.test_client().get("/api/purchases/missing-purchase/history")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "Không tìm thấy phiếu nhập."})

    def test_ut_web_34_runtime_version_route_includes_runtime_and_app_metadata(self):
        app = self.build_app("runtime-version-route")
        store = app.extensions["qltpchay.store"]
        runtime = {"database_version": "test-db-version", "server_time": "2026-10-23T10:00:00"}
        with patch.object(store, "get_runtime_version", return_value=runtime):
            response = app.test_client().get("/api/runtime-version")

        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual(result["database_version"], runtime["database_version"])
        self.assertEqual(result["server_time"], runtime["server_time"])
        self.assertEqual(result["app"]["version"], "test")
        self.assertIn("debug", result)
        self.assertIn("pagination", result)

    def test_ut_web_35_monthly_report_route_forwards_filters(self):
        app = self.build_app("monthly-report-route")
        store = app.extensions["qltpchay.store"]
        expected = {"months": [], "totals": {"income": 100}}
        with patch.object(store, "get_monthly_report", return_value=expected) as get_report:
            response = app.test_client().get(
                "/api/reports/monthly?months=9&focus_month=2026-09"
                "&start_date=2026-01-01&end_date=2026-09-30"
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), expected)
        get_report.assert_called_once_with(
            months=9,
            focus_month="2026-09",
            start_date="2026-01-01",
            end_date="2026-09-30",
        )

    def test_ut_web_36_monthly_report_route_rejects_invalid_month_filter(self):
        app = self.build_app("monthly-report-invalid")

        response = app.test_client().get("/api/reports/monthly?months=invalid")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "Bộ lọc báo cáo không hợp lệ."})

    def test_ut_web_37_procurement_status_includes_config_permissions_and_lock_owner(self):
        app = self.build_app("procurement-status-route")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        app.config["SYSTEM_CONFIG"]["procurement"] = {
            "batch_lock_timeout_minutes": 75,
            "batch_planner_enabled": False,
            "allow_daily_quick_shortage_flow": True,
            "required_login_for_batch_mode": True,
        }
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)
        status = {"lock": {"owner_username": "staff"}, "active": True}
        store = app.extensions["qltpchay.store"]
        with patch.object(store, "get_procurement_status", return_value=status) as get_status:
            response = client.get("/api/procurement/status")

        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual(result["active"], True)
        self.assertEqual(result["config"]["batch_planner_enabled"], False)
        self.assertEqual(result["permissions"], {"can_manage_batch": True, "is_lock_owner": True})
        get_status.assert_called_once_with(lock_timeout_minutes=75)

    def test_ut_web_38_procurement_status_requires_session_when_login_is_enabled(self):
        app = self.build_app("procurement-status-auth")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True

        response = app.test_client().get("/api/procurement/status")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json(), {"error": "Cần đăng nhập hệ thống."})

    def test_ut_web_39_procurement_planner_forwards_scope_and_permissions(self):
        app = self.build_app("procurement-planner-route")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        app.config["SYSTEM_CONFIG"]["procurement"] = {
            "batch_lock_timeout_minutes": 91,
            "planner_manager_usernames": [],
        }
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)
        store = app.extensions["qltpchay.store"]
        planner = {"scope": {"type": "product", "code": "12"}, "items": []}
        status = {"lock": {"owner_username": "staff"}}
        with patch.object(store, "get_procurement_planner", return_value=planner) as get_planner, patch.object(
            store, "get_procurement_status", return_value=status
        ):
            response = client.get("/api/procurement/planner?scope=product&product_id=12")

        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual(result["scope"], planner["scope"])
        self.assertTrue(result["permissions"]["can_manage_batch"])
        self.assertTrue(result["permissions"]["is_lock_owner"])
        self.assertEqual(result["config"]["required_login_for_batch_mode"], True)
        get_planner.assert_called_once_with(
            scope_type="product",
            scope_code="12",
            lock_timeout_minutes=91,
        )

    def test_ut_web_40_procurement_planner_requires_login_setting_for_batch_mode(self):
        app = self.build_app("procurement-planner-login-config")
        app.config["SYSTEM_CONFIG"]["procurement"] = {
            "required_login_for_batch_mode": True,
        }

        response = app.test_client().get("/api/procurement/planner")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json(),
            {"error": "Batch mode cần bật EnableLogin để xác định người giữ khóa."},
        )

    def test_ut_web_41_procurement_planner_maps_invalid_scope_to_400(self):
        app = self.build_app("procurement-planner-invalid")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        app.config["SYSTEM_CONFIG"]["procurement"] = {
            "required_login_for_batch_mode": False,
        }
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)
        store = app.extensions["qltpchay.store"]
        with patch.object(
            store,
            "get_procurement_planner",
            side_effect=ValueError("Phạm vi xử lý nhập thiếu không hợp lệ."),
        ):
            response = client.get("/api/procurement/planner?scope=invalid")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json(),
            {"error": "Phạm vi xử lý nhập thiếu không hợp lệ."},
        )

    def test_ut_web_42_application_state_returns_aggregate_and_forwards_transaction_limit(self):
        app = self.build_app("application-state-route")
        store = app.extensions["qltpchay.store"]
        with (
            patch.object(store, "get_products", return_value=[{"id": 1}]),
            patch.object(store, "get_summary", return_value={"product_count": 1}),
            patch.object(store, "get_transactions", return_value=[{"id": "txn-1"}]) as get_transactions,
            patch.object(store, "get_runtime_version", return_value={"version": "test-runtime"}),
            patch.object(store, "get_procurement_status", return_value={"lock": {}}),
            patch.object(store, "list_bulk_order_requests", return_value=[]),
            patch.object(store, "list_document_cancel_requests", return_value=[]),
            patch.object(
                store,
                "get_sync_state",
                return_value={"customers": [], "suppliers": [], "carts": [], "purchases": []},
            ),
        ):
            response = app.test_client().get("/api/state?transaction_limit=31")

        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual(result["products"], [{"id": 1}])
        self.assertEqual(result["transactions"], [{"id": "txn-1"}])
        self.assertEqual(result["runtime_version"], {"version": "test-runtime"})
        self.assertEqual(result["customers"], [])
        self.assertEqual(result["procurement"]["permissions"]["can_manage_batch"], False)
        get_transactions.assert_called_once_with(limit=31)

    def test_ut_web_43_application_state_requires_session_when_login_is_enabled(self):
        app = self.build_app("application-state-auth")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True

        response = app.test_client().get("/api/state")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json(), {"error": "Cần đăng nhập hệ thống."})

    def test_ut_web_44_create_product_route_persists_product_and_returns_summary(self):
        app = self.build_app("product-create-route")
        response = app.test_client().post(
            "/api/products",
            json={
                "name": "Sản phẩm Flask mới",
                "category": "Đồ chay",
                "unit": "gói",
                "price": 12000,
                "sale_price": 18000,
                "unit_conversions": [],
                "default_purchase_unit": "gói",
                "default_sale_unit": "gói",
            },
        )

        self.assertEqual(response.status_code, 201)
        result = response.get_json()
        self.assertEqual(result["message"], "Đã thêm sản phẩm.")
        self.assertEqual(result["product"]["name"], "Sản phẩm Flask mới")
        self.assertEqual(result["summary"]["product_count"], 1)

    def test_ut_web_45_update_product_route_preserves_explicit_private_visibility(self):
        app = self.build_app("product-update-route")
        store = app.extensions["qltpchay.store"]
        product = store.create_product(
            name="Sản phẩm trước cập nhật",
            category="Đồ chay",
            unit="gói",
            price=10000,
            sale_price=15000,
        )

        response = app.test_client().put(
            f"/api/products/{product['id']}",
            json={
                "name": "Sản phẩm sau cập nhật",
                "category": "Đồ chay",
                "unit": "gói",
                "price": 11000,
                "sale_price": 16000,
                "low_stock_threshold": 5,
                "is_public": False,
                "unit_conversions": [],
            },
        )

        self.assertEqual(response.status_code, 200)
        updated = response.get_json()["product"]
        self.assertEqual(updated["name"], "Sản phẩm sau cập nhật")
        self.assertFalse(updated["is_public"])

    def test_ut_web_46_delete_product_route_soft_deletes_and_returns_summary(self):
        app = self.build_app("product-delete-route")
        store = app.extensions["qltpchay.store"]
        product = store.create_product(
            name="Sản phẩm cần xóa",
            category="Đồ chay",
            unit="gói",
            price=10000,
            sale_price=15000,
        )

        response = app.test_client().delete(f"/api/products/{product['id']}")

        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual(result["message"], "Đã chuyển sản phẩm sang danh mục đã xóa.")
        self.assertEqual(result["deleted"]["product_id"], product["id"])
        self.assertEqual(result["summary"]["product_count"], 0)

    def test_ut_web_47_create_product_route_maps_validation_error_to_400(self):
        app = self.build_app("product-create-invalid")

        response = app.test_client().post(
            "/api/products",
            json={"name": "", "category": "Đồ chay", "unit": "gói"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertTrue(response.get_json()["error"])

    def test_ut_web_48_update_product_purchase_price_route_returns_product_and_summary(self):
        app = self.build_app("product-purchase-price-route")
        store = app.extensions["qltpchay.store"]
        product = store.create_product(
            name="Sản phẩm giá nhập",
            category="Đồ chay",
            unit="gói",
            price=10000,
            sale_price=15000,
        )

        response = app.test_client().put(
            f"/api/products/{product['id']}/price",
            json={"price": 12500},
        )

        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual(result["message"], "Đã cập nhật giá nhập.")
        self.assertEqual(result["product"]["price"], 12500)
        self.assertEqual(result["summary"]["product_count"], 1)

    def test_ut_web_49_update_product_sale_price_route_returns_product_and_summary(self):
        app = self.build_app("product-sale-price-route")
        store = app.extensions["qltpchay.store"]
        product = store.create_product(
            name="Sản phẩm giá bán",
            category="Đồ chay",
            unit="gói",
            price=10000,
            sale_price=15000,
        )

        response = app.test_client().put(
            f"/api/products/{product['id']}/sale-price",
            json={"sale_price": 17500},
        )

        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual(result["message"], "Đã cập nhật giá bán.")
        self.assertEqual(result["product"]["sale_price"], 17500)
        self.assertEqual(result["summary"]["product_count"], 1)

    def test_ut_web_50_restore_product_route_restores_soft_deleted_product(self):
        app = self.build_app("product-restore-route")
        store = app.extensions["qltpchay.store"]
        product = store.create_product(
            name="Sản phẩm khôi phục",
            category="Đồ chay",
            unit="gói",
            price=10000,
            sale_price=15000,
        )
        store.delete_product(product["id"], actor="test-agent")

        response = app.test_client().post(f"/api/products/{product['id']}/restore", json={})

        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual(result["message"], "Đã khôi phục sản phẩm.")
        self.assertEqual(result["product"]["id"], product["id"])
        self.assertEqual(result["summary"]["product_count"], 1)

    def test_ut_web_51_change_base_unit_requires_master_admin_even_when_login_disabled(self):
        app = self.build_app("base-unit-admin-required")
        product = app.extensions["qltpchay.store"].create_product(
            name="Sản phẩm đổi đơn vị",
            category="Đồ chay",
            unit="gói",
            price=20000,
            sale_price=30000,
        )

        response = app.test_client().post(
            f"/api/products/{product['id']}/change-base-unit",
            json={"new_unit": "lạng", "conversion_rate": 2},
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json(), {"error": "Cần đăng nhập Master Admin."})

    def test_ut_web_52_change_base_unit_rejects_staff_session(self):
        app = self.build_app("base-unit-staff-rejected")
        product = app.extensions["qltpchay.store"].create_product(
            name="Sản phẩm đổi đơn vị",
            category="Đồ chay",
            unit="gói",
            price=20000,
            sale_price=30000,
        )
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)

        response = client.post(
            f"/api/products/{product['id']}/change-base-unit",
            json={"new_unit": "lạng", "conversion_rate": 2},
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json(), {"error": "Cần đăng nhập Master Admin."})

    def test_ut_web_53_change_base_unit_allows_master_admin_and_admin_prefix(self):
        app = self.build_app("base-unit-admin-success")
        product = app.extensions["qltpchay.store"].create_product(
            name="Sản phẩm đổi đơn vị",
            category="Đồ chay",
            unit="gói",
            price=20000,
            sale_price=30000,
        )
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "test-admin", "password": "test-password"},
        )
        self.assertEqual(login.status_code, 200)

        response = client.post(
            f"/control-room/api/products/{product['id']}/change-base-unit",
            json={"new_unit": "lạng", "conversion_rate": 2},
        )

        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual(result["message"], "Đã chuyển đổi đơn vị chính thành công sang 'lạng'.")
        self.assertEqual(result["product"]["unit"], "lạng")
        self.assertEqual(result["product"]["price"], 10000)

    def test_ut_web_54_hard_delete_product_requires_authenticated_session_when_enabled(self):
        app = self.build_app("product-hard-delete-auth")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        product = app.extensions["qltpchay.store"].create_product(
            name="Sản phẩm xóa hẳn",
            category="Đồ chay",
            unit="gói",
            price=10000,
            sale_price=15000,
        )

        response = app.test_client().delete(f"/api/admin/products/{product['id']}/hard")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json(), {"error": "Cần đăng nhập hệ thống."})

    def test_ut_web_55_hard_delete_product_rejects_staff(self):
        app = self.build_app("product-hard-delete-staff")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        product = app.extensions["qltpchay.store"].create_product(
            name="Sản phẩm xóa hẳn",
            category="Đồ chay",
            unit="gói",
            price=10000,
            sale_price=15000,
        )
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)

        response = client.delete(f"/control-room/api/admin/products/{product['id']}/hard")

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json(), {"error": "Cần đăng nhập Master Admin."})

    def test_ut_web_56_hard_delete_product_returns_legacy_result_for_admin(self):
        app = self.build_app("product-hard-delete-admin")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        store = app.extensions["qltpchay.store"]
        product = store.create_product(
            name="Sản phẩm xóa hẳn",
            category="Đồ chay",
            unit="gói",
            price=10000,
            sale_price=15000,
        )
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "test-admin", "password": "test-password"},
        )
        self.assertEqual(login.status_code, 200)

        response = client.delete(f"/control-room/api/admin/products/{product['id']}/hard")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {
            "product_id": product["id"],
            "product_name": "Sản phẩm xóa hẳn",
            "message": "Đã xóa hẳn sản phẩm khỏi hệ thống.",
        })
        self.assertEqual(store.get_products(include_deleted=True), [])

    def test_ut_web_57_product_image_upload_saves_binary_and_serves_returned_url(self):
        app = self.build_app("product-image-upload")
        client = app.test_client()

        response = client.post(
            "/api/products/images/upload?filename=sample.svg",
            data=b"<svg xmlns='http://www.w3.org/2000/svg'></svg>",
            content_type="application/octet-stream",
        )

        self.assertEqual(response.status_code, 200)
        image_url = response.get_json()["url"]
        self.assertTrue(image_url.startswith("/images/products/"))
        served_image = client.get(image_url)
        self.assertEqual(served_image.status_code, 200)
        self.assertEqual(served_image.data, b"<svg xmlns='http://www.w3.org/2000/svg'></svg>")

    def test_ut_web_58_product_image_upload_uses_configured_admin_prefix_and_safe_extension(self):
        app = self.build_app("product-image-upload-prefix")

        response = app.test_client().post(
            "/control-room/api/products/images/upload?filename=payload.exe",
            data=b"opaque image payload",
            content_type="application/octet-stream",
        )

        self.assertEqual(response.status_code, 200)
        image_url = response.get_json()["url"]
        self.assertTrue(image_url.endswith(".jpg"))
        self.assertEqual(app.test_client().get(image_url).data, b"opaque image payload")

    def test_ut_web_59_bulk_order_request_history_preserves_request_and_limit(self):
        app = self.build_app("bulk-order-request-history")
        store = app.extensions["qltpchay.store"]
        request_doc = {"id": "bulk-1", "status": "pending"}
        history = [{"action": "created"}]
        with patch.object(store, "get_bulk_order_request", return_value=request_doc), patch.object(
            store, "get_bulk_order_request_change_history", return_value=history
        ) as get_history:
            response = app.test_client().get(
                "/api/orders/bulk-requests/bulk-1/history?limit=9"
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"request": request_doc, "history": history})
        get_history.assert_called_once_with("bulk-1", limit=9)

    def test_ut_web_60_document_cancel_request_history_returns_400_when_missing(self):
        app = self.build_app("cancel-request-history-missing")
        store = app.extensions["qltpchay.store"]
        with patch.object(store, "get_document_cancel_request", return_value=None):
            response = app.test_client().get(
                "/control-room/api/document-cancel-requests/missing/history"
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "Không tìm thấy yêu cầu hủy."})

    def test_ut_web_61_admin_settings_reads_require_master_admin_and_redact_mail_password(self):
        app = self.build_app("admin-config-read")
        app.config["SYSTEM_CONFIG"]["public_web"] = {"enabled": True}
        app.config["SYSTEM_CONFIG"]["mail"] = {
            "enabled": True,
            "smtp_host": "smtp.example.test",
            "smtp_port": 465,
            "username": "mailer",
            "password": "secret-value",
            "to_emails": [" ops@example.test ", ""],
            "use_ssl": True,
        }
        client = app.test_client()

        denied = client.get("/api/admin/mail-config")
        login = client.post(
            "/api/admin/login",
            json={"username": "test-admin", "password": "test-password"},
        )
        self.assertEqual(login.status_code, 200)
        public_web = client.get("/control-room/api/admin/public-web-config")
        mail = client.get("/api/admin/mail-config")

        self.assertEqual(denied.status_code, 401)
        self.assertEqual(denied.get_json(), {"error": "Cần đăng nhập Master Admin."})
        self.assertEqual(public_web.get_json()["public_web"], {"enabled": True})
        mail_payload = mail.get_json()
        self.assertTrue(mail_payload["mail"]["has_password"])
        self.assertNotIn("password", mail_payload["mail"])
        self.assertEqual(mail_payload["mail"]["to_emails"], ["ops@example.test"])

    def test_ut_web_62_admin_legacy_audit_route_returns_store_payload(self):
        app = self.build_app("admin-legacy-audit")
        store = app.extensions["qltpchay.store"]
        expected = {"issues": [], "summary": {"count": 0}}
        client = app.test_client()
        login = client.post(
            "/api/admin/login",
            json={"username": "test-admin", "password": "test-password"},
        )
        self.assertEqual(login.status_code, 200)
        with patch.object(store, "get_legacy_data_audit", return_value=expected):
            response = client.get("/control-room/api/admin/legacy-audit")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), expected)

    def test_ut_web_63_admin_master_json_export_preserves_payload_and_download_header(self):
        app = self.build_app("admin-export-json")
        store = app.extensions["qltpchay.store"]
        expected = {"entity": "products", "records": [{"name": "Đậu hũ"}]}
        client = app.test_client()
        login = client.post(
            "/api/admin/login",
            json={"username": "test-admin", "password": "test-password"},
        )
        self.assertEqual(login.status_code, 200)
        with patch.object(store, "export_master_data", return_value=expected):
            response = client.get("/control-room/api/admin/export/products?format=json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), expected)
        self.assertEqual(response.mimetype, "application/json")
        self.assertIn("attachment; filename=\"products-master-", response.headers["Content-Disposition"])

    def test_ut_web_64_admin_master_csv_export_preserves_columns_and_utf8_bom(self):
        app = self.build_app("admin-export-csv")
        store = app.extensions["qltpchay.store"]
        record = {"id": 1, "name": "Đậu hũ", "images": ["/images/products/a.png"]}
        client = app.test_client()
        login = client.post(
            "/api/admin/login",
            json={"username": "test-admin", "password": "test-password"},
        )
        self.assertEqual(login.status_code, 200)
        with patch.object(store, "export_master_data", return_value={"records": [record]}):
            response = client.get("/api/admin/export/products?format=csv")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[:3], b"\xef\xbb\xbf")
        self.assertIn("id,global_id,name,category,unit,price,sale_price", response.data.decode("utf-8-sig"))
        self.assertIn('"[""/images/products/a.png""]"', response.data.decode("utf-8-sig"))
        self.assertTrue(response.headers["Content-Disposition"].endswith(".csv\""))

    def test_ut_web_65_admin_master_export_rejects_unsupported_format(self):
        app = self.build_app("admin-export-invalid-format")
        client = app.test_client()
        login = client.post(
            "/api/admin/login",
            json={"username": "test-admin", "password": "test-password"},
        )
        self.assertEqual(login.status_code, 200)

        response = client.get("/api/admin/export/products?format=xml")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json(),
            {"error": "Định dạng export không hợp lệ. Chỉ hỗ trợ json/csv."},
        )

    def test_ut_web_66_admin_database_backup_requires_master_admin_and_downloads_file(self):
        app = self.build_app("admin-backup")
        store = app.extensions["qltpchay.store"]
        backup_path = self.root / "inventory-backup-fixture.db"
        backup_path.write_bytes(b"SQLite fixture backup")
        client = app.test_client()

        denied = client.get("/api/admin/backup")
        login = client.post(
            "/api/admin/login",
            json={"username": "test-admin", "password": "test-password"},
        )
        self.assertEqual(login.status_code, 200)
        with patch.object(store, "create_database_backup", return_value=backup_path):
            response = client.get("/control-room/api/admin/backup")

        self.assertEqual(denied.status_code, 401)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, b"SQLite fixture backup")
        self.assertEqual(response.mimetype, "application/octet-stream")
        self.assertEqual(
            response.headers["Content-Disposition"],
            'attachment; filename=inventory-backup-fixture.db',
        )
        response.close()

    def test_ut_web_67_state_write_requires_session_when_login_enabled(self):
        app = self.build_app("state-write-auth")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True

        response = app.test_client().put("/api/state", json={"products": []})

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json(), {"error": "Cần đăng nhập hệ thống."})

    def test_ut_web_68_state_write_passes_actor_role_and_keeps_aggregate_response(self):
        app = self.build_app("state-write-success")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        store = app.extensions["qltpchay.store"]
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)
        expected_sync = {"saved": True, "updated_at": "2026-10-23T00:00:00Z"}
        payload = {"products": [], "expected_updated_at": {}}
        with patch.object(store, "save_sync_state", return_value=expected_sync) as save_state:
            response = client.put("/control-room/api/state", json=payload)

        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual(result["message"], "Đã lưu dữ liệu đồng bộ.")
        self.assertTrue(result["saved"])
        self.assertIn("runtime_version", result)
        saved_payload = save_state.call_args.args[0]
        self.assertEqual(saved_payload["actor"], "staff")
        self.assertEqual(save_state.call_args.kwargs["actor_username"], "staff")
        self.assertEqual(save_state.call_args.kwargs["actor_role"], "user")

    def test_ut_web_69_state_write_maps_conflict_details_to_409(self):
        from qltpchay.store import SyncConflictError

        app = self.build_app("state-write-conflict")
        store = app.extensions["qltpchay.store"]
        with patch.object(
            store,
            "save_sync_state",
            side_effect=SyncConflictError("products", "expected-ts", "actual-ts"),
        ):
            response = app.test_client().put("/api/state", json={"products": []})

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["conflict"], {
            "state_key": "products",
            "expected_updated_at": "expected-ts",
            "actual_updated_at": "actual-ts",
        })

    def test_ut_web_70_state_write_rejects_non_object_json(self):
        app = self.build_app("state-write-invalid-json")

        response = app.test_client().put("/api/state", json=["invalid", "shape"])

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "Dữ liệu JSON không hợp lệ."})

    def test_ut_web_71_transaction_create_requires_permission_even_when_login_disabled(self):
        app = self.build_app("transaction-create-auth")

        response = app.test_client().post(
            "/api/transactions",
            json={"product_id": 1, "transaction_type": "nhập", "quantity": 1},
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            response.get_json(),
            {"error": "Cần đăng nhập tài khoản có quyền điều chỉnh tồn."},
        )

    def test_ut_web_72_transaction_create_rejects_staff_without_inventory_permission(self):
        app = self.build_app("transaction-create-staff")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)

        response = client.post(
            "/api/transactions",
            json={"product_id": 1, "transaction_type": "nhập", "quantity": 1},
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            response.get_json(),
            {"error": "Tài khoản này không có quyền điều chỉnh tồn trực tiếp."},
        )

    def test_ut_web_73_transaction_create_passes_actor_and_returns_summary(self):
        app = self.build_app("transaction-create-authorized")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        sessions = app.extensions["qltpchay.admin_sessions"]
        sessions._users[0]["permissions"].append("inventory_adjust_manage")
        store = app.extensions["qltpchay.store"]
        transaction = {"id": 99, "product_id": 1, "quantity": 2}
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)
        with patch.object(store, "create_transaction", return_value=transaction) as create:
            response = client.post(
                "/control-room/api/transactions",
                json={
                    "product_id": 1,
                    "transaction_type": "nhập",
                    "quantity": 2,
                    "batch_code": "LOT-1",
                    "expiry_date": "2027-01-01",
                },
            )

        self.assertEqual(response.status_code, 201)
        result = response.get_json()
        self.assertEqual(result["message"], "Đã cập nhật tồn kho.")
        self.assertEqual(result["transaction"], transaction)
        self.assertEqual(result["summary"]["product_count"], 0)
        self.assertEqual(create.call_args.kwargs["actor"], "staff")
        self.assertEqual(create.call_args.kwargs["batch_code"], "LOT-1")

    def test_ut_web_74_transaction_create_maps_invalid_product_id_to_400(self):
        app = self.build_app("transaction-create-invalid")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "test-admin", "password": "test-password"},
        )
        self.assertEqual(login.status_code, 200)

        response = client.post(
            "/api/transactions",
            json={"product_id": "invalid", "transaction_type": "nhập", "quantity": 1},
        )

        self.assertEqual(response.status_code, 400)
        self.assertTrue(response.get_json()["error"])

    def test_ut_web_75_checkout_route_preserves_order_response_and_payload(self):
        app = self.build_app("checkout-route")
        store = app.extensions["qltpchay.store"]
        order = {"order_code": "ORD-1", "total": 25000}
        payload = {
            "customer_name": "Khách thử",
            "items": [{"product_id": 3, "quantity": 2}],
            "note": "Giao buổi sáng",
            "discount_amount": 5000,
        }
        with patch.object(store, "create_checkout_order", return_value=order) as checkout:
            response = app.test_client().post("/api/orders/checkout", json=payload)

        self.assertEqual(response.status_code, 201)
        result = response.get_json()
        self.assertEqual(result["message"], "Đã chốt giỏ hàng và xuất kho.")
        self.assertEqual(result["order"], order)
        self.assertEqual(checkout.call_args.kwargs, {
            "customer_name": "Khách thử",
            "items": [{"product_id": 3, "quantity": 2}],
            "note": "Giao buổi sáng",
            "discount_amount": 5000,
        })

    def test_ut_web_76_quick_create_route_preserves_summary_and_actor(self):
        app = self.build_app("quick-create-route")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        store = app.extensions["qltpchay.store"]
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)
        quick_summary = {"created_count": 1}
        quick_result = {
            "message": "Đã tạo đơn nhanh.",
            "cart": {"id": "cart-1"},
            "order": {"order_code": "ORD-2"},
            "summary": quick_summary,
            "carts": [{"id": "cart-1"}],
            "customers": [{"id": "customer-1"}],
        }
        with patch.object(store, "create_quick_sale", return_value=quick_result) as quick_create:
            response = client.post(
                "/control-room/api/orders/quick-create",
                json={
                    "customer_name": "Khách nhanh",
                    "items": [{"product_id": 4, "quantity": 1}],
                    "mark_paid": True,
                    "payment_method": "cash",
                },
            )

        self.assertEqual(response.status_code, 201)
        result = response.get_json()
        self.assertEqual(result["quick_summary"], quick_summary)
        self.assertEqual(result["cart"], {"id": "cart-1"})
        self.assertEqual(quick_create.call_args.kwargs["actor_username"], "staff")
        self.assertEqual(quick_create.call_args.kwargs["mark_paid"], True)

    def test_ut_web_77_commit_order_maps_missing_cart_to_400(self):
        app = self.build_app("commit-order-invalid")
        store = app.extensions["qltpchay.store"]
        with patch.object(store, "commit_cart_order", side_effect=ValueError("Đơn không tồn tại.")):
            response = app.test_client().post("/api/orders/commit", json={"cart_id": "missing"})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "Đơn không tồn tại."})

    def test_ut_web_78_bulk_create_without_login_uses_direct_store_path(self):
        app = self.build_app("bulk-create-direct")
        store = app.extensions["qltpchay.store"]
        result = {"created_count": 2}
        with patch.object(store, "bulk_create_orders", return_value=result) as bulk_create:
            response = app.test_client().post(
                "/api/orders/bulk-create",
                json={
                    "mode": "save_drafts",
                    "requestId": "request-78",
                    "orders": [{"customer_name": "A"}],
                    "allowDuplicates": True,
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["message"], "Đã lưu các đơn nháp.")
        self.assertEqual(response.get_json()["created_count"], 2)
        self.assertEqual(bulk_create.call_args.kwargs["request_id"], "request-78")
        self.assertTrue(bulk_create.call_args.kwargs["allow_duplicates"])

    def test_ut_web_79_bulk_create_requires_permission_when_login_enabled(self):
        app = self.build_app("bulk-create-no-permission")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)

        response = client.post("/api/orders/bulk-create", json={"mode": "save_drafts"})

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json(), {"error": "Tài khoản này không có quyền tạo nhiều đơn."})

    def test_ut_web_80_bulk_create_user_without_manager_permission_creates_approval_request(self):
        app = self.build_app("bulk-create-approval")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        app.extensions["qltpchay.admin_sessions"]._users[0]["permissions"].append("bulk_order_create")
        store = app.extensions["qltpchay.store"]
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)
        request_result = {"request_id": "approval-1", "status": "pending"}
        with patch.object(store, "create_bulk_order_request", return_value=request_result) as create_request:
            response = client.post(
                "/control-room/api/orders/bulk-create",
                json={"mode": "save_drafts", "request_id": "approval-1", "orders": []},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["message"], "Đã gửi yêu cầu lưu nhiều đơn nháp để chờ duyệt.")
        self.assertEqual(create_request.call_args.kwargs["actor"], "staff")

    def test_ut_web_81_bulk_commit_requires_bulk_commit_permission(self):
        app = self.build_app("bulk-commit-permission")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        app.extensions["qltpchay.admin_sessions"]._users[0]["permissions"].append("bulk_order_create")
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)

        response = client.post("/api/orders/bulk-create", json={"mode": "commit_valid"})

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json(), {"error": "Tài khoản này không có quyền chốt nhiều đơn."})

    def test_ut_web_82_bulk_create_duplicate_request_returns_conflict_metadata(self):
        from qltpchay.store import BulkOrderRequestDuplicateError

        app = self.build_app("bulk-create-duplicate")
        store = app.extensions["qltpchay.store"]
        duplicates = [{"request_id": "duplicate-82"}]
        with patch.object(
            store,
            "bulk_create_orders",
            side_effect=BulkOrderRequestDuplicateError("Yêu cầu bị trùng.", duplicates=duplicates),
        ):
            response = app.test_client().post(
                "/api/orders/bulk-create",
                json={"mode": "save_drafts", "request_id": "duplicate-82"},
            )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json(), {
            "error": "Yêu cầu bị trùng.",
            "code": "bulk_order_duplicate_request",
            "duplicates": duplicates,
            "approval_required": False,
            "can_continue": False,
        })

    def test_ut_web_83_approve_bulk_request_requires_manager_permission(self):
        app = self.build_app("bulk-approve-permission")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)

        response = client.post("/api/orders/bulk-requests/request-83/approve", json={})

        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            response.get_json(),
            {"error": "Tài khoản này không có quyền duyệt yêu cầu xuất nhanh."},
        )

    def test_ut_web_84_approve_bulk_request_returns_request_and_queue(self):
        app = self.build_app("bulk-approve-success")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        store = app.extensions["qltpchay.store"]
        client = app.test_client()
        login = client.post(
            "/api/admin/login",
            json={"username": "test-admin", "password": "test-password"},
        )
        self.assertEqual(login.status_code, 200)
        request_doc = {"id": "request-84", "status": "approved"}
        queue = [request_doc]
        with patch.object(store, "approve_bulk_order_request", return_value=request_doc) as approve, patch.object(
            store, "list_bulk_order_requests", return_value=queue
        ):
            response = client.post(
                "/control-room/api/orders/bulk-requests/request-84/approve",
                json={},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["request"], request_doc)
        self.assertEqual(response.get_json()["bulk_order_requests"], queue)
        self.assertEqual(approve.call_args.kwargs["actor"], "test-admin")

    def test_ut_web_85_reject_bulk_request_passes_reason_and_manager_actor(self):
        app = self.build_app("bulk-reject-success")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        app.extensions["qltpchay.admin_sessions"]._users[0]["permissions"].append("order_batch_manage")
        store = app.extensions["qltpchay.store"]
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)
        request_doc = {"id": "request-85", "status": "rejected"}
        with patch.object(store, "reject_bulk_order_request", return_value=request_doc) as reject, patch.object(
            store, "list_bulk_order_requests", return_value=[request_doc]
        ):
            response = client.post(
                "/api/orders/bulk-requests/request-85/reject",
                json={"reason": "Thiếu thông tin."},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["message"], "Đã reject yêu cầu xuất nhanh.")
        self.assertEqual(reject.call_args.kwargs["actor"], "staff")
        self.assertEqual(reject.call_args.kwargs["reason"], "Thiếu thông tin.")

    def test_ut_web_86_bulk_request_owner_can_delete_own_pending_request(self):
        app = self.build_app("bulk-delete-owner")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        store = app.extensions["qltpchay.store"]
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)
        request_doc = {"id": "request-86", "requested_by": "staff"}
        deleted = {"id": "request-86", "status": "deleted"}
        with patch.object(store, "get_bulk_order_request", return_value=request_doc), patch.object(
            store, "delete_bulk_order_request", return_value=deleted
        ) as delete, patch.object(store, "list_bulk_order_requests", return_value=[]):
            response = client.post("/api/orders/bulk-requests/request-86/delete", json={})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["request"], deleted)
        self.assertEqual(delete.call_args.kwargs, {"actor": "staff", "can_manage": False})

    def test_ut_web_87_bulk_request_delete_rejects_non_owner(self):
        app = self.build_app("bulk-delete-not-owner")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        store = app.extensions["qltpchay.store"]
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)
        with patch.object(
            store,
            "get_bulk_order_request",
            return_value={"id": "request-87", "requested_by": "another-user"},
        ):
            response = client.post("/api/orders/bulk-requests/request-87/delete", json={})

        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            response.get_json(),
            {"error": "Chỉ owner hoặc user quản lý mới được xóa yêu cầu xuất nhanh này."},
        )

    def test_ut_web_88_bulk_request_owner_can_process_approved_request(self):
        app = self.build_app("bulk-process-owner")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        store = app.extensions["qltpchay.store"]
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)
        result = {"processed_count": 2}
        with patch.object(
            store,
            "get_bulk_order_request",
            return_value={"id": "request-88", "requested_by": "staff"},
        ), patch.object(store, "process_bulk_order_request", return_value=result) as process, patch.object(
            store, "list_bulk_order_requests", return_value=[]
        ):
            response = client.post("/control-room/api/orders/bulk-requests/request-88/process", json={})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["processed_count"], 2)
        self.assertEqual(process.call_args.kwargs["actor"], "staff")

    def test_ut_web_89_bulk_request_process_returns_400_when_missing(self):
        app = self.build_app("bulk-process-missing")
        store = app.extensions["qltpchay.store"]
        with patch.object(store, "get_bulk_order_request", return_value=None):
            response = app.test_client().post(
                "/api/orders/bulk-requests/missing/process",
                json={},
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "Không tìm thấy yêu cầu xuất nhanh."})

    def test_ut_web_90_cancel_request_requires_login_configuration(self):
        app = self.build_app("cancel-request-login-disabled")

        response = app.test_client().post(
            "/api/orders/order-90/cancel-request",
            json={"reason": "Nhập nhầm."},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json(),
            {"error": "Cần bật EnableLogin để dùng luồng hủy có phê duyệt."},
        )

    def test_ut_web_91_order_cancel_request_keeps_request_and_mail_success_message(self):
        app = self.build_app("order-cancel-request")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        store = app.extensions["qltpchay.store"]
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)
        request_doc = {
            "request_id": "cancel-91",
            "document_type": "order",
            "document_code": "ORD-91",
            "requested_by": "staff",
            "cancel_reason": "Nhập nhầm.",
        }
        with patch.object(store, "create_document_cancel_request", return_value=request_doc) as create_request, patch.object(
            store, "list_document_cancel_requests", return_value=[request_doc]
        ), patch("qltpchay.flask_app.send_mail_notification", return_value={"sent": True, "skipped": False}) as send_mail:
            response = client.post(
                "/control-room/api/orders/order-91/cancel-request",
                json={"reason": "Nhập nhầm."},
            )

        self.assertEqual(response.status_code, 201)
        result = response.get_json()
        self.assertEqual(result["message"], "Đã gửi yêu cầu hủy đơn chờ phê duyệt.")
        self.assertEqual(result["notification_message"], "Đã gửi mail thông báo phê duyệt.")
        self.assertEqual(result["document_cancel_requests"], [request_doc])
        self.assertEqual(create_request.call_args.kwargs["actor"], "staff")
        self.assertIn("ORD-91", send_mail.call_args.kwargs["subject"])

    def test_ut_web_92_purchase_cancel_request_preserves_request_when_mail_fails(self):
        app = self.build_app("purchase-cancel-request")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        store = app.extensions["qltpchay.store"]
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)
        request_doc = {"request_id": "cancel-92", "document_type": "purchase"}
        with patch.object(store, "create_document_cancel_request", return_value=request_doc), patch.object(
            store, "list_document_cancel_requests", return_value=[request_doc]
        ), patch(
            "qltpchay.flask_app.send_mail_notification",
            return_value={"sent": False, "skipped": False, "reason": "smtp offline"},
        ):
            response = client.post(
                "/api/purchases/purchase-92/cancel-request",
                json={"reason": "Phiếu trùng."},
            )

        self.assertEqual(response.status_code, 201)
        result = response.get_json()
        self.assertEqual(result["message"], "Đã gửi yêu cầu hủy phiếu nhập chờ phê duyệt.")
        self.assertEqual(
            result["notification_warning"],
            "Không gửi được mail thông báo, nhưng yêu cầu hủy đã được lưu.",
        )
        self.assertEqual(result["request"], request_doc)

    def test_ut_web_93_document_cancel_approval_requires_login_and_permission(self):
        app = self.build_app("cancel-approval-requires-login")
        disabled = app.test_client().post(
            "/api/document-cancel-requests/request-93/approve",
            json={},
        )
        self.assertEqual(disabled.status_code, 400)
        self.assertEqual(
            disabled.get_json(),
            {"error": "Cần bật EnableLogin để dùng luồng hủy có phê duyệt."},
        )

        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)
        denied = client.post(
            "/api/document-cancel-requests/request-93/approve",
            json={},
        )
        self.assertEqual(denied.status_code, 401)
        self.assertEqual(
            denied.get_json(),
            {"error": "Tài khoản này không có quyền duyệt yêu cầu hủy chứng từ."},
        )

    def test_ut_web_94_approve_document_cancel_returns_sync_state_and_summary(self):
        app = self.build_app("cancel-approval-admin")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        store = app.extensions["qltpchay.store"]
        client = app.test_client()
        login = client.post(
            "/api/admin/login",
            json={"username": "test-admin", "password": "test-password"},
        )
        self.assertEqual(login.status_code, 200)
        approved = {"cancelled": True, "request": {"id": "request-94"}}
        sync_state = {"carts": [], "purchases": []}
        with patch.object(store, "approve_document_cancel_request", return_value=approved) as approve, patch.object(
            store, "list_document_cancel_requests", return_value=[]
        ), patch.object(store, "get_sync_state", return_value=sync_state):
            response = client.post(
                "/control-room/api/document-cancel-requests/request-94/approve",
                json={},
            )

        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual(result["message"], "Đã duyệt và hủy chứng từ.")
        self.assertTrue(result["cancelled"])
        self.assertEqual(result["carts"], [])
        self.assertEqual(approve.call_args.kwargs["actor"], "test-admin")

    def test_ut_web_95_reject_document_cancel_passes_reason(self):
        app = self.build_app("cancel-reject-admin")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        store = app.extensions["qltpchay.store"]
        client = app.test_client()
        login = client.post(
            "/api/admin/login",
            json={"username": "test-admin", "password": "test-password"},
        )
        self.assertEqual(login.status_code, 200)
        request_doc = {"id": "request-95", "status": "rejected"}
        with patch.object(store, "reject_document_cancel_request", return_value=request_doc) as reject, patch.object(
            store, "list_document_cancel_requests", return_value=[request_doc]
        ):
            response = client.post(
                "/api/document-cancel-requests/request-95/reject",
                json={"reason": "Không đủ căn cứ."},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["request"], request_doc)
        self.assertEqual(reject.call_args.kwargs["actor"], "test-admin")
        self.assertEqual(reject.call_args.kwargs["reason"], "Không đủ căn cứ.")

    def test_ut_web_96_ship_order_requires_session_when_login_enabled(self):
        app = self.build_app("ship-order-auth")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True

        response = app.test_client().post("/api/orders/ship", json={"cart_id": "cart-96"})

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json(), {"error": "Cần đăng nhập hệ thống."})

    def test_ut_web_97_ship_order_passes_dates_actor_and_returns_summary(self):
        app = self.build_app("ship-order-success")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        store = app.extensions["qltpchay.store"]
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)
        ship_result = {"cart": {"id": "cart-97"}, "order": {"order_code": "ORD-97"}}
        with patch.object(store, "ship_cart_order", return_value=ship_result) as ship:
            response = client.post(
                "/control-room/api/orders/ship",
                json={"cart_id": "cart-97", "shipped_at": "2026-10-23T10:00:00Z", "ship_date": "2026-10-23"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["order"], ship_result["order"])
        self.assertEqual(ship.call_args.kwargs["actor"], "staff")
        self.assertEqual(ship.call_args.kwargs["ship_date"], "2026-10-23")

    def test_ut_web_98_receive_purchase_passes_role_dates_and_returns_created_response(self):
        app = self.build_app("receive-purchase-success")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        store = app.extensions["qltpchay.store"]
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)
        received = {
            "message": "Đã nhập kho.",
            "receipt": {"id": 97},
            "purchase": {"id": "purchase-97"},
            "purchases": [{"id": "purchase-97"}],
        }
        with patch.object(store, "receive_purchase", return_value=received) as receive:
            response = client.post(
                "/api/purchases/receive",
                json={
                    "purchase_id": "purchase-97",
                    "discount_amount": 1500,
                    "received_at": "2026-10-23T10:30:00Z",
                    "received_date": "2026-10-23",
                },
            )

        self.assertEqual(response.status_code, 201)
        result = response.get_json()
        self.assertEqual(result["receipt"], received["receipt"])
        self.assertEqual(result["purchase"], received["purchase"])
        self.assertEqual(receive.call_args.kwargs["actor_username"], "staff")
        self.assertEqual(receive.call_args.kwargs["actor_role"], "user")
        self.assertEqual(receive.call_args.kwargs["received_date"], "2026-10-23")

    def test_ut_web_99_receive_purchase_maps_validation_error_to_400(self):
        app = self.build_app("receive-purchase-invalid")
        store = app.extensions["qltpchay.store"]
        with patch.object(store, "receive_purchase", side_effect=ValueError("Phiếu nhập không tồn tại.")):
            response = app.test_client().post(
                "/api/purchases/receive",
                json={"purchase_id": "missing"},
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "Phiếu nhập không tồn tại."})

    def test_ut_web_100_quick_create_purchase_preserves_actor_role_and_response(self):
        app = self.build_app("quick-create-purchase")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        store = app.extensions["qltpchay.store"]
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)
        quick_result = {
            "message": "Đã tạo phiếu nhập nhanh.",
            "purchase": {"id": "purchase-100"},
            "receipt": {"id": 100},
            "summary": {"created_count": 1},
            "purchases": [{"id": "purchase-100"}],
            "suppliers": [{"id": "supplier-1"}],
        }
        with patch.object(store, "create_quick_purchase", return_value=quick_result) as create:
            response = client.post(
                "/control-room/api/purchases/quick-create",
                json={
                    "supplier_id": "supplier-1",
                    "items": [{"product_id": 1, "quantity": 3}],
                    "mark_paid": True,
                    "payment_method": "cash",
                    "target_purchase_id": "purchase-100",
                },
            )

        self.assertEqual(response.status_code, 201)
        result = response.get_json()
        self.assertEqual(result["quick_summary"], {"created_count": 1})
        self.assertEqual(result["receipt"], {"id": 100})
        self.assertEqual(create.call_args.kwargs["actor_username"], "staff")
        self.assertEqual(create.call_args.kwargs["actor_role"], "user")
        self.assertTrue(create.call_args.kwargs["mark_paid"])

    def test_ut_web_101_mark_purchase_paid_passes_payment_and_actor_fields(self):
        app = self.build_app("purchase-mark-paid")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        store = app.extensions["qltpchay.store"]
        client = app.test_client()
        login = client.post(
            "/api/admin/login",
            json={"username": "test-admin", "password": "test-password"},
        )
        self.assertEqual(login.status_code, 200)
        payment_result = {
            "message": "Đã thanh toán phiếu nhập.",
            "purchase": {"id": "purchase-101", "status": "paid"},
            "purchases": [{"id": "purchase-101", "status": "paid"}],
        }
        with patch.object(store, "mark_purchase_paid", return_value=payment_result) as mark_paid:
            response = client.post(
                "/api/purchases/mark-paid",
                json={
                    "purchase_id": "purchase-101",
                    "discount_amount": 2000,
                    "paid_at": "2026-10-23T11:00:00Z",
                    "payment_method": "bank",
                    "payment_note": "Chuyển khoản",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["purchase"], payment_result["purchase"])
        self.assertEqual(mark_paid.call_args.kwargs["actor_username"], "test-admin")
        self.assertEqual(mark_paid.call_args.kwargs["actor_role"], "admin")
        self.assertEqual(mark_paid.call_args.kwargs["payment_method"], "bank")

    def test_ut_web_102_purchase_payment_maps_store_validation_error_to_400(self):
        app = self.build_app("purchase-payment-invalid")
        store = app.extensions["qltpchay.store"]
        with patch.object(store, "update_purchase_payment", side_effect=ValueError("Phiếu nhập không tồn tại.")):
            response = app.test_client().post(
                "/api/purchases/payment",
                json={"purchase_id": "missing", "payment_status": "paid"},
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json(), {"error": "Phiếu nhập không tồn tại."})

    def test_ut_web_103_cart_item_conflict_returns_409_contract(self):
        from qltpchay.store import SyncConflictError

        app = self.build_app("cart-item-conflict")
        store = app.extensions["qltpchay.store"]
        with patch.object(
            store,
            "update_cart_item",
            side_effect=SyncConflictError("carts", "expected", "actual"),
        ):
            response = app.test_client().post(
                "/api/carts/item",
                json={"cart_id": "cart-103", "item_id": "item-1"},
            )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json(), {
            "error": "Dữ liệu carts đã được cập nhật từ máy khác. Vui lòng tải lại trước khi lưu.",
            "conflict": True,
        })

    def test_ut_web_104_cart_payment_passes_session_and_returns_updated_cart(self):
        app = self.build_app("cart-payment")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        store = app.extensions["qltpchay.store"]
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)
        payment = {
            "message": "Đã cập nhật thanh toán.",
            "cart": {"id": "cart-104", "paymentStatus": "paid"},
            "carts": [{"id": "cart-104", "paymentStatus": "paid"}],
        }
        with patch.object(store, "update_cart_payment", return_value=payment) as update_payment:
            response = client.post(
                "/control-room/api/carts/payment",
                json={"cart_id": "cart-104", "payment_method": "cash", "payment_status": "paid"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["cart"], payment["cart"])
        self.assertEqual(update_payment.call_args.kwargs["actor_username"], "staff")
        self.assertEqual(update_payment.call_args.kwargs["actor_role"], "user")

    def test_ut_web_105_received_item_expiry_preserves_dates_actor_and_summary(self):
        app = self.build_app("received-item-expiry")
        app.config["SYSTEM_CONFIG"]["EnableLogin"] = True
        store = app.extensions["qltpchay.store"]
        client = app.test_client()
        login = client.post(
            "/api/session/login",
            json={"username": "staff", "password": "staff-test-password"},
        )
        self.assertEqual(login.status_code, 200)
        updated = {
            "purchase": {"id": "purchase-105"},
            "item": {"id": "item-105", "expiry_date": "2027-01-01"},
            "purchases": [{"id": "purchase-105"}],
        }
        with patch.object(store, "update_received_purchase_item_expiry", return_value=updated) as update_expiry:
            response = client.post(
                "/api/purchases/received-item-expiry",
                json={
                    "purchase_id": "purchase-105",
                    "purchase_item_id": "item-105",
                    "expiry_input_mode": "manufacture",
                    "manufacture_date": "2026-10-23",
                    "expiry_date": "2027-01-01",
                    "expected_updated_at": "v1",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["item"], updated["item"])
        self.assertEqual(update_expiry.call_args.kwargs["actor"], "staff")
        self.assertEqual(update_expiry.call_args.kwargs["expiry_input_mode"], "manufacture")

    def test_ut_web_04_public_catalog_json_shape_and_filtering(self):
        app = self.build_app("catalog")
        store = app.extensions["qltpchay.store"]
        visible = store.create_product(
            name="Hàng public",
            category="Đồ chay",
            unit="gói",
            price=10,
            sale_price=15,
            default_sale_unit="thùng",
        )
        store.create_product(
            name="Hàng nội bộ",
            category="Đồ chay",
            unit="gói",
            price=10,
            sale_price=15,
            is_public=False,
        )

        response = app.test_client().get("/api/public/products")

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(len(payload["products"]), 1)
        self.assertEqual(payload["products"][0]["id"], visible["id"])
        self.assertEqual(payload["products"][0]["default_sale_unit"], "thùng")
        self.assertEqual(
            set(payload["products"][0]),
            {
                "id", "name", "category", "unit", "default_sale_unit", "sale_price",
                "current_stock", "is_low_stock", "incoming_open_purchases", "sold_count",
                "images", "details", "recipe", "note", "unit_conversions", "min_unit",
            },
        )
        self.assertEqual(payload["settings"]["thumbnail_size_mobile"], 77)
        self.assertEqual(payload["settings"]["seller_zalo_url"], "https://example.test/seller")
        self.assertIn("days_until_reminder", payload["lunar_calendar"])

    def test_ut_web_05_testing_factory_requires_injected_system_config(self):
        from qltpchay.flask_app import create_app

        with self.assertRaisesRegex(ValueError, "explicit system_config"):
            create_app(
                database_path=self.root / "missing-config.db",
                testing=True,
            )

    def test_ut_web_06_public_order_lookup_requires_contact_identifier(self):
        app = self.build_app("public-orders")

        response = app.test_client().get("/api/public/orders")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.get_json(),
            {"error": "Cần số điện thoại hoặc Zalo ID để tra cứu."},
        )

    def test_ut_web_07_runtime_factory_uses_environment_selected_config_path(self):
        import qltpchay.flask_app as flask_app

        config = {
            "admin_path": "/runtime-admin",
            "admin": {"username": "runtime-test", "password": "runtime-test"},
            "asset_versions_path": str(self.root / "runtime-assets.json"),
            "image_root": str(self.root / "runtime-images"),
        }
        with patch.object(flask_app, "load_system_config", return_value=config) as load_config:
            app = flask_app.create_app(
                database_path=self.root / "runtime-test.db",
                system_config=None,
            )

        load_config.assert_called_once_with(flask_app.CONFIG_PATH)
        self.assertEqual(app.test_client().get("/runtime-admin").status_code, 200)

    def test_ut_web_08_unexpected_errors_use_project_logger_and_safe_response(self):
        import qltpchay.flask_app as flask_app

        app = self.build_app("error-response")

        def fail_request():
            raise RuntimeError("secret details")

        app.add_url_rule("/_test-error", view_func=fail_request)
        with patch.object(flask_app, "log_error") as log_error:
            response = app.test_client().get("/_test-error")

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.get_json(), {"error": "Lỗi hệ thống nội bộ."})
        self.assertNotIn(b"secret details", response.data)
        self.assertTrue(log_error.call_args.kwargs["exc_info"])


if __name__ == "__main__":
    unittest.main()
