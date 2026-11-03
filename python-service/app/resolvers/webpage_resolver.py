"""Anonymous webpage fallback.

When the anonymous JSON API refuses to serve public media, this resolver reads
the public post page the same way yt-dlp does: no cookies, no session, no
credentials. It downloads only the media files Instagram itself serves to that
page, in the largest version offered, and never accesses restricted content.
"""
from __future__ import annotations

import logging
from pathlib import Path
from urllib.parse import urlparse

import requests
import yt_dlp

from app.models.media import ServiceError
from app.services.download_service import DownloadStore
from app.services.image_service import convert_to_png
from app.utils.filename import media_filename

LOGGER = logging.getLogger(__name__)

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.instagram.com/",
}


class WebpageResolver:
    """Fallback that must remain completely anonymous, like the primary resolver."""

    def __init__(self, store: DownloadStore, timeout_seconds: int):
        self.store = store
        self.timeout_seconds = timeout_seconds

    @staticmethod
    def _options() -> dict:
        # Same anonymous approach as yt-dlp: parse the public webpage only.
        return {
            "quiet": True, "no_warnings": True, "noplaylist": False,
            "socket_timeout": 30, "retries": 0,
            "ignore_no_formats_error": True,
        }

    # --- media selection ---------------------------------------------------

    @staticmethod
    def _entry_is_video(entry: dict) -> bool:
        formats = entry.get("formats") or []
        return any(
            item.get("vcodec") not in {None, "none"} and item.get("acodec") not in {None, "none"}
            for item in formats
        )

    @staticmethod
    def _best_video_format(entry: dict) -> dict:
        combined = [
            item for item in entry.get("formats") or []
            if item.get("vcodec") not in {None, "none"} and item.get("acodec") not in {None, "none"}
        ]
        return max(combined, key=lambda item: ((item.get("width") or 0) * (item.get("height") or 0), item.get("filesize") or 0))

    def _image_candidate_urls(self, entry: dict) -> list[str]:
        urls: list[str] = []
        seen: set[str] = set()
        for thumbnail in entry.get("thumbnails") or []:
            url = thumbnail.get("url") if isinstance(thumbnail, dict) else thumbnail
            if isinstance(url, str) and url and url not in seen:
                seen.add(url)
                urls.append(url)
        return urls

    def _content_length(self, url: str) -> int | None:
        try:
            response = requests.head(url, headers=BROWSER_HEADERS, timeout=(10, self.timeout_seconds), allow_redirects=False)
            if response.status_code != 200:
                # Some CDNs answer HEAD with an error; only the headers matter here.
                response.close()
                response = requests.get(url, headers=BROWSER_HEADERS, timeout=(10, self.timeout_seconds), stream=True)
            length = response.headers.get("Content-Length")
            status = response.status_code
            response.close()
            return int(length) if status == 200 and length else None
        except (requests.RequestException, ValueError):
            return None

    def _best_image_url(self, entry: dict) -> str:
        # Pick the largest asset: Content-Length mirrors pixel dimensions here.
        best_url, best_length = None, -1
        for url in self._image_candidate_urls(entry):
            length = self._content_length(url)
            if length is not None and length > best_length:
                best_length, best_url = length, url
        return best_url

    # --- transfers ----------------------------------------------------------

    def _download(self, url: str, destination: Path) -> None:
        try:
            response = requests.get(url, headers=BROWSER_HEADERS, timeout=(10, self.timeout_seconds), stream=True)
        except requests.RequestException as error:
            raise ServiceError("SOURCE_UNAVAILABLE", "Não foi possível obter a mídia pública no momento.", 503) from error
        expected = response.headers.get("Content-Length")
        if expected and self.store.max_bytes > 0 and int(expected) > self.store.max_bytes:
            response.close()
            raise ServiceError("FILE_TOO_LARGE", "O arquivo excede o tamanho máximo permitido.", 413)
        written = 0
        try:
            with destination.open("xb") as output:
                for chunk in response.iter_content(chunk_size=64 * 1024):
                    if not chunk:
                        continue
                    written += len(chunk)
                    if self.store.max_bytes > 0 and written > self.store.max_bytes:
                        raise ServiceError("FILE_TOO_LARGE", "O arquivo excede o tamanho máximo permitido.", 413)
                    output.write(chunk)
        except Exception:
            destination.unlink(missing_ok=True)
            raise
        finally:
            response.close()
        if written == 0:
            destination.unlink(missing_ok=True)
            raise ServiceError("DOWNLOAD_FAILED", "A transferência da mídia foi interrompida.", 502)

    @staticmethod
    def _extension(url: str, default: str) -> str:
        extension = Path(urlparse(url).path).suffix.lstrip(".").lower()
        files = {"jpeg": "jpg"}
        extension = files.get(extension, extension)
        return extension if extension in {"jpg", "png", "mp4"} else default

    # --- items ---------------------------------------------------------------

    def _save_image(self, entry: dict, shortcode: str, position: int) -> dict:
        best_url = self._best_image_url(entry)
        if not best_url:
            raise ServiceError("MEDIA_NOT_FOUND", "A fonte não forneceu uma mídia completa para este item.", 404)
        extension = self._extension(best_url, "jpg")
        media_id, destination = self.store.reserve_path(extension)
        self._download(best_url, destination)
        destination, width, height = convert_to_png(destination)
        filename = media_filename(shortcode, position, "png")
        stored = self.store.register(media_id, destination, filename, width, height)
        return {
            "id": stored.id,
            "type": "image",
            "width": width,
            "height": height,
            "format": "png",
            "filename": filename,
            "downloadEndpoint": f"/download/{stored.id}",
        }

    def _save_poster(self, entry: dict, shortcode: str, position: int) -> str | None:
        """Optional poster for video previews; failures never block the video."""
        urls = self._image_candidate_urls(entry)
        if not urls:
            return None
        media_id, destination = self.store.reserve_path("jpg")
        try:
            self._download(urls[0], destination)
            self.store.register(media_id, destination, media_filename(shortcode, position, "jpg"))
            return media_id
        except ServiceError:
            destination.unlink(missing_ok=True)
            return None

    def _save_video(self, entry: dict, shortcode: str, position: int) -> dict:
        selected = self._best_video_format(entry)
        source_url = selected.get("url")
        if not source_url:
            raise ServiceError("MEDIA_NOT_FOUND", "A fonte não forneceu uma mídia completa para este item.", 404)
        extension = self._extension(source_url, "mp4")
        media_id, destination = self.store.reserve_path(extension)
        self._download(source_url, destination)
        filename = media_filename(shortcode, position, extension)
        width = selected.get("width")
        height = selected.get("height")
        stored = self.store.register(media_id, destination, filename, width, height)
        item = {
            "id": stored.id,
            "type": "video",
            "width": width,
            "height": height,
            "format": extension,
            "filename": filename,
            "downloadEndpoint": f"/download/{stored.id}",
        }
        duration = entry.get("duration")
        if isinstance(duration, (int, float)) and duration > 0:
            item["duration"] = round(float(duration), 2)
        item["thumbnailId"] = self._save_poster(entry, shortcode, position)
        return item

    # --- object model ---------------------------------------------------------

    def _save_entry(self, entry: dict, shortcode: str, position: int) -> dict:
        if self._entry_is_video(entry):
            return self._save_video(entry, shortcode, position)
        return self._save_image(entry, shortcode, position)

    # --- public API -----------------------------------------------------------

    def resolve(self, normalized_url: str, shortcode: str, mode: str = "all") -> dict:
        try:
            LOGGER.info("[webpage] shortcode=%s mode=%s", shortcode, mode)
            with yt_dlp.YoutubeDL(self._options()) as ydl:
                info = ydl.extract_info(normalized_url, download=False)
        except ServiceError:
            raise
        except Exception as error:
            message = str(error).lower()
            if any(term in message for term in ("login", "challenge", "checkpoint", "private", "forbidden", "401", "403", "myaccount", "sign in")):
                raise ServiceError("SOURCE_ACCESS_RESTRICTED", "O Instagram não disponibilizou esta mídia publicamente para o servidor.", 403) from error
            if "429" in message or "rate" in message:
                raise ServiceError("RATE_LIMITED", "O Instagram limitou temporariamente novas consultas. Tente mais tarde.", 429) from error
            raise ServiceError("SOURCE_UNAVAILABLE", "Não foi possível obter a mídia pública no momento.", 503) from error
        if not info:
            raise ServiceError("SOURCE_UNAVAILABLE", "O Instagram não retornou dados para esta publicação.", 503)
        if isinstance(info, list):
            entries = [item for item in info if isinstance(item, dict)]
        elif info.get("_type") == "playlist":
            entries = [item for item in info.get("entries") or [] if isinstance(item, dict)]
        else:
            entries = [info]
        if not entries:
            raise ServiceError("SOURCE_UNAVAILABLE", "O Instagram não retornou dados para esta publicação.", 503)

        total_nodes = len(entries)
        selected_entries = [(index, entry) for index, entry in enumerate(entries, 1)]
        if mode == "video":
            selected_entries = [(index, entry) for index, entry in selected_entries if self._entry_is_video(entry)]
            if not selected_entries:
                if total_nodes > 1:
                    raise ServiceError("NO_VIDEO", "O carrossel não contém vídeos. Ele também está disponível no menu de imagens.", 404)
                raise ServiceError("NO_VIDEO", "Esta publicação contém apenas imagens. Use o menu de imagens.", 404)
        media = [self._save_entry(entry, shortcode, index) for index, entry in selected_entries]
        if not media:
            raise ServiceError("MEDIA_NOT_FOUND", "O carrossel não contém mídias disponíveis.", 404)
        if total_nodes > 1:
            result = {"type": "carousel", "media": media}
            # Lets the UI report that the carousel also contains images.
            if mode == "video":
                result["totalMedia"] = total_nodes
            return result
        item = media[0].copy()
        return {"type": item.pop("type"), "media": [item]}
