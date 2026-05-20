import hashlib
import json
import re
import secrets
import shutil
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from tempfile import NamedTemporaryFile

from .constants import BACKUP_DIR, DATA_DIR
from .helpers import (
    extract_labeled_price,
    extract_cost_from_note,
    extract_price_from_note,
    month_key,
    normalize_key,
    parse_date_key,
    parse_non_negative_decimal,
    parse_month_key,
    parse_optional_positive_decimal,
    parse_positive_decimal,
    shift_month,
    utc_now_iso,
)

PHASE_B_RECEIPT_TYPES = (
    "inventory_adjustment",
    "customer_return",
    "supplier_return",
)


def detect_report_transaction_kind(receipt_type: str | None, note: str) -> str:
    normalized_receipt_type = str(receipt_type or "").strip()
    if normalized_receipt_type:
        return normalized_receipt_type
    clean_note = str(note or "").strip()
    if clean_note.startswith("Phiếu trả khách"):
        return "customer_return"
    if clean_note.startswith("Phiếu trả NCC"):
        return "supplier_return"
    if clean_note.startswith("Phiếu điều chỉnh") or clean_note.startswith("Điều chỉnh trực tiếp bởi"):
        return "inventory_adjustment"
    if clean_note.startswith("Phiếu nhập"):
        return "purchase"
    if clean_note.startswith("Đơn "):
        return "sale"
    return ""


def extract_order_code_from_note(note: str) -> str:
    match = re.search(r"\bDH-\d{8}-\d{6}-[a-f0-9]{6}\b", note or "")
    return match.group(0) if match else ""


class SyncConflictError(ValueError):
    def __init__(self, state_key: str, expected_updated_at: str, actual_updated_at: str):
        self.state_key = state_key
        self.expected_updated_at = expected_updated_at
        self.actual_updated_at = actual_updated_at
        super().__init__(
            f"Dữ liệu {state_key} đã được cập nhật từ máy khác. Vui lòng tải lại trước khi lưu."
        )


