import argparse
import json
import hashlib
import mimetypes
import os
import re
import sqlite3
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "inventory.db"
DEFAULT_INIT_FILE = DATA_DIR / "List_price.txt"
DEFAULT_HOST = os.environ.get("APP_HOST", "127.0.0.1")
DEFAULT_PORT = int(os.environ.get("APP_PORT", "8000"))


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


class InventoryStore:
    def __init__(self, db_path: Path):
        requested_path = Path(db_path)
        self.db_path = requested_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            self._initialize_schema()
        except sqlite3.OperationalError:
            # Some sandboxes block OS temp folders. Fall back to a workspace-local file.
            fallback_root = DATA_DIR / "_sandbox_db"
            fallback_root.mkdir(parents=True, exist_ok=True)
            suffix = hashlib.sha1(str(requested_path).encode("utf-8")).hexdigest()[:12]
            self.db_path = fallback_root / f"{suffix}-{requested_path.name}"
            self._initialize_schema()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(str(self.db_path))
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize_schema(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
                    category TEXT NOT NULL,
                    unit TEXT NOT NULL,
                    price REAL NOT NULL DEFAULT 0,
                    low_stock_threshold REAL NOT NULL DEFAULT 5,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    product_id INTEGER NOT NULL,
                    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('in', 'out')),
                    quantity REAL NOT NULL CHECK(quantity > 0),
                    note TEXT DEFAULT '',
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (product_id) REFERENCES products(id)
                );

                CREATE INDEX IF NOT EXISTS idx_transactions_product_id
                ON transactions(product_id);

                CREATE INDEX IF NOT EXISTS idx_transactions_created_at
                ON transactions(created_at DESC);
                """
            )
            columns = {
                row["name"] for row in connection.execute("PRAGMA table_info(products)").fetchall()
            }
            if "price" not in columns:
                connection.execute(
                    "ALTER TABLE products ADD COLUMN price REAL NOT NULL DEFAULT 0"
                )

    def _get_product_or_raise(self, connection: sqlite3.Connection, product_id: int) -> sqlite3.Row:
        product = connection.execute(
            "SELECT id, name, category, unit, price, low_stock_threshold FROM products WHERE id = ?",
            (product_id,),
        ).fetchone()
        if not product:
            raise ValueError("Sản phẩm không tồn tại.")
        return product

    def _get_stock_for_product(self, connection: sqlite3.Connection, product_id: int) -> Decimal:
        row = connection.execute(
            """
            SELECT COALESCE(
                SUM(
                    CASE
                        WHEN transaction_type = 'in' THEN quantity
                        ELSE -quantity
                    END
                ),
                0
            ) AS current_stock
            FROM transactions
            WHERE product_id = ?
            """,
            (product_id,),
        ).fetchone()
        return Decimal(str(row["current_stock"]))

    def get_products(self) -> list[dict]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    p.id,
                    p.name,
                    p.category,
                    p.unit,
                    p.price,
                    p.low_stock_threshold,
                    p.created_at,
                    p.updated_at,
                    COALESCE(
                        SUM(
                            CASE
                                WHEN t.transaction_type = 'in' THEN t.quantity
                                ELSE -t.quantity
                            END
                        ),
                        0
                    ) AS current_stock
                FROM products p
                LEFT JOIN transactions t ON t.product_id = p.id
                GROUP BY p.id
                ORDER BY p.name COLLATE NOCASE ASC
                """
            ).fetchall()
            return [self._serialize_product_row(row) for row in rows]

    def get_summary(self) -> dict:
        products = self.get_products()
        total_stock = sum(product["current_stock"] for product in products)
        total_inventory_value = sum(product["current_stock"] * product["price"] for product in products)
        low_stock_count = sum(1 for product in products if product["is_low_stock"])
        return {
            "product_count": len(products),
            "total_stock": round(total_stock, 2),
            "total_inventory_value": round(total_inventory_value, 2),
            "low_stock_count": low_stock_count,
        }

    def _prepare_product_inputs(
        self,
        name: str,
        category: str,
        unit: str,
        low_stock_threshold: str | int | float,
        price: str | int | float = 0,
    ) -> tuple[str, str, str, float, float]:
        clean_name = (name or "").strip()
        clean_category = (category or "").strip()
        clean_unit = (unit or "").strip()

        if not clean_name:
            raise ValueError("Tên sản phẩm là bắt buộc.")
        if not clean_category:
            raise ValueError("Loại thực phẩm là bắt buộc.")
        if not clean_unit:
            raise ValueError("Đơn vị tính là bắt buộc.")

        threshold = parse_positive_decimal(low_stock_threshold or 5, "Ngưỡng cảnh báo")
        parsed_price = parse_non_negative_decimal(price or 0, "Giá")
        return clean_name, clean_category, clean_unit, float(threshold), float(parsed_price)

    def create_product(
        self,
        name: str,
        category: str,
        unit: str,
        low_stock_threshold: str | int | float = 5,
        price: str | int | float = 0,
    ) -> dict:
        clean_name, clean_category, clean_unit, threshold, parsed_price = self._prepare_product_inputs(
            name,
            category,
            unit,
            low_stock_threshold,
            price,
        )
        now = utc_now_iso()

        with self._connect() as connection:
            try:
                cursor = connection.execute(
                    """
                    INSERT INTO products(name, category, unit, price, low_stock_threshold, created_at, updated_at)
                    VALUES(?, ?, ?, ?, ?, ?, ?)
                    """,
                    (clean_name, clean_category, clean_unit, parsed_price, float(threshold), now, now),
                )
            except sqlite3.IntegrityError as exc:
                raise ValueError("Tên sản phẩm đã tồn tại.") from exc

            product_id = cursor.lastrowid

        return self.get_product_by_id(product_id)

    def create_product_if_missing(
        self,
        name: str,
        category: str,
        unit: str,
        low_stock_threshold: str | int | float = 5,
        price: str | int | float = 0,
    ) -> bool:
        clean_name, clean_category, clean_unit, threshold, parsed_price = self._prepare_product_inputs(
            name,
            category,
            unit,
            low_stock_threshold,
            price,
        )
        now = utc_now_iso()

        with self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT OR IGNORE INTO products(name, category, unit, price, low_stock_threshold, created_at, updated_at)
                VALUES(?, ?, ?, ?, ?, ?, ?)
                """,
                (clean_name, clean_category, clean_unit, parsed_price, threshold, now, now),
            )
            return cursor.rowcount > 0

    def update_product_price(self, product_id: int, price: str | int | float) -> dict:
        parsed_price = float(parse_non_negative_decimal(price, "Giá"))
        now = utc_now_iso()

        with self._connect() as connection:
            self._get_product_or_raise(connection, int(product_id))
            connection.execute(
                "UPDATE products SET price = ?, updated_at = ? WHERE id = ?",
                (parsed_price, now, int(product_id)),
            )

        return self.get_product_by_id(int(product_id))

    def reset_all_data(self) -> None:
        with self._connect() as connection:
            connection.execute("DELETE FROM transactions")
            connection.execute("DELETE FROM products")
            connection.execute("DELETE FROM sqlite_sequence WHERE name IN ('products', 'transactions')")

    def get_product_by_id(self, product_id: int) -> dict:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT
                    p.id,
                    p.name,
                    p.category,
                    p.unit,
                    p.price,
                    p.low_stock_threshold,
                    p.created_at,
                    p.updated_at,
                    COALESCE(
                        SUM(
                            CASE
                                WHEN t.transaction_type = 'in' THEN t.quantity
                                ELSE -t.quantity
                            END
                        ),
                        0
                    ) AS current_stock
                FROM products p
                LEFT JOIN transactions t ON t.product_id = p.id
                WHERE p.id = ?
                GROUP BY p.id
                """,
                (product_id,),
            ).fetchone()
            if not row:
                raise ValueError("Sản phẩm không tồn tại.")
            return self._serialize_product_row(row)

    def create_transaction(
        self,
        product_id: int,
        transaction_type: str,
        quantity,
        note: str = "",
    ) -> dict:
        if transaction_type not in {"in", "out"}:
            raise ValueError("Loại giao dịch không hợp lệ.")

        amount = parse_positive_decimal(quantity, "Số lượng")
        clean_note = (note or "").strip()
        now = utc_now_iso()

        with self._connect() as connection:
            product = self._get_product_or_raise(connection, int(product_id))
            current_stock = self._get_stock_for_product(connection, int(product_id))

            if transaction_type == "out" and amount > current_stock:
                raise ValueError("Số lượng xuất lớn hơn tồn kho hiện tại.")

            cursor = connection.execute(
                """
                INSERT INTO transactions(product_id, transaction_type, quantity, note, created_at)
                VALUES(?, ?, ?, ?, ?)
                """,
                (int(product_id), transaction_type, float(amount), clean_note, now),
            )

        product_summary = self.get_product_by_id(int(product_id))
        return {
            "id": cursor.lastrowid,
            "product_id": int(product_id),
            "product_name": product["name"],
            "transaction_type": transaction_type,
            "quantity": float(amount),
            "note": clean_note,
            "created_at": now,
            "current_stock": product_summary["current_stock"],
        }

    def get_transactions(self, limit: int = 20) -> list[dict]:
        safe_limit = max(1, min(int(limit), 100))
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    t.id,
                    t.product_id,
                    p.name AS product_name,
                    p.unit,
                    t.transaction_type,
                    t.quantity,
                    t.note,
                    t.created_at
                FROM transactions t
                INNER JOIN products p ON p.id = t.product_id
                ORDER BY t.created_at DESC, t.id DESC
                LIMIT ?
                """,
                (safe_limit,),
            ).fetchall()

        return [
            {
                "id": row["id"],
                "product_id": row["product_id"],
                "product_name": row["product_name"],
                "unit": row["unit"],
                "transaction_type": row["transaction_type"],
                "quantity": float(row["quantity"]),
                "note": row["note"] or "",
                "created_at": row["created_at"],
            }
            for row in rows
        ]

    def _serialize_product_row(self, row: sqlite3.Row) -> dict:
        current_stock = round(float(row["current_stock"]), 2)
        threshold = round(float(row["low_stock_threshold"]), 2)
        return {
            "id": row["id"],
            "name": row["name"],
            "category": row["category"],
            "unit": row["unit"],
            "price": round(float(row["price"]), 2),
            "low_stock_threshold": threshold,
            "current_stock": current_stock,
            "inventory_value": round(current_stock * float(row["price"]), 2),
            "is_low_stock": current_stock <= threshold,
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }


def create_handler(store: InventoryStore):
    class InventoryRequestHandler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            parsed = urlparse(self.path)
            route = parsed.path

            if route == "/":
                self._serve_static_file("index.html")
                return

            if route.startswith("/static/"):
                self._serve_static_file(route.removeprefix("/static/"))
                return

            if route == "/api/products":
                self._send_json(
                    HTTPStatus.OK,
                    {"products": store.get_products(), "summary": store.get_summary()},
                )
                return

            if route == "/api/transactions":
                query = parse_qs(parsed.query)
                limit = query.get("limit", ["20"])[0]
                self._send_json(
                    HTTPStatus.OK,
                    {"transactions": store.get_transactions(limit=int(limit))},
                )
                return

            self._send_json(HTTPStatus.NOT_FOUND, {"error": "Không tìm thấy tài nguyên."})

        def do_POST(self) -> None:
            try:
                payload = self._read_json_body()
            except ValueError as exc:
                self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                return

            try:
                if self.path == "/api/products":
                    product = store.create_product(
                        name=payload.get("name"),
                        category=payload.get("category"),
                        unit=payload.get("unit"),
                        price=payload.get("price", 0),
                        low_stock_threshold=payload.get("low_stock_threshold", 5),
                    )
                    self._send_json(
                        HTTPStatus.CREATED,
                        {
                            "message": "Đã thêm sản phẩm.",
                            "product": product,
                            "summary": store.get_summary(),
                        },
                    )
                    return

                if self.path == "/api/transactions":
                    transaction = store.create_transaction(
                        product_id=int(payload.get("product_id", 0)),
                        transaction_type=payload.get("transaction_type"),
                        quantity=payload.get("quantity"),
                        note=payload.get("note", ""),
                    )
                    self._send_json(
                        HTTPStatus.CREATED,
                        {
                            "message": "Đã cập nhật tồn kho.",
                            "transaction": transaction,
                            "summary": store.get_summary(),
                        },
                    )
                    return

                self._send_json(HTTPStatus.NOT_FOUND, {"error": "Không tìm thấy API."})
            except ValueError as exc:
                self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})

        def do_PUT(self) -> None:
            match = re.fullmatch(r"/api/products/(\d+)/price", urlparse(self.path).path)
            if not match:
                self._send_json(HTTPStatus.NOT_FOUND, {"error": "Không tìm thấy API."})
                return

            try:
                payload = self._read_json_body()
                product = store.update_product_price(match.group(1), payload.get("price", 0))
                self._send_json(
                    HTTPStatus.OK,
                    {
                        "message": "Đã cập nhật giá.",
                        "product": product,
                        "summary": store.get_summary(),
                    },
                )
            except ValueError as exc:
                self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})

        def log_message(self, format_string: str, *args) -> None:
            return

        def _read_json_body(self) -> dict:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0:
                raise ValueError("Thiếu dữ liệu gửi lên.")

            raw_body = self.rfile.read(content_length).decode("utf-8")
            try:
                return json.loads(raw_body)
            except json.JSONDecodeError as exc:
                raise ValueError("Dữ liệu JSON không hợp lệ.") from exc

        def _serve_static_file(self, relative_path: str) -> None:
            safe_path = (STATIC_DIR / relative_path).resolve()
            static_root = STATIC_DIR.resolve()
            if not safe_path.is_file() or (static_root not in safe_path.parents and safe_path != static_root):
                self._send_json(HTTPStatus.NOT_FOUND, {"error": "Không tìm thấy file."})
                return

            content_type, _ = mimetypes.guess_type(safe_path.name)
            payload = safe_path.read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", content_type or "application/octet-stream")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def _send_json(self, status: HTTPStatus, payload: dict) -> None:
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

    return InventoryRequestHandler


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
    store: InventoryStore,
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


def run_init_command(
    file_path: str,
    category: str,
    unit: str,
    threshold: float,
    price: float,
    reset: bool,
) -> int:
    seed_path = Path(file_path)
    if not seed_path.is_absolute():
        candidate = BASE_DIR / seed_path
        if candidate.exists():
            seed_path = candidate

    store = InventoryStore(DB_PATH)
    if reset:
        store.reset_all_data()

    result = import_products_from_file(
        store=store,
        file_path=seed_path,
        default_category=category,
        default_unit=unit,
        default_threshold=threshold,
        default_price=price,
    )
    print(
        "Init complete: "
        f"reset={'yes' if reset else 'no'}, "
        f"created {result['created']} products, "
        f"skipped {result['skipped']} duplicates, "
        f"total products {result['total_products']}."
    )
    return 0


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Quản lý tồn kho thực phẩm chay")
    parser.add_argument("--host", default=DEFAULT_HOST, help="Host/IP/domain để bind server")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Port chạy ứng dụng")
    subparsers = parser.add_subparsers(dest="command")

    init_parser = subparsers.add_parser("init", help="Khởi tạo sản phẩm từ file danh sách")
    init_parser.add_argument("--file", default=str(DEFAULT_INIT_FILE))
    init_parser.add_argument("--category", default="Đồ chay")
    init_parser.add_argument("--unit", default="gói")
    init_parser.add_argument("--threshold", type=float, default=5)
    init_parser.add_argument("--price", type=float, default=0)
    init_parser.add_argument("--reset", action="store_true", help="Xóa dữ liệu hiện có trước khi import")

    subparsers.add_parser("serve", help="Chạy web server")

    return parser


def run_server(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT) -> None:
    store = InventoryStore(DB_PATH)
    server = ThreadingHTTPServer((host, port), create_handler(store))
    print(f"Inventory app running at http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
    finally:
        server.server_close()


def main() -> int:
    parser = build_cli_parser()
    args = parser.parse_args()

    if args.command == "init":
        return run_init_command(args.file, args.category, args.unit, args.threshold, args.price, args.reset)

    if args.command == "serve":
        run_server(args.host, args.port)
        return 0

    run_server(args.host, args.port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
