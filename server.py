"""InstaSave development server — standard-library only.

It intentionally never requests arbitrary user-provided hosts and does not
attempt to bypass Instagram access controls. Connect an authorized public-media
provider by implementing MediaResolver.resolve().
"""
from __future__ import annotations

import json
import mimetypes
import os
import re
import secrets
from dataclasses import asdict, dataclass
from http.client import IncompleteRead
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from html.parser import HTMLParser
from pathlib import Path
from time import monotonic
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse, urlunparse, unquote
from urllib.request import HTTPRedirectHandler, Request, build_opener

ROOT = Path(__file__).parent.resolve()
STATIC = ROOT / "static"
MAX_URL_LENGTH = 2_048
ROUTE = re.compile(r"^/(?:p|reel|reels)/([A-Za-z0-9_-]{5,80})/?$", re.I)
WINDOW_SECONDS, MAX_REQUESTS = 60, 12
RATE_LIMIT: dict[str, list[float]] = {}
DOWNLOADS: dict[str, tuple[float, MediaItem]] = {}
MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024


class ResolveError(Exception):
    def __init__(self, message: str, status: int = 422):
        self.message, self.status = message, status


@dataclass(frozen=True)
class MediaItem:
    id: str
    type: str
    # Never use thumbnail_url as the source of a download. media_url must be a
    # verified full-media URL supplied by a compliant public-media provider.
    media_url: str
    thumbnail_url: str | None = None
    width: int | None = None
    height: int | None = None
    format: str | None = None
    filename: str | None = None


@dataclass(frozen=True)
class ImageCandidate:
    """One full-image candidate returned by an authorized resolver."""
    url: str
    width: int | None = None
    height: int | None = None
    file_size: int | None = None
    mime_type: str | None = None


def select_best_image_candidate(candidates: list[ImageCandidate]) -> ImageCandidate | None:
    """Choose the largest valid full-media candidate, never a thumbnail."""
    valid = [
        item for item in candidates
        if is_public_media_url(item.url)
        and isinstance(item.width, int) and item.width > 0
        and isinstance(item.height, int) and item.height > 0
    ]
    return max(valid, key=lambda item: (item.width * item.height, item.file_size or 0), default=None)


class MediaResolver:
    """Boundary for a compliant provider integration.

    Implementations must only return media explicitly made available to the
    public by the source and must not use credentials, private endpoints,
    CAPTCHA evasion, or protected-content workarounds.
    """
    def resolve(self, normalized_url: str) -> list[MediaItem]:
        raise NotImplementedError


class OpenGraphParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.tags: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "meta":
            return
        attributes = {key.lower(): value for key, value in attrs if value}
        key = attributes.get("property") or attributes.get("name")
        content = attributes.get("content")
        if key and content and key.lower().startswith("og:"):
            self.tags.setdefault(key.lower(), content)


