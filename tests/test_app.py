import tempfile
import unittest
from pathlib import Path

from app import InventoryStore


class InventoryStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.store = InventoryStore(Path(self.temp_dir.name) / "inventory-test.db")

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_create_product_and_stock_summary(self) -> None:
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

    def test_stock_out_cannot_exceed_inventory(self) -> None:
        product = self.store.create_product(
            name="Xúc xích chay",
            category="Đồ chay đông lạnh",
            unit="cây",
            low_stock_threshold=2,
        )
        self.store.create_transaction(product["id"], "in", 2)

        with self.assertRaisesRegex(ValueError, "lớn hơn tồn kho"):
            self.store.create_transaction(product["id"], "out", 3)


if __name__ == "__main__":
    unittest.main()
