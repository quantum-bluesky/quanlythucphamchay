import gc
import json
import sqlite3
import tempfile
import time
import unittest
from datetime import datetime, timedelta
from pathlib import Path

from app import InventoryStore
from qltpchay.store import SyncConflictError


class InventoryStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "inventory-test.db"
        self.store = InventoryStore(self.db_path)

    def tearDown(self) -> None:
        del self.store
        gc.collect()
        last_error = None
        for _ in range(5):
            try:
                self.temp_dir.cleanup()
                last_error = None
                break
            except PermissionError as error:
                last_error = error
                time.sleep(0.1)
        if last_error is not None:
            raise last_error

    def test_ut_db_01_create_product_and_stock_summary(self) -> None:
        product = self.store.create_product(
            name="Chả lụa chay",
            category="Đồ chay đông lạnh",
            unit="gói",
            low_stock_threshold=3,
        )
        self.store.create_transaction(product["id"], "in", 10, "Nhập đầu ngày")
        self.store.create_transaction(product["id"], "out", 4, "Bán lẻ")

        refreshed = self.store.get_product_by_id(product["id"])
        summary = self.store.get_summary()

        self.assertEqual(refreshed["current_stock"], 6.0)
        self.assertFalse(refreshed["is_low_stock"])
        self.assertEqual(summary["product_count"], 1)
        self.assertEqual(summary["total_stock"], 6.0)

    def test_ut_db_02_stock_out_cannot_exceed_inventory(self) -> None:
        product = self.store.create_product(
            name="Xúc xích chay",
            category="Đồ chay đông lạnh",
            unit="cây",
            low_stock_threshold=2,
        )
        self.store.create_transaction(product["id"], "in", 2)

        with self.assertRaisesRegex(ValueError, "lớn hơn tồn kho"):
            self.store.create_transaction(product["id"], "out", 3)

    def test_ut_db_03_inventory_adjustment_receipt_updates_stock_with_reason(self) -> None:
        product = self.store.create_product(
            name="Tàu hũ ky",
            category="Đồ khô",
            unit="gói",
            low_stock_threshold=2,
        )
        self.store.create_transaction(product["id"], "in", 5, "Tồn đầu")

        receipt = self.store.create_inventory_adjustment_receipt(
            items=[{"product_id": product["id"], "quantity_delta": -2}],
            reason="Kiểm kho lệch thực tế",
            actor="masteradmin",
        )
        refreshed = self.store.get_product_by_id(product["id"])

        self.assertTrue(receipt["receipt_code"].startswith("DC-"))
        self.assertEqual(receipt["total_out_quantity"], 2.0)
        self.assertEqual(refreshed["current_stock"], 3.0)

    def test_ut_db_04_customer_return_receipt_increases_stock(self) -> None:
        product = self.store.create_product(
            name="Nem chay",
            category="Đồ chay đông lạnh",
            unit="gói",
            low_stock_threshold=2,
        )
        self.store.create_transaction(product["id"], "in", 1, "Tồn đầu")

        receipt = self.store.create_customer_return_receipt(
            customer_name="Cô Mai",
            items=[{"product_id": product["id"], "quantity": 2, "unit_refund": 45000}],
            note="Khách trả do giao dư",
        )
        refreshed = self.store.get_product_by_id(product["id"])

        self.assertTrue(receipt["receipt_code"].startswith("THK-"))
        self.assertEqual(receipt["total_quantity"], 2.0)
        self.assertEqual(refreshed["current_stock"], 3.0)

    def test_ut_db_05_supplier_return_receipt_reduces_stock(self) -> None:
        product = self.store.create_product(
            name="Đậu hũ non",
            category="Đồ tươi",
            unit="hộp",
            low_stock_threshold=3,
        )
        self.store.create_transaction(product["id"], "in", 7, "Nhập đầu")

        receipt = self.store.create_supplier_return_receipt(
            supplier_name="NCC Hòa Bình",
            items=[{"product_id": product["id"], "quantity": 2, "unit_cost": 12000}],
            note="Hàng lỗi bao bì",
        )
        refreshed = self.store.get_product_by_id(product["id"])

        self.assertTrue(receipt["receipt_code"].startswith("TNCC-"))
        self.assertEqual(receipt["total_quantity"], 2.0)
        self.assertEqual(refreshed["current_stock"], 5.0)

    def test_ut_db_06_inventory_adjustment_requires_reason(self) -> None:
        product = self.store.create_product(
            name="Mì căn",
            category="Đồ khô",
            unit="gói",
            low_stock_threshold=1,
        )
        with self.assertRaisesRegex(ValueError, "Lý do điều chỉnh"):
            self.store.create_inventory_adjustment_receipt(
                items=[{"product_id": product["id"], "quantity_delta": 1}],
                reason="",
            )

    def test_ut_rep_01_monthly_report_separates_phase_b_receipts_from_sales_and_purchases(self) -> None:
        product = self.store.create_product(
            name="Bò lát chay",
            category="Đông lạnh",
            unit="gói",
            price=10000,
            sale_price=15000,
            low_stock_threshold=2,
        )
        self.store.create_purchase_receipt(
            supplier_name="NCC Phase B",
            items=[{"product_id": product["id"], "quantity": 5, "unit_cost": 12000}],
            note="Nhập test report",
        )
        self.store.create_checkout_order(
            customer_name="Khách report",
            items=[{"product_id": product["id"], "quantity": 2, "unit_price": 18000}],
            note="Bán test report",
        )
        self.store.create_customer_return_receipt(
            customer_name="Khách report",
            source_type="order",
            source_code="DH-UT-REP-01",
            items=[{"product_id": product["id"], "quantity": 1, "unit_refund": 17000}],
            note="Khách đổi lại 1 gói",
        )
        self.store.create_supplier_return_receipt(
            supplier_name="NCC Phase B",
            source_type="purchase",
            source_code="PN-UT-REP-01",
            items=[{"product_id": product["id"], "quantity": 1, "unit_cost": 12000}],
            note="Trả NCC 1 gói lỗi",
        )
        self.store.create_inventory_adjustment_receipt(
            items=[
                {"product_id": product["id"], "quantity_delta": 2},
                {"product_id": product["id"], "quantity_delta": -1},
            ],
            reason="Kiểm kho chênh lệch",
            actor="masteradmin",
            note="ACC-UT-REP-01",
        )

        report = self.store.get_monthly_report(
            months=3,
            focus_month=datetime.now().strftime("%Y-%m"),
        )
        focus = report["focus_summary"]
        product_activity = next(
            entry for entry in report["product_activity"] if entry["product_id"] == product["id"]
        )

        self.assertEqual(focus["purchase_value"], 60000.0)
        self.assertEqual(focus["revenue_value"], 36000.0)
        self.assertEqual(focus["cogs_value"], 24000.0)
        self.assertEqual(focus["gross_profit_value"], 12000.0)
        self.assertEqual(focus["customer_return_quantity"], 1.0)
        self.assertEqual(focus["customer_return_value"], 17000.0)
        self.assertEqual(focus["supplier_return_quantity"], 1.0)
        self.assertEqual(focus["supplier_return_value"], 12000.0)
        self.assertEqual(focus["adjustment_in_quantity"], 2.0)
        self.assertEqual(focus["adjustment_out_quantity"], 1.0)
        self.assertEqual(product_activity["customer_return_value"], 17000.0)
        self.assertEqual(product_activity["supplier_return_value"], 12000.0)
        self.assertEqual(product_activity["adjustment_in_quantity"], 2.0)
        self.assertEqual(product_activity["adjustment_out_quantity"], 1.0)

    def test_ut_aud_03_receipt_history_lists_phase_b_receipts_with_source_context(self) -> None:
        product = self.store.create_product(
            name="Cá viên chay",
            category="Đông lạnh",
            unit="gói",
            low_stock_threshold=2,
        )
        self.store.create_transaction(product["id"], "in", 4, "Tồn đầu test audit")

        adjustment = self.store.create_inventory_adjustment_receipt(
            items=[{"product_id": product["id"], "quantity_delta": -1}],
            reason="Kiểm kho",
            actor="masteradmin",
            note="UT-AUD-03",
        )
        customer_return = self.store.create_customer_return_receipt(
            customer_name="Khách audit",
            source_type="order",
            source_code="DH-AUD-03",
            items=[{"product_id": product["id"], "quantity": 1, "unit_refund": 25000}],
            note="Khách đổi hàng",
        )
        supplier_return = self.store.create_supplier_return_receipt(
            supplier_name="NCC audit",
            source_type="purchase",
            source_code="PN-AUD-03",
            items=[{"product_id": product["id"], "quantity": 1, "unit_cost": 15000}],
            note="NCC thu hồi",
        )

        history = self.store.get_receipt_history(limit=10)
        by_code = {entry["receipt_code"]: entry for entry in history}

        self.assertIn(adjustment["receipt_code"], by_code)
        self.assertIn(customer_return["receipt_code"], by_code)
        self.assertIn(supplier_return["receipt_code"], by_code)
        self.assertEqual(by_code[customer_return["receipt_code"]]["source_type"], "order")
        self.assertEqual(by_code[customer_return["receipt_code"]]["source_code"], "DH-AUD-03")
        self.assertIn("Tạo phiếu trả hàng khách", by_code[customer_return["receipt_code"]]["audit_message"])
        self.assertEqual(by_code[supplier_return["receipt_code"]]["source_type"], "purchase")
        self.assertEqual(by_code[supplier_return["receipt_code"]]["source_code"], "PN-AUD-03")
        self.assertIn("Tạo phiếu trả NCC", by_code[supplier_return["receipt_code"]]["audit_message"])
        self.assertEqual(by_code[adjustment["receipt_code"]]["reason"], "Kiểm kho")
        self.assertIn("Tạo phiếu điều chỉnh tồn", by_code[adjustment["receipt_code"]]["audit_message"])

    def test_ut_sync_01_save_sync_state_accepts_matching_expected_updated_at(self) -> None:
        initial = self.store.get_sync_state()
        expected = initial["updated_at"]["carts"]

        payload = {
            "carts": [{"id": "cart-1", "status": "draft", "items": []}],
            "expected_updated_at": {"carts": expected},
        }
        result = self.store.save_sync_state(payload)

        self.assertEqual(result["carts"][0]["id"], "cart-1")

    def test_ut_sync_02_save_sync_state_rejects_stale_expected_updated_at(self) -> None:
        self.store.save_sync_state({"carts": [{"id": "cart-a", "status": "draft", "items": []}]})

        with self.assertRaises(SyncConflictError):
            self.store.save_sync_state(
                {
                    "carts": [{"id": "cart-b", "status": "draft", "items": []}],
                    "expected_updated_at": {"carts": "stale-version"},
                }
            )

    def test_ut_aud_01_save_sync_state_logs_cart_status_changes_with_actor(self) -> None:
        self.store.save_sync_state(
            {
                "carts": [{"id": "cart-1", "orderCode": "DH-01", "status": "draft", "items": []}],
                "expected_updated_at": {"carts": self.store.get_sync_state()["updated_at"]["carts"]},
                "actor": "thu-ngan-a",
            }
        )
        sync_state = self.store.get_sync_state()
        self.store.save_sync_state(
            {
                "carts": [{"id": "cart-1", "orderCode": "DH-01", "status": "completed", "items": []}],
                "expected_updated_at": {"carts": sync_state["updated_at"]["carts"]},
                "actor": "thu-ngan-a",
            }
        )

        history = self.store.get_product_history(limit=40, actor="thu-ngan-a")
        self.assertEqual(history, [])

        with self.store._connect() as connection:
            log = connection.execute(
                """
                SELECT entity_type, action, actor, message
                FROM audit_logs
                WHERE entity_type = 'cart'
                ORDER BY id DESC
                LIMIT 1
                """
            ).fetchone()
        self.assertIsNotNone(log)
        self.assertEqual(log["action"], "status-change")
        self.assertEqual(log["actor"], "thu-ngan-a")
        self.assertIn("draft", log["message"])
        self.assertIn("completed", log["message"])

    def test_ut_aud_02_save_sync_state_logs_purchase_status_changes_with_actor(self) -> None:
        self.store.save_sync_state(
            {
                "purchases": [{"id": "purchase-1", "receiptCode": "PN-01", "status": "draft", "items": []}],
                "expected_updated_at": {"purchases": self.store.get_sync_state()["updated_at"]["purchases"]},
                "actor": "thu-ngan-b",
            }
        )
        sync_state = self.store.get_sync_state()
        self.store.save_sync_state(
            {
                "purchases": [{"id": "purchase-1", "receiptCode": "PN-01", "status": "ordered", "items": []}],
                "expected_updated_at": {"purchases": sync_state["updated_at"]["purchases"]},
                "actor": "thu-ngan-b",
            }
        )

        with self.store._connect() as connection:
            log = connection.execute(
                """
                SELECT entity_type, action, actor, message
                FROM audit_logs
                WHERE entity_type = 'purchase'
                ORDER BY id DESC
                LIMIT 1
                """
            ).fetchone()
        self.assertIsNotNone(log)
        self.assertEqual(log["action"], "status-change")
        self.assertEqual(log["actor"], "thu-ngan-b")
        self.assertIn("draft", log["message"])
        self.assertIn("ordered", log["message"])

    def test_ut_his_01_product_history_supports_actor_filter(self) -> None:
        product = self.store.create_product(
            name="Đậu gà viên",
            category="Đông lạnh",
            unit="gói",
            low_stock_threshold=2,
        )
        self.store.update_product_price(product["id"], 25000, actor="user-a")
        self.store.update_product_sale_price(product["id"], 32000, actor="user-b")

        actor_a_logs = self.store.get_product_history(limit=20, actor="user-a")
        actor_b_logs = self.store.get_product_history(limit=20, actor="user-b")

        self.assertTrue(any(entry["action"] == "update-price" for entry in actor_a_logs))
        self.assertFalse(any(entry["action"] == "update-sale-price" for entry in actor_a_logs))
        self.assertTrue(any(entry["action"] == "update-sale-price" for entry in actor_b_logs))

    def test_ut_his_02_product_history_supports_date_range_filter(self) -> None:
        product = self.store.create_product(
            name="Nấm đùi gà sốt",
            category="Đông lạnh",
            unit="gói",
            low_stock_threshold=2,
        )
        self.store.update_product_price(product["id"], 28000, actor="user-date")

        log_entry = next(
            entry
            for entry in self.store.get_product_history(limit=20)
            if entry["product_id"] == product["id"] and entry["action"] == "update-price"
        )
        created_at = datetime.fromisoformat(log_entry["created_at"])
        one_second_before = (created_at - timedelta(seconds=1)).isoformat(timespec="seconds")
        one_second_after = (created_at + timedelta(seconds=1)).isoformat(timespec="seconds")

        included_logs = self.store.get_product_history(
            limit=20,
            start_date=one_second_before,
            end_date=one_second_after,
        )
        excluded_logs = self.store.get_product_history(
            limit=20,
            start_date=one_second_after,
        )

        self.assertTrue(any(entry["id"] == log_entry["id"] for entry in included_logs))
        self.assertFalse(any(entry["id"] == log_entry["id"] for entry in excluded_logs))

    def test_ut_norm_01_save_sync_state_persists_relational_tables(self) -> None:
        payload = {
            "customers": [
                {
                    "id": "customer-1",
                    "name": "Khách A",
                    "phone": "0909",
                    "address": "HN",
                    "zaloUrl": "https://zalo.me/a",
                    "createdAt": "2026-01-01T00:00:00+00:00",
                    "updatedAt": "2026-01-02T00:00:00+00:00",
                }
            ],
            "suppliers": [
                {
                    "id": "supplier-1",
                    "name": "NCC A",
                    "phone": "0911",
                    "address": "HCM",
                    "note": "Ghi chú",
                    "createdAt": "2026-01-01T00:00:00+00:00",
                    "updatedAt": "2026-01-02T00:00:00+00:00",
                }
            ],
            "carts": [
                {
                    "id": "cart-1",
                    "customerId": "customer-1",
                    "customerName": "Khách A",
                    "status": "draft",
                    "paymentStatus": "unpaid",
                    "createdAt": "2026-01-01T00:00:00+00:00",
                    "updatedAt": "2026-01-02T00:00:00+00:00",
                    "orderCode": "",
                    "items": [
                        {
                            "id": "cart-item-1",
                            "productId": 0,
                            "productName": "SP A",
                            "quantity": 2,
                            "unitPrice": 30000,
                            "note": "",
                        }
                    ],
                }
            ],
            "purchases": [
                {
                    "id": "purchase-1",
                    "supplierId": "supplier-1",
                    "supplierName": "NCC A",
                    "status": "draft",
                    "note": "Phiếu nháp",
                    "createdAt": "2026-01-01T00:00:00+00:00",
                    "updatedAt": "2026-01-02T00:00:00+00:00",
                    "receiptCode": "",
                    "items": [
                        {
                            "id": "purchase-item-1",
                            "productId": 0,
                            "productName": "SP B",
                            "quantity": 3,
                            "unitCost": 15000,
                        }
                    ],
                }
            ],
        }

        result = self.store.save_sync_state(payload)
        self.assertEqual(result["customers"][0]["name"], "Khách A")
        self.assertEqual(result["purchases"][0]["items"][0]["unitCost"], 15000.0)

        with self.store._connect() as connection:
            customer_count = connection.execute("SELECT COUNT(*) AS total FROM customers").fetchone()["total"]
            supplier_count = connection.execute("SELECT COUNT(*) AS total FROM suppliers").fetchone()["total"]
            cart_count = connection.execute("SELECT COUNT(*) AS total FROM carts").fetchone()["total"]
            cart_item_count = connection.execute("SELECT COUNT(*) AS total FROM cart_items").fetchone()["total"]
            purchase_count = connection.execute("SELECT COUNT(*) AS total FROM purchases").fetchone()["total"]
            purchase_item_count = connection.execute("SELECT COUNT(*) AS total FROM purchase_items").fetchone()["total"]

        self.assertEqual(customer_count, 1)
        self.assertEqual(supplier_count, 1)
        self.assertEqual(cart_count, 1)
        self.assertEqual(cart_item_count, 1)
        self.assertEqual(purchase_count, 1)
        self.assertEqual(purchase_item_count, 1)

    def test_ut_norm_02_receipt_creation_persists_normalized_receipt_tables(self) -> None:
        product = self.store.create_product(
            name="Đậu hũ Nhật",
            category="Đồ tươi",
            unit="hộp",
            low_stock_threshold=2,
        )
        self.store.create_transaction(product["id"], "in", 10, "Tồn đầu")

        purchase_receipt = self.store.create_purchase_receipt(
            items=[{"product_id": product["id"], "quantity": 2, "unit_cost": 11000}],
            supplier_name="NCC Test",
            note="Nhập hàng thường",
        )
        adjustment_receipt = self.store.create_inventory_adjustment_receipt(
            items=[{"product_id": product["id"], "quantity_delta": -1}],
            reason="Kiểm kho lệch",
            actor="masteradmin",
        )

        with self.store._connect() as connection:
            receipt_types = connection.execute(
                "SELECT receipt_type, receipt_code FROM inventory_receipts ORDER BY id"
            ).fetchall()
            receipt_items = connection.execute(
                "SELECT COUNT(*) AS total FROM inventory_receipt_items"
            ).fetchone()

        self.assertTrue(any(row["receipt_code"] == purchase_receipt["receipt_code"] and row["receipt_type"] == "purchase" for row in receipt_types))
        self.assertTrue(any(row["receipt_code"] == adjustment_receipt["receipt_code"] and row["receipt_type"] == "inventory_adjustment" for row in receipt_types))
        self.assertEqual(receipt_items["total"], 2)

    def test_ut_norm_03_legacy_app_state_is_migrated_to_normalized_tables_on_bootstrap(self) -> None:
        legacy_db = Path(self.temp_dir.name) / "legacy.db"
        now = "2026-01-02T00:00:00+00:00"
        with sqlite3.connect(str(legacy_db)) as connection:
            connection.executescript(
                """
                CREATE TABLE products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
                    category TEXT NOT NULL,
                    unit TEXT NOT NULL,
                    price REAL NOT NULL DEFAULT 0,
                    sale_price REAL NOT NULL DEFAULT 0,
                    low_stock_threshold REAL NOT NULL DEFAULT 5,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    deleted_at TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    product_id INTEGER NOT NULL,
                    transaction_type TEXT NOT NULL,
                    quantity REAL NOT NULL,
                    note TEXT DEFAULT '',
                    created_at TEXT NOT NULL
                );
                CREATE TABLE app_state (
                    state_key TEXT PRIMARY KEY,
                    state_value TEXT NOT NULL DEFAULT '[]',
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    entity_name TEXT NOT NULL DEFAULT '',
                    action TEXT NOT NULL,
                    actor TEXT NOT NULL DEFAULT '',
                    message TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL
                );
                """
            )
            connection.execute(
                "INSERT INTO app_state(state_key, state_value, updated_at) VALUES(?, ?, ?)",
                ("customers", json.dumps([{"id": "legacy-customer", "name": "Khách legacy", "createdAt": now, "updatedAt": now}], ensure_ascii=False), now),
            )
            connection.execute(
                "INSERT INTO app_state(state_key, state_value, updated_at) VALUES(?, ?, ?)",
                ("suppliers", json.dumps([{"id": "legacy-supplier", "name": "NCC legacy", "createdAt": now, "updatedAt": now}], ensure_ascii=False), now),
            )
            connection.execute(
                "INSERT INTO app_state(state_key, state_value, updated_at) VALUES(?, ?, ?)",
                ("carts", json.dumps([{"id": "legacy-cart", "customerId": "legacy-customer", "customerName": "Khách legacy", "status": "draft", "items": []}], ensure_ascii=False), now),
            )
            connection.execute(
                "INSERT INTO app_state(state_key, state_value, updated_at) VALUES(?, ?, ?)",
                ("purchases", json.dumps([{"id": "legacy-purchase", "supplierName": "NCC legacy", "status": "draft", "items": []}], ensure_ascii=False), now),
            )

        migrated_store = InventoryStore(legacy_db)
        state = migrated_store.get_sync_state()

        self.assertTrue(any(entry["id"] == "legacy-customer" for entry in state["customers"]))
        self.assertTrue(any(entry["id"] == "legacy-supplier" for entry in state["suppliers"]))
        self.assertTrue(any(entry["id"] == "legacy-cart" for entry in state["carts"]))
        self.assertTrue(any(entry["id"] == "legacy-purchase" for entry in state["purchases"]))
        del migrated_store


if __name__ == "__main__":
    unittest.main()
