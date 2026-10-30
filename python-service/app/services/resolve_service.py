"""Bounded, disposable workers: a deadline terminates network I/O as well as waiting."""
from __future__ import annotations

import asyncio
import json
import multiprocessing
import os
import shutil
import tempfile
import threading
from multiprocessing.connection import wait
from pathlib import Path

from app.models.media import ServiceError
from app.services.download_service import DownloadStore
from app.utils.url_validator import parse_instagram_url


def resolve_worker(url: str, directory: str, ttl: int, max_bytes: int, timeout: int, mode: str = "all") -> None:
    parent = multiprocessing.parent_process()
    if parent is not None:
        def watch_parent():
            wait([parent.sentinel])
            os._exit(0)
        threading.Thread(target=watch_parent, daemon=True).start()
    from app.resolvers.instagram import InstagramResolver
    from app.resolvers.instaloader_resolver import InstaloaderResolver
    from app.resolvers.ytdlp_resolver import YtDlpResolver

    store = DownloadStore(Path(directory), ttl, max_bytes)
    resolver = InstagramResolver(InstaloaderResolver(store, timeout), YtDlpResolver(store, timeout))
    try:
        result = {"result": resolver.resolve(url, mode)}
    except ServiceError as error:
        result = {"error": {"code": error.code, "message": error.message, "status": error.status_code}}
    except Exception:
        result = {"error": {"code": "SOURCE_UNAVAILABLE", "message": "Não foi possível obter a mídia pública no momento.", "status": 503}}
    (Path(directory) / "result.json").write_text(json.dumps(result), encoding="utf-8")


class ResolveService:
    def __init__(self, store: DownloadStore, timeout: int, max_workers: int = 2):
        self.store, self.timeout, self.max_workers = store, timeout, max_workers
        self.active = 0
        self.context = multiprocessing.get_context("spawn")

    async def resolve(self, url: str, mode: str = "all") -> dict:
        parsed = parse_instagram_url(url)
        url = parsed.normalized
        if self.active >= self.max_workers:
            raise ServiceError("SERVICE_BUSY", "Há análises em andamento. Tente novamente em instantes.", 429)
        self.active += 1
        directory = None
        process = None
        published = []
        succeeded = False
        try:
            directory = Path(tempfile.mkdtemp(prefix="job-", dir=self.store.directory))
            process = self.context.Process(target=resolve_worker, args=(url, str(directory), self.store.ttl_seconds, self.store.max_bytes, self.timeout, mode), daemon=True)
            process.start()
            try:
                async with asyncio.timeout(self.timeout):
                    while process.is_alive():
                        await asyncio.sleep(0.05)
            except TimeoutError as error:
                raise ServiceError("RESOLVE_TIMEOUT", "A análise da publicação demorou demais. Tente novamente.", 504) from error
            process.join()
            result_file = directory / "result.json"
            if process.exitcode != 0 or not result_file.is_file():
                raise ServiceError("SOURCE_UNAVAILABLE", "Não foi possível obter a mídia pública no momento.", 503)
            payload = json.loads(result_file.read_text(encoding="utf-8"))
            if "error" in payload:
                error = payload["error"]
                raise ServiceError(error["code"], error["message"], error["status"])
            result = payload["result"]
            for item in result["media"]:
                source = directory / f'{item["id"]}.{item["format"]}'
                destination = self.store.directory / source.name
                source.replace(destination)
                published.append((item["id"], destination))
                self.store.register(item["id"], destination, item["filename"], item.get("width"), item.get("height"))
            succeeded = True
            return result
        finally:
            # Reap before removing files or accepting another operation.
            if process is not None and process.pid is not None:
                if process.is_alive():
                    process.kill()
                process.join()
                process.close()
            if not succeeded:
                for media_id, path in published:
                    with self.store.lock:
                        self.store.records.pop(media_id, None)
                    try:
                        path.unlink(missing_ok=True)
                    except OSError:
                        pass  # The periodic orphan sweep retries deletion.
            if directory is not None:
                try:
                    shutil.rmtree(directory)
                except OSError:
                    try:
                        directory.rename(directory.with_name(directory.name.replace("job-", "abandoned-", 1)))
                    except OSError:
                        pass  # Desktop session cleanup also retries on next start.
            self.active -= 1
