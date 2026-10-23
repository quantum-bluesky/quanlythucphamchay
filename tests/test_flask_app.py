import json
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from urllib.request import urlopen
from wsgiref.simple_server import make_server

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
