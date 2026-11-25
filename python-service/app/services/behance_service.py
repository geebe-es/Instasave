"""Store publicly available Behance project images as PNG files.

The desktop shell reads the project page with its own Chromium engine (Behance
blocks plain HTTP clients), then sends only the image URLs here. This module
downloads each image in the highest reasonable resolution, converts it to PNG
and registers it in the same temporary store used by the Instagram resolvers.
"""
from __future__ import annotations

import re
from pathlib import Path

import requests

from app.models.media import ServiceError
from app.services.download_service import DownloadStore
from app.services.image_service import convert_to_png
from app.utils.filename import media_filename

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    "Referer": "https://www.behance.net/",
}
ALLOWED_HOSTS = {"mir-s3-cdn-cf.behance.net", "mir-s3-cdn-cf.behance.net.cdn.cloudflare.net"}
VARIANT = re.compile(r"(/project_modules/)([^/]+)/")
VARIANTS = ("max_3840_webp", "fs_webp", "2800_webp", "1400_webp", "source")


def _allowed(url: str) -> bool:
    try:
        parsed = requests.utils.urlparse(url)
    except ValueError:
        return False
    return parsed.scheme == "https" and parsed.hostname in ALLOWED_HOSTS


def _candidates(url: str) -> list[str]:
    ordered: list[str] = []
    if VARIANT.search(url):
        for variant in VARIANTS:
            candidate = VARIANT.sub(lambda match: f"{match.group(1)}{variant}/", url, count=1)
            if candidate not in ordered:
                ordered.append(candidate)
    if url not in ordered:
        ordered.append(url)
    return ordered


def _download(url: str, destination: Path, max_bytes: int) -> Path:
    try:
        response = requests.get(url, headers=BROWSER_HEADERS, timeout=(10, 45), stream=True)
    except requests.RequestException as error:
        raise ServiceError("SOURCE_UNAVAILABLE", "Não foi possível baixar esta imagem do Behance.", 503) from error
    if response.status_code != 200:
        response.close()
        raise ServiceError("MEDIA_NOT_FOUND", "A imagem não está mais disponível.", 404)
    expected = response.headers.get("Content-Length")
    if expected and max_bytes > 0 and int(expected) > max_bytes:
        response.close()
        raise ServiceError("FILE_TOO_LARGE", "O arquivo excede o tamanho máximo permitido.", 413)
    written = 0
    try:
        with destination.open("xb") as output:
            for chunk in response.iter_content(chunk_size=64 * 1024):
                if not chunk:
                    continue
                written += len(chunk)
                if max_bytes > 0 and written > max_bytes:
                    raise ServiceError("FILE_TOO_LARGE", "O arquivo excede o tamanho máximo permitido.", 413)
                output.write(chunk)
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    finally:
        response.close()
    if written == 0:
        destination.unlink(missing_ok=True)
        raise ServiceError("DOWNLOAD_FAILED", "A transferência da imagem foi interrompida.", 502)
    return destination


def _download_best(url: str, store: DownloadStore) -> tuple[str, Path]:
    last_error: ServiceError | None = None
    for candidate in _candidates(url):
        if not _allowed(candidate):
            continue
        media_id, destination = store.reserve_path("webp")
        try:
            return media_id, _download(candidate, destination, store.max_bytes)
        except ServiceError as error:
            destination.unlink(missing_ok=True)
            last_error = error
    raise last_error or ServiceError("MEDIA_NOT_FOUND", "A imagem não está mais disponível.", 404)


def store_project(store: DownloadStore, urls: list[str], project: str) -> dict:
    unique: list[str] = []
    seen: set[str] = set()
    for url in urls:
        if not isinstance(url, str) or not _allowed(url):
            continue
        key = url.rsplit("/", 1)[-1].lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(url)
    if not unique:
        raise ServiceError("MEDIA_NOT_FOUND", "Nenhuma imagem foi encontrada neste projeto.", 404)
    media = []
    for index, url in enumerate(unique[:80], 1):
        try:
            media_id, source = _download_best(url, store)
            destination, width, height = convert_to_png(source)
        except ServiceError:
            continue
        filename = media_filename(project, index, "png", prefix="behance")
        stored = store.register(media_id, destination, filename, width, height)
        media.append({
            "id": stored.id,
            "type": "image",
            "width": width,
            "height": height,
            "format": "png",
            "filename": filename,
            "downloadEndpoint": f"/download/{stored.id}",
        })
    if not media:
        raise ServiceError("MEDIA_NOT_FOUND", "Nenhuma imagem pôde ser baixada deste projeto.", 502)
    return {"type": "behance", "media": media}
