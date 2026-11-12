import os
import logging
import datetime
from qltpchay.config import load_system_config

_logger = None

class DailyFileHandler(logging.FileHandler):
    def __init__(self, log_dir, encoding='utf-8'):
        self.log_dir = log_dir
        self.encoding = encoding
        os.makedirs(self.log_dir, exist_ok=True)
        super().__init__(self._get_filename(), encoding=self.encoding)
        self._cleanup_old_logs()
        
    def _get_filename(self):
        date_str = datetime.datetime.now().strftime("%Y-%m-%d")
        return os.path.join(self.log_dir, f"app.{date_str}.log")
        
    def emit(self, record):
        current_filename = os.path.abspath(self._get_filename())
        if self.baseFilename != current_filename:
            self.close()
            self.baseFilename = current_filename
            self.stream = self._open()
            self._cleanup_old_logs()
        super().emit(record)

    def _cleanup_old_logs(self):
        try:
            now = datetime.datetime.now()
            for filename in os.listdir(self.log_dir):
                if filename.startswith("app.") and filename.endswith(".log"):
                    filepath = os.path.join(self.log_dir, filename)
                    file_mtime = datetime.datetime.fromtimestamp(os.path.getmtime(filepath))
                    if (now - file_mtime).days > 365:
                        os.remove(filepath)
        except Exception:
            pass

def get_logger():
    global _logger
    if _logger is not None:
        return _logger

    config = load_system_config()
    
    # Get log level from config, default to INFO
    log_level_str = config.get("debug", {}).get("log_level", "INFO").upper()
    log_level = getattr(logging, log_level_str, logging.INFO)

    _logger = logging.getLogger("qltpchay_app")
    _logger.setLevel(log_level)

    formatter = logging.Formatter('[%(asctime)s] %(levelname)s - %(message)s')

    # Console handler
    ch = logging.StreamHandler()
    ch.setLevel(log_level)
    ch.setFormatter(formatter)
    _logger.addHandler(ch)

    if config.get("debug", {}).get("file_logging", False):
        log_dir = "logs"
        # Custom Daily File Handler
        fh = DailyFileHandler(log_dir, encoding="utf-8")
        fh.setLevel(log_level)
        fh.setFormatter(formatter)
        _logger.addHandler(fh)

    return _logger

def log_info(message: str):
    get_logger().info(message)

def log_error(message: str, exc_info=False):
    get_logger().error(message, exc_info=exc_info)

def log_debug(message: str):
    get_logger().debug(message)

def log_always(message: str, level=logging.INFO):
    logger = get_logger()
    for handler in logger.handlers:
        record = logger.makeRecord(
            logger.name, level, "(startup)", 0, message, (), None
        )
        try:
            handler.emit(record)
        except Exception:
            pass
