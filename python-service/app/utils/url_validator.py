from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse, urlunparse

from app.models.media import ServiceError

ROUTE = re.compile(r"^/(?:p|reel|reels)/([A-Za-z0-9_-]{5,80})/?$", re.IGNORECASE)
STORY_ROUTE = re.compile(r"^/stories/([A-Za-z0-9._]{1,80})/(\d{8,32})/?$", re.IGNORECASE)
HOSTS = {"instagram.com", "www.instagram.com"}


@dataclass(frozen=True)
class SourceRoute:
    """Parsed Instagram link: normalized URL plus the route it came from."""

    kind: str  # 'post' | 'reel' | 'story'
    normalized: str
    code: str  # post shortcode, or 'username:mediaid' for stories
    username: str | None = None
    media_id: str | None = None


def _reject() -> ServiceError:
    return ServiceError(
        "LINK_INVALID",
        "Insira um link válido de publicação, Reel, story ou carrossel do Instagram.",
        422,
    )


def parse_instagram_url(value: str) -> SourceRoute:
    try:
        parsed = urlparse(value.strip())
        invalid_authority = parsed.username or parsed.password or parsed.port is not None
        hostname = (parsed.hostname or "").lower().rstrip(".")
    except ValueError as error:
        raise _reject() from error
    if parsed.scheme != "https" or invalid_authority or hostname not in HOSTS:
        raise _reject()
    match = ROUTE.fullmatch(parsed.path)
    if match:
        route = parsed.path.split("/")[1].lower()
        kind = "reel" if route in {"reel", "reels"} else "post"
        code = match.group(1)
        return SourceRoute(kind, urlunparse(("https", "www.instagram.com", f"/{route}/{code}/", "", "", "")), code)
    story = STORY_ROUTE.fullmatch(parsed.path)
    if story:
        username, media_id = story.group(1), story.group(2)
        return SourceRoute(
            "story",
            urlunparse(("https", "www.instagram.com", f"/stories/{username}/{media_id}/", "", "", "")),
            f"{username}:{media_id}",
            username,
            media_id,
        )
    raise _reject()


def validate_instagram_url(value: str) -> tuple[str, str]:
    """Backward-compatible view: (normalized_url, code) for post/reel links."""
    parsed = parse_instagram_url(value)
    return parsed.normalized, parsed.code
