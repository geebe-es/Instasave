from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import instaloader

from app.models.media import ServiceError
from app.services.download_service import DownloadStore
from app.utils.filename import media_filename

LOGGER = logging.getLogger(__name__)


class InstaloaderResolver:
    """Anonymous resolver. It never loads a session, cookie, or credentials."""

    def __init__(self, store: DownloadStore, timeout_seconds: int):
        self.store = store
        self.loader = instaloader.Instaloader(
            download_pictures=False, download_videos=False, download_video_thumbnails=False,
            save_metadata=False, compress_json=False, quiet=True,
        )
        self.loader.context.request_timeout = timeout_seconds

    @staticmethod
    def _dimensions(item: object) -> tuple[int | None, int | None]:
        dimensions = getattr(item, "dimensions", None)
        if isinstance(dimensions, tuple) and len(dimensions) == 2:
            return int(dimensions[0]), int(dimensions[1])
        return None, None

    @staticmethod
    def _extension(url: str, default: str) -> str:
        extension = Path(urlparse(url).path).suffix.lstrip(".").lower()
        return extension if extension in {"jpg", "jpeg", "png", "webp", "mp4"} else default

    def _download_public_url(self, url: str, destination: Path) -> None:
        """Stream bytes returned by Instaloader's public request context unchanged."""
        response = self.loader.context.get_raw(url)
        expected = response.headers.get("Content-Length")
        if expected and int(expected) > self.store.max_bytes:
            response.close()
            raise ServiceError("FILE_TOO_LARGE", "O arquivo excede o tamanho máximo permitido.", 413)
        written = 0
        try:
            with destination.open("xb") as output:
                for chunk in response.iter_content(chunk_size=64 * 1024):
                    if not chunk:
                        continue
                    written += len(chunk)
                    if written > self.store.max_bytes:
                        raise ServiceError("FILE_TOO_LARGE", "O arquivo excede o tamanho máximo permitido.", 413)
                    output.write(chunk)
        except Exception:
            destination.unlink(missing_ok=True)
            raise
        finally:
            response.close()
        if written == 0 or (expected and written != int(expected)):
            destination.unlink(missing_ok=True)
            raise ServiceError("DOWNLOAD_FAILED", "A transferência da mídia foi interrompida.", 502)

    def _save_item(self, source: object, shortcode: str, position: int, is_video: bool) -> dict:
        source_url = getattr(source, "video_url", None) if is_video else getattr(source, "url", None) or getattr(source, "display_url", None)
        if not source_url:
            raise ServiceError("MEDIA_NOT_FOUND", "A fonte não forneceu uma mídia completa para este item.", 404)
        extension = self._extension(str(source_url), "mp4" if is_video else "jpg")
        media_id, destination = self.store.reserve_path(extension)
        self._download_public_url(str(source_url), destination)
        width, height = self._dimensions(source)
        filename = media_filename(shortcode, position, extension)
        stored = self.store.register(media_id, destination, filename, width, height)
        return {"id": stored.id, "type": "video" if is_video else "image", "width": width, "height": height, "format": extension, "filename": filename, "downloadEndpoint": f"/download/{stored.id}"}

    def resolve(self, normalized_url: str, shortcode: str) -> dict:
        try:
            LOGGER.info("[Instaloader] shortcode=%s", shortcode)
            post = instaloader.Post.from_shortcode(self.loader.context, shortcode)
            typename = post.typename
            if typename == "GraphImage":
                return {"type": "image", "media": [self._save_item(post, shortcode, 1, False)]}
            if typename == "GraphVideo":
                return {"type": "video", "media": [self._save_item(post, shortcode, 1, True)]}
            if typename == "GraphSidecar":
                media = [self._save_item(node, shortcode, index, bool(getattr(node, "is_video", False))) for index, node in enumerate(post.get_sidecar_nodes(), 1)]
                if not media:
                    raise ServiceError("MEDIA_NOT_FOUND", "O carrossel não contém mídias disponíveis.", 404)
                return {"type": "carousel", "media": media}
            raise ServiceError("MEDIA_NOT_FOUND", "Este tipo de publicação não é compatível.", 422)
        except ServiceError:
            raise
        except Exception as error:
            message = str(error).lower()
            if any(term in message for term in ("login", "challenge", "checkpoint", "private", "forbidden", "401", "403", "metadata failed")):
                raise ServiceError("SOURCE_ACCESS_RESTRICTED", "O Instagram não disponibilizou esta mídia publicamente para o servidor.", 403) from error
            if "429" in message or "rate" in message:
                raise ServiceError("RATE_LIMITED", "O Instagram limitou temporariamente novas consultas. Tente mais tarde.", 429) from error
            raise ServiceError("SOURCE_UNAVAILABLE", "Não foi possível obter a mídia pública no momento.", 503) from error
