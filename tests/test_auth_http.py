import gc
import gc
import http.client
import json
import os
import tempfile
import threading
import time
import unittest
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
        session_manager = SessionManager(
            admin=system_config["admin"],
            users=system_config.get("users", []),
        )
        handler = create_handler(self.store, session_manager, system_config=system_config)
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.server_thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.server_thread.start()
        time.sleep(0.05)

    def _request_json(self, method: str, path: str, *, payload: dict | None = None, cookie: str | None = None):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        headers = {}
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
        data = json.loads(raw_body) if raw_body else {}
        connection.close()
        return response.status, data, headers_map

    @staticmethod
    def _extract_cookie(headers_map: dict) -> str:
        cookie_header = str(headers_map.get("set-cookie") or "")
        return cookie_header.split(";", 1)[0]

    def _request_text(self, method: str, path: str):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        connection.request(method, path)
        response = connection.getresponse()
        raw_body = response.read().decode("utf-8")
        headers_map = {key.lower(): value for key, value in response.getheaders()}
        connection.close()
        return response.status, raw_body, headers_map

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
        self.assertIn(f'/static/app.js?v={app_version}.', html_body)
        self.assertEqual(html_headers.get("cache-control"), "no-cache, must-revalidate")

        js_status, js_body, js_headers = self._request_text("GET", "/static/app.js")
        self.assertEqual(js_status, 200)
        self.assertIn(f'?v={app_version}.', js_body)
        self.assertEqual(js_headers.get("cache-control"), "no-cache, must-revalidate")

        manifest = json.loads(self.asset_versions_path.read_text(encoding="utf-8"))
        self.assertEqual(manifest["app_version"], app_version)
        self.assertIn("app.js", manifest["files"])


if __name__ == "__main__":
    unittest.main()
