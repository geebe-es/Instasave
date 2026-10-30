from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

import instaloader

from app.models.media import ServiceError
from app.services.download_service import DownloadStore
from app.services.image_service import convert_to_png
from app.utils.filename import media_filename

LOGGER = logging.getLogger(__name__)


class InstaloaderResolver:
    """Anonymous resolver. It never loads a session, cookie, or credentials."""

    def __init__(self, store: DownloadStore, timeout_seconds: int):
        self.store = store
        self.loader = instaloader.Instaloader(
            download_pictures=False, download_videos=False, download_video_thumbnails=False,
            save_metadata=False, compress_json=False, quiet=True, max_connection_attempts=1,
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
        if not is_video:
            destination, width, height = convert_to_png(destination)
            extension = "png"
        filename = media_filename(shortcode, position, extension)
        stored = self.store.register(media_id, destination, filename, width, height)
        item = {
            "id": stored.id,
            "type": "video" if is_video else "image",
            "width": width,
            "height": height,
            "format": extension,
            "filename": filename,
            "downloadEndpoint": f"/download/{stored.id}",
        }
        if is_video:
            # Metadata only: duration in seconds and an optional poster image
            # (both come from the Instagram record itself, no additional format).
            duration = getattr(source, "video_duration", None)
            if isinstance(duration, (int, float)) and duration > 0:
                item["duration"] = round(float(duration), 2)
            item["thumbnailId"] = self._save_thumbnail(source, shortcode, position)
        return item

    def _save_thumbnail(self, source: object, shortcode: str, position: int) -> str | None:
        """Optional poster image for video previews; failures never block the video."""
        poster = getattr(source, "display_url", None)
        if not poster:
            return None
        media_id, destination = self.store.reserve_path("jpg")
        try:
            self._download_public_url(str(poster), destination)
            self.store.register(media_id, destination, media_filename(shortcode, position, "jpg"))
            return media_id
        except ServiceError:
            destination.unlink(missing_ok=True)
            return None

    def resolve(self, normalized_url: str, shortcode: str, mode: str = "all") -> dict:
        try:
            LOGGER.info("[Instaloader] shortcode=%s mode=%s", shortcode, mode)
            post = instaloader.Post.from_shortcode(self.loader.context, shortcode)
            typename = post.typename
            if typename == "GraphImage":
                if mode == "video":
                    raise ServiceError("NO_VIDEO", "Esta publicação contém apenas imagens. Use o menu de imagens.", 404)
                return {"type": "image", "media": [self._save_item(post, shortcode, 1, False)]}
            if typename == "GraphVideo":
                return {"type": "video", "media": [self._save_item(post, shortcode, 1, True)]}
            if typename == "GraphSidecar":
                nodes = list(post.get_sidecar_nodes())
                total_nodes = len(nodes)
                if mode == "video":
                    selected = [(index, node) for index, node in enumerate(nodes, 1) if getattr(node, "is_video", False)]
                else:
                    selected = [(index, node) for index, node in enumerate(nodes, 1)]
                media = [self._save_item(node, shortcode, index, bool(getattr(node, "is_video", False))) for index, node in selected]
                if not media:
                    if mode == "video":
                        raise ServiceError("NO_VIDEO", "O carrossel não contém vídeos. Ele também está disponível no menu de imagens.", 404)
                    raise ServiceError("MEDIA_NOT_FOUND", "O carrossel não contém mídias disponíveis.", 404)
                result = {"type": "carousel", "media": media}
                if mode == "video":
                    # Lets the UI report that the carousel also contains images.
                    result["totalMedia"] = total_nodes
                return result
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

    def resolve_story(self, username: str, media_id: str) -> dict:
        """Anonymous-only story lookup. It never uses sessions, cookies or bypasses."""
        label = f"{username}_{media_id[-6:]}" if media_id.isdigit() else username
        try:
            LOGGER.info("[Instaloader] story=%s media=%s", username, media_id)
            story = instaloader.StoryItem.from_mediaid(self.loader.context, int(media_id))
        except ServiceError:
            raise
        except instaloader.exceptions.ProfileNotExistsException as error:
            raise ServiceError("STORY_UNAVAILABLE", "A conta deste story não está disponível.", 404) from error
        except Exception as error:
            message = str(error).lower()
            if any(term in message for term in ("login", "challenge", "checkpoint", "private", "forbidden", "401", "403")):
                # Anonymous story access is typically refused by Instagram.
                raise ServiceError(
                    "STORY_ACCESS_RESTRICTED",
                    "O Instagram só disponibiliza stories para contas conectadas e autorizadas. O InstaSave não contorna controles de acesso.",
                    403,
                ) from error
            if "429" in message or "rate" in message:
                raise ServiceError("RATE_LIMITED", "O Instagram limitou temporariamente novas consultas. Tente mais tarde.", 429) from error
            raise ServiceError("STORY_UNAVAILABLE", "Este story não está mais disponível ou expirou.", 404) from error
        if not getattr(story, "is_video", False):
            raise ServiceError("NO_VIDEO", "Este story não contém vídeo. Ele também está disponível no menu de imagens.", 404)
        return {"type": "story", "media": [self._save_item(story, label, 1, True)]}
