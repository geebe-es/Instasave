from __future__ import annotations

from app.models.media import ServiceError
from app.resolvers.instaloader_resolver import InstaloaderResolver
from app.resolvers.ytdlp_resolver import YtDlpResolver
from app.utils.url_validator import parse_instagram_url


class InstagramResolver:
    def __init__(self, instaloader_resolver: InstaloaderResolver, ytdlp_resolver: YtDlpResolver):
        self.instaloader_resolver = instaloader_resolver
        self.ytdlp_resolver = ytdlp_resolver

    def resolve(self, source_url: str, mode: str = "all") -> dict:
        parsed = parse_instagram_url(source_url)
        if parsed.kind == "story":
            # Stories are always resolved anonymously; restricted access is reported,
            # never bypassed.
            return self.instaloader_resolver.resolve_story(parsed.username, parsed.media_id)
        try:
            return self.instaloader_resolver.resolve(parsed.normalized, parsed.code, mode)
        except ServiceError as error:
            # yt-dlp is a video-only fallback. It is never used to circumvent an
            # access restriction and is tried only after a normal media miss.
            if error.code not in {"MEDIA_NOT_FOUND", "SOURCE_UNAVAILABLE"} or parsed.kind != "reel":
                raise
        return self.ytdlp_resolver.resolve(parsed.normalized, parsed.code)
