import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit


def parse_cookie_header(cookie_header: str | None) -> dict[str, str]:
    cookies: dict[str, str] = {}
    if not cookie_header:
        return cookies
    for part in cookie_header.split(";"):
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        cookies[key.strip()] = value.strip()
    return cookies


def build_port_scoped_cookie_name(base_cookie_name: str, host_header: str | None) -> str:
    clean_base = str(base_cookie_name or "").strip()
    clean_host = str(host_header or "").strip()
    if not clean_base or not clean_host:
        return clean_base
    try:
        parsed = urlsplit(f"//{clean_host}")
    except ValueError:
        return clean_base
    port = parsed.port
    if port is None:
        return clean_base
    return f"{clean_base}_p{port}"


def build_session_cookie_name_candidates(base_cookie_name: str, host_header: str | None) -> list[str]:
    scoped_name = build_port_scoped_cookie_name(base_cookie_name, host_header)
    candidates: list[str] = []
    for name in (scoped_name, str(base_cookie_name or "").strip()):
        if name and name not in candidates:
            candidates.append(name)
    return candidates


class SessionManager:
    MANAGER_PERMISSIONS = {
        "procurement_batch_manage",
        "order_batch_manage",
        "inventory_adjust_manage",
        "document_cancel_approve",
    }

    def __init__(
        self,
        *,
        admin: dict,
        users: list[dict] | None = None,
        user_timeout_minutes: int = 360,
        admin_timeout_minutes: int = 30,
    ):
        self.admin_username = str(admin.get("username") or "").strip()
        self.admin_password = str(admin.get("password") or "")
        try:
            self.user_timeout_minutes = max(1, int(user_timeout_minutes))
        except (TypeError, ValueError):
            self.user_timeout_minutes = 360
        try:
            self.admin_timeout_minutes = max(1, int(admin_timeout_minutes))
        except (TypeError, ValueError):
            self.admin_timeout_minutes = 30
        self._users = [
            {
                "username": str(user.get("username") or "").strip(),
                "password": str(user.get("password") or ""),
                "role": "user",
                "permissions": [
                    str(permission or "").strip()
                    for permission in (user.get("permissions") or [])
                    if str(permission or "").strip()
                ],
            }
            for user in (users or [])
            if str(user.get("username") or "").strip()
        ]
        self._sessions: dict[str, dict[str, str]] = {}

    @staticmethod
    def _utc_now() -> datetime:
        return datetime.now(timezone.utc)

    @classmethod
    def _utc_now_iso(cls) -> str:
        return cls._utc_now().isoformat(timespec="seconds")

    @staticmethod
    def _parse_utc_iso(value: str | None) -> datetime | None:
        clean_value = str(value or "").strip()
        if not clean_value:
            return None
        try:
            parsed = datetime.fromisoformat(clean_value)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

    def _get_timeout_minutes_for_role(self, role: str) -> int:
        return self.admin_timeout_minutes if str(role or "") == "admin" else self.user_timeout_minutes

    def _build_session_payload(self, *, username: str, role: str, permissions: list[str] | None = None) -> dict[str, str | list[str]]:
        now_iso = self._utc_now_iso()
        return {
            "username": username,
            "role": role,
            "permissions": sorted(set(permissions or [])),
            "started_at": now_iso,
            "last_activity_at": now_iso,
        }

    def _find_user(self, username: str) -> dict | None:
        clean_username = str(username or "").strip()
        if clean_username == self.admin_username:
            return {
                "username": self.admin_username,
                "password": self.admin_password,
                "role": "admin",
                "permissions": ["procurement_batch_manage", "document_cancel_approve"],
            }
        for user in self._users:
            if user["username"] == clean_username:
                return dict(user)
        return None

    def _find_username_by_account_type(self, account_type: str) -> str:
        clean_account_type = str(account_type or "").strip().lower().replace("-", "_")
        if clean_account_type in {"admin", "master_admin"}:
            return self.admin_username
        if clean_account_type in {"biz_manager", "manager"}:
            for user in self._users:
                permissions = {str(permission or "").strip() for permission in (user.get("permissions") or [])}
                if user["username"] == "bizmanager" or permissions.intersection(self.MANAGER_PERMISSIONS):
                    return user["username"]
            raise ValueError("Chưa cấu hình tài khoản Biz Manager.")
        if clean_account_type in {"normal_user", "user"}:
            for user in self._users:
                permissions = {str(permission or "").strip() for permission in (user.get("permissions") or [])}
                if user["username"] != "bizmanager" and not permissions.intersection(self.MANAGER_PERMISSIONS):
                    return user["username"]
            raise ValueError("Chưa cấu hình tài khoản user thường.")
        raise ValueError("Loại tài khoản không hợp lệ.")

    def login(self, username: str, password: str, *, require_admin: bool = False) -> dict[str, str]:
        user = self._find_user(username)
        if not user or str(user.get("password") or "") != str(password or ""):
            raise ValueError("Sai tài khoản hoặc mật khẩu.")
        if require_admin and user["role"] != "admin":
            raise ValueError("Tài khoản này không có quyền Master Admin.")

        token = secrets.token_urlsafe(32)
        session = self._build_session_payload(
            username=user["username"],
            role=user["role"],
            permissions=user.get("permissions") or [],
        )
        self._sessions[token] = session
        return {
            "token": token,
            **session,
        }

    def login_by_account_type(self, account_type: str, password: str) -> dict[str, str]:
        username = self._find_username_by_account_type(account_type)
        return self.login(username, password)

    def _is_session_expired(self, session: dict) -> bool:
        role = str(session.get("role") or "")
        timeout_minutes = self._get_timeout_minutes_for_role(role)
        reference_at = self._parse_utc_iso(
            session.get("last_activity_at") or session.get("started_at") or ""
        )
        if reference_at is None:
            return False
        expires_at = reference_at + timedelta(minutes=timeout_minutes)
        return self._utc_now() >= expires_at

    def resolve_session(self, token: str | None, *, touch: bool = True) -> tuple[dict | None, bool]:
        if not token:
            return None, False
        session = self._sessions.get(token)
        if not session:
            return None, False
        if self._is_session_expired(session):
            self._sessions.pop(token, None)
            return None, True
        if touch:
            session["last_activity_at"] = self._utc_now_iso()
        return dict(session), False

    def logout(self, token: str | None) -> None:
        if token:
            self._sessions.pop(token, None)

    def get_session(self, token: str | None, *, touch: bool = True) -> dict | None:
        session, _ = self.resolve_session(token, touch=touch)
        return session

    def get_username(self, token: str | None, *, touch: bool = True) -> str | None:
        session = self.get_session(token, touch=touch)
        return str(session.get("username") or "") if session else None

    def get_role(self, token: str | None, *, touch: bool = True) -> str | None:
        session = self.get_session(token, touch=touch)
        return str(session.get("role") or "") if session else None

    def is_admin(self, token: str | None, *, touch: bool = True) -> bool:
        return self.get_role(token, touch=touch) == "admin"


class AdminSessionManager(SessionManager):
    def __init__(
        self,
        username: str,
        password: str,
        users: list[dict] | None = None,
        *,
        user_timeout_minutes: int = 360,
        admin_timeout_minutes: int = 30,
    ):
        super().__init__(
            admin={"username": username, "password": password},
            users=users,
            user_timeout_minutes=user_timeout_minutes,
            admin_timeout_minutes=admin_timeout_minutes,
        )
