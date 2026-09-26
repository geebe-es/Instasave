from __future__ import annotations

import re
from urllib.parse import urlparse, urlunparse

from app.models.media import ServiceError

ROUTE = re.compile(r"^/(?:p|reel|reels)/([A-Za-z0-9_-]{5,80})/?$", re.IGNORECASE)


def validate_instagram_url(value: str) -> tuple[str, str]:
    parsed = urlparse(value.strip())
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port:
        raise ServiceError("LINK_INVALID", "Insira um link HTTPS válido do Instagram.")
    hostname = (parsed.hostname or "").lower().rstrip(".")
    match = ROUTE.fullmatch(parsed.path)
    if hostname not in {"instagram.com", "www.instagram.com"} or not match:
        raise ServiceError("LINK_INVALID", "Insira um link válido de publicação, Reel ou carrossel do Instagram.")
    return urlunparse(("https", "www.instagram.com", parsed.path.rstrip("/") + "/", "", "", "")), match.group(1)
