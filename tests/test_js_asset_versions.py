import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from qltpchay.config import load_system_config
from qltpchay.constants import JS_ASSET_VERSIONS_PATH
from qltpchay.js_asset_versions import JavaScriptAssetVersionManager, hash_line_ending_normalized_bytes


def bump_patch_version(version: str) -> str:
    parts = version.split(".")
    if not parts:
        return "1"
    try:
        parts[-1] = str(int(parts[-1]) + 1)
    except ValueError:
        parts.append("next")
    return ".".join(parts)


class JavaScriptAssetVersionManagerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.static_root = Path(self.temp_dir.name) / "static"
        self.static_root.mkdir(parents=True, exist_ok=True)
        (self.static_root / "app.js").write_text(
            'import { value } from "./modules/value.js";\nconsole.log(value);\n',
            encoding="utf-8",
        )
        (self.static_root / "modules").mkdir(parents=True, exist_ok=True)
        (self.static_root / "modules" / "value.js").write_text(
            "export const value = 1;\n",
            encoding="utf-8",
        )
        self.manifest_path = Path(self.temp_dir.name) / "js_asset_versions.json"

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_ut_jsver_01_versions_increment_per_changed_file_and_reset_when_main_version_changes(self) -> None:
        app_version = str(load_system_config()["version"])
        next_app_version = bump_patch_version(app_version)
        manager = JavaScriptAssetVersionManager(
            static_root=self.static_root,
            manifest_path=self.manifest_path,
            app_version=app_version,
        )

        manifest = manager.refresh_all()
        self.assertEqual(manifest["app_version"], app_version)
        self.assertEqual(manifest["files"]["app.js"]["counter"], 1)
        self.assertEqual(manifest["files"]["modules/value.js"]["counter"], 1)
        self.assertEqual(manager.build_version_label("modules/value.js"), f"{app_version}.1")

        (self.static_root / "modules" / "value.js").write_text(
            "export const value = 2;\n",
            encoding="utf-8",
        )
        manifest = manager.refresh_all()
        self.assertEqual(manifest["files"]["app.js"]["counter"], 1)
        self.assertEqual(manifest["files"]["modules/value.js"]["counter"], 2)
        self.assertEqual(manager.build_version_label("modules/value.js"), f"{app_version}.2")

        next_manager = JavaScriptAssetVersionManager(
            static_root=self.static_root,
            manifest_path=self.manifest_path,
            app_version=next_app_version,
        )
        manifest = next_manager.refresh_all()
        self.assertEqual(manifest["app_version"], next_app_version)
        self.assertEqual(manifest["files"]["app.js"]["counter"], 1)
        self.assertEqual(manifest["files"]["modules/value.js"]["counter"], 1)
        self.assertEqual(next_manager.build_version_label("modules/value.js"), f"{next_app_version}.1")

    def test_ut_jsver_02_index_and_module_imports_receive_version_query(self) -> None:
        app_version = str(load_system_config()["version"])
        manager = JavaScriptAssetVersionManager(
            static_root=self.static_root,
            manifest_path=self.manifest_path,
            app_version=app_version,
        )

        html_text = '<!doctype html><html><body><script type="module" src="/static/app.js"></script></body></html>'
        versioned_html = manager.inject_index_versions(html_text)
        self.assertIn(f'/static/app.js?v={app_version}.1', versioned_html)

        app_source = (self.static_root / "app.js").read_text(encoding="utf-8")
        rewritten_source = manager.rewrite_module_imports("app.js", app_source)
        self.assertIn(f'./modules/value.js?v={app_version}.1', rewritten_source)

        manifest = json.loads(self.manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(manifest["files"]["app.js"]["counter"], 1)
        self.assertEqual(manifest["files"]["modules/value.js"]["counter"], 1)

    def test_ut_jsver_03_manifest_version_matches_system_config_version(self) -> None:
        app_version = str(load_system_config()["version"])
        manifest = json.loads(JS_ASSET_VERSIONS_PATH.read_text(encoding="utf-8"))

        self.assertEqual(manifest["app_version"], app_version)

    def test_ut_jsver_04_line_ending_only_changes_do_not_increment_file_counter(self) -> None:
        app_version = str(load_system_config()["version"])
        manager = JavaScriptAssetVersionManager(
            static_root=self.static_root,
            manifest_path=self.manifest_path,
            app_version=app_version,
        )

        manifest = manager.refresh_all()
        self.assertEqual(manifest["files"]["modules/value.js"]["counter"], 1)

        (self.static_root / "modules" / "value.js").write_bytes(b"export const value = 1;\r\n")
        manifest = manager.refresh_all()
        self.assertEqual(manifest["files"]["modules/value.js"]["counter"], 1)

        (self.static_root / "modules" / "value.js").write_bytes(b"export const value = 2;\r\n")
        manifest = manager.refresh_all()
        self.assertEqual(manifest["files"]["modules/value.js"]["counter"], 2)

    def test_ut_jsver_05_legacy_raw_crlf_hash_migrates_without_incrementing_counter(self) -> None:
        app_version = str(load_system_config()["version"])
        legacy_crlf_content = b"export const value = 1;\r\n"
        lf_content = b"export const value = 1;\n"
        legacy_counter = 5
        (self.static_root / "modules" / "value.js").write_bytes(lf_content)
        self.manifest_path.write_text(
            json.dumps(
                {
                    "app_version": app_version,
                    "files": {
                        "modules/value.js": {
                            "counter": legacy_counter,
                            "sha256": hashlib.sha256(legacy_crlf_content).hexdigest(),
                        }
                    },
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        manager = JavaScriptAssetVersionManager(
            static_root=self.static_root,
            manifest_path=self.manifest_path,
            app_version=app_version,
        )

        manifest = manager.refresh_all()
        self.assertEqual(manifest["files"]["modules/value.js"]["counter"], legacy_counter)
        self.assertEqual(
            manifest["files"]["modules/value.js"]["sha256"],
            hash_line_ending_normalized_bytes(lf_content),
        )