class InstagramRedirectHandler(HTTPRedirectHandler):
    """Only permits canonical redirects remaining on Instagram-owned hosts."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        parsed = urlparse(newurl)
        hostname = (parsed.hostname or "").lower().rstrip(".")
        if parsed.scheme != "https" or hostname not in {"instagram.com", "www.instagram.com"}:
            raise ResolveError("Não foi possível validar o redirecionamento desta publicação.")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def is_public_media_url(value: str) -> bool:
    parsed = urlparse(value)
    hostname = (parsed.hostname or "").lower().rstrip(".")
    return parsed.scheme == "https" and (hostname.endswith(".cdninstagram.com") or hostname.endswith(".fbcdn.net"))


class InstagramOpenGraphResolver(MediaResolver):
    """Reads only metadata that Instagram exposes in a public HTML page."""
    def resolve(self, normalized_url: str) -> list[MediaItem]:
        request = Request(normalized_url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; InstaSave/1.0; +https://localhost)",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        })
        try:
            with build_opener(InstagramRedirectHandler()).open(request, timeout=12) as response:
                body = response.read(1_500_000).decode(response.headers.get_content_charset() or "utf-8", "replace")
        except HTTPError as error:
            if error.code in {401, 403}:
                raise ResolveError("Não foi possível acessar esta publicação. O conteúdo pode ser privado ou indisponível.", 403)
            if error.code == 404:
                raise ResolveError("Essa publicação não está mais disponível.", 404)
            raise ResolveError("Não foi possível processar o link agora. Tente novamente em alguns instantes.", 503)
        except (URLError, TimeoutError):
            raise ResolveError("Não foi possível processar o link agora. Tente novamente em alguns instantes.", 503)

        parser = OpenGraphParser()
        parser.feed(body)
        if not parser.tags.get("og:image") and not parser.tags.get("og:video"):
            # Instagram can return an HTTP 200 login/challenge document instead
            # of the requested public post. Do not treat that document as media
            # and do not attempt to bypass its access controls.
            if "login" in body.lower() or "challenge" in body.lower():
                raise ResolveError("O Instagram não disponibilizou esta publicação para download público no momento. Abra o link no Instagram, confirme que é público e tente novamente mais tarde.", 403)
        # Open Graph intentionally exposes a social-sharing preview, not a
        # guaranteed original file. It can be cropped (especially carousels and
        # portrait posts), so never present it as a high-quality download.
        if parser.tags.get("og:image") or parser.tags.get("og:video"):
            raise ResolveError("O Instagram disponibilizou apenas uma prévia desta publicação. Para evitar baixar uma imagem cortada ou com qualidade reduzida, o arquivo não foi oferecido para download.", 422)
        shortcode = ROUTE.fullmatch(urlparse(normalized_url).path).group(1)  # validated above
        video = parser.tags.get("og:video:secure_url") or parser.tags.get("og:video")
        image = parser.tags.get("og:image:secure_url") or parser.tags.get("og:image")
        width = int(parser.tags["og:image:width"]) if parser.tags.get("og:image:width", "").isdigit() else None
        height = int(parser.tags["og:image:height"]) if parser.tags.get("og:image:height", "").isdigit() else None
        candidates = [("video", video), ("image", image)] if video else [("image", image)]
        media: list[MediaItem] = []
        for kind, link in candidates:
            if link and is_public_media_url(link):
                extension = "mp4" if kind == "video" else "jpg"
                media.append(MediaItem(f"{shortcode}-{kind}", kind, link, None, width, height, extension, f"instagram_{kind}_{shortcode}.{extension}"))
        if not media:
            raise ResolveError("Não encontramos uma mídia disponível para download neste link.", 404)
        return media


resolver = InstagramOpenGraphResolver()


def normalize_instagram_url(value: object) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ResolveError("Insira um link válido do Instagram.")
    value = value.strip()
    if len(value) > MAX_URL_LENGTH:
        raise ResolveError("O link informado é muito longo.")
    try:
        parsed = urlparse(value)
        invalid_authority = parsed.username or parsed.password or parsed.port is not None
        hostname = (parsed.hostname or "").lower().rstrip(".")
    except ValueError as error:
        raise ResolveError("Insira um link válido do Instagram.") from error
    if parsed.scheme not in {"http", "https"} or invalid_authority:
        raise ResolveError("Insira um link válido do Instagram.")
    if hostname not in {"instagram.com", "www.instagram.com"} or not ROUTE.fullmatch(parsed.path):
        raise ResolveError("Esse endereço não parece ser um link válido do Instagram.")
    return urlunparse(("https", "www.instagram.com", parsed.path.rstrip("/") + "/", "", "", ""))


def json_response(handler: SimpleHTTPRequestHandler, status: int, body: dict) -> None:
    payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(payload)))
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("X-Content-Type-Options", "nosniff")
    handler.end_headers()
    handler.wfile.write(payload)


class AppHandler(SimpleHTTPRequestHandler):
    server_version = "InstaSave/1.0"

    def translate_path(self, path: str) -> str:
        clean = unquote(urlparse(path).path).replace("\\", "/")
        base = (ROOT / "assets" if clean.startswith("/assets/") else STATIC).resolve()
        relative = clean.removeprefix("/assets/") if clean.startswith("/assets/") else clean.lstrip("/")
        try:
            target = (base / (relative or "index.html")).resolve()
            target.relative_to(base)
        except (ValueError, OSError):
            # A child of a regular file cannot be served, even if a similarly
            # named directory exists elsewhere in the project.
            return str(Path(__file__) / "forbidden")
        return str(target)

    def end_headers(self) -> None:
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.send_header("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data: https:; connect-src 'self';")
        super().end_headers()

    def do_POST(self) -> None:
        if self.path != "/api/resolve":
            json_response(self, 404, {"success": False, "error": "Rota não encontrada."})
            return
        client = self.client_address[0]
        now = monotonic()
        requests = [t for t in RATE_LIMIT.get(client, []) if now - t < WINDOW_SECONDS]
        if len(requests) >= MAX_REQUESTS:
            json_response(self, 429, {"success": False, "error": "Você atingiu o limite temporário. Aguarde um minuto."})
            return
        RATE_LIMIT[client] = requests + [now]
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 8_192:
                raise ResolveError("Solicitação inválida.", 400)
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            normalized = normalize_instagram_url(data.get("url"))
            media = resolver.resolve(normalized)
            now = monotonic()
            for key, (expires, _) in list(DOWNLOADS.items()):
                if expires <= now:
                    del DOWNLOADS[key]
            public_media = []
            for item in media:
                token = secrets.token_urlsafe(18)
                DOWNLOADS[token] = (now + 300, item)
                item_data = asdict(item)
                # Keep the origin URL private; only the controlled streaming
                # endpoint is exposed to the browser.
                item_data.pop("media_url", None)
                item_data["url"] = f"/api/download/{token}"
                public_media.append(item_data)
            json_response(self, 200, {"success": True, "sourceUrl": normalized, "media": public_media})
        except json.JSONDecodeError:
            json_response(self, 400, {"success": False, "error": "Solicitação inválida."})
        except ResolveError as error:
            json_response(self, error.status, {"success": False, "error": error.message})
        except Exception:
            json_response(self, 500, {"success": False, "error": "Não foi possível processar o link agora. Tente novamente em alguns instantes."})

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path.startswith("/api/download/"):
            self.download(path.removeprefix("/api/download/"))
            return
        super().do_GET()

    def download(self, token: str) -> None:
        # Keep a valid token available until it expires. Browsers, extensions or
        # security scanners can prefetch a link before the user's actual click.
        record = DOWNLOADS.get(token)
        if not record or record[0] <= monotonic():
            json_response(self, 404, {"success": False, "error": "Este link de download expirou. Analise a publicação novamente."})
            return
        item = record[1]
        if not is_public_media_url(item.media_url):
            json_response(self, 400, {"success": False, "error": "Arquivo de mídia inválido."})
            return
        try:
            request = Request(item.media_url, headers={"User-Agent": "Mozilla/5.0 (compatible; InstaSave/1.0)"})
            with build_opener().open(request, timeout=20) as response:
                content_type = response.headers.get_content_type()
                length = response.headers.get("Content-Length")
                if not content_type.startswith(("image/", "video/")) or (length and int(length) > MAX_DOWNLOAD_BYTES):
                    raise ResolveError("O arquivo não está disponível para download.", 413)
                filename = re.sub(r"[^A-Za-z0-9._-]", "_", item.filename or f"instagram_media.{item.format or 'bin'}")
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                if length:
                    self.send_header("Content-Length", length)
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                self.send_header("Cache-Control", "no-store")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.end_headers()
                transferred = 0
                while chunk := response.read(64 * 1024):
                    transferred += len(chunk)
                    self.wfile.write(chunk)
                if length and transferred != int(length):
                    # The declared length makes browsers reject the incomplete
                    # response instead of accepting a silently truncated file.
                    raise IncompleteRead(b"", int(length) - transferred)
        except ResolveError as error:
            json_response(self, error.status, {"success": False, "error": error.message})
        except IncompleteRead:
            # Headers already advertised the expected Content-Length. Closing
            # the response makes the browser report the transfer as failed.
            self.close_connection = True
        except (HTTPError, URLError, TimeoutError):
            json_response(self, 502, {"success": False, "error": "Não foi possível obter este arquivo agora. Tente novamente."})

    def log_message(self, fmt: str, *args: object) -> None:
        print("[InstaSave]", fmt % args)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    print(f"InstaSave em http://localhost:{port}")
    ThreadingHTTPServer(("127.0.0.1", port), AppHandler).serve_forever()
