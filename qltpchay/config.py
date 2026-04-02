import json
import os
from pathlib import Path

from .constants import (
    CONFIG_PATH,
    DEFAULT_ADMIN_PASSWORD,
    DEFAULT_ADMIN_USERNAME,
    DEFAULT_HOST,
    DEFAULT_PORT,
)


def build_default_system_config(*, use_env_seed: bool) -> dict:
    config = {
        "server": {
            "host": DEFAULT_HOST,
            "port": DEFAULT_PORT,
        },
        "admin": {
            "username": DEFAULT_ADMIN_USERNAME,
            "password": DEFAULT_ADMIN_PASSWORD,
        },
    }
    if use_env_seed:
        config["server"]["host"] = os.environ.get("APP_HOST", DEFAULT_HOST)
        try:
            config["server"]["port"] = int(os.environ.get("APP_PORT", str(DEFAULT_PORT)))
        except ValueError:
            config["server"]["port"] = DEFAULT_PORT
        config["admin"]["username"] = os.environ.get("MASTER_ADMIN_USERNAME", DEFAULT_ADMIN_USERNAME)
        config["admin"]["password"] = os.environ.get("MASTER_ADMIN_PASSWORD", DEFAULT_ADMIN_PASSWORD)
    return config


def save_system_config(config: dict, config_path: Path = CONFIG_PATH) -> None:
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(
        json.dumps(config, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def load_system_config(config_path: Path = CONFIG_PATH) -> dict:
    if not config_path.exists():
        config = build_default_system_config(use_env_seed=True)
        save_system_config(config, config_path)
        return config

    try:
        raw_config = json.loads(config_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        raise ValueError(f"File config hệ thống không hợp lệ: {config_path}") from exc

    defaults = build_default_system_config(use_env_seed=False)
    config = {
        "server": {
            "host": str(raw_config.get("server", {}).get("host") or defaults["server"]["host"]).strip(),
            "port": defaults["server"]["port"],
        },
        "admin": {
            "username": str(raw_config.get("admin", {}).get("username") or defaults["admin"]["username"]).strip(),
            "password": str(raw_config.get("admin", {}).get("password") or defaults["admin"]["password"]),
        },
    }

    try:
        config["server"]["port"] = int(raw_config.get("server", {}).get("port", defaults["server"]["port"]))
    except (TypeError, ValueError):
        config["server"]["port"] = defaults["server"]["port"]

    if not config["server"]["host"]:
        config["server"]["host"] = defaults["server"]["host"]
    if not config["admin"]["username"]:
        config["admin"]["username"] = defaults["admin"]["username"]
    if not config["admin"]["password"]:
        config["admin"]["password"] = defaults["admin"]["password"]

    if config != raw_config:
        save_system_config(config, config_path)

    return config

