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
from qltpchay.store import BulkOrderRequestDuplicateError, SyncConflictError


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

    def _create_purchase_receipt_at(
        self,
        *,
        supplier_name: str,
        items: list[dict],
        created_at: str,
        note: str = "",
    ) -> dict:
        with self.store._connect() as connection:
            return self.store._create_purchase_receipt_in_connection(
                connection,
                supplier_name=supplier_name,
                items=items,
                note=note,
                created_at=created_at,
            )

    def _set_transaction_created_at(self, transaction_id: int, created_at: str) -> None:
        with self.store._connect() as connection:
            connection.execute(
                "UPDATE transactions SET created_at = ? WHERE id = ?",
                (created_at, int(transaction_id)),
            )

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
        expected_remaining_days = (
            datetime.strptime(refreshed["next_expiry_date"], "%Y-%m-%d").date() - datetime.now().date()
        ).days
        self.assertEqual(refreshed["estimated_remaining_days"], expected_remaining_days)
        self.assertEqual(refreshed["expiry_basis"], "lot_expiry")

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

    def test_ut_db_10a_ordered_purchase_without_supplier_is_repairable(self) -> None:
        product = self.store.create_product(
            name="Phiếu ordered thiếu NCC",
            category="Đông lạnh",
            unit="gói",
            low_stock_threshold=1,
        )
        now = "2026-04-19T10:30:00+07:00"
        with self.store._connect() as connection:
            self.store._replace_sync_collection_records(
                connection,
                "purchases",
                [
                    {
                        "id": "purchase-ordered-broken-01",
                        "supplierName": "",
                        "status": "ordered",
                        "note": "",
                        "createdAt": "2026-04-19T10:20:00+07:00",
                        "updatedAt": now,
                        "items": [
                            {
                                "id": "purchase-item-ordered-broken-01",
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

        sync_state = self.store.get_sync_state()
        purchase = next(entry for entry in sync_state["purchases"] if entry["id"] == "purchase-ordered-broken-01")
        self.assertTrue(purchase["repairableInvalid"])

        result = self.store.repair_purchase_document(
            "purchase-ordered-broken-01",
            action="delete",
            actor="masteradmin",
        )
        self.assertEqual(result["purchases"], [])

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
        extra_product = self.store.create_product(
            name="Phiếu nhập ordered flow thêm dòng",
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
        editable_ordered_purchase["items"].append(
            {
                "id": "purchase-item-ordered-flow-02",
                "productId": extra_product["id"],
                "productName": extra_product["name"],
                "quantity": 2,
                "unitCost": 22000,
            }
        )

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
        self.assertEqual(len(purchase["items"]), 2)
        self.assertEqual(purchase["items"][1]["productId"], extra_product["id"])

    def test_ut_db_12_repair_purchase_document_allows_regular_draft_delete_and_ordered_cancel_but_rejects_ordered_delete(self) -> None:
        product = self.store.create_product(
            name="Phiếu nhập cancel/delete chuẩn",
            category="Đồ khô",
            unit="gói",
            low_stock_threshold=1,
        )
        initial_state = self.store.get_sync_state()
        self.store.save_sync_state(
            {
                "purchases": [
                    {
                        "id": "purchase-draft-regular-01",
                        "supplierName": "NCC draft regular",
                        "status": "draft",
                        "note": "Phiếu nháp có thể xóa",
                        "createdAt": "2026-05-01T08:00:00+07:00",
                        "updatedAt": "2026-05-01T08:00:00+07:00",
                        "receiptCode": "",
                        "items": [
                            {
                                "id": "purchase-item-draft-regular-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 1,
                                "unitCost": 15000,
                            }
                        ],
                    },
                    {
                        "id": "purchase-ordered-regular-01",
                        "supplierName": "NCC ordered regular",
                        "status": "ordered",
                        "note": "Phiếu đã đặt chỉ được hủy",
                        "createdAt": "2026-05-01T09:00:00+07:00",
                        "updatedAt": "2026-05-01T09:00:00+07:00",
                        "receiptCode": "",
                        "items": [
                            {
                                "id": "purchase-item-ordered-regular-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 2,
                                "unitCost": 16000,
                            }
                        ],
                    },
                ],
                "expected_updated_at": {"purchases": initial_state["updated_at"]["purchases"]},
            }
        )

        with self.assertRaisesRegex(
            ValueError,
            "Chỉ được xóa/hủy phiếu nhập nháp, hủy phiếu đã đặt, hoặc xử lý phiếu lỗi chưa có nhập kho thật.",
        ):
            self.store.repair_purchase_document("purchase-ordered-regular-01", action="delete")

        delete_result = self.store.repair_purchase_document(
            "purchase-draft-regular-01",
            action="delete",
            actor="tester",
        )
        self.assertIn("Đã xóa phiếu nháp.", delete_result["message"])

        state_after_delete = self.store.get_sync_state()
        self.assertFalse(
            any(
                purchase["id"] == "purchase-draft-regular-01"
                for purchase in state_after_delete["purchases"]
            )
        )

        cancel_result = self.store.repair_purchase_document(
            "purchase-ordered-regular-01",
            action="cancel",
            actor="tester",
        )
        self.assertIn("Đã hủy phiếu đã đặt.", cancel_result["message"])

        final_state = self.store.get_sync_state()
        ordered_purchase = next(
            entry
            for entry in final_state["purchases"]
            if entry["id"] == "purchase-ordered-regular-01"
        )
        self.assertEqual(ordered_purchase["status"], "cancelled")
        self.assertEqual(ordered_purchase["items"][0]["quantity"], 2.0)

    def test_ut_db_13_legacy_audit_reports_safe_and_manual_issues(self) -> None:
        product = self.store.create_product(
            name="Legacy audit tổng hợp",
            category="Đông lạnh",
            unit="gói",
            low_stock_threshold=1,
        )
        receipt = self.store.create_purchase_receipt(
            supplier_name="NCC Legacy Audit",
            items=[{"product_id": product["id"], "quantity": 2, "unit_cost": 15000}],
            note="Receipt để backfill timestamp",
        )
        sync_state = self.store.get_sync_state()
        self.store.save_sync_state(
            {
                "carts": [
                    {
                        "id": "cart-legacy-paid-01",
                        "customerId": "customer-legacy-01",
                        "customerName": "Khách legacy",
                        "status": "completed",
                        "paymentStatus": "paid",
                        "createdAt": "2026-05-01T08:00:00+07:00",
                        "updatedAt": "2026-05-01T09:00:00+07:00",
                        "completedAt": "2026-05-01T08:45:00+07:00",
                        "paidAt": "",
                        "orderCode": "DH-LEGACY-01",
                        "items": [
                            {
                                "id": "cart-item-legacy-paid-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 1,
                                "unitPrice": 25000,
                                "note": "",
                            }
                        ],
                    }
                ],
                "expected_updated_at": {"carts": sync_state["updated_at"]["carts"]},
            }
        )
        now = "2026-05-01T10:00:00+07:00"
        with self.store._connect() as connection:
            self.store._replace_sync_collection_records(
                connection,
                "purchases",
                [
                    {
                        "id": "purchase-legacy-audit-ordered",
                        "supplierName": "",
                        "status": "ordered",
                        "note": "",
                        "createdAt": now,
                        "updatedAt": now,
                        "items": [
                            {
                                "id": "purchase-item-legacy-audit-ordered",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 3,
                                "unitCost": 16000,
                            }
                        ],
                    },
                    {
                        "id": "purchase-legacy-audit-received",
                        "supplierName": "NCC Legacy Audit",
                        "status": "received",
                        "note": "",
                        "createdAt": now,
                        "updatedAt": now,
                        "receivedAt": "",
                        "receiptCode": receipt["receipt_code"],
                        "items": [
                            {
                                "id": "purchase-item-legacy-audit-received",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 2,
                                "unitCost": 15000,
                            }
                        ],
                    },
                    {
                        "id": "purchase-legacy-audit-source",
                        "supplierName": "NCC Legacy Audit",
                        "status": "paid",
                        "note": "",
                        "sourceType": "cart",
                        "sourceCode": "",
                        "sourceName": "Khách legacy",
                        "createdAt": now,
                        "updatedAt": now,
                        "receivedAt": now,
                        "paidAt": now,
                        "receiptCode": receipt["receipt_code"],
                        "items": [
                            {
                                "id": "purchase-item-legacy-audit-source",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 2,
                                "unitCost": 15000,
                            }
                        ],
                    },
                ],
            )
            canonical = self.store._load_sync_collection_from_tables(connection, "purchases")
            connection.execute(
                "UPDATE app_state SET state_value = ?, updated_at = ? WHERE state_key = ?",
                (json.dumps(canonical, ensure_ascii=False), now, "purchases"),
            )

        audit = self.store.get_legacy_data_audit()
        self.assertEqual(audit["summary"]["safe_cart_paid_at_backfills"], 1)
        self.assertEqual(audit["summary"]["safe_purchase_timestamp_backfills"], 1)
        self.assertEqual(audit["summary"]["manual_repairable_purchases"], 1)
        self.assertEqual(audit["summary"]["manual_purchase_source_links"], 1)

    def test_ut_db_14_apply_safe_legacy_fixes_backfills_cart_paid_at_and_purchase_received_at(self) -> None:
        product = self.store.create_product(
            name="Apply safe fix legacy",
            category="Đông lạnh",
            unit="gói",
            low_stock_threshold=1,
        )
        receipt = self.store.create_purchase_receipt(
            supplier_name="NCC Safe Fix",
            items=[{"product_id": product["id"], "quantity": 4, "unit_cost": 18000}],
            note="Receipt hợp lệ để backfill",
        )
        sync_state = self.store.get_sync_state()
        self.store.save_sync_state(
            {
                "carts": [
                    {
                        "id": "cart-safe-fix-01",
                        "customerId": "customer-safe-fix-01",
                        "customerName": "Khách safe fix",
                        "status": "completed",
                        "paymentStatus": "paid",
                        "createdAt": "2026-05-02T08:00:00+07:00",
                        "updatedAt": "2026-05-02T09:00:00+07:00",
                        "completedAt": "2026-05-02T08:35:00+07:00",
                        "paidAt": "",
                        "orderCode": "DH-SAFE-FIX-01",
                        "items": [
                            {
                                "id": "cart-item-safe-fix-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 1,
                                "unitPrice": 24000,
                                "note": "",
                            }
                        ],
                    }
                ],
                "expected_updated_at": {"carts": sync_state["updated_at"]["carts"]},
            }
        )
        now = "2026-05-02T10:00:00+07:00"
        with self.store._connect() as connection:
            self.store._replace_sync_collection_records(
                connection,
                "purchases",
                [
                    {
                        "id": "purchase-safe-fix-01",
                        "supplierName": "NCC Safe Fix",
                        "status": "received",
                        "note": "",
                        "createdAt": now,
                        "updatedAt": now,
                        "receivedAt": "",
                        "receiptCode": receipt["receipt_code"],
                        "items": [
                            {
                                "id": "purchase-item-safe-fix-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 4,
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

        result = self.store.apply_safe_legacy_fixes(actor="masteradmin")
        self.assertEqual(result["counts"]["cart_paid_at_backfills"], 1)
        self.assertEqual(result["counts"]["purchase_timestamp_backfills"], 1)
        self.assertEqual(result["audit"]["summary"]["safe_fix_total"], 0)

        with self.store._connect() as connection:
            cart_row = connection.execute(
                "SELECT paid_at FROM carts WHERE id = ?",
                ("cart-safe-fix-01",),
            ).fetchone()
            purchase_row = connection.execute(
                "SELECT received_at FROM purchases WHERE id = ?",
                ("purchase-safe-fix-01",),
            ).fetchone()
        self.assertTrue(str(cart_row["paid_at"] or "").strip())
        self.assertTrue(str(purchase_row["received_at"] or "").strip())

    def test_ut_db_16_attach_purchase_receipt_code_repairs_invalid_paid_purchase(self) -> None:
        product = self.store.create_product(
            name="Attach receipt legacy",
            category="Đông lạnh",
            unit="gói",
            low_stock_threshold=1,
        )
        receipt = self.store.create_purchase_receipt(
            supplier_name="NCC Attach Receipt",
            items=[{"product_id": product["id"], "quantity": 2, "unit_cost": 19000}],
            note="Receipt chuẩn để gắn lại",
        )
        now = "2026-05-03T10:00:00+07:00"
        with self.store._connect() as connection:
            self.store._replace_sync_collection_records(
                connection,
                "purchases",
                [
                    {
                        "id": "purchase-attach-receipt-01",
                        "supplierName": "NCC Attach Receipt",
                        "status": "paid",
                        "note": "",
                        "createdAt": now,
                        "updatedAt": now,
                        "receivedAt": now,
                        "paidAt": now,
                        "receiptCode": "",
                        "items": [
                            {
                                "id": "purchase-item-attach-receipt-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 2,
                                "unitCost": 19000,
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

        result = self.store.attach_purchase_receipt_code(
            "purchase-attach-receipt-01",
            receipt["receipt_code"],
            actor="masteradmin",
        )
        self.assertEqual(result["purchase"]["receiptCode"], receipt["receipt_code"])
        self.assertEqual(result["audit"]["summary"]["manual_repairable_purchases"], 0)

    def test_ut_db_17_attach_purchase_source_cart_repairs_missing_source_code(self) -> None:
        product = self.store.create_product(
            name="Attach source legacy",
            category="Đông lạnh",
            unit="gói",
            low_stock_threshold=1,
        )
        sync_state = self.store.get_sync_state()
        self.store.save_sync_state(
            {
                "carts": [
                    {
                        "id": "cart-source-link-01",
                        "customerId": "customer-source-link-01",
                        "customerName": "Khách nguồn legacy",
                        "status": "completed",
                        "paymentStatus": "unpaid",
                        "createdAt": "2026-05-04T08:00:00+07:00",
                        "updatedAt": "2026-05-04T09:00:00+07:00",
                        "completedAt": "2026-05-04T08:45:00+07:00",
                        "orderCode": "DH-SOURCE-LINK-01",
                        "items": [
                            {
                                "id": "cart-item-source-link-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 1,
                                "unitPrice": 22000,
                                "note": "",
                            }
                        ],
                    }
                ],
                "expected_updated_at": {"carts": sync_state["updated_at"]["carts"]},
            }
        )
        now = "2026-05-04T10:00:00+07:00"
        with self.store._connect() as connection:
            self.store._replace_sync_collection_records(
                connection,
                "purchases",
                [
                    {
                        "id": "purchase-source-link-01",
                        "supplierName": "NCC Source Link",
                        "status": "draft",
                        "note": "",
                        "sourceType": "cart",
                        "sourceCode": "",
                        "sourceName": "Khách nguồn legacy",
                        "createdAt": now,
                        "updatedAt": now,
                        "receiptCode": "",
                        "items": [
                            {
                                "id": "purchase-item-source-link-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 2,
                                "unitCost": 17000,
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

        result = self.store.attach_purchase_source_cart(
            "purchase-source-link-01",
            "cart-source-link-01",
            actor="masteradmin",
        )
        self.assertEqual(result["purchase"]["sourceCode"], "cart-source-link-01")
        self.assertEqual(result["purchase"]["sourceName"], "Khách nguồn legacy")
        self.assertEqual(result["audit"]["summary"]["manual_purchase_source_links"], 0)

    def test_ut_db_15_purchase_requires_supplier_before_ordered_or_received(self) -> None:
        product = self.store.create_product(
            name="Phiếu nhập thiếu NCC",
            category="Đồ khô",
            unit="gói",
            low_stock_threshold=1,
        )
        now = "2026-04-19T12:15:00+07:00"
        draft_purchase = {
            "id": "purchase-missing-supplier-01",
            "supplierName": "",
            "note": "Phiếu chưa chọn NCC",
            "status": "draft",
            "createdAt": now,
            "updatedAt": now,
            "receiptCode": "",
            "items": [
                {
                    "id": "purchase-item-missing-supplier-01",
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
        ordered_payload = copy.deepcopy(draft_state["purchases"])
        ordered_payload[0]["status"] = "ordered"
        with self.assertRaisesRegex(ValueError, "nhà cung cấp trước khi chuyển sang đã đặt hàng"):
            self.store.save_sync_state(
                {
                    "purchases": ordered_payload,
                    "expected_updated_at": {"purchases": draft_state["updated_at"]["purchases"]},
                }
            )

        received_payload = copy.deepcopy(draft_state["purchases"])
        received_payload[0]["status"] = "received"
        received_payload[0]["receivedAt"] = now
        received_payload[0]["receiptCode"] = "PN-NO-SUPPLIER-01"
        with self.assertRaisesRegex(ValueError, "nhà cung cấp trước khi nhập kho"):
            self.store.save_sync_state(
                {
                    "purchases": received_payload,
                    "expected_updated_at": {"purchases": draft_state["updated_at"]["purchases"]},
                }
            )

    def test_ut_db_16_purchase_receipt_auto_calculates_expiry_from_received_date_or_manufacture_date(self) -> None:
        product = self.store.create_product(
            name="Mọc chay tự tính HSD",
            category="Đông lạnh",
            unit="gói",
            price=12000,
            sale_price=18000,
            low_stock_threshold=1,
            storage_life_days=20,
        )

        receipt = self.store.create_purchase_receipt(
            supplier_name="NCC Auto HSD",
            items=[
                {
                    "id": "purchase-item-auto-fallback-01",
                    "product_id": product["id"],
                    "quantity": 2,
                    "unit_cost": 12000,
                    "batch_code": "LO-FALLBACK",
                    "expiry_input_mode": "direct",
                    "expiry_date": "",
                },
                {
                    "id": "purchase-item-manufacture-01",
                    "product_id": product["id"],
                    "quantity": 1,
                    "unit_cost": 12000,
                    "batch_code": "LO-NSX",
                    "expiry_input_mode": "manufacture",
                    "manufacture_date": "2026-04-01",
                },
            ],
            note="UT-DB-16",
        )

        expected_fallback_expiry = (
            datetime.fromisoformat(receipt["created_at"].replace("Z", "+00:00")).date() + timedelta(days=20)
        ).isoformat()

        self.assertEqual(receipt["transactions"][0]["batch_code"], "LO-FALLBACK")
        self.assertEqual(receipt["transactions"][0]["expiry_input_mode"], "received_fallback")
        self.assertEqual(receipt["transactions"][0]["expiry_date"], expected_fallback_expiry)
        self.assertEqual(receipt["transactions"][1]["batch_code"], "LO-NSX")
        self.assertEqual(receipt["transactions"][1]["expiry_input_mode"], "manufacture")
        self.assertEqual(receipt["transactions"][1]["manufacture_date"], "2026-04-01")
        self.assertEqual(receipt["transactions"][1]["expiry_date"], "2026-04-21")

        with self.store._connect() as connection:
            receipt_rows = connection.execute(
                """
                SELECT purchase_item_id, batch_code, expiry_date
                FROM inventory_receipt_items
                WHERE purchase_item_id IN (?, ?)
                ORDER BY id
                """,
                ("purchase-item-auto-fallback-01", "purchase-item-manufacture-01"),
            ).fetchall()
        self.assertEqual(
            [
                (row["purchase_item_id"], row["batch_code"], row["expiry_date"])
                for row in receipt_rows
            ],
            [
                ("purchase-item-auto-fallback-01", "LO-FALLBACK", expected_fallback_expiry),
                ("purchase-item-manufacture-01", "LO-NSX", "2026-04-21"),
            ],
        )

    def test_ut_db_17_received_purchase_expiry_update_syncs_purchase_items_batches_and_receipt_items(self) -> None:
        product = self.store.create_product(
            name="Chả lá lốt cập nhật HSD",
            category="Đông lạnh",
            unit="gói",
            price=15000,
            sale_price=22000,
            low_stock_threshold=1,
            storage_life_days=15,
        )
        initial_state = self.store.get_sync_state()
        self.store.save_sync_state(
            {
                "purchases": [
                    {
                        "id": "purchase-received-expiry-01",
                        "supplierName": "NCC Received",
                        "note": "Phiếu test cập nhật HSD sau nhập kho",
                        "status": "ordered",
                        "createdAt": "2026-04-19T08:00:00+07:00",
                        "updatedAt": "2026-04-19T08:00:00+07:00",
                        "receiptCode": "",
                        "items": [
                            {
                                "id": "purchase-item-received-expiry-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 2,
                                "unitCost": 15000,
                                "batchCode": "LO-OLD",
                                "expiryInputMode": "direct",
                                "expiryDate": "",
                            }
                        ],
                    }
                ],
                "expected_updated_at": {"purchases": initial_state["updated_at"]["purchases"]},
            }
        )

        receipt = self.store.create_purchase_receipt(
            supplier_name="NCC Received",
            note="Phiếu test cập nhật HSD sau nhập kho",
            items=[
                {
                    "id": "purchase-item-received-expiry-01",
                    "product_id": product["id"],
                    "quantity": 2,
                    "unit_cost": 15000,
                    "batch_code": "LO-OLD",
                    "expiry_input_mode": "direct",
                    "expiry_date": "",
                }
            ],
        )

        ordered_state = self.store.get_sync_state()
        received_payload = copy.deepcopy(ordered_state["purchases"])
        received_payload[0]["status"] = "received"
        received_payload[0]["receiptCode"] = receipt["receipt_code"]
        received_payload[0]["receivedAt"] = receipt["created_at"]
        self.store.save_sync_state(
            {
                "purchases": received_payload,
                "expected_updated_at": {"purchases": ordered_state["updated_at"]["purchases"]},
            }
        )

        received_state = self.store.get_sync_state()
        received_purchase = received_state["purchases"][0]
        received_item = received_purchase["items"][0]
        self.assertEqual(received_item["expiryInputMode"], "received_fallback")

        update_result = self.store.update_received_purchase_item_expiry(
            received_purchase["id"],
            "purchase-item-received-expiry-01",
            expiry_input_mode="manufacture",
            manufacture_date="2026-04-10",
            expected_updated_at=received_purchase["updatedAt"],
            actor="tester",
        )

        updated_item = update_result["item"]
        self.assertIsNotNone(updated_item)
        self.assertEqual(updated_item["expiryInputMode"], "manufacture")
        self.assertEqual(updated_item["manufactureDate"], "2026-04-10")
        self.assertEqual(updated_item["expiryDate"], "2026-04-25")

        with self.store._connect() as connection:
            batch_row = connection.execute(
                """
                SELECT expiry_date
                FROM inventory_batches
                WHERE source_receipt_code = ? AND batch_code = ?
                """,
                (receipt["receipt_code"], "LO-OLD"),
            ).fetchone()
            receipt_item_row = connection.execute(
                """
                SELECT purchase_item_id, expiry_date
                FROM inventory_receipt_items
                WHERE receipt_id = (
                    SELECT id FROM inventory_receipts WHERE receipt_code = ?
                )
                """,
                (receipt["receipt_code"],),
            ).fetchone()
            transaction_row = connection.execute(
                """
                SELECT note
                FROM transactions
                WHERE note LIKE ?
                ORDER BY id DESC
                LIMIT 1
                """,
                (f"%{receipt['receipt_code']}%",),
            ).fetchone()

        self.assertEqual(batch_row["expiry_date"], "2026-04-25")
        self.assertEqual(receipt_item_row["purchase_item_id"], "purchase-item-received-expiry-01")
        self.assertEqual(receipt_item_row["expiry_date"], "2026-04-25")
        self.assertIn("HSD 2026-04-25", transaction_row["note"])

    def test_ut_db_13_checkout_order_consumes_real_expiry_lots_in_fefo_order(self) -> None:
        product = self.store.create_product(
            name="Há cảo chay lô HSD",
            category="Đông lạnh",
            unit="gói",
            price=10000,
            sale_price=15000,
            low_stock_threshold=2,
            shelf_life_days=60,
        )
        self.store.create_purchase_receipt(
            supplier_name="NCC FEFO",
            items=[
                {
                    "product_id": product["id"],
                    "quantity": 3,
                    "unit_cost": 10000,
                    "batch_code": "LO-MUON",
                    "expiry_date": "2026-06-30",
                },
                {
                    "product_id": product["id"],
                    "quantity": 2,
                    "unit_cost": 12000,
                    "batch_code": "LO-SOM",
                    "expiry_date": "2026-05-20",
                },
            ],
        )

        order = self.store.create_checkout_order(
            customer_name="Khách FEFO",
            items=[{"product_id": product["id"], "quantity": 4, "unit_price": 15000}],
        )

        transaction = order["transactions"][0]
        refreshed = self.store.get_product_by_id(product["id"])

        self.assertEqual(
            [allocation["batch_code"] for allocation in transaction["lot_allocations"]],
            ["LO-SOM", "LO-MUON"],
        )
        self.assertEqual(
            [allocation["quantity"] for allocation in transaction["lot_allocations"]],
            [2.0, 2.0],
        )
        self.assertEqual(transaction["unit_cost"], 11000.0)
        self.assertEqual(refreshed["current_stock"], 1.0)
        self.assertEqual(refreshed["expiry_basis"], "lot_expiry")
        self.assertEqual(refreshed["next_expiry_date"], "2026-06-30")
        self.assertEqual(refreshed["lot_count"], 1)

    def test_ut_db_14_supplier_return_can_target_a_specific_batch(self) -> None:
        product = self.store.create_product(
            name="Chả giò chay trả lô",
            category="Đông lạnh",
            unit="gói",
            price=10000,
            sale_price=14000,
            low_stock_threshold=2,
        )
        self.store.create_purchase_receipt(
            supplier_name="NCC Batch",
            items=[
                {
                    "product_id": product["id"],
                    "quantity": 4,
                    "unit_cost": 10000,
                    "batch_code": "LO-FEFO",
                    "expiry_date": "2026-05-15",
                },
                {
                    "product_id": product["id"],
                    "quantity": 3,
                    "unit_cost": 10000,
                    "batch_code": "LO-KEEP",
                    "expiry_date": "2026-05-30",
                },
            ],
        )

        receipt = self.store.create_supplier_return_receipt(
            supplier_name="NCC Batch",
            items=[
                {
                    "product_id": product["id"],
                    "quantity": 2,
                    "unit_cost": 10000,
                    "batch_code": "LO-KEEP",
                }
            ],
            note="Trả đúng lô chỉ định",
        )

        transaction = receipt["transactions"][0]
        refreshed = self.store.get_product_by_id(product["id"])
        lots_by_code = {
            lot["batch_code"]: lot["remaining_quantity"]
            for lot in refreshed["lots"]
        }

        self.assertEqual(
            [allocation["batch_code"] for allocation in transaction["lot_allocations"]],
            ["LO-KEEP"],
        )
        self.assertEqual(
            [allocation["quantity"] for allocation in transaction["lot_allocations"]],
            [2.0],
        )
        self.assertEqual(refreshed["current_stock"], 5.0)
        self.assertEqual(lots_by_code["LO-FEFO"], 4.0)
        self.assertEqual(lots_by_code["LO-KEEP"], 1.0)

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

    def test_ut_cancel_01_completed_order_cancellation_request_approval_restores_stock_and_nets_report(self) -> None:
        product = self.store.create_product(
            name="Hủy đơn xuất",
            category="Đông lạnh",
            unit="gói",
            price=12000,
            sale_price=18000,
            low_stock_threshold=1,
        )
        self.store.create_quick_purchase(
            supplier_name="NCC hủy đơn xuất",
            document_date=datetime.now().date().isoformat(),
            items=[{"product_id": product["id"], "quantity": 5, "unit_cost": 12000}],
            final_status="received",
            actor_username="receiver",
        )
        sale_result = self.store.create_quick_sale(
            customer_name="Khách hủy đơn xuất",
            document_date=datetime.now().date().isoformat(),
            items=[{"product_id": product["id"], "quantity": 3, "unit_price": 18000}],
            final_status="completed",
            mark_paid=True,
            actor_username="seller",
        )

        request_doc = self.store.create_document_cancel_request(
            document_type="order",
            document_id=sale_result["cart"]["id"],
            reason="Nhập nhầm phiếu xuất cuối ngày",
            actor="staff",
        )
        result = self.store.approve_document_cancel_request(
            request_doc["request_id"],
            actor="bizmanager",
        )

        final_cart = next(
            cart for cart in self.store.get_sync_state()["carts"]
            if cart["id"] == sale_result["cart"]["id"]
        )
        self.assertEqual(request_doc["status"], "pending_approval")
        self.assertEqual(result["request"]["status"], "processed")
        self.assertEqual(final_cart["status"], "cancelled")
        self.assertEqual(final_cart["paymentStatus"], "unpaid")
        self.assertEqual(self.store.get_product_by_id(product["id"])["current_stock"], 5.0)

        report = self.store.get_monthly_report(
            months=3,
            focus_month=datetime.now().strftime("%Y-%m"),
        )
        focus = report["focus_summary"]
        product_activity = next(entry for entry in report["product_activity"] if entry["product_id"] == product["id"])
        self.assertEqual(focus["revenue_value"], 0.0)
        self.assertEqual(focus["cogs_value"], 0.0)
        self.assertEqual(focus["sale_cancellation_quantity"], 3.0)
        self.assertEqual(product_activity["sale_cancellation_quantity"], 3.0)

        history = self.store.get_receipt_history(limit=20)
        cancellation_entry = next(
            entry for entry in history
            if entry["source_type"] == "sale_cancellation" and entry["source_code"] == sale_result["cart"]["orderCode"]
        )
        self.assertEqual(cancellation_entry["receipt_type"], "inventory_adjustment")
        cart_history_notes = " ".join(entry["note"] for entry in self.store.get_cart_change_history(final_cart["id"], limit=10))
        self.assertIn("Tạo yêu cầu hủy", cart_history_notes)
        self.assertIn("Duyệt hủy chứng từ", cart_history_notes)

    def test_ut_cancel_02_received_purchase_cancellation_request_approval_reduces_stock_and_nets_report(self) -> None:
        product = self.store.create_product(
            name="Hủy phiếu nhập",
            category="Đông lạnh",
            unit="gói",
            price=15000,
            sale_price=22000,
            low_stock_threshold=1,
        )
        purchase_result = self.store.create_quick_purchase(
            supplier_name="NCC hủy nhập",
            document_date=datetime.now().date().isoformat(),
            items=[{"product_id": product["id"], "quantity": 4, "unit_cost": 15500}],
            final_status="received",
            mark_paid=True,
            actor_username="buyer",
        )

        request_doc = self.store.create_document_cancel_request(
            document_type="purchase",
            document_id=purchase_result["purchase"]["id"],
            reason="Nhập nhầm phiếu mua cuối ngày",
            actor="staff",
        )
        result = self.store.approve_document_cancel_request(
            request_doc["request_id"],
            actor="bizmanager",
        )

        final_purchase = next(
            purchase for purchase in self.store.get_sync_state()["purchases"]
            if purchase["id"] == purchase_result["purchase"]["id"]
        )
        self.assertEqual(result["request"]["status"], "processed")
        self.assertEqual(final_purchase["status"], "cancelled")
        self.assertIsNone(final_purchase["paidAt"])
        self.assertEqual(self.store.get_product_by_id(product["id"])["current_stock"], 0.0)

        report = self.store.get_monthly_report(
            months=3,
            focus_month=datetime.now().strftime("%Y-%m"),
        )
        focus = report["focus_summary"]
        product_activity = next(entry for entry in report["product_activity"] if entry["product_id"] == product["id"])
        self.assertEqual(focus["purchase_value"], 0.0)
        self.assertEqual(focus["purchase_cancellation_quantity"], 4.0)
        self.assertEqual(product_activity["purchase_cancellation_quantity"], 4.0)

        history = self.store.get_receipt_history(limit=20)
        cancellation_entry = next(
            entry for entry in history
            if entry["source_type"] == "purchase_cancellation" and entry["source_code"] == purchase_result["purchase"]["receiptCode"]
        )
        self.assertEqual(cancellation_entry["receipt_type"], "inventory_adjustment")

    def test_ut_cancel_03_purchase_cancellation_rejects_when_original_stock_was_partially_used(self) -> None:
        product = self.store.create_product(
            name="Hủy phiếu nhập đã dùng một phần",
            category="Đông lạnh",
            unit="gói",
            price=10000,
            sale_price=16000,
            low_stock_threshold=1,
        )
        purchase_result = self.store.create_quick_purchase(
            supplier_name="NCC dùng một phần",
            document_date=datetime.now().date().isoformat(),
            items=[{"product_id": product["id"], "quantity": 5, "unit_cost": 10500}],
            final_status="received",
            actor_username="buyer",
        )
        self.store.create_quick_sale(
            customer_name="Khách lấy mất hàng",
            document_date=datetime.now().date().isoformat(),
            items=[{"product_id": product["id"], "quantity": 1, "unit_price": 16000}],
            final_status="completed",
            actor_username="seller",
        )

        with self.assertRaisesRegex(ValueError, "đã bị sử dụng một phần"):
            self.store.create_document_cancel_request(
                document_type="purchase",
                document_id=purchase_result["purchase"]["id"],
                reason="Muốn hủy nhưng hàng đã dùng mất một phần",
                actor="staff",
            )

    def test_ut_cancel_04_reject_document_cancel_request_keeps_original_document_unchanged(self) -> None:
        product = self.store.create_product(
            name="Từ chối yêu cầu hủy",
            category="Đông lạnh",
            unit="gói",
            price=9000,
            sale_price=14000,
            low_stock_threshold=1,
        )
        self.store.create_quick_purchase(
            supplier_name="NCC từ chối",
            document_date=datetime.now().date().isoformat(),
            items=[{"product_id": product["id"], "quantity": 3, "unit_cost": 9000}],
            final_status="received",
            actor_username="buyer",
        )
        sale_result = self.store.create_quick_sale(
            customer_name="Khách từ chối",
            document_date=datetime.now().date().isoformat(),
            items=[{"product_id": product["id"], "quantity": 2, "unit_price": 14000}],
            final_status="completed",
            actor_username="seller",
        )
        request_doc = self.store.create_document_cancel_request(
            document_type="order",
            document_id=sale_result["cart"]["id"],
            reason="Nghi nhầm nhưng chưa đủ bằng chứng",
            actor="staff",
        )

        rejected = self.store.reject_document_cancel_request(
            request_doc["request_id"],
            actor="bizmanager",
            reason="Chưa xác minh được phiếu gốc.",
        )
        final_cart = next(
            cart for cart in self.store.get_sync_state()["carts"]
            if cart["id"] == sale_result["cart"]["id"]
        )
        self.assertEqual(rejected["status"], "rejected")
        self.assertEqual(final_cart["status"], "completed")
        self.assertEqual(self.store.get_product_by_id(product["id"])["current_stock"], 1.0)

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

    def test_ut_aud_04_product_master_import_logs_actor_for_restore_and_update(self) -> None:
        product = self.store.create_product(
            name="Chả cốm chay",
            category="Đông lạnh",
            unit="gói",
            price=18000,
            sale_price=22000,
            low_stock_threshold=2,
            actor="seed-user",
        )
        self.store.delete_product(product["id"], actor="seed-user")

        result = self.store.import_master_data(
            "products",
            [
                {
                    "name": "Chả cốm chay",
                    "category": "Đông lạnh cao cấp",
                    "unit": "gói",
                    "price": 20000,
                    "sale_price": 26000,
                    "low_stock_threshold": 4,
                }
            ],
            actor="admin-csv",
        )

        self.assertEqual(result["restored"], 1)
        self.assertEqual(result["updated"], 1)

        with self.store._connect() as connection:
            rows = connection.execute(
                """
                SELECT action, actor, message
                FROM audit_logs
                WHERE entity_type = 'product'
                  AND entity_id = ?
                  AND action IN ('restore', 'update')
                ORDER BY id DESC
                """,
                (str(product["id"]),),
            ).fetchall()

        logs = {row["action"]: row for row in rows}
        self.assertEqual(logs["restore"]["actor"], "admin-csv")
        self.assertEqual(logs["update"]["actor"], "admin-csv")
        self.assertIn("Loại thực phẩm", logs["update"]["message"])
        self.assertIn("Giá nhập", logs["update"]["message"])

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

    def test_ut_sync_02b_save_sync_state_ignores_conflict_if_disabled(self) -> None:
        self.store.enable_multiuser_conflict_check = False
        self.store.save_sync_state({"carts": [{"id": "cart-a", "status": "draft", "items": []}]})

        # Sẽ không ném lỗi SyncConflictError mà ghi đè thành công
        self.store.save_sync_state(
            {
                "carts": [{"id": "cart-b", "status": "draft", "items": []}],
                "expected_updated_at": {"carts": "stale-version"},
            }
        )
        state = self.store.get_sync_state()
        self.assertEqual(len(state["carts"]), 1)
        self.assertEqual(state["carts"][0]["id"], "cart-b")

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
                        "note": "Ghi chú trước thanh toán",
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
        editable_carts[0]["note"] = "Da xuat, cho sua ghi chu"
        editable_purchases[0]["discountAmount"] = 4000
        editable_purchases[0]["note"] = "Da nhap kho, cho sua ghi chu"
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
        self.assertEqual(updated_state["carts"][0]["note"], "Da xuat, cho sua ghi chu")
        self.assertEqual(updated_state["purchases"][0]["discountAmount"], 4000.0)
        self.assertEqual(updated_state["purchases"][0]["note"], "Da nhap kho, cho sua ghi chu")

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

        final_note_carts = copy.deepcopy(locked_state["carts"])
        final_note_carts[0]["note"] = "Khong duoc sua sau thanh toan"

        with self.assertRaisesRegex(ValueError, "không thể sửa ghi chú"):
            self.store.save_sync_state(
                {
                    "carts": final_note_carts,
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

        final_note_purchases = copy.deepcopy(locked_state["purchases"])
        final_note_purchases[0]["note"] = "Khong duoc sua sau thanh toan"

        with self.assertRaisesRegex(ValueError, "Phiếu nhập đã thanh toán không thể sửa trực tiếp"):
            self.store.save_sync_state(
                {
                    "purchases": final_note_purchases,
                    "expected_updated_at": {"purchases": locked_state["updated_at"]["purchases"]},
                }
            )

    def test_ut_sync_04_cart_workflow_supports_draft_cancel_and_completed_paid_locks(self) -> None:
        product = self.store.create_product(
            name="Đơn hàng workflow trạng thái",
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
                        "id": "cart-status-draft-01",
                        "customerName": "Khách draft trạng thái",
                        "status": "draft",
                        "paymentStatus": "unpaid",
                        "createdAt": "2026-05-06T08:00:00+07:00",
                        "updatedAt": "2026-05-06T08:00:00+07:00",
                        "orderCode": "",
                        "items": [
                            {
                                "id": "cart-item-status-draft-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 1,
                                "unitPrice": 15000,
                                "note": "",
                            }
                        ],
                    },
                    {
                        "id": "cart-status-completed-01",
                        "customerName": "Khách completed trạng thái",
                        "status": "completed",
                        "paymentStatus": "unpaid",
                        "createdAt": "2026-05-06T08:10:00+07:00",
                        "updatedAt": "2026-05-06T08:20:00+07:00",
                        "completedAt": "2026-05-06T08:20:00+07:00",
                        "orderCode": "DH-STATUS-01",
                        "items": [
                            {
                                "id": "cart-item-status-completed-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 2,
                                "unitPrice": 15000,
                                "note": "",
                            }
                        ],
                    },
                ],
                "expected_updated_at": {"carts": initial_state["updated_at"]["carts"]},
            }
        )

        seeded_state = self.store.get_sync_state()
        invalid_paid_payload = copy.deepcopy(seeded_state["carts"])
        invalid_draft_cart = next(
            cart for cart in invalid_paid_payload if cart["id"] == "cart-status-draft-01"
        )
        invalid_draft_cart["paymentStatus"] = "paid"
        invalid_draft_cart["paidAt"] = "2026-05-06T08:30:00+07:00"

        with self.assertRaisesRegex(ValueError, "Đơn hàng chỉ được đánh dấu đã thanh toán sau khi đã xuất hàng."):
            self.store.save_sync_state(
                {
                    "carts": invalid_paid_payload,
                    "expected_updated_at": {"carts": seeded_state["updated_at"]["carts"]},
                }
            )

        cancel_payload = copy.deepcopy(seeded_state["carts"])
        cancelled_draft_cart = next(
            cart for cart in cancel_payload if cart["id"] == "cart-status-draft-01"
        )
        cancelled_draft_cart["status"] = "cancelled"
        cancelled_draft_cart["cancelledAt"] = "2026-05-06T08:31:00+07:00"
        self.store.save_sync_state(
            {
                "carts": cancel_payload,
                "expected_updated_at": {"carts": seeded_state["updated_at"]["carts"]},
            }
        )

        cancelled_state = self.store.get_sync_state()
        cancelled_cart = next(
            cart for cart in cancelled_state["carts"] if cart["id"] == "cart-status-draft-01"
        )
        self.assertEqual(cancelled_cart["status"], "cancelled")

        reopen_payload = copy.deepcopy(cancelled_state["carts"])
        reopened_cart = next(
            cart for cart in reopen_payload if cart["id"] == "cart-status-draft-01"
        )
        reopened_cart["status"] = "draft"

        with self.assertRaisesRegex(ValueError, "Giỏ hàng đã hủy không thể mở lại hoặc sửa trực tiếp."):
            self.store.save_sync_state(
                {
                    "carts": reopen_payload,
                    "expected_updated_at": {"carts": cancelled_state["updated_at"]["carts"]},
                }
            )

        pay_payload = copy.deepcopy(cancelled_state["carts"])
        paid_completed_cart = next(
            cart for cart in pay_payload if cart["id"] == "cart-status-completed-01"
        )
        paid_completed_cart["paymentStatus"] = "paid"
        paid_completed_cart["paidAt"] = "2026-05-06T08:35:00+07:00"
        paid_state = self.store.save_sync_state(
            {
                "carts": pay_payload,
                "expected_updated_at": {"carts": cancelled_state["updated_at"]["carts"]},
            }
        )

        persisted_paid_cart = next(
            cart for cart in paid_state["carts"] if cart["id"] == "cart-status-completed-01"
        )
        self.assertEqual(persisted_paid_cart["paymentStatus"], "paid")

        revert_paid_payload = copy.deepcopy(paid_state["carts"])
        reverted_paid_cart = next(
            cart for cart in revert_paid_payload if cart["id"] == "cart-status-completed-01"
        )
        reverted_paid_cart["paymentStatus"] = "unpaid"

        with self.assertRaisesRegex(ValueError, "Đơn hàng đã thanh toán không thể sửa ngược trạng thái."):
            self.store.save_sync_state(
                {
                    "carts": revert_paid_payload,
                    "expected_updated_at": {"carts": paid_state["updated_at"]["carts"]},
                }
            )

    def test_ut_sync_05_committed_cart_locks_customer_but_allows_ship_address_until_completed(self) -> None:
        product = self.store.create_product(
            name="Đơn committed khóa khách",
            category="Đông lạnh",
            unit="gói",
            price=10000,
            sale_price=15000,
            low_stock_threshold=1,
        )
        extra_product = self.store.create_product(
            name="Đơn committed thêm dòng",
            category="Đông lạnh",
            unit="gói",
            price=12000,
            sale_price=18000,
            low_stock_threshold=1,
        )
        initial_state = self.store.get_sync_state()
        self.store.save_sync_state(
            {
                "carts": [
                    {
                        "id": "cart-status-committed-01",
                        "customerId": "customer-committed-01",
                        "customerName": "Khách committed",
                        "status": "committed",
                        "paymentStatus": "unpaid",
                        "shipAddress": "12 Nguyễn Trãi",
                        "createdAt": "2026-05-06T08:00:00+07:00",
                        "updatedAt": "2026-05-06T08:10:00+07:00",
                        "committedAt": "2026-05-06T08:10:00+07:00",
                        "orderCode": "DH-COMMITTED-01",
                        "items": [
                            {
                                "id": "cart-item-status-committed-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 1,
                                "unitPrice": 15000,
                            }
                        ],
                    }
                ],
                "expected_updated_at": {"carts": initial_state["updated_at"]["carts"]},
            }
        )

        seeded_state = self.store.get_sync_state()
        rename_payload = copy.deepcopy(seeded_state["carts"])
        rename_payload[0]["customerName"] = "Khách đổi tên"

        with self.assertRaisesRegex(ValueError, "Đơn đã chốt không thể đổi khách hàng."):
            self.store.save_sync_state(
                {
                    "carts": rename_payload,
                    "expected_updated_at": {"carts": seeded_state["updated_at"]["carts"]},
                }
            )

        address_payload = copy.deepcopy(seeded_state["carts"])
        address_payload[0]["shipAddress"] = "99 Lê Lợi"
        address_payload[0]["updatedAt"] = "2026-05-06T08:20:00+07:00"
        updated_state = self.store.save_sync_state(
            {
                "carts": address_payload,
                "expected_updated_at": {"carts": seeded_state["updated_at"]["carts"]},
            }
        )
        self.assertEqual(updated_state["carts"][0]["shipAddress"], "99 Lê Lợi")

        add_item_payload = copy.deepcopy(updated_state["carts"])
        add_item_payload[0]["updatedAt"] = "2026-05-06T08:25:00+07:00"
        add_item_payload[0]["items"].append(
            {
                "id": "cart-item-status-committed-02",
                "productId": extra_product["id"],
                "productName": extra_product["name"],
                "quantity": 2,
                "unitPrice": 18000,
            }
        )
        item_updated_state = self.store.save_sync_state(
            {
                "carts": add_item_payload,
                "expected_updated_at": {"carts": updated_state["updated_at"]["carts"]},
            }
        )
        self.assertEqual(len(item_updated_state["carts"][0]["items"]), 2)
        self.assertEqual(item_updated_state["carts"][0]["items"][1]["productId"], extra_product["id"])

        direct_complete_payload = copy.deepcopy(item_updated_state["carts"])
        direct_complete_payload[0]["status"] = "completed"
        direct_complete_payload[0]["completedAt"] = "2026-05-06T08:30:00+07:00"
        with self.assertRaisesRegex(ValueError, "Đơn đã chốt phải xuất hàng qua API xuất hàng."):
            self.store.save_sync_state(
                {
                    "carts": direct_complete_payload,
                    "expected_updated_at": {"carts": item_updated_state["updated_at"]["carts"]},
                }
            )

    def test_ut_sync_06_payment_updates_persist_payment_metadata_for_cart_and_purchase(self) -> None:
        product = self.store.create_product(
            name="SP thanh toán",
            category="Khô",
            unit="gói",
            price=12000,
            sale_price=18000,
            low_stock_threshold=1,
        )
        initial_state = self.store.get_sync_state()
        self.store.save_sync_state(
            {
                "carts": [
                    {
                        "id": "cart-payment-01",
                        "customerId": "customer-payment-01",
                        "customerName": "Khách thanh toán",
                        "status": "completed",
                        "paymentStatus": "unpaid",
                        "createdAt": "2026-05-06T08:00:00+07:00",
                        "updatedAt": "2026-05-06T08:30:00+07:00",
                        "completedAt": "2026-05-06T08:30:00+07:00",
                        "orderCode": "DH-PAY-01",
                        "items": [
                            {
                                "id": "cart-payment-item-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 2,
                                "unitPrice": 18000,
                            }
                        ],
                    }
                ],
                "purchases": [
                    {
                        "id": "purchase-payment-01",
                        "supplierId": "supplier-payment-01",
                        "supplierName": "NCC thanh toán",
                        "status": "received",
                        "note": "Phiếu chờ trả tiền",
                        "createdAt": "2026-05-06T07:00:00+07:00",
                        "updatedAt": "2026-05-06T09:00:00+07:00",
                        "orderedAt": "2026-05-06T07:30:00+07:00",
                        "receivedAt": "2026-05-06T09:00:00+07:00",
                        "receiptCode": "PN-PAY-01",
                        "items": [
                            {
                                "id": "purchase-payment-item-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 3,
                                "unitCost": 12000,
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

        paid_cart_result = self.store.update_cart_payment(
            "cart-payment-01",
            paid_at="2026-05-06",
            payment_method="bank_transfer",
            payment_note="Khách đã chuyển khoản",
            actor_username="cashier",
            actor_role="user",
        )
        self.assertEqual(paid_cart_result["cart"]["paymentStatus"], "paid")
        self.assertEqual(paid_cart_result["cart"]["paidAt"], "2026-05-06")
        self.assertEqual(paid_cart_result["cart"]["paymentMethod"], "bank_transfer")
        self.assertEqual(paid_cart_result["cart"]["paymentNote"], "Khách đã chuyển khoản")

        paid_purchase_result = self.store.update_purchase_payment(
            "purchase-payment-01",
            paid_at="2026-05-07",
            payment_method="cash",
            payment_note="Đã trả tiền mặt cho NCC",
            actor_username="cashier",
            actor_role="user",
        )
        self.assertEqual(paid_purchase_result["purchase"]["status"], "paid")
        self.assertEqual(paid_purchase_result["purchase"]["paidAt"], "2026-05-07")
        self.assertEqual(paid_purchase_result["purchase"]["paymentMethod"], "cash")
        self.assertEqual(paid_purchase_result["purchase"]["paymentNote"], "Đã trả tiền mặt cho NCC")

        final_state = self.store.get_sync_state()
        persisted_cart = next(
            cart for cart in final_state["carts"] if cart["id"] == "cart-payment-01"
        )
        persisted_purchase = next(
            purchase for purchase in final_state["purchases"] if purchase["id"] == "purchase-payment-01"
        )
        self.assertEqual(persisted_cart["paymentStatus"], "paid")
        self.assertEqual(persisted_cart["paymentMethod"], "bank_transfer")
        self.assertEqual(persisted_cart["paymentNote"], "Khách đã chuyển khoản")
        self.assertEqual(persisted_purchase["status"], "paid")
        self.assertEqual(persisted_purchase["paymentMethod"], "cash")
        self.assertEqual(persisted_purchase["paymentNote"], "Đã trả tiền mặt cho NCC")

    def test_ut_ord_15_commit_and_ship_cart_order_follow_new_workflow(self) -> None:
        product = self.store.create_product(
            name="Đơn commit rồi ship",
            category="Đông lạnh",
            unit="gói",
            price=10000,
            sale_price=15000,
            low_stock_threshold=1,
        )
        self.store.create_transaction(product["id"], "in", 5, "Tồn đầu để test commit/ship")
        initial_state = self.store.get_sync_state()
        self.store.save_sync_state(
            {
                "carts": [
                    {
                        "id": "cart-commit-ship-01",
                        "customerId": "customer-commit-ship-01",
                        "customerName": "Khách commit ship",
                        "status": "draft",
                        "paymentStatus": "unpaid",
                        "note": "Giao sau 18h",
                        "shipAddress": "1 Trần Hưng Đạo",
                        "createdAt": "2026-05-06T08:00:00+07:00",
                        "updatedAt": "2026-05-06T08:00:00+07:00",
                        "items": [
                            {
                                "id": "cart-item-commit-ship-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 2,
                                "unitPrice": 15000,
                            }
                        ],
                    }
                ],
                "expected_updated_at": {"carts": initial_state["updated_at"]["carts"]},
            }
        )

        committed = self.store.commit_cart_order("cart-commit-ship-01", actor="tester")
        self.assertEqual(committed["cart"]["status"], "committed")
        self.assertTrue(committed["order_code"].startswith("DH-"))
        self.assertTrue(committed["committed_at"])
        self.assertEqual(self.store.get_product_by_id(product["id"])["current_stock"], 5.0)

        shipped = self.store.ship_cart_order("cart-commit-ship-01", actor="tester")
        self.assertEqual(shipped["cart"]["status"], "completed")
        self.assertTrue(shipped["cart"]["completedAt"])
        with self.store._connect() as connection:
            transaction_row = connection.execute(
                """
                SELECT note
                FROM transactions
                WHERE note LIKE ?
                ORDER BY id DESC
                LIMIT 1
                """,
                (f"%{committed['order_code']}%",),
            ).fetchone()
        self.assertIsNotNone(transaction_row)
        self.assertIn("Giao sau 18h", transaction_row["note"])
        self.assertEqual(self.store.get_product_by_id(product["id"])["current_stock"], 3.0)

    def test_ut_ord_16_commit_can_use_ordered_purchase_coverage_without_double_reserve(self) -> None:
        product = self.store.create_product(
            name="Đơn chờ phiếu đã đặt",
            category="Đông lạnh",
            unit="gói",
            price=10000,
            sale_price=15000,
            low_stock_threshold=1,
        )
        initial_state = self.store.get_sync_state()
        timestamp = "2026-05-06T09:00:00+07:00"
        self.store.save_sync_state(
            {
                "purchases": [
                    {
                        "id": "purchase-ordered-cover-01",
                        "receiptCode": "PN-ORDER-COVER-01",
                        "supplierName": "NCC đã đặt",
                        "status": "ordered",
                        "createdAt": timestamp,
                        "updatedAt": timestamp,
                        "items": [
                            {
                                "id": "purchase-item-ordered-cover-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "unit": product["unit"],
                                "quantity": 5,
                                "unitCost": 10000,
                            }
                        ],
                    }
                ],
                "carts": [
                    {
                        "id": "cart-ordered-cover-01",
                        "customerId": "customer-ordered-cover-01",
                        "customerName": "Khách được cover",
                        "status": "draft",
                        "paymentStatus": "unpaid",
                        "createdAt": timestamp,
                        "updatedAt": timestamp,
                        "items": [
                            {
                                "id": "cart-item-ordered-cover-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 4,
                                "unitPrice": 15000,
                            }
                        ],
                    },
                    {
                        "id": "cart-ordered-cover-02",
                        "customerId": "customer-ordered-cover-02",
                        "customerName": "Khách vượt cover",
                        "status": "draft",
                        "paymentStatus": "unpaid",
                        "createdAt": timestamp,
                        "updatedAt": timestamp,
                        "items": [
                            {
                                "id": "cart-item-ordered-cover-02",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 2,
                                "unitPrice": 15000,
                            }
                        ],
                    },
                ],
                "expected_updated_at": {
                    "purchases": initial_state["updated_at"]["purchases"],
                    "carts": initial_state["updated_at"]["carts"],
                },
            }
        )

        committed = self.store.commit_cart_order("cart-ordered-cover-01", actor="tester")
        self.assertEqual(committed["cart"]["status"], "committed")
        self.assertEqual(self.store.get_product_by_id(product["id"])["current_stock"], 0.0)

        with self.assertRaisesRegex(ValueError, "Không đủ hàng để chốt đơn"):
            self.store.commit_cart_order("cart-ordered-cover-02", actor="tester")

    def test_ut_quick_01_create_quick_purchase_ordered_does_not_increase_stock(self) -> None:
        product = self.store.create_product(
            name="Nhập nhanh đã đặt",
            category="Đông lạnh",
            unit="gói",
            price=12000,
            sale_price=18000,
            low_stock_threshold=1,
        )

        result = self.store.create_quick_purchase(
            supplier_name="NCC Nhập nhanh",
            document_date="2026-05-20",
            items=[{"product_id": product["id"], "quantity": 3, "unit_cost": 12500}],
            final_status="ordered",
            actor_username="tester",
        )

        self.assertEqual(result["purchase"]["status"], "ordered")
        self.assertEqual(result["purchase"]["createdMode"], "quick_import")
        self.assertEqual(self.store.get_product_by_id(product["id"])["current_stock"], 0.0)
        with self.store._connect() as connection:
            transaction_count = connection.execute(
                "SELECT COUNT(*) AS count FROM transactions WHERE product_id = ?",
                (product["id"],),
            ).fetchone()["count"]
        self.assertEqual(transaction_count, 0)

    def test_ut_quick_02_create_quick_purchase_paid_records_stock_and_history(self) -> None:
        product = self.store.create_product(
            name="Nhập nhanh đã trả",
            category="Đông lạnh",
            unit="gói",
            price=15000,
            sale_price=22000,
            low_stock_threshold=1,
        )

        result = self.store.create_quick_purchase(
            supplier_name="NCC Quick Paid",
            document_date="2026-05-21",
            note="Ghi cuối ngày",
            items=[{"product_id": product["id"], "quantity": 4, "unit_cost": 15500}],
            final_status="received",
            mark_paid=True,
            actor_username="tester",
            actor_role="user",
        )

        purchase = result["purchase"]
        self.assertEqual(purchase["status"], "paid")
        self.assertEqual(purchase["createdMode"], "quick_import")
        self.assertEqual(result["summary"]["payment_status"], "paid")
        self.assertTrue(purchase["receiptCode"])
        self.assertEqual(self.store.get_product_by_id(product["id"])["current_stock"], 4.0)
        history = self.store.get_purchase_change_history(purchase["id"], limit=10)
        history_notes = " ".join(entry["note"] for entry in history)
        self.assertIn("Tạo bằng Xử lý nhanh nhập hàng", history_notes)
        self.assertIn("Nhập hàng hoàn tất", history_notes)
        self.assertIn("Thanh toán phiếu nhập đã hoàn tất", history_notes)
        with self.store._connect() as connection:
            transaction_row = connection.execute(
                """
                SELECT note
                FROM transactions
                WHERE note LIKE ?
                ORDER BY id DESC
                LIMIT 1
                """,
                (f"%{purchase['receiptCode']}%",),
            ).fetchone()
        self.assertIsNotNone(transaction_row)
        self.assertIn("Tạo bằng Xử lý nhanh nhập hàng", transaction_row["note"])

    def test_ut_quick_03_create_quick_sale_committed_does_not_decrease_stock(self) -> None:
        product = self.store.create_product(
            name="Xuất nhanh chốt đơn",
            category="Đông lạnh",
            unit="gói",
            price=11000,
            sale_price=17000,
            low_stock_threshold=1,
        )
        self.store.create_transaction(product["id"], "in", 5, "Tồn đầu quick sale committed")

        result = self.store.create_quick_sale(
            customer_name="Khách quick committed",
            document_date="2026-05-22",
            items=[{"product_id": product["id"], "quantity": 2, "unit_price": 17000}],
            final_status="committed",
            actor_username="tester",
        )

        self.assertEqual(result["cart"]["status"], "committed")
        self.assertEqual(result["cart"]["createdMode"], "quick_export")
        self.assertEqual(self.store.get_product_by_id(product["id"])["current_stock"], 5.0)

    def test_ut_quick_04_create_quick_sale_paid_records_stock_and_history(self) -> None:
        product = self.store.create_product(
            name="Xuất nhanh đã thu",
            category="Đông lạnh",
            unit="gói",
            price=13000,
            sale_price=19000,
            low_stock_threshold=1,
        )
        self.store.create_transaction(product["id"], "in", 6, "Tồn đầu quick sale paid")

        result = self.store.create_quick_sale(
            customer_name="Khách quick paid",
            document_date="2026-05-23",
            note="Khách lấy cuối ngày",
            items=[{"product_id": product["id"], "quantity": 3, "unit_price": 19000}],
            final_status="completed",
            mark_paid=True,
            actor_username="tester",
        )

        cart = result["cart"]
        self.assertEqual(cart["status"], "completed")
        self.assertEqual(cart["paymentStatus"], "paid")
        self.assertEqual(cart["createdMode"], "quick_export")
        self.assertEqual(result["summary"]["payment_status"], "paid")
        self.assertEqual(self.store.get_product_by_id(product["id"])["current_stock"], 3.0)
        history = self.store.get_cart_change_history(cart["id"], limit=10)
        history_notes = " ".join(entry["note"] for entry in history)
        self.assertIn("Tạo bằng Xử lý nhanh xuất hàng", history_notes)
        self.assertIn("Xuất hàng hoàn tất", history_notes)
        with self.store._connect() as connection:
            transaction_row = connection.execute(
                """
                SELECT note
                FROM transactions
                WHERE note LIKE ?
                ORDER BY id DESC
                LIMIT 1
                """,
                (f"%{cart['orderCode']}%",),
            ).fetchone()
        self.assertIsNotNone(transaction_row)
        self.assertIn("Tạo bằng Xử lý nhanh xuất hàng", transaction_row["note"])

    def test_ut_quick_05_quick_documents_validate_required_party_and_stock(self) -> None:
        product = self.store.create_product(
            name="Quick validate",
            category="Đông lạnh",
            unit="gói",
            price=10000,
            sale_price=16000,
            low_stock_threshold=1,
        )
        self.store.create_transaction(product["id"], "in", 1, "Tồn đầu quick validate")

        with self.assertRaisesRegex(ValueError, "Khách hàng là bắt buộc"):
            self.store.create_quick_sale(
                customer_name="",
                items=[{"product_id": product["id"], "quantity": 1, "unit_price": 16000}],
            )
        with self.assertRaisesRegex(ValueError, "Nhà cung cấp là bắt buộc"):
            self.store.create_quick_purchase(
                supplier_name="",
                items=[{"product_id": product["id"], "quantity": 1, "unit_cost": 10000}],
            )
        with self.assertRaisesRegex(ValueError, "Thiếu"):
            self.store.create_quick_sale(
                customer_name="Khách quá tồn",
                items=[{"product_id": product["id"], "quantity": 2, "unit_price": 16000}],
                final_status="completed",
            )

    def test_ut_ord_17_bulk_create_orders_commit_valid_is_partial_and_idempotent(self) -> None:
        ok_product = self.store.create_product(
            name="Chả quế bulk",
            category="Đông lạnh",
            unit="gói",
            price=40000,
            sale_price=55000,
            low_stock_threshold=1,
        )
        shortage_product = self.store.create_product(
            name="Đậu hũ non bulk",
            category="Đồ tươi",
            unit="hộp",
            price=10000,
            sale_price=14000,
            low_stock_threshold=1,
        )
        self.store.create_transaction(ok_product["id"], "in", 8, "Tồn đầu test bulk")
        self.store.create_transaction(shortage_product["id"], "in", 6, "Tồn đầu test bulk thiếu")

        result = self.store.bulk_create_orders(
            mode="commit_valid",
            request_id="bulk-request-001",
            actor="tester",
            orders=[
                {
                    "client_order_id": "bulk-order-1",
                    "customer_name": "Khách bulk hợp lệ",
                    "ship_address": "1 Nguyễn Trãi",
                    "items": [
                        {
                            "product_id": ok_product["id"],
                            "quantity": 2,
                            "unit_price": 55000,
                        }
                    ],
                },
                {
                    "client_order_id": "bulk-order-2",
                    "customer_name": "Khách bulk thiếu hàng",
                    "ship_address": "2 Trần Phú",
                    "items": [
                        {
                            "product_id": shortage_product["id"],
                            "quantity": 10,
                            "unit_price": 14000,
                        }
                    ],
                },
            ],
        )

        self.assertEqual(result["summary"], {"total_orders": 2, "success": 1, "failed": 1})
        result_by_id = {entry["client_order_id"]: entry for entry in result["results"]}
        success_entry = result_by_id["bulk-order-1"]
        failed_entry = result_by_id["bulk-order-2"]

        self.assertEqual(success_entry["status"], "success")
        self.assertEqual(success_entry["order_status"], "committed")
        self.assertTrue(success_entry["order_code"].startswith("DH-"))
        self.assertFalse(success_entry["saved_as_draft"])

        self.assertEqual(failed_entry["status"], "failed")
        self.assertEqual(failed_entry["order_status"], "draft")
        self.assertTrue(failed_entry["saved_as_draft"])
        self.assertTrue(failed_entry["cart_id"])
        self.assertIn("Thiếu Đậu hũ non bulk: cần 10, còn 6", failed_entry["message"])
        self.assertEqual(failed_entry["errors"][0]["product_name"], "Đậu hũ non bulk")

        carts = self.store.get_sync_state()["carts"]
        committed_cart = next(cart for cart in carts if cart["id"] == success_entry["cart_id"])
        failed_cart = next(cart for cart in carts if cart["id"] == failed_entry["cart_id"])
        self.assertEqual(committed_cart["status"], "committed")
        self.assertEqual(failed_cart["status"], "draft")
        self.assertEqual(self.store.get_product_by_id(ok_product["id"])["current_stock"], 8.0)
        self.assertEqual(self.store.get_product_by_id(shortage_product["id"])["current_stock"], 6.0)

        replay = self.store.bulk_create_orders(
            mode="commit_valid",
            request_id="bulk-request-001",
            actor="tester",
            orders=[
                {
                    "client_order_id": "bulk-order-1",
                    "customer_name": "Khách bulk hợp lệ",
                    "items": [{"product_id": ok_product["id"], "quantity": 2, "unit_price": 55000}],
                }
            ],
        )
        self.assertTrue(replay["idempotent_replay"])
        self.assertEqual(replay["summary"], result["summary"])
        self.assertEqual(len(self.store.get_sync_state()["carts"]), 2)

        with self.store._connect() as connection:
            batch_row = connection.execute(
                """
                SELECT total_orders, success_count, failed_count
                FROM bulk_order_batches
                WHERE request_id = ?
                """,
                ("bulk-request-001",),
            ).fetchone()
            audit_row = connection.execute(
                """
                SELECT actor, message
                FROM audit_logs
                WHERE entity_type = 'bulk_order_batch'
                ORDER BY id DESC
                LIMIT 1
                """
            ).fetchone()

        self.assertIsNotNone(batch_row)
        self.assertEqual(batch_row["total_orders"], 2)
        self.assertEqual(batch_row["success_count"], 1)
        self.assertEqual(batch_row["failed_count"], 1)
        self.assertIsNotNone(audit_row)
        self.assertEqual(audit_row["actor"], "tester")
        self.assertIn("Tổng 2 đơn, thành công 1, lỗi 1.", audit_row["message"])

    def test_ut_ord_21_bulk_editing_saved_draft_or_committed_updates_same_cart(self) -> None:
        product = self.store.create_product(
            name="Mì căn bulk chỉnh tiếp",
            category="Đông lạnh",
            unit="gói",
            price=38000,
            sale_price=52000,
            low_stock_threshold=1,
        )
        self.store.create_transaction(product["id"], "in", 20, "Tồn đầu test bulk edit")

        created_draft = self.store.bulk_create_orders(
            mode="draft",
            request_id="bulk-edit-001",
            actor="tester",
            orders=[
                {
                    "client_order_id": "bulk-edit-order-1",
                    "customer_name": "Khách sửa bulk",
                    "ship_address": "1 Nguyễn Tri Phương",
                    "discount_amount": 1000,
                    "items": [
                        {
                            "product_id": product["id"],
                            "quantity": 2,
                            "unit_price": 52000,
                        }
                    ],
                }
            ],
        )
        created_entry = created_draft["results"][0]
        cart_id = created_entry["cart_id"]
        self.assertTrue(cart_id)
        self.assertEqual(created_entry["order_status"], "draft")
        self.assertTrue(created_entry["saved_as_draft"])

        updated_draft = self.store.bulk_create_orders(
            mode="draft",
            request_id="bulk-edit-002",
            actor="tester",
            orders=[
                {
                    "client_order_id": "bulk-edit-order-1",
                    "cart_id": cart_id,
                    "customer_name": "Khách sửa bulk",
                    "ship_address": "2 Lý Thường Kiệt",
                    "discount_amount": 5000,
                    "items": [
                        {
                            "product_id": product["id"],
                            "quantity": 3,
                            "unit_price": 56000,
                        }
                    ],
                }
            ],
        )
        updated_draft_entry = updated_draft["results"][0]
        self.assertEqual(updated_draft_entry["cart_id"], cart_id)
        self.assertEqual(updated_draft_entry["order_status"], "draft")
        self.assertTrue(updated_draft_entry["saved_as_draft"])
        self.assertIn("cập nhật đơn nháp", updated_draft_entry["message"].lower())

        committed = self.store.bulk_create_orders(
            mode="commit_valid",
            request_id="bulk-edit-003",
            actor="tester",
            orders=[
                {
                    "client_order_id": "bulk-edit-order-1",
                    "cart_id": cart_id,
                    "customer_name": "Khách sửa bulk",
                    "ship_address": "2 Lý Thường Kiệt",
                    "discount_amount": 5000,
                    "items": [
                        {
                            "product_id": product["id"],
                            "quantity": 3,
                            "unit_price": 56000,
                        }
                    ],
                }
            ],
        )
        committed_entry = committed["results"][0]
        self.assertEqual(committed_entry["cart_id"], cart_id)
        self.assertEqual(committed_entry["order_status"], "committed")
        self.assertFalse(committed_entry["saved_as_draft"])
        self.assertIn("Đã chốt đơn.", committed_entry["message"])
        self.assertTrue(committed_entry["order_code"])

        updated_committed = self.store.bulk_create_orders(
            mode="draft",
            request_id="bulk-edit-004",
            actor="tester",
            orders=[
                {
                    "client_order_id": "bulk-edit-order-1",
                    "cart_id": cart_id,
                    "customer_name": "Khách sửa bulk",
                    "ship_address": "3 Hai Bà Trưng",
                    "discount_amount": 7000,
                    "items": [
                        {
                            "product_id": product["id"],
                            "quantity": 4,
                            "unit_price": 57000,
                        }
                    ],
                }
            ],
        )
        updated_committed_entry = updated_committed["results"][0]
        self.assertEqual(updated_committed_entry["cart_id"], cart_id)
        self.assertEqual(updated_committed_entry["order_status"], "committed")
        self.assertFalse(updated_committed_entry["saved_as_draft"])
        self.assertEqual(updated_committed_entry["order_code"], committed_entry["order_code"])
        self.assertIn("cập nhật đơn đã chốt", updated_committed_entry["message"].lower())

        carts = [cart for cart in self.store.get_sync_state()["carts"] if cart["customerName"] == "Khách sửa bulk"]
        self.assertEqual(len(carts), 1)
        final_cart = carts[0]
        self.assertEqual(final_cart["id"], cart_id)
        self.assertEqual(final_cart["status"], "committed")
        self.assertEqual(final_cart["shipAddress"], "3 Hai Bà Trưng")
        self.assertEqual(float(final_cart["discountAmount"]), 7000.0)
        self.assertEqual(float(final_cart["items"][0]["quantity"]), 4.0)
        self.assertEqual(float(final_cart["items"][0]["unitPrice"]), 57000.0)
        self.assertEqual(self.store.get_product_by_id(product["id"])["current_stock"], 20.0)

    def test_ut_ord_18_bulk_order_request_lifecycle_blocks_duplicates_until_processed(self) -> None:
        product = self.store.create_product(
            name="Chả giò request bulk",
            category="Đông lạnh",
            unit="gói",
            price=20000,
            sale_price=30000,
            low_stock_threshold=1,
        )
        self.store.create_transaction(product["id"], "in", 5, "Tồn đầu request bulk")

        request_result = self.store.create_bulk_order_request(
            mode="commit_valid",
            request_id="bulk-request-approval-001",
            actor="staff",
            orders=[
                {
                    "client_order_id": "bulk-request-order-1",
                    "customer_name": "Khách request bulk",
                    "ship_address": "5 Lê Lợi",
                    "items": [
                        {
                            "product_id": product["id"],
                            "quantity": 2,
                            "unit_price": 30000,
                        }
                    ],
                }
            ],
        )
        self.assertTrue(request_result["approval_required"])
        self.assertEqual(request_result["request"]["status"], "pending_approval")
        self.assertEqual(request_result["summary"], {"total_orders": 1, "success": 1, "failed": 0})

        replay = self.store.create_bulk_order_request(
            mode="commit_valid",
            request_id="bulk-request-approval-001",
            actor="staff",
            orders=[
                {
                    "client_order_id": "bulk-request-order-1",
                    "customer_name": "Khách request bulk",
                    "items": [{"product_id": product["id"], "quantity": 2, "unit_price": 30000}],
                }
            ],
        )
        self.assertTrue(replay["idempotent_replay"])
        self.assertEqual(replay["request"]["status"], "pending_approval")

        with self.assertRaises(BulkOrderRequestDuplicateError):
            self.store.create_bulk_order_request(
                mode="commit_valid",
                request_id="bulk-request-approval-002",
                actor="staff",
                orders=[
                    {
                        "client_order_id": "bulk-request-order-2",
                        "customer_name": "Khách request bulk",
                        "ship_address": "5 Lê Lợi",
                        "items": [{"product_id": product["id"], "quantity": 2, "unit_price": 30000}],
                    }
                ],
            )

        approved = self.store.approve_bulk_order_request(
            "bulk-request-approval-001",
            actor="bizmanager",
        )
        self.assertEqual(approved["status"], "approved")
        self.assertEqual(approved["approved_by"], "bizmanager")

        with self.assertRaises(BulkOrderRequestDuplicateError):
            self.store.create_bulk_order_request(
                mode="commit_valid",
                request_id="bulk-request-approval-003",
                actor="staff",
                orders=[
                    {
                        "client_order_id": "bulk-request-order-3",
                        "customer_name": "Khách request bulk",
                        "ship_address": "5 Lê Lợi",
                        "items": [{"product_id": product["id"], "quantity": 2, "unit_price": 30000}],
                    }
                ],
            )

        processed = self.store.process_bulk_order_request(
            "bulk-request-approval-001",
            actor="staff",
        )
        self.assertEqual(processed["request"]["status"], "processed")
        self.assertEqual(processed["request"]["processed_by"], "staff")
        self.assertEqual(processed["process_result"]["summary"], {"total_orders": 1, "success": 1, "failed": 0})

        carts = self.store.get_sync_state()["carts"]
        committed_cart = next(cart for cart in carts if cart["id"] == processed["process_result"]["results"][0]["cart_id"])
        self.assertEqual(committed_cart["status"], "committed")
        self.assertEqual(self.store.get_product_by_id(product["id"])["current_stock"], 5.0)

    def test_ut_ord_19_entity_change_history_tracks_bulk_request_and_cart_edits(self) -> None:
        product = self.store.create_product(
            name="Mọc chay audit order",
            category="Đông lạnh",
            unit="gói",
            price=18000,
            sale_price=26000,
            low_stock_threshold=1,
        )
        self.store.create_transaction(product["id"], "in", 10, "Tồn đầu audit order")

        self.store.create_bulk_order_request(
            mode="commit_valid",
            request_id="bulk-history-001",
            actor="staff",
            orders=[
                {
                    "client_order_id": "bulk-history-order-1",
                    "customer_name": "Khách lịch sử đơn",
                    "ship_address": "10 Hai Bà Trưng",
                    "items": [{"product_id": product["id"], "quantity": 1, "unit_price": 26000}],
                }
            ],
        )
        self.store.approve_bulk_order_request("bulk-history-001", actor="bizmanager")
        processed = self.store.process_bulk_order_request("bulk-history-001", actor="staff")

        request_history = self.store.get_bulk_order_request_change_history("bulk-history-001", limit=10)
        request_actions = [entry["action"] for entry in request_history]
        self.assertIn("create-request", request_actions)
        self.assertIn("approve-request", request_actions)
        self.assertIn("process-request", request_actions)

        cart_id = processed["process_result"]["results"][0]["cart_id"]
        current_state = self.store.get_sync_state()
        carts = copy.deepcopy(current_state["carts"])
        target_cart = next(cart for cart in carts if cart["id"] == cart_id)
        target_cart["shipAddress"] = "11 Hai Bà Trưng"
        target_cart["items"][0]["quantity"] = 2
        target_cart["updatedAt"] = "2026-05-21T10:00:00+07:00"
        self.store.save_sync_state(
            {
                "carts": carts,
                "expected_updated_at": {"carts": current_state["updated_at"]["carts"]},
                "actor": "staff-edit",
            }
        )

        cart_history = self.store.get_cart_change_history(cart_id, limit=20)
        cart_actions = [entry["action"] for entry in cart_history]
        self.assertIn("create", cart_actions)
        self.assertIn("status-change", cart_actions)
        self.assertIn("edit-ship-address", cart_actions)
        self.assertIn("edit-items", cart_actions)

    def test_ut_ord_20_pending_bulk_order_request_can_be_deleted_and_recreated(self) -> None:
        product = self.store.create_product(
            name="Cá viên chay request delete",
            category="Đông lạnh",
            unit="gói",
            price=17000,
            sale_price=26000,
            low_stock_threshold=1,
        )
        self.store.create_transaction(product["id"], "in", 6, "Tồn đầu request delete")

        self.store.create_bulk_order_request(
            mode="commit_valid",
            request_id="bulk-request-delete-001",
            actor="staff",
            orders=[
                {
                    "client_order_id": "bulk-request-delete-order-1",
                    "customer_name": "Khách request delete",
                    "ship_address": "2 Pasteur",
                    "items": [{"product_id": product["id"], "quantity": 2, "unit_price": 26000}],
                }
            ],
        )
        deleted_request = self.store.delete_bulk_order_request(
            "bulk-request-delete-001",
            actor="staff",
            can_manage=False,
        )
        self.assertEqual(deleted_request["status"], "pending_approval")
        self.assertIsNone(self.store.get_bulk_order_request("bulk-request-delete-001"))

        recreated = self.store.create_bulk_order_request(
            mode="commit_valid",
            request_id="bulk-request-delete-002",
            actor="staff",
            orders=[
                {
                    "client_order_id": "bulk-request-delete-order-2",
                    "customer_name": "Khách request delete",
                    "ship_address": "2 Pasteur",
                    "items": [{"product_id": product["id"], "quantity": 2, "unit_price": 26000}],
                }
            ],
        )
        self.assertEqual(recreated["request"]["status"], "pending_approval")

        self.store.approve_bulk_order_request("bulk-request-delete-002", actor="bizmanager")
        with self.assertRaisesRegex(ValueError, "đang chờ duyệt"):
            self.store.delete_bulk_order_request(
                "bulk-request-delete-002",
                actor="staff",
                can_manage=False,
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
                "carts": [{"id": "cart-1", "orderCode": "DH-01", "status": "cancelled", "cancelledAt": "2026-05-06T09:00:00+07:00", "items": []}],
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
        self.assertIn("cancelled", log["message"])

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
                        "supplierName": "NCC Audit",
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
                        "supplierName": "NCC Audit",
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

    def test_ut_his_03_product_history_lists_changed_fields_for_inline_update(self) -> None:
        product = self.store.create_product(
            name="Bánh khúc",
            category="Đông lạnh",
            unit="gói",
            price=10000,
            sale_price=15000,
            low_stock_threshold=2,
            shelf_life_days=30,
            storage_life_days=45,
        )
        self.store.update_product(
            product["id"],
            name="Bánh khúc",
            category="Đặc sản đông lạnh",
            unit="hộp",
            price=12000,
            sale_price=18000,
            low_stock_threshold=4,
            shelf_life_days=60,
            storage_life_days=None,
            actor="user-detail",
        )

        log_entry = next(
            entry
            for entry in self.store.get_product_history(limit=20, actor="user-detail")
            if entry["product_id"] == product["id"] and entry["action"] == "update"
        )

        self.assertEqual(log_entry["actor"], "user-detail")
        self.assertNotIn("Tên sản phẩm", log_entry["message"])
        self.assertIn('Loại thực phẩm: "Đông lạnh" -> "Đặc sản đông lạnh"', log_entry["message"])
        self.assertIn('Đơn vị tính: "gói" -> "hộp"', log_entry["message"])
        self.assertIn("Giá nhập: 10000 -> 12000", log_entry["message"])
        self.assertIn("Giá bán: 15000 -> 18000", log_entry["message"])
        self.assertIn("Ngưỡng cảnh báo: 2 -> 4", log_entry["message"])
        self.assertIn("Hạn dùng (ngày): 30 -> 60", log_entry["message"])
        self.assertIn("Bảo quản (ngày): 45 -> (trống)", log_entry["message"])

    def test_ut_mov_01_product_movements_return_empty_summary_for_product_without_transactions(self) -> None:
        product = self.store.create_product(
            name="Há cảo chay mới",
            category="Đông lạnh",
            unit="gói",
            low_stock_threshold=2,
        )

        result = self.store.get_product_movements(
            product_id=product["id"],
            to_date=datetime.now().astimezone().date().isoformat(),
        )

        self.assertEqual(result["product"]["name"], "Há cảo chay mới")
        self.assertEqual(result["summary"]["opening_stock"], 0.0)
        self.assertEqual(result["summary"]["total_in"], 0.0)
        self.assertEqual(result["summary"]["total_out"], 0.0)
        self.assertEqual(result["summary"]["calculated_ending_stock"], 0.0)
        self.assertEqual(result["summary"]["current_stock"], 0.0)
        self.assertEqual(result["summary"]["difference"], 0.0)
        self.assertTrue(result["summary"]["is_match"])
        self.assertEqual(result["movements"], [])

    def test_ut_mov_02_product_movements_support_product_with_only_in_transactions(self) -> None:
        product = self.store.create_product(
            name="Há cảo chay nhập",
            category="Đông lạnh",
            unit="gói",
            low_stock_threshold=2,
        )
        self._create_purchase_receipt_at(
            supplier_name="NCC Hà Nội",
            items=[{"product_id": product["id"], "quantity": 12, "unit_cost": 22000}],
            created_at="2026-05-28T08:30:00+07:00",
            note="Nhập test only in",
        )

        result = self.store.get_product_movements(
            product_id=product["id"],
            from_date="2026-05-28",
            to_date=datetime.now().astimezone().date().isoformat(),
        )

        self.assertEqual(result["summary"]["opening_stock"], 0.0)
        self.assertEqual(result["summary"]["total_in"], 12.0)
        self.assertEqual(result["summary"]["total_out"], 0.0)
        self.assertEqual(result["summary"]["calculated_ending_stock"], 12.0)
        self.assertEqual(len(result["movements"]), 1)
        self.assertEqual(result["movements"][0]["movement_type"], "in")
        self.assertEqual(result["movements"][0]["balance_after"], 12.0)
        self.assertEqual(result["movements"][0]["document_type"], "purchase")
        self.assertEqual(result["movements"][0]["related_party_name"], "NCC Hà Nội")

    def test_ut_mov_03_product_movements_support_product_with_only_out_transactions(self) -> None:
        product = self.store.create_product(
            name="Há cảo chay xuất",
            category="Đông lạnh",
            unit="gói",
            low_stock_threshold=2,
        )
        opening_transaction = self.store.create_transaction(product["id"], "in", 9, "Tồn đầu test only out")
        self._set_transaction_created_at(opening_transaction["id"], "2026-05-20T08:00:00+07:00")
        order = self.store.create_checkout_order(
            customer_name="Khách xuất",
            items=[{"product_id": product["id"], "quantity": 4, "unit_price": 29000}],
            note="Xuất test only out",
        )
        self._set_transaction_created_at(order["transactions"][0]["id"], "2026-05-28T15:45:00+07:00")

        result = self.store.get_product_movements(
            product_id=product["id"],
            from_date="2026-05-28",
            to_date=datetime.now().astimezone().date().isoformat(),
        )

        self.assertEqual(result["summary"]["opening_stock"], 9.0)
        self.assertEqual(result["summary"]["total_in"], 0.0)
        self.assertEqual(result["summary"]["total_out"], 4.0)
        self.assertEqual(result["summary"]["calculated_ending_stock"], 5.0)
        self.assertEqual(len(result["movements"]), 1)
        self.assertEqual(result["movements"][0]["movement_type"], "out")
        self.assertEqual(result["movements"][0]["document_type"], "order")
        self.assertEqual(result["movements"][0]["document_code"], order["order_code"])
        self.assertEqual(result["movements"][0]["related_party_name"], "Khách xuất")

    def test_ut_mov_04_product_movements_compute_opening_totals_running_balance_and_document_links(self) -> None:
        product = self.store.create_product(
            name="Sản phẩm rà tồn",
            category="Đông lạnh",
            unit="gói",
            low_stock_threshold=2,
        )
        self._create_purchase_receipt_at(
            supplier_name="NCC A",
            items=[{"product_id": product["id"], "quantity": 100, "unit_cost": 18000}],
            created_at="2026-03-20T08:00:00+07:00",
            note="Nhập đầu kỳ",
        )
        first_order = self.store.create_checkout_order(
            customer_name="Khách A",
            items=[{"product_id": product["id"], "quantity": 70, "unit_price": 24000}],
            note="Xuất đầu kỳ",
        )
        self._set_transaction_created_at(first_order["transactions"][0]["id"], "2026-03-20T16:00:00+07:00")
        second_receipt = self._create_purchase_receipt_at(
            supplier_name="NCC B",
            items=[{"product_id": product["id"], "quantity": 5, "unit_cost": 19000}],
            created_at="2026-05-27T09:00:00+07:00",
            note="Nhập bù thiếu",
        )
        second_order = self.store.create_checkout_order(
            customer_name="Khách B",
            items=[{"product_id": product["id"], "quantity": 35, "unit_price": 25000}],
            note="Xuất bù thiếu",
        )
        self._set_transaction_created_at(second_order["transactions"][0]["id"], "2026-05-27T18:00:00+07:00")

        result = self.store.get_product_movements(
            product_id=product["id"],
            from_date="2026-05-20",
            to_date=datetime.now().astimezone().date().isoformat(),
        )

        self.assertEqual(result["summary"]["opening_stock"], 30.0)
        self.assertEqual(result["summary"]["total_in"], 5.0)
        self.assertEqual(result["summary"]["total_out"], 35.0)
        self.assertEqual(result["summary"]["calculated_ending_stock"], 0.0)
        self.assertEqual(result["summary"]["current_stock"], 0.0)
        self.assertEqual([entry["document_code"] for entry in result["movements"]], [
            second_receipt["receipt_code"],
            second_order["order_code"],
        ])
        self.assertEqual([entry["balance_after"] for entry in result["movements"]], [35.0, 0.0])
        self.assertEqual(result["movements"][0]["related_party_name"], "NCC B")
        self.assertEqual(result["movements"][1]["related_party_name"], "Khách B")

    def test_ut_mov_05_product_movements_warn_on_filtered_mismatch_and_skip_compare_for_past_date(self) -> None:
        product = self.store.create_product(
            name="Sản phẩm lọc lệch",
            category="Đông lạnh",
            unit="gói",
            low_stock_threshold=2,
        )
        self._create_purchase_receipt_at(
            supplier_name="NCC Lọc",
            items=[{"product_id": product["id"], "quantity": 10, "unit_cost": 15000}],
            created_at="2026-05-28T07:00:00+07:00",
            note="Nhập cho test cảnh báo",
        )
        order = self.store.create_checkout_order(
            customer_name="Khách lọc",
            items=[{"product_id": product["id"], "quantity": 4, "unit_price": 22000}],
            note="Xuất cho test cảnh báo",
        )
        self._set_transaction_created_at(order["transactions"][0]["id"], "2026-05-28T12:00:00+07:00")
        today = datetime.now().astimezone().date().isoformat()

        warning_result = self.store.get_product_movements(
            product_id=product["id"],
            to_date=today,
            movement_type="out",
        )
        self.assertEqual(warning_result["summary"]["opening_stock"], 0.0)
        self.assertEqual(warning_result["summary"]["total_in"], 0.0)
        self.assertEqual(warning_result["summary"]["total_out"], 4.0)
        self.assertEqual(warning_result["summary"]["calculated_ending_stock"], -4.0)
        self.assertEqual(warning_result["summary"]["current_stock"], 6.0)
        self.assertEqual(warning_result["summary"]["difference"], 10.0)
        self.assertFalse(warning_result["summary"]["is_match"])
        self.assertIn("Cảnh báo", warning_result["summary"]["status_message"])

        past_result = self.store.get_product_movements(
            product_id=product["id"],
            to_date="2026-05-28",
            movement_type="out",
        )
        self.assertFalse(past_result["period"]["compare_with_current_stock"])
        self.assertIsNone(past_result["summary"]["difference"])
        self.assertEqual(past_result["summary"]["status_message"], "")

    def test_ut_mov_06_product_movements_ignore_unaffected_drafts_and_validate_date_range(self) -> None:
        product = self.store.create_product(
            name="Sản phẩm draft không tính",
            category="Đông lạnh",
            unit="gói",
            low_stock_threshold=2,
        )
        sync_state = self.store.get_sync_state()
        self.store.save_sync_state(
            {
                "carts": [
                    {
                        "id": "cart-movement-draft-01",
                        "customerName": "Khách draft",
                        "status": "draft",
                        "createdAt": "2026-05-28T08:00:00+07:00",
                        "updatedAt": "2026-05-28T08:00:00+07:00",
                        "items": [
                            {
                                "id": "cart-movement-draft-item-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 5,
                                "unitPrice": 21000,
                            }
                        ],
                    }
                ],
                "purchases": [
                    {
                        "id": "purchase-movement-draft-01",
                        "supplierName": "NCC draft",
                        "status": "draft",
                        "createdAt": "2026-05-28T08:00:00+07:00",
                        "updatedAt": "2026-05-28T08:00:00+07:00",
                        "items": [
                            {
                                "id": "purchase-movement-draft-item-01",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 5,
                                "unitCost": 15000,
                            }
                        ],
                    }
                ],
                "expected_updated_at": {
                    "carts": sync_state["updated_at"]["carts"],
                    "purchases": sync_state["updated_at"]["purchases"],
                },
            }
        )

        result = self.store.get_product_movements(
            product_id=product["id"],
            to_date=datetime.now().astimezone().date().isoformat(),
        )
        self.assertEqual(result["movements"], [])
        self.assertEqual(result["summary"]["current_stock"], 0.0)

        with self.assertRaisesRegex(ValueError, "Từ ngày không được lớn hơn Đến ngày"):
            self.store.get_product_movements(
                product_id=product["id"],
                from_date="2026-05-29",
                to_date="2026-05-28",
            )

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

    def test_ut_proc_01_batch_lock_allows_single_owner(self) -> None:
        started = self.store.start_procurement_batch(
            username="bizmanager",
            role="user",
            lock_timeout_minutes=30,
        )
        self.assertEqual(started["mode"], "batch")
        self.assertEqual(started["lock"]["owner_username"], "bizmanager")

        with self.assertRaisesRegex(ValueError, "bizmanager"):
            self.store.start_procurement_batch(
                username="staff",
                role="user",
                lock_timeout_minutes=30,
            )

        finished = self.store.finish_procurement_batch(username="bizmanager", role="user")
        self.assertEqual(finished["mode"], "daily")
        self.assertIsNone(finished["lock"])

    def test_ut_proc_02_planner_assigns_one_product_to_one_batch_purchase(self) -> None:
        product = self.store.create_product(
            name="Mì căn batch",
            category="Đồ chay",
            unit="gói",
            price=12000,
            sale_price=18000,
            low_stock_threshold=2,
        )
        self.store.save_sync_state(
            {
                "suppliers": [
                    {"id": "supplier-batch", "name": "NCC batch"},
                    {"id": "supplier-batch-other", "name": "NCC khác"},
                ],
                "carts": [
                    {
                        "id": "cart-batch-1",
                        "customerName": "Khách batch",
                        "status": "draft",
                        "items": [
                            {
                                "id": "cart-item-batch-1",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 5,
                                "unitPrice": 18000,
                            }
                        ],
                    }
                ]
            }
        )
        self.store.start_procurement_batch(
            username="bizmanager",
            role="user",
            lock_timeout_minutes=30,
        )

        planner = self.store.get_procurement_planner(scope_type="all")
        target = next(row for row in planner["rows"] if row["product_id"] == product["id"])
        self.assertEqual(target["required_purchase"], 5.0)

        result = self.store.create_procurement_purchase_for_product(
            product_id=product["id"],
            quantity=target["required_purchase"],
            supplier_name="NCC batch",
            actor="bizmanager",
            role="user",
        )
        self.assertEqual(result["purchase"]["supplierName"], "NCC batch")
        assigned = next(row for row in result["planner"]["rows"] if row["product_id"] == product["id"])
        self.assertEqual(assigned["assignment"]["purchase_id"], result["purchase"]["id"])

        with self.assertRaisesRegex(ValueError, "đã được gán"):
            self.store.create_procurement_purchase_for_product(
                product_id=product["id"],
                quantity=1,
                supplier_name="NCC khác",
                actor="bizmanager",
                role="user",
            )

    def test_ut_proc_03_batch_create_groups_products_by_supplier(self) -> None:
        product_one = self.store.create_product(
            name="Chả batch 1",
            category="Đồ chay",
            unit="gói",
            price=10000,
            sale_price=15000,
            low_stock_threshold=0,
        )
        product_two = self.store.create_product(
            name="Chả batch 2",
            category="Đồ chay",
            unit="gói",
            price=12000,
            sale_price=17000,
            low_stock_threshold=0,
        )
        self.store.save_sync_state(
            {
                "suppliers": [{"id": "supplier-group-batch", "name": "NCC gom batch"}],
                "carts": [
                    {
                        "id": "cart-batch-group",
                        "customerName": "Khách batch group",
                        "status": "draft",
                        "items": [
                            {
                                "id": "cart-item-batch-group-1",
                                "productId": product_one["id"],
                                "productName": product_one["name"],
                                "quantity": 3,
                                "unitPrice": 15000,
                            },
                            {
                                "id": "cart-item-batch-group-2",
                                "productId": product_two["id"],
                                "productName": product_two["name"],
                                "quantity": 4,
                                "unitPrice": 17000,
                            },
                        ],
                    }
                ],
            }
        )
        self.store.start_procurement_batch(
            username="bizmanager",
            role="user",
            lock_timeout_minutes=30,
        )

        result = self.store.create_procurement_purchases(
            lines=[
                {"product_id": product_one["id"], "quantity": 3, "supplier_name": "NCC gom batch"},
                {"product_id": product_two["id"], "quantity": 4, "supplier_name": "NCC gom batch"},
            ],
            actor="bizmanager",
            role="user",
        )

        self.assertEqual(len(result["created_purchases"]), 1)
        purchase = result["created_purchases"][0]
        self.assertEqual(purchase["supplierName"], "NCC gom batch")
        self.assertEqual({item["productId"] for item in purchase["items"]}, {product_one["id"], product_two["id"]})
        assignments = {
            row["product_id"]: row["assignment"]["purchase_id"]
            for row in result["planner"]["rows"]
            if row.get("assignment")
        }
        self.assertEqual(assignments[product_one["id"]], purchase["id"])
        self.assertEqual(assignments[product_two["id"]], purchase["id"])

    def test_ut_proc_04_non_owner_cannot_edit_batch_purchase_draft_but_only_receives_prebatch_non_batch_purchase_and_pay(self) -> None:
        batch_product = self.store.create_product(
            name="Đậu hũ lock batch",
            category="Đồ chay",
            unit="gói",
            price=15000,
            sale_price=22000,
            low_stock_threshold=0,
        )
        prebatch_manual_product = self.store.create_product(
            name="Mì căn ordered trước batch",
            category="Đồ chay",
            unit="gói",
            price=18000,
            sale_price=26000,
            low_stock_threshold=0,
        )
        postbatch_manual_product = self.store.create_product(
            name="Nấm ordered sau batch",
            category="Đồ chay",
            unit="gói",
            price=17000,
            sale_price=25000,
            low_stock_threshold=0,
        )
        prebatch_created_at = "2026-05-16T06:30:00+00:00"
        prebatch_ordered_at = "2026-05-16T07:00:00+00:00"
        self.store.save_sync_state(
            {
                "suppliers": [{"id": "supplier-lock-batch", "name": "NCC lock batch"}],
                "purchases": [
                    {
                        "id": "purchase-manual-prebatch",
                        "supplierName": "NCC lock batch",
                        "status": "draft",
                        "sourceType": "manual",
                        "createdAt": prebatch_created_at,
                        "updatedAt": prebatch_created_at,
                        "items": [
                            {
                                "id": "purchase-manual-prebatch-item",
                                "productId": prebatch_manual_product["id"],
                                "productName": prebatch_manual_product["name"],
                                "quantity": 5,
                                "unitCost": 18000,
                            }
                        ],
                    }
                ],
                "carts": [
                    {
                        "id": "cart-lock-batch",
                        "customerName": "Khách lock batch",
                        "status": "draft",
                        "items": [
                            {
                                "id": "cart-item-lock-batch",
                                "productId": batch_product["id"],
                                "productName": batch_product["name"],
                                "quantity": 4,
                                "unitPrice": 22000,
                            }
                        ],
                    }
                ],
            }
        )
        prebatch_ordered_state = copy.deepcopy(self.store.get_sync_state()["purchases"])
        prebatch_ordered_index = next(
            index for index, purchase in enumerate(prebatch_ordered_state)
            if purchase["id"] == "purchase-manual-prebatch"
        )
        prebatch_ordered_state[prebatch_ordered_index]["status"] = "ordered"
        prebatch_ordered_state[prebatch_ordered_index]["updatedAt"] = prebatch_ordered_at
        self.store.save_sync_state(
            {"purchases": prebatch_ordered_state},
            actor_username="staff",
            actor_role="user",
        )
        self.store.start_procurement_batch(
            username="bizmanager",
            role="user",
            lock_timeout_minutes=30,
        )
        created = self.store.create_procurement_purchase_for_product(
            product_id=batch_product["id"],
            quantity=4,
            supplier_name="NCC lock batch",
            actor="bizmanager",
            role="user",
        )

        sync_state = self.store.get_sync_state()
        edited_purchases = copy.deepcopy(sync_state["purchases"])
        batch_purchase_index = next(
            index for index, purchase in enumerate(edited_purchases)
            if purchase["id"] == created["purchase"]["id"]
        )
        edited_purchases[batch_purchase_index]["items"][0]["quantity"] = 6
        with self.assertRaisesRegex(ValueError, "Chỉ người giữ khóa batch"):
            self.store.save_sync_state(
                {"purchases": edited_purchases},
                actor_username="staff",
                actor_role="user",
            )

        ordered_purchases = copy.deepcopy(sync_state["purchases"])
        batch_purchase_index = next(
            index for index, purchase in enumerate(ordered_purchases)
            if purchase["id"] == created["purchase"]["id"]
        )
        ordered_purchases[batch_purchase_index]["status"] = "ordered"
        self.store.save_sync_state(
            {"purchases": ordered_purchases},
            actor_username="bizmanager",
            actor_role="user",
        )

        owner_updated_prebatch_state = copy.deepcopy(self.store.get_sync_state()["purchases"])
        owner_updated_prebatch_index = next(
            index for index, purchase in enumerate(owner_updated_prebatch_state)
            if purchase["id"] == "purchase-manual-prebatch"
        )
        owner_updated_prebatch_state[owner_updated_prebatch_index]["note"] = "Owner cập nhật ghi chú sau khi bật batch"
        self.store.save_sync_state(
            {"purchases": owner_updated_prebatch_state},
            actor_username="bizmanager",
            actor_role="user",
        )

        postbatch_state = self.store.get_sync_state()
        postbatch_purchases = copy.deepcopy(postbatch_state["purchases"])
        refreshed_prebatch_purchase = next(
            purchase for purchase in postbatch_purchases
            if purchase["id"] == "purchase-manual-prebatch"
        )
        self.assertEqual(refreshed_prebatch_purchase["orderedAt"], prebatch_ordered_at)
        postbatch_purchases.append(
            {
                "id": "purchase-manual-postbatch",
                "supplierName": "NCC lock batch",
                "status": "ordered",
                "sourceType": "manual",
                "createdAt": datetime.now().astimezone().isoformat(timespec="seconds"),
                "updatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
                "items": [
                    {
                        "id": "purchase-manual-postbatch-item",
                        "productId": postbatch_manual_product["id"],
                        "productName": postbatch_manual_product["name"],
                        "quantity": 2,
                        "unitCost": 17000,
                    }
                ],
            }
        )
        self.store.save_sync_state(
            {"purchases": postbatch_purchases},
            actor_username="bizmanager",
            actor_role="user",
        )

        with self.assertRaisesRegex(ValueError, "Chỉ người giữ khóa batch"):
            self.store.receive_purchase(
                created["purchase"]["id"],
                actor_username="warehouse",
                actor_role="user",
            )

        receive_result = self.store.receive_purchase(
            "purchase-manual-prebatch",
            actor_username="warehouse",
            actor_role="user",
        )
        self.assertEqual(receive_result["purchase"]["status"], "received")
        self.assertTrue(receive_result["purchase"]["receiptCode"])

        with self.assertRaisesRegex(ValueError, "Chỉ người giữ khóa batch"):
            self.store.receive_purchase(
                "purchase-manual-postbatch",
                actor_username="warehouse",
                actor_role="user",
            )

        current_state_after_manual_receive = self.store.get_sync_state()
        batch_purchase_after_manual_receive = next(
            purchase for purchase in current_state_after_manual_receive["purchases"]
            if purchase["id"] == created["purchase"]["id"]
        )
        self.assertEqual(batch_purchase_after_manual_receive["status"], "ordered")

        paid_result = self.store.mark_purchase_paid(
            "purchase-manual-prebatch",
            actor_username="cashier",
            actor_role="user",
        )
        self.assertEqual(paid_result["purchase"]["status"], "paid")

        final_state = self.store.get_sync_state()
        final_purchase = next(
            purchase for purchase in final_state["purchases"]
            if purchase["id"] == "purchase-manual-prebatch"
        )
        self.assertEqual(final_purchase["status"], "paid")

    def test_ut_proc_04b_non_owner_can_receive_legacy_prebatch_purchase_without_ordered_at(self) -> None:
        product = self.store.create_product(
            name="Mì căn legacy prebatch",
            category="Đồ chay",
            unit="gói",
            price=18000,
            sale_price=26000,
            low_stock_threshold=0,
        )
        self.store.save_sync_state(
            {
                "suppliers": [{"id": "supplier-legacy-prebatch", "name": "NCC legacy prebatch"}],
                "purchases": [
                    {
                        "id": "purchase-legacy-prebatch",
                        "supplierName": "NCC legacy prebatch",
                        "status": "ordered",
                        "sourceType": "manual",
                        "createdAt": "2026-05-16T07:00:00+00:00",
                        "updatedAt": "2026-05-16T07:00:00+00:00",
                        "items": [
                            {
                                "id": "purchase-legacy-prebatch-item",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 3,
                                "unitCost": 18000,
                            }
                        ],
                    }
                ],
            },
            actor_username="staff",
            actor_role="user",
        )
        self.store.start_procurement_batch(
            username="bizmanager",
            role="user",
            lock_timeout_minutes=30,
        )
        with self.store._connect() as connection:
            connection.execute(
                """
                UPDATE purchases
                SET ordered_at = NULL,
                    updated_at = ?,
                    note = ?
                WHERE id = ?
                """,
                (
                    "2026-05-17T12:00:00+00:00",
                    "Legacy note updated after batch without ordered_at",
                    "purchase-legacy-prebatch",
                ),
            )
            connection.execute(
                """
                DELETE FROM audit_logs
                WHERE entity_type = 'purchase'
                  AND entity_id = ?
                  AND action = 'status-change'
                """,
                ("purchase-legacy-prebatch",),
            )

        legacy_state = self.store.get_sync_state()
        legacy_purchase = next(
            purchase for purchase in legacy_state["purchases"]
            if purchase["id"] == "purchase-legacy-prebatch"
        )
        self.assertEqual(legacy_purchase["orderedAt"], "2026-05-16T07:00:00+00:00")

        receive_result = self.store.receive_purchase(
            "purchase-legacy-prebatch",
            actor_username="warehouse",
            actor_role="user",
        )
        self.assertEqual(receive_result["purchase"]["status"], "received")
        self.assertTrue(receive_result["purchase"]["receiptCode"])

        final_state = self.store.get_sync_state()
        final_purchase = next(
            purchase for purchase in final_state["purchases"]
            if purchase["id"] == "purchase-legacy-prebatch"
        )
        self.assertEqual(final_purchase["status"], "received")

    def test_ut_proc_04c_cancelled_purchase_from_draft_does_not_backfill_ordered_at(self) -> None:
        product = self.store.create_product(
            name="Đậu hũ cancelled from draft",
            category="Đồ chay",
            unit="gói",
            price=15000,
            sale_price=22000,
            low_stock_threshold=0,
        )
        self.store.save_sync_state(
            {
                "suppliers": [{"id": "supplier-cancelled-draft", "name": "NCC cancelled draft"}],
                "purchases": [
                    {
                        "id": "purchase-cancelled-draft",
                        "supplierName": "NCC cancelled draft",
                        "status": "cancelled",
                        "sourceType": "manual",
                        "createdAt": "2026-05-16T07:00:00+00:00",
                        "updatedAt": "2026-05-17T08:00:00+00:00",
                        "items": [
                            {
                                "id": "purchase-cancelled-draft-item",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 2,
                                "unitCost": 15000,
                            }
                        ],
                        "cancelledAt": "2026-05-17T08:00:00+00:00",
                        "cancelled_at": "2026-05-17T08:00:00+00:00",
                    }
                ],
            },
            actor_username="staff",
            actor_role="user",
        )
        with self.store._connect() as connection:
            connection.execute(
                "UPDATE purchases SET ordered_at = NULL WHERE id = ?",
                ("purchase-cancelled-draft",),
            )
            connection.execute(
                """
                DELETE FROM audit_logs
                WHERE entity_type = 'purchase'
                  AND entity_id = ?
                  AND action = 'status-change'
                """,
                ("purchase-cancelled-draft",),
            )

        cancelled_state = self.store.get_sync_state()
        cancelled_purchase = next(
            purchase for purchase in cancelled_state["purchases"]
            if purchase["id"] == "purchase-cancelled-draft"
        )
        self.assertEqual(cancelled_purchase["status"], "cancelled")
        self.assertEqual(cancelled_purchase["orderedAt"], "")

    def test_ut_proc_05_assignment_releases_when_batch_purchase_is_cancelled(self) -> None:
        product = self.store.create_product(
            name="Chả hủy batch",
            category="Đồ chay",
            unit="gói",
            price=11000,
            sale_price=17000,
            low_stock_threshold=0,
        )
        self.store.save_sync_state(
            {
                "suppliers": [{"id": "supplier-cancel-batch", "name": "NCC hủy batch"}],
                "carts": [
                    {
                        "id": "cart-cancel-batch",
                        "customerName": "Khách hủy batch",
                        "status": "draft",
                        "items": [
                            {
                                "id": "cart-item-cancel-batch",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 3,
                                "unitPrice": 17000,
                            }
                        ],
                    }
                ],
            }
        )
        self.store.start_procurement_batch(
            username="bizmanager",
            role="user",
            lock_timeout_minutes=30,
        )
        created = self.store.create_procurement_purchase_for_product(
            product_id=product["id"],
            quantity=3,
            supplier_name="NCC hủy batch",
            actor="bizmanager",
            role="user",
        )

        self.store.repair_purchase_document(
            created["purchase"]["id"],
            action="cancel",
            actor="bizmanager",
        )

        planner = self.store.get_procurement_planner(scope_type="all")
        row = next(
            entry for entry in planner["rows"]
            if entry["product_id"] == product["id"]
        )
        self.assertIsNone(row["assignment"])

    def test_ut_proc_06_start_batch_rejects_existing_open_purchase_conflicts(self) -> None:
        product = self.store.create_product(
            name="Mì căn conflict batch",
            category="Đồ chay",
            unit="gói",
            price=18000,
            sale_price=26000,
            low_stock_threshold=0,
        )
        now = "2026-05-17T08:00:00+00:00"
        self.store.save_sync_state(
            {
                "suppliers": [{"id": "supplier-conflict-batch", "name": "NCC conflict batch"}],
                "purchases": [
                    {
                        "id": "purchase-conflict-cart",
                        "supplierName": "NCC conflict batch",
                        "status": "draft",
                        "sourceType": "cart",
                        "sourceCode": "cart-conflict-batch",
                        "createdAt": now,
                        "updatedAt": now,
                        "items": [
                            {
                                "id": "purchase-conflict-cart-item",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 2,
                                "unitPrice": 18000,
                            }
                        ],
                    },
                    {
                        "id": "purchase-conflict-manual",
                        "supplierName": "NCC conflict batch",
                        "status": "ordered",
                        "sourceType": "manual",
                        "createdAt": now,
                        "updatedAt": now,
                        "items": [
                            {
                                "id": "purchase-conflict-manual-item",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 3,
                                "unitPrice": 18000,
                            }
                        ],
                    },
                ],
            }
        )

        with self.assertRaisesRegex(ValueError, "Cần dọn conflict trước khi bắt đầu kỳ gom nhập"):
            self.store.start_procurement_batch(
                username="bizmanager",
                role="user",
                lock_timeout_minutes=30,
            )

    def test_ut_proc_07_batch_create_supports_mixed_shortage_and_extra_lines(self) -> None:
        shortage_product = self.store.create_product(
            name="Nấm shortage batch",
            category="Đồ chay",
            unit="gói",
            price=14000,
            sale_price=21000,
            low_stock_threshold=0,
        )
        extra_product = self.store.create_product(
            name="Chà bông extra batch",
            category="Đồ chay",
            unit="hộp",
            price=22000,
            sale_price=32000,
            low_stock_threshold=0,
        )
        self.store.save_sync_state(
            {
                "suppliers": [{"id": "supplier-mixed-batch", "name": "NCC mixed batch"}],
                "carts": [
                    {
                        "id": "cart-mixed-batch",
                        "customerName": "Khách mixed batch",
                        "status": "draft",
                        "items": [
                            {
                                "id": "cart-item-mixed-batch",
                                "productId": shortage_product["id"],
                                "productName": shortage_product["name"],
                                "quantity": 5,
                                "unitPrice": 21000,
                            }
                        ],
                    }
                ],
            }
        )
        self.store.start_procurement_batch(
            username="bizmanager",
            role="user",
            lock_timeout_minutes=30,
        )

        result = self.store.create_procurement_purchases(
            lines=[
                {
                    "product_id": shortage_product["id"],
                    "quantity": 5,
                    "supplier_name": "NCC mixed batch",
                    "source_kind": "shortage",
                },
                {
                    "product_id": extra_product["id"],
                    "quantity": 2,
                    "supplier_name": "NCC mixed batch",
                    "source_kind": "extra",
                    "source_note": "Ngoài nhu cầu đơn",
                },
            ],
            actor="bizmanager",
            role="user",
        )

        self.assertEqual(len(result["created_purchases"]), 1)
        purchase = result["created_purchases"][0]
        self.assertEqual(purchase["supplierName"], "NCC mixed batch")
        source_kinds_by_product = {
            item["productId"]: item["sourceKind"]
            for item in purchase["items"]
        }
        self.assertEqual(source_kinds_by_product[shortage_product["id"]], "shortage")
        self.assertEqual(source_kinds_by_product[extra_product["id"]], "extra")

        planner_row = next(
            row for row in result["planner"]["rows"]
            if row["product_id"] == shortage_product["id"]
        )
        self.assertEqual(planner_row["assignment"]["purchase_id"], purchase["id"])

        with self.store._connect() as connection:
            assignments = connection.execute(
                """
                SELECT product_id, purchase_id
                FROM procurement_assignments
                WHERE status = 'active'
                ORDER BY product_id
                """
            ).fetchall()
            purchase_item_rows = connection.execute(
                """
                SELECT product_id, source_kind
                FROM purchase_items
                WHERE purchase_id = ?
                ORDER BY product_id, source_kind
                """,
                (purchase["id"],),
            ).fetchall()

        self.assertEqual(len(assignments), 1)
        self.assertEqual(assignments[0]["product_id"], shortage_product["id"])
        self.assertEqual(assignments[0]["purchase_id"], purchase["id"])
        self.assertEqual(
            {(row["product_id"], row["source_kind"]) for row in purchase_item_rows},
            {
                (shortage_product["id"], "shortage"),
                (extra_product["id"], "extra"),
            },
        )

    def test_ut_proc_08_extra_line_for_same_product_merges_into_existing_batch_purchase_without_extra_assignment(self) -> None:
        product = self.store.create_product(
            name="Tàu hũ ky mixed same product",
            category="Đồ chay",
            unit="gói",
            price=16000,
            sale_price=23000,
            low_stock_threshold=0,
        )
        self.store.save_sync_state(
            {
                "suppliers": [{"id": "supplier-same-product-batch", "name": "NCC same product batch"}],
                "carts": [
                    {
                        "id": "cart-same-product-batch",
                        "customerName": "Khách same product batch",
                        "status": "draft",
                        "items": [
                            {
                                "id": "cart-item-same-product-batch",
                                "productId": product["id"],
                                "productName": product["name"],
                                "quantity": 4,
                                "unitPrice": 23000,
                            }
                        ],
                    }
                ],
            }
        )
        self.store.start_procurement_batch(
            username="bizmanager",
            role="user",
            lock_timeout_minutes=30,
        )

        result = self.store.create_procurement_purchases(
            lines=[
                {
                    "product_id": product["id"],
                    "quantity": 2,
                    "supplier_name": "NCC same product batch",
                    "source_kind": "extra",
                    "source_note": "Ngoài nhu cầu đơn",
                },
                {
                    "product_id": product["id"],
                    "quantity": 4,
                    "supplier_name": "NCC same product batch",
                    "source_kind": "shortage",
                },
            ],
            actor="bizmanager",
            role="user",
        )

        self.assertEqual(len(result["created_purchases"]), 1)
        purchase = result["created_purchases"][0]
        product_items = [item for item in purchase["items"] if item["productId"] == product["id"]]
        self.assertEqual(len(product_items), 2)
        self.assertEqual({item["sourceKind"] for item in product_items}, {"extra", "shortage"})

        planner_row = next(
            row for row in result["planner"]["rows"]
            if row["product_id"] == product["id"]
        )
        self.assertEqual(planner_row["assignment"]["purchase_id"], purchase["id"])

        with self.store._connect() as connection:
            assignments = connection.execute(
                """
                SELECT product_id, purchase_id
                FROM procurement_assignments
                WHERE status = 'active'
                  AND product_id = ?
                """,
                (product["id"],),
            ).fetchall()

        self.assertEqual(len(assignments), 1)
        self.assertEqual(assignments[0]["purchase_id"], purchase["id"])



if __name__ == "__main__":
    unittest.main()
