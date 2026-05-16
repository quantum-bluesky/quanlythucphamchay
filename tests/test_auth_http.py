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


if __name__ == "__main__":
    unittest.main()
