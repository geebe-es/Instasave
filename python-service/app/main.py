from __future__ import annotations

import asyncio
import logging
import os
import secrets
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse

from app.models.media import ResolveRequest, ServiceError
from app.services.resolve_service import ResolveService
from app.services.cleanup_service import run_cleanup
from app.services.download_service import DownloadStore

ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = Path(os.getenv("INSTASAVE_TEMP_DIR", str(ROOT / "downloads")))
TTL_SECONDS = int(os.getenv("FILE_TTL_MINUTES", "30")) * 60
MAX_BYTES = int(os.getenv("MAX_DOWNLOAD_MB", "500")) * 1024 * 1024
RESOLVE_TIMEOUT = int(os.getenv("RESOLVE_TIMEOUT", "30"))
STORE = DownloadStore(DOWNLOADS, TTL_SECONDS, MAX_BYTES)
RESOLVER = ResolveService(STORE, RESOLVE_TIMEOUT)


@asynccontextmanager
async def lifespan(_: FastAPI):
    cleanup_task = asyncio.create_task(run_cleanup(STORE))
    yield
    cleanup_task.cancel()
    with suppress(asyncio.CancelledError):
        await cleanup_task


app = FastAPI(title="InstaSave private resolver", docs_url=None, redoc_url=None, lifespan=lifespan)


@app.middleware("http")
async def desktop_auth(request: Request, call_next):
    token = os.getenv("INSTASAVE_SERVICE_TOKEN")
    if token and not secrets.compare_digest(request.headers.get("x-instasave-token", ""), token):
        return JSONResponse(status_code=403, content={"error": "Forbidden"})
    return await call_next(request)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/shutdown")
async def shutdown():
    if not os.getenv("INSTASAVE_SERVICE_TOKEN") or not hasattr(app.state, "desktop_server"):
        return JSONResponse(status_code=404, content={"error": "Not found"})
    app.state.desktop_server.should_exit = True
    return {"status": "ok"}


@app.exception_handler(ServiceError)
async def service_error_handler(_: Request, error: ServiceError):
    return JSONResponse(status_code=error.status_code, content={"success": False, "error": {"code": error.code, "message": error.message}})


@app.post("/resolve")
async def resolve(payload: ResolveRequest, request: Request):
    operation = asyncio.create_task(RESOLVER.resolve(payload.url, payload.mode))
    try:
        while not operation.done():
            await asyncio.wait({operation}, timeout=0.1)
            if await request.is_disconnected():
                raise ServiceError("REQUEST_CANCELLED", "A solicitação foi cancelada.", 499)
        return {"success": True, **await operation}
    finally:
        if not operation.done():
            operation.cancel()
        with suppress(asyncio.CancelledError):
            await operation


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
