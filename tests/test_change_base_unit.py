# -*- coding: utf-8 -*-
"""
Unit tests for Issue 177: Change Product Base Unit (Chuyển đổi đơn vị chính)
"""
import shutil
import tempfile
import unittest
from pathlib import Path

from qltpchay.store import InventoryStore


class TestChangeProductBaseUnit(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.db_path = Path(self.test_dir) / "test_inventory.db"
        self.store = InventoryStore(self.db_path)

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_basic_base_unit_conversion(self):
        # 1. Tạo sản phẩm ban đầu: 1 gói, giá nhập 50.000, giá bán 70.000, ngưỡng 5
        product = self.store.create_product(
            name="Chả lụa chay",
            category="Đồ chay",
            unit="gói",
            price=50000,
            sale_price=70000,
            low_stock_threshold=5,
        )
        prod_id = product["id"]

        # Nhập kho 10 gói qua transaction và batch
        with self.store._connect() as conn:
            cur = conn.execute(
                "INSERT INTO transactions(product_id, transaction_type, quantity, note, created_at) VALUES (?, 'in', 10, 'Nhập đầu', '2026-09-01T00:00:00Z')",
                (prod_id,)
            )
            tx_id = cur.lastrowid
            conn.execute(
                """
                INSERT INTO inventory_batches(product_id, batch_code, unit_cost, initial_quantity, remaining_quantity, source_transaction_id, received_at, created_at, updated_at)
                VALUES (?, 'L01', 50000, 10, 10, ?, '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')
                """,
                (prod_id, tx_id)
            )

        # Kiểm tra tồn kho trước khi đổi: 10 gói
        stock_before = self.store.get_product_by_id(prod_id)["current_stock"]
        self.assertEqual(stock_before, 10.0)

        # 2. Đổi đơn vị chính sang "lạng" với tỷ lệ 1 gói = 2 lạng (K = 2.0)
        updated = self.store.change_product_base_unit(
            product_id=prod_id,
            new_unit="lạng",
            conversion_rate=2.0,
            add_old_unit_to_conversions=True,
            actor="admin-tester",
        )

        # Kiểm tra thông tin sản phẩm sau khi đổi
        self.assertEqual(updated["unit"], "lạng")
        self.assertEqual(updated["price"], 25000.0)
        self.assertEqual(updated["sale_price"], 35000.0)
        self.assertEqual(updated["low_stock_threshold"], 10.0)
        self.assertEqual(updated["current_stock"], 20.0)

        # Kiểm tra lô hàng: tổng giá trị lô hàng phải được bảo toàn
        with self.store._connect() as conn:
            batch = conn.execute("SELECT * FROM inventory_batches WHERE product_id = ?", (prod_id,)).fetchone()
            self.assertEqual(batch["initial_quantity"], 20.0)
            self.assertEqual(batch["remaining_quantity"], 20.0)
            self.assertEqual(batch["unit_cost"], 25000.0)
            # 20 lạng * 25.000 = 500.000 đ (bằng 10 gói * 50.000 đ ban đầu)
            self.assertEqual(batch["remaining_quantity"] * batch["unit_cost"], 500000.0)

            # Kiểm tra đơn vị cũ "gói" đã được đưa vào bảng quy đổi
            conv_row = conn.execute(
                "SELECT * FROM product_unit_conversion WHERE product_id = ? AND LOWER(from_unit) = 'gói' AND is_active = 1",
                (prod_id,)
            ).fetchone()
            self.assertIsNotNone(conv_row)
            self.assertEqual(conv_row["conversion_factor"], 2.0)
            self.assertEqual(conv_row["price"], 50000.0)
            self.assertEqual(conv_row["sale_price"], 70000.0)

            # Kiểm tra audit log
            audit = conn.execute(
                "SELECT * FROM audit_logs WHERE entity_id = ? AND action = 'change_base_unit'",
                (str(prod_id),)
            ).fetchone()
            self.assertIsNotNone(audit)
            self.assertIn("gói", audit["message"])
            self.assertIn("lạng", audit["message"])

    def test_conversion_with_existing_secondary_units(self):
        # Sản phẩm có đơn vị chính "gói", đơn vị phụ "thùng" (1 thùng = 20 gói)
        product = self.store.create_product(
            name="Mì chay",
            category="Đồ khô",
            unit="gói",
            price=4000,
            sale_price=6000,
            low_stock_threshold=20,
            unit_conversions=[
                {"from_unit": "thùng", "conversion_factor": 20.0, "price": 75000, "sale_price": 110000}
            ]
        )
        prod_id = product["id"]

        # Đổi đơn vị chính từ "gói" sang "lạng" (1 gói = 2 lạng => K = 2.0)
        self.store.change_product_base_unit(
            product_id=prod_id,
            new_unit="lạng",
            conversion_rate=2.0,
            add_old_unit_to_conversions=True,
        )

        with self.store._connect() as conn:
            # 1 thùng = 20 gói = 40 lạng => conversion_factor của thùng phải là 40.0
            thung_row = conn.execute(
                "SELECT * FROM product_unit_conversion WHERE product_id = ? AND from_unit = 'thùng'",
                (prod_id,)
            ).fetchone()
            self.assertIsNotNone(thung_row)
            self.assertEqual(thung_row["conversion_factor"], 40.0)
            # Giá của 1 thùng vẫn giữ nguyên
            self.assertEqual(thung_row["price"], 75000.0)
            self.assertEqual(thung_row["sale_price"], 110000.0)

    def test_conversion_when_target_was_already_secondary_unit(self):
        # Sản phẩm có đơn vị chính "gói", đơn vị phụ "lạng" (1 lạng = 0.5 gói => factor = 0.5)
        product = self.store.create_product(
            name="Đậu hũ non",
            category="Đồ mát",
            unit="gói",
            price=10000,
            sale_price=15000,
            low_stock_threshold=10,
            unit_conversions=[
                {"from_unit": "lạng", "conversion_factor": 0.5, "price": 5000, "sale_price": 7500}
            ]
        )
        prod_id = product["id"]

        # Đổi đơn vị chính sang "lạng" (1 gói = 2 lạng => K = 2.0)
        self.store.change_product_base_unit(
            product_id=prod_id,
            new_unit="lạng",
            conversion_rate=2.0,
            add_old_unit_to_conversions=True,
        )

        with self.store._connect() as conn:
            # Dòng "lạng" trong product_unit_conversion phải bị vô hiệu hóa vì lạng giờ là đơn vị chính
            lang_row = conn.execute(
                "SELECT * FROM product_unit_conversion WHERE product_id = ? AND LOWER(from_unit) = 'lạng'",
                (prod_id,)
            ).fetchone()
            self.assertEqual(lang_row["is_active"], 0)

            # Đơn vị cũ "gói" được thêm vào quy đổi với factor = 2.0
            goi_row = conn.execute(
                "SELECT * FROM product_unit_conversion WHERE product_id = ? AND LOWER(from_unit) = 'gói' AND is_active = 1",
                (prod_id,)
            ).fetchone()
            self.assertIsNotNone(goi_row)
            self.assertEqual(goi_row["conversion_factor"], 2.0)
            self.assertEqual(goi_row["price"], 10000.0)
            self.assertEqual(goi_row["sale_price"], 15000.0)

    def test_conversion_with_open_cart(self):
        # Tạo sản phẩm và giỏ hàng có chứa sản phẩm
        product = self.store.create_product(
            name="Bột nêm chay",
            category="Gia vị",
            unit="gói",
            price=20000,
            sale_price=30000,
            low_stock_threshold=5,
        )
        prod_id = product["id"]

        with self.store._connect() as conn:
            conn.execute(
                "INSERT INTO carts(id, customer_name, status, created_at, updated_at) VALUES ('CART-001', 'Khách quen', 'draft', '2026-09-01T00:00:00Z', '2026-09-01T00:00:00Z')"
            )
            # Khách mua 3 gói (input_quantity: 3, input_unit: 'gói', conversion_factor: 1.0, quantity: 3.0)
            conn.execute(
                """
                INSERT INTO cart_items(id, cart_id, product_id, product_name, quantity, unit_price, input_quantity, input_unit, conversion_factor, discount_amount)
                VALUES ('CI-001', 'CART-001', ?, 'Bột nêm chay', 3.0, 30000, 3.0, 'gói', 1.0, 0)
                """,
                (prod_id,)
            )

        # Đổi đơn vị chính sang "lạng" (1 gói = 2 lạng => K = 2.0)
        self.store.change_product_base_unit(
            product_id=prod_id,
            new_unit="lạng",
            conversion_rate=2.0,
        )

        with self.store._connect() as conn:
            ci = conn.execute("SELECT * FROM cart_items WHERE id = 'CI-001'").fetchone()
            # Số lượng cơ sở (để trừ kho) tăng gấp đôi thành 6 lạng
            self.assertEqual(ci["quantity"], 6.0)
            # Hệ số quy đổi của đơn vị 'gói' trở thành 2.0
            self.assertEqual(ci["conversion_factor"], 2.0)
            # Dữ liệu nhập của khách vẫn là 3 gói giá 30.000
            self.assertEqual(ci["input_quantity"], 3.0)
            self.assertEqual(ci["unit_price"], 30000.0)

    def test_reversibility_conversion(self):
        # Kiểm tra chuyển đổi 2 chiều: A -> B rồi B -> A dữ liệu phải bảo toàn
        product = self.store.create_product(
            name="Nấm hương",
            category="Nấm",
            unit="lạng",
            price=30000,
            sale_price=45000,
            low_stock_threshold=10,
        )
        prod_id = product["id"]

        with self.store._connect() as conn:
            conn.execute(
                "INSERT INTO transactions(product_id, transaction_type, quantity, note, created_at) VALUES (?, 'in', 50, 'Tồn ban đầu', '2026-09-01T00:00:00Z')",
                (prod_id,)
            )

        # Chuyển lạng -> kg (1 lạng = 0.1 kg => K = 0.1)
        step1 = self.store.change_product_base_unit(
            product_id=prod_id,
            new_unit="kg",
            conversion_rate=0.1,
            add_old_unit_to_conversions=True,
        )
        self.assertEqual(step1["unit"], "kg")
        self.assertEqual(step1["price"], 300000.0)
        self.assertEqual(step1["sale_price"], 450000.0)
        self.assertEqual(step1["current_stock"], 5.0)

        # Chuyển ngược lại kg -> lạng (1 kg = 10 lạng => K = 10.0)
        step2 = self.store.change_product_base_unit(
            product_id=prod_id,
            new_unit="lạng",
            conversion_rate=10.0,
            add_old_unit_to_conversions=True,
        )
        self.assertEqual(step2["unit"], "lạng")
        self.assertEqual(step2["price"], 30000.0)
        self.assertEqual(step2["sale_price"], 450000.0 / 10.0)
        self.assertEqual(step2["current_stock"], 50.0)

    def test_validation_errors(self):
        product = self.store.create_product(
            name="Sản phẩm test lỗi",
            category="Khác",
            unit="hộp",
            price=10000,
            sale_price=12000,
        )
        prod_id = product["id"]

        # Trống tên đơn vị mới
        with self.assertRaises(ValueError):
            self.store.change_product_base_unit(prod_id, "", 2.0)

        # Trùng tên đơn vị hiện tại
        with self.assertRaises(ValueError):
            self.store.change_product_base_unit(prod_id, "hộp", 2.0)

        # Tỷ lệ <= 0
        with self.assertRaises(ValueError):
            self.store.change_product_base_unit(prod_id, "thùng", 0)

        with self.assertRaises(ValueError):
            self.store.change_product_base_unit(prod_id, "thùng", -1.5)


class TestChangeProductBaseUnitHttp(unittest.TestCase):
    def setUp(self):
        import http.client
        from http.server import ThreadingHTTPServer
        import threading
        import time
        from qltpchay.auth import SessionManager
        from qltpchay.http_handler import create_handler

        self.test_dir = tempfile.mkdtemp()
        self.db_path = Path(self.test_dir) / "test_http_inventory.db"
        self.store = InventoryStore(self.db_path)
        self.system_config = {
            "version": "3.38.0",
            "asset_versions_path": str(Path(self.test_dir) / "js_asset_versions.json"),
            "admin": {"username": "masteradmin", "password": "adminpassword"},
            "users": [{"username": "staff", "password": "staffpassword", "permissions": []}],
            "EnableLogin": True,
            "session_timeout_minutes": 360,
            "admin_session_timeout_minutes": 30,
        }
        self.session_manager = SessionManager(
            admin=self.system_config["admin"],
            users=self.system_config["users"],
        )
        handler = create_handler(self.store, self.session_manager, system_config=self.system_config)
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.server_port = self.server.server_address[1]
        self.server_thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.server_thread.start()
        time.sleep(0.05)

    def tearDown(self):
        if self.server:
            self.server.shutdown()
            self.server.server_close()
        if self.server_thread:
            self.server_thread.join(timeout=5)
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def _request_json(self, method, path, *, payload=None, cookie=None):
        import http.client
        import json
        conn = http.client.HTTPConnection("127.0.0.1", self.server_port, timeout=5)
        headers = {}
        body = None
        if payload is not None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            headers["Content-Type"] = "application/json"
            headers["Content-Length"] = str(len(body))
        if cookie:
            headers["Cookie"] = cookie
        conn.request(method, path, body=body, headers=headers)
        res = conn.getresponse()
        raw = res.read().decode("utf-8")
        data = json.loads(raw) if raw else {}
        cookie_header = res.getheader("Set-Cookie") or ""
        conn.close()
        return res.status, data, cookie_header

    def _login(self, username, password):
        status, data, cookie = self._request_json(
            "POST",
            "/api/session/login",
            payload={"username": username, "password": password},
        )
        clean_cookie = cookie.split(";")[0].strip() if cookie else ""
        return clean_cookie, data

    def test_http_endpoint_permissions_and_conversion(self):
        # Tạo sản phẩm
        prod = self.store.create_product(
            name="Rong biển",
            category="Khô",
            unit="gói",
            price=20000,
            sale_price=30000,
        )
        prod_id = prod["id"]

        # 1. Gọi khi chưa đăng nhập -> 401
        status, data, _ = self._request_json(
            "POST",
            f"/api/products/{prod_id}/change-base-unit",
            payload={"new_unit": "lạng", "conversion_rate": 2.0},
        )
        self.assertEqual(status, 401)

        # 2. Gọi khi đăng nhập bằng staff (không phải admin) -> 401
        staff_cookie, _ = self._login("staff", "staffpassword")
        status, data, _ = self._request_json(
            "POST",
            f"/api/products/{prod_id}/change-base-unit",
            payload={"new_unit": "lạng", "conversion_rate": 2.0},
            cookie=staff_cookie,
        )
        self.assertEqual(status, 401)

        # 3. Đăng nhập bằng admin -> thành công 200
        admin_cookie, _ = self._login("masteradmin", "adminpassword")
        status, body, _ = self._request_json(
            "POST",
            f"/api/products/{prod_id}/change-base-unit",
            payload={
                "new_unit": "lạng",
                "conversion_rate": 2.0,
                "add_old_unit_to_conversions": True,
            },
            cookie=admin_cookie,
        )
        self.assertEqual(status, 200)
        self.assertIn("message", body)
        self.assertEqual(body["product"]["unit"], "lạng")
        self.assertEqual(body["product"]["price"], 10000.0)
        self.assertEqual(body["product"]["sale_price"], 15000.0)


if __name__ == "__main__":
    unittest.main()

