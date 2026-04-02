import re
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def parse_positive_decimal(value, field_name: str) -> Decimal:
    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError(f"{field_name} không hợp lệ.") from exc

    if number <= 0:
        raise ValueError(f"{field_name} phải lớn hơn 0.")

    return number


def parse_non_negative_decimal(value, field_name: str) -> Decimal:
    try:
        number = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError(f"{field_name} không hợp lệ.") from exc

    if number < 0:
        raise ValueError(f"{field_name} không được nhỏ hơn 0.")

    return number


def parse_month_key(value: str | None) -> tuple[int, int] | None:
    if not value:
        return None
    match = re.fullmatch(r"(\d{4})-(\d{2})", str(value).strip())
    if not match:
        return None
    year = int(match.group(1))
    month = int(match.group(2))
    if month < 1 or month > 12:
        return None
    return year, month


def parse_date_key(value: str | None) -> date | None:
    if value in (None, ""):
        return None
    try:
        return datetime.strptime(str(value).strip(), "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError("Ngày lọc báo cáo không hợp lệ. Định dạng đúng là YYYY-MM-DD.") from exc


def shift_month(year: int, month: int, offset: int) -> tuple[int, int]:
    total = year * 12 + (month - 1) + offset
    return total // 12, total % 12 + 1


def month_key(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def extract_labeled_price(note: str, label: str) -> float | None:
    match = re.search(rf"{label}:\s*([0-9]+(?:\.[0-9]+)?)", note or "")
    if not match:
        return None
    try:
        return float(match.group(1))
    except ValueError:
        return None


def extract_price_from_note(note: str, transaction_type: str) -> float | None:
    label = "Giá bán" if transaction_type == "out" else "Giá nhập"
    return extract_labeled_price(note, label)


def extract_cost_from_note(note: str) -> float | None:
    return extract_labeled_price(note, "Giá vốn")


def normalize_key(value: str | None) -> str:
    return str(value or "").strip().lower()

