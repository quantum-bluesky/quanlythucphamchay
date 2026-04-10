import secrets
from datetime import datetime, timezone


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


class SessionManager:
    def __init__(self, *, admin: dict, users: list[dict] | None = None):
        self.admin_username = str(admin.get("username") or "").strip()
        self.admin_password = str(admin.get("password") or "")
        self._users = [
            {
                "username": str(user.get("username") or "").strip(),
                "password": str(user.get("password") or ""),
                "role": "user",
            }
            for user in (users or [])
            if str(user.get("username") or "").strip()
        ]
        self._sessions: dict[str, dict[str, str]] = {}

    def _build_session_payload(self, *, username: str, role: str) -> dict[str, str]:
        return {
            "username": username,
            "role": role,
            "started_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }

    def _find_user(self, username: str) -> dict | None:
        clean_username = str(username or "").strip()
        if clean_username == self.admin_username:
            return {
                "username": self.admin_username,
                "password": self.admin_password,
                "role": "admin",
            }
        for user in self._users:
            if user["username"] == clean_username:
                return dict(user)
        return None

    def login(self, username: str, password: str, *, require_admin: bool = False) -> dict[str, str]:
        user = self._find_user(username)
        if not user or str(user.get("password") or "") != str(password or ""):
            raise ValueError("Sai tài khoản hoặc mật khẩu.")
        if require_admin and user["role"] != "admin":
            raise ValueError("Tài khoản này không có quyền Master Admin.")

        token = secrets.token_urlsafe(32)
        session = self._build_session_payload(username=user["username"], role=user["role"])
        self._sessions[token] = session
        return {
            "token": token,
            **session,
        }

    def logout(self, token: str | None) -> None:
        if token:
            self._sessions.pop(token, None)

    def get_session(self, token: str | None) -> dict | None:
        if not token:
            return None
        session = self._sessions.get(token)
        if not session:
            return None
        return dict(session)

    def get_username(self, token: str | None) -> str | None:
        session = self.get_session(token)
        return str(session.get("username") or "") if session else None

    def get_role(self, token: str | None) -> str | None:
        session = self.get_session(token)
        return str(session.get("role") or "") if session else None

    def is_admin(self, token: str | None) -> bool:
        return self.get_role(token) == "admin"


class AdminSessionManager(SessionManager):
    def __init__(self, username: str, password: str, users: list[dict] | None = None):
        super().__init__(
            admin={"username": username, "password": password},
            users=users,
        )
