# -*- coding: utf-8 -*-
"""
tests/test_remote_ops.py
Unit tests cho scripts/remote_ops.py (RemoteStoreClient và Intake & Scrutiny logic).
#Issue183
"""

import unittest
from unittest.mock import MagicMock, patch
from scripts.remote_ops import RemoteStoreClient, _format_table


class TestRemoteOps(unittest.TestCase):
    def setUp(self):
        self.client = RemoteStoreClient(
            base_url="http://mock-server/qltp/",
            username="masteradmin",
            password="testpassword",
            insecure_ssl=True,
        )

    def test_ut_remote_01_format_table(self):
        headers = ["ID", "Tên", "Giá"]
        rows = [["1", "Món chay A", "10,000"], ["2", "Món chay B", "20,000"]]
        table = _format_table(headers, rows)
        self.assertIn("Món chay A", table)
        self.assertIn("20,000", table)
        self.assertIn("---", table)

    def test_ut_remote_02_preview_scrutiny_new_and_updated_products(self):
        # Giả lập sản phẩm hiện có trên server
        mock_products = [
            {
                "id": 1,
                "global_id": "gid-1",
                "name": "Giò lụa chay",
                "unit": "cái",
                "price": 30000,
                "sale_price": 40000,
                "stock": 5.0,
                "category": "Món lạnh",
            }
        ]

        with patch.object(self.client, "get_products", return_value=mock_products):
            # Input từ người dùng: 1 món cập nhật giá, 1 món mới
            new_input = [
                {
                    "name": "Giò lụa chay",
                    "price": 32000,
                    "sale_price": 42000,
                },
                {
                    "name": "Sườn non chay",
                    "unit": "gói",
                    "price": 25000,
                    "sale_price": 35000,
                    "stock": 20,
                    "category": "Đồ khô",
                },
            ]

            report = self.client.preview_scrutiny_products(new_input)

            self.assertEqual(report["total_input"], 2)
            self.assertEqual(report["new_count"], 1)
            self.assertEqual(report["update_count"], 1)

            # Kiểm tra món mới
            self.assertEqual(report["new_items"][0]["name"], "Sườn non chay")
            self.assertEqual(report["new_items"][0]["stock"], 20)

            # Kiểm tra món cập nhật
            self.assertEqual(report["updated_items"][0]["id"], 1)
            self.assertEqual(report["updated_items"][0]["old_price"], 30000)
            self.assertEqual(report["updated_items"][0]["new_price"], 32000)

    def test_ut_remote_03_preview_scrutiny_warnings(self):
        mock_products = [
            {
                "id": 10,
                "name": "Đậu hũ sốt cà",
                "unit": "hộp",
                "price": 20000,
                "sale_price": 25000,
                "stock": 2,
            }
        ]

        with patch.object(self.client, "get_products", return_value=mock_products):
            # Tình huống: Giá bán < Giá nhập VÀ Biến động giá > 30%
            new_input = [
                {
                    "name": "Đậu hũ sốt cà",
                    "price": 40000,  # Tăng 100%
                    "sale_price": 35000,  # Giá bán thấp hơn giá nhập 40000
                }
            ]

            report = self.client.preview_scrutiny_products(new_input)
            self.assertEqual(len(report["warnings"]), 3)
            self.assertTrue(any("thấp hơn giá nhập" in w for w in report["warnings"]))
            self.assertTrue(any("Giá nhập thay đổi mạnh" in w for w in report["warnings"]))
            self.assertTrue(any("Giá bán thay đổi mạnh" in w for w in report["warnings"]))

    def test_ut_remote_04_get_and_resolve_suppliers(self):
        mock_state = {
            "suppliers": [
                {"id": "sup_1", "name": "Âu Lạc", "phone": "0901234567", "deleted_at": None},
                {"id": "sup_2", "name": "Chị Mai An Lành", "phone": "0912345678", "deleted_at": None},
                {"id": "sup_deleted", "name": "NCC Cũ", "phone": "", "deleted_at": "2026-01-01"},
            ]
        }
        with patch.object(self.client, "ensure_authenticated"), \
             patch.object(self.client, "_request", return_value=mock_state):
            suppliers = self.client.get_suppliers()
            self.assertEqual(len(suppliers), 2)
            self.assertEqual(suppliers[0]["id"], "sup_1")

        with patch.object(self.client, "get_suppliers", return_value=mock_state["suppliers"][:2]):
            # 1. Khớp chính xác ID
            sup, matches = self.client.resolve_supplier("sup_2")
            self.assertIsNotNone(sup)
            self.assertEqual(sup["name"], "Chị Mai An Lành")

            # 2. Khớp chính xác Tên (case-insensitive)
            sup, matches = self.client.resolve_supplier("ÂU LẠC")
            self.assertIsNotNone(sup)
            self.assertEqual(sup["id"], "sup_1")

            # 3. Khớp một phần
            sup, matches = self.client.resolve_supplier("mai an")
            self.assertIsNotNone(sup)
            self.assertEqual(sup["id"], "sup_2")

            # 4. Tìm kiếm mờ không dấu (fuzzy non-accent)
            sup, matches = self.client.resolve_supplier("chi mai")
            self.assertIsNotNone(sup)
            self.assertEqual(sup["id"], "sup_2")

            # 5. Token search (tách từ)
            sup, matches = self.client.resolve_supplier("Lành Mai")
            self.assertIsNotNone(sup)
            self.assertEqual(sup["id"], "sup_2")

            # 6. Không tìm thấy
            sup, matches = self.client.resolve_supplier("Không Tồn Tại")
            self.assertIsNone(sup)
            self.assertEqual(len(matches), 0)

    def test_ut_remote_05_push_order(self):
        mock_response = {"success": True, "document_id": "DH-20261121-001"}
        with patch.object(self.client, "ensure_authenticated"), \
             patch.object(self.client, "_request", return_value=mock_response) as mock_req:
            res = self.client.push_quick_order(
                customer_name="Cô Nguyệt hàng xóm",
                items=[{"product_id": 118, "quantity": 10, "unit_price": 7000}],
                note="Bán bánh khúc",
            )
            self.assertEqual(res["document_id"], "DH-20261121-001")
            mock_req.assert_called_once_with(
                "POST",
                "api/orders/quick-create",
                payload={
                    "customer_name": "Cô Nguyệt hàng xóm",
                    "items": [{"product_id": 118, "quantity": 10, "unit_price": 7000}],
                    "note": "Bán bánh khúc",
                    "payment_status": "paid",
                },
            )

    def test_ut_remote_06_get_product_history_default_filter(self):
        mock_state = {
            "products": [{"id": 118, "name": "Bánh khúc", "unit": "cái", "stock": 40, "price": 6000, "sale_price": 8000}],
            "purchases": [
                {"id": "pn1", "created_at": "2026-11-17 00:45:15", "items": [{"product_id": 118, "quantity": 20, "unit_cost": 6000}]},
                {"id": "pn2", "created_at": "2026-11-11 23:01:17", "items": [{"product_id": 118, "quantity": 20, "unit_cost": 6000}]},
                {"id": "pn3", "created_at": "2026-10-09 00:00:00", "items": [{"product_id": 118, "quantity": 20, "unit_cost": 6000}]},
            ],
        }
        mock_movements = {
            "movements": [
                {"date": "2026-10-01 10:00:00", "movement_type": "in", "quantity": 10},
                {"date": "2026-11-11 23:01:17", "movement_type": "in", "quantity": 20},
                {"date": "2026-11-17 00:45:15", "movement_type": "in", "quantity": 20},
            ]
        }
        with patch.object(self.client, "ensure_authenticated"), \
             patch.object(self.client, "_request", side_effect=[mock_state, mock_movements]):
            # Mặc định (all_time=False): chỉ lấy từ 2026-11-11 trở đi
            hist = self.client.get_product_history(118)
            self.assertEqual(len(hist["recent_purchases"]), 2)
            self.assertEqual(len(hist["movements"]), 2)
            self.assertEqual(hist["total_movements_count"], 3)
            self.assertEqual(hist["cutoff_date"], "2026-11-11 23:01:17")


if __name__ == "__main__":
    unittest.main()
