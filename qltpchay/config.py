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

TRUTHY_VALUES = {"1", "true", "yes", "on"}
DEFAULT_APP_VERSION = "2.3.1"
DEFAULT_SYSTEM_SESSION_TIMEOUT_MINUTES = 360
DEFAULT_ADMIN_SESSION_TIMEOUT_MINUTES = 30
DEFAULT_ITEMS_PER_PAGE = 10
DEFAULT_DOCUMENTS_PER_PAGE = 10
DEFAULT_PROCUREMENT_BATCH_LOCK_TIMEOUT_MINUTES = 180
DEFAULT_NORMAL_USERS = [
    {
        "username": "staff",
        "password": "staff12345",
    }
]
DEFAULT_MAIL_CONFIG = {
    "enabled": False,
    "smtp_host": "",
    "smtp_port": 587,
    "username": "",
    "password": "",
    "from_email": "",
    "to_emails": [],
    "use_tls": True,
    "use_ssl": False,
    "subject_prefix": "[QLTP Chay]",
}


def _parse_env_flag(name: str, default: bool) -> bool:
    raw_value = os.environ.get(name)
    if raw_value is None:
        return default
    return str(raw_value).strip().lower() in TRUTHY_VALUES


def _normalize_timeout_minutes(value, fallback: int) -> int:
    try:
        return max(1, int(value))
    except (TypeError, ValueError):
        return fallback


def _normalize_page_size(value, fallback: int) -> int:
    try:
        return max(1, int(value))
    except (TypeError, ValueError):
        return fallback


def _normalize_users(raw_users) -> list[dict]:
    if not isinstance(raw_users, list):
        return []
    normalized_users: list[dict] = []
    for user in raw_users:
        if not isinstance(user, dict):
            continue
        username = str(user.get("username") or "").strip()
        password = str(user.get("password") or "")
        if not username:
            continue
        raw_permissions = user.get("permissions", [])
        permissions = []
        if isinstance(raw_permissions, list):
            permissions = [
                str(permission or "").strip()
                for permission in raw_permissions
                if str(permission or "").strip()
            ]
        normalized_users.append(
            {
                "username": username,
                "password": password,
                "permissions": sorted(set(permissions)),
            }
        )
    return normalized_users


def _normalize_procurement_config(raw_procurement, defaults: dict | None = None) -> dict:
    defaults = defaults or {
        "batch_planner_enabled": True,
        "batch_lock_timeout_minutes": DEFAULT_PROCUREMENT_BATCH_LOCK_TIMEOUT_MINUTES,
        "allow_daily_quick_shortage_flow": True,
        "required_login_for_batch_mode": True,
        "planner_manager_usernames": [],
    }
    raw_procurement = raw_procurement if isinstance(raw_procurement, dict) else {}
    raw_manager_usernames = raw_procurement.get(
        "planner_manager_usernames",
        defaults.get("planner_manager_usernames", []),
    )
    manager_usernames = []
    if isinstance(raw_manager_usernames, list):
        manager_usernames = [
            str(username or "").strip()
            for username in raw_manager_usernames
            if str(username or "").strip()
        ]
    return {
        "batch_planner_enabled": bool(
            raw_procurement.get("batch_planner_enabled", defaults["batch_planner_enabled"])
        ),
        "batch_lock_timeout_minutes": _normalize_timeout_minutes(
            raw_procurement.get("batch_lock_timeout_minutes", defaults["batch_lock_timeout_minutes"]),
            defaults["batch_lock_timeout_minutes"],
        ),
        "allow_daily_quick_shortage_flow": bool(
            raw_procurement.get(
                "allow_daily_quick_shortage_flow",
                defaults["allow_daily_quick_shortage_flow"],
            )
        ),
        "required_login_for_batch_mode": bool(
            raw_procurement.get(
                "required_login_for_batch_mode",
                defaults["required_login_for_batch_mode"],
            )
        ),
        "planner_manager_usernames": sorted(set(manager_usernames)),
    }


def _normalize_mail_config(raw_mail, defaults: dict | None = None) -> dict:
    defaults = defaults or DEFAULT_MAIL_CONFIG
    raw_mail = raw_mail if isinstance(raw_mail, dict) else {}
    raw_to_emails = raw_mail.get("to_emails", defaults.get("to_emails", []))
    to_emails = []
    if isinstance(raw_to_emails, list):
        to_emails = [
            str(email or "").strip()
            for email in raw_to_emails
            if str(email or "").strip()
        ]
    return {
        "enabled": bool(raw_mail.get("enabled", defaults["enabled"])),
        "smtp_host": str(raw_mail.get("smtp_host") or defaults["smtp_host"]).strip(),
        "smtp_port": _normalize_timeout_minutes(
            raw_mail.get("smtp_port", defaults["smtp_port"]),
            defaults["smtp_port"],
        ),
        "username": str(raw_mail.get("username") or defaults["username"]).strip(),
        "password": str(raw_mail.get("password") or defaults["password"]),
        "from_email": str(raw_mail.get("from_email") or defaults["from_email"]).strip(),
        "to_emails": sorted(set(to_emails)),
        "use_tls": bool(raw_mail.get("use_tls", defaults["use_tls"])),
        "use_ssl": bool(raw_mail.get("use_ssl", defaults["use_ssl"])),
        "subject_prefix": str(raw_mail.get("subject_prefix") or defaults["subject_prefix"]).strip(),
    }


