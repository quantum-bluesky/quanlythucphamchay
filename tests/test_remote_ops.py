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


if __name__ == "__main__":
    unittest.main()
