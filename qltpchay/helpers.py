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


def parse_optional_positive_decimal(value, field_name: str) -> Decimal | None:
    if value in (None, ""):
        return None
    text = str(value).strip()
    if not text:
        return None
    return parse_positive_decimal(text, field_name)


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


def resize_image_bytes(image_bytes: bytes, max_dim: int = 1024, quality: int = 85) -> tuple[bytes, str]:
    """Resize image bytes so max(width, height) <= max_dim.
    Returns (optimized_bytes, format_ext).
    Fallback safely to original bytes if PIL is unavailable or if format is unsupported."""
    if not image_bytes:
        return image_bytes, ".jpg"
    try:
        import io
        from PIL import Image, ImageOps
        img = Image.open(io.BytesIO(image_bytes))
        img = ImageOps.exif_transpose(img)

        orig_format = (img.format or "JPEG").upper()
        width, height = img.size

        if width > max_dim or height > max_dim:
            if width >= height:
                new_height = max(1, int(round((height * max_dim) / width)))
                new_width = max_dim
            else:
                new_width = max(1, int(round((width * max_dim) / height)))
                new_height = max_dim
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

        out_io = io.BytesIO()
        if orig_format == "PNG":
            img.save(out_io, format="PNG", optimize=True)
            ext = ".png"
        elif orig_format == "WEBP":
            img.save(out_io, format="WEBP", quality=quality)
            ext = ".webp"
        else:
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            img.save(out_io, format="JPEG", quality=quality, optimize=True)
            ext = ".jpg"

        return out_io.getvalue(), ext
    except Exception:
        return image_bytes, ".jpg"


def optimize_html_embedded_images(html_content: str, max_dim: int = 1024) -> str:
    """Finds all base64 data URLs in img tags and resizes any that exceed max_dim."""
    if not html_content or "data:image/" not in html_content:
        return html_content

    import base64

    pattern = re.compile(r'data:image/([a-zA-Z0-9+]+);base64,([A-Za-z0-9+/=]+)')

    def replacer(match: re.Match) -> str:
        b64_str = match.group(2)
        try:
            raw_bytes = base64.b64decode(b64_str)
            resized_bytes, ext = resize_image_bytes(raw_bytes, max_dim=max_dim)
            if len(resized_bytes) != len(raw_bytes):
                mime = "image/png" if ext == ".png" else ("image/webp" if ext == ".webp" else "image/jpeg")
                new_b64 = base64.b64encode(resized_bytes).decode("ascii")
                return f"data:{mime};base64,{new_b64}"
        except Exception:
            pass
        return match.group(0)

    return pattern.sub(replacer, html_content)

