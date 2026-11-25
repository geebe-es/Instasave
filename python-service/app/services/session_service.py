"""Read Instagram cookies exported by the desktop shell.

The desktop app writes a Netscape cookie file after the user signs in through
the embedded login window. Reading it on every resolve keeps the Python service
stateless and lets a login/logout take effect without restarting the service.
"""
from __future__ import annotations

import os
from pathlib import Path

_cache: tuple[float, dict[str, str]] | None = None


def cookie_file() -> Path | None:
    value = os.getenv("INSTASAVE_COOKIE_FILE")
    if not value:
        return None
    path = Path(value)
    return path if path.is_file() else None


def load_cookies() -> dict[str, str]:
    """Return the Instagram cookies from the exported Netscape file."""
    global _cache
    path = cookie_file()
    if path is None:
        _cache = None
        return {}
    try:
        modified = path.stat().st_mtime
    except OSError:
        return {}
    if _cache is not None and _cache[0] == modified:
        return dict(_cache[1])
    cookies: dict[str, str] = {}
    try:
        with path.open("r", encoding="utf-8", errors="replace") as source:
            for line in source:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                fields = line.split("\t")
                if len(fields) < 7 or "instagram.com" not in fields[0].lower():
                    continue
                name, value = fields[5].strip(), fields[6].strip()
                if name:
                    cookies[name] = value
    except OSError:
        return {}
    _cache = (modified, dict(cookies))
    return cookies


def has_session() -> bool:
    return bool(load_cookies().get("sessionid"))