def build_default_system_config(*, use_env_seed: bool) -> dict:
    config = {
        "version": DEFAULT_APP_VERSION,
        "server": {
            "host": DEFAULT_HOST,
            "port": DEFAULT_PORT,
        },
        "EnableLogin": False,
        "session_timeout_minutes": DEFAULT_SYSTEM_SESSION_TIMEOUT_MINUTES,
        "admin_session_timeout_minutes": DEFAULT_ADMIN_SESSION_TIMEOUT_MINUTES,
        "admin": {
            "username": DEFAULT_ADMIN_USERNAME,
            "password": DEFAULT_ADMIN_PASSWORD,
        },
        "users": [dict(user) for user in DEFAULT_NORMAL_USERS],
        "debug": {
            "sync_state": False,
        },
        "pagination": {
            "items_per_page": DEFAULT_ITEMS_PER_PAGE,
            "documents_per_page": DEFAULT_DOCUMENTS_PER_PAGE,
        },
        "procurement": _normalize_procurement_config({}),
        "mail": _normalize_mail_config({}),
    }
    if use_env_seed:
        config["server"]["host"] = os.environ.get("APP_HOST", DEFAULT_HOST)
        try:
            config["server"]["port"] = int(os.environ.get("APP_PORT", str(DEFAULT_PORT)))
        except ValueError:
            config["server"]["port"] = DEFAULT_PORT
        config["admin"]["username"] = os.environ.get("MASTER_ADMIN_USERNAME", DEFAULT_ADMIN_USERNAME)
        config["admin"]["password"] = os.environ.get("MASTER_ADMIN_PASSWORD", DEFAULT_ADMIN_PASSWORD)
        config["EnableLogin"] = _parse_env_flag("APP_ENABLE_LOGIN", False)
        config["session_timeout_minutes"] = _normalize_timeout_minutes(
            os.environ.get("APP_SESSION_TIMEOUT_MINUTES", DEFAULT_SYSTEM_SESSION_TIMEOUT_MINUTES),
            DEFAULT_SYSTEM_SESSION_TIMEOUT_MINUTES,
        )
        config["admin_session_timeout_minutes"] = _normalize_timeout_minutes(
            os.environ.get("APP_ADMIN_SESSION_TIMEOUT_MINUTES", DEFAULT_ADMIN_SESSION_TIMEOUT_MINUTES),
            DEFAULT_ADMIN_SESSION_TIMEOUT_MINUTES,
        )
        config["debug"]["sync_state"] = _parse_env_flag("APP_DEBUG_SYNC_STATE", False)
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
        "version": str(raw_config.get("version") or defaults["version"]).strip(),
        "server": {
            "host": str(raw_config.get("server", {}).get("host") or defaults["server"]["host"]).strip(),
            "port": defaults["server"]["port"],
        },
        "EnableLogin": bool(raw_config.get("EnableLogin", defaults["EnableLogin"])),
        "session_timeout_minutes": _normalize_timeout_minutes(
            raw_config.get("session_timeout_minutes", defaults["session_timeout_minutes"]),
            defaults["session_timeout_minutes"],
        ),
        "admin_session_timeout_minutes": _normalize_timeout_minutes(
            raw_config.get("admin_session_timeout_minutes", defaults["admin_session_timeout_minutes"]),
            defaults["admin_session_timeout_minutes"],
        ),
        "admin": {
            "username": str(raw_config.get("admin", {}).get("username") or defaults["admin"]["username"]).strip(),
            "password": str(raw_config.get("admin", {}).get("password") or defaults["admin"]["password"]),
        },
        "users": _normalize_users(raw_config.get("users", defaults["users"])),
        "debug": {
            "sync_state": bool(raw_config.get("debug", {}).get("sync_state", defaults["debug"]["sync_state"])),
        },
        "pagination": {
            "items_per_page": _normalize_page_size(
                raw_config.get("pagination", {}).get("items_per_page", defaults["pagination"]["items_per_page"]),
                defaults["pagination"]["items_per_page"],
            ),
            "documents_per_page": _normalize_page_size(
                raw_config.get("pagination", {}).get("documents_per_page", defaults["pagination"]["documents_per_page"]),
                defaults["pagination"]["documents_per_page"],
            ),
        },
        "procurement": _normalize_procurement_config(
            raw_config.get("procurement", {}),
            defaults["procurement"],
        ),
        "mail": _normalize_mail_config(
            raw_config.get("mail", {}),
            defaults["mail"],
        ),
    }

    try:
        config["server"]["port"] = int(raw_config.get("server", {}).get("port", defaults["server"]["port"]))
    except (TypeError, ValueError):
        config["server"]["port"] = defaults["server"]["port"]

    if not config["server"]["host"]:
        config["server"]["host"] = defaults["server"]["host"]
    if not config["version"]:
        config["version"] = defaults["version"]
    if not config["admin"]["username"]:
        config["admin"]["username"] = defaults["admin"]["username"]
    if not config["admin"]["password"]:
        config["admin"]["password"] = defaults["admin"]["password"]
    if not config["users"]:
        config["users"] = [dict(user) for user in defaults["users"]]

    return config
