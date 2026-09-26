from __future__ import annotations

import logging
from pathlib import Path

import yt_dlp

from app.models.media import ServiceError
from app.services.download_service import DownloadStore
from app.utils.filename import media_filename

LOGGER = logging.getLogger(__name__)


class YtDlpResolver:
    """Fallback for public videos/Reels; no cookies or authentication options."""

    def __init__(self, store: DownloadStore, timeout_seconds: int):
        self.store = store
        self.timeout_seconds = timeout_seconds

    @staticmethod
    def _best_combined_format(info: dict) -> dict | None:
        formats = info.get("formats") or []
        combined = [item for item in formats if item.get("vcodec") not in {None, "none"} and item.get("acodec") not in {None, "none"}]
        return max(combined, key=lambda item: ((item.get("width") or 0) * (item.get("height") or 0), item.get("filesize") or item.get("filesize_approx") or 0), default=None)

    def resolve(self, url: str, shortcode: str) -> dict:
        probe_options = {"quiet": True, "no_warnings": True, "noplaylist": True, "socket_timeout": self.timeout_seconds}
        try:
            LOGGER.info("[yt-dlp] shortcode=%s", shortcode)
            with yt_dlp.YoutubeDL(probe_options) as ydl:
                info = ydl.extract_info(url, download=False)
            selected = self._best_combined_format(info)
            if not selected:
                raise ServiceError("MEDIA_NOT_FOUND", "Não há um formato de vídeo completo compatível disponível.", 404)
            extension = selected.get("ext") or "mp4"
            media_id, destination = self.store.reserve_path(extension)
            options = {**probe_options, "format": selected["format_id"], "outtmpl": str(destination.with_suffix(".%(ext)s")), "overwrites": False}
            with yt_dlp.YoutubeDL(options) as ydl:
                ydl.extract_info(url, download=True)
            files = list(destination.parent.glob(f"{media_id}.*"))
            if len(files) != 1:
                raise ServiceError("DOWNLOAD_FAILED", "Não foi possível preparar o vídeo completo.", 502)
            filename = media_filename(shortcode, 1, files[0].suffix.lstrip("."))
            stored = self.store.register(media_id, files[0], filename, selected.get("width"), selected.get("height"))
            return {"type": "video", "media": [{"id": stored.id, "type": "video", "width": stored.width, "height": stored.height, "format": files[0].suffix.lstrip("."), "filename": filename, "downloadEndpoint": f"/download/{stored.id}"}]}
        except ServiceError:
            raise
        except Exception as error:
            message = str(error).lower()
            if any(term in message for term in ("login", "challenge", "checkpoint", "private", "forbidden", "403", "metadata failed")):
                raise ServiceError("SOURCE_ACCESS_RESTRICTED", "O Instagram não disponibilizou este vídeo publicamente para o servidor.", 403) from error
            if "429" in message or "rate" in message:
                raise ServiceError("RATE_LIMITED", "O Instagram limitou temporariamente novas consultas. Tente mais tarde.", 429) from error
            raise ServiceError("SOURCE_UNAVAILABLE", "Não foi possível obter o vídeo público no momento.", 503) from error
