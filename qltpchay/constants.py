from pathlib import Path


import os

APP_NAME = "Quản lý thực phẩm chay"
BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = BASE_DIR / "data"
BACKUP_DIR = DATA_DIR / "backups"
DB_PATH = DATA_DIR / "inventory.db"

APP_ENV = os.environ.get("APP_ENV", "test").lower()
if APP_ENV == "production" or APP_ENV == "Production":
    CONFIG_PATH = DATA_DIR / "system_config.production.json"
else:
    CONFIG_PATH = DATA_DIR / "system_config.json"

JS_ASSET_VERSIONS_PATH = DATA_DIR / "js_asset_versions.json"
DEFAULT_INIT_FILE = DATA_DIR / "List_price.txt"
DEFAULT_HOST = "192.168.1.18"
DEFAULT_PORT = 8000
DEFAULT_ADMIN_USERNAME = "masteradmin"
DEFAULT_ADMIN_PASSWORD = "admin12345"
ADMIN_SESSION_COOKIE = "qltpchay_admin_session"

