import secrets


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


class AdminSessionManager:
    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password
        self._sessions: dict[str, str] = {}

    def login(self, username: str, password: str) -> str:
        if username != self.username or password != self.password:
            raise ValueError("Sai tài khoản hoặc mật khẩu admin.")
        token = secrets.token_urlsafe(32)
        self._sessions[token] = self.username
        return token

    def logout(self, token: str | None) -> None:
        if token:
            self._sessions.pop(token, None)

    def get_username(self, token: str | None) -> str | None:
        if not token:
            return None
        return self._sessions.get(token)

