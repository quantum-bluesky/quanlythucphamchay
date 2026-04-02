import argparse
import atexit
import shutil
import signal
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from http.server import ThreadingHTTPServer
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import qltpchay.constants as constants
from qltpchay.auth import AdminSessionManager
from qltpchay.config import load_system_config
from qltpchay.http_handler import create_handler
from qltpchay.store import InventoryStore
import qltpchay.store as store_module


def now_minus(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


def build_fixture(store: InventoryStore) -> None:
    store.reset_all_data()

    product_specs = [
        ("Bò kho", "Đồ chay", "gói", 50000, 60000, 5),
        ("Bò lát xào", "Đồ chay", "gói", 35000, 45000, 5),
        ("Rong biển kim", "Đồ chay", "gói", 20000, 30000, 4),
        ("Ruốc nấm", "Đồ chay", "gói", 15000, 25000, 3),
        ("Chả quế chay", "Đồ chay", "gói", 40000, 55000, 4),
        ("Hàng đã xóa", "Đồ chay", "gói", 10000, 15000, 2),
    ]

    products: dict[str, dict] = {}
    for name, category, unit, price, sale_price, threshold in product_specs:
        products[name] = store.create_product(
            name=name,
            category=category,
            unit=unit,
            price=price,
            sale_price=sale_price,
            low_stock_threshold=threshold,
        )

    store.create_purchase_receipt(
        items=[
            {"product_id": products["Bò kho"]["id"], "quantity": 10, "unit_cost": 50000},
            {"product_id": products["Chả quế chay"]["id"], "quantity": 6, "unit_cost": 40000},
            {"product_id": products["Ruốc nấm"]["id"], "quantity": 3, "unit_cost": 15000},
        ],
        supplier_name="NCC Hương Sen",
        note="Seed nhập kho đầu kỳ",
    )
    store.create_transaction(products["Bò lát xào"]["id"], "in", 2, "Seed tồn đầu kỳ")
    store.create_checkout_order(
        customer_name="Quán Chay An Nhiên",
        items=[
            {"product_id": products["Bò kho"]["id"], "quantity": 4, "unit_price": 60000},
            {"product_id": products["Chả quế chay"]["id"], "quantity": 2, "unit_price": 55000},
        ],
        note="Seed đơn đã chốt",
    )
    store.create_transaction(products["Bò lát xào"]["id"], "out", 2, "Seed hết hàng để test nhập")
    store.delete_product(products["Hàng đã xóa"]["id"])

    customers = [
        {
            "id": "customer_seed_1",
            "name": "Quán Chay An Nhiên",
            "phone": "0900000001",
            "address": "Hà Nội",
            "zaloUrl": "https://zalo.me/quan-chay-an-nhien",
            "createdAt": now_minus(10),
            "updatedAt": now_minus(1),
        },
        {
            "id": "customer_seed_2",
            "name": "Chị Ngọc, Long Biên",
            "phone": "0900000002",
            "address": "Long Biên",
            "zaloUrl": "",
            "createdAt": now_minus(8),
            "updatedAt": now_minus(1),
        },
        {
            "id": "customer_seed_deleted",
            "name": "Khách đã xóa",
            "phone": "0900000003",
            "address": "",
            "zaloUrl": "",
            "createdAt": now_minus(30),
            "updatedAt": now_minus(20),
            "deletedAt": now_minus(5),
        },
    ]

    suppliers = [
        {
            "id": "supplier_seed_1",
            "name": "NCC Hương Sen",
            "phone": "0911000001",
            "address": "Gia Lâm",
            "note": "Nguồn chính",
            "createdAt": now_minus(10),
            "updatedAt": now_minus(1),
        },
        {
            "id": "supplier_seed_2",
            "name": "NCC Rau Củ",
            "phone": "0911000002",
            "address": "Hoài Đức",
            "note": "Nguồn phụ",
            "createdAt": now_minus(6),
            "updatedAt": now_minus(1),
        },
        {
            "id": "supplier_seed_deleted",
            "name": "NCC Đã Xóa",
            "phone": "0911000003",
            "address": "",
            "note": "",
            "createdAt": now_minus(30),
            "updatedAt": now_minus(20),
            "deletedAt": now_minus(5),
        },
    ]

    carts = [
        {
            "id": "cart_draft_1",
            "customerId": "customer_seed_1",
            "customerName": "Quán Chay An Nhiên",
            "status": "draft",
            "paymentStatus": "unpaid",
            "items": [
                {
                    "id": "cart_item_1",
                    "productId": products["Bò kho"]["id"],
                    "productName": "Bò kho",
                    "unit": "gói",
                    "quantity": 6,
                    "unitPrice": 60000,
                }
            ],
            "createdAt": now_minus(2),
            "updatedAt": now_minus(1),
            "orderCode": "",
        },
        {
            "id": "cart_completed_1",
            "customerId": "customer_seed_2",
            "customerName": "Chị Ngọc, Long Biên",
            "status": "completed",
            "paymentStatus": "unpaid",
            "items": [
                {
                    "id": "cart_item_2",
                    "productId": products["Chả quế chay"]["id"],
                    "productName": "Chả quế chay",
                    "unit": "gói",
                    "quantity": 1,
                    "unitPrice": 55000,
                }
            ],
            "createdAt": now_minus(3),
            "updatedAt": now_minus(3),
            "completedAt": now_minus(3),
            "orderCode": "DH-SEED-001",
        },
    ]

    purchases = [
        {
            "id": "purchase_draft_1",
            "supplierName": "NCC Hương Sen",
            "note": "Seed phiếu nhập nháp cho Bò lát xào",
            "status": "draft",
            "createdAt": now_minus(2),
            "updatedAt": now_minus(1),
            "receiptCode": "PN-SEED-001",
            "items": [
                {
                    "id": "purchase_item_1",
                    "productId": products["Bò lát xào"]["id"],
                    "productName": "Bò lát xào",
                    "unit": "gói",
                    "quantity": 5,
                    "unitCost": 35000,
                }
            ],
        },
        {
            "id": "purchase_ordered_1",
            "supplierName": "NCC Rau Củ",
            "note": "Seed phiếu đang đặt",
            "status": "ordered",
            "createdAt": now_minus(4),
            "updatedAt": now_minus(1),
            "receiptCode": "PN-SEED-002",
            "items": [
                {
                    "id": "purchase_item_2",
                    "productId": products["Rong biển kim"]["id"],
                    "productName": "Rong biển kim",
                    "unit": "gói",
                    "quantity": 4,
                    "unitCost": 20000,
                }
            ],
        },
        {
            "id": "purchase_paid_1",
            "supplierName": "NCC Hương Sen",
            "note": "Phiếu đã nhập và đã thanh toán",
            "status": "paid",
            "createdAt": now_minus(7),
            "updatedAt": now_minus(6),
            "receivedAt": now_minus(6),
            "receiptCode": "PN-SEED-003",
            "items": [
                {
                    "id": "purchase_item_3",
                    "productId": products["Ruốc nấm"]["id"],
                    "productName": "Ruốc nấm",
                    "unit": "gói",
                    "quantity": 2,
                    "unitCost": 15000,
                }
            ],
        },
    ]

    store.save_sync_state(
        {
            "customers": customers,
            "suppliers": suppliers,
            "carts": carts,
            "purchases": purchases,
        }
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Run integration test server with seeded temp DB.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8130)
    args = parser.parse_args()

    temp_root = Path(tempfile.mkdtemp(prefix="qltpchay-int-"))
    db_path = temp_root / "inventory-test.db"
    constants.BACKUP_DIR = temp_root / "backups"
    store_module.BACKUP_DIR = constants.BACKUP_DIR

    def cleanup() -> None:
        shutil.rmtree(temp_root, ignore_errors=True)

    atexit.register(cleanup)

    store = InventoryStore(db_path)
    build_fixture(store)

    system_config = load_system_config()
    admin_sessions = AdminSessionManager(
        str(system_config["admin"]["username"]),
        str(system_config["admin"]["password"]),
    )
    server = ThreadingHTTPServer((args.host, args.port), create_handler(store, admin_sessions))

    def shutdown_handler(*_args) -> None:
        server.shutdown()

    signal.signal(signal.SIGTERM, shutdown_handler)
    signal.signal(signal.SIGINT, shutdown_handler)

    print(f"Integration test server running at http://{args.host}:{args.port}", flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()
        cleanup()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
