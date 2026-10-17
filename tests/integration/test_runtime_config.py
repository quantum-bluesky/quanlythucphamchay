"""Test-only runtime configuration, independent of development/production JSON."""

import json
import os
from pathlib import Path

from qltpchay.config import build_default_system_config

TEST_RUNTIME_CONFIG_PATH = Path(__file__).with_name("test_runtime_config.json")


def load_test_system_config() -> dict:
    """Return deterministic test settings without reading a runtime config file."""
    test_values = json.loads(TEST_RUNTIME_CONFIG_PATH.read_text(encoding="utf-8"))
    config = build_default_system_config(use_env_seed=False)

    admin_path = str(os.environ.get("TEST_ADMIN_PATH") or test_values["admin_path"]).strip()
    admin_path = "/" + admin_path.strip("/") if admin_path.strip("/") else "/"
    config["admin_path"] = admin_path
    config["admin"] = dict(test_values["admin"])
    config["users"] = [dict(user) for user in test_values["users"]]
    config["EnableLogin"] = bool(test_values["EnableLogin"])
    config["EnableMultiuserConflictCheck"] = bool(test_values["EnableMultiuserConflictCheck"])
    config["EnableAdminLockedEdit"] = bool(test_values["EnableAdminLockedEdit"])
    config["zalo_login"]["mock_test_mode"] = bool(test_values["zalo_mock_test_mode"])
    return config
