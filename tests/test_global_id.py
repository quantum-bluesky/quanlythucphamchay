import os
import unittest
from tempfile import TemporaryDirectory
from qltpchay.store import InventoryStore
from qltpchay.http_handler import create_handler

class TestGlobalID(unittest.TestCase):
    def setUp(self):
        self.temp_dir = TemporaryDirectory()
        self.db_path = os.path.join(self.temp_dir.name, "test.db")
        self.store = InventoryStore(self.db_path)
        self.handler = create_handler(self.store, None, {"asset_versions_path": os.path.join(self.temp_dir.name, "js_asset_versions.json")})

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_global_id_csv_import_export(self):
        # 1. Tạo sản phẩm
        prod1 = self.store.create_product(name="Sản phẩm A", category="Đồ chay", unit="hộp", price=100)
        global_id1 = prod1["global_id"]
        
        prod2 = self.store.create_product(name="Sản phẩm B", category="Đồ chay", unit="hộp", price=200)
        
        # 2. Export ra CSV
        products = self.store.get_products()
        csv_bytes = self.handler._build_master_csv_bytes("products", products)
        csv_str = csv_bytes.decode("utf-8-sig")
        
        self.assertIn("global_id", csv_str.splitlines()[0])
        self.assertIn(global_id1, csv_str)
        
        # 3. Sửa tên sản phẩm trong file CSV (giữ nguyên global_id)
        modified_csv = csv_str.replace("Sản phẩm A", "Sản phẩm C")
        
        # 4. Import CSV
        records = self.handler._parse_master_csv_records("products", modified_csv)
        summary = self.store._import_products_master(records)
        
        self.assertEqual(summary["created"], 0)
        self.assertEqual(summary["updated"], 2)
        
        # 5. Kiểm tra kết quả
        p = self.store.get_product_by_id(prod1["id"])
        self.assertEqual(p["name"], "Sản phẩm C")
        self.assertEqual(p["global_id"], global_id1)
        
        # 6. Test Customers
        customer_id = "customers_test123"
        self.store.save_sync_state({"customers": [{"id": customer_id, "name": "Khách A", "phone": "123"}]})
        
        customers = self.store._get_sync_collection("customers")
        cust_csv_bytes = self.handler._build_master_csv_bytes("customers", customers)
        cust_csv_str = cust_csv_bytes.decode("utf-8-sig")
        
        cust_modified_csv = cust_csv_str.replace("Khách A", "Khách B")
        cust_records = self.handler._parse_master_csv_records("customers", cust_modified_csv)
        cust_summary = self.store._import_sync_master("customers", cust_records)
        
        self.assertEqual(cust_summary["updated"], 1)
        self.assertEqual(cust_summary["created"], 0)
        
        customers_after = self.store._get_sync_collection("customers")
        self.assertEqual(customers_after[0]["name"], "Khách B")
        self.assertEqual(customers_after[0]["id"], customer_id)

if __name__ == "__main__":
    unittest.main()
