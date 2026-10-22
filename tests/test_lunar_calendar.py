import unittest
from datetime import date

from qltpchay.lunar_calendar import next_preorder_lunar_date, solar_to_vietnamese_lunar


class VietnameseLunarCalendarTests(unittest.TestCase):
    def test_ut_lunar_01_known_vietnamese_new_year_dates(self):
        self.assertEqual(solar_to_vietnamese_lunar(date(2024, 2, 10)), (1, 1, 2024, False))
        self.assertEqual(solar_to_vietnamese_lunar(date(2025, 1, 29)), (1, 1, 2025, False))

    def test_ut_lunar_02_identifies_vietnamese_leap_month(self):
        self.assertEqual(solar_to_vietnamese_lunar(date(2023, 3, 22)), (1, 2, 2023, True))

    def test_ut_lunar_03_rejects_non_date_input(self):
        with self.assertRaises(TypeError):
            solar_to_vietnamese_lunar("2024-02-10")

    def test_ut_lunar_04_counts_down_to_lunar_first_and_fifteenth(self):
        self.assertEqual(next_preorder_lunar_date(date(2024, 2, 3)), (7, 1, 1, 2024, False))
        self.assertEqual(next_preorder_lunar_date(date(2024, 2, 17)), (7, 15, 1, 2024, False))

    def test_ut_lunar_05_includes_today_and_rejects_non_date_input(self):
        self.assertEqual(next_preorder_lunar_date(date(2024, 2, 10)), (0, 1, 1, 2024, False))
        with self.assertRaises(TypeError):
            next_preorder_lunar_date("2024-02-10")


if __name__ == "__main__":
    unittest.main()