class ProcurementBatchStartConflictError(ValueError):
    def __init__(self, message: str, *, conflicts: list[dict] | None = None):
        self.conflicts = conflicts or []
        super().__init__(message)


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
                    shelf_life_days REAL,
                    storage_life_days REAL,
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
                    actor TEXT NOT NULL DEFAULT '',
                    message TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
                ON audit_logs(entity_type, created_at DESC);

                CREATE TABLE IF NOT EXISTS bulk_order_batches (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    request_id TEXT NOT NULL UNIQUE,
                    mode TEXT NOT NULL,
                    actor TEXT NOT NULL DEFAULT '',
                    total_orders INTEGER NOT NULL DEFAULT 0,
                    success_count INTEGER NOT NULL DEFAULT 0,
                    failed_count INTEGER NOT NULL DEFAULT 0,
                    request_payload TEXT NOT NULL DEFAULT '{}',
                    response_payload TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_bulk_order_batches_created_at
                ON bulk_order_batches(created_at DESC);

                CREATE TABLE IF NOT EXISTS customers (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    phone TEXT NOT NULL DEFAULT '',
                    address TEXT NOT NULL DEFAULT '',
                    zalo_url TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    deleted_at TEXT
                );

                CREATE INDEX IF NOT EXISTS idx_customers_name
                ON customers(name COLLATE NOCASE);

                CREATE TABLE IF NOT EXISTS suppliers (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    phone TEXT NOT NULL DEFAULT '',
                    address TEXT NOT NULL DEFAULT '',
                    note TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    deleted_at TEXT
                );

                CREATE INDEX IF NOT EXISTS idx_suppliers_name
                ON suppliers(name COLLATE NOCASE);

                CREATE TABLE IF NOT EXISTS carts (
                    id TEXT PRIMARY KEY,
                    customer_id TEXT NOT NULL DEFAULT '',
                    customer_name TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'draft',
                    payment_status TEXT NOT NULL DEFAULT 'unpaid',
                    discount_amount REAL NOT NULL DEFAULT 0,
                    ship_address TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    committed_at TEXT,
                    completed_at TEXT,
                    cancelled_at TEXT,
                    paid_at TEXT,
                    order_code TEXT NOT NULL DEFAULT ''
                );

                CREATE INDEX IF NOT EXISTS idx_carts_status_updated_at
                ON carts(status, updated_at DESC);

                CREATE TABLE IF NOT EXISTS cart_items (
                    id TEXT PRIMARY KEY,
                    cart_id TEXT NOT NULL,
                    product_id INTEGER NOT NULL DEFAULT 0,
                    product_name TEXT NOT NULL DEFAULT '',
                    quantity REAL NOT NULL DEFAULT 0,
                    unit_price REAL NOT NULL DEFAULT 0,
                    note TEXT NOT NULL DEFAULT '',
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id
                ON cart_items(cart_id, sort_order, id);

                CREATE TABLE IF NOT EXISTS purchases (
                    id TEXT PRIMARY KEY,
                    supplier_id TEXT NOT NULL DEFAULT '',
                    supplier_name TEXT NOT NULL DEFAULT '',
                    note TEXT NOT NULL DEFAULT '',
                    source_type TEXT NOT NULL DEFAULT '',
                    source_code TEXT NOT NULL DEFAULT '',
                    source_name TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'draft',
                    discount_amount REAL NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    ordered_at TEXT,
                    received_at TEXT,
                    paid_at TEXT,
                    receipt_code TEXT NOT NULL DEFAULT ''
                );

                CREATE INDEX IF NOT EXISTS idx_purchases_status_updated_at
                ON purchases(status, updated_at DESC);

                CREATE TABLE IF NOT EXISTS purchase_items (
                    id TEXT PRIMARY KEY,
                    purchase_id TEXT NOT NULL,
                    product_id INTEGER NOT NULL DEFAULT 0,
                    product_name TEXT NOT NULL DEFAULT '',
                    source_kind TEXT NOT NULL DEFAULT 'shortage',
                    source_note TEXT NOT NULL DEFAULT '',
                    quantity REAL NOT NULL DEFAULT 0,
                    unit_cost REAL NOT NULL DEFAULT 0,
                    batch_code TEXT NOT NULL DEFAULT '',
                    expiry_input_mode TEXT NOT NULL DEFAULT 'direct',
                    manufacture_date TEXT,
                    expiry_date TEXT,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id
                ON purchase_items(purchase_id, sort_order, id);

                CREATE TABLE IF NOT EXISTS inventory_receipts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    receipt_code TEXT NOT NULL UNIQUE,
                    receipt_type TEXT NOT NULL CHECK(receipt_type IN ('purchase', 'inventory_adjustment', 'customer_return', 'supplier_return')),
                    customer_id TEXT NOT NULL DEFAULT '',
                    customer_name TEXT NOT NULL DEFAULT '',
                    supplier_id TEXT NOT NULL DEFAULT '',
                    supplier_name TEXT NOT NULL DEFAULT '',
                    source_type TEXT NOT NULL DEFAULT '',
                    source_code TEXT NOT NULL DEFAULT '',
                    actor TEXT NOT NULL DEFAULT '',
                    reason TEXT NOT NULL DEFAULT '',
                    note TEXT NOT NULL DEFAULT '',
                    discount_amount REAL NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_inventory_receipts_type_created_at
                ON inventory_receipts(receipt_type, created_at DESC);

                CREATE TABLE IF NOT EXISTS inventory_receipt_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    receipt_id INTEGER NOT NULL,
                    product_id INTEGER NOT NULL,
                    product_name TEXT NOT NULL DEFAULT '',
                    unit TEXT NOT NULL DEFAULT '',
                    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('in', 'out')),
                    quantity REAL NOT NULL DEFAULT 0,
                    unit_amount REAL,
                    line_total REAL,
                    stock_after REAL,
                    transaction_id INTEGER,
                    purchase_item_id TEXT NOT NULL DEFAULT '',
                    FOREIGN KEY (receipt_id) REFERENCES inventory_receipts(id) ON DELETE CASCADE,
                    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
                );

                CREATE INDEX IF NOT EXISTS idx_inventory_receipt_items_receipt_id
                ON inventory_receipt_items(receipt_id, id);

                CREATE TABLE IF NOT EXISTS inventory_batches (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    product_id INTEGER NOT NULL,
                    batch_code TEXT NOT NULL DEFAULT '',
                    expiry_date TEXT,
                    received_at TEXT NOT NULL,
                    source_receipt_code TEXT NOT NULL DEFAULT '',
                    source_receipt_type TEXT NOT NULL DEFAULT '',
                    source_transaction_id INTEGER,
                    unit_cost REAL NOT NULL DEFAULT 0,
                    initial_quantity REAL NOT NULL DEFAULT 0,
                    remaining_quantity REAL NOT NULL DEFAULT 0,
                    note TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (product_id) REFERENCES products(id),
                    FOREIGN KEY (source_transaction_id) REFERENCES transactions(id)
                );

                CREATE INDEX IF NOT EXISTS idx_inventory_batches_product_expiry
                ON inventory_batches(
                    product_id,
                    expiry_date,
                    received_at,
                    id
                );

                CREATE TABLE IF NOT EXISTS inventory_batch_allocations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    batch_id INTEGER NOT NULL,
                    transaction_id INTEGER NOT NULL,
                    product_id INTEGER NOT NULL,
                    quantity REAL NOT NULL DEFAULT 0,
                    direction TEXT NOT NULL CHECK(direction IN ('in', 'out')),
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (batch_id) REFERENCES inventory_batches(id) ON DELETE CASCADE,
                    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
                    FOREIGN KEY (product_id) REFERENCES products(id)
                );

                CREATE INDEX IF NOT EXISTS idx_inventory_batch_allocations_transaction
                ON inventory_batch_allocations(transaction_id, id);

                CREATE TABLE IF NOT EXISTS workflow_locks (
                    lock_key TEXT PRIMARY KEY,
                    owner_username TEXT NOT NULL,
                    owner_role TEXT NOT NULL DEFAULT '',
                    acquired_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    note TEXT NOT NULL DEFAULT ''
                );

                CREATE TABLE IF NOT EXISTS procurement_assignments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    product_id INTEGER NOT NULL,
                    purchase_id TEXT NOT NULL,
                    mode TEXT NOT NULL DEFAULT 'batch',
                    scope_type TEXT NOT NULL DEFAULT 'all',
                    scope_code TEXT NOT NULL DEFAULT '',
                    assigned_quantity REAL NOT NULL DEFAULT 0,
                    assigned_by TEXT NOT NULL DEFAULT '',
                    assigned_at TEXT NOT NULL,
                    released_at TEXT,
                    status TEXT NOT NULL DEFAULT 'active',
                    FOREIGN KEY (product_id) REFERENCES products(id),
                    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
                );

                CREATE UNIQUE INDEX IF NOT EXISTS idx_procurement_assignments_active_product
                ON procurement_assignments(product_id, mode)
                WHERE status = 'active';

                CREATE INDEX IF NOT EXISTS idx_procurement_assignments_purchase
                ON procurement_assignments(purchase_id, status, id);
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
            if "shelf_life_days" not in columns:
                connection.execute(
                    "ALTER TABLE products ADD COLUMN shelf_life_days REAL"
                )
            if "storage_life_days" not in columns:
                connection.execute(
                    "ALTER TABLE products ADD COLUMN storage_life_days REAL"
                )
            now = utc_now_iso()
            audit_columns = {
                row["name"] for row in connection.execute("PRAGMA table_info(audit_logs)").fetchall()
            }
            if "actor" not in audit_columns:
                connection.execute(
                    "ALTER TABLE audit_logs ADD COLUMN actor TEXT NOT NULL DEFAULT ''"
                )
            receipt_columns = {
                row["name"] for row in connection.execute("PRAGMA table_info(inventory_receipts)").fetchall()
            }
            if "source_type" not in receipt_columns:
                connection.execute(
                    "ALTER TABLE inventory_receipts ADD COLUMN source_type TEXT NOT NULL DEFAULT ''"
                )
            if "source_code" not in receipt_columns:
                connection.execute(
                    "ALTER TABLE inventory_receipts ADD COLUMN source_code TEXT NOT NULL DEFAULT ''"
                )
            if "discount_amount" not in receipt_columns:
                connection.execute(
                    "ALTER TABLE inventory_receipts ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0"
                )
            cart_columns = {
                row["name"] for row in connection.execute("PRAGMA table_info(carts)").fetchall()
            }
            if "discount_amount" not in cart_columns:
                connection.execute(
                    "ALTER TABLE carts ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0"
                )
            if "ship_address" not in cart_columns:
                connection.execute(
                    "ALTER TABLE carts ADD COLUMN ship_address TEXT NOT NULL DEFAULT ''"
                )
            if "committed_at" not in cart_columns:
                connection.execute(
                    "ALTER TABLE carts ADD COLUMN committed_at TEXT"
                )
            purchase_columns = {
                row["name"] for row in connection.execute("PRAGMA table_info(purchases)").fetchall()
            }
            purchase_item_columns = {
                row["name"] for row in connection.execute("PRAGMA table_info(purchase_items)").fetchall()
            }
            if "source_type" not in purchase_columns:
                connection.execute(
                    "ALTER TABLE purchases ADD COLUMN source_type TEXT NOT NULL DEFAULT ''"
                )
            if "source_code" not in purchase_columns:
                connection.execute(
                    "ALTER TABLE purchases ADD COLUMN source_code TEXT NOT NULL DEFAULT ''"
                )
            if "source_name" not in purchase_columns:
                connection.execute(
                    "ALTER TABLE purchases ADD COLUMN source_name TEXT NOT NULL DEFAULT ''"
                )
            if "discount_amount" not in purchase_columns:
                connection.execute(
                    "ALTER TABLE purchases ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0"
                )
            if "ordered_at" not in purchase_columns:
                connection.execute(
                    "ALTER TABLE purchases ADD COLUMN ordered_at TEXT"
                )
            connection.execute(
                """
                UPDATE purchases
                SET ordered_at = (
                    SELECT MIN(al.created_at)
                    FROM audit_logs al
                    WHERE al.entity_type = 'purchase'
                      AND al.entity_id = purchases.id
                      AND al.action = 'status-change'
                      AND al.message LIKE 'Trạng thái phiếu nhập đổi từ % sang ordered.%'
                )
                WHERE TRIM(COALESCE(ordered_at, '')) = ''
                  AND status IN ('ordered', 'received', 'paid', 'cancelled')
                  AND EXISTS (
                    SELECT 1
                    FROM audit_logs al
                    WHERE al.entity_type = 'purchase'
                      AND al.entity_id = purchases.id
                      AND al.action = 'status-change'
                      AND al.message LIKE 'Trạng thái phiếu nhập đổi từ % sang ordered.%'
                  )
                """
            )
            connection.execute(
                """
                UPDATE purchases
                SET ordered_at = created_at
                WHERE TRIM(COALESCE(ordered_at, '')) = ''
                  AND status IN ('ordered', 'received', 'paid')
                """
            )
            if "batch_code" not in purchase_item_columns:
                connection.execute(
                    "ALTER TABLE purchase_items ADD COLUMN batch_code TEXT NOT NULL DEFAULT ''"
                )
            if "source_kind" not in purchase_item_columns:
                connection.execute(
                    "ALTER TABLE purchase_items ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'shortage'"
                )
            if "source_note" not in purchase_item_columns:
                connection.execute(
                    "ALTER TABLE purchase_items ADD COLUMN source_note TEXT NOT NULL DEFAULT ''"
                )
            if "expiry_input_mode" not in purchase_item_columns:
                connection.execute(
                    "ALTER TABLE purchase_items ADD COLUMN expiry_input_mode TEXT NOT NULL DEFAULT 'direct'"
                )
            if "manufacture_date" not in purchase_item_columns:
                connection.execute(
                    "ALTER TABLE purchase_items ADD COLUMN manufacture_date TEXT"
                )
            if "expiry_date" not in purchase_item_columns:
                connection.execute(
                    "ALTER TABLE purchase_items ADD COLUMN expiry_date TEXT"
                )
            receipt_item_columns = {
                row["name"] for row in connection.execute("PRAGMA table_info(inventory_receipt_items)").fetchall()
            }
            if "batch_id" not in receipt_item_columns:
                connection.execute(
                    "ALTER TABLE inventory_receipt_items ADD COLUMN batch_id INTEGER"
                )
            if "purchase_item_id" not in receipt_item_columns:
                connection.execute(
                    "ALTER TABLE inventory_receipt_items ADD COLUMN purchase_item_id TEXT NOT NULL DEFAULT ''"
                )
            if "batch_code" not in receipt_item_columns:
                connection.execute(
                    "ALTER TABLE inventory_receipt_items ADD COLUMN batch_code TEXT NOT NULL DEFAULT ''"
                )
            if "expiry_date" not in receipt_item_columns:
                connection.execute(
                    "ALTER TABLE inventory_receipt_items ADD COLUMN expiry_date TEXT"
                )
            batch_columns = {
                row["name"] for row in connection.execute("PRAGMA table_info(inventory_batches)").fetchall()
            }
            if batch_columns and "source_transaction_id" not in batch_columns:
                connection.execute(
                    "ALTER TABLE inventory_batches ADD COLUMN source_transaction_id INTEGER"
                )
            for key in self.SYNC_COLLECTION_KEYS:
                connection.execute(
                    """
                    INSERT OR IGNORE INTO app_state(state_key, state_value, updated_at)
                    VALUES(?, '[]', ?)
                    """,
                    (key, now),
                )
            self._migrate_legacy_sync_state_if_needed(connection)
            self._backfill_receipts_from_transactions_if_needed(connection)
            self._backfill_batches_from_transactions_if_needed(connection)

    def _migrate_legacy_sync_state_if_needed(self, connection: sqlite3.Connection) -> None:
        for state_key in self.SYNC_COLLECTION_KEYS:
            table_name = state_key
            count_row = connection.execute(
                f"SELECT COUNT(*) AS total FROM {table_name}"
            ).fetchone()
            if int(count_row["total"] or 0) > 0:
                continue
            row = connection.execute(
                "SELECT state_value, updated_at FROM app_state WHERE state_key = ?",
                (state_key,),
            ).fetchone()
            if not row:
                continue
            try:
                decoded = json.loads(row["state_value"] or "[]")
            except json.JSONDecodeError:
                decoded = []
            if not isinstance(decoded, list) or not decoded:
                continue
            self._replace_sync_collection_records(connection, state_key, decoded)
            canonical = self._load_sync_collection_from_tables(connection, state_key)
            connection.execute(
                "UPDATE app_state SET state_value = ?, updated_at = ? WHERE state_key = ?",
                (json.dumps(canonical, ensure_ascii=False), row["updated_at"], state_key),
            )

    def _backfill_receipts_from_transactions_if_needed(self, connection: sqlite3.Connection) -> None:
        row = connection.execute(
            "SELECT COUNT(*) AS total FROM inventory_receipts"
        ).fetchone()
        if int(row["total"] or 0) > 0:
            return

        transaction_rows = connection.execute(
            """
            SELECT t.id, t.product_id, t.transaction_type, t.quantity, t.note, t.created_at,
                   p.name AS product_name, p.unit
            FROM transactions t
            LEFT JOIN products p ON p.id = t.product_id
            ORDER BY t.created_at ASC, t.id ASC
            """
        ).fetchall()

        grouped: dict[str, dict] = {}
        for row in transaction_rows:
            note = str(row["note"] or "")
            match = re.search(r"\b(PN|DC|THK|TNCC)-\d{8}-\d{6}-[a-f0-9]{6}\b", note)
            if not match:
                continue
            receipt_code = match.group(0)
            entry = grouped.get(receipt_code)
            if not entry:
                receipt_type = {
                    "PN": "purchase",
                    "DC": "inventory_adjustment",
                    "THK": "customer_return",
                    "TNCC": "supplier_return",
                }[match.group(1)]
                entry = {
                    "receipt_type": receipt_type,
                    "receipt_code": receipt_code,
                    "customer_name": "",
                    "supplier_name": "",
                    "actor": "",
                    "reason": "",
                    "note": "",
                    "created_at": row["created_at"],
                    "items": [],
                }
                grouped[receipt_code] = entry

            if entry["receipt_type"] == "purchase":
                supplier_match = re.search(r"\bNCC:\s*([^|]+)", note)
                if supplier_match and not entry["supplier_name"]:
                    entry["supplier_name"] = supplier_match.group(1).strip()
                unit_amount = extract_price_from_note(note, "in")
            elif entry["receipt_type"] == "inventory_adjustment":
                actor_match = re.search(r"\bNgười chỉnh:\s*([^|]+)", note)
                reason_match = re.search(r"\bLý do:\s*([^|]+)", note)
                if actor_match and not entry["actor"]:
                    entry["actor"] = actor_match.group(1).strip()
                if reason_match and not entry["reason"]:
                    entry["reason"] = reason_match.group(1).strip()
                unit_amount = None
            elif entry["receipt_type"] == "customer_return":
                customer_match = re.search(r"\bKhách:\s*([^|]+)", note)
                if customer_match and not entry["customer_name"]:
                    entry["customer_name"] = customer_match.group(1).strip()
                unit_amount = extract_labeled_price(note, "Giá hoàn")
            else:
                supplier_match = re.search(r"\bNCC:\s*([^|]+)", note)
                if supplier_match and not entry["supplier_name"]:
                    entry["supplier_name"] = supplier_match.group(1).strip()
                unit_amount = extract_labeled_price(note, "Giá trả")

            line_total = round(float(row["quantity"]) * float(unit_amount), 2) if unit_amount is not None else None
            entry["items"].append(
                {
                    "product_id": int(row["product_id"] or 0),
                    "product_name": row["product_name"] or "",
                    "unit": row["unit"] or "",
                    "transaction_type": row["transaction_type"],
                    "quantity": round(float(row["quantity"] or 0), 2),
                    "unit_amount": unit_amount,
                    "line_total": line_total,
                    "transaction_id": row["id"],
                }
            )

        for entry in grouped.values():
            receipt_id = self._insert_inventory_receipt(
                connection,
                receipt_code=entry["receipt_code"],
                receipt_type=entry["receipt_type"],
                customer_name=entry["customer_name"],
                supplier_name=entry["supplier_name"],
                actor=entry["actor"],
                reason=entry["reason"],
                note=entry["note"],
                created_at=entry["created_at"],
            )
            for item in entry["items"]:
                self._insert_inventory_receipt_item(
                    connection,
                    receipt_id=receipt_id,
                    product_id=item["product_id"],
                    product_name=item["product_name"],
                    unit=item["unit"],
                    transaction_type=item["transaction_type"],
                    quantity=item["quantity"],
                    unit_amount=item["unit_amount"],
                    line_total=item["line_total"],
                    stock_after=None,
                    transaction_id=item["transaction_id"],
                )

    def _backfill_batches_from_transactions_if_needed(self, connection: sqlite3.Connection) -> None:
        row = connection.execute(
            "SELECT COUNT(*) AS total FROM inventory_batches"
        ).fetchone()
        if int(row["total"] or 0) > 0:
            return

        transaction_rows = connection.execute(
            """
            SELECT
                t.id,
                t.product_id,
                t.transaction_type,
                t.quantity,
                t.note,
                t.created_at,
                p.name AS product_name,
                p.price,
                p.shelf_life_days,
                p.storage_life_days,
                ir.receipt_code,
                ir.receipt_type,
                iri.batch_code,
                iri.expiry_date,
                iri.unit_amount AS receipt_unit_amount
            FROM transactions t
            LEFT JOIN products p ON p.id = t.product_id
            LEFT JOIN inventory_receipt_items iri ON iri.transaction_id = t.id
            LEFT JOIN inventory_receipts ir ON ir.id = iri.receipt_id
            ORDER BY t.created_at ASC, t.id ASC
            """
        ).fetchall()

        for row in transaction_rows:
            product = self._get_product_or_raise(
                connection,
                int(row["product_id"]),
                allow_deleted=True,
            )
            if row["transaction_type"] == "in":
                inbound_unit_cost = row["receipt_unit_amount"]
                if inbound_unit_cost is None:
                    inbound_unit_cost = extract_price_from_note(row["note"] or "", "in")
                if inbound_unit_cost is None:
                    inbound_unit_cost = float(row["price"] or 0)
                batch_code = str(row["batch_code"] or "").strip() or (
                    f"{str(row['receipt_code'] or '').strip() or 'LEGACY'}-L{row['id']}"
                )
                self._create_inventory_batch(
                    connection,
                    product=product,
                    quantity=Decimal(str(row["quantity"] or 0)),
                    unit_cost=Decimal(str(inbound_unit_cost or 0)),
                    received_at=row["created_at"],
                    source_receipt_code=str(row["receipt_code"] or "").strip(),
                    source_receipt_type=str(row["receipt_type"] or "").strip(),
                    source_transaction_id=int(row["id"]),
                    transaction_id=int(row["id"]),
                    batch_code=batch_code,
                    expiry_date=row["expiry_date"],
                    note="Backfill lô tồn từ giao dịch cũ.",
                    fallback_batch_code=batch_code,
                )
                continue

            self._consume_inventory_batches(
                connection,
                product_id=int(row["product_id"]),
                quantity=Decimal(str(row["quantity"] or 0)),
                transaction_id=int(row["id"]),
                created_at=row["created_at"],
            )

    def _normalize_expiry_date(
        self,
        value,
        *,
        field_name: str = "Hạn dùng",
    ) -> str | None:
        clean_value = str(value or "").strip()
        if not clean_value:
            return None
        try:
            if "T" in clean_value:
                parsed = datetime.fromisoformat(clean_value.replace("Z", "+00:00")).date()
            else:
                parsed = datetime.strptime(clean_value, "%Y-%m-%d").date()
        except ValueError as exc:
            raise ValueError(f"{field_name} không hợp lệ. Định dạng đúng là YYYY-MM-DD.") from exc
        return parsed.isoformat()

    @staticmethod
    def _normalize_purchase_expiry_input_mode(value) -> str:
        clean_value = str(value or "").strip().lower()
        if not clean_value:
            return "direct"
        if clean_value not in {"direct", "manufacture", "received_fallback"}:
            raise ValueError("Cách nhập hạn dùng không hợp lệ.")
        return clean_value

    @staticmethod
    def _resolve_purchase_storage_life_days(product: sqlite3.Row | dict) -> float | None:
        storage_life_days = InventoryStore._optional_float(product["storage_life_days"])
        if storage_life_days is not None:
            return storage_life_days
        return InventoryStore._optional_float(product["shelf_life_days"])

    def _shift_date_by_days(
        self,
        base_date,
        days: float | None,
        *,
        field_name: str,
    ) -> str | None:
        normalized_base_date = self._normalize_expiry_date(base_date, field_name=field_name)
        if not normalized_base_date or days is None:
            return None
        whole_days = max(0, int(round(float(days))))
        shifted_date = datetime.strptime(normalized_base_date, "%Y-%m-%d").date() + timedelta(days=whole_days)
        return shifted_date.isoformat()

    def _resolve_purchase_item_expiry_metadata(
        self,
        *,
        raw_item: dict,
        product: sqlite3.Row | dict,
        received_at: str = "",
        field_prefix: str = "Dòng nhập",
    ) -> dict:
        raw_mode = self._normalize_purchase_expiry_input_mode(
            raw_item.get("expiry_input_mode") or raw_item.get("expiryInputMode")
        )
        manufacture_date = self._normalize_expiry_date(
            raw_item.get("manufacture_date") or raw_item.get("manufactureDate"),
            field_name=f"{field_prefix} - Ngày sản xuất",
        )
        expiry_date = self._normalize_expiry_date(
            raw_item.get("expiry_date") or raw_item.get("expiryDate"),
            field_name=f"{field_prefix} - Hạn dùng",
        )
        storage_life_days = self._resolve_purchase_storage_life_days(product)
        resolved_mode = raw_mode
        resolved_manufacture_date = manufacture_date if raw_mode == "manufacture" else None
        resolved_expiry_date = expiry_date

        if raw_mode == "manufacture":
            if not manufacture_date:
                raise ValueError("Ngày sản xuất là bắt buộc khi chọn cách nhập HSD gián tiếp.")
            if storage_life_days is None:
                raise ValueError(
                    f'Sản phẩm "{product["name"]}" chưa có thời gian bảo quản để tự tính HSD từ ngày sản xuất.'
                )
            resolved_expiry_date = self._shift_date_by_days(
                manufacture_date,
                storage_life_days,
                field_name=f"{field_prefix} - Ngày sản xuất",
            )
        elif not expiry_date and received_at and storage_life_days is not None:
            resolved_mode = "received_fallback"
            resolved_expiry_date = self._shift_date_by_days(
                received_at,
                storage_life_days,
                field_name=f"{field_prefix} - Ngày nhập kho",
            )

        return {
            "expiry_input_mode": resolved_mode,
            "manufacture_date": resolved_manufacture_date,
            "expiry_date": resolved_expiry_date,
            "storage_life_days": storage_life_days,
        }

    @staticmethod
    def _resolve_batch_code(batch_code: str, fallback_batch_code: str) -> str:
        clean_batch_code = str(batch_code or "").strip()
        if clean_batch_code:
            return clean_batch_code
        clean_fallback = str(fallback_batch_code or "").strip()
        if clean_fallback:
            return clean_fallback
        return f"LO-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{secrets.token_hex(3)}"

    def _insert_inventory_batch_allocation(
        self,
        connection: sqlite3.Connection,
        *,
        batch_id: int,
        transaction_id: int,
        product_id: int,
        quantity: float,
        direction: str,
        created_at: str,
    ) -> None:
        connection.execute(
            """
            INSERT INTO inventory_batch_allocations(
                batch_id, transaction_id, product_id, quantity, direction, created_at
            )
            VALUES(?, ?, ?, ?, ?, ?)
            """,
            (
                batch_id,
                transaction_id,
                product_id,
                round(float(quantity), 2),
                direction,
                created_at,
            ),
        )

    def _create_inventory_batch(
        self,
        connection: sqlite3.Connection,
        *,
        product: sqlite3.Row,
        quantity: Decimal,
        unit_cost: Decimal,
        received_at: str,
        source_receipt_code: str = "",
        source_receipt_type: str = "",
        source_transaction_id: int | None = None,
        transaction_id: int | None = None,
        batch_code: str = "",
        expiry_date: str | None = None,
        note: str = "",
        fallback_batch_code: str = "",
    ) -> dict:
        normalized_expiry_date = self._normalize_expiry_date(
            expiry_date,
            field_name="Hạn dùng lô",
        )
        resolved_expiry_date = normalized_expiry_date
        resolved_batch_code = self._resolve_batch_code(batch_code, fallback_batch_code)
        now = received_at or utc_now_iso()
        cursor = connection.execute(
            """
            INSERT INTO inventory_batches(
                product_id, batch_code, expiry_date, received_at, source_receipt_code,
                source_receipt_type, source_transaction_id, unit_cost, initial_quantity,
                remaining_quantity, note, created_at, updated_at
            )
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                int(product["id"]),
                resolved_batch_code,
                resolved_expiry_date,
                now,
                str(source_receipt_code or "").strip(),
                str(source_receipt_type or "").strip(),
                source_transaction_id,
                round(float(unit_cost), 2),
                round(float(quantity), 2),
                round(float(quantity), 2),
                str(note or "").strip(),
                now,
                now,
            ),
        )
        batch_id = int(cursor.lastrowid)
        if transaction_id is not None:
            self._insert_inventory_batch_allocation(
                connection,
                batch_id=batch_id,
                transaction_id=int(transaction_id),
                product_id=int(product["id"]),
                quantity=round(float(quantity), 2),
                direction="in",
                created_at=now,
            )
        return {
            "id": batch_id,
            "batch_code": resolved_batch_code,
            "expiry_date": resolved_expiry_date or "",
            "received_at": now,
            "unit_cost": round(float(unit_cost), 2),
            "quantity": round(float(quantity), 2),
        }

    def _list_available_batches_for_product(
        self,
        connection: sqlite3.Connection,
        product_id: int,
        *,
        preferred_batch_code: str = "",
    ) -> list[sqlite3.Row]:
        clean_preferred_batch_code = str(preferred_batch_code or "").strip()
        if clean_preferred_batch_code:
            return connection.execute(
                """
                SELECT
                    id, product_id, batch_code, expiry_date, received_at,
                    source_receipt_code, source_receipt_type, unit_cost,
                    initial_quantity, remaining_quantity
                FROM inventory_batches
                WHERE product_id = ? AND batch_code = ? AND remaining_quantity > 0
                ORDER BY datetime(received_at) ASC, id ASC
                """,
                (product_id, clean_preferred_batch_code),
            ).fetchall()
        return connection.execute(
            """
            SELECT
                id, product_id, batch_code, expiry_date, received_at,
                source_receipt_code, source_receipt_type, unit_cost,
                initial_quantity, remaining_quantity
            FROM inventory_batches
            WHERE product_id = ? AND remaining_quantity > 0
            ORDER BY
                CASE WHEN expiry_date IS NULL OR expiry_date = '' THEN 1 ELSE 0 END ASC,
                expiry_date ASC,
                datetime(received_at) ASC,
                id ASC
            """,
            (product_id,),
        ).fetchall()

    def _consume_inventory_batches(
        self,
        connection: sqlite3.Connection,
        *,
        product_id: int,
        quantity: Decimal,
        transaction_id: int,
        created_at: str,
        preferred_batch_code: str = "",
    ) -> list[dict]:
        clean_preferred_batch_code = str(preferred_batch_code or "").strip()
        available_batches = self._list_available_batches_for_product(
            connection,
            product_id,
            preferred_batch_code=clean_preferred_batch_code,
        )
        total_available = sum(
            Decimal(str(row["remaining_quantity"] or 0))
            for row in available_batches
        )
        if quantity > total_available:
            if clean_preferred_batch_code:
                raise ValueError(
                    f"Lô {clean_preferred_batch_code} không đủ tồn để trừ theo phiếu hiện tại."
                )
            raise ValueError("Số lượng xuất lớn hơn tồn kho hiện tại.")

        remaining_to_consume = Decimal(str(quantity))
        allocations: list[dict] = []
        for batch in available_batches:
            batch_remaining = Decimal(str(batch["remaining_quantity"] or 0))
            if batch_remaining <= 0:
                continue
            consume_quantity = min(remaining_to_consume, batch_remaining)
            if consume_quantity <= 0:
                continue
            updated_remaining = batch_remaining - consume_quantity
            connection.execute(
                """
                UPDATE inventory_batches
                SET remaining_quantity = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    round(float(updated_remaining), 2),
                    created_at,
                    int(batch["id"]),
                ),
            )
            self._insert_inventory_batch_allocation(
                connection,
                batch_id=int(batch["id"]),
                transaction_id=int(transaction_id),
                product_id=int(product_id),
                quantity=round(float(consume_quantity), 2),
                direction="out",
                created_at=created_at,
            )
            allocations.append(
                {
                    "batch_id": int(batch["id"]),
                    "batch_code": batch["batch_code"] or "",
                    "expiry_date": batch["expiry_date"] or "",
                    "quantity": round(float(consume_quantity), 2),
                    "unit_cost": round(float(batch["unit_cost"] or 0), 2),
                    "source_receipt_code": batch["source_receipt_code"] or "",
                    "remaining_quantity": round(float(updated_remaining), 2),
                }
            )
            remaining_to_consume -= consume_quantity
            if remaining_to_consume <= 0:
                break
        return allocations

    def _build_batch_map_for_products(
        self,
        connection: sqlite3.Connection,
        product_ids: list[int],
    ) -> dict[int, list[dict]]:
        if not product_ids:
            return {}
        placeholders = ",".join("?" for _ in product_ids)
        rows = connection.execute(
            f"""
            SELECT
                id, product_id, batch_code, expiry_date, received_at,
                source_receipt_code, source_receipt_type, unit_cost,
                initial_quantity, remaining_quantity
            FROM inventory_batches
            WHERE product_id IN ({placeholders}) AND remaining_quantity > 0
            ORDER BY
                product_id ASC,
                CASE WHEN expiry_date IS NULL OR expiry_date = '' THEN 1 ELSE 0 END ASC,
                expiry_date ASC,
                datetime(received_at) ASC,
                id ASC
            """,
            product_ids,
        ).fetchall()
        today = datetime.now().date()
        batch_map: dict[int, list[dict]] = {}
        for row in rows:
            expiry_date = row["expiry_date"] or ""
            days_to_expiry = None
            if expiry_date:
                try:
                    days_to_expiry = (
                        datetime.strptime(expiry_date, "%Y-%m-%d").date() - today
                    ).days
                except ValueError:
                    days_to_expiry = None
            batch_map.setdefault(int(row["product_id"]), []).append(
                {
                    "id": int(row["id"]),
                    "batch_code": row["batch_code"] or "",
                    "expiry_date": expiry_date,
                    "received_at": row["received_at"],
                    "source_receipt_code": row["source_receipt_code"] or "",
                    "source_receipt_type": row["source_receipt_type"] or "",
                    "unit_cost": round(float(row["unit_cost"] or 0), 2),
                    "initial_quantity": round(float(row["initial_quantity"] or 0), 2),
                    "remaining_quantity": round(float(row["remaining_quantity"] or 0), 2),
                    "days_to_expiry": days_to_expiry,
                }
            )
        return batch_map

    def _get_batch_allocations_for_transactions(
        self,
        connection: sqlite3.Connection,
        transaction_ids: list[int],
    ) -> dict[int, list[dict]]:
        if not transaction_ids:
            return {}
        placeholders = ",".join("?" for _ in transaction_ids)
        rows = connection.execute(
            f"""
            SELECT
                iba.transaction_id,
                iba.direction,
                iba.quantity,
                ib.id AS batch_id,
                ib.batch_code,
                ib.expiry_date,
                ib.unit_cost,
                ib.source_receipt_code
            FROM inventory_batch_allocations iba
            INNER JOIN inventory_batches ib ON ib.id = iba.batch_id
            WHERE iba.transaction_id IN ({placeholders})
            ORDER BY iba.transaction_id ASC, iba.id ASC
            """,
            transaction_ids,
        ).fetchall()
        allocation_map: dict[int, list[dict]] = {}
        for row in rows:
            allocation_map.setdefault(int(row["transaction_id"]), []).append(
                {
                    "batch_id": int(row["batch_id"]),
                    "batch_code": row["batch_code"] or "",
                    "expiry_date": row["expiry_date"] or "",
                    "unit_cost": round(float(row["unit_cost"] or 0), 2),
                    "quantity": round(float(row["quantity"] or 0), 2),
                    "direction": row["direction"] or "",
                    "source_receipt_code": row["source_receipt_code"] or "",
                }
            )
        return allocation_map

    @staticmethod
    def _format_batch_allocations_note(
        allocations: list[dict],
        *,
        prefix: str,
    ) -> str:
        if not allocations:
            return ""
        parts = []
        for allocation in allocations:
            label = str(allocation.get("batch_code") or "").strip() or f"Lô {allocation.get('batch_id')}"
            quantity = round(float(allocation.get("quantity") or 0), 2)
            expiry_date = str(allocation.get("expiry_date") or "").strip()
            detail = f"{label} {quantity:g}"
            if expiry_date:
                detail += f" HSD {expiry_date}"
            parts.append(detail)
        return f"{prefix}: " + "; ".join(parts)

    def _serialize_customer_row(self, row: sqlite3.Row) -> dict:
        deleted_at = row["deleted_at"]
        return {
            "id": row["id"],
            "name": row["name"],
            "phone": row["phone"],
            "address": row["address"],
            "zaloUrl": row["zalo_url"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
            "deletedAt": deleted_at,
            "deleted_at": deleted_at,
        }

    def _serialize_supplier_row(self, row: sqlite3.Row) -> dict:
        deleted_at = row["deleted_at"]
        return {
            "id": row["id"],
            "name": row["name"],
            "phone": row["phone"],
            "address": row["address"],
            "note": row["note"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
            "deletedAt": deleted_at,
            "deleted_at": deleted_at,
        }

    def _serialize_cart_item_row(self, row: sqlite3.Row) -> dict:
        return {
            "id": row["id"],
            "productId": int(row["product_id"] or 0),
            "product_id": int(row["product_id"] or 0),
            "productName": row["product_name"] or "",
            "quantity": round(float(row["quantity"] or 0), 2),
            "unitPrice": round(float(row["unit_price"] or 0), 2),
            "unit_price": round(float(row["unit_price"] or 0), 2),
            "note": row["note"] or "",
        }

    def _find_active_customer_by_name(
        self,
        connection: sqlite3.Connection,
        customer_name: str,
    ) -> dict | None:
        clean_customer_name = str(customer_name or "").strip()
        if not clean_customer_name:
            return None
        row = connection.execute(
            """
            SELECT id, name, phone, address, zalo_url, created_at, updated_at, deleted_at
            FROM customers
            WHERE deleted_at IS NULL
              AND name = ? COLLATE NOCASE
            ORDER BY datetime(updated_at) DESC, id
            LIMIT 1
            """,
            (clean_customer_name,),
        ).fetchone()
        return self._serialize_customer_row(row) if row else None

    def _ensure_customer_for_bulk_order(
        self,
        connection: sqlite3.Connection,
        *,
        customer_id: str = "",
        customer_name: str = "",
        created_at: str,
    ) -> dict:
        clean_customer_id = str(customer_id or "").strip()
        clean_customer_name = str(customer_name or "").strip()
        if clean_customer_id:
            row = connection.execute(
                """
                SELECT id, name, phone, address, zalo_url, created_at, updated_at, deleted_at
                FROM customers
                WHERE id = ?
                  AND deleted_at IS NULL
                """,
                (clean_customer_id,),
            ).fetchone()
            if row:
                return self._serialize_customer_row(row)
        existing_customer = self._find_active_customer_by_name(connection, clean_customer_name)
        if existing_customer:
            return existing_customer
        if not clean_customer_name:
            raise ValueError("Khách hàng là bắt buộc.")
        resolved_customer_id = clean_customer_id or f"customer_{secrets.token_hex(6)}"
        connection.execute(
            """
            INSERT INTO customers(id, name, phone, address, zalo_url, created_at, updated_at, deleted_at)
            VALUES(?, ?, '', '', '', ?, ?, NULL)
            """,
            (
                resolved_customer_id,
                clean_customer_name,
                created_at,
                created_at,
            ),
        )
        return {
            "id": resolved_customer_id,
            "name": clean_customer_name,
            "phone": "",
            "address": "",
            "zaloUrl": "",
            "zalo_url": "",
            "createdAt": created_at,
            "updatedAt": created_at,
            "deletedAt": None,
            "deleted_at": None,
        }

    def _get_existing_draft_cart_for_customer(
        self,
        connection: sqlite3.Connection,
        *,
        customer_id: str = "",
        customer_name: str = "",
    ) -> dict | None:
        clean_customer_id = str(customer_id or "").strip()
        clean_customer_name = str(customer_name or "").strip()
        row = None
        if clean_customer_id:
            row = connection.execute(
                """
                SELECT id
                FROM carts
                WHERE status = 'draft'
                  AND customer_id = ?
                ORDER BY datetime(updated_at) DESC, id
                LIMIT 1
                """,
                (clean_customer_id,),
            ).fetchone()
        if not row and clean_customer_name:
            row = connection.execute(
                """
                SELECT id
                FROM carts
                WHERE status = 'draft'
                  AND customer_name = ? COLLATE NOCASE
                ORDER BY datetime(updated_at) DESC, id
                LIMIT 1
                """,
                (clean_customer_name,),
            ).fetchone()
        if not row:
            return None
        return self._get_cart_document(connection, str(row["id"]))

    def _build_cart_items_from_grouped_sale_items(
        self,
        connection: sqlite3.Connection,
        grouped_items: dict[int, dict],
    ) -> list[dict]:
        cart_items: list[dict] = []
        for product_id, grouped_item in grouped_items.items():
            product = self._get_product_or_raise(connection, product_id)
            cart_items.append(
                {
                    "id": f"cart_item_{secrets.token_hex(6)}",
                    "productId": int(product_id),
                    "product_id": int(product_id),
                    "productName": str(product["name"] or "").strip(),
                    "product_name": str(product["name"] or "").strip(),
                    "quantity": round(float(grouped_item["quantity"]), 2),
                    "unitPrice": round(float(grouped_item["unit_price"]), 2),
                    "unit_price": round(float(grouped_item["unit_price"]), 2),
                    "note": str(grouped_item.get("note") or "").strip(),
                }
            )
        return cart_items

    def _replace_cart_items(
        self,
        connection: sqlite3.Connection,
        *,
        cart_id: str,
        items: list[dict],
    ) -> None:
        connection.execute("DELETE FROM cart_items WHERE cart_id = ?", (str(cart_id),))
        for index, item in enumerate(items):
            connection.execute(
                """
                INSERT INTO cart_items(id, cart_id, product_id, product_name, quantity, unit_price, note, sort_order)
                VALUES(?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(item.get("id") or f"cart_item_{secrets.token_hex(6)}"),
                    str(cart_id),
                    int(item.get("productId") or item.get("product_id") or 0),
                    str(item.get("productName") or item.get("product_name") or "").strip(),
                    float(item.get("quantity") or 0),
                    float(item.get("unitPrice") or item.get("unit_price") or 0),
                    str(item.get("note") or "").strip(),
                    index,
                ),
            )

    def _merge_grouped_sale_items(
        self,
        existing_items: list[dict],
        incoming_grouped_items: dict[int, dict],
    ) -> dict[int, dict]:
        merged_items = self._group_sale_items(existing_items or [])
        for product_id, incoming_item in incoming_grouped_items.items():
            existing_item = merged_items.get(product_id)
            if existing_item:
                existing_item["quantity"] += incoming_item["quantity"]
                existing_item["unit_price"] = incoming_item["unit_price"]
                if incoming_item.get("note"):
                    existing_item["note"] = incoming_item["note"]
                continue
            merged_items[product_id] = {
                "product_id": incoming_item["product_id"],
                "quantity": incoming_item["quantity"],
                "unit_price": incoming_item["unit_price"],
                "note": incoming_item.get("note") or "",
            }
        return merged_items

    def _serialize_purchase_item_row(self, row: sqlite3.Row) -> dict:
        return {
            "id": row["id"],
            "productId": int(row["product_id"] or 0),
            "product_id": int(row["product_id"] or 0),
            "productName": row["product_name"] or "",
            "sourceKind": row["source_kind"] or "shortage",
            "source_kind": row["source_kind"] or "shortage",
            "sourceNote": row["source_note"] or "",
            "source_note": row["source_note"] or "",
            "quantity": round(float(row["quantity"] or 0), 2),
            "unitCost": round(float(row["unit_cost"] or 0), 2),
            "unit_cost": round(float(row["unit_cost"] or 0), 2),
            "batchCode": row["batch_code"] or "",
            "batch_code": row["batch_code"] or "",
            "expiryInputMode": row["expiry_input_mode"] or "direct",
            "expiry_input_mode": row["expiry_input_mode"] or "direct",
            "manufactureDate": row["manufacture_date"] or "",
            "manufacture_date": row["manufacture_date"] or "",
            "expiryDate": row["expiry_date"] or "",
            "expiry_date": row["expiry_date"] or "",
        }

    @staticmethod
    def _parse_discount_amount_value(value, field_name: str) -> Decimal:
        return parse_non_negative_decimal(value or 0, field_name)

    @classmethod
    def _get_cart_subtotal_amount(cls, cart: dict) -> Decimal:
        subtotal = Decimal("0")
        for item in cart.get("items") or []:
            subtotal += Decimal(str(item.get("quantity") or 0)) * Decimal(str(item.get("unitPrice") or item.get("unit_price") or 0))
        return subtotal

    @classmethod
    def _get_purchase_subtotal_amount(cls, purchase: dict) -> Decimal:
        subtotal = Decimal("0")
        for item in purchase.get("items") or []:
            subtotal += Decimal(str(item.get("quantity") or 0)) * Decimal(str(item.get("unitCost") or item.get("unit_cost") or 0))
        return subtotal

    @classmethod
    def _validate_discount_amount(
        cls,
        value,
        subtotal: Decimal,
        field_name: str,
    ) -> float:
        discount_amount = cls._parse_discount_amount_value(value, field_name)
        if discount_amount > subtotal:
            raise ValueError(f"{field_name} không được lớn hơn tạm tính của phiếu.")
        return round(float(discount_amount), 2)

    @classmethod
    def _get_cart_discount_amount(cls, cart: dict) -> float:
        return cls._validate_discount_amount(
            cart.get("discountAmount", cart.get("discount_amount", 0)),
            cls._get_cart_subtotal_amount(cart),
            "Giảm giá khuyến mại phiếu xuất",
        )

    @classmethod
    def _get_purchase_discount_amount(cls, purchase: dict) -> float:
        return cls._validate_discount_amount(
            purchase.get("discountAmount", purchase.get("discount_amount", 0)),
            cls._get_purchase_subtotal_amount(purchase),
            "Giảm giá khuyến mại phiếu nhập",
        )

    @staticmethod
    def _purchase_has_items(purchase: dict) -> bool:
        items = purchase.get("items")
        return isinstance(items, list) and bool(items)

    @staticmethod
    def _extract_legacy_purchase_source_name(note: str) -> str:
        clean_note = str(note or "").strip()
        if not clean_note:
            return ""
        match = re.match(r"^Thiếu hàng cho đơn(?: của)?\s+(.+)$", clean_note, re.IGNORECASE)
        if not match:
            return ""
        return str(match.group(1) or "").strip()

    @classmethod
    def _normalize_purchase_source_fields(cls, purchase: dict) -> dict:
        clean_note = str(purchase.get("note") or "").strip()
        clean_source_type = str(purchase.get("sourceType") or purchase.get("source_type") or "").strip()
        clean_source_code = str(purchase.get("sourceCode") or purchase.get("source_code") or "").strip()
        clean_source_name = str(purchase.get("sourceName") or purchase.get("source_name") or "").strip()
        legacy_source_name = cls._extract_legacy_purchase_source_name(clean_note)
        if legacy_source_name:
            clean_note = ""
            if not clean_source_type:
                clean_source_type = "cart"
            if not clean_source_name:
                clean_source_name = legacy_source_name
        return {
            **purchase,
            "note": clean_note,
            "sourceType": clean_source_type,
            "source_type": clean_source_type,
            "sourceCode": clean_source_code,
            "source_code": clean_source_code,
            "sourceName": clean_source_name,
            "source_name": clean_source_name,
        }

    @staticmethod
    def _get_purchase_source_type(purchase: dict | None) -> str:
        if not isinstance(purchase, dict):
            return ""
        return str(purchase.get("sourceType") or purchase.get("source_type") or "").strip()

    @classmethod
    def _is_procurement_batch_purchase(cls, purchase: dict | None) -> bool:
        return cls._get_purchase_source_type(purchase) == "procurement_batch"

    @classmethod
    def _normalize_purchases_for_storage(cls, purchases: list[dict]) -> list[dict]:
        normalized: list[dict] = []
        for purchase in purchases:
            purchase = cls._normalize_purchase_source_fields(purchase)
            status = str(purchase.get("status") or "draft")
            if status == "draft" and not cls._purchase_has_items(purchase):
                continue
            normalized.append(purchase)
        return normalized

    def _load_sync_collection_from_tables(
        self,
        connection: sqlite3.Connection,
        state_key: str,
    ) -> list[dict]:
        if state_key == "customers":
            rows = connection.execute(
                """
                SELECT id, name, phone, address, zalo_url, created_at, updated_at, deleted_at
                FROM customers
                ORDER BY datetime(updated_at) DESC, name COLLATE NOCASE, id
                """
            ).fetchall()
            return [self._serialize_customer_row(row) for row in rows]

        if state_key == "suppliers":
            rows = connection.execute(
                """
                SELECT id, name, phone, address, note, created_at, updated_at, deleted_at
                FROM suppliers
                ORDER BY datetime(updated_at) DESC, name COLLATE NOCASE, id
                """
            ).fetchall()
            return [self._serialize_supplier_row(row) for row in rows]

        if state_key == "carts":
            cart_rows = connection.execute(
                """
                SELECT id, customer_id, customer_name, status, payment_status, discount_amount, ship_address, created_at, updated_at,
                       committed_at, completed_at, cancelled_at, paid_at, order_code
                FROM carts
                ORDER BY datetime(updated_at) DESC, id
                """
            ).fetchall()
            item_rows = connection.execute(
                """
                SELECT id, cart_id, product_id, product_name, quantity, unit_price, note, sort_order
                FROM cart_items
                ORDER BY cart_id, sort_order, id
                """
            ).fetchall()
            items_by_cart: dict[str, list[dict]] = {}
            for row in item_rows:
                items_by_cart.setdefault(str(row["cart_id"]), []).append(self._serialize_cart_item_row(row))
            carts = []
            for row in cart_rows:
                cart_items = items_by_cart.get(str(row["id"]), [])
                carts.append(
                    {
                        "id": row["id"],
                        "customerId": row["customer_id"] or "",
                        "customerName": row["customer_name"] or "",
                        "status": row["status"] or "draft",
                        "paymentStatus": row["payment_status"] or "unpaid",
                        "discountAmount": round(float(row["discount_amount"] or 0), 2),
                        "discount_amount": round(float(row["discount_amount"] or 0), 2),
                        "shipAddress": row["ship_address"] or "",
                        "ship_address": row["ship_address"] or "",
                        "createdAt": row["created_at"],
                        "updatedAt": row["updated_at"],
                        "committedAt": row["committed_at"],
                        "committed_at": row["committed_at"],
                        "completedAt": row["completed_at"],
                        "cancelledAt": row["cancelled_at"],
                        "paidAt": row["paid_at"],
                        "orderCode": row["order_code"] or "",
                        "items": cart_items,
                    }
                )
            return carts

        if state_key == "purchases":
            purchase_rows = connection.execute(
                """
                SELECT id, supplier_id, supplier_name, note, source_type, source_code, source_name, status, discount_amount, created_at, updated_at,
                       ordered_at, received_at, paid_at, receipt_code
                FROM purchases
                ORDER BY datetime(updated_at) DESC, id
                """
            ).fetchall()
            purchase_ordered_at_by_id = {
                str(row["entity_id"] or "").strip(): str(row["ordered_at"] or "").strip()
                for row in connection.execute(
                    """
                    SELECT entity_id, MIN(created_at) AS ordered_at
                    FROM audit_logs
                    WHERE entity_type = 'purchase'
                      AND action = 'status-change'
                      AND message LIKE 'Trạng thái phiếu nhập đổi từ % sang ordered.%'
                    GROUP BY entity_id
                    """
                ).fetchall()
                if str(row["entity_id"] or "").strip()
            }
            purchase_receipts_by_code = {
                str(row["receipt_code"] or "").strip(): row["created_at"]
                for row in connection.execute(
                    """
                    SELECT receipt_code, created_at
                    FROM inventory_receipts
                    WHERE receipt_type = 'purchase'
                    """
                ).fetchall()
                if str(row["receipt_code"] or "").strip()
            }
            purchase_receipt_codes = set(purchase_receipts_by_code.keys())
            item_rows = connection.execute(
                """
                SELECT
                    id, purchase_id, product_id, product_name, source_kind, source_note, quantity, unit_cost, batch_code,
                    expiry_input_mode, manufacture_date, expiry_date, sort_order
                FROM purchase_items
                ORDER BY purchase_id, sort_order, id
                """
            ).fetchall()
            items_by_purchase: dict[str, list[dict]] = {}
            for row in item_rows:
                items_by_purchase.setdefault(str(row["purchase_id"]), []).append(self._serialize_purchase_item_row(row))
            purchases = []
            for row in purchase_rows:
                raw_status = row["status"] or "draft"
                receipt_code = row["receipt_code"] or ""
                ordered_at = str(row["ordered_at"] or "").strip()
                if not ordered_at:
                    ordered_at = purchase_ordered_at_by_id.get(str(row["id"]) or "", "")
                if not ordered_at and raw_status in {"ordered", "received", "paid"}:
                    ordered_at = str(row["created_at"] or row["updated_at"] or "").strip()
                matched_receipt_created_at = purchase_receipts_by_code.get(str(receipt_code).strip(), "")
                purchase_items = items_by_purchase.get(str(row["id"]), [])
                received_at = (
                    row["received_at"]
                    or (matched_receipt_created_at if raw_status in {"received", "paid"} else None)
                    or (row["updated_at"] if raw_status in {"received", "paid"} else None)
                )
                paid_at = row["paid_at"] or (row["updated_at"] if raw_status == "paid" else None)
                purchase_payload = {
                    "id": row["id"],
                    "supplierName": row["supplier_name"] or "",
                    "status": raw_status,
                    "receivedAt": received_at,
                    "paidAt": paid_at,
                    "receiptCode": receipt_code,
                    "items": purchase_items,
                }
                is_repairable_invalid = self._is_repairable_invalid_purchase(connection, purchase_payload)
                purchases.append(
                    {
                        "id": row["id"],
                        "supplierId": row["supplier_id"] or "",
                        "supplierName": row["supplier_name"] or "",
                        "note": row["note"] or "",
                        "sourceType": row["source_type"] or "",
                        "source_type": row["source_type"] or "",
                        "sourceCode": row["source_code"] or "",
                        "source_code": row["source_code"] or "",
                        "sourceName": row["source_name"] or "",
                        "source_name": row["source_name"] or "",
                        "status": raw_status,
                        "discountAmount": round(float(row["discount_amount"] or 0), 2),
                        "discount_amount": round(float(row["discount_amount"] or 0), 2),
                        "createdAt": row["created_at"],
                        "updatedAt": row["updated_at"],
                        "orderedAt": ordered_at,
                        "ordered_at": ordered_at,
                        "receivedAt": received_at,
                        "received_at": received_at,
                        "paidAt": paid_at,
                        "paid_at": paid_at,
                        "receiptCode": receipt_code,
                        "receipt_code": receipt_code,
                        "isRepairableInvalid": is_repairable_invalid,
                        "repairableInvalid": is_repairable_invalid,
                        "items": purchase_items,
                    }
                )
            return self._normalize_purchases_for_storage(purchases)

        raise ValueError("Collection đồng bộ không hợp lệ.")

    def _replace_sync_collection_records(
        self,
        connection: sqlite3.Connection,
        state_key: str,
        records: list[dict],
    ) -> None:
        if state_key == "customers":
            connection.execute("DELETE FROM customers")
            for record in records:
                name = str(record.get("name") or "").strip()
                if not name:
                    continue
                connection.execute(
                    """
                    INSERT INTO customers(id, name, phone, address, zalo_url, created_at, updated_at, deleted_at)
                    VALUES(?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        str(record.get("id") or f"customer_{secrets.token_hex(6)}"),
                        name,
                        str(record.get("phone") or "").strip(),
                        str(record.get("address") or "").strip(),
                        str(record.get("zaloUrl") or record.get("zalo_url") or "").strip(),
                        str(record.get("createdAt") or record.get("created_at") or utc_now_iso()),
                        str(record.get("updatedAt") or record.get("updated_at") or record.get("createdAt") or utc_now_iso()),
                        record.get("deletedAt") or record.get("deleted_at"),
                    ),
                )
            return

        if state_key == "suppliers":
            connection.execute("DELETE FROM suppliers")
            for record in records:
                name = str(record.get("name") or "").strip()
                if not name:
                    continue
                connection.execute(
                    """
                    INSERT INTO suppliers(id, name, phone, address, note, created_at, updated_at, deleted_at)
                    VALUES(?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        str(record.get("id") or f"supplier_{secrets.token_hex(6)}"),
                        name,
                        str(record.get("phone") or "").strip(),
                        str(record.get("address") or "").strip(),
                        str(record.get("note") or "").strip(),
                        str(record.get("createdAt") or record.get("created_at") or utc_now_iso()),
                        str(record.get("updatedAt") or record.get("updated_at") or record.get("createdAt") or utc_now_iso()),
                        record.get("deletedAt") or record.get("deleted_at"),
                    ),
                )
            return

        if state_key == "carts":
            connection.execute("DELETE FROM cart_items")
            connection.execute("DELETE FROM carts")
            for record in records:
                cart_id = str(record.get("id") or f"cart_{secrets.token_hex(6)}")
                discount_amount = self._get_cart_discount_amount(record)
                connection.execute(
                    """
                    INSERT INTO carts(
                        id, customer_id, customer_name, status, payment_status, discount_amount, ship_address, created_at, updated_at,
                        committed_at, completed_at, cancelled_at, paid_at, order_code
                    )
                    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        cart_id,
                        str(record.get("customerId") or "").strip(),
                        str(record.get("customerName") or "").strip(),
                        str(record.get("status") or "draft"),
                        str(record.get("paymentStatus") or "unpaid"),
                        discount_amount,
                        str(record.get("shipAddress") or record.get("ship_address") or "").strip(),
                        str(record.get("createdAt") or record.get("created_at") or utc_now_iso()),
                        str(record.get("updatedAt") or record.get("updated_at") or record.get("createdAt") or utc_now_iso()),
                        record.get("committedAt") or record.get("committed_at"),
                        record.get("completedAt") or record.get("completed_at"),
                        record.get("cancelledAt") or record.get("cancelled_at"),
                        record.get("paidAt") or record.get("paid_at"),
                        str(record.get("orderCode") or record.get("order_code") or ""),
                    ),
                )
                for index, item in enumerate(record.get("items") or []):
                    connection.execute(
                        """
                        INSERT INTO cart_items(id, cart_id, product_id, product_name, quantity, unit_price, note, sort_order)
                        VALUES(?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            str(item.get("id") or f"cart_item_{secrets.token_hex(6)}"),
                            cart_id,
                            int(item.get("productId") or item.get("product_id") or 0),
                            str(item.get("productName") or item.get("product_name") or "").strip(),
                            float(item.get("quantity") or 0),
                            float(item.get("unitPrice") or item.get("unit_price") or 0),
                            str(item.get("note") or "").strip(),
                            index,
                        ),
                    )
            return

        if state_key == "purchases":
            connection.execute("DELETE FROM purchase_items")
            connection.execute("DELETE FROM purchases")
            for record in self._normalize_purchases_for_storage(records):
                purchase_id = str(record.get("id") or f"purchase_{secrets.token_hex(6)}")
                discount_amount = self._get_purchase_discount_amount(record)
                connection.execute(
                    """
                    INSERT INTO purchases(
                        id, supplier_id, supplier_name, note, source_type, source_code, source_name,
                        status, discount_amount, created_at, updated_at, ordered_at, received_at, paid_at, receipt_code
                    )
                    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        purchase_id,
                        str(record.get("supplierId") or "").strip(),
                        str(record.get("supplierName") or "").strip(),
                        str(record.get("note") or "").strip(),
                        str(record.get("sourceType") or record.get("source_type") or "").strip(),
                        str(record.get("sourceCode") or record.get("source_code") or "").strip(),
                        str(record.get("sourceName") or record.get("source_name") or "").strip(),
                        str(record.get("status") or "draft"),
                        discount_amount,
                        str(record.get("createdAt") or record.get("created_at") or utc_now_iso()),
                        str(record.get("updatedAt") or record.get("updated_at") or record.get("createdAt") or utc_now_iso()),
                        str(record.get("orderedAt") or record.get("ordered_at") or ""),
                        record.get("receivedAt") or record.get("received_at"),
                        record.get("paidAt") or record.get("paid_at"),
                        str(record.get("receiptCode") or record.get("receipt_code") or ""),
                    ),
                )
                for index, item in enumerate(record.get("items") or []):
                    product_id = int(item.get("productId") or item.get("product_id") or 0)
                    product = self._get_product_or_raise(connection, product_id) if product_id > 0 else None
                    if product is not None:
                        expiry_metadata = self._resolve_purchase_item_expiry_metadata(
                            raw_item=item,
                            product=product,
                            received_at=str(record.get("receivedAt") or record.get("received_at") or ""),
                            field_prefix=f'Dòng nhập của "{product["name"]}"',
                        )
                    else:
                        expiry_metadata = {
                            "expiry_input_mode": self._normalize_purchase_expiry_input_mode(
                                item.get("expiryInputMode") or item.get("expiry_input_mode") or "direct"
                            ),
                            "manufacture_date": self._normalize_expiry_date(
                                item.get("manufactureDate") or item.get("manufacture_date"),
                                field_name="Ngày sản xuất lô nhập",
                            ),
                            "expiry_date": self._normalize_expiry_date(
                                item.get("expiryDate") or item.get("expiry_date"),
                                field_name="Hạn dùng lô nhập",
                            ),
                        }
                    connection.execute(
                        """
                        INSERT INTO purchase_items(
                            id, purchase_id, product_id, product_name, source_kind, source_note, quantity, unit_cost, batch_code,
                            expiry_input_mode, manufacture_date, expiry_date, sort_order
                        )
                        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            str(item.get("id") or f"purchase_item_{secrets.token_hex(6)}"),
                            purchase_id,
                            product_id,
                            str(item.get("productName") or item.get("product_name") or "").strip(),
                            str(item.get("sourceKind") or item.get("source_kind") or "shortage").strip() or "shortage",
                            str(item.get("sourceNote") or item.get("source_note") or "").strip(),
                            float(item.get("quantity") or 0),
                            float(item.get("unitCost") or item.get("unit_cost") or 0),
                            str(item.get("batchCode") or item.get("batch_code") or "").strip(),
                            expiry_metadata["expiry_input_mode"],
                            expiry_metadata["manufacture_date"],
                            expiry_metadata["expiry_date"],
                            index,
                        ),
                    )
            return

        raise ValueError("Collection đồng bộ không hợp lệ.")

    def _insert_inventory_receipt(
        self,
        connection: sqlite3.Connection,
        *,
        receipt_code: str,
        receipt_type: str,
        customer_id: str = "",
        customer_name: str = "",
        supplier_id: str = "",
        supplier_name: str = "",
        source_type: str = "",
        source_code: str = "",
        actor: str = "",
        reason: str = "",
        note: str = "",
        discount_amount: float = 0,
        created_at: str,
    ) -> int:
        cursor = connection.execute(
            """
            INSERT OR IGNORE INTO inventory_receipts(
                receipt_code, receipt_type, customer_id, customer_name, supplier_id, supplier_name,
                source_type, source_code, actor, reason, note, discount_amount, created_at
            )
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                receipt_code,
                receipt_type,
                customer_id,
                customer_name,
                supplier_id,
                supplier_name,
                source_type,
                source_code,
                actor,
                reason,
                note,
                discount_amount,
                created_at,
            ),
        )
        if cursor.lastrowid:
            return int(cursor.lastrowid)
        row = connection.execute(
            "SELECT id FROM inventory_receipts WHERE receipt_code = ?",
            (receipt_code,),
        ).fetchone()
        return int(row["id"])

    def _insert_inventory_receipt_item(
        self,
        connection: sqlite3.Connection,
        *,
        receipt_id: int,
        product_id: int,
        product_name: str,
        unit: str,
        transaction_type: str,
        quantity: float,
        unit_amount: float | None,
        line_total: float | None,
        stock_after: float | None,
        transaction_id: int | None,
        purchase_item_id: str = "",
        batch_id: int | None = None,
        batch_code: str = "",
        expiry_date: str | None = None,
    ) -> None:
        connection.execute(
            """
            INSERT INTO inventory_receipt_items(
                receipt_id, product_id, product_name, unit, transaction_type, quantity,
                unit_amount, line_total, stock_after, transaction_id, purchase_item_id, batch_id, batch_code, expiry_date
            )
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                receipt_id,
                product_id,
                product_name,
                unit,
                transaction_type,
                quantity,
                unit_amount,
                line_total,
                stock_after,
                transaction_id,
                str(purchase_item_id or "").strip(),
                batch_id,
                batch_code,
                expiry_date,
            ),
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
            SELECT
                id, name, category, unit, price, sale_price, low_stock_threshold,
                shelf_life_days, storage_life_days, is_deleted, deleted_at
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
        actor: str = "",
        message: str = "",
    ) -> None:
        connection.execute(
            """
            INSERT INTO audit_logs(entity_type, entity_id, entity_name, action, actor, message, created_at)
            VALUES(?, ?, ?, ?, ?, ?, ?)
            """,
            (entity_type, str(entity_id), entity_name, action, (actor or "").strip(), message, utc_now_iso()),
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
                    p.shelf_life_days,
                    p.storage_life_days,
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
            return self._serialize_product_rows(connection, rows)

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
        shelf_life_days: str | int | float | None = None,
        storage_life_days: str | int | float | None = None,
    ) -> tuple[str, str, str, float, float, float, float | None, float | None]:
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
        parsed_shelf_life_days = parse_optional_positive_decimal(
            shelf_life_days,
            "Hạn dùng",
        )
        parsed_storage_life_days = parse_optional_positive_decimal(
            storage_life_days,
            "Thời gian bảo quản",
        )
        return (
            clean_name,
            clean_category,
            clean_unit,
            float(threshold),
            float(parsed_price),
            float(parsed_sale_price),
            None if parsed_shelf_life_days is None else float(parsed_shelf_life_days),
            None if parsed_storage_life_days is None else float(parsed_storage_life_days),
        )

    @staticmethod
    def _format_product_audit_value(value) -> str:
        if value is None:
            return "(trống)"
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return f"{float(value):g}"
        clean_text = str(value).strip()
        if not clean_text:
            return "(trống)"
        return f'"{clean_text}"'

    def _build_product_update_audit_message(self, current_product: sqlite3.Row, *, next_values: dict) -> str:
        field_specs = (
            ("name", "Tên sản phẩm"),
            ("category", "Loại thực phẩm"),
            ("unit", "Đơn vị tính"),
            ("price", "Giá nhập"),
            ("sale_price", "Giá bán"),
            ("low_stock_threshold", "Ngưỡng cảnh báo"),
            ("shelf_life_days", "Hạn dùng (ngày)"),
            ("storage_life_days", "Bảo quản (ngày)"),
        )
        changes: list[str] = []
        for field_name, label in field_specs:
            previous_value = current_product[field_name]
            next_value = next_values[field_name]
            if previous_value == next_value:
                continue
            changes.append(
                f"{label}: {self._format_product_audit_value(previous_value)} -> "
                f"{self._format_product_audit_value(next_value)}"
            )
        if not changes:
            return "Lưu lại sản phẩm, không thay đổi dữ liệu."
        return "Cập nhật sản phẩm: " + "; ".join(changes) + "."

    def create_product(
        self,
        name: str,
        category: str,
        unit: str,
        low_stock_threshold: str | int | float = 5,
        price: str | int | float = 0,
        sale_price: str | int | float | None = None,
        shelf_life_days: str | int | float | None = None,
        storage_life_days: str | int | float | None = None,
        actor: str = "",
    ) -> dict:
        (
            clean_name,
            clean_category,
            clean_unit,
            threshold,
            parsed_price,
            parsed_sale_price,
            parsed_shelf_life_days,
            parsed_storage_life_days,
        ) = self._prepare_product_inputs(
            name,
            category,
            unit,
            low_stock_threshold,
            price,
            sale_price,
            shelf_life_days,
            storage_life_days,
        )
        now = utc_now_iso()

        with self._connect() as connection:
            try:
                cursor = connection.execute(
                    """
                    INSERT INTO products(
                        name,
                        category,
                        unit,
                        price,
                        sale_price,
                        low_stock_threshold,
                        shelf_life_days,
                        storage_life_days,
                        created_at,
                        updated_at
                    )
                    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        clean_name,
                        clean_category,
                        clean_unit,
                        parsed_price,
                        parsed_sale_price,
                        float(threshold),
                        parsed_shelf_life_days,
                        parsed_storage_life_days,
                        now,
                        now,
                    ),
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
                actor=actor,
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
        shelf_life_days: str | int | float | None = None,
        storage_life_days: str | int | float | None = None,
    ) -> bool:
        (
            clean_name,
            clean_category,
            clean_unit,
            threshold,
            parsed_price,
            parsed_sale_price,
            parsed_shelf_life_days,
            parsed_storage_life_days,
        ) = self._prepare_product_inputs(
            name,
            category,
            unit,
            low_stock_threshold,
            price,
            sale_price,
            shelf_life_days,
            storage_life_days,
        )
        now = utc_now_iso()

        with self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT OR IGNORE INTO products(
                    name,
                    category,
                    unit,
                    price,
                    sale_price,
                    low_stock_threshold,
                    shelf_life_days,
                    storage_life_days,
                    created_at,
                    updated_at
                )
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    clean_name,
                    clean_category,
                    clean_unit,
                    parsed_price,
                    parsed_sale_price,
                    threshold,
                    parsed_shelf_life_days,
                    parsed_storage_life_days,
                    now,
                    now,
                ),
            )
            return cursor.rowcount > 0

    def update_product_price(self, product_id: int, price: str | int | float, actor: str = "") -> dict:
        parsed_price = float(parse_non_negative_decimal(price, "Giá nhập"))
        now = utc_now_iso()

        with self._connect() as connection:
            current_product = self._get_product_or_raise(connection, int(product_id))
            connection.execute(
                "UPDATE products SET price = ?, updated_at = ? WHERE id = ?",
                (parsed_price, now, int(product_id)),
            )
            self._record_audit(
                connection,
                entity_type="product",
                entity_id=product_id,
                entity_name=current_product["name"],
                action="update-price",
                actor=actor,
                message=(
                    "Cập nhật giá nhập: "
                    f"{self._format_product_audit_value(current_product['price'])} -> "
                    f"{self._format_product_audit_value(parsed_price)}."
                ),
            )

        return self.get_product_by_id(int(product_id))

    def update_product_sale_price(self, product_id: int, sale_price: str | int | float, actor: str = "") -> dict:
        parsed_sale_price = float(parse_non_negative_decimal(sale_price, "Giá bán"))
        now = utc_now_iso()

        with self._connect() as connection:
            current_product = self._get_product_or_raise(connection, int(product_id))
            connection.execute(
                "UPDATE products SET sale_price = ?, updated_at = ? WHERE id = ?",
                (parsed_sale_price, now, int(product_id)),
            )
            self._record_audit(
                connection,
                entity_type="product",
                entity_id=product_id,
                entity_name=current_product["name"],
                action="update-sale-price",
                actor=actor,
                message=(
                    "Cập nhật giá bán: "
                    f"{self._format_product_audit_value(current_product['sale_price'])} -> "
                    f"{self._format_product_audit_value(parsed_sale_price)}."
                ),
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
        shelf_life_days: str | int | float | None = None,
        storage_life_days: str | int | float | None = None,
        actor: str = "",
    ) -> dict:
        (
            clean_name,
            clean_category,
            clean_unit,
            threshold,
            parsed_price,
            parsed_sale_price,
            parsed_shelf_life_days,
            parsed_storage_life_days,
        ) = self._prepare_product_inputs(
            name,
            category,
            unit,
            low_stock_threshold,
            price,
            sale_price,
            shelf_life_days,
            storage_life_days,
        )
        now = utc_now_iso()

        with self._connect() as connection:
            current_product = self._get_product_or_raise(connection, int(product_id))
            try:
                connection.execute(
                    """
                    UPDATE products
                    SET name = ?,
                        category = ?,
                        unit = ?,
                        price = ?,
                        sale_price = ?,
                        low_stock_threshold = ?,
                        shelf_life_days = ?,
                        storage_life_days = ?,
                        updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        clean_name,
                        clean_category,
                        clean_unit,
                        parsed_price,
                        parsed_sale_price,
                        threshold,
                        parsed_shelf_life_days,
                        parsed_storage_life_days,
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
            audit_message = self._build_product_update_audit_message(
                current_product,
                next_values={
                    "name": clean_name,
                    "category": clean_category,
                    "unit": clean_unit,
                    "price": parsed_price,
                    "sale_price": parsed_sale_price,
                    "low_stock_threshold": threshold,
                    "shelf_life_days": parsed_shelf_life_days,
                    "storage_life_days": parsed_storage_life_days,
                },
            )
            self._record_audit(
                connection,
                entity_type="product",
                entity_id=product_id,
                entity_name=clean_name,
                action="update",
                actor=actor,
                message=audit_message,
            )

        return self.get_product_by_id(int(product_id))

    def delete_product(self, product_id: int, actor: str = "") -> dict:
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
                actor=actor,
                message="Đưa sản phẩm vào danh mục đã xóa.",
            )
            return {
                "product_id": int(product_id),
                "product_name": product["name"],
                "impacts": impacts,
            }

    def restore_product(self, product_id: int, actor: str = "") -> dict:
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
                actor=actor,
                message="Khôi phục sản phẩm về danh mục đang dùng.",
            )
        return self.get_product_by_id(int(product_id))

    def get_deleted_products(self) -> list[dict]:
        return [product for product in self.get_products(include_deleted=True) if product["is_deleted"]]

    def get_product_history(
        self,
        limit: int = 40,
        actor: str = "",
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict]:
        safe_limit = max(1, min(int(limit), 200))
        clean_actor = (actor or "").strip().lower()
        clauses = ["entity_type = 'product'"]
        params: list = []
        if clean_actor:
            clauses.append("LOWER(actor) = ?")
            params.append(clean_actor)
        if start_date:
            clauses.append("created_at >= ?")
            params.append(str(start_date))
        if end_date:
            clauses.append("created_at <= ?")
            params.append(str(end_date))
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, entity_id, entity_name, action, actor, message, created_at
                FROM audit_logs
                WHERE {where_clause}
                ORDER BY created_at DESC, id DESC
                LIMIT ?
                """.format(where_clause=" AND ".join(clauses)),
                (*params, safe_limit),
            ).fetchall()
        return [
            {
                "id": row["id"],
                "product_id": int(row["entity_id"]),
                "product_name": row["entity_name"],
                "action": row["action"],
                "actor": row["actor"] or "",
                "message": row["message"],
                "created_at": row["created_at"],
            }
            for row in rows
        ]

    def get_receipt_history(
        self,
        limit: int = 40,
        start_date: str | None = None,
        end_date: str | None = None,
        receipt_type: str = "",
    ) -> list[dict]:
        safe_limit = max(1, min(int(limit), 200))
        clean_receipt_type = (receipt_type or "").strip()
        clauses = [f"ir.receipt_type IN ({','.join('?' for _ in PHASE_B_RECEIPT_TYPES)})"]
        params: list = list(PHASE_B_RECEIPT_TYPES)
        if clean_receipt_type in PHASE_B_RECEIPT_TYPES:
            clauses.append("ir.receipt_type = ?")
            params.append(clean_receipt_type)
        if start_date:
            clauses.append("ir.created_at >= ?")
            params.append(str(start_date))
        if end_date:
            clauses.append("ir.created_at <= ?")
            params.append(str(end_date))
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    ir.receipt_code,
                    ir.receipt_type,
                    ir.customer_name,
                    ir.supplier_name,
                    ir.actor,
                    ir.reason,
                    ir.note,
                    ir.source_type,
                    ir.source_code,
                    ir.created_at,
                    al.message AS audit_message,
                    COUNT(iri.id) AS item_count,
                    COALESCE(SUM(iri.quantity), 0) AS total_quantity,
                    COALESCE(SUM(iri.line_total), 0) AS total_amount
                FROM inventory_receipts ir
                LEFT JOIN inventory_receipt_items iri ON iri.receipt_id = ir.id
                LEFT JOIN audit_logs al
                  ON al.entity_id = ir.receipt_code
                 AND al.entity_type = ir.receipt_type
                 AND al.action = 'create'
                WHERE {where_clause}
                GROUP BY
                    ir.receipt_code, ir.receipt_type, ir.customer_name, ir.supplier_name, ir.actor,
                    ir.reason, ir.note, ir.source_type, ir.source_code, ir.created_at, al.message
                ORDER BY ir.created_at DESC, ir.id DESC
                LIMIT ?
                """.format(where_clause=" AND ".join(clauses)),
                (*params, safe_limit),
            ).fetchall()
        return [
            {
                "receipt_code": row["receipt_code"],
                "receipt_type": row["receipt_type"],
                "customer_name": row["customer_name"] or "",
                "supplier_name": row["supplier_name"] or "",
                "actor": row["actor"] or "",
                "reason": row["reason"] or "",
                "note": row["note"] or "",
                "source_type": row["source_type"] or "",
                "source_code": row["source_code"] or "",
                "created_at": row["created_at"],
                "audit_message": row["audit_message"] or "",
                "item_count": int(row["item_count"] or 0),
                "total_quantity": round(float(row["total_quantity"] or 0), 2),
                "total_amount": round(float(row["total_amount"] or 0), 2),
            }
            for row in rows
        ]

    def reset_all_data(self) -> None:
        with self._connect() as connection:
            existing_tables = {
                row["name"]
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table'"
                ).fetchall()
            }

            # Xóa theo thứ tự từ bảng con -> bảng cha để tránh lỗi FOREIGN KEY.
            reset_order = [
                "inventory_batch_allocations",
                "inventory_batches",
                "inventory_receipt_items",
                "inventory_receipts",
                "cart_items",
                "purchase_items",
                "transactions",
                "carts",
                "purchases",
                "audit_logs",
                "customers",
                "suppliers",
                "products",
                "app_state",
            ]
            for table_name in reset_order:
                if table_name in existing_tables:
                    connection.execute(f"DELETE FROM {table_name}")

            if "sqlite_sequence" in existing_tables:
                sequence_tables = tuple(
                    table_name
                    for table_name in (
                        "products",
                        "transactions",
                        "audit_logs",
                        "inventory_receipts",
                        "inventory_receipt_items",
                        "inventory_batches",
                        "inventory_batch_allocations",
                    )
                    if table_name in existing_tables
                )
                if sequence_tables:
                    placeholders = ",".join("?" for _ in sequence_tables)
                    connection.execute(
                        f"DELETE FROM sqlite_sequence WHERE name IN ({placeholders})",
                        sequence_tables,
                    )

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
                    p.shelf_life_days,
                    p.storage_life_days,
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
            return self._serialize_product_rows(connection, [row])[0]

    def create_transaction(
        self,
        product_id: int,
        transaction_type: str,
        quantity,
        note: str = "",
        adjustment_reason: str = "",
        actor: str = "",
        batch_code: str = "",
        expiry_date: str | None = None,
    ) -> dict:
        if transaction_type not in {"in", "out"}:
            raise ValueError("Loại giao dịch không hợp lệ.")

        amount = parse_positive_decimal(quantity, "Số lượng")
        clean_note = (note or "").strip()
        clean_adjustment_reason = (adjustment_reason or "").strip()
        clean_actor = (actor or "").strip()
        now = utc_now_iso()

        with self._connect() as connection:
            product = self._get_product_or_raise(connection, int(product_id))
            current_stock = self._get_stock_for_product(connection, int(product_id))

            if transaction_type == "out" and amount > current_stock:
                raise ValueError("Số lượng xuất lớn hơn tồn kho hiện tại.")

            if clean_adjustment_reason:
                clean_note = f"Điều chỉnh trực tiếp bởi {clean_actor or 'Master Admin'} | Lý do: {clean_adjustment_reason}"
                self._record_audit(
                    connection,
                    entity_type="product",
                    entity_id=product["id"],
                    entity_name=product["name"],
                    action="direct_adjustment",
                    actor=clean_actor,
                    message=clean_note,
                )
            elif clean_actor:
                raise ValueError("Master Admin phải nhập lý do khi chỉnh tồn trực tiếp.")

            cursor = connection.execute(
                """
                INSERT INTO transactions(product_id, transaction_type, quantity, note, created_at)
                VALUES(?, ?, ?, ?, ?)
                """,
                (int(product_id), transaction_type, float(amount), clean_note, now),
            )

            allocations: list[dict] = []
            created_batch: dict | None = None
            if transaction_type == "in":
                fallback_batch_code = f"ADJ-{int(product_id)}-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{cursor.lastrowid}"
                created_batch = self._create_inventory_batch(
                    connection,
                    product=product,
                    quantity=amount,
                    unit_cost=Decimal(str(product["price"] or 0)),
                    received_at=now,
                    source_transaction_id=int(cursor.lastrowid),
                    transaction_id=int(cursor.lastrowid),
                    batch_code=batch_code,
                    expiry_date=expiry_date,
                    note=clean_note,
                    fallback_batch_code=fallback_batch_code,
                )
                clean_note = " | ".join(
                    part
                    for part in (
                        clean_note,
                        self._format_batch_allocations_note(
                            [created_batch],
                            prefix="Lô nhập",
                        ),
                    )
                    if part
                )
            else:
                allocations = self._consume_inventory_batches(
                    connection,
                    product_id=int(product_id),
                    quantity=amount,
                    transaction_id=int(cursor.lastrowid),
                    created_at=now,
                )
                clean_note = " | ".join(
                    part
                    for part in (
                        clean_note,
                        self._format_batch_allocations_note(
                            allocations,
                            prefix="Lô xuất FIFO",
                        ),
                    )
                    if part
                )
            if clean_note:
                connection.execute(
                    "UPDATE transactions SET note = ? WHERE id = ?",
                    (clean_note, int(cursor.lastrowid)),
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
            "lot_allocations": allocations,
            "created_batch": created_batch,
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
            allocation_map = self._get_batch_allocations_for_transactions(
                connection,
                [int(row["id"]) for row in rows],
            )

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
                "lot_allocations": allocation_map.get(int(row["id"]), []),
            }
            for row in rows
        ]

    @staticmethod
    def _build_order_code(customer_name: str, created_at: str) -> str:
        order_suffix = hashlib.sha1(f"{customer_name}-{created_at}".encode("utf-8")).hexdigest()[:6]
        return f"DH-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{order_suffix}"

    @staticmethod
    def _group_sale_items(raw_items: list[dict]) -> dict[int, dict]:
        grouped_items: dict[int, dict] = {}
        for raw_item in raw_items:
            product_id = int(raw_item.get("product_id") or raw_item.get("productId") or 0)
            quantity = parse_positive_decimal(raw_item.get("quantity"), "Số lượng")
            unit_price = parse_non_negative_decimal(
                raw_item.get("unit_price") or raw_item.get("unitPrice") or 0,
                "Giá bán",
            )
            item_note = str(raw_item.get("note") or "").strip()
            existing = grouped_items.get(product_id)
            if existing:
                existing["quantity"] += quantity
                existing["unit_price"] = unit_price
                if item_note:
                    existing["note"] = item_note
                continue
            grouped_items[product_id] = {
                "product_id": product_id,
                "quantity": quantity,
                "unit_price": unit_price,
                "note": item_note,
            }
        return grouped_items

    def _validate_sale_items_against_physical_stock(
        self,
        connection: sqlite3.Connection,
        grouped_items: dict[int, dict],
    ) -> tuple[dict[int, sqlite3.Row], dict[int, Decimal]]:
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
        return products_by_id, current_stock_by_id

    def _get_reserved_quantity_for_committed_orders(
        self,
        connection: sqlite3.Connection,
        product_id: int,
        *,
        exclude_cart_id: str = "",
    ) -> Decimal:
        query = """
            SELECT COALESCE(SUM(ci.quantity), 0) AS reserved_quantity
            FROM carts c
            JOIN cart_items ci ON ci.cart_id = c.id
            WHERE c.status = 'committed'
              AND ci.product_id = ?
        """
        params: list[object] = [int(product_id)]
        if exclude_cart_id:
            query += " AND c.id != ?"
            params.append(str(exclude_cart_id))
        row = connection.execute(query, tuple(params)).fetchone()
        return Decimal(str(row["reserved_quantity"] or 0))

    def _get_ordered_incoming_quantity_for_product(
        self,
        connection: sqlite3.Connection,
        product_id: int,
    ) -> Decimal:
        row = connection.execute(
            """
            SELECT COALESCE(SUM(pi.quantity), 0) AS ordered_incoming_quantity
            FROM purchases p
            JOIN purchase_items pi ON pi.purchase_id = p.id
            WHERE p.status = 'ordered'
              AND pi.product_id = ?
            """,
            (int(product_id),),
        ).fetchone()
        return Decimal(str(row["ordered_incoming_quantity"] or 0))

    def _validate_sale_items_against_committed_availability(
        self,
        connection: sqlite3.Connection,
        grouped_items: dict[int, dict],
        *,
        exclude_cart_id: str = "",
    ) -> tuple[dict[int, sqlite3.Row], dict[int, Decimal], dict[int, Decimal]]:
        products_by_id: dict[int, sqlite3.Row] = {}
        current_stock_by_id: dict[int, Decimal] = {}
        reserved_by_id: dict[int, Decimal] = {}
        for product_id, item in grouped_items.items():
            product = self._get_product_or_raise(connection, product_id)
            current_stock = self._get_stock_for_product(connection, product_id)
            reserved_quantity = self._get_reserved_quantity_for_committed_orders(
                connection,
                product_id,
                exclude_cart_id=exclude_cart_id,
            )
            ordered_incoming_quantity = self._get_ordered_incoming_quantity_for_product(
                connection,
                product_id,
            )
            available_quantity = current_stock + ordered_incoming_quantity - reserved_quantity
            safe_available_quantity = max(Decimal("0"), available_quantity)
            if item["quantity"] > safe_available_quantity:
                raise ValueError(
                    f"Không đủ hàng để chốt đơn cho {product['name']}. "
                    f"Tồn thực tế {float(current_stock):g}, đã giữ {float(reserved_quantity):g}, "
                    f"đã đặt nhập {float(ordered_incoming_quantity):g}, khả dụng để chốt {float(safe_available_quantity):g}."
                )
            products_by_id[product_id] = product
            current_stock_by_id[product_id] = current_stock
            reserved_by_id[product_id] = reserved_quantity
        return products_by_id, current_stock_by_id, reserved_by_id

    def _create_sale_transactions_for_order(
        self,
        connection: sqlite3.Connection,
        *,
        order_code: str,
        customer_name: str,
        grouped_items: dict[int, dict],
        products_by_id: dict[int, sqlite3.Row],
        current_stock_by_id: dict[int, Decimal],
        created_at: str,
        note: str = "",
        discount_amount=0,
    ) -> dict:
        clean_customer_name = str(customer_name or "").strip()
        clean_note = str(note or "").strip()
        subtotal_amount = Decimal("0")
        total_quantity = Decimal("0")
        for item in grouped_items.values():
            subtotal_amount += item["quantity"] * item["unit_price"]
        validated_discount_amount = self._validate_discount_amount(
            discount_amount,
            subtotal_amount,
            "Giảm giá khuyến mại phiếu xuất",
        )

        transactions = []
        for product_id, item in grouped_items.items():
            product = products_by_id[product_id]
            line_total = item["quantity"] * item["unit_price"]
            total_quantity += item["quantity"]
            base_transaction_note = (
                f"Đơn {order_code} | Khách: {clean_customer_name} | Giá bán: {float(item['unit_price']):.0f}"
            )
            if validated_discount_amount > 0:
                base_transaction_note += f" | Giảm giá KM: {validated_discount_amount:.0f}"
            if clean_note:
                base_transaction_note += f" | {clean_note}"
            if item["note"]:
                base_transaction_note += f" | {item['note']}"

            cursor = connection.execute(
                """
                INSERT INTO transactions(product_id, transaction_type, quantity, note, created_at)
                VALUES(?, 'out', ?, ?, ?)
                """,
                (product_id, float(item["quantity"]), base_transaction_note, created_at),
            )
            lot_allocations = self._consume_inventory_batches(
                connection,
                product_id=product_id,
                quantity=item["quantity"],
                transaction_id=int(cursor.lastrowid),
                created_at=created_at,
            )
            total_cost = sum(
                Decimal(str(allocation["quantity"])) * Decimal(str(allocation["unit_cost"]))
                for allocation in lot_allocations
            )
            unit_cost_snapshot = round(
                float(total_cost / item["quantity"]) if item["quantity"] > 0 else float(product["price"] or 0),
                2,
            )
            transaction_note = " | ".join(
                part
                for part in (
                    base_transaction_note,
                    f"Giá vốn: {unit_cost_snapshot:.2f}",
                    self._format_batch_allocations_note(
                        lot_allocations,
                        prefix="Lô xuất FIFO",
                    ),
                )
                if part
            )
            connection.execute(
                "UPDATE transactions SET note = ? WHERE id = ?",
                (transaction_note, int(cursor.lastrowid)),
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
                    "unit_cost": unit_cost_snapshot,
                    "line_total": round(float(line_total), 2),
                    "note": item["note"],
                    "remaining_stock": round(float(remaining_stock), 2),
                    "lot_allocations": lot_allocations,
                }
            )

        net_total_amount = subtotal_amount - Decimal(str(validated_discount_amount))
        return {
            "transactions": transactions,
            "total_quantity": round(float(total_quantity), 2),
            "subtotal_amount": round(float(subtotal_amount), 2),
            "discount_amount": round(float(validated_discount_amount), 2),
            "total_amount": round(float(net_total_amount), 2),
        }

    def _refresh_sync_collection_cache(
        self,
        connection: sqlite3.Connection,
        state_key: str,
        *,
        updated_at: str | None = None,
    ) -> list[dict]:
        canonical = self._load_sync_collection_from_tables(connection, state_key)
        connection.execute(
            """
            UPDATE app_state
            SET state_value = ?, updated_at = ?
            WHERE state_key = ?
            """,
            (
                json.dumps(canonical, ensure_ascii=False),
                str(updated_at or utc_now_iso()),
                state_key,
            ),
        )
        return canonical

    def _get_cart_document(self, connection: sqlite3.Connection, cart_id: str) -> dict:
        row = connection.execute(
            """
            SELECT id, customer_id, customer_name, status, payment_status, discount_amount, ship_address, created_at, updated_at,
                   committed_at, completed_at, cancelled_at, paid_at, order_code
            FROM carts
            WHERE id = ?
            """,
            (str(cart_id),),
        ).fetchone()
        if not row:
            raise ValueError("Không tìm thấy đơn hàng.")
        item_rows = connection.execute(
            """
            SELECT id, cart_id, product_id, product_name, quantity, unit_price, note, sort_order
            FROM cart_items
            WHERE cart_id = ?
            ORDER BY sort_order, id
            """,
            (str(cart_id),),
        ).fetchall()
        return {
            "id": row["id"],
            "customerId": row["customer_id"] or "",
            "customerName": row["customer_name"] or "",
            "status": row["status"] or "draft",
            "paymentStatus": row["payment_status"] or "unpaid",
            "discountAmount": round(float(row["discount_amount"] or 0), 2),
            "discount_amount": round(float(row["discount_amount"] or 0), 2),
            "shipAddress": row["ship_address"] or "",
            "ship_address": row["ship_address"] or "",
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
            "committedAt": row["committed_at"],
            "committed_at": row["committed_at"],
            "completedAt": row["completed_at"],
            "cancelledAt": row["cancelled_at"],
            "paidAt": row["paid_at"],
            "orderCode": row["order_code"] or "",
            "items": [self._serialize_cart_item_row(item_row) for item_row in item_rows],
        }

    @staticmethod
    def _format_bulk_quantity(value: float) -> str:
        return f"{float(value):g}"

    def _collect_committed_availability_shortages(
        self,
        connection: sqlite3.Connection,
        grouped_items: dict[int, dict],
        *,
        exclude_cart_id: str = "",
    ) -> list[dict]:
        shortages: list[dict] = []
        for product_id, item in grouped_items.items():
            product = self._get_product_or_raise(connection, product_id)
            current_stock = self._get_stock_for_product(connection, product_id)
            reserved_quantity = self._get_reserved_quantity_for_committed_orders(
                connection,
                product_id,
                exclude_cart_id=exclude_cart_id,
            )
            ordered_incoming_quantity = self._get_ordered_incoming_quantity_for_product(
                connection,
                product_id,
            )
            available_quantity = max(
                Decimal("0"),
                current_stock + ordered_incoming_quantity - reserved_quantity,
            )
            if item["quantity"] <= available_quantity:
                continue
            shortages.append(
                {
                    "product_id": int(product_id),
                    "product_name": str(product["name"] or "").strip(),
                    "required_quantity": round(float(item["quantity"]), 2),
                    "available_quantity": round(float(available_quantity), 2),
                    "shortage_quantity": round(float(item["quantity"] - available_quantity), 2),
                    "current_stock": round(float(current_stock), 2),
                    "reserved_quantity": round(float(reserved_quantity), 2),
                    "ordered_incoming_quantity": round(float(ordered_incoming_quantity), 2),
                    "message": (
                        f"Thiếu {str(product['name'] or '').strip()}: "
                        f"cần {self._format_bulk_quantity(float(item['quantity']))}, "
                        f"còn {self._format_bulk_quantity(float(available_quantity))}"
                    ),
                }
            )
        return shortages

    def _commit_cart_order_in_connection(
        self,
        connection: sqlite3.Connection,
        cart_id: str,
        *,
        actor: str = "",
        committed_at: str,
    ) -> dict:
        clean_cart_id = str(cart_id or "").strip()
        cart = self._get_cart_document(connection, clean_cart_id)
        previous_status = str(cart.get("status") or "draft")
        if previous_status != "draft":
            raise ValueError("Chỉ đơn nháp mới được chốt đơn.")
        if not cart.get("items"):
            raise ValueError("Giỏ hàng đang trống.")
        clean_customer_name = str(cart.get("customerName") or "").strip()
        if not clean_customer_name:
            raise ValueError("Khách hàng là bắt buộc.")

        grouped_items = self._group_sale_items(cart.get("items") or [])
        shortages = self._collect_committed_availability_shortages(
            connection,
            grouped_items,
            exclude_cart_id=clean_cart_id,
        )
        if shortages:
            raise ValueError(shortages[0]["message"])

        order_code = str(cart.get("orderCode") or "").strip() or self._build_order_code(clean_customer_name, committed_at)
        connection.execute(
            """
            UPDATE carts
            SET status = 'committed',
                payment_status = 'unpaid',
                updated_at = ?,
                committed_at = ?,
                order_code = ?
            WHERE id = ?
            """,
            (committed_at, committed_at, order_code, clean_cart_id),
        )
        self._record_audit(
            connection,
            entity_type="cart",
            entity_id=clean_cart_id,
            entity_name=order_code or clean_cart_id,
            action="status-change",
            actor=actor,
            message="Trạng thái đơn đổi từ draft sang committed.",
        )
        return self._get_cart_document(connection, clean_cart_id)

    def _create_or_merge_bulk_order_draft(
        self,
        connection: sqlite3.Connection,
        raw_order: dict,
        *,
        created_at: str,
    ) -> dict:
        resolved_customer = self._ensure_customer_for_bulk_order(
            connection,
            customer_id=str(raw_order.get("customer_id") or raw_order.get("customerId") or "").strip(),
            customer_name=str(raw_order.get("customer_name") or raw_order.get("customerName") or "").strip(),
            created_at=created_at,
        )
        grouped_items = self._group_sale_items(raw_order.get("items") or [])
        if not grouped_items:
            raise ValueError("Đơn hàng phải có ít nhất một mặt hàng.")
        merge_strategy = str(raw_order.get("merge_strategy") or raw_order.get("mergeStrategy") or "merge_existing_draft").strip() or "merge_existing_draft"
        clean_ship_address = str(raw_order.get("ship_address") or raw_order.get("shipAddress") or "").strip() or str(resolved_customer.get("address") or "").strip()
        subtotal = sum(
            item["quantity"] * item["unit_price"]
            for item in grouped_items.values()
        )
        validated_discount_amount = self._validate_discount_amount(
            raw_order.get("discount_amount", raw_order.get("discountAmount", 0)),
            subtotal,
            "Giảm giá khuyến mại phiếu xuất",
        )
        existing_draft = None
        if merge_strategy != "create_new_draft":
            existing_draft = self._get_existing_draft_cart_for_customer(
                connection,
                customer_id=str(resolved_customer.get("id") or "").strip(),
                customer_name=str(resolved_customer.get("name") or "").strip(),
            )
        if existing_draft:
            merged_grouped_items = self._merge_grouped_sale_items(
                existing_draft.get("items") or [],
                grouped_items,
            )
            merged_items = self._build_cart_items_from_grouped_sale_items(
                connection,
                merged_grouped_items,
            )
            current_discount = self._get_cart_discount_amount(existing_draft)
            next_discount = validated_discount_amount if validated_discount_amount > 0 else current_discount
            connection.execute(
                """
                UPDATE carts
                SET customer_id = ?,
                    customer_name = ?,
                    discount_amount = ?,
                    ship_address = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    str(resolved_customer.get("id") or "").strip(),
                    str(resolved_customer.get("name") or "").strip(),
                    next_discount,
                    clean_ship_address or self._get_cart_ship_address(existing_draft),
                    created_at,
                    str(existing_draft.get("id") or "").strip(),
                ),
            )
            self._replace_cart_items(
                connection,
                cart_id=str(existing_draft.get("id") or "").strip(),
                items=merged_items,
            )
            return {
                "cart": self._get_cart_document(connection, str(existing_draft.get("id") or "").strip()),
                "reused_existing_draft": True,
                "customer": resolved_customer,
            }

        cart_id = f"cart_{secrets.token_hex(6)}"
        cart_items = self._build_cart_items_from_grouped_sale_items(connection, grouped_items)
        connection.execute(
            """
            INSERT INTO carts(
                id, customer_id, customer_name, status, payment_status, discount_amount, ship_address,
                created_at, updated_at, committed_at, completed_at, cancelled_at, paid_at, order_code
            )
            VALUES(?, ?, ?, 'draft', 'unpaid', ?, ?, ?, ?, NULL, NULL, NULL, NULL, '')
            """,
            (
                cart_id,
                str(resolved_customer.get("id") or "").strip(),
                str(resolved_customer.get("name") or "").strip(),
                validated_discount_amount,
                clean_ship_address,
                created_at,
                created_at,
            ),
        )
        self._replace_cart_items(
            connection,
            cart_id=cart_id,
            items=cart_items,
        )
        return {
            "cart": self._get_cart_document(connection, cart_id),
            "reused_existing_draft": False,
            "customer": resolved_customer,
        }

    def create_checkout_order(
        self,
        customer_name: str,
        items: list[dict],
        note: str = "",
        discount_amount=0,
    ) -> dict:
        clean_customer_name = (customer_name or "").strip()
        clean_note = (note or "").strip()
        if not clean_customer_name:
            raise ValueError("Khách hàng là bắt buộc.")
        if not items:
            raise ValueError("Giỏ hàng đang trống.")
        grouped_items = self._group_sale_items(items)
        now = utc_now_iso()
        order_code = self._build_order_code(clean_customer_name, now)

        with self._connect() as connection:
            products_by_id, current_stock_by_id = self._validate_sale_items_against_physical_stock(
                connection,
                grouped_items,
            )
            sale_result = self._create_sale_transactions_for_order(
                connection,
                order_code=order_code,
                customer_name=clean_customer_name,
                grouped_items=grouped_items,
                products_by_id=products_by_id,
                current_stock_by_id=current_stock_by_id,
                created_at=now,
                note=clean_note,
                discount_amount=discount_amount,
            )

        return {
            "order_code": order_code,
            "customer_name": clean_customer_name,
            "created_at": now,
            "transactions": sale_result["transactions"],
            "total_quantity": sale_result["total_quantity"],
            "subtotal_amount": sale_result["subtotal_amount"],
            "discount_amount": sale_result["discount_amount"],
            "total_amount": sale_result["total_amount"],
        }

    def bulk_create_orders(
        self,
        *,
        mode: str,
        request_id: str,
        orders: list[dict],
        actor: str = "",
    ) -> dict:
        clean_mode = str(mode or "").strip()
        clean_request_id = str(request_id or "").strip()
        clean_actor = str(actor or "").strip()
        if clean_mode not in {"draft", "commit_valid"}:
            raise ValueError("Mode tạo nhiều đơn không hợp lệ.")
        if not clean_request_id:
            raise ValueError("Thiếu request_id.")
        if not isinstance(orders, list) or not orders:
            raise ValueError("Danh sách đơn hàng đang trống.")

        now = utc_now_iso()
        request_payload = {
            "mode": clean_mode,
            "request_id": clean_request_id,
            "orders": orders,
        }

        with self._connect() as connection:
            existing_batch = connection.execute(
                """
                SELECT response_payload
                FROM bulk_order_batches
                WHERE request_id = ?
                LIMIT 1
                """,
                (clean_request_id,),
            ).fetchone()
            if existing_batch:
                stored_response = json.loads(existing_batch["response_payload"] or "{}")
                stored_response["request_id"] = clean_request_id
                stored_response["idempotent_replay"] = True
                return stored_response

            connection.execute(
                """
                INSERT INTO bulk_order_batches(
                    request_id, mode, actor, total_orders, success_count, failed_count, request_payload, response_payload, created_at
                )
                VALUES(?, ?, ?, ?, 0, 0, ?, '{}', ?)
                """,
                (
                    clean_request_id,
                    clean_mode,
                    clean_actor,
                    len(orders),
                    json.dumps(request_payload, ensure_ascii=False),
                    now,
                ),
            )

            results: list[dict] = []
            success_count = 0
            failed_count = 0
            for index, raw_order in enumerate(orders):
                order_payload = raw_order if isinstance(raw_order, dict) else {}
                client_order_id = str(order_payload.get("client_order_id") or order_payload.get("clientOrderId") or f"bulk_order_{index + 1}").strip()
                customer_name = str(order_payload.get("customer_name") or order_payload.get("customerName") or "").strip()
                draft_result = None
                working_cart = None
                shortage_errors: list[dict] = []
                try:
                    draft_result = self._create_or_merge_bulk_order_draft(
                        connection,
                        order_payload,
                        created_at=now,
                    )
                    working_cart = draft_result["cart"]
                    if clean_mode == "commit_valid":
                        shortage_errors = self._collect_committed_availability_shortages(
                            connection,
                            self._group_sale_items(working_cart.get("items") or []),
                            exclude_cart_id=str(working_cart.get("id") or "").strip(),
                        )
                        if shortage_errors:
                            raise ValueError(shortage_errors[0]["message"])
                        committed_cart = self._commit_cart_order_in_connection(
                            connection,
                            str(working_cart.get("id") or "").strip(),
                            actor=clean_actor,
                            committed_at=now,
                        )
                        success_count += 1
                        results.append(
                            {
                                "client_order_id": client_order_id,
                                "customer_id": committed_cart.get("customerId") or "",
                                "customer_name": committed_cart.get("customerName") or customer_name,
                                "status": "success",
                                "order_status": "committed",
                                "cart_id": committed_cart.get("id") or "",
                                "order_code": committed_cart.get("orderCode") or "",
                                "saved_as_draft": False,
                                "message": "Đã chốt đơn.",
                                "reused_existing_draft": bool(draft_result["reused_existing_draft"]),
                                "errors": [],
                            }
                        )
                        continue

                    success_count += 1
                    results.append(
                        {
                            "client_order_id": client_order_id,
                            "customer_id": working_cart.get("customerId") or "",
                            "customer_name": working_cart.get("customerName") or customer_name,
                            "status": "success",
                            "order_status": "draft",
                            "cart_id": working_cart.get("id") or "",
                            "order_code": working_cart.get("orderCode") or "",
                            "saved_as_draft": True,
                            "message": draft_result["reused_existing_draft"]
                                and "Đã dồn vào đơn nháp hiện có."
                                or "Đã lưu nháp.",
                            "reused_existing_draft": bool(draft_result["reused_existing_draft"]),
                            "errors": [],
                        }
                    )
                except ValueError as exc:
                    failed_count += 1
                    error_message = str(exc) or "Đơn hàng không hợp lệ."
                    results.append(
                        {
                            "client_order_id": client_order_id,
                            "customer_id": (working_cart or {}).get("customerId") or str(order_payload.get("customer_id") or order_payload.get("customerId") or "").strip(),
                            "customer_name": (working_cart or {}).get("customerName") or customer_name,
                            "status": "failed",
                            "order_status": "draft",
                            "cart_id": (working_cart or {}).get("id") or "",
                            "order_code": "",
                            "saved_as_draft": clean_mode == "commit_valid",
                            "message": error_message,
                            "reused_existing_draft": bool((draft_result or {}).get("reused_existing_draft")),
                            "errors": shortage_errors or [{"message": error_message}],
                        }
                    )

            customers = self._refresh_sync_collection_cache(connection, "customers", updated_at=now)
            carts = self._refresh_sync_collection_cache(connection, "carts", updated_at=now)
            cart_by_id = {str(cart.get("id") or ""): cart for cart in carts if cart.get("id")}
            customer_by_id = {str(customer.get("id") or ""): customer for customer in customers if customer.get("id")}
            normalized_results: list[dict] = []
            for entry in results:
                cart = cart_by_id.get(str(entry.get("cart_id") or "").strip())
                customer = customer_by_id.get(str(entry.get("customer_id") or "").strip())
                current_customer_name = (
                    (cart or {}).get("customerName")
                    or (customer or {}).get("name")
                    or entry.get("customer_name")
                    or ""
                )
                normalized_results.append(
                    {
                        **entry,
                        "customer_name": current_customer_name,
                        "cart_id": (cart or {}).get("id") or entry.get("cart_id") or "",
                        "order_code": (cart or {}).get("orderCode") or entry.get("order_code") or "",
                    }
                )

            summary = {
                "total_orders": len(orders),
                "success": success_count,
                "failed": failed_count,
            }
            response_payload = {
                "request_id": clean_request_id,
                "mode": clean_mode,
                "summary": summary,
                "results": normalized_results,
            }
            connection.execute(
                """
                UPDATE bulk_order_batches
                SET success_count = ?,
                    failed_count = ?,
                    response_payload = ?
                WHERE request_id = ?
                """,
                (
                    success_count,
                    failed_count,
                    json.dumps(response_payload, ensure_ascii=False),
                    clean_request_id,
                ),
            )
            self._record_audit(
                connection,
                entity_type="bulk_order_batch",
                entity_id=clean_request_id,
                entity_name=clean_request_id,
                action="create",
                actor=clean_actor,
                message=(
                    f"Tạo nhiều đơn mode={clean_mode}. "
                    f"Tổng {len(orders)} đơn, thành công {success_count}, lỗi {failed_count}."
                ),
            )
            return response_payload

    def commit_cart_order(self, cart_id: str, *, actor: str = "") -> dict:
        clean_cart_id = str(cart_id or "").strip()
        if not clean_cart_id:
            raise ValueError("Thiếu cart_id.")

        now = utc_now_iso()
        with self._connect() as connection:
            cart = self._get_cart_document(connection, clean_cart_id)
            previous_status = str(cart.get("status") or "draft")
            if previous_status != "draft":
                raise ValueError("Chỉ đơn nháp mới được chốt đơn.")
            if not cart.get("items"):
                raise ValueError("Giỏ hàng đang trống.")
            clean_customer_name = str(cart.get("customerName") or "").strip()
            if not clean_customer_name:
                raise ValueError("Khách hàng là bắt buộc.")

            grouped_items = self._group_sale_items(cart.get("items") or [])
            self._validate_sale_items_against_committed_availability(
                connection,
                grouped_items,
                exclude_cart_id=clean_cart_id,
            )

            order_code = str(cart.get("orderCode") or "").strip() or self._build_order_code(clean_customer_name, now)
            connection.execute(
                """
                UPDATE carts
                SET status = 'committed',
                    payment_status = 'unpaid',
                    updated_at = ?,
                    committed_at = ?,
                    order_code = ?
                WHERE id = ?
                """,
                (now, now, order_code, clean_cart_id),
            )
            self._record_audit(
                connection,
                entity_type="cart",
                entity_id=clean_cart_id,
                entity_name=order_code or clean_cart_id,
                action="status-change",
                actor=actor,
                message="Trạng thái đơn đổi từ draft sang committed.",
            )
            carts = self._refresh_sync_collection_cache(connection, "carts", updated_at=now)
            committed_cart = next((entry for entry in carts if str(entry.get("id")) == clean_cart_id), None)
            if not committed_cart:
                raise ValueError("Không tìm thấy đơn vừa chốt.")
            return {
                "cart": committed_cart,
                "order_code": committed_cart.get("orderCode") or order_code,
                "committed_at": committed_cart.get("committedAt") or now,
            }

    def ship_cart_order(self, cart_id: str, *, actor: str = "") -> dict:
        clean_cart_id = str(cart_id or "").strip()
        if not clean_cart_id:
            raise ValueError("Thiếu cart_id.")

        now = utc_now_iso()
        with self._connect() as connection:
            cart = self._get_cart_document(connection, clean_cart_id)
            if str(cart.get("status") or "") != "committed":
                raise ValueError("Chỉ đơn đã chốt mới được xuất hàng.")
            if not cart.get("items"):
                raise ValueError("Đơn đang trống.")
            clean_customer_name = str(cart.get("customerName") or "").strip()
            if not clean_customer_name:
                raise ValueError("Khách hàng là bắt buộc.")

            order_code = str(cart.get("orderCode") or "").strip()
            if not order_code:
                raise ValueError("Đơn đã chốt phải có mã đơn trước khi xuất hàng.")

            grouped_items = self._group_sale_items(cart.get("items") or [])
            products_by_id, current_stock_by_id = self._validate_sale_items_against_physical_stock(
                connection,
                grouped_items,
            )
            sale_result = self._create_sale_transactions_for_order(
                connection,
                order_code=order_code,
                customer_name=clean_customer_name,
                grouped_items=grouped_items,
                products_by_id=products_by_id,
                current_stock_by_id=current_stock_by_id,
                created_at=now,
                note="",
                discount_amount=cart.get("discountAmount") or cart.get("discount_amount") or 0,
            )
            connection.execute(
                """
                UPDATE carts
                SET status = 'completed',
                    payment_status = COALESCE(NULLIF(payment_status, ''), 'unpaid'),
                    updated_at = ?,
                    completed_at = ?
                WHERE id = ?
                """,
                (now, now, clean_cart_id),
            )
            self._record_audit(
                connection,
                entity_type="cart",
                entity_id=clean_cart_id,
                entity_name=order_code or clean_cart_id,
                action="status-change",
                actor=actor,
                message="Trạng thái đơn đổi từ committed sang completed.",
            )
            carts = self._refresh_sync_collection_cache(connection, "carts", updated_at=now)
            completed_cart = next((entry for entry in carts if str(entry.get("id")) == clean_cart_id), None)
            if not completed_cart:
                raise ValueError("Không tìm thấy đơn vừa xuất hàng.")
            return {
                "cart": completed_cart,
                "order": {
                    "order_code": order_code,
                    "customer_name": clean_customer_name,
                    "created_at": now,
                    "transactions": sale_result["transactions"],
                    "total_quantity": sale_result["total_quantity"],
                    "subtotal_amount": sale_result["subtotal_amount"],
                    "discount_amount": sale_result["discount_amount"],
                    "total_amount": sale_result["total_amount"],
                },
            }

    def _create_purchase_receipt_in_connection(
        self,
        connection: sqlite3.Connection,
        *,
        items: list[dict],
        note: str = "",
        supplier_name: str = "",
        discount_amount=0,
        created_at: str = "",
    ) -> dict:
        clean_note = (note or "").strip()
        clean_supplier_name = (supplier_name or "").strip()
        if not items:
            raise ValueError("Phiếu nhập đang trống.")

        parsed_items: list[dict] = []
        for raw_item in items:
            product_id = int(raw_item.get("product_id", 0))
            quantity = parse_positive_decimal(raw_item.get("quantity"), "Số lượng")
            unit_cost = parse_non_negative_decimal(raw_item.get("unit_cost", 0), "Giá nhập")
            parsed_items.append(
                {
                    "purchase_item_id": str(raw_item.get("purchase_item_id") or raw_item.get("purchaseItemId") or raw_item.get("id") or "").strip(),
                    "product_id": product_id,
                    "quantity": quantity,
                    "unit_cost": unit_cost,
                    "product_name": str(raw_item.get("product_name") or raw_item.get("productName") or "").strip(),
                    "batch_code": str(raw_item.get("batch_code") or raw_item.get("batchCode") or "").strip(),
                    "expiry_input_mode": raw_item.get("expiry_input_mode") or raw_item.get("expiryInputMode") or "direct",
                    "manufacture_date": raw_item.get("manufacture_date") or raw_item.get("manufactureDate"),
                    "expiry_date": raw_item.get("expiry_date") or raw_item.get("expiryDate"),
                }
            )

        now = str(created_at or utc_now_iso()).strip() or utc_now_iso()
        receipt_suffix = hashlib.sha1(f"{clean_supplier_name}-{clean_note}-{now}".encode("utf-8")).hexdigest()[:6]
        receipt_code = f"PN-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{receipt_suffix}"
        normalized_items: list[dict] = []
        grouped_items: dict[tuple[int, str, str, str, str], dict] = {}
        for raw_item in parsed_items:
            product_id = int(raw_item["product_id"])
            product = self._get_product_or_raise(connection, product_id)
            expiry_metadata = self._resolve_purchase_item_expiry_metadata(
                raw_item=raw_item,
                product=product,
                received_at=now,
                field_prefix=f'Dòng nhập của "{product["name"]}"',
            )
            normalized_item = {
                "purchase_item_id": str(raw_item.get("purchase_item_id") or "").strip(),
                "product_id": product_id,
                "product_name": str(raw_item.get("product_name") or product["name"]).strip() or str(product["name"]),
                "quantity": raw_item["quantity"],
                "unit_cost": raw_item["unit_cost"],
                "batch_code": str(raw_item.get("batch_code") or "").strip(),
                "expiry_input_mode": expiry_metadata["expiry_input_mode"],
                "manufacture_date": expiry_metadata["manufacture_date"],
                "expiry_date": expiry_metadata["expiry_date"],
            }
            if normalized_item["purchase_item_id"]:
                normalized_items.append(normalized_item)
                continue
            item_key = (
                normalized_item["product_id"],
                normalized_item["batch_code"],
                normalized_item["expiry_input_mode"],
                normalized_item["manufacture_date"] or "",
                normalized_item["expiry_date"] or "",
            )
            existing = grouped_items.get(item_key)
            if existing:
                existing["quantity"] += normalized_item["quantity"]
                existing["unit_cost"] = normalized_item["unit_cost"]
            else:
                grouped_items[item_key] = normalized_item
        normalized_items.extend(grouped_items.values())

        transactions = []
        subtotal_amount = Decimal("0")
        total_quantity = Decimal("0")
        validated_discount_amount = self._validate_discount_amount(
            discount_amount,
            sum(
                item["quantity"] * item["unit_cost"]
                for item in normalized_items
            ),
            "Giảm giá khuyến mại phiếu nhập",
        )
        receipt_id = self._insert_inventory_receipt(
            connection,
            receipt_code=receipt_code,
            receipt_type="purchase",
            supplier_name=clean_supplier_name,
            note=clean_note,
            discount_amount=validated_discount_amount,
            created_at=now,
        )

        for line_index, item in enumerate(normalized_items, start=1):
            product_id = int(item["product_id"])
            product = self._get_product_or_raise(connection, product_id)
            line_total = item["quantity"] * item["unit_cost"]
            subtotal_amount += line_total
            total_quantity += item["quantity"]
            resolved_batch_code = self._resolve_batch_code(
                item.get("batch_code", ""),
                f"{receipt_code}-L{line_index}",
            )
            resolved_expiry_date = item.get("expiry_date")

            transaction_note = f"Phiếu nhập {receipt_code}"
            if clean_supplier_name:
                transaction_note += f" | NCC: {clean_supplier_name}"
            if validated_discount_amount > 0:
                transaction_note += f" | Giảm giá KM: {validated_discount_amount:.0f}"
            if clean_note:
                transaction_note += f" | {clean_note}"
            transaction_note += f" | Giá nhập: {float(item['unit_cost']):.0f}"
            transaction_note += f" | Lô nhập: {resolved_batch_code} {float(item['quantity']):g}"
            if resolved_expiry_date:
                transaction_note += f" HSD {resolved_expiry_date}"

            cursor = connection.execute(
                """
                INSERT INTO transactions(product_id, transaction_type, quantity, note, created_at)
                VALUES(?, 'in', ?, ?, ?)
                """,
                (product_id, float(item["quantity"]), transaction_note, now),
            )
            created_batch = self._create_inventory_batch(
                connection,
                product=product,
                quantity=item["quantity"],
                unit_cost=item["unit_cost"],
                received_at=now,
                source_receipt_code=receipt_code,
                source_receipt_type="purchase",
                source_transaction_id=int(cursor.lastrowid),
                transaction_id=int(cursor.lastrowid),
                batch_code=resolved_batch_code,
                expiry_date=resolved_expiry_date,
                note=clean_note,
                fallback_batch_code=resolved_batch_code,
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
                    "batch_code": created_batch["batch_code"],
                    "expiry_date": created_batch["expiry_date"],
                    "expiry_input_mode": item["expiry_input_mode"],
                    "manufacture_date": item["manufacture_date"] or "",
                }
            )
            self._insert_inventory_receipt_item(
                connection,
                receipt_id=receipt_id,
                product_id=product_id,
                product_name=product["name"],
                unit=product["unit"],
                transaction_type="in",
                quantity=round(float(item["quantity"]), 2),
                unit_amount=round(float(item["unit_cost"]), 2),
                line_total=round(float(line_total), 2),
                stock_after=round(float(current_stock), 2),
                transaction_id=cursor.lastrowid,
                purchase_item_id=item["purchase_item_id"],
                batch_id=int(created_batch["id"]),
                batch_code=created_batch["batch_code"],
                expiry_date=created_batch["expiry_date"],
            )

        net_total_amount = subtotal_amount - Decimal(str(validated_discount_amount))

        return {
            "receipt_code": receipt_code,
            "supplier_name": clean_supplier_name,
            "created_at": now,
            "transactions": transactions,
            "total_quantity": round(float(total_quantity), 2),
            "subtotal_amount": round(float(subtotal_amount), 2),
            "discount_amount": round(float(validated_discount_amount), 2),
            "total_amount": round(float(net_total_amount), 2),
        }

    def create_purchase_receipt(
        self,
        items: list[dict],
        note: str = "",
        supplier_name: str = "",
        discount_amount=0,
    ) -> dict:
        with self._connect() as connection:
            return self._create_purchase_receipt_in_connection(
                connection,
                items=items,
                note=note,
                supplier_name=supplier_name,
                discount_amount=discount_amount,
            )

    def receive_purchase(
        self,
        purchase_id: str,
        *,
        discount_amount=None,
        actor_username: str = "",
        actor_role: str = "",
    ) -> dict:
        clean_purchase_id = str(purchase_id or "").strip()
        if not clean_purchase_id:
            raise ValueError("Thiếu mã phiếu nhập cần nhập kho.")

        actor = str(actor_username or "").strip()
        with self._connect() as connection:
            purchases = self._load_sync_collection_from_tables(connection, "purchases")
            target = next(
                (purchase for purchase in purchases if str(purchase.get("id") or "") == clean_purchase_id),
                None,
            )
            if target is None:
                raise ValueError("Không tìm thấy phiếu nhập cần nhập kho.")

            current_status = str(target.get("status") or "draft").strip()
            if current_status != "ordered":
                raise ValueError("Chỉ phiếu đã đặt hàng mới được nhập kho.")
            if not str(target.get("supplierName") or "").strip():
                raise ValueError("Phiếu nhập phải có nhà cung cấp trước khi nhập kho.")
            if not self._purchase_has_items(target):
                raise ValueError("Phiếu nhập đang trống.")

            next_discount_amount = (
                self._get_purchase_discount_amount(target)
                if discount_amount is None
                else self._validate_discount_amount(
                    discount_amount,
                    self._get_purchase_subtotal_amount(target),
                    "Giảm giá khuyến mại phiếu nhập",
                )
            )
            received_at = utc_now_iso()
            preview_purchase = {
                **target,
                "status": "received",
                "discountAmount": next_discount_amount,
                "discount_amount": next_discount_amount,
                "receivedAt": received_at,
                "received_at": received_at,
                "updatedAt": received_at,
                "updated_at": received_at,
            }
            preview_purchases = [
                preview_purchase if str(purchase.get("id") or "") == clean_purchase_id else purchase
                for purchase in purchases
            ]
            preview_purchases = self._preserve_purchase_ordered_timestamps(purchases, preview_purchases)
            self._validate_purchase_workflow_locks(
                connection,
                purchases,
                preview_purchases,
                actor_username=actor_username,
                actor_role=actor_role,
            )

            receipt = self._create_purchase_receipt_in_connection(
                connection,
                items=[
                    {
                        "purchase_item_id": str(item.get("id") or "").strip(),
                        "product_id": item.get("productId") or item.get("product_id"),
                        "product_name": item.get("productName") or item.get("product_name") or "",
                        "quantity": item.get("quantity"),
                        "unit_cost": item.get("unitCost", item.get("unit_cost", 0)),
                        "batch_code": item.get("batchCode") or item.get("batch_code") or "",
                        "expiry_input_mode": item.get("expiryInputMode") or item.get("expiry_input_mode") or "direct",
                        "manufacture_date": item.get("manufactureDate") or item.get("manufacture_date") or "",
                        "expiry_date": item.get("expiryDate") or item.get("expiry_date") or "",
                    }
                    for item in (target.get("items") or [])
                ],
                note=str(target.get("note") or "").strip(),
                supplier_name=str(target.get("supplierName") or "").strip(),
                discount_amount=next_discount_amount,
                created_at=received_at,
            )

            next_purchases = []
            for purchase in purchases:
                if str(purchase.get("id") or "") != clean_purchase_id:
                    next_purchases.append(purchase)
                    continue
                next_purchases.append(
                    {
                        **purchase,
                        "status": "received",
                        "discountAmount": next_discount_amount,
                        "discount_amount": next_discount_amount,
                        "receivedAt": receipt["created_at"],
                        "received_at": receipt["created_at"],
                        "receiptCode": receipt["receipt_code"],
                        "receipt_code": receipt["receipt_code"],
                        "updatedAt": receipt["created_at"],
                        "updated_at": receipt["created_at"],
                    }
                )
            next_purchases = self._preserve_purchase_ordered_timestamps(purchases, next_purchases)
            self._audit_purchase_changes(connection, purchases, next_purchases, actor=actor)
            self._validate_purchase_workflow_locks(
                connection,
                purchases,
                next_purchases,
                actor_username=actor_username,
                actor_role=actor_role,
            )
            self._sync_procurement_assignments_for_purchases(
                connection,
                purchases,
                next_purchases,
                actor=actor,
                updated_at=receipt["created_at"],
            )
            self._replace_sync_collection_records(connection, "purchases", next_purchases)
            canonical = self._refresh_sync_collection_cache(
                connection,
                "purchases",
                updated_at=receipt["created_at"],
            )

        purchase = next((entry for entry in canonical if str(entry.get("id") or "") == clean_purchase_id), None)
        return {
            "message": "Đã nhập hàng vào kho.",
            "receipt": receipt,
            "purchase": purchase,
            "purchases": canonical,
        }

    def mark_purchase_paid(
        self,
        purchase_id: str,
        *,
        discount_amount=None,
        actor_username: str = "",
        actor_role: str = "",
    ) -> dict:
        clean_purchase_id = str(purchase_id or "").strip()
        if not clean_purchase_id:
            raise ValueError("Thiếu mã phiếu nhập cần đánh dấu đã thanh toán.")

        actor = str(actor_username or "").strip()
        paid_at = utc_now_iso()
        with self._connect() as connection:
            purchases = self._load_sync_collection_from_tables(connection, "purchases")
            target = next(
                (purchase for purchase in purchases if str(purchase.get("id") or "") == clean_purchase_id),
                None,
            )
            if target is None:
                raise ValueError("Không tìm thấy phiếu nhập cần đánh dấu đã thanh toán.")

            current_status = str(target.get("status") or "draft").strip()
            if current_status != "received":
                raise ValueError("Phiếu nhập chỉ được đánh dấu đã thanh toán sau khi đã nhập kho.")

            next_discount_amount = (
                self._get_purchase_discount_amount(target)
                if discount_amount is None
                else self._validate_discount_amount(
                    discount_amount,
                    self._get_purchase_subtotal_amount(target),
                    "Giảm giá khuyến mại phiếu nhập",
                )
            )
            next_purchases = []
            for purchase in purchases:
                if str(purchase.get("id") or "") != clean_purchase_id:
                    next_purchases.append(purchase)
                    continue
                next_purchases.append(
                    {
                        **purchase,
                        "status": "paid",
                        "discountAmount": next_discount_amount,
                        "discount_amount": next_discount_amount,
                        "paidAt": paid_at,
                        "paid_at": paid_at,
                        "updatedAt": paid_at,
                        "updated_at": paid_at,
                    }
                )
            next_purchases = self._preserve_purchase_ordered_timestamps(purchases, next_purchases)
            self._audit_purchase_changes(connection, purchases, next_purchases, actor=actor)
            self._validate_purchase_workflow_locks(
                connection,
                purchases,
                next_purchases,
                actor_username=actor_username,
                actor_role=actor_role,
            )
            self._sync_procurement_assignments_for_purchases(
                connection,
                purchases,
                next_purchases,
                actor=actor,
                updated_at=paid_at,
            )
            self._replace_sync_collection_records(connection, "purchases", next_purchases)
            canonical = self._refresh_sync_collection_cache(
                connection,
                "purchases",
                updated_at=paid_at,
            )

        purchase = next((entry for entry in canonical if str(entry.get("id") or "") == clean_purchase_id), None)
        return {
            "message": "Đã cập nhật phiếu nhập là đã thanh toán.",
            "purchase": purchase,
            "purchases": canonical,
        }

    @staticmethod
    def _build_purchase_receipt_transaction_note(
        *,
        receipt_code: str,
        supplier_name: str,
        note: str,
        discount_amount: float,
        unit_cost: float,
        quantity: float,
        batch_code: str,
        expiry_date: str = "",
    ) -> str:
        transaction_note = f"Phiếu nhập {receipt_code}"
        if supplier_name:
            transaction_note += f" | NCC: {supplier_name}"
        if discount_amount > 0:
            transaction_note += f" | Giảm giá KM: {discount_amount:.0f}"
        if note:
            transaction_note += f" | {note}"
        transaction_note += f" | Giá nhập: {unit_cost:.0f}"
        transaction_note += f" | Lô nhập: {batch_code} {quantity:g}"
        if expiry_date:
            transaction_note += f" HSD {expiry_date}"
        return transaction_note

    def update_received_purchase_item_expiry(
        self,
        purchase_id: str,
        purchase_item_id: str,
        *,
        expiry_input_mode: str = "direct",
        manufacture_date=None,
        expiry_date=None,
        expected_updated_at: str = "",
        actor: str = "",
    ) -> dict:
        clean_purchase_id = str(purchase_id or "").strip()
        clean_purchase_item_id = str(purchase_item_id or "").strip()
        clean_expected_updated_at = str(expected_updated_at or "").strip()
        if not clean_purchase_id:
            raise ValueError("Thiếu mã phiếu nhập cần cập nhật HSD.")
        if not clean_purchase_item_id:
            raise ValueError("Thiếu mã dòng nhập cần cập nhật HSD.")

        now = utc_now_iso()
        with self._connect() as connection:
            purchases = self._load_sync_collection_from_tables(connection, "purchases")
            target_purchase = next(
                (purchase for purchase in purchases if str(purchase.get("id") or "") == clean_purchase_id),
                None,
            )
            if not target_purchase:
                raise ValueError("Không tìm thấy phiếu nhập cần cập nhật HSD.")

            actual_updated_at = str(target_purchase.get("updatedAt") or target_purchase.get("updated_at") or "")
            if clean_expected_updated_at and actual_updated_at and clean_expected_updated_at != actual_updated_at:
                raise SyncConflictError("purchases", clean_expected_updated_at, actual_updated_at)

            current_status = str(target_purchase.get("status") or "draft")
            if current_status != "received":
                raise ValueError("Chỉ phiếu đã nhập kho và chưa thanh toán mới được cập nhật HSD.")

            receipt_code = str(target_purchase.get("receiptCode") or target_purchase.get("receipt_code") or "").strip()
            receipt_row = self._get_inventory_receipt_by_code(
                connection,
                receipt_code,
                receipt_type="purchase",
            )
            if receipt_row is None:
                raise ValueError("Phiếu nhập đã nhận hàng nhưng thiếu receipt kho tương ứng.")

            purchase_item_rows = connection.execute(
                """
                SELECT
                    id, purchase_id, product_id, product_name, quantity, unit_cost, batch_code,
                    expiry_input_mode, manufacture_date, expiry_date, sort_order
                FROM purchase_items
                WHERE purchase_id = ?
                ORDER BY sort_order, id
                """,
                (clean_purchase_id,),
            ).fetchall()
            purchase_item_row = next(
                (row for row in purchase_item_rows if str(row["id"] or "") == clean_purchase_item_id),
                None,
            )
            if purchase_item_row is None:
                raise ValueError("Không tìm thấy dòng nhập cần cập nhật HSD.")

            receipt_item_rows = connection.execute(
                """
                SELECT
                    id, product_id, quantity, unit_amount, transaction_id, purchase_item_id,
                    batch_id, batch_code, expiry_date
                FROM inventory_receipt_items
                WHERE receipt_id = ? AND transaction_type = 'in'
                ORDER BY id
                """,
                (int(receipt_row["id"]),),
            ).fetchall()
            mapped_receipt_item = next(
                (
                    row for row in receipt_item_rows
                    if str(row["purchase_item_id"] or "").strip() == clean_purchase_item_id
                ),
                None,
            )
            if mapped_receipt_item is None:
                if len(receipt_item_rows) != len(purchase_item_rows):
                    raise ValueError("Không thể đối chiếu dòng phiếu nhập với receipt kho để cập nhật HSD.")
                zipped_mapping = {
                    str(purchase_row["id"] or ""): receipt_item_rows[index]
                    for index, purchase_row in enumerate(purchase_item_rows)
                }
                mapped_receipt_item = zipped_mapping.get(clean_purchase_item_id)
            if mapped_receipt_item is None:
                raise ValueError("Không tìm thấy receipt item tương ứng để cập nhật HSD.")

            product = self._get_product_or_raise(connection, int(purchase_item_row["product_id"] or 0))
            expiry_metadata = self._resolve_purchase_item_expiry_metadata(
                raw_item={
                    "expiry_input_mode": expiry_input_mode,
                    "manufacture_date": manufacture_date,
                    "expiry_date": expiry_date,
                },
                product=product,
                received_at=str(receipt_row["created_at"] or target_purchase.get("receivedAt") or ""),
                field_prefix=f'Dòng nhập của "{product["name"]}"',
            )

            connection.execute(
                """
                UPDATE purchase_items
                SET expiry_input_mode = ?, manufacture_date = ?, expiry_date = ?
                WHERE id = ? AND purchase_id = ?
                """,
                (
                    expiry_metadata["expiry_input_mode"],
                    expiry_metadata["manufacture_date"],
                    expiry_metadata["expiry_date"],
                    clean_purchase_item_id,
                    clean_purchase_id,
                ),
            )

            if mapped_receipt_item["batch_id"] is not None:
                connection.execute(
                    """
                    UPDATE inventory_batches
                    SET expiry_date = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        expiry_metadata["expiry_date"],
                        now,
                        int(mapped_receipt_item["batch_id"]),
                    ),
                )

            connection.execute(
                """
                UPDATE inventory_receipt_items
                SET purchase_item_id = ?, expiry_date = ?
                WHERE id = ?
                """,
                (
                    clean_purchase_item_id,
                    expiry_metadata["expiry_date"],
                    int(mapped_receipt_item["id"]),
                ),
            )

            transaction_id = mapped_receipt_item["transaction_id"]
            if transaction_id is not None:
                resolved_batch_code = str(mapped_receipt_item["batch_code"] or purchase_item_row["batch_code"] or "").strip()
                transaction_note = self._build_purchase_receipt_transaction_note(
                    receipt_code=receipt_code,
                    supplier_name=str(target_purchase.get("supplierName") or ""),
                    note=str(target_purchase.get("note") or ""),
                    discount_amount=self._get_purchase_discount_amount(target_purchase),
                    unit_cost=float(purchase_item_row["unit_cost"] or 0),
                    quantity=float(purchase_item_row["quantity"] or 0),
                    batch_code=resolved_batch_code,
                    expiry_date=expiry_metadata["expiry_date"] or "",
                )
                connection.execute(
                    "UPDATE transactions SET note = ? WHERE id = ?",
                    (transaction_note, int(transaction_id)),
                )

            connection.execute(
                """
                UPDATE purchases
                SET updated_at = ?
                WHERE id = ?
                """,
                (now, clean_purchase_id),
            )

            canonical = self._load_sync_collection_from_tables(connection, "purchases")
            connection.execute(
                """
                INSERT INTO app_state(state_key, state_value, updated_at)
                VALUES('purchases', ?, ?)
                ON CONFLICT(state_key) DO UPDATE SET
                    state_value = excluded.state_value,
                    updated_at = excluded.updated_at
                """,
                (json.dumps(canonical, ensure_ascii=False), now),
            )
            updated_purchase = next(
                (purchase for purchase in canonical if str(purchase.get("id") or "") == clean_purchase_id),
                None,
            )
            updated_item = next(
                (
                    item for item in (updated_purchase.get("items") or [])
                    if str(item.get("id") or "") == clean_purchase_item_id
                ),
                None,
            ) if updated_purchase else None
            self._record_audit(
                connection,
                entity_type="purchase",
                entity_id=clean_purchase_id,
                entity_name=receipt_code or clean_purchase_id,
                action="update_expiry",
                actor=actor,
                message=(
                    f'Cập nhật HSD dòng "{product["name"]}" của phiếu {receipt_code or clean_purchase_id}'
                    + (
                        f' -> {expiry_metadata["expiry_date"]}'
                        if expiry_metadata["expiry_date"]
                        else " -> bỏ trống HSD"
                    )
                ),
            )

        return {
            "purchase": updated_purchase,
            "item": updated_item,
            "purchases": canonical,
        }

    def _get_inventory_receipt_by_code(
        self,
        connection: sqlite3.Connection,
        receipt_code: str,
        *,
        receipt_type: str = "",
    ) -> sqlite3.Row | None:
        clean_receipt_code = str(receipt_code or "").strip()
        if not clean_receipt_code:
            return None
        if receipt_type:
            return connection.execute(
                """
                SELECT id, receipt_code, receipt_type, customer_name, supplier_name, source_type, source_code, created_at
                FROM inventory_receipts
                WHERE receipt_code = ? AND receipt_type = ?
                """,
                (clean_receipt_code, receipt_type),
            ).fetchone()
        return connection.execute(
            """
            SELECT id, receipt_code, receipt_type, customer_name, supplier_name, source_type, source_code, created_at
            FROM inventory_receipts
            WHERE receipt_code = ?
            """,
            (clean_receipt_code,),
        ).fetchone()

    @staticmethod
    def _parse_iso_datetime(value) -> datetime | None:
        clean_value = str(value or "").strip()
        if not clean_value:
            return None
        try:
            if clean_value.endswith("Z"):
                clean_value = f"{clean_value[:-1]}+00:00"
            return datetime.fromisoformat(clean_value)
        except ValueError:
            return None

    def _resolve_purchase_ordered_at_for_batch_check(self, purchase: dict | None) -> datetime | None:
        target = purchase or {}
        return self._parse_iso_datetime(
            target.get("orderedAt")
            or target.get("ordered_at")
            or target.get("updatedAt")
            or target.get("updated_at")
            or target.get("createdAt")
            or target.get("created_at")
            or ""
        )

    def _refresh_sync_collection_cache(
        self,
        connection: sqlite3.Connection,
        state_key: str,
        *,
        updated_at: str,
    ) -> list[dict]:
        canonical = self._load_sync_collection_from_tables(connection, state_key)
        connection.execute(
            """
            UPDATE app_state
            SET state_value = ?, updated_at = ?
            WHERE state_key = ?
            """,
            (json.dumps(canonical, ensure_ascii=False), updated_at, state_key),
        )
        return canonical

    def _is_repairable_invalid_purchase(
        self,
        connection: sqlite3.Connection,
        purchase: dict,
    ) -> bool:
        status = str(purchase.get("status") or "draft")
        supplier_name = str(purchase.get("supplierName") or purchase.get("supplier_name") or "").strip()
        receipt_code = str(purchase.get("receiptCode") or purchase.get("receipt_code") or "").strip()
        receipt_row = self._get_inventory_receipt_by_code(
            connection,
            receipt_code,
            receipt_type="purchase",
        )
        if receipt_row is not None:
            return False
        has_received_at = bool(purchase.get("receivedAt") or purchase.get("received_at"))
        has_paid_at = bool(purchase.get("paidAt") or purchase.get("paid_at"))
        has_receipt_code = bool(receipt_code)
        item_count = len(purchase.get("items") or [])
        if status == "paid":
            return True
        if status in {"draft", "ordered"} and (has_received_at or has_paid_at or has_receipt_code):
            return True
        if status == "ordered" and (not supplier_name or item_count <= 0):
            return True
        return False

    def _get_purchase_receipt_candidates(
        self,
        connection: sqlite3.Connection,
        purchase: dict,
    ) -> list[dict]:
        supplier_name = str(purchase.get("supplierName") or purchase.get("supplier_name") or "").strip()
        purchase_items = purchase.get("items") or []
        purchase_product_ids = {
            int(item.get("productId") or item.get("product_id") or 0)
            for item in purchase_items
            if int(item.get("productId") or item.get("product_id") or 0) > 0
        }
        purchase_updated_at = self._parse_iso_datetime(
            purchase.get("updatedAt") or purchase.get("updated_at") or purchase.get("createdAt") or purchase.get("created_at")
        )
        current_receipt_code = str(purchase.get("receiptCode") or purchase.get("receipt_code") or "").strip()

        used_receipt_codes = {
            str(row["receipt_code"] or "").strip()
            for row in connection.execute(
                """
                SELECT receipt_code
                FROM purchases
                WHERE TRIM(COALESCE(receipt_code, '')) <> ''
                """
            ).fetchall()
        }
        if current_receipt_code:
            used_receipt_codes.discard(current_receipt_code)

        candidate_rows = connection.execute(
            """
            SELECT id, receipt_code, supplier_name, created_at
            FROM inventory_receipts
            WHERE receipt_type = 'purchase'
            ORDER BY datetime(created_at) DESC, id DESC
            """
        ).fetchall()
        candidate_receipts: list[dict] = []
        for row in candidate_rows:
            receipt_code = str(row["receipt_code"] or "").strip()
            if not receipt_code or receipt_code in used_receipt_codes:
                continue
            receipt_supplier = str(row["supplier_name"] or "").strip()
            supplier_match = bool(supplier_name and normalize_key(receipt_supplier) == normalize_key(supplier_name))
            receipt_item_rows = connection.execute(
                """
                SELECT product_id
                FROM inventory_receipt_items
                WHERE receipt_id = ? AND transaction_type = 'in'
                """,
                (int(row["id"]),),
            ).fetchall()
            receipt_product_ids = {
                int(item_row["product_id"] or 0)
                for item_row in receipt_item_rows
                if int(item_row["product_id"] or 0) > 0
            }
            overlap_count = len(purchase_product_ids & receipt_product_ids)
            if supplier_name:
                if not supplier_match:
                    continue
            elif overlap_count <= 0:
                continue
            created_at = self._parse_iso_datetime(row["created_at"])
            time_distance_seconds = None
            if purchase_updated_at and created_at:
                time_distance_seconds = abs((purchase_updated_at - created_at).total_seconds())
            score = overlap_count * 100
            if supplier_match:
                score += 25
            if time_distance_seconds is not None:
                score -= min(int(time_distance_seconds // 3600), 72)
            candidate_receipts.append(
                {
                    "receipt_code": receipt_code,
                    "supplier_name": receipt_supplier,
                    "created_at": row["created_at"],
                    "overlap_count": overlap_count,
                    "score": score,
                }
            )

        candidate_receipts.sort(
            key=lambda entry: (
                -int(entry.get("score") or 0),
                -int(entry.get("overlap_count") or 0),
                str(entry.get("created_at") or ""),
                str(entry.get("receipt_code") or ""),
            )
        )
        return candidate_receipts[:8]

    def _get_purchase_source_cart_candidates(
        self,
        connection: sqlite3.Connection,
        purchase: dict,
    ) -> list[dict]:
        source_name = str(purchase.get("sourceName") or purchase.get("source_name") or "").strip()
        purchase_items = purchase.get("items") or []
        purchase_product_ids = {
            int(item.get("productId") or item.get("product_id") or 0)
            for item in purchase_items
            if int(item.get("productId") or item.get("product_id") or 0) > 0
        }
        purchase_updated_at = self._parse_iso_datetime(
            purchase.get("updatedAt") or purchase.get("updated_at") or purchase.get("createdAt") or purchase.get("created_at")
        )
        normalized_source_name = normalize_key(source_name)
        if not normalized_source_name:
            return []

        cart_rows = connection.execute(
            """
            SELECT id, customer_name, status, updated_at, created_at, order_code
            FROM carts
            ORDER BY datetime(updated_at) DESC, id DESC
            """
        ).fetchall()
        cart_item_rows = connection.execute(
            """
            SELECT cart_id, product_id
            FROM cart_items
            """
        ).fetchall()
        cart_product_ids: dict[str, set[int]] = {}
        for row in cart_item_rows:
            cart_id = str(row["cart_id"] or "").strip()
            product_id = int(row["product_id"] or 0)
            if not cart_id or product_id <= 0:
                continue
            cart_product_ids.setdefault(cart_id, set()).add(product_id)

        candidates: list[dict] = []
        for row in cart_rows:
            cart_id = str(row["id"] or "").strip()
            customer_name = str(row["customer_name"] or "").strip()
            normalized_customer_name = normalize_key(customer_name)
            exact_name_match = normalized_customer_name == normalized_source_name
            partial_name_match = normalized_source_name and (
                normalized_source_name in normalized_customer_name
                or normalized_customer_name in normalized_source_name
            )
            overlap_count = len(purchase_product_ids & cart_product_ids.get(cart_id, set()))
            if not exact_name_match and not partial_name_match and overlap_count <= 0:
                continue
            cart_time = self._parse_iso_datetime(row["updated_at"] or row["created_at"])
            time_distance_seconds = None
            if purchase_updated_at and cart_time:
                time_distance_seconds = abs((purchase_updated_at - cart_time).total_seconds())
            score = overlap_count * 100
            if exact_name_match:
                score += 50
            elif partial_name_match:
                score += 15
            if time_distance_seconds is not None:
                score -= min(int(time_distance_seconds // 3600), 72)
            candidates.append(
                {
                    "cart_id": cart_id,
                    "customer_name": customer_name,
                    "status": str(row["status"] or "draft"),
                    "updated_at": row["updated_at"] or row["created_at"],
                    "order_code": str(row["order_code"] or "").strip(),
                    "overlap_count": overlap_count,
                    "score": score,
                }
            )

        candidates.sort(
            key=lambda entry: (
                -int(entry.get("score") or 0),
                -int(entry.get("overlap_count") or 0),
                str(entry.get("updated_at") or ""),
                str(entry.get("cart_id") or ""),
            )
        )
        return candidates[:8]

    def _build_legacy_issue_codes_for_purchase(
        self,
        connection: sqlite3.Connection,
        purchase: dict,
    ) -> list[str]:
        status = str(purchase.get("status") or "draft").strip()
        supplier_name = str(purchase.get("supplierName") or purchase.get("supplier_name") or "").strip()
        receipt_code = str(purchase.get("receiptCode") or purchase.get("receipt_code") or "").strip()
        receipt_row = self._get_inventory_receipt_by_code(
            connection,
            receipt_code,
            receipt_type="purchase",
        )
        received_at = bool(purchase.get("receivedAt") or purchase.get("received_at"))
        paid_at = bool(purchase.get("paidAt") or purchase.get("paid_at"))
        item_count = len(purchase.get("items") or [])
        issue_codes: list[str] = []
        if status == "ordered" and not supplier_name:
            issue_codes.append("ordered_missing_supplier")
        if status == "ordered" and item_count <= 0:
            issue_codes.append("ordered_missing_items")
        if status in {"draft", "ordered"} and (received_at or paid_at or bool(receipt_code)):
            issue_codes.append("open_status_has_processed_markers")
        if status == "paid" and not receipt_row:
            issue_codes.append("paid_missing_valid_receipt")
        return issue_codes

    def _clear_inventory_receipt_source_links(
        self,
        connection: sqlite3.Connection,
        *,
        source_type: str,
        source_code: str,
    ) -> list[str]:
        clean_source_type = str(source_type or "").strip()
        clean_source_code = str(source_code or "").strip()
        if not clean_source_type or not clean_source_code:
            return []
        related_rows = connection.execute(
            """
            SELECT receipt_code
            FROM inventory_receipts
            WHERE source_type = ? AND source_code = ?
            ORDER BY id
            """,
            (clean_source_type, clean_source_code),
        ).fetchall()
        if not related_rows:
            return []
        connection.execute(
            """
            UPDATE inventory_receipts
            SET source_type = '', source_code = ''
            WHERE source_type = ? AND source_code = ?
            """,
            (clean_source_type, clean_source_code),
        )
        return [str(row["receipt_code"] or "").strip() for row in related_rows if row["receipt_code"]]

    def repair_purchase_document(
        self,
        purchase_id: str,
        *,
        action: str,
        actor: str = "",
    ) -> dict:
        clean_purchase_id = str(purchase_id or "").strip()
        clean_action = str(action or "").strip().lower()
        if not clean_purchase_id:
            raise ValueError("Thiếu mã phiếu nhập cần xử lý.")
        if clean_action not in {"delete", "cancel"}:
            raise ValueError("Thao tác xử lý phiếu nhập không hợp lệ.")

        now = utc_now_iso()
        with self._connect() as connection:
            purchases = self._load_sync_collection_from_tables(connection, "purchases")
            target = next(
                (purchase for purchase in purchases if str(purchase.get("id") or "") == clean_purchase_id),
                None,
            )
            if not target:
                raise ValueError("Không tìm thấy phiếu nhập cần xử lý.")

            current_status = str(target.get("status") or "draft")
            is_invalid_paid = self._is_repairable_invalid_purchase(connection, target)
            is_regular_delete_allowed = current_status == "draft"
            is_regular_cancel_allowed = current_status in {"draft", "ordered"}
            if clean_action == "delete":
                action_allowed = is_regular_delete_allowed or is_invalid_paid
            else:
                action_allowed = is_regular_cancel_allowed or is_invalid_paid
            if not action_allowed:
                raise ValueError(
                    "Chỉ được xóa/hủy phiếu nhập nháp, hủy phiếu đã đặt, hoặc xử lý phiếu lỗi chưa có nhập kho thật."
                )

            source_receipt_code = str(
                target.get("receiptCode") or target.get("receipt_code") or ""
            ).strip()
            detached_receipts = self._clear_inventory_receipt_source_links(
                connection,
                source_type="purchase",
                source_code=source_receipt_code,
            )

            if clean_action == "delete":
                next_purchases = [
                    purchase
                    for purchase in purchases
                    if str(purchase.get("id") or "") != clean_purchase_id
                ]
            else:
                next_purchases = []
                for purchase in purchases:
                    if str(purchase.get("id") or "") != clean_purchase_id:
                        next_purchases.append(purchase)
                        continue
                    updated_purchase = {
                        **purchase,
                        "status": "cancelled",
                        "updatedAt": now,
                    }
                    if is_invalid_paid:
                        updated_purchase["paidAt"] = None
                        updated_purchase["paid_at"] = None
                        updated_purchase["receivedAt"] = None
                        updated_purchase["received_at"] = None
                        updated_purchase["receiptCode"] = ""
                        updated_purchase["receipt_code"] = ""
                    next_purchases.append(updated_purchase)

            self._sync_procurement_assignments_for_purchases(
                connection,
                purchases,
                next_purchases,
                actor=actor,
                updated_at=now,
            )
            self._replace_sync_collection_records(connection, "purchases", next_purchases)
            canonical = self._refresh_sync_collection_cache(
                connection,
                "purchases",
                updated_at=now,
            )

            repaired_label = (
                "phiếu lỗi chưa có nhập kho thật"
                if is_invalid_paid
                else ("phiếu nháp" if current_status == "draft" else "phiếu đã đặt")
            )
            action_label = "xóa" if clean_action == "delete" else "hủy"
            message = f"Đã {action_label} {repaired_label}."
            if detached_receipts:
                message += f" Đồng thời đã gỡ liên kết nguồn ở {len(detached_receipts)} phiếu liên quan."

            self._record_audit(
                connection,
                entity_type="purchase",
                entity_id=clean_purchase_id,
                entity_name=source_receipt_code or clean_purchase_id,
                action=f"repair-{clean_action}",
                actor=actor,
                message=message,
            )

        return {
            "message": message,
            "purchases": canonical,
            "detached_receipt_codes": detached_receipts,
        }

    def get_legacy_data_audit(self) -> dict:
        with self._connect() as connection:
            purchases = self._load_sync_collection_from_tables(connection, "purchases")
            carts = self._load_sync_collection_from_tables(connection, "carts")

            safe_cart_paid_at_backfills: list[dict] = []
            for cart in carts:
                status = str(cart.get("status") or "draft").strip()
                payment_status = str(cart.get("paymentStatus") or "unpaid").strip()
                paid_at = str(cart.get("paidAt") or cart.get("paid_at") or "").strip()
                if status != "completed" or payment_status != "paid" or paid_at:
                    continue
                suggested_paid_at = (
                    str(cart.get("completedAt") or cart.get("completed_at") or "").strip()
                    or str(cart.get("updatedAt") or cart.get("updated_at") or "").strip()
                )
                safe_cart_paid_at_backfills.append(
                    {
                        "cart_id": str(cart.get("id") or ""),
                        "customer_name": str(cart.get("customerName") or cart.get("customer_name") or "").strip(),
                        "order_code": str(cart.get("orderCode") or cart.get("order_code") or "").strip(),
                        "suggested_paid_at": suggested_paid_at,
                    }
                )

            safe_purchase_timestamp_backfills: list[dict] = []
            purchase_rows = connection.execute(
                """
                SELECT id, status, supplier_name, updated_at, received_at, paid_at, receipt_code
                FROM purchases
                ORDER BY datetime(updated_at) DESC, id DESC
                """
            ).fetchall()
            for purchase_row in purchase_rows:
                status = str(purchase_row["status"] or "draft").strip()
                if status not in {"received", "paid"}:
                    continue
                purchase_id = str(purchase_row["id"] or "")
                receipt_code = str(purchase_row["receipt_code"] or "").strip()
                received_at = str(purchase_row["received_at"] or "").strip()
                paid_at = str(purchase_row["paid_at"] or "").strip()
                receipt_row = self._get_inventory_receipt_by_code(
                    connection,
                    receipt_code,
                    receipt_type="purchase",
                )
                suggested_received_at = received_at
                suggested_paid_at = paid_at
                needs_fix = False
                if not suggested_received_at:
                    suggested_received_at = str(
                        (receipt_row["created_at"] if receipt_row is not None else "")
                        or purchase_row["updated_at"]
                        or ""
                    ).strip()
                    needs_fix = bool(suggested_received_at)
                if status == "paid" and not suggested_paid_at:
                    suggested_paid_at = str(
                        purchase_row["updated_at"]
                        or suggested_received_at
                        or ""
                    ).strip()
                    needs_fix = needs_fix or bool(suggested_paid_at)
                if needs_fix:
                    safe_purchase_timestamp_backfills.append(
                        {
                            "purchase_id": purchase_id,
                            "status": status,
                            "receipt_code": receipt_code,
                            "supplier_name": str(purchase_row["supplier_name"] or "").strip(),
                            "suggested_received_at": suggested_received_at,
                            "suggested_paid_at": suggested_paid_at,
                        }
                    )

            repairable_purchases: list[dict] = []
            for purchase in purchases:
                if not self._is_repairable_invalid_purchase(connection, purchase):
                    continue
                purchase_id = str(purchase.get("id") or "")
                issue_codes = self._build_legacy_issue_codes_for_purchase(connection, purchase)
                repairable_purchases.append(
                    {
                        "purchase_id": purchase_id,
                        "status": str(purchase.get("status") or "draft"),
                        "receipt_code": str(purchase.get("receiptCode") or purchase.get("receipt_code") or "").strip(),
                        "supplier_name": str(purchase.get("supplierName") or purchase.get("supplier_name") or "").strip(),
                        "source_type": str(purchase.get("sourceType") or purchase.get("source_type") or "").strip(),
                        "source_code": str(purchase.get("sourceCode") or purchase.get("source_code") or "").strip(),
                        "source_name": str(purchase.get("sourceName") or purchase.get("source_name") or "").strip(),
                        "updated_at": str(purchase.get("updatedAt") or purchase.get("updated_at") or "").strip(),
                        "issue_codes": issue_codes,
                        "candidate_receipts": self._get_purchase_receipt_candidates(connection, purchase),
                        "can_cancel": True,
                        "can_delete": str(purchase.get("status") or "draft") == "draft" or bool(issue_codes),
                    }
                )

            purchase_source_link_candidates: list[dict] = []
            for purchase in purchases:
                source_type = str(purchase.get("sourceType") or purchase.get("source_type") or "").strip()
                source_code = str(purchase.get("sourceCode") or purchase.get("source_code") or "").strip()
                source_name = str(purchase.get("sourceName") or purchase.get("source_name") or "").strip()
                if source_type != "cart" or source_code or not source_name:
                    continue
                purchase_source_link_candidates.append(
                    {
                        "purchase_id": str(purchase.get("id") or ""),
                        "status": str(purchase.get("status") or "draft"),
                        "supplier_name": str(purchase.get("supplierName") or purchase.get("supplier_name") or "").strip(),
                        "source_name": source_name,
                        "updated_at": str(purchase.get("updatedAt") or purchase.get("updated_at") or "").strip(),
                        "candidate_carts": self._get_purchase_source_cart_candidates(connection, purchase),
                    }
                )

        repairable_purchases.sort(
            key=lambda entry: (
                0 if "ordered_missing_supplier" in entry["issue_codes"] else 1,
                str(entry.get("updated_at") or ""),
                str(entry.get("purchase_id") or ""),
            )
        )
        purchase_source_link_candidates.sort(
            key=lambda entry: (
                str(entry.get("updated_at") or ""),
                str(entry.get("purchase_id") or ""),
            )
        )

        return {
            "generated_at": utc_now_iso(),
            "summary": {
                "safe_cart_paid_at_backfills": len(safe_cart_paid_at_backfills),
                "safe_purchase_timestamp_backfills": len(safe_purchase_timestamp_backfills),
                "manual_repairable_purchases": len(repairable_purchases),
                "manual_purchase_source_links": len(purchase_source_link_candidates),
                "safe_fix_total": len(safe_cart_paid_at_backfills) + len(safe_purchase_timestamp_backfills),
                "manual_review_total": len(repairable_purchases) + len(purchase_source_link_candidates),
            },
            "safe_fixes": {
                "cart_paid_at_backfills": safe_cart_paid_at_backfills,
                "purchase_timestamp_backfills": safe_purchase_timestamp_backfills,
            },
            "manual_review": {
                "repairable_purchases": repairable_purchases,
                "purchase_source_links": purchase_source_link_candidates,
            },
        }

    def apply_safe_legacy_fixes(
        self,
        *,
        actor: str = "",
    ) -> dict:
        clean_actor = (actor or "").strip() or "Master Admin"
        now = utc_now_iso()
        with self._connect() as connection:
            carts = self._load_sync_collection_from_tables(connection, "carts")
            cart_paid_fix_count = 0
            for cart in carts:
                status = str(cart.get("status") or "draft").strip()
                payment_status = str(cart.get("paymentStatus") or "unpaid").strip()
                paid_at = str(cart.get("paidAt") or cart.get("paid_at") or "").strip()
                if status != "completed" or payment_status != "paid" or paid_at:
                    continue
                suggested_paid_at = (
                    str(cart.get("completedAt") or cart.get("completed_at") or "").strip()
                    or str(cart.get("updatedAt") or cart.get("updated_at") or "").strip()
                )
                if not suggested_paid_at:
                    continue
                cursor = connection.execute(
                    """
                    UPDATE carts
                    SET paid_at = ?, updated_at = ?
                    WHERE id = ? AND TRIM(COALESCE(paid_at, '')) = ''
                    """,
                    (suggested_paid_at, now, str(cart.get("id") or "")),
                )
                if int(cursor.rowcount or 0) <= 0:
                    continue
                cart_paid_fix_count += 1
                self._record_audit(
                    connection,
                    entity_type="cart",
                    entity_id=str(cart.get("id") or ""),
                    entity_name=str(cart.get("orderCode") or cart.get("id") or ""),
                    action="legacy-safe-fix",
                    actor=clean_actor,
                    message=f"Tự động backfill paid_at cho đơn đã thanh toán: {suggested_paid_at}.",
                )

            purchase_timestamp_fix_count = 0
            purchase_rows = connection.execute(
                """
                SELECT id, status, updated_at, received_at, paid_at, receipt_code
                FROM purchases
                ORDER BY datetime(updated_at) DESC, id DESC
                """
            ).fetchall()
            for purchase_row in purchase_rows:
                status = str(purchase_row["status"] or "draft").strip()
                if status not in {"received", "paid"}:
                    continue
                purchase_id = str(purchase_row["id"] or "")
                receipt_code = str(purchase_row["receipt_code"] or "").strip()
                receipt_row = self._get_inventory_receipt_by_code(
                    connection,
                    receipt_code,
                    receipt_type="purchase",
                )
                next_received_at = str(purchase_row["received_at"] or "").strip()
                next_paid_at = str(purchase_row["paid_at"] or "").strip()
                if not next_received_at:
                    next_received_at = str(
                        (receipt_row["created_at"] if receipt_row is not None else "")
                        or purchase_row["updated_at"]
                        or ""
                    ).strip()
                if status == "paid" and not next_paid_at:
                    next_paid_at = str(
                        purchase_row["updated_at"]
                        or next_received_at
                        or ""
                    ).strip()
                current_row = connection.execute(
                    """
                    SELECT COALESCE(received_at, '') AS received_at, COALESCE(paid_at, '') AS paid_at
                    FROM purchases
                    WHERE id = ?
                    """,
                    (purchase_id,),
                ).fetchone()
                if current_row is None:
                    continue
                if (
                    str(current_row["received_at"] or "").strip() == next_received_at
                    and str(current_row["paid_at"] or "").strip() == next_paid_at
                ):
                    continue
                cursor = connection.execute(
                    """
                    UPDATE purchases
                    SET received_at = ?, paid_at = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (next_received_at or None, next_paid_at or None, now, purchase_id),
                )
                if int(cursor.rowcount or 0) <= 0:
                    continue
                purchase_timestamp_fix_count += 1
                self._record_audit(
                    connection,
                    entity_type="purchase",
                    entity_id=purchase_id,
                    entity_name=receipt_code or purchase_id,
                    action="legacy-safe-fix",
                    actor=clean_actor,
                    message=(
                        "Tự động backfill mốc thời gian legacy cho phiếu nhập."
                        f" received_at={next_received_at or 'rỗng'} | paid_at={next_paid_at or 'rỗng'}"
                    ),
                )

            refreshed = {}
            if cart_paid_fix_count > 0:
                refreshed["carts"] = self._refresh_sync_collection_cache(connection, "carts", updated_at=now)
            if purchase_timestamp_fix_count > 0:
                refreshed["purchases"] = self._refresh_sync_collection_cache(connection, "purchases", updated_at=now)

        audit = self.get_legacy_data_audit()
        return {
            "message": (
                "Đã áp dụng fix legacy an toàn."
                f" Cart paid_at: {cart_paid_fix_count}. Purchase timestamp: {purchase_timestamp_fix_count}."
            ),
            "counts": {
                "cart_paid_at_backfills": cart_paid_fix_count,
                "purchase_timestamp_backfills": purchase_timestamp_fix_count,
            },
            "audit": audit,
        }

    def attach_purchase_receipt_code(
        self,
        purchase_id: str,
        receipt_code: str,
        *,
        actor: str = "",
    ) -> dict:
        clean_purchase_id = str(purchase_id or "").strip()
        clean_receipt_code = str(receipt_code or "").strip()
        clean_actor = (actor or "").strip() or "Master Admin"
        if not clean_purchase_id:
            raise ValueError("Thiếu mã phiếu nhập cần gắn receipt.")
        if not clean_receipt_code:
            raise ValueError("Thiếu receipt_code cần gắn.")

        now = utc_now_iso()
        with self._connect() as connection:
            purchases = self._load_sync_collection_from_tables(connection, "purchases")
            target = next(
                (purchase for purchase in purchases if str(purchase.get("id") or "") == clean_purchase_id),
                None,
            )
            if not target:
                raise ValueError("Không tìm thấy phiếu nhập cần gắn receipt.")
            status = str(target.get("status") or "draft").strip()
            if status not in {"received", "paid"}:
                raise ValueError("Chỉ phiếu đã nhập kho hoặc đã thanh toán mới được gắn receipt.")

            receipt_row = self._get_inventory_receipt_by_code(
                connection,
                clean_receipt_code,
                receipt_type="purchase",
            )
            if receipt_row is None:
                raise ValueError("Không tìm thấy receipt nhập kho hợp lệ.")

            owner_row = connection.execute(
                """
                SELECT id
                FROM purchases
                WHERE receipt_code = ? AND id <> ?
                """,
                (clean_receipt_code, clean_purchase_id),
            ).fetchone()
            if owner_row is not None:
                raise ValueError("Receipt này đang thuộc phiếu nhập khác.")

            purchase_supplier = str(target.get("supplierName") or target.get("supplier_name") or "").strip()
            receipt_supplier = str(receipt_row["supplier_name"] or "").strip()
            if purchase_supplier and receipt_supplier and normalize_key(purchase_supplier) != normalize_key(receipt_supplier):
                raise ValueError("Receipt được chọn không khớp nhà cung cấp của phiếu nhập.")

            current_receipt_code = str(target.get("receiptCode") or target.get("receipt_code") or "").strip()
            current_received_at = str(target.get("receivedAt") or target.get("received_at") or "").strip()
            current_paid_at = str(target.get("paidAt") or target.get("paid_at") or "").strip()
            next_received_at = current_received_at or str(receipt_row["created_at"] or "").strip()
            next_paid_at = current_paid_at
            if status == "paid" and not next_paid_at:
                next_paid_at = str(target.get("updatedAt") or target.get("updated_at") or next_received_at or "").strip()

            connection.execute(
                """
                UPDATE purchases
                SET receipt_code = ?, received_at = ?, paid_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    clean_receipt_code,
                    next_received_at or None,
                    next_paid_at or None,
                    now,
                    clean_purchase_id,
                ),
            )
            canonical = self._refresh_sync_collection_cache(
                connection,
                "purchases",
                updated_at=now,
            )
            self._record_audit(
                connection,
                entity_type="purchase",
                entity_id=clean_purchase_id,
                entity_name=clean_receipt_code,
                action="legacy-attach-receipt",
                actor=clean_actor,
                message=(
                    f"Gắn receipt {clean_receipt_code} cho phiếu nhập legacy."
                    + (f" Receipt cũ: {current_receipt_code}." if current_receipt_code else "")
                ),
            )

        purchase = next((entry for entry in canonical if str(entry.get("id") or "") == clean_purchase_id), None)
        return {
            "message": f"Đã gắn receipt {clean_receipt_code} cho phiếu nhập.",
            "purchase": purchase,
            "purchases": canonical,
            "audit": self.get_legacy_data_audit(),
        }

    def attach_purchase_source_cart(
        self,
        purchase_id: str,
        cart_id: str,
        *,
        actor: str = "",
    ) -> dict:
        clean_purchase_id = str(purchase_id or "").strip()
        clean_cart_id = str(cart_id or "").strip()
        clean_actor = (actor or "").strip() or "Master Admin"
        if not clean_purchase_id:
            raise ValueError("Thiếu mã phiếu nhập cần gắn đơn nguồn.")
        if not clean_cart_id:
            raise ValueError("Thiếu mã đơn nguồn cần gắn.")

        now = utc_now_iso()
        with self._connect() as connection:
            cart_row = connection.execute(
                """
                SELECT id, customer_name
                FROM carts
                WHERE id = ?
                """,
                (clean_cart_id,),
            ).fetchone()
            if cart_row is None:
                raise ValueError("Không tìm thấy đơn nguồn cần gắn.")

            purchases = self._load_sync_collection_from_tables(connection, "purchases")
            target = next(
                (purchase for purchase in purchases if str(purchase.get("id") or "") == clean_purchase_id),
                None,
            )
            if not target:
                raise ValueError("Không tìm thấy phiếu nhập cần gắn đơn nguồn.")

            connection.execute(
                """
                UPDATE purchases
                SET source_type = 'cart', source_code = ?, source_name = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    clean_cart_id,
                    str(cart_row["customer_name"] or "").strip(),
                    now,
                    clean_purchase_id,
                ),
            )
            canonical = self._refresh_sync_collection_cache(
                connection,
                "purchases",
                updated_at=now,
            )
            self._record_audit(
                connection,
                entity_type="purchase",
                entity_id=clean_purchase_id,
                entity_name=str(target.get("receiptCode") or target.get("receipt_code") or clean_purchase_id),
                action="legacy-attach-source",
                actor=clean_actor,
                message=f"Gắn lại đơn nguồn {clean_cart_id} cho phiếu nhập legacy.",
            )

        purchase = next((entry for entry in canonical if str(entry.get("id") or "") == clean_purchase_id), None)
        return {
            "message": f"Đã gắn đơn nguồn {clean_cart_id} cho phiếu nhập.",
            "purchase": purchase,
            "purchases": canonical,
            "audit": self.get_legacy_data_audit(),
        }

    def create_inventory_adjustment_receipt(
        self,
        items: list[dict],
        reason: str,
        actor: str = "",
        note: str = "",
    ) -> dict:
        clean_reason = (reason or "").strip()
        clean_actor = (actor or "").strip() or "Master Admin"
        clean_note = (note or "").strip()
        if not clean_reason:
            raise ValueError("Lý do điều chỉnh là bắt buộc.")
        if not items:
            raise ValueError("Phiếu điều chỉnh đang trống.")

        now = utc_now_iso()
        receipt_suffix = hashlib.sha1(f"{clean_reason}-{clean_actor}-{now}".encode("utf-8")).hexdigest()[:6]
        receipt_code = f"DC-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{receipt_suffix}"

        with self._connect() as connection:
            transactions = []
            total_in = Decimal("0")
            total_out = Decimal("0")
            receipt_id = self._insert_inventory_receipt(
                connection,
                receipt_code=receipt_code,
                receipt_type="inventory_adjustment",
                actor=clean_actor,
                reason=clean_reason,
                note=clean_note,
                created_at=now,
            )

            for raw_item in items:
                product_id = int(raw_item.get("product_id", 0))
                delta = Decimal(str(raw_item.get("quantity_delta", 0)))
                if delta == 0:
                    raise ValueError("Số lượng điều chỉnh phải khác 0.")
                quantity = parse_positive_decimal(abs(delta), "Số lượng điều chỉnh")
                direction = "in" if delta > 0 else "out"
                clean_batch_code = str(raw_item.get("batch_code") or raw_item.get("batchCode") or "").strip()
                normalized_expiry_date = self._normalize_expiry_date(
                    raw_item.get("expiry_date") or raw_item.get("expiryDate"),
                    field_name="Hạn dùng lô điều chỉnh",
                )
                product = self._get_product_or_raise(connection, product_id)
                current_stock = self._get_stock_for_product(connection, product_id)
                if direction == "out" and quantity > current_stock:
                    raise ValueError(
                        f"Số lượng điều chỉnh giảm của {product['name']} lớn hơn tồn kho hiện tại."
                    )

                transaction_note = (
                    f"Phiếu điều chỉnh {receipt_code} | Người chỉnh: {clean_actor} | Lý do: {clean_reason}"
                )
                if clean_note:
                    transaction_note += f" | {clean_note}"

                cursor = connection.execute(
                    """
                    INSERT INTO transactions(product_id, transaction_type, quantity, note, created_at)
                    VALUES(?, ?, ?, ?, ?)
                    """,
                    (product_id, direction, float(quantity), transaction_note, now),
                )
                created_batch = None
                lot_allocations: list[dict] = []
                if direction == "in":
                    created_batch = self._create_inventory_batch(
                        connection,
                        product=product,
                        quantity=quantity,
                        unit_cost=Decimal(str(product["price"] or 0)),
                        received_at=now,
                        source_receipt_code=receipt_code,
                        source_receipt_type="inventory_adjustment",
                        source_transaction_id=int(cursor.lastrowid),
                        transaction_id=int(cursor.lastrowid),
                        batch_code=clean_batch_code,
                        expiry_date=normalized_expiry_date,
                        note=clean_note,
                        fallback_batch_code=f"{receipt_code}-L{product_id}-{cursor.lastrowid}",
                    )
                    transaction_note += f" | {self._format_batch_allocations_note([created_batch], prefix='Lô nhập')}"
                else:
                    lot_allocations = self._consume_inventory_batches(
                        connection,
                        product_id=product_id,
                        quantity=quantity,
                        transaction_id=int(cursor.lastrowid),
                        created_at=now,
                    )
                    transaction_note += f" | {self._format_batch_allocations_note(lot_allocations, prefix='Lô xuất FIFO')}"
                connection.execute(
                    "UPDATE transactions SET note = ? WHERE id = ?",
                    (transaction_note, int(cursor.lastrowid)),
                )
                current_after = self._get_stock_for_product(connection, product_id)
                if direction == "in":
                    total_in += quantity
                else:
                    total_out += quantity
                transactions.append(
                    {
                        "id": cursor.lastrowid,
                        "product_id": product_id,
                        "product_name": product["name"],
                        "unit": product["unit"],
                        "transaction_type": direction,
                        "quantity": float(quantity),
                        "current_stock": round(float(current_after), 2),
                        "batch_code": created_batch["batch_code"] if created_batch else "",
                        "expiry_date": created_batch["expiry_date"] if created_batch else "",
                        "lot_allocations": lot_allocations,
                    }
                )
                self._insert_inventory_receipt_item(
                    connection,
                    receipt_id=receipt_id,
                    product_id=product_id,
                    product_name=product["name"],
                    unit=product["unit"],
                    transaction_type=direction,
                    quantity=round(float(quantity), 2),
                    unit_amount=None,
                    line_total=None,
                    stock_after=round(float(current_after), 2),
                    transaction_id=cursor.lastrowid,
                    batch_id=int(created_batch["id"]) if created_batch else None,
                    batch_code=created_batch["batch_code"] if created_batch else "",
                    expiry_date=created_batch["expiry_date"] if created_batch else None,
                )

            self._record_audit(
                connection,
                entity_type="inventory_adjustment",
                entity_id=receipt_code,
                entity_name="Phiếu điều chỉnh tồn",
                action="create",
                actor=clean_actor,
                message=(
                    f"Tạo phiếu điều chỉnh tồn {receipt_code} | Lý do: {clean_reason} | "
                    f"Tăng {round(float(total_in), 2):g} | Giảm {round(float(total_out), 2):g}"
                ),
            )

        return {
            "receipt_code": receipt_code,
            "reason": clean_reason,
            "actor": clean_actor,
            "note": clean_note,
            "created_at": now,
            "transactions": transactions,
            "total_in_quantity": round(float(total_in), 2),
            "total_out_quantity": round(float(total_out), 2),
        }

    def create_customer_return_receipt(
        self,
        customer_name: str,
        items: list[dict],
        note: str = "",
        source_type: str = "",
        source_code: str = "",
        actor: str = "",
    ) -> dict:
        clean_customer_name = (customer_name or "").strip()
        clean_note = (note or "").strip()
        clean_source_type = (source_type or "").strip()
        clean_source_code = (source_code or "").strip()
        clean_actor = (actor or "").strip()
        if not clean_customer_name:
            raise ValueError("Khách hàng là bắt buộc.")
        if not items:
            raise ValueError("Phiếu trả hàng khách đang trống.")

        grouped_items: dict[tuple[int, str, str], dict] = {}
        for raw_item in items:
            product_id = int(raw_item.get("product_id", 0))
            quantity = parse_positive_decimal(raw_item.get("quantity"), "Số lượng")
            unit_refund = parse_non_negative_decimal(raw_item.get("unit_refund", 0), "Giá hoàn")
            clean_batch_code = str(raw_item.get("batch_code") or raw_item.get("batchCode") or "").strip()
            normalized_expiry_date = self._normalize_expiry_date(
                raw_item.get("expiry_date") or raw_item.get("expiryDate"),
                field_name="Hạn dùng lô trả khách",
            )
            item_key = (
                product_id,
                clean_batch_code,
                normalized_expiry_date or "",
            )

            existing = grouped_items.get(item_key)
            if existing:
                existing["quantity"] += quantity
                existing["unit_refund"] = unit_refund
            else:
                grouped_items[item_key] = {
                    "product_id": product_id,
                    "quantity": quantity,
                    "unit_refund": unit_refund,
                    "batch_code": clean_batch_code,
                    "expiry_date": normalized_expiry_date,
                }

        now = utc_now_iso()
        receipt_suffix = hashlib.sha1(f"{clean_customer_name}-{clean_note}-{now}".encode("utf-8")).hexdigest()[:6]
        receipt_code = f"THK-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{receipt_suffix}"

        with self._connect() as connection:
            transactions = []
            total_amount = Decimal("0")
            total_quantity = Decimal("0")
            receipt_id = self._insert_inventory_receipt(
                connection,
                receipt_code=receipt_code,
                receipt_type="customer_return",
                customer_name=clean_customer_name,
                source_type=clean_source_type,
                source_code=clean_source_code,
                actor=clean_actor,
                note=clean_note,
                created_at=now,
            )

            for line_index, item in enumerate(grouped_items.values(), start=1):
                product_id = int(item["product_id"])
                product = self._get_product_or_raise(connection, product_id)
                line_total = item["quantity"] * item["unit_refund"]
                total_amount += line_total
                total_quantity += item["quantity"]
                resolved_batch_code = self._resolve_batch_code(
                    item.get("batch_code", ""),
                    f"{receipt_code}-L{line_index}",
                )
                resolved_expiry_date = item.get("expiry_date")

                transaction_note = (
                    f"Phiếu trả khách {receipt_code} | Khách: {clean_customer_name} | Giá hoàn: {float(item['unit_refund']):.0f}"
                )
                if clean_note:
                    transaction_note += f" | {clean_note}"
                transaction_note += f" | Lô nhập: {resolved_batch_code} {float(item['quantity']):g}"
                if resolved_expiry_date:
                    transaction_note += f" HSD {resolved_expiry_date}"

                cursor = connection.execute(
                    """
                    INSERT INTO transactions(product_id, transaction_type, quantity, note, created_at)
                    VALUES(?, 'in', ?, ?, ?)
                    """,
                    (product_id, float(item["quantity"]), transaction_note, now),
                )
                created_batch = self._create_inventory_batch(
                    connection,
                    product=product,
                    quantity=item["quantity"],
                    unit_cost=Decimal(str(product["price"] or 0)),
                    received_at=now,
                    source_receipt_code=receipt_code,
                    source_receipt_type="customer_return",
                    source_transaction_id=int(cursor.lastrowid),
                    transaction_id=int(cursor.lastrowid),
                    batch_code=resolved_batch_code,
                    expiry_date=resolved_expiry_date,
                    note=clean_note,
                    fallback_batch_code=resolved_batch_code,
                )
                current_stock = self._get_stock_for_product(connection, product_id)
                transactions.append(
                    {
                        "id": cursor.lastrowid,
                        "product_id": product_id,
                        "product_name": product["name"],
                        "unit": product["unit"],
                        "quantity": float(item["quantity"]),
                        "unit_refund": float(item["unit_refund"]),
                        "line_total": round(float(line_total), 2),
                        "current_stock": round(float(current_stock), 2),
                        "batch_code": created_batch["batch_code"],
                        "expiry_date": created_batch["expiry_date"],
                    }
                )
                self._insert_inventory_receipt_item(
                    connection,
                    receipt_id=receipt_id,
                    product_id=product_id,
                    product_name=product["name"],
                    unit=product["unit"],
                    transaction_type="in",
                    quantity=round(float(item["quantity"]), 2),
                    unit_amount=round(float(item["unit_refund"]), 2),
                    line_total=round(float(line_total), 2),
                    stock_after=round(float(current_stock), 2),
                    transaction_id=cursor.lastrowid,
                    batch_id=int(created_batch["id"]),
                    batch_code=created_batch["batch_code"],
                    expiry_date=created_batch["expiry_date"],
                )
            self._record_audit(
                connection,
                entity_type="customer_return",
                entity_id=receipt_code,
                entity_name=clean_customer_name,
                action="create",
                actor=clean_actor,
                message=(
                    f"Tạo phiếu trả hàng khách {receipt_code} | Khách: {clean_customer_name} | "
                    f"Tổng SL: {round(float(total_quantity), 2):g} | Tổng hoàn: {round(float(total_amount), 2):.0f}"
                    + (f" | Nguồn: {clean_source_code}" if clean_source_code else "")
                ),
            )

        return {
            "receipt_code": receipt_code,
            "customer_name": clean_customer_name,
            "source_type": clean_source_type,
            "source_code": clean_source_code,
            "actor": clean_actor,
            "note": clean_note,
            "created_at": now,
            "transactions": transactions,
            "total_quantity": round(float(total_quantity), 2),
            "total_amount": round(float(total_amount), 2),
        }

    def create_supplier_return_receipt(
        self,
        supplier_name: str,
        items: list[dict],
        note: str = "",
        source_type: str = "",
        source_code: str = "",
        actor: str = "",
    ) -> dict:
        clean_supplier_name = (supplier_name or "").strip()
        clean_note = (note or "").strip()
        clean_source_type = (source_type or "").strip()
        clean_source_code = (source_code or "").strip()
        clean_actor = (actor or "").strip()
        if not clean_supplier_name:
            raise ValueError("Nhà cung cấp là bắt buộc.")
        if not items:
            raise ValueError("Phiếu trả NCC đang trống.")

        grouped_items: dict[tuple[int, str], dict] = {}
        for raw_item in items:
            product_id = int(raw_item.get("product_id", 0))
            quantity = parse_positive_decimal(raw_item.get("quantity"), "Số lượng")
            unit_cost = parse_non_negative_decimal(raw_item.get("unit_cost", 0), "Giá trả NCC")
            clean_batch_code = str(raw_item.get("batch_code") or raw_item.get("batchCode") or "").strip()
            item_key = (product_id, clean_batch_code)

            existing = grouped_items.get(item_key)
            if existing:
                existing["quantity"] += quantity
                existing["unit_cost"] = unit_cost
            else:
                grouped_items[item_key] = {
                    "product_id": product_id,
                    "quantity": quantity,
                    "unit_cost": unit_cost,
                    "batch_code": clean_batch_code,
                }

        now = utc_now_iso()
        receipt_suffix = hashlib.sha1(f"{clean_supplier_name}-{clean_note}-{now}".encode("utf-8")).hexdigest()[:6]
        receipt_code = f"TNCC-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{receipt_suffix}"

        with self._connect() as connection:
            products_by_id: dict[int, sqlite3.Row] = {}
            current_stock_by_id: dict[int, Decimal] = {}
            for item in grouped_items.values():
                product_id = int(item["product_id"])
                product = self._get_product_or_raise(connection, product_id)
                current_stock = self._get_stock_for_product(connection, product_id)
                if item["quantity"] > current_stock:
                    raise ValueError(
                        f"Số lượng trả NCC của {product['name']} lớn hơn tồn kho hiện tại."
                    )
                products_by_id[product_id] = product
                current_stock_by_id[product_id] = current_stock

            transactions = []
            total_amount = Decimal("0")
            total_quantity = Decimal("0")
            receipt_id = self._insert_inventory_receipt(
                connection,
                receipt_code=receipt_code,
                receipt_type="supplier_return",
                supplier_name=clean_supplier_name,
                source_type=clean_source_type,
                source_code=clean_source_code,
                actor=clean_actor,
                note=clean_note,
                created_at=now,
            )
            for item in grouped_items.values():
                product_id = int(item["product_id"])
                product = products_by_id[product_id]
                line_total = item["quantity"] * item["unit_cost"]
                total_amount += line_total
                total_quantity += item["quantity"]
                transaction_note = (
                    f"Phiếu trả NCC {receipt_code} | NCC: {clean_supplier_name} | Giá trả: {float(item['unit_cost']):.0f}"
                )
                if clean_note:
                    transaction_note += f" | {clean_note}"
                cursor = connection.execute(
                    """
                    INSERT INTO transactions(product_id, transaction_type, quantity, note, created_at)
                    VALUES(?, 'out', ?, ?, ?)
                    """,
                    (product_id, float(item["quantity"]), transaction_note, now),
                )
                lot_allocations = self._consume_inventory_batches(
                    connection,
                    product_id=product_id,
                    quantity=item["quantity"],
                    transaction_id=int(cursor.lastrowid),
                    created_at=now,
                    preferred_batch_code=item.get("batch_code", ""),
                )
                transaction_note += f" | {self._format_batch_allocations_note(lot_allocations, prefix='Lô xuất FIFO')}"
                connection.execute(
                    "UPDATE transactions SET note = ? WHERE id = ?",
                    (transaction_note, int(cursor.lastrowid)),
                )
                remaining_stock = current_stock_by_id[product_id] - item["quantity"]
                current_stock_by_id[product_id] = remaining_stock
                transactions.append(
                    {
                        "id": cursor.lastrowid,
                        "product_id": product_id,
                        "product_name": product["name"],
                        "unit": product["unit"],
                        "quantity": float(item["quantity"]),
                        "unit_cost": float(item["unit_cost"]),
                        "line_total": round(float(line_total), 2),
                        "remaining_stock": round(float(remaining_stock), 2),
                        "batch_code": item.get("batch_code", ""),
                        "lot_allocations": lot_allocations,
                    }
                )
                self._insert_inventory_receipt_item(
                    connection,
                    receipt_id=receipt_id,
                    product_id=product_id,
                    product_name=product["name"],
                    unit=product["unit"],
                    transaction_type="out",
                    quantity=round(float(item["quantity"]), 2),
                    unit_amount=round(float(item["unit_cost"]), 2),
                    line_total=round(float(line_total), 2),
                    stock_after=round(float(remaining_stock), 2),
                    transaction_id=cursor.lastrowid,
                    batch_code=item.get("batch_code", ""),
                )
            self._record_audit(
                connection,
                entity_type="supplier_return",
                entity_id=receipt_code,
                entity_name=clean_supplier_name,
                action="create",
                actor=clean_actor,
                message=(
                    f"Tạo phiếu trả NCC {receipt_code} | NCC: {clean_supplier_name} | "
                    f"Tổng SL: {round(float(total_quantity), 2):g} | Tổng trả: {round(float(total_amount), 2):.0f}"
                    + (f" | Nguồn: {clean_source_code}" if clean_source_code else "")
                ),
            )

        return {
            "receipt_code": receipt_code,
            "supplier_name": clean_supplier_name,
            "source_type": clean_source_type,
            "source_code": clean_source_code,
            "actor": clean_actor,
            "note": clean_note,
            "created_at": now,
            "transactions": transactions,
            "total_quantity": round(float(total_quantity), 2),
            "total_amount": round(float(total_amount), 2),
        }

    @staticmethod
    def _clamp_ratio(value: float) -> float:
        if value <= 0:
            return 0.0
        if value >= 1:
            return 1.0
        return value

    @staticmethod
    def _parse_iso_datetime(value: str | None) -> datetime | None:
        clean_value = str(value or "").strip()
        if not clean_value:
            return None
        try:
            parsed = datetime.fromisoformat(clean_value.replace("Z", "+00:00"))
        except ValueError:
            return None
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

    @staticmethod
    def _optional_float(value) -> float | None:
        if value is None:
            return None
        return round(float(value), 2)

    def _build_product_metric_map(self, connection: sqlite3.Connection, product_ids: list[int]) -> dict[int, dict]:
        if not product_ids:
            return {}

        placeholders = ",".join("?" for _ in product_ids)
        transaction_rows = connection.execute(
            f"""
            SELECT
                t.product_id,
                t.transaction_type,
                t.quantity,
                t.note,
                t.created_at,
                ir.receipt_type
            FROM transactions t
            LEFT JOIN inventory_receipt_items iri ON iri.transaction_id = t.id
            LEFT JOIN inventory_receipts ir ON ir.id = iri.receipt_id
            WHERE t.product_id IN ({placeholders})
            ORDER BY t.created_at ASC, t.id ASC
            """,
            product_ids,
        ).fetchall()

        now = datetime.now()
        start_6_month = month_key(*shift_month(now.year, now.month, -5))
        start_12_month = month_key(*shift_month(now.year, now.month, -11))
        metrics = {
            product_id: {
                "sales_6m_total": 0.0,
                "sales_12m_total": 0.0,
                "last_purchase_inbound_at": "",
                "last_fallback_inbound_at": "",
            }
            for product_id in product_ids
        }

        for row in transaction_rows:
            product_id = int(row["product_id"] or 0)
            if product_id not in metrics:
                continue

            note = row["note"] or ""
            transaction_kind = detect_report_transaction_kind(row["receipt_type"], note)
            created_at = str(row["created_at"] or "")
            row_month = created_at[:7]
            quantity = float(row["quantity"] or 0)

            if row["transaction_type"] == "out" and transaction_kind == "sale":
                if row_month >= start_12_month:
                    metrics[product_id]["sales_12m_total"] += quantity
                if row_month >= start_6_month:
                    metrics[product_id]["sales_6m_total"] += quantity

            if row["transaction_type"] != "in":
                continue
            if transaction_kind == "purchase":
                if created_at > metrics[product_id]["last_purchase_inbound_at"]:
                    metrics[product_id]["last_purchase_inbound_at"] = created_at
                continue
            if transaction_kind:
                continue
            if created_at > metrics[product_id]["last_fallback_inbound_at"]:
                metrics[product_id]["last_fallback_inbound_at"] = created_at

        return metrics

    def _serialize_product_rows(self, connection: sqlite3.Connection, rows: list[sqlite3.Row]) -> list[dict]:
        product_ids = [int(row["id"]) for row in rows]
        metric_map = self._build_product_metric_map(connection, product_ids)
        batch_map = self._build_batch_map_for_products(connection, product_ids)
        return [
            self._serialize_product_row(
                row,
                metric_map.get(int(row["id"]), {}),
                batch_map.get(int(row["id"]), []),
            )
            for row in rows
        ]

    def _serialize_product_row(
        self,
        row: sqlite3.Row,
        metrics: dict | None = None,
        lots: list[dict] | None = None,
    ) -> dict:
        metrics = metrics or {}
        lots = lots or []
        current_stock = round(float(row["current_stock"]), 2)
        threshold = round(float(row["low_stock_threshold"]), 2)
        price = round(float(row["price"]), 2)
        sales_6m_total = round(float(metrics.get("sales_6m_total") or 0), 2)
        sales_12m_total = round(float(metrics.get("sales_12m_total") or 0), 2)
        sales_6m_avg = round(sales_6m_total / 6, 2)
        sales_12m_avg = round(sales_12m_total / 12, 2)
        avg_monthly_out = sales_6m_avg if sales_6m_total > 0 else sales_12m_avg
        priority_base_stock = round(max(threshold, avg_monthly_out, 1.0), 2)
        demand_pressure = self._clamp_ratio(avg_monthly_out / priority_base_stock)
        shortage_pressure = self._clamp_ratio((priority_base_stock - current_stock) / priority_base_stock)
        priority_score = round(100 * ((demand_pressure + shortage_pressure) / 2), 2)
        if current_stock <= 0:
            urgency_tier = 3
        elif current_stock <= threshold:
            urgency_tier = 2
        elif current_stock < priority_base_stock:
            urgency_tier = 1
        else:
            urgency_tier = 0

        shelf_life_days = self._optional_float(row["shelf_life_days"])
        storage_life_days = self._optional_float(row["storage_life_days"])
        last_purchase_inbound_at = (
            str(metrics.get("last_purchase_inbound_at") or "").strip()
            or str(metrics.get("last_fallback_inbound_at") or "").strip()
        )
        estimated_remaining_days = None
        expiry_basis = "unknown"
        next_expiry_date = ""
        known_expiry_lots = [lot for lot in lots if lot.get("expiry_date")]
        if known_expiry_lots:
            earliest_lot = known_expiry_lots[0]
            estimated_remaining_days = earliest_lot.get("days_to_expiry")
            next_expiry_date = str(earliest_lot.get("expiry_date") or "")
            expiry_basis = "lot_expiry"
        else:
            expiry_source_date = self._parse_iso_datetime(last_purchase_inbound_at)
            if expiry_source_date and shelf_life_days is not None:
                days_since_inbound = max(
                    0,
                    int((datetime.now(timezone.utc) - expiry_source_date).total_seconds() // 86400),
                )
                estimated_remaining_days = round(shelf_life_days - days_since_inbound, 2)
                expiry_basis = "shelf_life"
            elif expiry_source_date and storage_life_days is not None:
                days_since_inbound = max(
                    0,
                    int((datetime.now(timezone.utc) - expiry_source_date).total_seconds() // 86400),
                )
                estimated_remaining_days = round(storage_life_days - days_since_inbound, 2)
                expiry_basis = "storage_life"
        return {
            "id": row["id"],
            "name": row["name"],
            "category": row["category"],
            "unit": row["unit"],
            "price": price,
            "sale_price": round(float(row["sale_price"]), 2),
            "low_stock_threshold": threshold,
            "shelf_life_days": shelf_life_days,
            "storage_life_days": storage_life_days,
            "current_stock": current_stock,
            "inventory_value": round(current_stock * price, 2),
            "sales_6m_total": sales_6m_total,
            "sales_6m_avg": sales_6m_avg,
            "sales_12m_total": sales_12m_total,
            "sales_12m_avg": sales_12m_avg,
            "priority_base_stock": priority_base_stock,
            "demand_pressure": round(demand_pressure, 4),
            "shortage_pressure": round(shortage_pressure, 4),
            "priority_score": priority_score,
            "urgency_tier": urgency_tier,
            "last_purchase_inbound_at": last_purchase_inbound_at,
            "estimated_remaining_days": estimated_remaining_days,
            "expiry_basis": expiry_basis,
            "next_expiry_date": next_expiry_date,
            "lot_count": len(lots),
            "lots": lots,
            "has_unknown_expiry_lots": any(not lot.get("expiry_date") for lot in lots),
            "is_low_stock": current_stock <= threshold,
            "is_deleted": bool(row["is_deleted"]),
            "deleted_at": row["deleted_at"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    def get_runtime_version(self) -> dict:
        with self._connect() as connection:
            product_row = connection.execute(
                "SELECT COALESCE(MAX(updated_at), '') AS value FROM products"
            ).fetchone()
            transaction_row = connection.execute(
                "SELECT COALESCE(MAX(created_at), '') AS value FROM transactions"
            ).fetchone()
            state_rows = connection.execute(
                """
                SELECT state_key, updated_at
                FROM app_state
                WHERE state_key IN (?, ?, ?, ?)
                """,
                self.SYNC_COLLECTION_KEYS,
            ).fetchall()

        state_version = {key: "" for key in self.SYNC_COLLECTION_KEYS}
        for row in state_rows:
            state_version[row["state_key"]] = row["updated_at"] or ""

        return {
            "products": product_row["value"] if product_row else "",
            "transactions": transaction_row["value"] if transaction_row else "",
            "state": state_version,
        }

    def get_sync_state(self) -> dict:
        with self._connect() as connection:
            version_rows = connection.execute(
                """
                SELECT state_key, updated_at
                FROM app_state
                WHERE state_key IN (?, ?, ?, ?)
                """,
                self.SYNC_COLLECTION_KEYS,
            ).fetchall()
            collections: dict[str, list] = {
                key: self._load_sync_collection_from_tables(connection, key)
                for key in self.SYNC_COLLECTION_KEYS
            }

        updated_at = {row["state_key"]: row["updated_at"] for row in version_rows}

        collections["updated_at"] = updated_at
        return collections

    def _serialize_workflow_lock_row(self, row: sqlite3.Row | None) -> dict | None:
        if not row:
            return None
        return {
            "lock_key": row["lock_key"],
            "owner_username": row["owner_username"],
            "owner_role": row["owner_role"] or "",
            "acquired_at": row["acquired_at"],
            "expires_at": row["expires_at"],
            "updated_at": row["updated_at"],
            "note": row["note"] or "",
        }

    def _get_active_workflow_lock(
        self,
        connection: sqlite3.Connection,
        lock_key: str,
    ) -> dict | None:
        row = connection.execute(
            """
            SELECT lock_key, owner_username, owner_role, acquired_at, expires_at, updated_at, note
            FROM workflow_locks
            WHERE lock_key = ?
            """,
            (lock_key,),
        ).fetchone()
        lock = self._serialize_workflow_lock_row(row)
        if not lock:
            return None
        expires_at = self._parse_iso_datetime(lock["expires_at"])
        if expires_at and datetime.now(timezone.utc) >= expires_at:
            connection.execute("DELETE FROM workflow_locks WHERE lock_key = ?", (lock_key,))
            return None
        return lock

    @staticmethod
    def _build_lock_expiry(now: datetime, timeout_minutes: int) -> str:
        try:
            minutes = max(1, int(timeout_minutes))
        except (TypeError, ValueError):
            minutes = 180
        return (now + timedelta(minutes=minutes)).isoformat(timespec="seconds")

    def get_procurement_status(self, *, lock_timeout_minutes: int = 180) -> dict:
        with self._connect() as connection:
            lock = self._get_active_workflow_lock(connection, "procurement_batch")
        return {
            "mode": "batch" if lock else "daily",
            "lock": lock,
            "lock_timeout_minutes": max(1, int(lock_timeout_minutes or 180)),
        }

    def _collect_procurement_batch_start_conflicts(
        self,
        connection: sqlite3.Connection,
    ) -> list[dict]:
        purchases = self._load_sync_collection_from_tables(connection, "purchases")
        product_open_purchases: dict[int, dict[str, dict]] = {}
        for purchase in purchases:
            purchase_id = str(purchase.get("id") or "").strip()
            if not purchase_id:
                continue
            status = str(purchase.get("status") or "draft").strip()
            if status not in {"draft", "ordered"}:
                continue
            source_type = self._get_purchase_source_type(purchase)
            purchase_code = str(purchase.get("code") or purchase_id).strip() or purchase_id
            seen_product_ids: set[int] = set()
            for item in purchase.get("items") or []:
                product_id = int(item.get("productId") or item.get("product_id") or 0)
                if product_id <= 0 or product_id in seen_product_ids:
                    continue
                seen_product_ids.add(product_id)
                product_name = str(item.get("productName") or item.get("product_name") or "").strip()
                product_open_purchases.setdefault(product_id, {})[purchase_id] = {
                    "purchase_id": purchase_id,
                    "purchase_code": purchase_code,
                    "purchase_status": status,
                    "source_type": source_type,
                    "product_name": product_name or f"SP #{product_id}",
                }

        conflicts: list[dict] = []
        for product_id, purchase_map in product_open_purchases.items():
            if len(purchase_map) <= 1:
                continue
            purchases_for_product = sorted(
                purchase_map.values(),
                key=lambda entry: (entry["purchase_code"], entry["purchase_id"]),
            )
            conflicts.append(
                {
                    "product_id": product_id,
                    "product_name": purchases_for_product[0]["product_name"],
                    "purchase_ids": [entry["purchase_id"] for entry in purchases_for_product],
                    "purchase_codes": [entry["purchase_code"] for entry in purchases_for_product],
                    "has_cart_source_overlap": any(
                        entry["source_type"] == "cart" for entry in purchases_for_product
                    ),
                }
            )
        conflicts.sort(key=lambda entry: (entry["product_name"], entry["product_id"]))
        return conflicts

    @staticmethod
    def _format_procurement_batch_start_conflicts(conflicts: list[dict]) -> str:
        if not conflicts:
            return ""
        samples: list[str] = []
        for conflict in conflicts[:3]:
            purchase_refs = ", ".join(conflict.get("purchase_codes") or conflict.get("purchase_ids") or [])
            product_name = conflict.get("product_name") or f"SP #{conflict.get('product_id') or ''}"
            detail = (
                f"{product_name} đang nằm trong nhiều phiếu mở ({purchase_refs})."
            )
            if conflict.get("has_cart_source_overlap"):
                detail += " Có ít nhất một phiếu nguồn từ đơn hàng."
            samples.append(detail)
        suffix = ""
        remaining = len(conflicts) - len(samples)
        if remaining > 0:
            suffix = f" Còn {remaining} sản phẩm xung đột khác."
        return "Cần dọn conflict trước khi bắt đầu kỳ gom nhập. " + " ".join(samples) + suffix

    def start_procurement_batch(
        self,
        *,
        username: str,
        role: str = "",
        lock_timeout_minutes: int = 180,
    ) -> dict:
        clean_username = str(username or "").strip()
        if not clean_username:
            raise ValueError("Cần đăng nhập để bắt đầu kỳ gom nhập.")
        now_dt = datetime.now(timezone.utc)
        now = now_dt.isoformat(timespec="seconds")
        expires_at = self._build_lock_expiry(now_dt, lock_timeout_minutes)
        with self._connect() as connection:
            current = self._get_active_workflow_lock(connection, "procurement_batch")
            if current and current["owner_username"] != clean_username and str(role or "") != "admin":
                raise ValueError(f"Kỳ gom nhập đang được xử lý bởi {current['owner_username']}.")
            if not current:
                conflicts = self._collect_procurement_batch_start_conflicts(connection)
                if conflicts:
                    raise ProcurementBatchStartConflictError(
                        self._format_procurement_batch_start_conflicts(conflicts),
                        conflicts=conflicts,
                    )
            connection.execute(
                """
                INSERT INTO workflow_locks(lock_key, owner_username, owner_role, acquired_at, expires_at, updated_at, note)
                VALUES('procurement_batch', ?, ?, ?, ?, ?, '')
                ON CONFLICT(lock_key) DO UPDATE SET
                    owner_username = excluded.owner_username,
                    owner_role = excluded.owner_role,
                    expires_at = excluded.expires_at,
                    updated_at = excluded.updated_at
                """,
                (clean_username, str(role or ""), now, expires_at, now),
            )
            lock = self._get_active_workflow_lock(connection, "procurement_batch")
        return {"mode": "batch", "lock": lock}

    def refresh_procurement_batch_lock(
        self,
        *,
        username: str,
        role: str = "",
        lock_timeout_minutes: int = 180,
    ) -> dict:
        clean_username = str(username or "").strip()
        now_dt = datetime.now(timezone.utc)
        now = now_dt.isoformat(timespec="seconds")
        expires_at = self._build_lock_expiry(now_dt, lock_timeout_minutes)
        with self._connect() as connection:
            current = self._get_active_workflow_lock(connection, "procurement_batch")
            if not current:
                raise ValueError("Kỳ gom nhập chưa được khóa.")
            if current["owner_username"] != clean_username and str(role or "") != "admin":
                raise ValueError("Chỉ người đang giữ khóa mới được gia hạn kỳ gom nhập.")
            connection.execute(
                """
                UPDATE workflow_locks
                SET expires_at = ?, updated_at = ?
                WHERE lock_key = 'procurement_batch'
                """,
                (expires_at, now),
            )
            lock = self._get_active_workflow_lock(connection, "procurement_batch")
        return {"mode": "batch", "lock": lock}

    def finish_procurement_batch(self, *, username: str, role: str = "") -> dict:
        clean_username = str(username or "").strip()
        with self._connect() as connection:
            current = self._get_active_workflow_lock(connection, "procurement_batch")
            if not current:
                return {"mode": "daily", "lock": None}
            if current["owner_username"] != clean_username and str(role or "") != "admin":
                raise ValueError("Chỉ người đang giữ khóa hoặc Master Admin mới được kết thúc kỳ gom nhập.")
            connection.execute("DELETE FROM workflow_locks WHERE lock_key = 'procurement_batch'")
        return {"mode": "daily", "lock": None}

    def _load_procurement_products(self, connection: sqlite3.Connection) -> list[dict]:
        rows = connection.execute(
            """
            SELECT
                p.id, p.name, p.category, p.unit, p.price, p.sale_price,
                p.low_stock_threshold, p.shelf_life_days, p.storage_life_days,
                p.is_deleted, p.deleted_at, p.created_at, p.updated_at,
                COALESCE(SUM(CASE WHEN t.transaction_type = 'in' THEN t.quantity ELSE -t.quantity END), 0) AS current_stock
            FROM products p
            LEFT JOIN transactions t ON t.product_id = p.id
            WHERE p.is_deleted = 0
            GROUP BY p.id
            ORDER BY p.name COLLATE NOCASE ASC
            """
        ).fetchall()
        return self._serialize_product_rows(connection, rows)

    def _load_active_procurement_assignments(self, connection: sqlite3.Connection) -> dict[int, dict]:
        rows = connection.execute(
            """
            SELECT
                pa.id, pa.product_id, pa.purchase_id, pa.mode, pa.scope_type, pa.scope_code,
                pa.assigned_quantity, pa.assigned_by, pa.assigned_at, pa.status,
                p.supplier_name, p.status AS purchase_status, p.updated_at AS purchase_updated_at
            FROM procurement_assignments pa
            JOIN purchases p ON p.id = pa.purchase_id
            WHERE pa.status = 'active'
              AND pa.mode = 'batch'
            ORDER BY pa.id
            """
        ).fetchall()
        return {
            int(row["product_id"]): {
                "id": int(row["id"]),
                "product_id": int(row["product_id"]),
                "purchase_id": row["purchase_id"],
                "mode": row["mode"],
                "scope_type": row["scope_type"],
                "scope_code": row["scope_code"] or "",
                "assigned_quantity": round(float(row["assigned_quantity"] or 0), 2),
                "assigned_by": row["assigned_by"] or "",
                "assigned_at": row["assigned_at"],
                "status": row["status"],
                "supplier_name": row["supplier_name"] or "",
                "purchase_status": row["purchase_status"] or "",
                "purchase_updated_at": row["purchase_updated_at"] or "",
            }
            for row in rows
        }

    @staticmethod
    def _normalize_procurement_supplier_key(name: str) -> str:
        return " ".join(str(name or "").strip().lower().split())

    @staticmethod
    def _normalize_procurement_source_kind(value) -> str:
        clean_value = str(value or "shortage").strip().lower()
        return clean_value if clean_value in {"shortage", "extra"} else "shortage"

    def _get_active_supplier_by_name(self, connection: sqlite3.Connection, supplier_name: str) -> sqlite3.Row | None:
        clean_name = str(supplier_name or "").strip()
        if not clean_name:
            return None
        return connection.execute(
            """
            SELECT id, name
            FROM suppliers
            WHERE deleted_at IS NULL
              AND lower(name) = lower(?)
            """,
            (clean_name,),
        ).fetchone()

    @staticmethod
    def _sum_item_quantities_by_product(records: list[dict], statuses: set[str]) -> dict[int, float]:
        result: dict[int, float] = {}
        for record in records:
            if str(record.get("status") or "draft") not in statuses:
                continue
            for item in record.get("items") or []:
                product_id = int(item.get("productId") or item.get("product_id") or 0)
                if not product_id:
                    continue
                result[product_id] = result.get(product_id, 0.0) + max(0.0, float(item.get("quantity") or 0))
        return result

    def get_procurement_planner(
        self,
        *,
        scope_type: str = "all",
        scope_code: str = "",
        lock_timeout_minutes: int = 180,
    ) -> dict:
        clean_scope_type = str(scope_type or "all").strip() or "all"
        clean_scope_code = str(scope_code or "").strip()
        if clean_scope_type not in {"all", "cart", "product"}:
            raise ValueError("Phạm vi xử lý nhập thiếu không hợp lệ.")

        with self._connect() as connection:
            status = {
                "mode": "batch" if self._get_active_workflow_lock(connection, "procurement_batch") else "daily",
                "lock": self._get_active_workflow_lock(connection, "procurement_batch"),
                "lock_timeout_minutes": max(1, int(lock_timeout_minutes or 180)),
            }
            products = self._load_procurement_products(connection)
            carts = self._load_sync_collection_from_tables(connection, "carts")
            purchases = self._load_sync_collection_from_tables(connection, "purchases")
            assignments = self._load_active_procurement_assignments(connection)

        draft_demand = self._sum_item_quantities_by_product(carts, {"draft"})
        committed_demand = self._sum_item_quantities_by_product(carts, {"committed"})
        incoming = self._sum_item_quantities_by_product(purchases, {"draft", "ordered"})

        scoped_product_ids: set[int] | None = None
        if clean_scope_type == "cart" and clean_scope_code:
            scoped_product_ids = {
                int(item.get("productId") or item.get("product_id") or 0)
                for cart in carts
                if str(cart.get("id") or "") == clean_scope_code
                for item in (cart.get("items") or [])
                if int(item.get("productId") or item.get("product_id") or 0)
            }
        elif clean_scope_type == "product" and clean_scope_code:
            try:
                scoped_product_ids = {int(clean_scope_code)}
            except ValueError:
                scoped_product_ids = set()

        rows = []
        for product in products:
            product_id = int(product["id"])
            if scoped_product_ids is not None and product_id not in scoped_product_ids:
                continue
            draft_qty = round(float(draft_demand.get(product_id, 0.0)), 2)
            committed_qty = round(float(committed_demand.get(product_id, 0.0)), 2)
            incoming_qty = round(float(incoming.get(product_id, 0.0)), 2)
            gross_demand = round(draft_qty + committed_qty, 2)
            current_stock = round(float(product.get("current_stock") or 0), 2)
            required_purchase = round(max(0.0, gross_demand - current_stock - incoming_qty), 2)
            forecast_after_purchase = round(current_stock + incoming_qty + required_purchase - gross_demand, 2)
            low_stock_threshold = round(float(product.get("low_stock_threshold") or 0), 2)
            assignment = assignments.get(product_id)
            if required_purchase <= 0 and gross_demand <= 0 and not product.get("is_low_stock") and not assignment:
                continue
            rows.append(
                {
                    "product_id": product_id,
                    "product_name": product["name"],
                    "unit": product["unit"],
                    "unit_cost": product["price"],
                    "current_stock": current_stock,
                    "draft_demand": draft_qty,
                    "committed_demand": committed_qty,
                    "gross_demand": gross_demand,
                    "incoming_quantity": incoming_qty,
                    "required_purchase": required_purchase,
                    "forecast_after_purchase": forecast_after_purchase,
                    "low_stock_threshold": low_stock_threshold,
                    "below_threshold_after_purchase": forecast_after_purchase < low_stock_threshold,
                    "assignment": assignment,
                }
            )
        rows.sort(
            key=lambda row: (
                0 if row["committed_demand"] > 0 else 1,
                -float(row["required_purchase"]),
                -float(row["gross_demand"]),
                row["product_name"].lower(),
            )
        )
        return {
            "status": status,
            "scope": {"type": clean_scope_type, "code": clean_scope_code},
            "rows": rows,
        }

    def create_procurement_purchase_for_product(
        self,
        *,
        product_id: int,
        quantity,
        supplier_name: str = "",
        actor: str = "",
        role: str = "",
        scope_type: str = "all",
        scope_code: str = "",
    ) -> dict:
        result = self.create_procurement_purchases(
            lines=[
                {
                    "product_id": product_id,
                    "quantity": quantity,
                    "supplier_name": supplier_name,
                }
            ],
            actor=actor,
            role=role,
            scope_type=scope_type,
            scope_code=scope_code,
        )
        if not result["created_purchases"]:
            skipped_message = result["skipped"][0]["reason"] if result["skipped"] else "Không tạo được phiếu nhập."
            raise ValueError(skipped_message)
        purchase = result["created_purchases"][0]
        return {
            "purchase": purchase,
            "purchases": result["purchases"],
            "planner": result["planner"],
        }

    def create_procurement_purchases(
        self,
        *,
        lines: list[dict],
        actor: str = "",
        role: str = "",
        scope_type: str = "all",
        scope_code: str = "",
    ) -> dict:
        clean_actor = str(actor or "").strip()
        clean_scope_type = str(scope_type or "all").strip() or "all"
        clean_scope_code = str(scope_code or "").strip()
        if clean_scope_type not in {"all", "cart", "product"}:
            raise ValueError("Phạm vi xử lý nhập thiếu không hợp lệ.")
        if not isinstance(lines, list) or not lines:
            raise ValueError("Cần chọn ít nhất một mặt hàng để tạo phiếu nhập.")
        now = utc_now_iso()
        skipped: list[dict] = []
        touched_purchase_ids: set[str] = set()
        with self._connect() as connection:
            active = self._get_active_workflow_lock(connection, "procurement_batch")
            if not active:
                raise ValueError("Chỉ được tạo phiếu từ planner khi đang ở Batch mode.")
            if active["owner_username"] != clean_actor and str(role or "") != "admin":
                raise ValueError("Chỉ người đang giữ khóa gom nhập mới được tạo phiếu từ planner.")

            purchases_by_supplier: dict[str, str] = {}
            existing_rows = connection.execute(
                """
                SELECT id, supplier_id, supplier_name
                FROM purchases
                WHERE source_type = 'procurement_batch'
                  AND status = 'draft'
                ORDER BY datetime(updated_at) DESC, id
                """
            ).fetchall()
            for row in existing_rows:
                key = str(row["supplier_id"] or "").strip() or self._normalize_procurement_supplier_key(row["supplier_name"])
                if key and key not in purchases_by_supplier:
                    purchases_by_supplier[key] = str(row["id"])

            for raw_line in lines:
                product_id = int(raw_line.get("product_id") or raw_line.get("productId") or 0)
                supplier_name = str(raw_line.get("supplier_name") or raw_line.get("supplierName") or "").strip()
                source_kind = self._normalize_procurement_source_kind(
                    raw_line.get("source_kind") or raw_line.get("sourceKind") or "shortage"
                )
                source_note = str(raw_line.get("source_note") or raw_line.get("sourceNote") or "").strip()
                if source_kind == "extra" and not source_note:
                    source_note = "Ngoài nhu cầu đơn"
                product_name_for_skip = ""
                try:
                    product = self._get_product_or_raise(connection, product_id)
                    product_name_for_skip = str(product["name"] or "")
                    target_quantity = parse_positive_decimal(raw_line.get("quantity"), "Số lượng cần nhập")
                    unit_cost = parse_non_negative_decimal(raw_line.get("unit_cost", raw_line.get("unitCost", product["price"] or 0)), "Giá nhập")
                    line_discount = parse_non_negative_decimal(raw_line.get("discount_amount", raw_line.get("discountAmount", 0)), "Giảm giá khuyến mại")
                except ValueError as exc:
                    skipped.append({"product_id": product_id, "product_name": product_name_for_skip, "reason": str(exc)})
                    continue
                supplier = self._get_active_supplier_by_name(connection, supplier_name)
                if not supplier:
                    skipped.append({
                        "product_id": product_id,
                        "product_name": product_name_for_skip,
                        "reason": "Chưa chọn nhà cung cấp hợp lệ.",
                    })
                    continue
                supplier_id = str(supplier["id"])
                supplier_display_name = str(supplier["name"])
                supplier_key = supplier_id or self._normalize_procurement_supplier_key(supplier_display_name)
                target_purchase_id = ""

                existing_assignment = connection.execute(
                    """
                    SELECT
                        pa.id,
                        pa.purchase_id,
                        p.status AS purchase_status,
                        p.source_type,
                        p.supplier_id,
                        p.supplier_name
                    FROM procurement_assignments pa
                    JOIN purchases p ON p.id = pa.purchase_id
                    WHERE pa.product_id = ?
                      AND pa.mode = 'batch'
                      AND pa.status = 'active'
                    """,
                    (product_id,),
                ).fetchone()
                if existing_assignment:
                    assigned_supplier_id = str(existing_assignment["supplier_id"] or "").strip()
                    assigned_supplier_name = str(existing_assignment["supplier_name"] or "").strip()
                    if source_kind == "extra":
                        if (
                            str(existing_assignment["purchase_status"] or "").strip() == "draft"
                            and str(existing_assignment["source_type"] or "").strip() == "procurement_batch"
                            and (
                                assigned_supplier_id == supplier_id
                                or self._normalize_procurement_supplier_key(assigned_supplier_name)
                                == self._normalize_procurement_supplier_key(supplier_display_name)
                            )
                        ):
                            target_purchase_id = str(existing_assignment["purchase_id"] or "").strip()
                        else:
                            skipped.append({
                                "product_id": product_id,
                                "product_name": product_name_for_skip,
                                "reason": "Mặt hàng này đang được xử lý ở phiếu batch khác, không thể tách sang NCC khác.",
                            })
                            continue
                    else:
                        skipped.append({
                            "product_id": product_id,
                            "product_name": product_name_for_skip,
                            "reason": "Mặt hàng này đã được gán vào một phiếu nhập trong kỳ gom nhập.",
                        })
                        continue

                if not target_purchase_id:
                    existing_batch_item = connection.execute(
                        """
                        SELECT
                            p.id AS purchase_id,
                            p.supplier_id,
                            p.supplier_name
                        FROM purchase_items pi
                        JOIN purchases p ON p.id = pi.purchase_id
                        WHERE pi.product_id = ?
                          AND p.source_type = 'procurement_batch'
                          AND p.status = 'draft'
                        ORDER BY datetime(p.updated_at) DESC, p.id
                        LIMIT 1
                        """,
                        (product_id,),
                    ).fetchone()
                    if existing_batch_item:
                        existing_supplier_id = str(existing_batch_item["supplier_id"] or "").strip()
                        existing_supplier_name = str(existing_batch_item["supplier_name"] or "").strip()
                        if (
                            existing_supplier_id == supplier_id
                            or self._normalize_procurement_supplier_key(existing_supplier_name)
                            == self._normalize_procurement_supplier_key(supplier_display_name)
                        ):
                            target_purchase_id = str(existing_batch_item["purchase_id"] or "").strip()
                        else:
                            skipped.append({
                                "product_id": product_id,
                                "product_name": product_name_for_skip,
                                "reason": "Mặt hàng này đã nằm trong một phiếu batch draft khác, cần dùng cùng NCC để gom chung.",
                            })
                            continue

                purchase_id = target_purchase_id or purchases_by_supplier.get(supplier_key)
                if not purchase_id:
                    purchase_id = f"purchase_{secrets.token_urlsafe(8)}"
                    purchases_by_supplier[supplier_key] = purchase_id
                    connection.execute(
                        """
                        INSERT INTO purchases(
                            id, supplier_id, supplier_name, note, source_type, source_code, source_name,
                            status, discount_amount, created_at, updated_at, received_at, paid_at, receipt_code
                        )
                        VALUES(?, ?, ?, '', 'procurement_batch', ?, 'Kỳ gom nhập', 'draft', 0, ?, ?, NULL, NULL, '')
                        """,
                        (purchase_id, supplier_id, supplier_display_name, clean_scope_code, now, now),
                    )
                elif supplier_key and supplier_key not in purchases_by_supplier:
                    purchases_by_supplier[supplier_key] = purchase_id

                item_count = connection.execute(
                    "SELECT COUNT(*) AS count FROM purchase_items WHERE purchase_id = ?",
                    (purchase_id,),
                ).fetchone()["count"]
                connection.execute(
                    """
                    INSERT INTO purchase_items(
                        id, purchase_id, product_id, product_name, source_kind, source_note, quantity, unit_cost, batch_code,
                        expiry_input_mode, manufacture_date, expiry_date, sort_order
                    )
                    VALUES(?, ?, ?, ?, ?, ?, ?, ?, '', 'direct', NULL, NULL, ?)
                    """,
                    (
                        f"purchase_item_{secrets.token_urlsafe(8)}",
                        purchase_id,
                        product_id,
                        product["name"],
                        source_kind,
                        source_note,
                        round(float(target_quantity), 2),
                        round(float(unit_cost), 2),
                        int(item_count or 0),
                    ),
                )
                current_purchase = connection.execute(
                    """
                    SELECT discount_amount
                    FROM purchases
                    WHERE id = ?
                    """,
                    (purchase_id,),
                ).fetchone()
                next_discount = Decimal(str(current_purchase["discount_amount"] or 0)) + line_discount
                next_subtotal = connection.execute(
                    """
                    SELECT COALESCE(SUM(quantity * unit_cost), 0) AS subtotal
                    FROM purchase_items
                    WHERE purchase_id = ?
                    """,
                    (purchase_id,),
                ).fetchone()["subtotal"]
                if next_discount > Decimal(str(next_subtotal or 0)):
                    raise ValueError(f"Giảm giá của phiếu {supplier_display_name} không được lớn hơn tạm tính.")
                connection.execute(
                    """
                    UPDATE purchases
                    SET discount_amount = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (round(float(next_discount), 2), now, purchase_id),
                )
                if source_kind == "shortage":
                    connection.execute(
                        """
                        INSERT INTO procurement_assignments(
                            product_id, purchase_id, mode, scope_type, scope_code, assigned_quantity,
                            assigned_by, assigned_at, released_at, status
                        )
                        VALUES(?, ?, 'batch', ?, ?, ?, ?, ?, NULL, 'active')
                        """,
                        (
                            product_id,
                            purchase_id,
                            clean_scope_type,
                            clean_scope_code,
                            round(float(target_quantity), 2),
                            clean_actor,
                            now,
                        ),
                    )
                    self._record_audit(
                        connection,
                        entity_type="procurement_assignment",
                        entity_id=str(product_id),
                        entity_name=str(product["name"]),
                        action="assign",
                        actor=clean_actor,
                        message=f"Gán mặt hàng vào phiếu nhập batch {purchase_id}.",
                    )
                touched_purchase_ids.add(purchase_id)

            purchases = self._refresh_sync_collection_cache(connection, "purchases", updated_at=now)
            created_purchases = [
                entry for entry in purchases
                if str(entry.get("id") or "") in touched_purchase_ids
            ]

        return {
            "created_purchases": created_purchases,
            "created_purchase_ids": sorted(touched_purchase_ids),
            "skipped": skipped,
            "purchases": purchases,
            "planner": self.get_procurement_planner(
                scope_type=clean_scope_type,
                scope_code=clean_scope_code,
            ),
        }

    def _release_procurement_assignments(
        self,
        connection: sqlite3.Connection,
        *,
        purchase_id: str = "",
        product_ids: set[int] | None = None,
        released_at: str,
        actor: str = "",
        reason: str = "",
    ) -> int:
        clean_purchase_id = str(purchase_id or "").strip()
        if not clean_purchase_id:
            return 0

        query = """
            SELECT id, product_id
            FROM procurement_assignments
            WHERE purchase_id = ?
              AND mode = 'batch'
              AND status = 'active'
        """
        params: list = [clean_purchase_id]
        clean_product_ids = {
            int(product_id)
            for product_id in (product_ids or set())
            if int(product_id) > 0
        }
        if clean_product_ids:
            placeholders = ",".join("?" for _ in clean_product_ids)
            query += f" AND product_id IN ({placeholders})"
            params.extend(sorted(clean_product_ids))

        rows = connection.execute(query, tuple(params)).fetchall()
        if not rows:
            return 0

        for row in rows:
            assignment_id = int(row["id"])
            product_id = int(row["product_id"] or 0)
            connection.execute(
                """
                UPDATE procurement_assignments
                SET status = 'released', released_at = ?
                WHERE id = ?
                """,
                (released_at, assignment_id),
            )
            self._record_audit(
                connection,
                entity_type="procurement_assignment",
                entity_id=str(product_id or assignment_id),
                entity_name=str(product_id or assignment_id),
                action="release",
                actor=actor,
                message=reason or f"Release assignment khỏi phiếu nhập batch {clean_purchase_id}.",
            )
        return len(rows)

    def _sync_procurement_assignments_for_purchases(
        self,
        connection: sqlite3.Connection,
        existing_purchases: list[dict],
        incoming_purchases: list[dict],
        *,
        actor: str = "",
        updated_at: str,
    ) -> None:
        existing_by_id = {
            str(purchase.get("id") or ""): purchase
            for purchase in existing_purchases
            if purchase.get("id")
        }
        incoming_by_id = {
            str(purchase.get("id") or ""): purchase
            for purchase in incoming_purchases
            if purchase.get("id")
        }

        for purchase_id, previous_purchase in existing_by_id.items():
            if not purchase_id:
                continue
            next_purchase = incoming_by_id.get(purchase_id)
            previous_is_batch = self._is_procurement_batch_purchase(previous_purchase)
            next_is_batch = self._is_procurement_batch_purchase(next_purchase)
            if not previous_is_batch and not next_is_batch:
                continue

            if next_purchase is None:
                self._release_procurement_assignments(
                    connection,
                    purchase_id=purchase_id,
                    released_at=updated_at,
                    actor=actor,
                    reason=f"Release assignment vì phiếu nhập batch {purchase_id} bị xóa khỏi danh sách phiếu mở.",
                )
                continue

            next_status = str(next_purchase.get("status") or "draft").strip()
            if previous_is_batch and (not next_is_batch or next_status in {"received", "cancelled"}):
                release_reason = (
                    f"Release assignment vì phiếu nhập batch {purchase_id} đã nhập kho."
                    if next_status == "received"
                    else (
                        f"Release assignment vì phiếu nhập batch {purchase_id} đã bị hủy."
                        if next_status == "cancelled"
                        else f"Release assignment vì phiếu {purchase_id} không còn thuộc flow batch procurement."
                    )
                )
                self._release_procurement_assignments(
                    connection,
                    purchase_id=purchase_id,
                    released_at=updated_at,
                    actor=actor,
                    reason=release_reason,
                )
                continue

            previous_product_ids = {
                int(item.get("productId") or item.get("product_id") or 0)
                for item in (previous_purchase.get("items") or [])
                if int(item.get("productId") or item.get("product_id") or 0) > 0
            }
            next_product_ids = {
                int(item.get("productId") or item.get("product_id") or 0)
                for item in (next_purchase.get("items") or [])
                if int(item.get("productId") or item.get("product_id") or 0) > 0
            }
            removed_product_ids = previous_product_ids - next_product_ids
            if removed_product_ids:
                self._release_procurement_assignments(
                    connection,
                    purchase_id=purchase_id,
                    product_ids=removed_product_ids,
                    released_at=updated_at,
                    actor=actor,
                    reason=f"Release assignment vì dòng hàng đã bị gỡ khỏi phiếu nhập batch {purchase_id}.",
                )

    def save_sync_state(
        self,
        payload: dict,
        *,
        actor_username: str = "",
        actor_role: str = "",
    ) -> dict:
        allowed_keys = set(self.SYNC_COLLECTION_KEYS)
        to_update = {
            key: payload[key]
            for key in payload
            if key in allowed_keys
        }
        if not to_update:
            raise ValueError("Không có dữ liệu đồng bộ hợp lệ.")
        expected_updated_at = payload.get("expected_updated_at", {})
        if expected_updated_at is None:
            expected_updated_at = {}
        if not isinstance(expected_updated_at, dict):
            raise ValueError("Trường expected_updated_at phải là object.")
        actor = str(payload.get("actor") or "").strip()

        now = utc_now_iso()
        with self._connect() as connection:
            existing_collections = {
                key: self._load_sync_collection_from_tables(connection, key)
                for key in to_update
            }
            current_updated_at = {}
            for key in to_update:
                row = connection.execute(
                    "SELECT updated_at FROM app_state WHERE state_key = ?",
                    (key,),
                ).fetchone()
                current_updated_at[key] = str((row["updated_at"] if row else "") or "")

            for key in to_update:
                if key not in expected_updated_at:
                    continue
                expected_value = str(expected_updated_at.get(key) or "")
                actual_value = current_updated_at.get(key, "")
                if expected_value != actual_value:
                    raise SyncConflictError(key, expected_value, actual_value)

            if "carts" in to_update:
                self._audit_cart_changes(
                    connection,
                    existing_collections.get("carts", []),
                    to_update["carts"],
                    actor=actor,
                )
                self._validate_cart_workflow_locks(
                    existing_collections.get("carts", []),
                    to_update["carts"],
                )

            if "purchases" in to_update:
                to_update["purchases"] = self._preserve_purchase_ordered_timestamps(
                    existing_collections.get("purchases", []),
                    to_update["purchases"],
                )
                self._audit_purchase_changes(
                    connection,
                    existing_collections.get("purchases", []),
                    to_update["purchases"],
                    actor=actor,
                )
                self._validate_purchase_workflow_locks(
                    connection,
                    existing_collections.get("purchases", []),
                    to_update["purchases"],
                    actor_username=actor_username,
                    actor_role=actor_role,
                )
                self._sync_procurement_assignments_for_purchases(
                    connection,
                    existing_collections.get("purchases", []),
                    to_update["purchases"],
                    actor=actor,
                    updated_at=now,
                )

            for key, value in to_update.items():
                if not isinstance(value, list):
                    raise ValueError(f"Dữ liệu {key} phải là một danh sách.")
                self._replace_sync_collection_records(connection, key, value)
                canonical = self._load_sync_collection_from_tables(connection, key)
                connection.execute(
                    """
                    UPDATE app_state
                    SET state_value = ?, updated_at = ?
                    WHERE state_key = ?
                    """,
                    (json.dumps(canonical, ensure_ascii=False), now, key),
                )

        return self.get_sync_state()

    def _audit_cart_changes(
        self,
        connection: sqlite3.Connection,
        existing_carts: list[dict],
        incoming_carts: list[dict],
        *,
        actor: str = "",
    ) -> None:
        existing_by_id = {str(cart.get("id") or ""): cart for cart in existing_carts if cart.get("id")}
        for cart in incoming_carts:
            cart_id = str(cart.get("id") or "")
            if not cart_id:
                continue
            previous = existing_by_id.get(cart_id)
            if not previous:
                continue
            previous_status = str(previous.get("status") or "draft")
            next_status = str(cart.get("status") or "draft")
            if previous_status != next_status:
                self._record_audit(
                    connection,
                    entity_type="cart",
                    entity_id=cart_id,
                    entity_name=str(cart.get("orderCode") or cart_id),
                    action="status-change",
                    actor=actor,
                    message=f"Trạng thái đơn đổi từ {previous_status} sang {next_status}.",
                )

    @staticmethod
    def _get_cart_ship_address(cart: dict) -> str:
        return str(cart.get("shipAddress") or cart.get("ship_address") or "").strip()

    @staticmethod
    def _get_purchase_ordered_timestamp_text(purchase: dict | None) -> str:
        target = purchase or {}
        return str(
            target.get("orderedAt")
            or target.get("ordered_at")
            or ""
        ).strip()

    def _preserve_purchase_ordered_timestamps(
        self,
        existing_purchases: list[dict],
        incoming_purchases: list[dict],
    ) -> list[dict]:
        existing_by_id = {
            str(purchase.get("id") or ""): purchase
            for purchase in existing_purchases
            if purchase.get("id")
        }
        prepared: list[dict] = []
        for purchase in incoming_purchases:
            next_purchase = dict(purchase)
            purchase_id = str(next_purchase.get("id") or "").strip()
            previous = existing_by_id.get(purchase_id)
            previous_status = str((previous or {}).get("status") or "").strip()
            next_status = str(next_purchase.get("status") or "draft").strip()
            previous_ordered_at = self._get_purchase_ordered_timestamp_text(previous)
            incoming_ordered_at = self._get_purchase_ordered_timestamp_text(next_purchase)
            fallback_ordered_at = str(
                next_purchase.get("updatedAt")
                or next_purchase.get("updated_at")
                or next_purchase.get("createdAt")
                or next_purchase.get("created_at")
                or ""
            ).strip()
            resolved_ordered_at = incoming_ordered_at
            if next_status == "ordered":
                if previous_status == "ordered":
                    resolved_ordered_at = previous_ordered_at or incoming_ordered_at or fallback_ordered_at
                else:
                    resolved_ordered_at = incoming_ordered_at or fallback_ordered_at
            elif next_status in {"received", "paid", "cancelled"}:
                resolved_ordered_at = previous_ordered_at or incoming_ordered_at or fallback_ordered_at
            else:
                resolved_ordered_at = previous_ordered_at or incoming_ordered_at
            next_purchase["orderedAt"] = resolved_ordered_at
            next_purchase["ordered_at"] = resolved_ordered_at
            prepared.append(next_purchase)
        return prepared

    def _audit_purchase_changes(
        self,
        connection: sqlite3.Connection,
        existing_purchases: list[dict],
        incoming_purchases: list[dict],
        *,
        actor: str = "",
    ) -> None:
        existing_by_id = {str(purchase.get("id") or ""): purchase for purchase in existing_purchases if purchase.get("id")}
        for purchase in incoming_purchases:
            purchase_id = str(purchase.get("id") or "")
            if not purchase_id:
                continue
            previous = existing_by_id.get(purchase_id)
            if not previous:
                continue
            previous_status = str(previous.get("status") or "draft")
            next_status = str(purchase.get("status") or "draft")
            if previous_status != next_status:
                self._record_audit(
                    connection,
                    entity_type="purchase",
                    entity_id=purchase_id,
                    entity_name=str(purchase.get("receiptCode") or purchase_id),
                    action="status-change",
                    actor=actor,
                    message=f"Trạng thái phiếu nhập đổi từ {previous_status} sang {next_status}.",
                )

    def _validate_cart_workflow_locks(
        self,
        existing_carts: list[dict],
        incoming_carts: list[dict],
    ) -> None:
        incoming_ids = {
            str(cart.get("id"))
            for cart in incoming_carts
            if cart.get("id")
        }

        for cart in existing_carts:
            cart_id = str(cart.get("id") or "")
            if not cart_id or cart_id in incoming_ids:
                continue
            if str(cart.get("status") or "draft") != "draft":
                raise ValueError("Chỉ được xóa hẳn giỏ hàng nháp. Đơn đã chốt hoặc đã hủy phải giữ lại lịch sử.")

        existing_by_id = {
            str(cart.get("id")): cart
            for cart in existing_carts
            if cart.get("id")
        }

        for cart in incoming_carts:
            cart_id = str(cart.get("id") or "")
            next_status = str(cart.get("status") or "draft")
            next_payment_status = str(cart.get("paymentStatus") or "unpaid")
            self._get_cart_discount_amount(cart)
            clean_ship_address = self._get_cart_ship_address(cart)

            if next_status not in {"draft", "committed", "completed", "cancelled"}:
                raise ValueError("Trạng thái đơn hàng không hợp lệ.")
            if next_payment_status not in {"unpaid", "paid"}:
                raise ValueError("Trạng thái thanh toán đơn hàng không hợp lệ.")

            if next_status == "draft":
                if cart.get("committedAt") or cart.get("committed_at"):
                    raise ValueError("Đơn nháp không được có thời điểm chốt.")
                if cart.get("completedAt") or cart.get("completed_at"):
                    raise ValueError("Đơn nháp không được có thời điểm xuất hàng.")
                if clean_ship_address and not str(cart.get("customerName") or "").strip():
                    raise ValueError("Địa chỉ giao chỉ hợp lệ khi đơn đã có khách hàng.")

            if next_status == "committed":
                if not str(cart.get("customerName") or "").strip():
                    raise ValueError("Đơn chốt phải có khách hàng.")
                if not str(cart.get("orderCode") or "").strip():
                    raise ValueError("Đơn chốt phải có mã đơn.")
                if not (cart.get("committedAt") or cart.get("committed_at")):
                    raise ValueError("Đơn chốt phải có thời điểm chốt.")
                if next_payment_status != "unpaid":
                    raise ValueError("Đơn chốt chưa thể đánh dấu đã thanh toán.")

            if next_status == "completed" and not (cart.get("completedAt") or cart.get("completed_at")):
                raise ValueError("Đơn đã xuất hàng phải có thời điểm xuất.")

            if next_payment_status == "paid" and next_status != "completed":
                raise ValueError("Đơn hàng chỉ được đánh dấu đã thanh toán sau khi đã xuất hàng.")

            previous = existing_by_id.get(cart_id)
            if not previous:
                continue

            previous_status = str(previous.get("status") or "draft")
            previous_payment_status = str(previous.get("paymentStatus") or "unpaid")

            if previous_status == "draft":
                if next_status == "draft":
                    continue
                if next_status == "cancelled":
                    continue
                raise ValueError("Đổi trạng thái sang chốt đơn hoặc xuất hàng phải đi qua API trạng thái đơn.")

            if previous_status == "committed":
                if next_status == "draft":
                    raise ValueError("Đơn đã chốt không thể quay lại nháp.")
                if next_status == "completed":
                    raise ValueError("Đơn đã chốt phải xuất hàng qua API xuất hàng.")
                if str(previous.get("customerId") or "") != str(cart.get("customerId") or ""):
                    raise ValueError("Đơn đã chốt không thể đổi khách hàng.")
                if str(previous.get("customerName") or "") != str(cart.get("customerName") or ""):
                    raise ValueError("Đơn đã chốt không thể đổi khách hàng.")
                if str(previous.get("orderCode") or "") != str(cart.get("orderCode") or ""):
                    raise ValueError("Đơn đã chốt không thể đổi mã đơn.")
                if str(previous.get("committedAt") or previous.get("committed_at") or "") != str(cart.get("committedAt") or cart.get("committed_at") or ""):
                    raise ValueError("Đơn đã chốt không thể đổi thời điểm chốt.")
                if previous_payment_status == "paid" or next_payment_status == "paid":
                    raise ValueError("Đơn đã chốt chưa thể đánh dấu đã thanh toán.")
                if next_status == "cancelled":
                    continue
                if next_status != "committed":
                    raise ValueError("Trạng thái đơn hàng không hợp lệ.")
                continue

            if previous_status == "completed":
                if next_status != "completed":
                    raise ValueError("Đơn hàng đã xuất hàng không thể sửa trực tiếp. Hãy tạo chứng từ điều chỉnh mới.")
                if self._snapshot_cart_for_lock(previous) != self._snapshot_cart_for_lock(cart):
                    raise ValueError("Đơn hàng đã xuất hàng không thể sửa trực tiếp. Hãy tạo chứng từ điều chỉnh mới.")
                if previous_payment_status == "paid" and next_payment_status != "paid":
                    raise ValueError("Đơn hàng đã thanh toán không thể sửa ngược trạng thái.")
                if previous_payment_status == "paid" and self._get_cart_discount_amount(previous) != self._get_cart_discount_amount(cart):
                    raise ValueError("Đơn hàng đã thanh toán không thể sửa giảm giá khuyến mại.")
            elif previous_status == "cancelled":
                if next_status != "cancelled":
                    raise ValueError("Giỏ hàng đã hủy không thể mở lại hoặc sửa trực tiếp.")
                if self._snapshot_cart_for_lock(previous) != self._snapshot_cart_for_lock(cart):
                    raise ValueError("Giỏ hàng đã hủy không thể sửa trực tiếp.")
                if self._get_cart_discount_amount(previous) != self._get_cart_discount_amount(cart):
                    raise ValueError("Giỏ hàng đã hủy không thể sửa giảm giá khuyến mại.")
                if next_payment_status != previous_payment_status:
                    raise ValueError("Giỏ hàng đã hủy không thể đổi trạng thái thanh toán.")

    def _is_procurement_batch_structure_locked_for_actor(
        self,
        connection: sqlite3.Connection,
        *,
        actor_username: str = "",
        actor_role: str = "",
    ) -> bool:
        active_lock = self._get_active_workflow_lock(connection, "procurement_batch")
        if not active_lock:
            return False
        if str(actor_role or "").strip() == "admin":
            return False
        clean_actor_username = str(actor_username or "").strip()
        return clean_actor_username != str(active_lock.get("owner_username") or "").strip()

    def _can_non_owner_mutate_purchase_during_procurement_batch(
        self,
        connection: sqlite3.Connection,
        previous_purchase: dict | None,
        next_purchase: dict | None,
    ) -> bool:
        previous_status = str((previous_purchase or {}).get("status") or "").strip()
        next_status = str((next_purchase or {}).get("status") or "").strip()
        if previous_status != "ordered" or next_status != "received":
            return False
        if self._is_procurement_batch_purchase(previous_purchase):
            return False
        active_lock = self._get_active_workflow_lock(connection, "procurement_batch")
        if not active_lock:
            return False
        lock_started_at = self._parse_iso_datetime(active_lock.get("acquired_at") or "")
        purchase_ordered_at = self._resolve_purchase_ordered_at_for_batch_check(previous_purchase)
        if not lock_started_at or not purchase_ordered_at or purchase_ordered_at >= lock_started_at:
            return False
        if self._snapshot_purchase_for_receive_lock(previous_purchase or {}) != self._snapshot_purchase_for_receive_lock(next_purchase or {}):
            return False
        if self._get_purchase_discount_amount(previous_purchase or {}) != self._get_purchase_discount_amount(next_purchase or {}):
            return False
        return True

    def _validate_purchase_workflow_locks(
        self,
        connection: sqlite3.Connection,
        existing_purchases: list[dict],
        incoming_purchases: list[dict],
        *,
        actor_username: str = "",
        actor_role: str = "",
    ) -> None:
        incoming_ids = {
            str(purchase.get("id"))
            for purchase in incoming_purchases
            if purchase.get("id")
        }

        for purchase in existing_purchases:
            purchase_id = str(purchase.get("id") or "")
            if not purchase_id or purchase_id in incoming_ids:
                continue
            if str(purchase.get("status") or "draft") != "draft":
                raise ValueError("Chỉ được xóa hẳn phiếu nhập nháp. Phiếu đã xử lý phải giữ lại lịch sử.")

        existing_by_id = {
            str(purchase.get("id")): purchase
            for purchase in existing_purchases
            if purchase.get("id")
        }

        for purchase in incoming_purchases:
            purchase_id = str(purchase.get("id") or "")
            next_status = str(purchase.get("status") or "draft")
            supplier_name = str(purchase.get("supplierName") or "").strip()
            self._get_purchase_discount_amount(purchase)
            previous = existing_by_id.get(purchase_id)
            previous_status = str(previous.get("status") or "draft") if previous else None

            if next_status == "ordered" and not supplier_name:
                raise ValueError("Phiếu nhập phải có nhà cung cấp trước khi chuyển sang đã đặt hàng.")

            if previous_status == "received":
                if next_status not in {"received", "paid"}:
                    raise ValueError("Phiếu nhập đã nhập kho không thể hạ trạng thái hoặc mở lại nháp.")
                if self._snapshot_purchase_for_receive_lock(previous) != self._snapshot_purchase_for_receive_lock(purchase):
                    raise ValueError("Phiếu nhập đã nhập kho không thể sửa trực tiếp. Hãy dùng chứng từ điều chỉnh mới.")
                if next_status == "received":
                    continue

            if previous_status == "paid":
                if next_status != "paid":
                    raise ValueError("Phiếu nhập đã thanh toán không thể hạ trạng thái hoặc mở lại nháp.")
                if self._snapshot_purchase_for_lock(previous) != self._snapshot_purchase_for_lock(purchase):
                    raise ValueError("Phiếu nhập đã thanh toán không thể sửa trực tiếp.")
                if self._get_purchase_discount_amount(previous) != self._get_purchase_discount_amount(purchase):
                    raise ValueError("Phiếu nhập đã thanh toán không thể sửa giảm giá khuyến mại.")
                continue

            if previous_status == "cancelled":
                if next_status != "cancelled":
                    raise ValueError("Phiếu nhập đã hủy không thể mở lại hoặc sửa trực tiếp.")
                if self._snapshot_purchase_for_lock(previous) != self._snapshot_purchase_for_lock(purchase):
                    raise ValueError("Phiếu nhập đã hủy không thể sửa trực tiếp.")
                if self._get_purchase_discount_amount(previous) != self._get_purchase_discount_amount(purchase):
                    raise ValueError("Phiếu nhập đã hủy không thể sửa giảm giá khuyến mại.")
                continue

            if next_status == "received":
                if not supplier_name:
                    raise ValueError("Phiếu nhập phải có nhà cung cấp trước khi nhập kho.")
                received_at = purchase.get("receivedAt") or purchase.get("received_at")
                if not received_at:
                    raise ValueError("Phiếu nhập phải có thời điểm nhập kho khi chuyển sang đã nhập kho.")
                if previous_status == "draft":
                    raise ValueError("Phiếu nhập phải được đặt hàng trước khi nhập kho.")
                continue

            if next_status != "paid":
                if previous_status == "ordered" and next_status == "draft":
                    raise ValueError("Phiếu nhập đã đặt hàng không thể quay lại nháp.")
                continue

            received_at = purchase.get("receivedAt") or purchase.get("received_at")
            if not received_at:
                raise ValueError("Phiếu nhập đã thanh toán phải có thời điểm nhập kho trước đó.")

            if previous_status is None:
                continue

            if previous_status not in {"received", "paid"}:
                raise ValueError("Phiếu nhập chỉ được chuyển sang đã thanh toán sau khi đã nhập kho.")

        if not self._is_procurement_batch_structure_locked_for_actor(
            connection,
            actor_username=actor_username,
            actor_role=actor_role,
        ):
            return

        for purchase in existing_purchases:
            purchase_id = str(purchase.get("id") or "")
            if not purchase_id or purchase_id in incoming_ids:
                continue
            if str(purchase.get("status") or "draft") in {"draft", "ordered"}:
                raise ValueError(
                    "Batch mode đang bật. Chỉ người giữ khóa batch hoặc Master Admin mới được xóa phiếu nhập nháp/đã đặt."
                )

        existing_by_id = {
            str(purchase.get("id")): purchase
            for purchase in existing_purchases
            if purchase.get("id")
        }
        for purchase in incoming_purchases:
            purchase_id = str(purchase.get("id") or "")
            next_status = str(purchase.get("status") or "draft").strip()
            previous = existing_by_id.get(purchase_id)
            previous_status = str(previous.get("status") or "").strip() if previous else ""

            if previous is None:
                if next_status in {"draft", "ordered"}:
                    raise ValueError(
                        "Batch mode đang bật. Chỉ người giữ khóa batch hoặc Master Admin mới được tạo phiếu nhập nháp/đã đặt."
                    )
                continue

            if self._can_non_owner_mutate_purchase_during_procurement_batch(connection, previous, purchase):
                continue

            involves_open_purchase = (
                previous_status in {"draft", "ordered"}
                or next_status in {"draft", "ordered", "cancelled"}
            )
            if not involves_open_purchase:
                continue

            if (
                previous_status == next_status
                and previous_status in {"draft", "ordered"}
                and self._snapshot_purchase_for_lock(previous) == self._snapshot_purchase_for_lock(purchase)
                and self._get_purchase_discount_amount(previous) == self._get_purchase_discount_amount(purchase)
            ):
                continue

            raise ValueError(
                "Batch mode đang bật. Chỉ người giữ khóa batch hoặc Master Admin mới được tạo/sửa cấu trúc phiếu nhập nháp/đã đặt."
            )

    def _snapshot_cart_for_lock(self, cart: dict) -> dict:
        return {
            "customerId": str(cart.get("customerId") or ""),
            "customerName": str(cart.get("customerName") or ""),
            "shipAddress": self._get_cart_ship_address(cart),
            "status": str(cart.get("status") or "draft"),
            "orderCode": str(cart.get("orderCode") or ""),
            "committedAt": str(cart.get("committedAt") or cart.get("committed_at") or ""),
            "items": sorted(
                [
                    {
                        "id": str(item.get("id") or ""),
                        "productId": int(item.get("productId") or 0),
                        "quantity": round(float(item.get("quantity") or 0), 2),
                        "unitPrice": round(float(item.get("unitPrice") or 0), 2),
                        "note": str(item.get("note") or ""),
                    }
                    for item in (cart.get("items") or [])
                ],
                key=lambda item: (item["id"], item["productId"]),
            ),
        }

    def _snapshot_purchase_for_lock(self, purchase: dict) -> dict:
        return {
            "supplierId": str(purchase.get("supplierId") or ""),
            "supplierName": str(purchase.get("supplierName") or ""),
            "note": str(purchase.get("note") or ""),
            "sourceType": str(purchase.get("sourceType") or purchase.get("source_type") or ""),
            "sourceCode": str(purchase.get("sourceCode") or purchase.get("source_code") or ""),
            "sourceName": str(purchase.get("sourceName") or purchase.get("source_name") or ""),
            "receiptCode": str(purchase.get("receiptCode") or ""),
            "receivedAt": purchase.get("receivedAt") or purchase.get("received_at") or "",
            "items": sorted(
                [
                    {
                        "id": str(item.get("id") or ""),
                        "productId": int(item.get("productId") or 0),
                        "sourceKind": str(item.get("sourceKind") or item.get("source_kind") or "shortage"),
                        "sourceNote": str(item.get("sourceNote") or item.get("source_note") or ""),
                        "quantity": round(float(item.get("quantity") or 0), 2),
                        "unitCost": round(float(item.get("unitCost") or 0), 2),
                        "batchCode": str(item.get("batchCode") or item.get("batch_code") or ""),
                        "expiryInputMode": str(item.get("expiryInputMode") or item.get("expiry_input_mode") or "direct"),
                        "manufactureDate": str(item.get("manufactureDate") or item.get("manufacture_date") or ""),
                        "expiryDate": str(item.get("expiryDate") or item.get("expiry_date") or ""),
                    }
                    for item in (purchase.get("items") or [])
                ],
                key=lambda item: (item["id"], item["productId"]),
            ),
        }

    def _snapshot_purchase_for_receive_lock(self, purchase: dict) -> dict:
        return {
            "supplierId": str(purchase.get("supplierId") or ""),
            "supplierName": str(purchase.get("supplierName") or ""),
            "sourceType": str(purchase.get("sourceType") or purchase.get("source_type") or ""),
            "sourceCode": str(purchase.get("sourceCode") or purchase.get("source_code") or ""),
            "sourceName": str(purchase.get("sourceName") or purchase.get("source_name") or ""),
            "items": sorted(
                [
                    {
                        "id": str(item.get("id") or ""),
                        "productId": int(item.get("productId") or 0),
                        "sourceKind": str(item.get("sourceKind") or item.get("source_kind") or "shortage"),
                        "sourceNote": str(item.get("sourceNote") or item.get("source_note") or ""),
                        "quantity": round(float(item.get("quantity") or 0), 2),
                        "unitCost": round(float(item.get("unitCost") or 0), 2),
                        "batchCode": str(item.get("batchCode") or item.get("batch_code") or ""),
                        "expiryInputMode": str(item.get("expiryInputMode") or item.get("expiry_input_mode") or "direct"),
                        "manufactureDate": str(item.get("manufactureDate") or item.get("manufacture_date") or ""),
                        "expiryDate": str(item.get("expiryDate") or item.get("expiry_date") or ""),
                    }
                    for item in (purchase.get("items") or [])
                ],
                key=lambda item: (item["id"], item["productId"]),
            ),
        }

    def _get_sync_collection(self, state_key: str) -> list[dict]:
        with self._connect() as connection:
            return self._load_sync_collection_from_tables(connection, state_key)

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

    def import_master_data(self, entity_type: str, records: list[dict], actor: str = "") -> dict:
        if not isinstance(records, list):
            raise ValueError("File import phải chứa danh sách records.")

        if entity_type == "products":
            return self._import_products_master(records, actor=actor)
        if entity_type in {"customers", "suppliers"}:
            return self._import_sync_master(entity_type, records, actor=actor)
        raise ValueError("Loại dữ liệu master không hợp lệ.")

    def _import_products_master(self, records: list[dict], *, actor: str = "") -> dict:
        summary = {"created": 0, "updated": 0, "restored": 0, "skipped": 0}
        products = self.get_products(include_deleted=True)
        by_name = {normalize_key(product["name"]): product for product in products}

        for record in records:
            name = str(record.get("name") or "").strip()
            category = str(record.get("category") or "Đồ chay").strip()
            unit = str(record.get("unit") or "gói").strip()
            price = record.get("price", 0)
            threshold = record.get("low_stock_threshold", 5)
            shelf_life_days = record.get("shelf_life_days")
            storage_life_days = record.get("storage_life_days")
            if not name:
                summary["skipped"] += 1
                continue

            existing = by_name.get(normalize_key(name))
            if existing:
                if existing.get("is_deleted"):
                    self.restore_product(existing["id"], actor=actor)
                    summary["restored"] += 1
                self.update_product(
                    existing["id"],
                    name=name,
                    category=category,
                    unit=unit,
                    price=price,
                    sale_price=record.get("sale_price"),
                    low_stock_threshold=threshold,
                    shelf_life_days=shelf_life_days,
                    storage_life_days=storage_life_days,
                    actor=actor,
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
                    shelf_life_days=shelf_life_days,
                    storage_life_days=storage_life_days,
                    actor=actor,
                )
                summary["created"] += 1
                by_name[normalize_key(name)] = created

        return summary

    def _import_sync_master(self, state_key: str, records: list[dict], *, actor: str = "") -> dict:
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
        payload = {state_key: merged}
        if actor:
            payload["actor"] = actor
        self.save_sync_state(payload)
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
                    substr(t.created_at, 1, 7) AS month_key,
                    ir.receipt_type,
                    ir.receipt_code,
                    ir.discount_amount AS receipt_discount_amount,
                    iri.unit_amount AS receipt_unit_amount,
                    iri.line_total AS receipt_line_total
                FROM transactions t
                INNER JOIN products p ON p.id = t.product_id
                LEFT JOIN inventory_receipt_items iri ON iri.transaction_id = t.id
                LEFT JOIN inventory_receipts ir ON ir.id = iri.receipt_id
                WHERE {where_clause}
                ORDER BY t.created_at DESC, t.id DESC
                """,
                query_params,
            ).fetchall()
            cart_discount_rows = connection.execute(
                """
                SELECT
                    c.order_code,
                    c.discount_amount,
                    COALESCE(SUM(ci.quantity * ci.unit_price), 0) AS subtotal_amount
                FROM carts c
                LEFT JOIN cart_items ci ON ci.cart_id = c.id
                WHERE c.order_code != ''
                GROUP BY c.id, c.order_code, c.discount_amount
                """
            ).fetchall()
            purchase_discount_rows = connection.execute(
                """
                SELECT
                    ir.receipt_code,
                    ir.discount_amount,
                    COALESCE(SUM(iri.line_total), 0) AS subtotal_amount
                FROM inventory_receipts ir
                LEFT JOIN inventory_receipt_items iri ON iri.receipt_id = ir.id
                WHERE ir.receipt_type = 'purchase'
                GROUP BY ir.id, ir.receipt_code, ir.discount_amount
                """
            ).fetchall()

        sale_discount_docs = {
            str(row["order_code"] or "").strip(): {
                "discount_amount": round(float(row["discount_amount"] or 0), 2),
                "subtotal_amount": round(float(row["subtotal_amount"] or 0), 2),
            }
            for row in cart_discount_rows
            if str(row["order_code"] or "").strip()
        }
        purchase_discount_docs = {
            str(row["receipt_code"] or "").strip(): {
                "discount_amount": round(float(row["discount_amount"] or 0), 2),
                "subtotal_amount": round(float(row["subtotal_amount"] or 0), 2),
            }
            for row in purchase_discount_rows
            if str(row["receipt_code"] or "").strip()
        }

        def allocate_document_discounts(grouped_rows: dict[str, list[tuple[int, float]]], document_map: dict[str, dict]) -> dict[int, float]:
            allocations: dict[int, float] = {}
            for document_code, row_entries in grouped_rows.items():
                document_meta = document_map.get(document_code)
                if not document_meta:
                    continue
                total_discount = round(float(document_meta.get("discount_amount") or 0), 2)
                total_gross = round(float(document_meta.get("subtotal_amount") or 0), 2)
                if total_discount <= 0 or total_gross <= 0 or not row_entries:
                    continue
                remaining_discount = total_discount
                remaining_gross = total_gross
                for index, (row_index, gross_amount) in enumerate(row_entries):
                    gross_value = max(0.0, round(float(gross_amount or 0), 2))
                    if gross_value <= 0:
                        allocations[row_index] = 0.0
                        continue
                    is_last = index == len(row_entries) - 1
                    if is_last or remaining_gross <= gross_value:
                        allocated = round(max(0.0, remaining_discount), 2)
                    else:
                        allocated = round(total_discount * gross_value / total_gross, 2)
                        allocated = min(allocated, remaining_discount)
                    allocations[row_index] = allocated
                    remaining_discount = round(max(0.0, remaining_discount - allocated), 2)
                    remaining_gross = round(max(0.0, remaining_gross - gross_value), 2)
            return allocations

        sale_rows_by_order_code: dict[str, list[tuple[int, float]]] = {}
        purchase_rows_by_receipt_code: dict[str, list[tuple[int, float]]] = {}
        sale_discount_from_notes: dict[str, float] = {}
        for row_index, row in enumerate(rows):
            note = row["note"] or ""
            transaction_kind = detect_report_transaction_kind(row["receipt_type"], note)
            quantity = float(row["quantity"])
            receipt_line_total = (
                float(row["receipt_line_total"])
                if row["receipt_line_total"] is not None
                else None
            )
            if transaction_kind == "sale":
                order_code = extract_order_code_from_note(note)
                if order_code:
                    if order_code not in sale_discount_from_notes:
                        sale_discount_from_notes[order_code] = round(float(extract_labeled_price(note, "Giảm giá KM") or 0), 2)
                    sale_rows_by_order_code.setdefault(order_code, []).append(
                        (
                            row_index,
                            round(quantity * float(extract_price_from_note(note, "out") or row["sale_price"] or 0), 2),
                        )
                    )
            elif transaction_kind == "purchase":
                receipt_code = str(row["receipt_code"] or "").strip()
                if receipt_code:
                    purchase_rows_by_receipt_code.setdefault(receipt_code, []).append(
                        (
                            row_index,
                            round(receipt_line_total if receipt_line_total is not None else quantity * float(extract_price_from_note(note, "in") or row["price"] or 0), 2),
                        )
                    )

        for order_code, row_entries in sale_rows_by_order_code.items():
            if order_code in sale_discount_docs:
                continue
            total_gross = round(sum(gross_amount for _, gross_amount in row_entries), 2)
            total_discount = round(float(sale_discount_from_notes.get(order_code) or 0), 2)
            if total_discount <= 0:
                continue
            sale_discount_docs[order_code] = {
                "discount_amount": total_discount,
                "subtotal_amount": total_gross,
            }

        sale_discount_allocations = allocate_document_discounts(sale_rows_by_order_code, sale_discount_docs)
        purchase_discount_allocations = allocate_document_discounts(purchase_rows_by_receipt_code, purchase_discount_docs)

        def blank_bucket(month_value: str) -> dict:
            return {
                "month": month_value,
                "in_quantity": 0.0,
                "out_quantity": 0.0,
                "purchase_value": 0.0,
                "revenue_value": 0.0,
                "cogs_value": 0.0,
                "gross_profit_value": 0.0,
                "adjustment_in_quantity": 0.0,
                "adjustment_out_quantity": 0.0,
                "customer_return_quantity": 0.0,
                "customer_return_value": 0.0,
                "supplier_return_quantity": 0.0,
                "supplier_return_value": 0.0,
                "in_value": 0.0,
                "out_value": 0.0,
                "net_value": 0.0,
            }

        monthly_totals = {key: blank_bucket(key) for key in month_keys}
        focus_products: dict[int, dict] = {}
        monthly_out_by_product: dict[str, dict[int, float]] = {key: {} for key in avg_month_keys}

        for row_index, row in enumerate(rows):
            row_month = row["month_key"]
            if row_month not in monthly_totals:
                continue

            quantity = float(row["quantity"])
            fallback_price = float(row["price"])
            fallback_sale_price = float(row["sale_price"])
            note = row["note"] or ""
            transaction_kind = detect_report_transaction_kind(row["receipt_type"], note)
            receipt_unit_amount = (
                float(row["receipt_unit_amount"])
                if row["receipt_unit_amount"] is not None
                else None
            )
            receipt_line_total = (
                float(row["receipt_line_total"])
                if row["receipt_line_total"] is not None
                else None
            )

            purchase_unit_cost = extract_price_from_note(note, "in")
            sale_unit_price = extract_price_from_note(note, "out")
            sale_unit_cost = extract_cost_from_note(note)
            if transaction_kind == "purchase" and receipt_unit_amount is not None:
                purchase_unit_cost = receipt_unit_amount
            if transaction_kind == "customer_return" and receipt_unit_amount is None:
                receipt_unit_amount = extract_labeled_price(note, "Giá hoàn")
            if transaction_kind == "supplier_return" and receipt_unit_amount is None:
                receipt_unit_amount = extract_labeled_price(note, "Giá trả")
            if purchase_unit_cost is None:
                purchase_unit_cost = fallback_price
            if sale_unit_price is None:
                sale_unit_price = fallback_sale_price
            if sale_unit_cost is None:
                sale_unit_cost = fallback_price

            purchase_amount = round(
                receipt_line_total if transaction_kind == "purchase" and receipt_line_total is not None else quantity * purchase_unit_cost,
                2,
            )
            revenue_amount = round(quantity * sale_unit_price, 2)
            purchase_amount = round(max(0.0, purchase_amount - purchase_discount_allocations.get(row_index, 0.0)), 2)
            revenue_amount = round(max(0.0, revenue_amount - sale_discount_allocations.get(row_index, 0.0)), 2)
            cogs_amount = round(quantity * sale_unit_cost, 2)
            gross_profit_amount = round(revenue_amount - cogs_amount, 2)
            customer_return_amount = round(
                receipt_line_total
                if transaction_kind == "customer_return" and receipt_line_total is not None
                else quantity * float(receipt_unit_amount or 0),
                2,
            )
            supplier_return_amount = round(
                receipt_line_total
                if transaction_kind == "supplier_return" and receipt_line_total is not None
                else quantity * float(receipt_unit_amount or 0),
                2,
            )

            bucket = monthly_totals[row_month]
            if transaction_kind == "purchase":
                bucket["in_quantity"] += quantity
                bucket["purchase_value"] += purchase_amount
                bucket["in_value"] += purchase_amount
            elif transaction_kind == "sale":
                bucket["out_quantity"] += quantity
                bucket["revenue_value"] += revenue_amount
                bucket["cogs_value"] += cogs_amount
                bucket["gross_profit_value"] += gross_profit_amount
                bucket["out_value"] += revenue_amount
                bucket["net_value"] += gross_profit_amount
                if row_month in monthly_out_by_product:
                    current = monthly_out_by_product[row_month].get(row["product_id"], 0.0)
                    monthly_out_by_product[row_month][row["product_id"]] = current + quantity
            elif transaction_kind == "customer_return":
                bucket["in_quantity"] += quantity
                bucket["customer_return_quantity"] += quantity
                bucket["customer_return_value"] += customer_return_amount
                bucket["in_value"] += customer_return_amount
            elif transaction_kind == "supplier_return":
                bucket["out_quantity"] += quantity
                bucket["supplier_return_quantity"] += quantity
                bucket["supplier_return_value"] += supplier_return_amount
                bucket["out_value"] += supplier_return_amount
            elif transaction_kind == "inventory_adjustment":
                if row["transaction_type"] == "in":
                    bucket["in_quantity"] += quantity
                    bucket["adjustment_in_quantity"] += quantity
                else:
                    bucket["out_quantity"] += quantity
                    bucket["adjustment_out_quantity"] += quantity
            elif row["transaction_type"] == "in":
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
                        "adjustment_in_quantity": 0.0,
                        "adjustment_out_quantity": 0.0,
                        "customer_return_quantity": 0.0,
                        "customer_return_value": 0.0,
                        "supplier_return_quantity": 0.0,
                        "supplier_return_value": 0.0,
                        "in_value": 0.0,
                        "out_value": 0.0,
                        "net_value": 0.0,
                    },
                )
                if transaction_kind == "purchase":
                    product_entry["in_quantity"] += quantity
                    product_entry["purchase_value"] += purchase_amount
                    product_entry["in_value"] += purchase_amount
                elif transaction_kind == "sale":
                    product_entry["out_quantity"] += quantity
                    product_entry["revenue_value"] += revenue_amount
                    product_entry["cogs_value"] += cogs_amount
                    product_entry["gross_profit_value"] += gross_profit_amount
                    product_entry["out_value"] += revenue_amount
                    product_entry["net_value"] += gross_profit_amount
                elif transaction_kind == "customer_return":
                    product_entry["in_quantity"] += quantity
                    product_entry["customer_return_quantity"] += quantity
                    product_entry["customer_return_value"] += customer_return_amount
                    product_entry["in_value"] += customer_return_amount
                elif transaction_kind == "supplier_return":
                    product_entry["out_quantity"] += quantity
                    product_entry["supplier_return_quantity"] += quantity
                    product_entry["supplier_return_value"] += supplier_return_amount
                    product_entry["out_value"] += supplier_return_amount
                elif transaction_kind == "inventory_adjustment":
                    if row["transaction_type"] == "in":
                        product_entry["in_quantity"] += quantity
                        product_entry["adjustment_in_quantity"] += quantity
                    else:
                        product_entry["out_quantity"] += quantity
                        product_entry["adjustment_out_quantity"] += quantity
                elif row["transaction_type"] == "in":
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
            bucket["adjustment_in_quantity"] = round(bucket["adjustment_in_quantity"], 2)
            bucket["adjustment_out_quantity"] = round(bucket["adjustment_out_quantity"], 2)
            bucket["customer_return_quantity"] = round(bucket["customer_return_quantity"], 2)
            bucket["customer_return_value"] = round(bucket["customer_return_value"], 2)
            bucket["supplier_return_quantity"] = round(bucket["supplier_return_quantity"], 2)
            bucket["supplier_return_value"] = round(bucket["supplier_return_value"], 2)
            bucket["in_value"] = round(bucket["in_value"], 2)
            bucket["out_value"] = round(bucket["out_value"], 2)
            bucket["net_quantity"] = round(bucket["in_quantity"] - bucket["out_quantity"], 2)
            bucket["net_value"] = round(
                bucket["gross_profit_value"] - bucket["customer_return_value"] + bucket["supplier_return_value"],
                2,
            )
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
            summary["adjustment_in_quantity"] = round(sum(bucket["adjustment_in_quantity"] for bucket in buckets), 2)
            summary["adjustment_out_quantity"] = round(sum(bucket["adjustment_out_quantity"] for bucket in buckets), 2)
            summary["customer_return_quantity"] = round(sum(bucket["customer_return_quantity"] for bucket in buckets), 2)
            summary["customer_return_value"] = round(sum(bucket["customer_return_value"] for bucket in buckets), 2)
            summary["supplier_return_quantity"] = round(sum(bucket["supplier_return_quantity"] for bucket in buckets), 2)
            summary["supplier_return_value"] = round(sum(bucket["supplier_return_value"] for bucket in buckets), 2)
            summary["in_value"] = round(sum(bucket["in_value"] for bucket in buckets), 2)
            summary["out_value"] = round(sum(bucket["out_value"] for bucket in buckets), 2)
            summary["net_quantity"] = round(summary["in_quantity"] - summary["out_quantity"], 2)
            summary["net_value"] = round(
                summary["gross_profit_value"] - summary["customer_return_value"] + summary["supplier_return_value"],
                2,
            )
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
            item["adjustment_in_quantity"] = round(float(item["adjustment_in_quantity"]), 2)
            item["adjustment_out_quantity"] = round(float(item["adjustment_out_quantity"]), 2)
            item["customer_return_quantity"] = round(float(item["customer_return_quantity"]), 2)
            item["customer_return_value"] = round(float(item["customer_return_value"]), 2)
            item["supplier_return_quantity"] = round(float(item["supplier_return_quantity"]), 2)
            item["supplier_return_value"] = round(float(item["supplier_return_value"]), 2)
            item["in_value"] = round(float(item["in_value"]), 2)
            item["out_value"] = round(float(item["out_value"]), 2)
            item["net_value"] = round(
                float(item["gross_profit_value"]) - float(item["customer_return_value"]) + float(item["supplier_return_value"]),
                2,
            )

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
