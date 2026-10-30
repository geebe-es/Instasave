from __future__ import annotations

from pathlib import Path
from pydantic import BaseModel, Field


class ResolveRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2048)
    mode: str = Field(default="all", pattern="^(all|video)$")


class MediaItem(BaseModel):
    id: str
    type: str
    width: int | None = None
    height: int | None = None
    format: str | None = None
    filename: str
    downloadEndpoint: str
    duration: float | None = None
    thumbnailId: str | None = None


class ResolvedMedia(BaseModel):
    type: str
    media: list[MediaItem]


class StoredFile(BaseModel):
    id: str
    path: Path
    filename: str
    media_type: str
    width: int | None = None
    height: int | None = None


class ServiceError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 422):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)
