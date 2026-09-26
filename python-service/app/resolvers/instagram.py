from __future__ import annotations

from app.models.media import ServiceError
from app.resolvers.instaloader_resolver import InstaloaderResolver
from app.resolvers.ytdlp_resolver import YtDlpResolver
from app.utils.url_validator import validate_instagram_url


class InstagramResolver:
    def __init__(self, instaloader_resolver: InstaloaderResolver, ytdlp_resolver: YtDlpResolver):
        self.instaloader_resolver = instaloader_resolver
        self.ytdlp_resolver = ytdlp_resolver

    def resolve(self, source_url: str) -> dict:
        normalized_url, shortcode = validate_instagram_url(source_url)
        try:
            return self.instaloader_resolver.resolve(normalized_url, shortcode)
        except ServiceError as error:
            # yt-dlp is a video-only fallback. It is never used to circumvent an
            # access restriction and is tried only after a normal media miss.
            if error.code not in {"MEDIA_NOT_FOUND", "SOURCE_UNAVAILABLE"} or "/reel/" not in normalized_url:
                raise
        return self.ytdlp_resolver.resolve(normalized_url, shortcode)
