from __future__ import annotations

import asyncio
from contextlib import suppress

from app.services.download_service import DownloadStore


async def run_cleanup(store: DownloadStore) -> None:
    while True:
        await asyncio.sleep(min(max(store.ttl_seconds // 2, 60), 300))
        store.cleanup()
