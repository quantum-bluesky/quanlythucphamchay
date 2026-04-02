import hashlib
import json
import secrets
import shutil
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from tempfile import NamedTemporaryFile

from .constants import BACKUP_DIR, DATA_DIR
from .helpers import (
    extract_cost_from_note,
    extract_price_from_note,
    month_key,
    normalize_key,
    parse_date_key,
    parse_non_negative_decimal,
    parse_month_key,
    parse_positive_decimal,
    shift_month,
    utc_now_iso,
)
class InventoryStore:
    SYNC_COLLECTION_KEYS = ("customers", "suppliers", "carts", "purchases")

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

    @contextmanager
    def _connect(self):
        connection = sqlite3.connect(str(self.db_path))
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

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
                    sale_price REAL NOT NULL DEFAULT 0,
                    low_stock_threshold REAL NOT NULL DEFAULT 5,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    deleted_at TEXT,
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

                CREATE TABLE IF NOT EXISTS app_state (
                    state_key TEXT PRIMARY KEY,
                    state_value TEXT NOT NULL DEFAULT '[]',
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    entity_name TEXT NOT NULL DEFAULT '',
                    action TEXT NOT NULL,
                    message TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
                ON audit_logs(entity_type, created_at DESC);
                """
            )
            columns = {
                row["name"] for row in connection.execute("PRAGMA table_info(products)").fetchall()
            }
            if "price" not in columns:
                connection.execute(
                    "ALTER TABLE products ADD COLUMN price REAL NOT NULL DEFAULT 0"
                )
            if "sale_price" not in columns:
                connection.execute(
                    "ALTER TABLE products ADD COLUMN sale_price REAL NOT NULL DEFAULT 0"
                )
                connection.execute(
                    "UPDATE products SET sale_price = price WHERE sale_price = 0"
                )
            if "is_deleted" not in columns:
                connection.execute(
                    "ALTER TABLE products ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0"
                )
            if "deleted_at" not in columns:
                connection.execute(
                    "ALTER TABLE products ADD COLUMN deleted_at TEXT"
                )
            now = utc_now_iso()
            for key in self.SYNC_COLLECTION_KEYS:
                connection.execute(
                    """
                    INSERT OR IGNORE INTO app_state(state_key, state_value, updated_at)
                    VALUES(?, '[]', ?)
                    """,
                    (key, now),
                )

    def _get_product_or_raise(
        self,
        connection: sqlite3.Connection,
        product_id: int,
        *,
        allow_deleted: bool = False,
    ) -> sqlite3.Row:
        product = connection.execute(
            """
            SELECT id, name, category, unit, price, sale_price, low_stock_threshold, is_deleted, deleted_at
            FROM products
            WHERE id = ?
            """,
            (product_id,),
        ).fetchone()
        if not product:
            raise ValueError("Sản phẩm không tồn tại.")
        if not allow_deleted and int(product["is_deleted"] or 0) == 1:
            raise ValueError("Sản phẩm đã bị xóa khỏi danh mục đang dùng.")
        return product

    def _record_audit(
        self,
        connection: sqlite3.Connection,
        *,
        entity_type: str,
        entity_id: str | int,
        entity_name: str,
        action: str,
        message: str = "",
    ) -> None:
        connection.execute(
            """
            INSERT INTO audit_logs(entity_type, entity_id, entity_name, action, message, created_at)
            VALUES(?, ?, ?, ?, ?, ?)
            """,
            (entity_type, str(entity_id), entity_name, action, message, utc_now_iso()),
        )

    def _count_product_sync_usage(self, product_id: int) -> dict:
        carts = self._get_sync_collection("carts")
        purchases = self._get_sync_collection("purchases")

        draft_cart_count = 0
        draft_cart_item_count = 0
        for cart in carts:
            if str(cart.get("status", "draft")) != "draft":
                continue
            matching_items = [
                item for item in cart.get("items", [])
                if int(item.get("productId") or item.get("product_id") or 0) == int(product_id)
            ]
            if matching_items:
                draft_cart_count += 1
                draft_cart_item_count += len(matching_items)

        open_purchase_count = 0
        open_purchase_item_count = 0
        for purchase in purchases:
            if str(purchase.get("status", "draft")) not in {"draft", "ordered"}:
                continue
            matching_items = [
                item for item in purchase.get("items", [])
                if int(item.get("productId") or item.get("product_id") or 0) == int(product_id)
            ]
            if matching_items:
                open_purchase_count += 1
                open_purchase_item_count += len(matching_items)

        return {
            "draft_cart_count": draft_cart_count,
            "draft_cart_item_count": draft_cart_item_count,
            "open_purchase_count": open_purchase_count,
            "open_purchase_item_count": open_purchase_item_count,
        }

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

    def get_products(self, *, include_deleted: bool = False) -> list[dict]:
        with self._connect() as connection:
            sql = """
                SELECT
                    p.id,
                    p.name,
                    p.category,
                    p.unit,
                    p.price,
                    p.sale_price,
                    p.low_stock_threshold,
                    p.is_deleted,
                    p.deleted_at,
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
            """
            params: tuple = ()
            if not include_deleted:
                sql += " WHERE p.is_deleted = 0"
            sql += """
                GROUP BY p.id
                ORDER BY p.is_deleted ASC, p.name COLLATE NOCASE ASC
            """
            rows = connection.execute(sql, params).fetchall()
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
        sale_price: str | int | float | None = None,
    ) -> tuple[str, str, str, float, float, float]:
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
        parsed_price = parse_non_negative_decimal(price or 0, "Giá nhập")
        parsed_sale_price = parse_non_negative_decimal(
            parsed_price if sale_price in (None, "") else sale_price,
            "Giá bán",
        )
        return clean_name, clean_category, clean_unit, float(threshold), float(parsed_price), float(parsed_sale_price)

    def create_product(
        self,
        name: str,
        category: str,
        unit: str,
        low_stock_threshold: str | int | float = 5,
        price: str | int | float = 0,
        sale_price: str | int | float | None = None,
    ) -> dict:
        clean_name, clean_category, clean_unit, threshold, parsed_price, parsed_sale_price = self._prepare_product_inputs(
            name,
            category,
            unit,
            low_stock_threshold,
            price,
            sale_price,
        )
        now = utc_now_iso()

        with self._connect() as connection:
            try:
                cursor = connection.execute(
                    """
                    INSERT INTO products(name, category, unit, price, sale_price, low_stock_threshold, created_at, updated_at)
                    VALUES(?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (clean_name, clean_category, clean_unit, parsed_price, parsed_sale_price, float(threshold), now, now),
                )
            except sqlite3.IntegrityError as exc:
                deleted_match = connection.execute(
                    "SELECT 1 FROM products WHERE name = ? AND is_deleted = 1",
                    (clean_name,),
                ).fetchone()
                if deleted_match:
                    raise ValueError("Tên sản phẩm đang nằm trong danh mục đã xóa. Hãy khôi phục thay vì tạo mới.") from exc
                raise ValueError("Tên sản phẩm đã tồn tại.") from exc

            product_id = cursor.lastrowid
            self._record_audit(
                connection,
                entity_type="product",
                entity_id=product_id,
                entity_name=clean_name,
                action="create",
                message="Tạo mới sản phẩm trong danh mục đang dùng.",
            )

        return self.get_product_by_id(product_id)

    def create_product_if_missing(
        self,
        name: str,
        category: str,
        unit: str,
        low_stock_threshold: str | int | float = 5,
        price: str | int | float = 0,
        sale_price: str | int | float | None = None,
    ) -> bool:
        clean_name, clean_category, clean_unit, threshold, parsed_price, parsed_sale_price = self._prepare_product_inputs(
            name,
            category,
            unit,
            low_stock_threshold,
            price,
            sale_price,
        )
        now = utc_now_iso()

        with self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT OR IGNORE INTO products(name, category, unit, price, sale_price, low_stock_threshold, created_at, updated_at)
                VALUES(?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (clean_name, clean_category, clean_unit, parsed_price, parsed_sale_price, threshold, now, now),
            )
            return cursor.rowcount > 0

    def update_product_price(self, product_id: int, price: str | int | float) -> dict:
        parsed_price = float(parse_non_negative_decimal(price, "Giá nhập"))
        now = utc_now_iso()

        with self._connect() as connection:
            self._get_product_or_raise(connection, int(product_id))
            connection.execute(
                "UPDATE products SET price = ?, updated_at = ? WHERE id = ?",
                (parsed_price, now, int(product_id)),
            )
            product = connection.execute(
                "SELECT name FROM products WHERE id = ?",
                (int(product_id),),
            ).fetchone()
            self._record_audit(
                connection,
                entity_type="product",
                entity_id=product_id,
                entity_name=product["name"],
                action="update-price",
                message=f"Cập nhật giá nhập thành {parsed_price:.0f}.",
            )

        return self.get_product_by_id(int(product_id))

    def update_product_sale_price(self, product_id: int, sale_price: str | int | float) -> dict:
        parsed_sale_price = float(parse_non_negative_decimal(sale_price, "Giá bán"))
        now = utc_now_iso()

        with self._connect() as connection:
            self._get_product_or_raise(connection, int(product_id))
            connection.execute(
                "UPDATE products SET sale_price = ?, updated_at = ? WHERE id = ?",
                (parsed_sale_price, now, int(product_id)),
            )
            product = connection.execute(
                "SELECT name FROM products WHERE id = ?",
                (int(product_id),),
            ).fetchone()
            self._record_audit(
                connection,
                entity_type="product",
                entity_id=product_id,
                entity_name=product["name"],
                action="update-sale-price",
                message=f"Cập nhật giá bán thành {parsed_sale_price:.0f}.",
            )

        return self.get_product_by_id(int(product_id))

    def update_product(
        self,
        product_id: int,
        name: str,
        category: str,
        unit: str,
        low_stock_threshold: str | int | float,
        price: str | int | float = 0,
        sale_price: str | int | float | None = None,
    ) -> dict:
        clean_name, clean_category, clean_unit, threshold, parsed_price, parsed_sale_price = self._prepare_product_inputs(
            name,
            category,
            unit,
            low_stock_threshold,
            price,
            sale_price,
        )
        now = utc_now_iso()

        with self._connect() as connection:
            current_product = self._get_product_or_raise(connection, int(product_id))
            try:
                connection.execute(
                    """
                    UPDATE products
                    SET name = ?, category = ?, unit = ?, price = ?, sale_price = ?, low_stock_threshold = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        clean_name,
                        clean_category,
                        clean_unit,
                        parsed_price,
                        parsed_sale_price,
                        threshold,
                        now,
                        int(product_id),
                    ),
                )
            except sqlite3.IntegrityError as exc:
                deleted_match = connection.execute(
                    "SELECT 1 FROM products WHERE name = ? AND is_deleted = 1 AND id != ?",
                    (clean_name, int(product_id)),
                ).fetchone()
                if deleted_match:
                    raise ValueError("Tên sản phẩm trùng với một sản phẩm đang nằm trong danh mục đã xóa.") from exc
                raise ValueError("Tên sản phẩm đã tồn tại.") from exc
            self._record_audit(
                connection,
                entity_type="product",
                entity_id=product_id,
                entity_name=clean_name,
                action="update",
                message=f"Cập nhật từ {current_product['name']} sang {clean_name}.",
            )

        return self.get_product_by_id(int(product_id))

    def delete_product(self, product_id: int) -> dict:
        with self._connect() as connection:
            product = self._get_product_or_raise(connection, int(product_id))
            current_stock = float(self._get_stock_for_product(connection, int(product_id)))
            sync_usage = self._count_product_sync_usage(int(product_id))
            impacts = [
                "Sản phẩm sẽ bị ẩn khỏi tồn kho, tạo đơn, nhập hàng và danh mục đang dùng.",
                "Lịch sử giao dịch cũ vẫn được giữ lại.",
            ]
            if current_stock > 0:
                raise ValueError("Chỉ được xóa sản phẩm khi tồn kho hiện tại bằng 0.")
            if sync_usage["draft_cart_count"] > 0:
                raise ValueError("Sản phẩm đang nằm trong giỏ hàng nháp, không thể xóa.")
            if sync_usage["open_purchase_count"] > 0:
                raise ValueError("Sản phẩm đang nằm trong phiếu nhập draft/ordered, không thể xóa.")

            now = utc_now_iso()
            connection.execute(
                """
                UPDATE products
                SET is_deleted = 1, deleted_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (now, now, int(product_id)),
            )
            self._record_audit(
                connection,
                entity_type="product",
                entity_id=product_id,
                entity_name=product["name"],
                action="delete",
                message="Đưa sản phẩm vào danh mục đã xóa.",
            )
            return {
                "product_id": int(product_id),
                "product_name": product["name"],
                "impacts": impacts,
            }

    def restore_product(self, product_id: int) -> dict:
        with self._connect() as connection:
            product = self._get_product_or_raise(connection, int(product_id), allow_deleted=True)
            if int(product["is_deleted"] or 0) == 0:
                raise ValueError("Sản phẩm đang ở trạng thái hoạt động.")

            active_name_conflict = connection.execute(
                "SELECT 1 FROM products WHERE name = ? AND is_deleted = 0 AND id != ? LIMIT 1",
                (product["name"], int(product_id)),
            ).fetchone()
            if active_name_conflict:
                raise ValueError("Đang có sản phẩm hoạt động khác trùng tên, không thể khôi phục.")

            now = utc_now_iso()
            connection.execute(
                """
                UPDATE products
                SET is_deleted = 0, deleted_at = NULL, updated_at = ?
                WHERE id = ?
                """,
                (now, int(product_id)),
            )
            self._record_audit(
                connection,
                entity_type="product",
                entity_id=product_id,
                entity_name=product["name"],
                action="restore",
                message="Khôi phục sản phẩm về danh mục đang dùng.",
            )
        return self.get_product_by_id(int(product_id))

    def get_deleted_products(self) -> list[dict]:
        return [product for product in self.get_products(include_deleted=True) if product["is_deleted"]]

    def get_product_history(self, limit: int = 40) -> list[dict]:
        safe_limit = max(1, min(int(limit), 200))
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, entity_id, entity_name, action, message, created_at
                FROM audit_logs
                WHERE entity_type = 'product'
                ORDER BY created_at DESC, id DESC
                LIMIT ?
                """,
                (safe_limit,),
            ).fetchall()
        return [
            {
                "id": row["id"],
                "product_id": int(row["entity_id"]),
                "product_name": row["entity_name"],
                "action": row["action"],
                "message": row["message"],
                "created_at": row["created_at"],
            }
            for row in rows
        ]

    def reset_all_data(self) -> None:
        with self._connect() as connection:
            connection.execute("DELETE FROM transactions")
            connection.execute("DELETE FROM audit_logs")
            connection.execute("DELETE FROM products")
            connection.execute("DELETE FROM sqlite_sequence WHERE name IN ('products', 'transactions', 'audit_logs')")

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
                    p.sale_price,
                    p.low_stock_threshold,
                    p.is_deleted,
                    p.deleted_at,
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
                WHERE p.id = ? AND p.is_deleted = 0
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

    def create_checkout_order(
        self,
        customer_name: str,
        items: list[dict],
        note: str = "",
    ) -> dict:
        clean_customer_name = (customer_name or "").strip()
        clean_note = (note or "").strip()
        if not clean_customer_name:
            raise ValueError("Khách hàng là bắt buộc.")
        if not items:
            raise ValueError("Giỏ hàng đang trống.")

        grouped_items: dict[int, dict] = {}
        for raw_item in items:
            product_id = int(raw_item.get("product_id", 0))
            quantity = parse_positive_decimal(raw_item.get("quantity"), "Số lượng")
            unit_price = parse_non_negative_decimal(raw_item.get("unit_price", 0), "Giá bán")
            item_note = (raw_item.get("note", "") or "").strip()

            existing = grouped_items.get(product_id)
            if existing:
                existing["quantity"] += quantity
                existing["unit_price"] = unit_price
                if item_note:
                    existing["note"] = item_note
            else:
                grouped_items[product_id] = {
                    "product_id": product_id,
                    "quantity": quantity,
                    "unit_price": unit_price,
                    "note": item_note,
                }

        now = utc_now_iso()
        order_suffix = hashlib.sha1(f"{clean_customer_name}-{now}".encode("utf-8")).hexdigest()[:6]
        order_code = f"DH-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{order_suffix}"

        with self._connect() as connection:
            products_by_id: dict[int, sqlite3.Row] = {}
            current_stock_by_id: dict[int, Decimal] = {}

            for product_id, item in grouped_items.items():
                product = self._get_product_or_raise(connection, product_id)
                current_stock = self._get_stock_for_product(connection, product_id)
                if item["quantity"] > current_stock:
                    raise ValueError(
                        f"Số lượng xuất của {product['name']} lớn hơn tồn kho hiện tại."
                    )
                products_by_id[product_id] = product
                current_stock_by_id[product_id] = current_stock

            transactions = []
            total_amount = Decimal("0")
            total_quantity = Decimal("0")

            for product_id, item in grouped_items.items():
                product = products_by_id[product_id]
                line_total = item["quantity"] * item["unit_price"]
                total_amount += line_total
                total_quantity += item["quantity"]
                unit_cost_snapshot = float(product["price"])
                transaction_note = (
                    f"Đơn {order_code} | Khách: {clean_customer_name} | Giá bán: {float(item['unit_price']):.0f} | Giá vốn: {unit_cost_snapshot:.0f}"
                )
                if clean_note:
                    transaction_note += f" | {clean_note}"
                if item["note"]:
                    transaction_note += f" | {item['note']}"

                cursor = connection.execute(
                    """
                    INSERT INTO transactions(product_id, transaction_type, quantity, note, created_at)
                    VALUES(?, 'out', ?, ?, ?)
                    """,
                    (product_id, float(item["quantity"]), transaction_note, now),
                )

                remaining_stock = current_stock_by_id[product_id] - item["quantity"]
                transactions.append(
                    {
                        "id": cursor.lastrowid,
                        "product_id": product_id,
                        "product_name": product["name"],
                        "unit": product["unit"],
                        "quantity": float(item["quantity"]),
                        "unit_price": float(item["unit_price"]),
                        "line_total": round(float(line_total), 2),
                        "note": item["note"],
                        "remaining_stock": round(float(remaining_stock), 2),
                    }
                )

        return {
            "order_code": order_code,
            "customer_name": clean_customer_name,
            "created_at": now,
            "transactions": transactions,
            "total_quantity": round(float(total_quantity), 2),
            "total_amount": round(float(total_amount), 2),
        }

    def create_purchase_receipt(
        self,
        items: list[dict],
        note: str = "",
        supplier_name: str = "",
    ) -> dict:
        clean_note = (note or "").strip()
        clean_supplier_name = (supplier_name or "").strip()
        if not items:
            raise ValueError("Phiếu nhập đang trống.")

        grouped_items: dict[int, dict] = {}
        for raw_item in items:
            product_id = int(raw_item.get("product_id", 0))
            quantity = parse_positive_decimal(raw_item.get("quantity"), "Số lượng")
            unit_cost = parse_non_negative_decimal(raw_item.get("unit_cost", 0), "Giá nhập")

            existing = grouped_items.get(product_id)
            if existing:
                existing["quantity"] += quantity
                existing["unit_cost"] = unit_cost
            else:
                grouped_items[product_id] = {
                    "product_id": product_id,
                    "quantity": quantity,
                    "unit_cost": unit_cost,
                }

        now = utc_now_iso()
        receipt_suffix = hashlib.sha1(f"{clean_supplier_name}-{clean_note}-{now}".encode("utf-8")).hexdigest()[:6]
        receipt_code = f"PN-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{receipt_suffix}"

        with self._connect() as connection:
            transactions = []
            total_amount = Decimal("0")
            total_quantity = Decimal("0")

            for product_id, item in grouped_items.items():
                product = self._get_product_or_raise(connection, product_id)
                line_total = item["quantity"] * item["unit_cost"]
                total_amount += line_total
                total_quantity += item["quantity"]

                transaction_note = f"Phiếu nhập {receipt_code}"
                if clean_supplier_name:
                    transaction_note += f" | NCC: {clean_supplier_name}"
                if clean_note:
                    transaction_note += f" | {clean_note}"
                transaction_note += f" | Giá nhập: {float(item['unit_cost']):.0f}"

                cursor = connection.execute(
                    """
                    INSERT INTO transactions(product_id, transaction_type, quantity, note, created_at)
                    VALUES(?, 'in', ?, ?, ?)
                    """,
                    (product_id, float(item["quantity"]), transaction_note, now),
                )

                connection.execute(
                    "UPDATE products SET price = ?, updated_at = ? WHERE id = ?",
                    (float(item["unit_cost"]), now, product_id),
                )

                current_stock = self._get_stock_for_product(connection, product_id)
                transactions.append(
                    {
                        "id": cursor.lastrowid,
                        "product_id": product_id,
                        "product_name": product["name"],
                        "unit": product["unit"],
                        "quantity": float(item["quantity"]),
                        "unit_cost": float(item["unit_cost"]),
                        "line_total": round(float(line_total), 2),
                        "current_stock": round(float(current_stock), 2),
                    }
                )

        return {
            "receipt_code": receipt_code,
            "supplier_name": clean_supplier_name,
            "created_at": now,
            "transactions": transactions,
            "total_quantity": round(float(total_quantity), 2),
            "total_amount": round(float(total_amount), 2),
        }

    def _serialize_product_row(self, row: sqlite3.Row) -> dict:
        current_stock = round(float(row["current_stock"]), 2)
        threshold = round(float(row["low_stock_threshold"]), 2)
        return {
            "id": row["id"],
            "name": row["name"],
            "category": row["category"],
            "unit": row["unit"],
            "price": round(float(row["price"]), 2),
            "sale_price": round(float(row["sale_price"]), 2),
            "low_stock_threshold": threshold,
            "current_stock": current_stock,
            "inventory_value": round(current_stock * float(row["price"]), 2),
            "is_low_stock": current_stock <= threshold,
            "is_deleted": bool(row["is_deleted"]),
            "deleted_at": row["deleted_at"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    def get_sync_state(self) -> dict:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT state_key, state_value, updated_at
                FROM app_state
                WHERE state_key IN (?, ?, ?, ?)
                """,
                self.SYNC_COLLECTION_KEYS,
            ).fetchall()

        collections: dict[str, list] = {key: [] for key in self.SYNC_COLLECTION_KEYS}
        updated_at: dict[str, str] = {}

        for row in rows:
            try:
                decoded = json.loads(row["state_value"] or "[]")
            except json.JSONDecodeError:
                decoded = []
            collections[row["state_key"]] = decoded if isinstance(decoded, list) else []
            updated_at[row["state_key"]] = row["updated_at"]

        collections["updated_at"] = updated_at
        return collections

    def save_sync_state(self, payload: dict) -> dict:
        allowed_keys = set(self.SYNC_COLLECTION_KEYS)
        to_update = {
            key: payload[key]
            for key in payload
            if key in allowed_keys
        }
        if not to_update:
            raise ValueError("Không có dữ liệu đồng bộ hợp lệ.")

        now = utc_now_iso()
        with self._connect() as connection:
            for key, value in to_update.items():
                if not isinstance(value, list):
                    raise ValueError(f"Dữ liệu {key} phải là một danh sách.")
                connection.execute(
                    """
                    UPDATE app_state
                    SET state_value = ?, updated_at = ?
                    WHERE state_key = ?
                    """,
                    (json.dumps(value, ensure_ascii=False), now, key),
                )

        return self.get_sync_state()

    def _get_sync_collection(self, state_key: str) -> list[dict]:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT state_value FROM app_state WHERE state_key = ?",
                (state_key,),
            ).fetchone()

        if not row:
            return []
        try:
            decoded = json.loads(row["state_value"] or "[]")
        except json.JSONDecodeError:
            return []
        return decoded if isinstance(decoded, list) else []

    def export_master_data(self, entity_type: str) -> dict:
        if entity_type == "products":
            records = self.get_products(include_deleted=True)
        elif entity_type in {"customers", "suppliers"}:
            records = self._get_sync_collection(entity_type)
        else:
            raise ValueError("Loại dữ liệu master không hợp lệ.")

        return {
            "entity_type": entity_type,
            "exported_at": utc_now_iso(),
            "record_count": len(records),
            "records": records,
        }

    def import_master_data(self, entity_type: str, records: list[dict]) -> dict:
        if not isinstance(records, list):
            raise ValueError("File import phải chứa danh sách records.")

        if entity_type == "products":
            return self._import_products_master(records)
        if entity_type in {"customers", "suppliers"}:
            return self._import_sync_master(entity_type, records)
        raise ValueError("Loại dữ liệu master không hợp lệ.")

    def _import_products_master(self, records: list[dict]) -> dict:
        summary = {"created": 0, "updated": 0, "restored": 0, "skipped": 0}
        products = self.get_products(include_deleted=True)
        by_name = {normalize_key(product["name"]): product for product in products}

        for record in records:
            name = str(record.get("name") or "").strip()
            category = str(record.get("category") or "Đồ chay").strip()
            unit = str(record.get("unit") or "gói").strip()
            price = record.get("price", 0)
            threshold = record.get("low_stock_threshold", 5)
            if not name:
                summary["skipped"] += 1
                continue

            existing = by_name.get(normalize_key(name))
            if existing:
                if existing.get("is_deleted"):
                    self.restore_product(existing["id"])
                    summary["restored"] += 1
                self.update_product(
                    existing["id"],
                    name=name,
                    category=category,
                    unit=unit,
                    price=price,
                    sale_price=record.get("sale_price"),
                    low_stock_threshold=threshold,
                )
                summary["updated"] += 1
                by_name[normalize_key(name)] = self.get_product_by_id(existing["id"])
            else:
                created = self.create_product(
                    name=name,
                    category=category,
                    unit=unit,
                    price=price,
                    sale_price=record.get("sale_price"),
                    low_stock_threshold=threshold,
                )
                summary["created"] += 1
                by_name[normalize_key(name)] = created

        return summary

    def _import_sync_master(self, state_key: str, records: list[dict]) -> dict:
        existing = self._get_sync_collection(state_key)
        active_items = {normalize_key(item.get("name")): item for item in existing if item.get("name")}
        summary = {"created": 0, "updated": 0, "restored": 0, "skipped": 0}

        for record in records:
            name = str(record.get("name") or "").strip()
            if not name:
                summary["skipped"] += 1
                continue
            normalized = normalize_key(name)
            previous = active_items.get(normalized)
            payload = {
                **(previous or {}),
                **record,
                "id": (previous or {}).get("id") or record.get("id") or f"{state_key}_{secrets.token_hex(6)}",
                "name": name,
                "deletedAt": None,
                "deleted_at": None,
                "updatedAt": utc_now_iso(),
            }
            if not previous:
                payload["createdAt"] = record.get("createdAt") or utc_now_iso()
                summary["created"] += 1
            else:
                if previous.get("deletedAt") or previous.get("deleted_at"):
                    summary["restored"] += 1
                summary["updated"] += 1
            active_items[normalized] = payload

        merged = list(active_items.values())
        self.save_sync_state({state_key: merged})
        return summary

    def create_database_backup(self) -> Path:
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup_path = BACKUP_DIR / f"inventory-backup-{timestamp}.db"
        shutil.copy2(self.db_path, backup_path)
        return backup_path

    def restore_database_from_bytes(self, payload: bytes) -> Path:
        if not payload.startswith(b"SQLite format 3"):
            raise ValueError("File restore không phải SQLite database hợp lệ.")

        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        with NamedTemporaryFile(delete=False, suffix=".db", dir=str(BACKUP_DIR)) as handle:
            handle.write(payload)
            temp_path = Path(handle.name)

        try:
            with sqlite3.connect(str(temp_path)) as connection:
                required_tables = {"products", "transactions", "app_state"}
                rows = connection.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table'"
                ).fetchall()
                table_names = {row[0] for row in rows}
                if not required_tables.issubset(table_names):
                    raise ValueError("File restore không chứa đủ cấu trúc hệ thống.")

            backup_path = self.create_database_backup()
            shutil.copy2(temp_path, self.db_path)
            self._initialize_schema()
            return backup_path
        finally:
            try:
                temp_path.unlink(missing_ok=True)
            except PermissionError:
                pass

    def get_monthly_report(
        self,
        months: int = 6,
        focus_month: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> dict:
        safe_months = max(3, min(int(months), 24))
        now = datetime.now()
        parsed_focus = parse_month_key(focus_month)
        if parsed_focus:
            focus_year, focus_month_number = parsed_focus
        else:
            focus_year, focus_month_number = now.year, now.month

        parsed_start = parse_date_key(start_date)
        parsed_end = parse_date_key(end_date)
        if bool(parsed_start) != bool(parsed_end):
            raise ValueError("Cần chọn đủ Từ ngày và Đến ngày để lọc báo cáo.")
        if parsed_start and parsed_end and parsed_start > parsed_end:
            raise ValueError("Từ ngày không được lớn hơn Đến ngày.")

        is_date_filtered = bool(parsed_start and parsed_end)
        focus_key = month_key(focus_year, focus_month_number)

        if is_date_filtered:
            month_keys: list[str] = []
            cursor_year = parsed_start.year
            cursor_month = parsed_start.month
            end_month_key = month_key(parsed_end.year, parsed_end.month)
            while True:
                current_key = month_key(cursor_year, cursor_month)
                month_keys.append(current_key)
                if current_key == end_month_key:
                    break
                cursor_year, cursor_month = shift_month(cursor_year, cursor_month, 1)

            if focus_key not in month_keys:
                focus_key = month_keys[-1]

            where_clause = "substr(t.created_at, 1, 10) >= ? AND substr(t.created_at, 1, 10) <= ?"
            query_params = (parsed_start.isoformat(), parsed_end.isoformat())
        else:
            month_keys = []
            for offset in range(-(safe_months - 1), 1):
                year, month = shift_month(focus_year, focus_month_number, offset)
                month_keys.append(month_key(year, month))

            start_month = month_keys[0]
            where_clause = "substr(t.created_at, 1, 7) >= ?"
            query_params = (start_month,)

        avg_month_keys = month_keys[-min(3, len(month_keys)):]

        with self._connect() as connection:
            rows = connection.execute(
                f"""
                SELECT
                    t.id,
                    t.product_id,
                    p.name AS product_name,
                    p.category,
                    p.unit,
                    p.price,
                    p.sale_price,
                    p.low_stock_threshold,
                    t.transaction_type,
                    t.quantity,
                    t.note,
                    t.created_at,
                    substr(t.created_at, 1, 7) AS month_key
                FROM transactions t
                INNER JOIN products p ON p.id = t.product_id
                WHERE {where_clause}
                ORDER BY t.created_at DESC, t.id DESC
                """,
                query_params,
            ).fetchall()

        def blank_bucket(month_value: str) -> dict:
            return {
                "month": month_value,
                "in_quantity": 0.0,
                "out_quantity": 0.0,
                "purchase_value": 0.0,
                "revenue_value": 0.0,
                "cogs_value": 0.0,
                "gross_profit_value": 0.0,
                "in_value": 0.0,
                "out_value": 0.0,
                "net_value": 0.0,
            }

        monthly_totals = {key: blank_bucket(key) for key in month_keys}
        focus_products: dict[int, dict] = {}
        monthly_out_by_product: dict[str, dict[int, float]] = {key: {} for key in avg_month_keys}

        for row in rows:
            row_month = row["month_key"]
            if row_month not in monthly_totals:
                continue

            quantity = float(row["quantity"])
            fallback_price = float(row["price"])
            fallback_sale_price = float(row["sale_price"])
            note = row["note"] or ""

            purchase_unit_cost = extract_price_from_note(note, "in")
            sale_unit_price = extract_price_from_note(note, "out")
            sale_unit_cost = extract_cost_from_note(note)
            if purchase_unit_cost is None:
                purchase_unit_cost = fallback_price
            if sale_unit_price is None:
                sale_unit_price = fallback_sale_price
            if sale_unit_cost is None:
                sale_unit_cost = fallback_price

            purchase_amount = round(quantity * purchase_unit_cost, 2)
            revenue_amount = round(quantity * sale_unit_price, 2)
            cogs_amount = round(quantity * sale_unit_cost, 2)
            gross_profit_amount = round(revenue_amount - cogs_amount, 2)

            bucket = monthly_totals[row_month]
            if row["transaction_type"] == "in":
                bucket["in_quantity"] += quantity
                bucket["purchase_value"] += purchase_amount
                bucket["in_value"] += purchase_amount
            else:
                bucket["out_quantity"] += quantity
                bucket["revenue_value"] += revenue_amount
                bucket["cogs_value"] += cogs_amount
                bucket["gross_profit_value"] += gross_profit_amount
                bucket["out_value"] += revenue_amount
                bucket["net_value"] += gross_profit_amount
                if row_month in monthly_out_by_product:
                    current = monthly_out_by_product[row_month].get(row["product_id"], 0.0)
                    monthly_out_by_product[row_month][row["product_id"]] = current + quantity

            include_in_focus = is_date_filtered or row_month == focus_key
            if include_in_focus:
                product_entry = focus_products.setdefault(
                    row["product_id"],
                    {
                        "product_id": row["product_id"],
                        "name": row["product_name"],
                        "category": row["category"],
                        "unit": row["unit"],
                        "current_stock": 0.0,
                        "in_quantity": 0.0,
                        "out_quantity": 0.0,
                        "purchase_value": 0.0,
                        "revenue_value": 0.0,
                        "cogs_value": 0.0,
                        "gross_profit_value": 0.0,
                        "in_value": 0.0,
                        "out_value": 0.0,
                        "net_value": 0.0,
                    },
                )
                if row["transaction_type"] == "in":
                    product_entry["in_quantity"] += quantity
                    product_entry["purchase_value"] += purchase_amount
                    product_entry["in_value"] += purchase_amount
                else:
                    product_entry["out_quantity"] += quantity
                    product_entry["revenue_value"] += revenue_amount
                    product_entry["cogs_value"] += cogs_amount
                    product_entry["gross_profit_value"] += gross_profit_amount
                    product_entry["out_value"] += revenue_amount
                    product_entry["net_value"] += gross_profit_amount

        products = self.get_products()
        products_by_id = {product["id"]: product for product in products}
        for product_entry in focus_products.values():
            product_entry["current_stock"] = products_by_id.get(product_entry["product_id"], {}).get("current_stock", 0)

        draft_carts = [
            cart for cart in self._get_sync_collection("carts")
            if str(cart.get("status", "draft")) == "draft"
        ]
        pending_demand_by_product: dict[int, float] = {}
        for cart in draft_carts:
            for item in cart.get("items", []):
                product_id = int(item.get("productId") or item.get("product_id") or 0)
                if not product_id:
                    continue
                pending_demand_by_product[product_id] = pending_demand_by_product.get(product_id, 0.0) + float(item.get("quantity", 0) or 0)

        open_purchases = [
            purchase for purchase in self._get_sync_collection("purchases")
            if str(purchase.get("status", "draft")) in {"draft", "ordered"}
        ]
        incoming_by_product: dict[int, float] = {}
        for purchase in open_purchases:
            for item in purchase.get("items", []):
                product_id = int(item.get("productId") or item.get("product_id") or 0)
                if not product_id:
                    continue
                incoming_by_product[product_id] = incoming_by_product.get(product_id, 0.0) + float(item.get("quantity", 0) or 0)

        forecast_items = []
        for product in products:
            product_id = int(product["id"])
            monthly_out_values = [
                monthly_out_by_product.get(key, {}).get(product_id, 0.0)
                for key in avg_month_keys
            ]
            avg_monthly_out = round(sum(monthly_out_values) / len(avg_month_keys), 2) if avg_month_keys else 0.0
            max_recent_out = round(max(monthly_out_values), 2) if monthly_out_values else 0.0
            pending_demand = round(pending_demand_by_product.get(product_id, 0.0), 2)
            incoming_qty = round(incoming_by_product.get(product_id, 0.0), 2)
            target_stock = max(
                float(product["low_stock_threshold"]),
                avg_monthly_out + pending_demand,
                max_recent_out,
            )
            recommended_purchase = round(
                max(0.0, target_stock - float(product["current_stock"]) - incoming_qty),
                2,
            )
            if recommended_purchase <= 0 and pending_demand <= 0 and not product["is_low_stock"]:
                continue

            reasons = []
            if pending_demand > 0:
                reasons.append(f"đơn chờ {pending_demand:g} {product['unit']}")
            if avg_monthly_out > 0:
                reasons.append(f"xuất TB {len(avg_month_keys)} tháng {avg_monthly_out:g} {product['unit']}")
            if float(product["current_stock"]) <= float(product["low_stock_threshold"]):
                reasons.append("tồn đang thấp")
            if incoming_qty > 0:
                reasons.append(f"đang chờ nhập {incoming_qty:g} {product['unit']}")

            forecast_items.append(
                {
                    "product_id": product_id,
                    "name": product["name"],
                    "category": product["category"],
                    "unit": product["unit"],
                    "current_stock": product["current_stock"],
                    "low_stock_threshold": product["low_stock_threshold"],
                    "avg_monthly_out": avg_monthly_out,
                    "max_recent_out": max_recent_out,
                    "pending_demand": pending_demand,
                    "incoming_quantity": incoming_qty,
                    "recommended_purchase": recommended_purchase,
                    "reason": ", ".join(reasons) if reasons else "theo ngưỡng tồn kho",
                }
            )

        forecast_items.sort(
            key=lambda item: (
                -float(item["recommended_purchase"]),
                -float(item["pending_demand"]),
                item["name"].lower(),
            )
        )

        months_payload = []
        for key in month_keys:
            bucket = monthly_totals[key]
            bucket["in_quantity"] = round(bucket["in_quantity"], 2)
            bucket["out_quantity"] = round(bucket["out_quantity"], 2)
            bucket["purchase_value"] = round(bucket["purchase_value"], 2)
            bucket["revenue_value"] = round(bucket["revenue_value"], 2)
            bucket["cogs_value"] = round(bucket["cogs_value"], 2)
            bucket["gross_profit_value"] = round(bucket["gross_profit_value"], 2)
            bucket["in_value"] = round(bucket["in_value"], 2)
            bucket["out_value"] = round(bucket["out_value"], 2)
            bucket["net_quantity"] = round(bucket["in_quantity"] - bucket["out_quantity"], 2)
            bucket["net_value"] = round(bucket["net_value"], 2)
            months_payload.append(bucket)

        def build_summary_from_buckets(buckets: list[dict], month_value: str | None = None) -> dict:
            summary = blank_bucket(month_value or "")
            summary["months"] = len(buckets)
            summary["in_quantity"] = round(sum(bucket["in_quantity"] for bucket in buckets), 2)
            summary["out_quantity"] = round(sum(bucket["out_quantity"] for bucket in buckets), 2)
            summary["purchase_value"] = round(sum(bucket["purchase_value"] for bucket in buckets), 2)
            summary["revenue_value"] = round(sum(bucket["revenue_value"] for bucket in buckets), 2)
            summary["cogs_value"] = round(sum(bucket["cogs_value"] for bucket in buckets), 2)
            summary["gross_profit_value"] = round(sum(bucket["gross_profit_value"] for bucket in buckets), 2)
            summary["in_value"] = summary["purchase_value"]
            summary["out_value"] = summary["revenue_value"]
            summary["net_quantity"] = round(summary["in_quantity"] - summary["out_quantity"], 2)
            summary["net_value"] = summary["gross_profit_value"]
            if month_value:
                summary["month"] = month_value
            return summary

        if is_date_filtered:
            focus_summary = build_summary_from_buckets(months_payload)
        else:
            focus_summary = next(
                (bucket for bucket in months_payload if bucket["month"] == focus_key),
                build_summary_from_buckets([], focus_key),
            )

        range_summary = build_summary_from_buckets(months_payload)

        product_activity = sorted(
            focus_products.values(),
            key=lambda item: (
                -(float(item["out_quantity"]) + float(item["in_quantity"])),
                item["name"].lower(),
            ),
        )
        for item in product_activity:
            item["purchase_value"] = round(float(item["purchase_value"]), 2)
            item["revenue_value"] = round(float(item["revenue_value"]), 2)
            item["cogs_value"] = round(float(item["cogs_value"]), 2)
            item["gross_profit_value"] = round(float(item["gross_profit_value"]), 2)
            item["in_value"] = round(float(item["in_value"]), 2)
            item["out_value"] = round(float(item["out_value"]), 2)
            item["net_value"] = round(float(item["net_value"]), 2)

        return {
            "focus_month": focus_key,
            "months": months_payload,
            "focus_summary": focus_summary,
            "range_summary": range_summary,
            "product_activity": product_activity,
            "forecast": forecast_items[:18],
            "date_filter": {
                "active": is_date_filtered,
                "start_date": parsed_start.isoformat() if parsed_start else "",
                "end_date": parsed_end.isoformat() if parsed_end else "",
            },
        }

