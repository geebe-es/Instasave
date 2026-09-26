from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from time import monotonic

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse

from app.models.media import ResolveRequest, ServiceError
from app.resolvers.instagram import InstagramResolver
from app.resolvers.instaloader_resolver import InstaloaderResolver
from app.resolvers.ytdlp_resolver import YtDlpResolver
from app.services.cleanup_service import run_cleanup
from app.services.download_service import DownloadStore

ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = ROOT / "downloads"
TTL_SECONDS = int(os.getenv("FILE_TTL_MINUTES", "30")) * 60
MAX_BYTES = int(os.getenv("MAX_DOWNLOAD_MB", "500")) * 1024 * 1024
RESOLVE_TIMEOUT = int(os.getenv("RESOLVE_TIMEOUT", "30"))
RATE_LIMIT_MAX = int(os.getenv("RATE_LIMIT_MAX", "30"))
RATE_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "900"))
STORE = DownloadStore(DOWNLOADS, TTL_SECONDS, MAX_BYTES)
RESOLVER = InstagramResolver(InstaloaderResolver(STORE, RESOLVE_TIMEOUT), YtDlpResolver(STORE, RESOLVE_TIMEOUT))
RATE_LIMIT: dict[str, list[float]] = {}


@asynccontextmanager
async def lifespan(_: FastAPI):
    cleanup_task = asyncio.create_task(run_cleanup(STORE))
    yield
    cleanup_task.cancel()
    with suppress(asyncio.CancelledError):
        await cleanup_task


app = FastAPI(title="InstaSave private resolver", docs_url=None, redoc_url=None, lifespan=lifespan)


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    if request.url.path not in {"/resolve"}:
        return await call_next(request)
    client = request.client.host if request.client else "unknown"
    now = monotonic()
    attempts = [timestamp for timestamp in RATE_LIMIT.get(client, []) if now - timestamp < RATE_WINDOW]
    if len(attempts) >= RATE_LIMIT_MAX:
        return JSONResponse(status_code=429, content={"success": False, "error": {"code": "RATE_LIMITED", "message": "Limite temporário atingido. Tente novamente mais tarde."}})
    RATE_LIMIT[client] = [*attempts, now]
    return await call_next(request)


@app.exception_handler(ServiceError)
async def service_error_handler(_: Request, error: ServiceError):
    return JSONResponse(status_code=error.status_code, content={"success": False, "error": {"code": error.code, "message": error.message}})


@app.post("/resolve")
async def resolve(payload: ResolveRequest):
    # Libraries are synchronous; run them off the event loop and cap the whole
    # resolution operation. No retries, cookies, or authentication are used.
    try:
        result = await asyncio.wait_for(asyncio.to_thread(RESOLVER.resolve, payload.url), timeout=RESOLVE_TIMEOUT)
    except TimeoutError as error:
        raise ServiceError("RESOLVE_TIMEOUT", "A análise da publicação demorou demais. Tente novamente.", 504) from error
    return {"success": True, **result}


@app.get("/download/{media_id}")
async def download(media_id: str):
    stored = STORE.get(media_id)
    if not stored:
        raise ServiceError("DOWNLOAD_EXPIRED", "Este arquivo temporário expirou. Analise a publicação novamente.", 404)
    return FileResponse(stored.path, media_type=stored.media_type, filename=stored.filename, content_disposition_type="attachment")


@app.get("/preview/{media_id}")
async def preview(media_id: str):
    """Serve the validated temporary file inline for a small UI preview."""
    stored = STORE.get(media_id)
    if not stored:
        raise ServiceError("DOWNLOAD_EXPIRED", "Esta prévia expirou. Analise a publicação novamente.", 404)
    return FileResponse(stored.path, media_type=stored.media_type)
