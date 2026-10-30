from __future__ import annotations

import mimetypes
import os
import threading
import time
import uuid
import shutil
from pathlib import Path

from app.models.media import StoredFile, ServiceError


class DownloadStore:
    def __init__(self, directory: Path, ttl_seconds: int, max_bytes: int):
        self.directory = directory
        self.ttl_seconds = ttl_seconds
        self.max_bytes = max_bytes
        self.records: dict[str, tuple[StoredFile, float]] = {}
        self.lock = threading.Lock()
        self.directory.mkdir(parents=True, exist_ok=True)

    def reserve_path(self, extension: str) -> tuple[str, Path]:
        media_id = str(uuid.uuid4())
        return media_id, self.directory / f"{media_id}.{extension.lstrip('.').lower() or 'bin'}"

    def register(self, media_id: str, path: Path, filename: str, width: int | None = None, height: int | None = None) -> StoredFile:
        if not path.is_file() or path.stat().st_size <= 0:
            raise ServiceError("DOWNLOAD_FAILED", "A fonte não entregou um arquivo completo.", 502)
        if path.stat().st_size > self.max_bytes:
            path.unlink(missing_ok=True)
            raise ServiceError("FILE_TOO_LARGE", "O arquivo excede o tamanho máximo permitido.", 413)
        media_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        stored = StoredFile(id=media_id, path=path, filename=filename, media_type=media_type, width=width, height=height)
        with self.lock:
            self.records[media_id] = (stored, time.time() + self.ttl_seconds)
        return stored

    def get(self, media_id: str) -> StoredFile | None:
        with self.lock:
            record = self.records.get(media_id)
            if not record or record[1] <= time.time() or not record[0].path.is_file():
                return None
            return record[0]

    def cleanup(self) -> int:
        now = time.time()
        removed = 0
        with self.lock:
            expired = [key for key, (_, expires) in self.records.items() if expires <= now]
            for key in expired:
                stored, _ = self.records[key]
                try:
                    stored.path.unlink(missing_ok=True)
                except OSError:
                    continue
                del self.records[key]
                removed += 1
            tracked = {stored.path for stored, _ in self.records.values()}
        for path in self.directory.iterdir():
            try:
                if path in tracked or now - path.stat().st_mtime <= self.ttl_seconds:
                    continue
                if path.is_file():
                    path.unlink(missing_ok=True)
                elif path.is_dir() and path.name.startswith("abandoned-"):
                    shutil.rmtree(path)
            except OSError:
                continue
        return removed
