import argparse
import json
from http.server import ThreadingHTTPServer
from pathlib import Path

from qltpchay.auth import AdminSessionManager
from qltpchay.config import load_system_config
from qltpchay.constants import BASE_DIR, CONFIG_PATH, DB_PATH, DEFAULT_INIT_FILE
from qltpchay.http_handler import create_handler as modular_create_handler
from qltpchay.importer import import_products_from_file as modular_import_products_from_file
from qltpchay.store import InventoryStore

create_handler = modular_create_handler
import_products_from_file = modular_import_products_from_file

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

    result = modular_import_products_from_file(
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


def build_cli_parser(system_config: dict) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Quản lý tồn kho thực phẩm chay")
    parser.add_argument("--host", default=None, help="Host/IP/domain để bind server")
    parser.add_argument("--port", type=int, default=None, help="Port chạy ứng dụng")
    subparsers = parser.add_subparsers(dest="command")

    init_parser = subparsers.add_parser("init", help="Khởi tạo sản phẩm từ file danh sách")
    init_parser.add_argument("--file", default=str(DEFAULT_INIT_FILE))
    init_parser.add_argument("--category", default="Đồ chay")
    init_parser.add_argument("--unit", default="gói")
    init_parser.add_argument("--threshold", type=float, default=5)
    init_parser.add_argument("--price", type=float, default=0)
    init_parser.add_argument("--reset", action="store_true", help="Xóa dữ liệu hiện có trước khi import")

    subparsers.add_parser("serve", help="Chạy web server")
    subparsers.add_parser("config", help="Hiện file cấu hình hệ thống đang dùng")

    return parser


def run_server(system_config: dict, host: str | None = None, port: int | None = None) -> None:
    resolved_host = host or str(system_config["server"]["host"])
    resolved_port = int(port or system_config["server"]["port"])
    store = InventoryStore(DB_PATH)
    admin_sessions = AdminSessionManager(
        str(system_config["admin"]["username"]),
        str(system_config["admin"]["password"]),
    )
    server = ThreadingHTTPServer((resolved_host, resolved_port), modular_create_handler(store, admin_sessions))
    print(f"Inventory app running at http://{resolved_host}:{resolved_port}")
    print(f"System config file: {CONFIG_PATH}")
    print(f"Master Admin username: {system_config['admin']['username']}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
    finally:
        server.server_close()


def main() -> int:
    system_config = load_system_config()
    parser = build_cli_parser(system_config)
    args = parser.parse_args()

    if args.command == "init":
        return run_init_command(args.file, args.category, args.unit, args.threshold, args.price, args.reset)

    if args.command == "config":
        print(json.dumps(system_config, ensure_ascii=False, indent=2))
        print(f"Config file: {CONFIG_PATH}")
        return 0

    if args.command == "serve":
        run_server(system_config, args.host, args.port)
        return 0

    run_server(system_config, args.host, args.port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


