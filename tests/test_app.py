import copy
import gc
import json
import os
import sqlite3
import tempfile
import time
import unittest
from datetime import datetime, timedelta
from pathlib import Path

from app import InventoryStore
from qltpchay.http_handler import create_handler
from qltpchay.importer import parse_seed_line
from qltpchay.store import SyncConflictError


class InventoryStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        fd, db_file = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        self.db_path = Path(db_file)
        self.store = InventoryStore(self.db_path)

    def tearDown(self) -> None:
        del self.store
        gc.collect()
        for suffix in ("", "-wal", "-shm"):
            self.db_path.with_name(self.db_path.name + suffix).unlink(missing_ok=True)

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

    def test_ut_invsort_01_product_life_fields_and_priority_metrics_are_normalized(self) -> None:
        product = self.store.create_product(
            name="Bò kho ưu tiên",
            category="Đồ chay",
            unit="gói",
            price=10000,
            sale_price=15000,
            low_stock_threshold=5,
            shelf_life_days=30,
            storage_life_days=45,
        )
        self.store.create_purchase_receipt(
            supplier_name="NCC metric",
            items=[{"product_id": product["id"], "quantity": 10, "unit_cost": 10000}],
        )
        self.store.create_checkout_order(
            customer_name="Khách metric",
            items=[{"product_id": product["id"], "quantity": 6, "unit_price": 15000}],
        )
        self.store.create_supplier_return_receipt(
            supplier_name="NCC metric",
            items=[{"product_id": product["id"], "quantity": 1, "unit_cost": 10000}],
        )
        self.store.create_inventory_adjustment_receipt(
            items=[{"product_id": product["id"], "quantity_delta": -1}],
            reason="Kiểm metric",
            actor="tester",
        )

        refreshed = self.store.get_product_by_id(product["id"])

        self.assertEqual(refreshed["shelf_life_days"], 30.0)
        self.assertEqual(refreshed["storage_life_days"], 45.0)
        self.assertEqual(refreshed["sales_6m_total"], 6.0)
        self.assertEqual(refreshed["sales_12m_total"], 6.0)
        self.assertEqual(refreshed["priority_base_stock"], 5.0)
        self.assertEqual(refreshed["demand_pressure"], 0.2)
        self.assertEqual(refreshed["shortage_pressure"], 0.6)
        self.assertEqual(refreshed["priority_score"], 40.0)
        self.assertEqual(refreshed["urgency_tier"], 2)
        self.assertEqual(refreshed["estimated_remaining_days"], 30.0)
        self.assertEqual(refreshed["expiry_basis"], "shelf_life")

    def test_ut_invsort_02_master_csv_and_seed_import_accept_life_fields(self) -> None:
        manifest_path = self.db_path.with_name("asset-versions-test.json")
        handler = create_handler(
            self.store,
            admin_sessions=None,
            system_config={"asset_versions_path": manifest_path, "version": "test"},
        )
        try:
            old_csv = "name,category,unit,price,sale_price,low_stock_threshold\nĐậu hũ,Đồ tươi,hộp,10000,12000,4\n"
            old_records = handler._parse_master_csv_records("products", old_csv)
            self.assertEqual(old_records[0]["shelf_life_days"], None)
            self.assertEqual(old_records[0]["storage_life_days"], None)

            new_csv = (
                "name,category,unit,price,sale_price,low_stock_threshold,shelf_life_days,storage_life_days\n"
                "Chả chay,Đông lạnh,gói,20000,25000,3,90,120\n"
            )
            new_records = handler._parse_master_csv_records("products", new_csv)
            self.assertEqual(new_records[0]["shelf_life_days"], 90.0)
            self.assertEqual(new_records[0]["storage_life_days"], 120.0)

            self.store.import_master_data("products", new_records)
            product = self.store.get_products()[0]
            exported_csv = handler._build_master_csv_bytes("products", [product]).decode("utf-8-sig")
            self.assertIn("shelf_life_days", exported_csv.splitlines()[0])
            self.assertIn("storage_life_days", exported_csv.splitlines()[0])

            seed = parse_seed_line(
                "Mì căn | Đồ khô | gói | 2 | 15000 | 180 | 240",
                "Đồ chay",
                "gói",
                5,
                0,
            )
            self.assertEqual(seed["shelf_life_days"], 180.0)
            self.assertEqual(seed["storage_life_days"], 240.0)
        finally:
            manifest_path.unlink(missing_ok=True)

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

    def test_ut_db_07_repair_purchase_document_deletes_invalid_paid_purchase_and_detaches_links(self) -> None:
        product = self.store.create_product(
            name="Chả cá chay lỗi phiếu",
            category="Đông lạnh",
            unit="gói",
            low_stock_threshold=2,
        )
        self.store.create_transaction(product["id"], "in", 5, "Tồn đầu repair purchase")
        self.store.create_supplier_return_receipt(
            supplier_name="NCC Repair",
            source_type="purchase",
            source_code="PN-BROKEN-01",
            items=[{"product_id": product["id"], "quantity": 1, "unit_cost": 12000}],
            note="Phiếu trả đang tham chiếu mã lỗi",
        )

        now = "2026-04-19T09:10:00+07:00"
        with self.store._connect() as connection:
            self.store._replace_sync_collection_records(
                connection,
                "purchases",
                [
                    {
                        "id": "purchase-broken-01",
                        "supplierName": "NCC Repair",
                        "status": "paid",
                        "note": "Phiếu lỗi chưa nhập kho",
                        "createdAt": "2026-04-19T09:00:00+07:00",
                        "updatedAt": now,
                        "paidAt": now,
                        "receiptCode": "PN-BROKEN-01",
                        "items": [
                            {
                                "id": "purchase-item-broken-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 2,
                                "unitCost": 12000,
                            }
                        ],
                    }
                ],
            )
            canonical = self.store._load_sync_collection_from_tables(connection, "purchases")
            connection.execute(
                "UPDATE app_state SET state_value = ?, updated_at = ? WHERE state_key = ?",
                (json.dumps(canonical, ensure_ascii=False), now, "purchases"),
            )

        result = self.store.repair_purchase_document(
            "purchase-broken-01",
            action="delete",
            actor="masteradmin",
        )

        self.assertEqual(result["purchases"], [])
        self.assertEqual(len(result["detached_receipt_codes"]), 1)
        self.assertIn("gỡ liên kết nguồn", result["message"])
        self.assertEqual(self.store.get_product_by_id(product["id"])["current_stock"], 4.0)

        with self.store._connect() as connection:
            detached_source = connection.execute(
                """
                SELECT source_type, source_code
                FROM inventory_receipts
                WHERE receipt_type = 'supplier_return'
                ORDER BY id DESC
                LIMIT 1
                """
            ).fetchone()
            purchase_count = connection.execute(
                "SELECT COUNT(*) AS total FROM purchases"
            ).fetchone()["total"]
            audit_row = connection.execute(
                """
                SELECT action, actor, message
                FROM audit_logs
                WHERE entity_type = 'purchase' AND entity_id = 'purchase-broken-01'
                ORDER BY id DESC
                LIMIT 1
                """
            ).fetchone()
        self.assertEqual(detached_source["source_type"], "")
        self.assertEqual(detached_source["source_code"], "")
        self.assertEqual(purchase_count, 0)
        self.assertEqual(audit_row["action"], "repair-delete")
        self.assertEqual(audit_row["actor"], "masteradmin")

    def test_ut_db_08_repair_purchase_document_rejects_valid_paid_purchase_with_receipt(self) -> None:
        product = self.store.create_product(
            name="Đậu viên chay đã nhập kho",
            category="Đông lạnh",
            unit="gói",
            low_stock_threshold=2,
        )
        receipt = self.store.create_purchase_receipt(
            supplier_name="NCC Valid",
            items=[{"product_id": product["id"], "quantity": 2, "unit_cost": 15000}],
            note="Phiếu hợp lệ",
        )

        sync_state = self.store.get_sync_state()
        self.store.save_sync_state(
            {
                "purchases": [
                    {
                        "id": "purchase-valid-01",
                        "supplierName": "NCC Valid",
                        "status": "paid",
                        "note": "Phiếu hợp lệ đã nhập kho",
                        "createdAt": "2026-04-19T09:00:00+07:00",
                        "updatedAt": "2026-04-19T09:10:00+07:00",
                        "receivedAt": "2026-04-19T09:05:00+07:00",
                        "paidAt": "2026-04-19T09:10:00+07:00",
                        "receiptCode": receipt["receipt_code"],
                        "items": [
                            {
                                "id": "purchase-item-valid-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 2,
                                "unitCost": 15000,
                            }
                        ],
                    }
                ],
                "expected_updated_at": {"purchases": sync_state["updated_at"]["purchases"]},
            }
        )

        with self.assertRaisesRegex(ValueError, "xử lý phiếu lỗi chưa có nhập kho thật"):
            self.store.repair_purchase_document(
                "purchase-valid-01",
                action="delete",
                actor="masteradmin",
            )

    def test_ut_db_09_repair_purchase_document_cancels_draft_with_paid_markers(self) -> None:
        product = self.store.create_product(
            name="Phiếu nháp lệch marker",
            category="Đông lạnh",
            unit="gói",
            low_stock_threshold=1,
        )
        now = "2026-04-19T10:10:00+07:00"
        with self.store._connect() as connection:
            self.store._replace_sync_collection_records(
                connection,
                "purchases",
                [
                    {
                        "id": "purchase-draft-broken-01",
                        "supplierName": "NCC Draft Broken",
                        "status": "draft",
                        "note": "Nháp nhưng còn marker thanh toán",
                        "createdAt": "2026-04-19T10:00:00+07:00",
                        "updatedAt": now,
                        "paidAt": now,
                        "receiptCode": "PN-DRAFT-BROKEN-01",
                        "items": [
                            {
                                "id": "purchase-item-draft-broken-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 1,
                                "unitCost": 18000,
                            }
                        ],
                    }
                ],
            )
            canonical = self.store._load_sync_collection_from_tables(connection, "purchases")
            connection.execute(
                "UPDATE app_state SET state_value = ?, updated_at = ? WHERE state_key = ?",
                (json.dumps(canonical, ensure_ascii=False), now, "purchases"),
            )

        result = self.store.repair_purchase_document(
            "purchase-draft-broken-01",
            action="cancel",
            actor="masteradmin",
        )
        repaired = result["purchases"][0]
        self.assertEqual(repaired["status"], "cancelled")
        self.assertEqual(repaired["paidAt"], None)
        self.assertEqual(repaired["receivedAt"], None)
        self.assertEqual(repaired["receiptCode"], "")
        self.assertIn("phiếu lỗi", result["message"])

    def test_ut_db_10_legacy_received_purchase_backfills_received_at_from_updated_at(self) -> None:
        product = self.store.create_product(
            name="Phiếu nhập legacy thiếu ngày nhận",
            category="Đông lạnh",
            unit="gói",
            low_stock_threshold=1,
        )
        updated_at = "2026-04-19T11:45:00+07:00"
        with self.store._connect() as connection:
            self.store._replace_sync_collection_records(
                connection,
                "purchases",
                [
                    {
                        "id": "purchase-received-legacy-01",
                        "supplierName": "NCC Legacy Received",
                        "status": "received",
                        "note": "Phiếu cũ thiếu received_at",
                        "createdAt": "2026-04-19T11:00:00+07:00",
                        "updatedAt": updated_at,
                        "receiptCode": "",
                        "items": [
                            {
                                "id": "purchase-item-received-legacy-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 2,
                                "unitCost": 21000,
                            }
                        ],
                    }
                ],
            )
            canonical = self.store._load_sync_collection_from_tables(connection, "purchases")
            connection.execute(
                "UPDATE app_state SET state_value = ?, updated_at = ? WHERE state_key = ?",
                (json.dumps(canonical, ensure_ascii=False), updated_at, "purchases"),
            )

        sync_state = self.store.get_sync_state()
        purchase = next(entry for entry in sync_state["purchases"] if entry["id"] == "purchase-received-legacy-01")
        self.assertEqual(purchase["receivedAt"], updated_at)

    def test_ut_db_11_purchase_must_be_ordered_before_receive_and_ordered_remains_editable(self) -> None:
        product = self.store.create_product(
            name="Phiếu nhập ordered flow",
            category="Đồ khô",
            unit="gói",
            low_stock_threshold=1,
        )
        now = "2026-04-19T12:15:00+07:00"
        draft_purchase = {
            "id": "purchase-ordered-flow-01",
            "supplierName": "NCC Ordered Flow",
            "note": "Phiếu flow test",
            "status": "draft",
            "createdAt": now,
            "updatedAt": now,
            "receiptCode": "",
            "items": [
                {
                    "id": "purchase-item-ordered-flow-01",
                    "productId": product["id"],
                    "productName": product["name"],
                    "quantity": 1,
                    "unitCost": 18000,
                }
            ],
        }
        sync_state = self.store.get_sync_state()
        self.store.save_sync_state(
            {
                "purchases": [draft_purchase],
                "expected_updated_at": {"purchases": sync_state["updated_at"]["purchases"]},
            }
        )

        draft_state = self.store.get_sync_state()
        invalid_receive_payload = copy.deepcopy(draft_state["purchases"])
        invalid_receive_purchase = invalid_receive_payload[0]
        invalid_receive_purchase["status"] = "received"
        invalid_receive_purchase["receivedAt"] = now
        invalid_receive_purchase["receiptCode"] = "PN-INVALID-01"

        with self.assertRaisesRegex(ValueError, "đặt hàng trước khi nhập kho"):
            self.store.save_sync_state(
                {
                    "purchases": invalid_receive_payload,
                    "expected_updated_at": {"purchases": draft_state["updated_at"]["purchases"]},
                }
            )

        ordered_payload = copy.deepcopy(draft_state["purchases"])
        ordered_purchase = ordered_payload[0]
        ordered_purchase["status"] = "ordered"
        ordered_purchase["note"] = "Đã đặt hàng, còn chỉnh được"
        ordered_purchase["items"][0]["quantity"] = 2
        ordered_purchase["items"][0]["unitCost"] = 19000

        self.store.save_sync_state(
            {
                "purchases": ordered_payload,
                "expected_updated_at": {"purchases": draft_state["updated_at"]["purchases"]},
            }
        )

        ordered_state = self.store.get_sync_state()
        editable_ordered_payload = copy.deepcopy(ordered_state["purchases"])
        editable_ordered_purchase = editable_ordered_payload[0]
        editable_ordered_purchase["note"] = "Đã đặt hàng, chỉnh tiếp dòng"
        editable_ordered_purchase["items"][0]["quantity"] = 3
        editable_ordered_purchase["items"][0]["unitCost"] = 20000

        self.store.save_sync_state(
            {
                "purchases": editable_ordered_payload,
                "expected_updated_at": {"purchases": ordered_state["updated_at"]["purchases"]},
            }
        )

        edited_ordered_state = self.store.get_sync_state()
        received_payload = copy.deepcopy(edited_ordered_state["purchases"])
        received_purchase = received_payload[0]
        received_purchase["status"] = "received"
        received_purchase["receivedAt"] = "2026-04-19T12:20:00+07:00"
        received_purchase["receiptCode"] = "PN-ORDERED-FLOW-01"

        self.store.save_sync_state(
            {
                "purchases": received_payload,
                "expected_updated_at": {"purchases": edited_ordered_state["updated_at"]["purchases"]},
            }
        )

        final_state = self.store.get_sync_state()
        purchase = next(entry for entry in final_state["purchases"] if entry["id"] == "purchase-ordered-flow-01")
        self.assertEqual(purchase["status"], "received")
        self.assertEqual(purchase["receivedAt"], "2026-04-19T12:20:00+07:00")
        self.assertEqual(purchase["receiptCode"], "PN-ORDERED-FLOW-01")

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
            discount_amount=5000,
        )
        self.store.create_checkout_order(
            customer_name="Khách report",
            items=[{"product_id": product["id"], "quantity": 2, "unit_price": 18000}],
            note="Bán test report",
            discount_amount=6000,
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

        self.assertEqual(focus["purchase_value"], 55000.0)
        self.assertEqual(focus["revenue_value"], 30000.0)
        self.assertEqual(focus["cogs_value"], 24000.0)
        self.assertEqual(focus["gross_profit_value"], 6000.0)
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

    def test_ut_sync_03_discount_updates_are_allowed_before_paid_and_locked_after_paid(self) -> None:
        product = self.store.create_product(
            name="Phiếu có giảm giá",
            category="Đông lạnh",
            unit="gói",
            price=10000,
            sale_price=15000,
            low_stock_threshold=1,
        )
        initial_state = self.store.get_sync_state()
        self.store.save_sync_state(
            {
                "carts": [
                    {
                        "id": "cart-discount-01",
                        "customerName": "Khách discount",
                        "status": "completed",
                        "paymentStatus": "unpaid",
                        "discountAmount": 0,
                        "completedAt": "2026-05-06T09:10:00+07:00",
                        "updatedAt": "2026-05-06T09:10:00+07:00",
                        "orderCode": "DH-20260506-091000-abc123",
                        "items": [
                            {
                                "id": "cart-item-discount-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 2,
                                "unitPrice": 15000,
                            }
                        ],
                    }
                ],
                "purchases": [
                    {
                        "id": "purchase-discount-01",
                        "supplierName": "NCC discount",
                        "status": "received",
                        "discountAmount": 0,
                        "receivedAt": "2026-05-06T09:20:00+07:00",
                        "updatedAt": "2026-05-06T09:20:00+07:00",
                        "receiptCode": "PN-20260506-092000-def456",
                        "items": [
                            {
                                "id": "purchase-item-discount-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 3,
                                "unitCost": 10000,
                            }
                        ],
                    }
                ],
                "expected_updated_at": {
                    "carts": initial_state["updated_at"]["carts"],
                    "purchases": initial_state["updated_at"]["purchases"],
                },
            }
        )

        editable_state = self.store.get_sync_state()
        editable_carts = copy.deepcopy(editable_state["carts"])
        editable_purchases = copy.deepcopy(editable_state["purchases"])
        editable_carts[0]["discountAmount"] = 5000
        editable_purchases[0]["discountAmount"] = 4000
        updated_state = self.store.save_sync_state(
            {
                "carts": editable_carts,
                "purchases": editable_purchases,
                "expected_updated_at": {
                    "carts": editable_state["updated_at"]["carts"],
                    "purchases": editable_state["updated_at"]["purchases"],
                },
            }
        )

        self.assertEqual(updated_state["carts"][0]["discountAmount"], 5000.0)
        self.assertEqual(updated_state["purchases"][0]["discountAmount"], 4000.0)

        paid_state = self.store.get_sync_state()
        paid_carts = copy.deepcopy(paid_state["carts"])
        paid_purchases = copy.deepcopy(paid_state["purchases"])
        paid_carts[0]["paymentStatus"] = "paid"
        paid_carts[0]["paidAt"] = "2026-05-06T09:30:00+07:00"
        paid_purchases[0]["status"] = "paid"
        paid_purchases[0]["paidAt"] = "2026-05-06T09:35:00+07:00"
        locked_state = self.store.save_sync_state(
            {
                "carts": paid_carts,
                "purchases": paid_purchases,
                "expected_updated_at": {
                    "carts": paid_state["updated_at"]["carts"],
                    "purchases": paid_state["updated_at"]["purchases"],
                },
            }
        )

        final_carts = copy.deepcopy(locked_state["carts"])
        final_purchases = copy.deepcopy(locked_state["purchases"])
        final_carts[0]["discountAmount"] = 6000
        final_purchases[0]["discountAmount"] = 4500

        with self.assertRaisesRegex(ValueError, "không thể sửa giảm giá khuyến mại"):
            self.store.save_sync_state(
                {
                    "carts": final_carts,
                    "expected_updated_at": {"carts": locked_state["updated_at"]["carts"]},
                }
            )

        with self.assertRaisesRegex(ValueError, "không thể sửa giảm giá khuyến mại"):
            self.store.save_sync_state(
                {
                    "purchases": final_purchases,
                    "expected_updated_at": {"purchases": locked_state["updated_at"]["purchases"]},
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
        product = self.store.create_product(
            name="Đậu hũ audit",
            category="Đồ tươi",
            unit="hộp",
            low_stock_threshold=2,
        )
        self.store.save_sync_state(
            {
                "purchases": [
                    {
                        "id": "purchase-1",
                        "receiptCode": "PN-01",
                        "status": "draft",
                        "items": [
                            {
                                "id": "purchase-item-1",
                                "productId": product["id"],
                                "productName": product["name"],
                                "unit": product["unit"],
                                "quantity": 1,
                                "unitCost": 12000,
                            }
                        ],
                    }
                ],
                "expected_updated_at": {"purchases": self.store.get_sync_state()["updated_at"]["purchases"]},
                "actor": "thu-ngan-b",
            }
        )
        sync_state = self.store.get_sync_state()
        self.store.save_sync_state(
            {
                "purchases": [
                    {
                        "id": "purchase-1",
                        "receiptCode": "PN-01",
                        "status": "ordered",
                        "items": [
                            {
                                "id": "purchase-item-1",
                                "productId": product["id"],
                                "productName": product["name"],
                                "unit": product["unit"],
                                "quantity": 1,
                                "unitCost": 12000,
                            }
                        ],
                    }
                ],
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
                    "discountAmount": 4000,
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
                    "discountAmount": 2500,
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
        self.assertEqual(result["carts"][0]["discountAmount"], 4000.0)
        self.assertEqual(result["purchases"][0]["discountAmount"], 2500.0)
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
        fd, legacy_file = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        legacy_db = Path(legacy_file)
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
        self.assertFalse(any(entry["id"] == "legacy-purchase" for entry in state["purchases"]))
        del migrated_store
        gc.collect()

    def test_ut_norm_04_empty_purchase_drafts_are_not_persisted(self) -> None:
        product = self.store.create_product(
            name="Đậu hũ non",
            category="Đồ tươi",
            unit="hộp",
            low_stock_threshold=2,
        )
        now = "2026-04-19T12:00:00+07:00"
        sync_state = self.store.get_sync_state()
        result = self.store.save_sync_state(
            {
                "purchases": [
                    {
                        "id": "purchase-empty-01",
                        "supplierName": "NCC Rỗng",
                        "status": "draft",
                        "createdAt": now,
                        "updatedAt": now,
                        "items": [],
                    },
                    {
                        "id": "purchase-filled-01",
                        "supplierName": "NCC Có Hàng",
                        "status": "draft",
                        "createdAt": now,
                        "updatedAt": now,
                        "items": [
                            {
                                "id": "purchase-item-filled-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "unit": product["unit"],
                                "quantity": 2,
                                "unitCost": 15000,
                            }
                        ],
                    },
                ],
                "expected_updated_at": {"purchases": sync_state["updated_at"]["purchases"]},
            }
        )

        saved_ids = [entry["id"] for entry in result["purchases"]]

        with self.store._connect() as connection:
            purchase_count = connection.execute(
                "SELECT COUNT(*) AS total FROM purchases"
            ).fetchone()["total"]
            purchase_item_count = connection.execute(
                "SELECT COUNT(*) AS total FROM purchase_items"
            ).fetchone()["total"]

        self.assertNotIn("purchase-empty-01", saved_ids)
        self.assertIn("purchase-filled-01", saved_ids)
        self.assertEqual(purchase_count, 1)
        self.assertEqual(purchase_item_count, 1)

    def test_ut_norm_05_purchase_shortage_source_is_persisted_separate_from_note(self) -> None:
        product = self.store.create_product(
            name="Chả chay lá lốt",
            category="Đồ chay",
            unit="gói",
            low_stock_threshold=2,
        )
        sync_state = self.store.get_sync_state()
        result = self.store.save_sync_state(
            {
                "purchases": [
                    {
                        "id": "purchase-shortage-source-01",
                        "supplierName": "",
                        "note": "",
                        "sourceType": "cart",
                        "sourceCode": "cart-shortage-01",
                        "sourceName": "Huệ F0604",
                        "status": "draft",
                        "createdAt": "2026-05-04T22:15:00+07:00",
                        "updatedAt": "2026-05-04T22:15:00+07:00",
                        "items": [
                            {
                                "id": "purchase-shortage-item-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "unit": product["unit"],
                                "quantity": 3,
                                "unitCost": 25000,
                            }
                        ],
                    }
                ],
                "expected_updated_at": {"purchases": sync_state["updated_at"]["purchases"]},
            }
        )

        saved_purchase = next(entry for entry in result["purchases"] if entry["id"] == "purchase-shortage-source-01")
        self.assertEqual(saved_purchase["note"], "")
        self.assertEqual(saved_purchase["sourceType"], "cart")
        self.assertEqual(saved_purchase["sourceCode"], "cart-shortage-01")
        self.assertEqual(saved_purchase["sourceName"], "Huệ F0604")

        with self.store._connect() as connection:
            row = connection.execute(
                "SELECT note, source_type, source_code, source_name FROM purchases WHERE id = ?",
                ("purchase-shortage-source-01",),
            ).fetchone()

        self.assertEqual(row["note"], "")
        self.assertEqual(row["source_type"], "cart")
        self.assertEqual(row["source_code"], "cart-shortage-01")
        self.assertEqual(row["source_name"], "Huệ F0604")

    def test_ut_norm_06_legacy_purchase_shortage_note_is_promoted_to_source_metadata(self) -> None:
        product = self.store.create_product(
            name="Nấm đùi gà",
            category="Đồ tươi",
            unit="gói",
            low_stock_threshold=2,
        )
        sync_state = self.store.get_sync_state()
        result = self.store.save_sync_state(
            {
                "purchases": [
                    {
                        "id": "purchase-legacy-shortage-01",
                        "supplierName": "",
                        "note": "Thiếu hàng cho đơn của Huệ F0604",
                        "status": "draft",
                        "createdAt": "2026-05-04T22:15:00+07:00",
                        "updatedAt": "2026-05-04T22:15:00+07:00",
                        "items": [
                            {
                                "id": "purchase-legacy-shortage-item-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "unit": product["unit"],
                                "quantity": 2,
                                "unitCost": 18000,
                            }
                        ],
                    }
                ],
                "expected_updated_at": {"purchases": sync_state["updated_at"]["purchases"]},
            }
        )

        saved_purchase = next(entry for entry in result["purchases"] if entry["id"] == "purchase-legacy-shortage-01")
        self.assertEqual(saved_purchase["note"], "")
        self.assertEqual(saved_purchase["sourceType"], "cart")
        self.assertEqual(saved_purchase["sourceName"], "Huệ F0604")

        with self.store._connect() as connection:
            row = connection.execute(
                "SELECT note, source_type, source_name FROM purchases WHERE id = ?",
                ("purchase-legacy-shortage-01",),
            ).fetchone()

        self.assertEqual(row["note"], "")
        self.assertEqual(row["source_type"], "cart")
        self.assertEqual(row["source_name"], "Huệ F0604")



if __name__ == "__main__":
    unittest.main()
