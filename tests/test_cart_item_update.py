import tempfile
import unittest
from pathlib import Path

from qltpchay.store import InventoryStore, SyncConflictError


class CartItemUpdateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = InventoryStore(Path(self.temp.name) / "inventory.db")
        self.product = self.store.create_product(
            name="Unit test", category="Test", unit="cái", price=5000, sale_price=10000,
            unit_conversions=[{"from_unit": "hộp", "conversion_factor": 20}],
        )
        self.carts = []
        for status in ["draft", "committed", "completed", "cancelled"]:
            self.carts.append({
                "id": status, "customerName": "Test" if status != "cancelled" else "", "status": status,
                "paymentStatus": "unpaid", "createdAt": "2026-09-01T00:00:00+00:00",
                "updatedAt": "2026-09-01T00:00:00+00:00", "orderCode": f"TEST-{status}",
                "committedAt": "2026-09-01T00:00:00+00:00" if status == "committed" else None,
                "completedAt": "2026-09-01T00:00:00+00:00" if status == "completed" else None,
                "items": [{"id": status + "-line", "productId": self.product["id"], "productName": "Unit test",
                           "quantity": 10, "unitPrice": 10000, "note": "keep this note"}],
            })
        self.store.save_sync_state({"carts": self.carts})

    def tearDown(self):
        self.temp.cleanup()

    def payload(self, cart_id="draft", **changes):
        cart = next(cart for cart in self.store.get_sync_state()["carts"] if cart["id"] == cart_id)
        return {"expected_updated_at": cart["updatedAt"], "quantity": 10, "input_quantity": 0.5,
                "input_unit": "hộp", "conversion_factor": 20, "unit_price": 140000, **changes}

    def test_ut_unit_01_scoped_save_preserves_other_documents_and_stock(self):
        before = self.store.get_sync_state()
        summary = self.store.get_summary()
        result = self.store.update_cart_item("draft", "draft-line", self.payload(), actor="tester")
        item = result["cart"]["items"][0]
        self.assertEqual(item["quantity"], 10)
        self.assertEqual(item["conversionFactor"], 20)
        self.assertEqual(item["note"], "keep this note")
        after = self.store.get_sync_state()
        self.assertEqual([c for c in before["carts"] if c["id"] != "draft"],
                         [c for c in after["carts"] if c["id"] != "draft"])
        self.assertEqual(summary, self.store.get_summary())
        with self.store._connect() as connection:
            audit = connection.execute("SELECT actor FROM audit_logs WHERE entity_id = ? AND action = ?", ("draft", "edit-item")).fetchone()
        self.assertEqual(audit["actor"], "tester")
        self.assertNotEqual(result["cart"]["updatedAt"], self.carts[0]["updatedAt"])

    def test_ut_unit_02_document_conflicts_and_committed_edit(self):
        stale = self.payload()
        self.store.update_cart_item("committed", "committed-line", self.payload("committed"))
        # Another order's update does not invalidate this order's version.
        self.store.update_cart_item("draft", "draft-line", stale)
        with self.assertRaises(SyncConflictError):
            self.store.update_cart_item("draft", "draft-line", stale)
        self.store.enable_multiuser_conflict_check = False
        self.store.update_cart_item("draft", "draft-line", stale)

    def test_ut_unit_03_locked_documents_wrong_line_and_invalid_payload_are_rejected(self):
        before = self.store.get_sync_state()
        for status in ["cancelled", "completed"]:
            with self.subTest(status=status), self.assertRaises(ValueError):
                self.store.update_cart_item(status, status + "-line", self.payload(status))
        with self.assertRaises(ValueError):
            self.store.update_cart_item("draft", "committed-line", self.payload())
        for changes in [{"quantity": -1}, {"quantity": "NaN"}, {"unit_price": "Infinity"},
                        {"input_quantity": 2}, {"conversion_factor": 10, "input_quantity": 1},
                        {"input_unit": "unknown"}, {"expected_updated_at": ""}, {"carts": []},
                        {"quantity": "1e100", "input_quantity": "1e100"}]:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                self.store.update_cart_item("draft", "draft-line", self.payload(**changes))
        self.assertEqual(before, self.store.get_sync_state())

    def test_ut_unit_04_rounding_preserves_base_and_unit_snapshot(self):
        result = self.store.update_cart_item("draft", "draft-line", self.payload(
            quantity=1, input_quantity=0.05, conversion_factor=20,
        ))
        self.assertEqual(result["cart"]["items"][0]["quantity"], 1)
        result = self.store.update_cart_item("draft", "draft-line", self.payload(
            quantity=0.1234, input_quantity=0.1234, conversion_factor=1, input_unit="cái",
        ))
        self.assertEqual(result["cart"]["items"][0]["quantity"], 0.1234)

    def test_ut_unit_05_selected_unit_quantity_drives_document_amount(self):
        result = self.store.update_cart_item("draft", "draft-line", self.payload(
            quantity=40, input_quantity=2, conversion_factor=20, unit_price=140000,
        ))
        self.assertEqual(float(self.store._get_cart_subtotal_amount(result["cart"])), 280000)
        grouped = self.store._group_sale_items(result["cart"]["items"])
        self.assertEqual(float(next(iter(grouped.values()))["quantity"]), 40)
        self.assertEqual(float(next(iter(grouped.values()))["input_quantity"]), 2)

    def test_ut_unit_06_purchase_amount_uses_selected_unit_but_batch_cost_uses_base_unit(self):
        receipt = self.store.create_purchase_receipt(items=[{
            "product_id": self.product["id"], "quantity": 40,
            "input_quantity": 2, "conversion_factor": 20, "unit_cost": 70000,
        }])
        self.assertEqual(receipt["subtotal_amount"], 140000)
        self.assertEqual(receipt["transactions"][0]["quantity"], 40)
        self.assertEqual(receipt["transactions"][0]["unit_cost"], 70000)
        self.assertEqual(receipt["transactions"][0]["base_unit_cost"], 3500)
        with self.store._connect() as connection:
            batch = connection.execute(
                "SELECT initial_quantity, unit_cost FROM inventory_batches WHERE product_id = ?",
                (self.product["id"],),
            ).fetchone()
            product = connection.execute("SELECT price FROM products WHERE id = ?", (self.product["id"],)).fetchone()
        self.assertEqual(float(batch["initial_quantity"]), 40)
        self.assertEqual(float(batch["unit_cost"]), 3500)
        self.assertEqual(float(product["price"]), 3500)

    def test_ut_unit_07_sale_amount_uses_selected_unit_but_stock_uses_base_quantity(self):
        self.store.create_purchase_receipt(items=[{
            "product_id": self.product["id"], "quantity": 100,
            "input_quantity": 100, "conversion_factor": 1, "unit_cost": 5000,
        }])
        self.store.update_cart_item("draft", "draft-line", self.payload(
            quantity=40, input_quantity=2, conversion_factor=20, unit_price=140000,
        ))
        self.store.commit_cart_order("draft", actor="tester")
        shipped = self.store.ship_cart_order("draft", actor="tester")
        self.assertEqual(shipped["order"]["subtotal_amount"], 280000)
        self.assertEqual(shipped["order"]["transactions"][0]["line_total"], 280000)
        self.assertEqual(shipped["order"]["transactions"][0]["quantity"], 40)
        self.assertEqual(self.store.get_summary()["total_stock"], 60)
        with self.store._connect() as connection:
            note = connection.execute(
                "SELECT note FROM transactions WHERE transaction_type = 'out' ORDER BY id DESC LIMIT 1"
            ).fetchone()["note"]
        self.assertIn("Thành tiền: 280000.00", note)


if __name__ == "__main__":
    unittest.main()
