from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = BASE_DIR / "data"
BACKUP_DIR = DATA_DIR / "backups"
DB_PATH = DATA_DIR / "inventory.db"
CONFIG_PATH = DATA_DIR / "system_config.json"
DEFAULT_INIT_FILE = DATA_DIR / "List_price.txt"
DEFAULT_HOST = "192.168.1.18"
DEFAULT_PORT = 8000
DEFAULT_ADMIN_USERNAME = "masteradmin"
DEFAULT_ADMIN_PASSWORD = "admin12345"
ADMIN_SESSION_COOKIE = "qltpchay_admin_session"

