import hashlib
import json
import re
from pathlib import Path, PurePosixPath


FROM_SPECIFIER_RE = re.compile(
    r'(?P<prefix>\bfrom\s*)(?P<quote>["\'])(?P<specifier>(?:\./|\.\./|/static/)[^"\']+?\.js)(?P=quote)'
)
BARE_IMPORT_SPECIFIER_RE = re.compile(
    r'(?P<prefix>\bimport\s+)(?P<quote>["\'])(?P<specifier>(?:\./|\.\./|/static/)[^"\']+?\.js)(?P=quote)'
)
DYNAMIC_IMPORT_SPECIFIER_RE = re.compile(
    r'(?P<prefix>\bimport\s*\(\s*)(?P<quote>["\'])(?P<specifier>(?:\./|\.\./|/static/)[^"\']+?\.js)(?P=quote)'
)
INDEX_MODULE_SCRIPT_RE = re.compile(
    r'(?P<prefix><script[^>]*\btype=["\']module["\'][^>]*\bsrc=["\'])/static/app\.js(?P<suffix>["\'][^>]*></script>)',
    re.IGNORECASE,
)


def hash_line_ending_normalized_bytes(content: bytes) -> str:
    normalized = content.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
    return hashlib.sha256(normalized).hexdigest()


def build_legacy_line_ending_digest_candidates(content: bytes) -> set[str]:
    normalized = content.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
    return {
        hashlib.sha256(content).hexdigest(),
        hashlib.sha256(normalized).hexdigest(),
        hashlib.sha256(normalized.replace(b"\n", b"\r\n")).hexdigest(),
    }


class JavaScriptAssetVersionManager:
    def __init__(self, *, static_root: Path, manifest_path: Path, app_version: str) -> None:
        self.static_root = Path(static_root).resolve()
        self.manifest_path = Path(manifest_path)
        self.app_version = str(app_version or "").strip()

    def refresh_all(self) -> dict:
        manifest = self._load_manifest()
        dirty = self._reset_for_app_version(manifest)
        current_files: set[str] = set()
        for asset_path in sorted(self.static_root.rglob("*.js")):
            relative_path = asset_path.resolve().relative_to(self.static_root).as_posix()
            current_files.add(relative_path)
            if self._sync_file_record(manifest, relative_path):
                dirty = True

        stale_paths = [relative_path for relative_path in manifest["files"] if relative_path not in current_files]
        for relative_path in stale_paths:
            manifest["files"].pop(relative_path, None)
            dirty = True

        if dirty:
            self._save_manifest(manifest)
        return manifest

    def build_version_label(self, relative_path: str) -> str:
        manifest = self.refresh_all()
        return self._build_version_label_from_manifest(manifest, relative_path)

    def build_versioned_static_url(self, relative_path: str) -> str:
        normalized = self._normalize_relative_path(relative_path)
        return f"/static/{normalized}?v={self.build_version_label(normalized)}"

    def inject_index_versions(self, html_text: str) -> str:
        versioned_url = self.build_versioned_static_url("app.js")
        return INDEX_MODULE_SCRIPT_RE.sub(
            lambda match: f"{match.group('prefix')}{versioned_url}{match.group('suffix')}",
            html_text,
            count=1,
        )

    def rewrite_module_imports(self, relative_path: str, source_text: str) -> str:
        current_path = PurePosixPath(self._normalize_relative_path(relative_path))
        manifest = self.refresh_all()

        def replace(match: re.Match[str]) -> str:
            specifier = match.group("specifier")
            resolved = self._resolve_specifier(current_path, specifier)
            if not resolved:
                return match.group(0)
            versioned_specifier = self._append_version_query(
                specifier,
                self._build_version_label_from_manifest(manifest, resolved),
            )
            return f"{match.group('prefix')}{match.group('quote')}{versioned_specifier}{match.group('quote')}"

        rewritten = FROM_SPECIFIER_RE.sub(replace, source_text)
        rewritten = BARE_IMPORT_SPECIFIER_RE.sub(replace, rewritten)
        rewritten = DYNAMIC_IMPORT_SPECIFIER_RE.sub(replace, rewritten)
        return rewritten

    def _build_version_label_from_manifest(self, manifest: dict, relative_path: str) -> str:
        normalized = self._normalize_relative_path(relative_path)
        record = manifest["files"].get(normalized)
        counter = int((record or {}).get("counter") or 1)
        return f"{self.app_version}.{counter}"

    def _resolve_specifier(self, current_path: PurePosixPath, specifier: str) -> str | None:
        clean_specifier = specifier.split("?", 1)[0]
        if clean_specifier.startswith("/static/"):
            candidate = PurePosixPath(clean_specifier.removeprefix("/static/"))
        else:
            candidate = current_path.parent.joinpath(clean_specifier)
        normalized = self._normalize_relative_path(candidate.as_posix())
        try:
            resolved_path = (self.static_root / normalized).resolve()
        except OSError:
            return None
        if self.static_root not in resolved_path.parents and resolved_path != self.static_root:
            return None
        if not resolved_path.is_file() or resolved_path.suffix != ".js":
            return None
        return normalized

    @staticmethod
    def _append_version_query(specifier: str, version_label: str) -> str:
        separator = "&" if "?" in specifier else "?"
        return f"{specifier}{separator}v={version_label}"

    @staticmethod
    def _normalize_relative_path(relative_path: str) -> str:
        candidate = PurePosixPath(str(relative_path).replace("\\", "/"))
        parts = []
        for part in candidate.parts:
            if part in ("", "."):
                continue
            if part == "..":
                if parts:
                    parts.pop()
                continue
            parts.append(part)
        return PurePosixPath(*parts).as_posix()

    def _load_manifest(self) -> dict:
        if not self.manifest_path.exists():
            return {"app_version": self.app_version, "files": {}}
        try:
            payload = json.loads(self.manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {"app_version": self.app_version, "files": {}}
        files = payload.get("files", {})
        if not isinstance(files, dict):
            files = {}
        return {
            "app_version": str(payload.get("app_version") or "").strip(),
            "files": files,
        }

    def _save_manifest(self, manifest: dict) -> None:
        self.manifest_path.parent.mkdir(parents=True, exist_ok=True)
        self.manifest_path.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )

    def _reset_for_app_version(self, manifest: dict) -> bool:
        if manifest.get("app_version") == self.app_version:
            return False
        manifest["app_version"] = self.app_version
        manifest["files"] = {}
        return True

    def _sync_file_record(self, manifest: dict, relative_path: str) -> bool:
        normalized = self._normalize_relative_path(relative_path)
        absolute_path = (self.static_root / normalized).resolve()
        if not absolute_path.is_file():
            return False
        file_content = absolute_path.read_bytes()
        digest = hash_line_ending_normalized_bytes(file_content)
        record = manifest["files"].get(normalized)
        if isinstance(record, dict):
            current_digest = record.get("sha256")
            if current_digest == digest:
                return False
            if current_digest in build_legacy_line_ending_digest_candidates(file_content):
                record["sha256"] = digest
                return True
        next_counter = 1
        if isinstance(record, dict):
            try:
                next_counter = max(1, int(record.get("counter", 0)) + 1)
            except (TypeError, ValueError):
                next_counter = 1
        manifest["files"][normalized] = {
            "counter": next_counter,
            "sha256": digest,
        }
        return True
