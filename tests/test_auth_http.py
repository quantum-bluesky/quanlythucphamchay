import gc
import gc
import http.client
import json
import os
import tempfile
import threading
import time
import unittest
from datetime import datetime, timedelta, timezone
from http.server import ThreadingHTTPServer
from pathlib import Path

from qltpchay.auth import SessionManager
from qltpchay.config import load_system_config
from qltpchay.http_handler import create_handler
from qltpchay.store import InventoryStore


class AuthHttpTests(unittest.TestCase):
    def setUp(self) -> None:
        fd, db_file = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        self.db_path = Path(db_file)
        manifest_fd, manifest_file = tempfile.mkstemp(suffix=".json")
        os.close(manifest_fd)
        Path(manifest_file).unlink(missing_ok=True)
        self.asset_versions_path = Path(manifest_file)
        self.store = InventoryStore(self.db_path)
        self.server = None
        self.server_thread = None
        self.session_manager = None

    def tearDown(self) -> None:
        if self.server:
            self.server.shutdown()
            self.server.server_close()
        if self.server_thread:
            self.server_thread.join(timeout=5)
        del self.store
        gc.collect()
        for suffix in ("", "-wal", "-shm"):
            self.db_path.with_name(self.db_path.name + suffix).unlink(missing_ok=True)
        self.asset_versions_path.unlink(missing_ok=True)

    def _start_server(self, system_config: dict) -> None:
        system_config = dict(system_config)
        system_config.setdefault("asset_versions_path", str(self.asset_versions_path))
        self.session_manager = SessionManager(
            admin=system_config["admin"],
            users=system_config.get("users", []),
            user_timeout_minutes=system_config.get("session_timeout_minutes", 360),
            admin_timeout_minutes=system_config.get("admin_session_timeout_minutes", 30),
        )
        handler = create_handler(self.store, self.session_manager, system_config=system_config)
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.server_thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.server_thread.start()
        time.sleep(0.05)

    def _request_json(
        self,
        method: str,
        path: str,
        *,
        payload: dict | None = None,
        cookie: str | None = None,
        extra_headers: dict | None = None,
    ):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        headers = dict(extra_headers or {})
        body = None
        if payload is not None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if cookie:
            headers["Cookie"] = cookie
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        raw_body = response.read().decode("utf-8")
        headers_map = {key.lower(): value for key, value in response.getheaders()}
        headers_map["set-cookie-all"] = response.msg.get_all("Set-Cookie") or []
        data = json.loads(raw_body) if raw_body else {}
        connection.close()
        return response.status, data, headers_map

    @staticmethod
    def _extract_cookie(headers_map: dict, cookie_name_prefix: str | None = None) -> str:
        cookie_headers = list(headers_map.get("set-cookie-all") or [])
        cookie_header = ""
        if cookie_name_prefix:
            cookie_header = next(
                (
                    header
                    for header in cookie_headers
                    if str(header).startswith(cookie_name_prefix)
                ),
                "",
            )
        if not cookie_header:
            cookie_header = next(
                (
                    str(header)
                    for header in cookie_headers
                    if "Max-Age=0" not in str(header)
                ),
                str(headers_map.get("set-cookie") or ""),
            )
        return cookie_header.split(";", 1)[0]

    def _request_text(self, method: str, path: str):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        connection.request(method, path)
        response = connection.getresponse()
        raw_body = response.read().decode("utf-8")
        headers_map = {key.lower(): value for key, value in response.getheaders()}
        connection.close()
        return response.status, raw_body, headers_map

    @staticmethod
    def _extract_cookie_value(cookie: str) -> str:
        return str(cookie or "").split("=", 1)[1] if "=" in str(cookie or "") else ""

    def _set_session_last_activity_minutes_ago(self, token: str, minutes_ago: int) -> str:
        timestamp = (datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)).isoformat(timespec="seconds")
        self.session_manager._sessions[token]["last_activity_at"] = timestamp
        return timestamp

    def test_ut_auth_01_enable_login_false_allows_anonymous_state_access(self) -> None:
        config = {
            "EnableLogin": False,
            "session_timeout_minutes": 360,
            "admin_session_timeout_minutes": 30,
            "admin": {"username": "masteradmin", "password": "admin12345"},
            "users": [{"username": "staff", "password": "staff12345"}],
            "debug": {"sync_state": False},
        }
        self._start_server(config)

        status, payload, _ = self._request_json("GET", "/api/state?transaction_limit=16")
        self.assertEqual(status, 200)
        self.assertIn("products", payload)

    def test_ut_auth_02_enable_login_true_blocks_anonymous_state_access(self) -> None:
        config = {
            "EnableLogin": True,
            "session_timeout_minutes": 360,
            "admin_session_timeout_minutes": 30,
            "admin": {"username": "masteradmin", "password": "admin12345"},
            "users": [{"username": "staff", "password": "staff12345"}],
            "debug": {"sync_state": False},
        }
        self._start_server(config)

        status, payload, _ = self._request_json("GET", "/api/state?transaction_limit=16")
        self.assertEqual(status, 401)
        self.assertIn("đăng nhập hệ thống", payload["error"])

    def test_ut_auth_03_normal_user_login_uses_general_timeout_and_cannot_access_admin_routes(self) -> None:
        config = {
            "EnableLogin": True,
            "session_timeout_minutes": 360,
            "admin_session_timeout_minutes": 30,
            "admin": {"username": "masteradmin", "password": "admin12345"},
            "users": [{"username": "staff", "password": "staff12345"}],
            "debug": {"sync_state": False},
        }
        self._start_server(config)

        login_status, login_payload, login_headers = self._request_json(
            "POST",
            "/api/session/login",
            payload={"username": "staff", "password": "staff12345"},
        )
        self.assertEqual(login_status, 200)
        self.assertTrue(login_payload["authenticated"])
        self.assertEqual(login_payload["role"], "user")
        self.assertFalse(login_payload["is_admin"])
        self.assertEqual(login_payload["timeout_minutes"], 360)
        cookie = self._extract_cookie(login_headers)
        self.assertTrue(cookie)

        state_status, state_payload, _ = self._request_json("GET", "/api/state?transaction_limit=16", cookie=cookie)
        self.assertEqual(state_status, 200)
        self.assertIn("summary", state_payload)

        admin_status, admin_payload, _ = self._request_json("GET", "/api/admin/backup", cookie=cookie)
        self.assertEqual(admin_status, 401)
        self.assertIn("Master Admin", admin_payload["error"])

    def test_ut_auth_04_admin_login_uses_admin_timeout(self) -> None:
        config = {
            "EnableLogin": True,
            "session_timeout_minutes": 360,
            "admin_session_timeout_minutes": 30,
            "admin": {"username": "masteradmin", "password": "admin12345"},
            "users": [{"username": "staff", "password": "staff12345"}],
            "debug": {"sync_state": False},
        }
        self._start_server(config)

        login_status, login_payload, login_headers = self._request_json(
            "POST",
            "/api/admin/login",
            payload={"username": "masteradmin", "password": "admin12345"},
        )
        self.assertEqual(login_status, 200)
        self.assertTrue(login_payload["authenticated"])
        self.assertEqual(login_payload["role"], "admin")
        self.assertTrue(login_payload["is_admin"])
        self.assertEqual(login_payload["timeout_minutes"], 30)
        cookie = self._extract_cookie(login_headers)

        status, payload, _ = self._request_json("GET", "/api/admin/status", cookie=cookie)
        self.assertEqual(status, 200)
        self.assertEqual(payload["username"], "masteradmin")
        self.assertTrue(payload["is_admin"])

    def test_ut_auth_04b_procurement_permission_user_can_start_batch_without_admin(self) -> None:
        config = {
            "EnableLogin": True,
            "session_timeout_minutes": 360,
            "admin_session_timeout_minutes": 30,
            "admin": {"username": "masteradmin", "password": "admin12345"},
            "users": [
                {
                    "username": "bizmanager",
                    "password": "biz12345",
                    "permissions": ["procurement_batch_manage"],
                }
            ],
            "debug": {"sync_state": False},
            "procurement": {
                "batch_planner_enabled": True,
                "batch_lock_timeout_minutes": 30,
                "allow_daily_quick_shortage_flow": True,
                "required_login_for_batch_mode": True,
                "planner_manager_usernames": [],
            },
        }
        self._start_server(config)

        login_status, login_payload, login_headers = self._request_json(
            "POST",
            "/api/session/login",
            payload={"username": "bizmanager", "password": "biz12345"},
        )
        self.assertEqual(login_status, 200)
        self.assertFalse(login_payload["is_admin"])
        self.assertIn("procurement_batch_manage", login_payload["permissions"])
        cookie = self._extract_cookie(login_headers)

        start_status, start_payload, _ = self._request_json(
            "POST",
            "/api/procurement/batch/start",
            payload={},
            cookie=cookie,
        )
        self.assertEqual(start_status, 200)
        self.assertEqual(start_payload["mode"], "batch")
        self.assertEqual(start_payload["lock"]["owner_username"], "bizmanager")

        adjust_status, adjust_payload, _ = self._request_json(
            "POST",
            "/api/transactions",
            payload={"product_id": 1, "transaction_type": "in", "quantity": 1},
            cookie=cookie,
        )
        self.assertEqual(adjust_status, 401)
        self.assertIn("Master Admin", adjust_payload["error"])

    def test_ut_auth_05_logout_clears_session_and_relocks_system(self) -> None:
        config = {
            "EnableLogin": True,
            "session_timeout_minutes": 360,
            "admin_session_timeout_minutes": 30,
            "admin": {"username": "masteradmin", "password": "admin12345"},
            "users": [{"username": "staff", "password": "staff12345"}],
            "debug": {"sync_state": False},
        }
        self._start_server(config)

        _, _, login_headers = self._request_json(
            "POST",
            "/api/session/login",
            payload={"username": "staff", "password": "staff12345"},
        )
        cookie = self._extract_cookie(login_headers)

        logout_status, logout_payload, _ = self._request_json("POST", "/api/session/logout", payload={}, cookie=cookie)
        self.assertEqual(logout_status, 200)
        self.assertFalse(logout_payload["authenticated"])

        status, payload, _ = self._request_json("GET", "/api/state?transaction_limit=16", cookie=cookie)
        self.assertEqual(status, 401)
        self.assertIn("đăng nhập hệ thống", payload["error"])

    def test_ut_auth_05a_inactive_user_session_expires_on_next_request(self) -> None:
        config = {
            "EnableLogin": True,
            "session_timeout_minutes": 360,
            "admin_session_timeout_minutes": 30,
            "admin": {"username": "masteradmin", "password": "admin12345"},
            "users": [{"username": "staff", "password": "staff12345"}],
            "debug": {"sync_state": False},
        }
        self._start_server(config)

        _, _, login_headers = self._request_json(
            "POST",
            "/api/session/login",
            payload={"username": "staff", "password": "staff12345"},
        )
        cookie = self._extract_cookie(login_headers)
        token = self._extract_cookie_value(cookie)
        self._set_session_last_activity_minutes_ago(token, 361)

        status, payload, _ = self._request_json("GET", "/api/state?transaction_limit=16", cookie=cookie)
        self.assertEqual(status, 401)
        self.assertTrue(payload["session_expired"])
        self.assertIn("hết hạn", payload["error"])
        self.assertNotIn(token, self.session_manager._sessions)

    def test_ut_auth_05b_session_status_does_not_extend_idle_timeout(self) -> None:
        config = {
            "EnableLogin": True,
            "session_timeout_minutes": 360,
            "admin_session_timeout_minutes": 30,
            "admin": {"username": "masteradmin", "password": "admin12345"},
            "users": [{"username": "staff", "password": "staff12345"}],
            "debug": {"sync_state": False},
        }
        self._start_server(config)

        _, _, login_headers = self._request_json(
            "POST",
            "/api/session/login",
            payload={"username": "staff", "password": "staff12345"},
        )
        cookie = self._extract_cookie(login_headers)
        token = self._extract_cookie_value(cookie)
        original_last_activity = self._set_session_last_activity_minutes_ago(token, 10)

        status_payload_status, status_payload, _ = self._request_json("GET", "/api/session/status", cookie=cookie)
        self.assertEqual(status_payload_status, 200)
        self.assertTrue(status_payload["authenticated"])
        self.assertEqual(self.session_manager._sessions[token]["last_activity_at"], original_last_activity)

        state_status, _, _ = self._request_json("GET", "/api/state?transaction_limit=16", cookie=cookie)
        self.assertEqual(state_status, 200)
        self.assertNotEqual(self.session_manager._sessions[token]["last_activity_at"], original_last_activity)

    def test_ut_auth_06_static_html_and_js_are_served_with_versioned_client_assets(self) -> None:
        runtime_config = load_system_config()
        app_version = str(runtime_config["version"])
        config = {
            **runtime_config,
            "asset_versions_path": str(self.asset_versions_path),
        }
        self._start_server(config)

        html_status, html_body, html_headers = self._request_text("GET", "/")
        self.assertEqual(html_status, 200)
        self.assertNotIn("<base ", html_body)
        self.assertIn(f'./static/app.js?v={app_version}.', html_body)
        self.assertEqual(html_headers.get("cache-control"), "no-cache, must-revalidate")

        js_status, js_body, js_headers = self._request_text("GET", "/static/app.js")
        self.assertEqual(js_status, 200)
        self.assertIn(f'?v={app_version}.', js_body)
        self.assertEqual(js_headers.get("cache-control"), "no-cache, must-revalidate")

        manifest = json.loads(self.asset_versions_path.read_text(encoding="utf-8"))
        self.assertEqual(manifest["app_version"], app_version)
        self.assertIn("app.js", manifest["files"])

    def test_ut_auth_07_session_cookie_is_scoped_per_request_port(self) -> None:
        config = {
            "EnableLogin": True,
            "session_timeout_minutes": 360,
            "admin_session_timeout_minutes": 30,
            "admin": {"username": "masteradmin", "password": "admin12345"},
            "users": [{"username": "staff", "password": "staff12345"}],
            "debug": {"sync_state": False},
        }
        self._start_server(config)

        login_4000_status, _, login_4000_headers = self._request_json(
            "POST",
            "/api/session/login",
            payload={"username": "staff", "password": "staff12345"},
            extra_headers={"Host": "quantum-home.zapto.org:4000"},
        )
        self.assertEqual(login_4000_status, 200)
        cookie_4000 = self._extract_cookie(login_4000_headers, "qltpchay_admin_session_p4000=")
        self.assertTrue(cookie_4000.startswith("qltpchay_admin_session_p4000="))

        login_9999_status, _, login_9999_headers = self._request_json(
            "POST",
            "/api/session/login",
            payload={"username": "staff", "password": "staff12345"},
            extra_headers={"Host": "quantum-home.zapto.org:9999"},
        )
        self.assertEqual(login_9999_status, 200)
        cookie_9999 = self._extract_cookie(login_9999_headers, "qltpchay_admin_session_p9999=")
        self.assertTrue(cookie_9999.startswith("qltpchay_admin_session_p9999="))
        self.assertNotEqual(cookie_4000, cookie_9999)

        state_4000_status, _, _ = self._request_json(
            "GET",
            "/api/state?transaction_limit=16",
            cookie=cookie_4000,
            extra_headers={"Host": "quantum-home.zapto.org:4000"},
        )
        self.assertEqual(state_4000_status, 200)

        state_9999_status, _, _ = self._request_json(
            "GET",
            "/api/state?transaction_limit=16",
            cookie=cookie_9999,
            extra_headers={"Host": "quantum-home.zapto.org:9999"},
        )
        self.assertEqual(state_9999_status, 200)

        cross_port_status, cross_port_payload, _ = self._request_json(
            "GET",
            "/api/state?transaction_limit=16",
            cookie=cookie_4000,
            extra_headers={"Host": "quantum-home.zapto.org:9999"},
        )
        self.assertEqual(cross_port_status, 401)
        self.assertIn("đăng nhập hệ thống", cross_port_payload["error"])

    def test_ut_auth_08_prefixed_subpath_routes_serve_same_app_and_api(self) -> None:
        runtime_config = load_system_config()
        config = {
            **runtime_config,
            "EnableLogin": False,
            "asset_versions_path": str(self.asset_versions_path),
        }
        self._start_server(config)

        stripped_proxy_html_status, stripped_proxy_html_body, _ = self._request_text("GET", "/")
        self.assertEqual(stripped_proxy_html_status, 200)
        self.assertNotIn("<base ", stripped_proxy_html_body)
        self.assertIn("./static/app.js?v=", stripped_proxy_html_body)

        html_status, html_body, _ = self._request_text("GET", "/qltp")
        self.assertEqual(html_status, 200)
        self.assertIn('<base href="/qltp/">', html_body)
        self.assertIn("./static/app.js?v=", html_body)

        js_status, js_body, _ = self._request_text("GET", "/qltp/static/app.js")
        self.assertEqual(js_status, 200)
        self.assertIn("./modules/app-state.js?v=", js_body)

        state_status, state_payload, _ = self._request_json("GET", "/qltp/api/state?transaction_limit=16")
        self.assertEqual(state_status, 200)
        self.assertIn("products", state_payload)

    def test_ut_auth_09_bulk_order_permissions_split_draft_and_commit(self) -> None:
        config = {
            "EnableLogin": True,
            "session_timeout_minutes": 360,
            "admin_session_timeout_minutes": 30,
            "admin": {"username": "masteradmin", "password": "admin12345"},
            "users": [
                {
                    "username": "bulkstaff",
                    "password": "bulk12345",
                    "permissions": ["bulk_order_create"],
                }
            ],
            "debug": {"sync_state": False},
        }
        self._start_server(config)

        product = self.store.create_product(
            name="Sản phẩm bulk auth",
            category="Đồ chay",
            unit="gói",
            price=10000,
            sale_price=15000,
            low_stock_threshold=1,
        )
        self.store.create_transaction(product["id"], "in", 5, "Tồn đầu auth bulk")

        login_status, login_payload, login_headers = self._request_json(
            "POST",
            "/api/session/login",
            payload={"username": "bulkstaff", "password": "bulk12345"},
        )
        self.assertEqual(login_status, 200)
        self.assertIn("bulk_order_create", login_payload["permissions"])
        cookie = self._extract_cookie(login_headers)

        draft_status, draft_payload, _ = self._request_json(
            "POST",
            "/api/orders/bulk-create",
            cookie=cookie,
            payload={
                "mode": "draft",
                "request_id": "bulk-auth-draft-001",
                "orders": [
                    {
                        "client_order_id": "bulk-auth-1",
                        "customer_name": "Khách auth nháp",
                        "items": [
                            {
                                "product_id": product["id"],
                                "quantity": 1,
                                "unit_price": 15000,
                            }
                        ],
                    }
                ],
            },
        )
        self.assertEqual(draft_status, 200)
        self.assertEqual(draft_payload["summary"]["success"], 1)

        commit_status, commit_payload, _ = self._request_json(
            "POST",
            "/api/orders/bulk-create",
            cookie=cookie,
            payload={
                "mode": "commit_valid",
                "request_id": "bulk-auth-commit-001",
                "orders": [
                    {
                        "client_order_id": "bulk-auth-2",
                        "customer_name": "Khách auth chốt",
                        "items": [
                            {
                                "product_id": product["id"],
                                "quantity": 1,
                                "unit_price": 15000,
                            }
                        ],
                    }
                ],
            },
        )
        self.assertEqual(commit_status, 401)
        self.assertIn("quyền chốt nhiều đơn", commit_payload["error"])

    def test_ut_auth_10_order_batch_manage_can_override_duplicate_warning_for_direct_commit(self) -> None:
        config = {
            "EnableLogin": True,
            "session_timeout_minutes": 360,
            "admin_session_timeout_minutes": 30,
            "admin": {"username": "masteradmin", "password": "admin12345"},
            "users": [
                {
                    "username": "staff",
                    "password": "staff12345",
                    "permissions": ["bulk_order_commit"],
                },
                {
                    "username": "bizmanager",
                    "password": "biz12345",
                    "permissions": ["order_batch_manage", "bulk_order_commit"],
                },
            ],
            "debug": {"sync_state": False},
        }
        self._start_server(config)

        product = self.store.create_product(
            name="Sản phẩm override duplicate",
            category="Đồ chay",
            unit="gói",
            price=12000,
            sale_price=18000,
            low_stock_threshold=1,
        )
        self.store.create_transaction(product["id"], "in", 10, "Tồn đầu override duplicate")

        _, _, staff_login_headers = self._request_json(
            "POST",
            "/api/session/login",
            payload={"username": "staff", "password": "staff12345"},
        )
        staff_cookie = self._extract_cookie(staff_login_headers)

        request_status, request_payload, _ = self._request_json(
            "POST",
            "/api/orders/bulk-create",
            cookie=staff_cookie,
            payload={
                "mode": "commit_valid",
                "request_id": "bulk-approval-dup-001",
                "orders": [
                    {
                        "client_order_id": "dup-order-1",
                        "customer_name": "Khách duplicate",
                        "items": [{"product_id": product["id"], "quantity": 1, "unit_price": 18000}],
                    }
                ],
            },
        )
        self.assertEqual(request_status, 200)
        self.assertTrue(request_payload["approval_required"])
        self.assertEqual(request_payload["request"]["status"], "pending_approval")

        _, _, manager_login_headers = self._request_json(
            "POST",
            "/api/session/login",
            payload={"username": "bizmanager", "password": "biz12345"},
        )
        manager_cookie = self._extract_cookie(manager_login_headers)

        blocked_status, blocked_payload, _ = self._request_json(
            "POST",
            "/api/orders/bulk-create",
            cookie=manager_cookie,
            payload={
                "mode": "commit_valid",
                "request_id": "bulk-approval-dup-002",
                "orders": [
                    {
                        "client_order_id": "dup-order-2",
                        "customer_name": "Khách duplicate",
                        "items": [{"product_id": product["id"], "quantity": 1, "unit_price": 18000}],
                    }
                ],
            },
        )
        self.assertEqual(blocked_status, 409)
        self.assertEqual(blocked_payload["code"], "bulk_order_duplicate_request")
        self.assertTrue(blocked_payload["can_continue"])
        self.assertFalse(blocked_payload["approval_required"])

        override_status, override_payload, _ = self._request_json(
            "POST",
            "/api/orders/bulk-create",
            cookie=manager_cookie,
            payload={
                "mode": "commit_valid",
                "request_id": "bulk-approval-dup-002",
                "allow_duplicates": True,
                "orders": [
                    {
                        "client_order_id": "dup-order-2",
                        "customer_name": "Khách duplicate",
                        "items": [{"product_id": product["id"], "quantity": 1, "unit_price": 18000}],
                    }
                ],
            },
        )
        self.assertEqual(override_status, 200)
        self.assertEqual(override_payload["summary"]["success"], 1)
        self.assertEqual(override_payload["results"][0]["order_status"], "committed")

    def test_ut_auth_11_bulk_order_request_lifecycle_supports_approve_reject_and_owner_process(self) -> None:
        config = {
            "EnableLogin": True,
            "session_timeout_minutes": 360,
            "admin_session_timeout_minutes": 30,
            "admin": {"username": "masteradmin", "password": "admin12345"},
            "users": [
                {
                    "username": "staff",
                    "password": "staff12345",
                    "permissions": ["bulk_order_commit"],
                },
                {
                    "username": "bizmanager",
                    "password": "biz12345",
                    "permissions": ["order_batch_manage"],
                },
            ],
            "debug": {"sync_state": False},
        }
        self._start_server(config)

        product = self.store.create_product(
            name="Sản phẩm request approve",
            category="Đồ chay",
            unit="gói",
            price=15000,
            sale_price=21000,
            low_stock_threshold=1,
        )
        self.store.create_transaction(product["id"], "in", 12, "Tồn đầu request approve")

        _, _, staff_login_headers = self._request_json(
            "POST",
            "/api/session/login",
            payload={"username": "staff", "password": "staff12345"},
        )
        staff_cookie = self._extract_cookie(staff_login_headers)

        create_status, create_payload, _ = self._request_json(
            "POST",
            "/api/orders/bulk-create",
            cookie=staff_cookie,
            payload={
                "mode": "commit_valid",
                "request_id": "bulk-approval-flow-001",
                "orders": [
                    {
                        "client_order_id": "approval-flow-1",
                        "customer_name": "Khách flow approve",
                        "items": [{"product_id": product["id"], "quantity": 2, "unit_price": 21000}],
                    }
                ],
            },
        )
        self.assertEqual(create_status, 200)
        self.assertTrue(create_payload["approval_required"])
        self.assertEqual(create_payload["request"]["status"], "pending_approval")

        state_status, state_payload, _ = self._request_json("GET", "/api/state?transaction_limit=16", cookie=staff_cookie)
        self.assertEqual(state_status, 200)
        self.assertEqual(len(state_payload["bulk_order_requests"]), 1)
        self.assertEqual(state_payload["bulk_order_requests"][0]["status"], "pending_approval")

        duplicate_status, duplicate_payload, _ = self._request_json(
            "POST",
            "/api/orders/bulk-create",
            cookie=staff_cookie,
            payload={
                "mode": "commit_valid",
                "request_id": "bulk-approval-flow-002",
                "orders": [
                    {
                        "client_order_id": "approval-flow-2",
                        "customer_name": "Khách flow approve",
                        "items": [{"product_id": product["id"], "quantity": 2, "unit_price": 21000}],
                    }
                ],
            },
        )
        self.assertEqual(duplicate_status, 409)
        self.assertFalse(duplicate_payload["can_continue"])
        self.assertTrue(duplicate_payload["approval_required"])

        _, _, manager_login_headers = self._request_json(
            "POST",
            "/api/session/login",
            payload={"username": "bizmanager", "password": "biz12345"},
        )
        manager_cookie = self._extract_cookie(manager_login_headers)

        manager_state_status, manager_state_payload, _ = self._request_json(
            "GET",
            "/api/state?transaction_limit=16",
            cookie=manager_cookie,
        )
        self.assertEqual(manager_state_status, 200)
        self.assertEqual(manager_state_payload["bulk_order_requests"][0]["requested_by"], "staff")

        approve_status, approve_payload, _ = self._request_json(
            "POST",
            "/api/orders/bulk-requests/bulk-approval-flow-001/approve",
            cookie=manager_cookie,
            payload={},
        )
        self.assertEqual(approve_status, 200)
        self.assertEqual(approve_payload["request"]["status"], "approved")
        self.assertEqual(approve_payload["request"]["approved_by"], "bizmanager")

        process_status, process_payload, _ = self._request_json(
            "POST",
            "/api/orders/bulk-requests/bulk-approval-flow-001/process",
            cookie=staff_cookie,
            payload={},
        )
        self.assertEqual(process_status, 200)
        self.assertEqual(process_payload["request"]["status"], "processed")
        self.assertEqual(process_payload["request"]["processed_by"], "staff")
        self.assertEqual(process_payload["process_result"]["summary"]["success"], 1)

        create_reject_status, create_reject_payload, _ = self._request_json(
            "POST",
            "/api/orders/bulk-create",
            cookie=staff_cookie,
            payload={
                "mode": "commit_valid",
                "request_id": "bulk-approval-flow-003",
                "orders": [
                    {
                        "client_order_id": "approval-flow-3",
                        "customer_name": "Khách flow reject",
                        "items": [{"product_id": product["id"], "quantity": 1, "unit_price": 21000}],
                    }
                ],
            },
        )
        self.assertEqual(create_reject_status, 200)
        self.assertEqual(create_reject_payload["request"]["status"], "pending_approval")

        reject_status, reject_payload, _ = self._request_json(
            "POST",
            "/api/orders/bulk-requests/bulk-approval-flow-003/reject",
            cookie=manager_cookie,
            payload={"reason": "Trùng khách đang xử lý"},
        )
        self.assertEqual(reject_status, 200)
        self.assertEqual(reject_payload["request"]["status"], "rejected")
        self.assertEqual(reject_payload["request"]["reject_reason"], "Trùng khách đang xử lý")

        refresh_status, refresh_payload, _ = self._request_json("GET", "/api/state?transaction_limit=16", cookie=staff_cookie)
        self.assertEqual(refresh_status, 200)
        rejected_request = next(
            request for request in refresh_payload["bulk_order_requests"]
            if request["request_id"] == "bulk-approval-flow-003"
        )
        self.assertEqual(rejected_request["status"], "rejected")
        self.assertEqual(rejected_request["reject_reason"], "Trùng khách đang xử lý")

    def test_ut_auth_12_history_routes_return_request_and_order_audit_timeline(self) -> None:
        config = {
            "EnableLogin": True,
            "session_timeout_minutes": 360,
            "admin_session_timeout_minutes": 30,
            "admin": {"username": "masteradmin", "password": "admin12345"},
            "users": [
                {
                    "username": "staff",
                    "password": "staff12345",
                    "permissions": ["bulk_order_commit"],
                },
                {
                    "username": "bizmanager",
                    "password": "biz12345",
                    "permissions": ["order_batch_manage"],
                },
            ],
            "debug": {"sync_state": False},
        }
        self._start_server(config)

        product = self.store.create_product(
            name="Sản phẩm history route",
            category="Đồ chay",
            unit="gói",
            price=15000,
            sale_price=22000,
            low_stock_threshold=1,
        )
        self.store.create_transaction(product["id"], "in", 8, "Tồn đầu history route")

        _, _, staff_login_headers = self._request_json(
            "POST",
            "/api/session/login",
            payload={"username": "staff", "password": "staff12345"},
        )
        staff_cookie = self._extract_cookie(staff_login_headers)
        _, _, manager_login_headers = self._request_json(
            "POST",
            "/api/session/login",
            payload={"username": "bizmanager", "password": "biz12345"},
        )
        manager_cookie = self._extract_cookie(manager_login_headers)

        create_status, _, _ = self._request_json(
            "POST",
            "/api/orders/bulk-create",
            cookie=staff_cookie,
            payload={
                "mode": "commit_valid",
                "request_id": "bulk-history-route-001",
                "orders": [
                    {
                        "client_order_id": "bulk-history-route-order-1",
                        "customer_name": "Khách history route",
                        "items": [{"product_id": product["id"], "quantity": 1, "unit_price": 22000}],
                    }
                ],
            },
        )
        self.assertEqual(create_status, 200)

        approve_status, _, _ = self._request_json(
            "POST",
            "/api/orders/bulk-requests/bulk-history-route-001/approve",
            cookie=manager_cookie,
            payload={},
        )
        self.assertEqual(approve_status, 200)

        process_status, process_payload, _ = self._request_json(
            "POST",
            "/api/orders/bulk-requests/bulk-history-route-001/process",
            cookie=staff_cookie,
            payload={},
        )
        self.assertEqual(process_status, 200)
        cart_id = process_payload["process_result"]["results"][0]["cart_id"]

        request_history_status, request_history_payload, _ = self._request_json(
            "GET",
            "/api/orders/bulk-requests/bulk-history-route-001/history?limit=10",
            cookie=manager_cookie,
        )
        self.assertEqual(request_history_status, 200)
        request_actions = [entry["action"] for entry in request_history_payload["history"]]
        self.assertIn("create-request", request_actions)
        self.assertIn("approve-request", request_actions)
        self.assertIn("process-request", request_actions)

        order_history_status, order_history_payload, _ = self._request_json(
            "GET",
            f"/api/orders/{cart_id}/history?limit=10",
            cookie=staff_cookie,
        )
        self.assertEqual(order_history_status, 200)
        order_actions = [entry["action"] for entry in order_history_payload["history"]]
        self.assertIn("create", order_actions)
        self.assertIn("status-change", order_actions)

    def test_ut_auth_12b_quick_purchase_and_sale_routes_create_documents_with_history(self) -> None:
        config = {
            "EnableLogin": True,
            "session_timeout_minutes": 360,
            "admin_session_timeout_minutes": 30,
            "admin": {"username": "masteradmin", "password": "admin12345"},
            "users": [
                {
                    "username": "staff",
                    "password": "staff12345",
                    "permissions": [],
                }
            ],
        }
        self._start_server(config)

        product = self.store.create_product(
            name="Sản phẩm quick route",
            category="Đồ chay",
            unit="gói",
            price=12000,
            sale_price=20000,
            low_stock_threshold=1,
        )
        self.store.create_transaction(product["id"], "in", 10, "Tồn đầu quick route")

        _, _, login_headers = self._request_json(
            "POST",
            "/api/session/login",
            payload={"username": "staff", "password": "staff12345"},
        )
        staff_cookie = self._extract_cookie(login_headers)

        quick_purchase_status, quick_purchase_payload, _ = self._request_json(
            "POST",
            "/api/purchases/quick-create",
            cookie=staff_cookie,
            payload={
                "supplier_name": "NCC Quick Route",
                "document_date": "2026-05-25",
                "items": [{"product_id": product["id"], "quantity": 2, "unit_cost": 13000}],
                "final_status": "received",
                "mark_paid": True,
            },
        )
        self.assertEqual(quick_purchase_status, 201)
        purchase_id = quick_purchase_payload["purchase"]["id"]
        self.assertEqual(quick_purchase_payload["purchase"]["status"], "paid")
        self.assertEqual(quick_purchase_payload["purchase"]["createdMode"], "quick_import")

        purchase_history_status, purchase_history_payload, _ = self._request_json(
            "GET",
            f"/api/purchases/{purchase_id}/history?limit=10",
            cookie=staff_cookie,
        )
        self.assertEqual(purchase_history_status, 200)
        purchase_actions = [entry["action"] for entry in purchase_history_payload["history"]]
        self.assertIn("create", purchase_actions)
        self.assertIn("status-change", purchase_actions)
        self.assertIn("payment-status", purchase_actions)

        quick_sale_status, quick_sale_payload, _ = self._request_json(
            "POST",
            "/api/orders/quick-create",
            cookie=staff_cookie,
            payload={
                "customer_name": "Khách Quick Route",
                "document_date": "2026-05-25",
                "items": [{"product_id": product["id"], "quantity": 1, "unit_price": 20000}],
                "final_status": "completed",
                "mark_paid": True,
            },
        )
        self.assertEqual(quick_sale_status, 201)
        self.assertEqual(quick_sale_payload["cart"]["paymentStatus"], "paid")
        self.assertEqual(quick_sale_payload["cart"]["createdMode"], "quick_export")

    def test_ut_auth_13_pending_bulk_order_request_delete_allows_owner_and_manager_only(self) -> None:
        config = {
            "EnableLogin": True,
            "session_timeout_minutes": 360,
            "admin_session_timeout_minutes": 30,
            "admin": {"username": "masteradmin", "password": "admin12345"},
            "users": [
                {
                    "username": "staff",
                    "password": "staff12345",
                    "permissions": ["bulk_order_commit"],
                },
                {
                    "username": "otherstaff",
                    "password": "other12345",
                    "permissions": ["bulk_order_commit"],
                },
                {
                    "username": "bizmanager",
                    "password": "biz12345",
                    "permissions": ["order_batch_manage"],
                },
            ],
            "debug": {"sync_state": False},
        }
        self._start_server(config)

        product = self.store.create_product(
            name="Sản phẩm request delete route",
            category="Đồ chay",
            unit="gói",
            price=14000,
            sale_price=23000,
            low_stock_threshold=1,
        )
        self.store.create_transaction(product["id"], "in", 10, "Tồn đầu request delete route")

        _, _, staff_login_headers = self._request_json(
            "POST",
            "/api/session/login",
            payload={"username": "staff", "password": "staff12345"},
        )
        staff_cookie = self._extract_cookie(staff_login_headers)
        _, _, other_login_headers = self._request_json(
            "POST",
            "/api/session/login",
            payload={"username": "otherstaff", "password": "other12345"},
        )
        other_cookie = self._extract_cookie(other_login_headers)
        _, _, manager_login_headers = self._request_json(
            "POST",
            "/api/session/login",
            payload={"username": "bizmanager", "password": "biz12345"},
        )
        manager_cookie = self._extract_cookie(manager_login_headers)

        create_status, create_payload, _ = self._request_json(
            "POST",
            "/api/orders/bulk-create",
            cookie=staff_cookie,
            payload={
                "mode": "commit_valid",
                "request_id": "bulk-delete-flow-001",
                "orders": [
                    {
                        "client_order_id": "bulk-delete-flow-order-1",
                        "customer_name": "Khách xóa request",
                        "items": [{"product_id": product["id"], "quantity": 2, "unit_price": 23000}],
                    }
                ],
            },
        )
        self.assertEqual(create_status, 200)
        self.assertEqual(create_payload["request"]["status"], "pending_approval")

        denied_status, denied_payload, _ = self._request_json(
            "POST",
            "/api/orders/bulk-requests/bulk-delete-flow-001/delete",
            cookie=other_cookie,
            payload={},
        )
        self.assertEqual(denied_status, 401)
        self.assertIn("owner", denied_payload["error"])

        delete_status, delete_payload, _ = self._request_json(
            "POST",
            "/api/orders/bulk-requests/bulk-delete-flow-001/delete",
            cookie=staff_cookie,
            payload={},
        )
        self.assertEqual(delete_status, 200)
        self.assertEqual(delete_payload["request"]["request_id"], "bulk-delete-flow-001")
        self.assertEqual(delete_payload["request"]["status"], "pending_approval")
        self.assertEqual(delete_payload["bulk_order_requests"], [])

        recreate_status, recreate_payload, _ = self._request_json(
            "POST",
            "/api/orders/bulk-create",
            cookie=staff_cookie,
            payload={
                "mode": "commit_valid",
                "request_id": "bulk-delete-flow-002",
                "orders": [
                    {
                        "client_order_id": "bulk-delete-flow-order-2",
                        "customer_name": "Khách xóa request",
                        "items": [{"product_id": product["id"], "quantity": 2, "unit_price": 23000}],
                    }
                ],
            },
        )
        self.assertEqual(recreate_status, 200)
        self.assertEqual(recreate_payload["request"]["status"], "pending_approval")

        manager_delete_status, manager_delete_payload, _ = self._request_json(
            "POST",
            "/api/orders/bulk-requests/bulk-delete-flow-002/delete",
            cookie=manager_cookie,
            payload={},
        )
        self.assertEqual(manager_delete_status, 200)
        self.assertEqual(manager_delete_payload["request"]["request_id"], "bulk-delete-flow-002")
        self.assertEqual(manager_delete_payload["bulk_order_requests"], [])

    def test_ut_auth_14_product_movements_route_returns_selected_product_history(self) -> None:
        config = {
            "EnableLogin": True,
            "session_timeout_minutes": 360,
            "admin_session_timeout_minutes": 30,
            "admin": {"username": "masteradmin", "password": "admin12345"},
            "users": [
                {
                    "username": "staff",
                    "password": "staff12345",
                    "permissions": ["bulk_order_commit"],
                }
            ],
            "debug": {"sync_state": False},
        }
        self._start_server(config)

        product = self.store.create_product(
            name="Sản phẩm route movement",
            category="Đồ chay",
            unit="gói",
            price=15000,
            sale_price=22000,
            low_stock_threshold=1,
        )
        with self.store._connect() as connection:
            self.store._create_purchase_receipt_in_connection(
                connection,
                supplier_name="NCC route movement",
                items=[{"product_id": product["id"], "quantity": 10, "unit_cost": 15000}],
                note="Nhập cho route movement",
                created_at="2026-05-28T07:00:00+07:00",
            )
        order = self.store.create_checkout_order(
            customer_name="Khách route movement",
            items=[{"product_id": product["id"], "quantity": 4, "unit_price": 22000}],
            note="Xuất cho route movement",
        )
        with self.store._connect() as connection:
            connection.execute(
                "UPDATE transactions SET created_at = ? WHERE id = ?",
                ("2026-05-28T12:00:00+07:00", int(order["transactions"][0]["id"])),
            )

        unauthorized_status, unauthorized_payload, _ = self._request_json(
            "GET",
            f"/api/product-movements?product_id={product['id']}",
        )
        self.assertEqual(unauthorized_status, 401)
        self.assertIn("Cần đăng nhập", unauthorized_payload["error"])

        _, _, staff_login_headers = self._request_json(
            "POST",
            "/api/session/login",
            payload={"username": "staff", "password": "staff12345"},
        )
        staff_cookie = self._extract_cookie(staff_login_headers)

        ok_status, ok_payload, _ = self._request_json(
            "GET",
            f"/api/product-movements?product_id={product['id']}&movement_type=out&to_date={datetime.now().astimezone().date().isoformat()}",
            cookie=staff_cookie,
        )
        self.assertEqual(ok_status, 200)
        self.assertEqual(ok_payload["product"]["name"], "Sản phẩm route movement")
        self.assertEqual(ok_payload["period"]["movement_type"], "out")
        self.assertEqual(len(ok_payload["movements"]), 1)
        self.assertEqual(ok_payload["movements"][0]["document_type"], "order")
        self.assertEqual(ok_payload["movements"][0]["related_party_name"], "Khách route movement")
        self.assertIn("Cảnh báo", ok_payload["summary"]["status_message"])

        invalid_status, invalid_payload, _ = self._request_json(
            "GET",
            f"/api/product-movements?product_id={product['id']}&from_date=2026-05-29&to_date=2026-05-28",
            cookie=staff_cookie,
        )
        self.assertEqual(invalid_status, 400)
        self.assertIn("Từ ngày không được lớn hơn Đến ngày", invalid_payload["error"])


if __name__ == "__main__":
    unittest.main()
