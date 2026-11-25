from __future__ import annotations

import logging
import time

from app.models.media import ServiceError
from app.resolvers.instaloader_resolver import InstaloaderResolver
from app.resolvers.webpage_resolver import WebpageResolver
from app.resolvers.ytdlp_resolver import YtDlpResolver
from app.utils.url_validator import parse_instagram_url

LOGGER = logging.getLogger(__name__)

# Codes for which another anonymous channel may still find the publicly
# available media. A genuinely restricted medium (private/login) also fails on
# those channels, so falling back never bypasses an access control.
_RETRYABLE_CODES = {"MEDIA_NOT_FOUND", "SOURCE_UNAVAILABLE", "SOURCE_ACCESS_RESTRICTED", "RESOLVE_TIMEOUT"}

# A fallback only starts when it still has a realistic chance of finishing
# before the global deadline; otherwise the user gets a fast, clear answer.
_MIN_FALLBACK_SECONDS = 4.0


class InstagramResolver:
    def __init__(self, instaloader_resolver: InstaloaderResolver, ytdlp_resolver: YtDlpResolver, webpage_resolver: WebpageResolver | None = None, budget_seconds: float | None = None):
        self.instaloader_resolver = instaloader_resolver
        self.ytdlp_resolver = ytdlp_resolver
        self.webpage_resolver = webpage_resolver
        self.deadline = time.monotonic() + budget_seconds if budget_seconds else None

    def _remaining(self) -> float:
        return float("inf") if self.deadline is None else self.deadline - time.monotonic()

    def _has_time(self, seconds: float = _MIN_FALLBACK_SECONDS) -> bool:
        return self._remaining() > seconds

    def resolve(self, source_url: str, mode: str = "all") -> dict:
        parsed = parse_instagram_url(source_url)
        if parsed.kind == "story":
            # Stories are always resolved anonymously; restricted access is reported,
            # never bypassed.
            return self.instaloader_resolver.resolve_story(parsed.username, parsed.media_id)
        try:
            return self.instaloader_resolver.resolve(parsed.normalized, parsed.code, mode)
        except ServiceError as error:
            if error.code not in _RETRYABLE_CODES:
                raise
            if not self._has_time():
                raise self._timeout_error(error) from error
            if self.webpage_resolver is not None:
                try:
                    return self.webpage_resolver.resolve(parsed.normalized, parsed.code, mode)
                except ServiceError as fallback_error:
                    LOGGER.info("[resolver] webpage fallback also failed: %s", fallback_error.code)
                    error = fallback_error
            # yt-dlp is a video-only fallback. It is never used to circumvent an
            # access restriction and is tried only after a normal media miss.
            if parsed.kind == "reel" and self._has_time():
                return self.ytdlp_resolver.resolve(parsed.normalized, parsed.code)
            raise

    @staticmethod
    def _timeout_error(previous: ServiceError) -> ServiceError:
        if previous.code in {"SOURCE_ACCESS_RESTRICTED", "RATE_LIMITED"}:
            return previous
        return ServiceError(
            "RESOLVE_TIMEOUT",
            "A análise demorou demais. Verifique sua conexão e tente novamente; se o Instagram exigir login, conecte sua conta em Configurações.",
            504,
        )
