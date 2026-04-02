import re
from pathlib import Path
from typing import Any

from .helpers import parse_non_negative_decimal


def parse_seed_line(
    line: str,
    default_category: str,
    default_unit: str,
    default_threshold: float,
    default_price: float,
) -> dict | None:
    raw_line = line.strip()
    if not raw_line or raw_line.startswith("#"):
        return None

    parts = [part.strip() for part in raw_line.split("|")]
    name = re.sub(r"^\s*\d+[\.\)]\s*", "", parts[0]).strip()
    if not name:
        return None

    category = default_category
    unit = default_unit
    low_stock_threshold = default_threshold
    price = default_price

    if len(parts) == 2:
        try:
            price = float(parse_non_negative_decimal(parts[1] or default_price, "Giá"))
        except ValueError:
            category = parts[1] or default_category
    else:
        if len(parts) > 1 and parts[1]:
            category = parts[1]
        if len(parts) > 2 and parts[2]:
            unit = parts[2]
        if len(parts) > 3 and parts[3]:
            low_stock_threshold = parts[3]
        if len(parts) > 4 and parts[4]:
            price = parts[4]

    return {
        "name": name,
        "category": category,
        "unit": unit,
        "low_stock_threshold": low_stock_threshold,
        "price": price,
    }


def import_products_from_file(
    store: Any,
    file_path: Path,
    default_category: str = "Đồ chay",
    default_unit: str = "gói",
    default_threshold: float = 5,
    default_price: float = 0,
) -> dict:
    if not file_path.exists():
        raise FileNotFoundError(f"Không tìm thấy file: {file_path}")

    created = 0
    skipped = 0

    for line in file_path.read_text(encoding="utf-8-sig").splitlines():
        product_seed = parse_seed_line(
            line,
            default_category,
            default_unit,
            default_threshold,
            default_price,
        )
        if not product_seed:
            continue

        if store.create_product_if_missing(**product_seed):
            created += 1
        else:
            skipped += 1

    return {
        "file_path": str(file_path),
        "created": created,
        "skipped": skipped,
        "total_products": store.get_summary()["product_count"],
    }

