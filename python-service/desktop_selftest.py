"""Offline packaging diagnostic. No test endpoints or changes to the resolver."""
import functools
import hashlib
import json
import multiprocessing
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import instaloader
import yt_dlp
from yt_dlp.extractor.instagram import InstagramIE
from app.resolvers.instaloader_resolver import InstaloaderResolver
from app.services.download_service import DownloadStore
from app.services.resolve_service import resolve_worker
from app.services.image_service import convert_to_png
from PIL import Image


def run(fixtures: str):
    source = Path(fixtures).resolve()

    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self, *_):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(source)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"
    try:
        with tempfile.TemporaryDirectory(prefix="instasave-diagnostic-") as temp:
            store = DownloadStore(Path(temp), 60, 10 * 1024 * 1024)
            resolver = InstaloaderResolver(store, 10)
            image = Path(temp) / "image.png"
            resolver._download_public_url(f"{base}/image.png", image)
            assert image.read_bytes() == (source / "image.png").read_bytes()
            for extension in ['jpg', 'webp']:
                photo = Path(temp) / f'convert-{extension}.{extension}'
                Image.new('RGB', (31, 47), 'red').save(photo)
                with Image.open(photo) as original:
                    expected_pixels = original.tobytes()
                converted, width, height = convert_to_png(photo, store.max_bytes)
                assert (width, height) == (31, 47)
                with Image.open(converted) as png:
                    assert png.format == 'PNG' and png.tobytes() == expected_pixels
            print('PNG_CONVERSION_OK', flush=True)
            video = Path(temp) / "video.webm"
            with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "outtmpl": str(video), "noprogress": True}) as downloader:
                downloader.extract_info(f"{base}/video.webm", download=True)
            assert video.read_bytes() == (source / "video.webm").read_bytes()
            assert InstagramIE.suitable("https://www.instagram.com/p/Abcde12/")
            # Exercise the real spawn entry point in the frozen executable,
            # with an invalid URL so the diagnostic never contacts Instagram.
            worker = multiprocessing.get_context('spawn').Process(target=resolve_worker, args=('https://127.0.0.1/p/Abcde12/', temp, 60, 1024, 5))
            worker.start()
            try:
                worker.join(15)
                assert not worker.is_alive(), 'frozen worker failed to exit'
                assert worker.exitcode == 0
                assert json.loads((Path(temp) / 'result.json').read_text(encoding='utf-8'))['error']['code'] == 'LINK_INVALID'
            finally:
                if worker.is_alive():
                    worker.kill()
                    worker.join()
                worker.close()
            print(json.dumps({"status": "ok", "worker_spawn": "ok", "instaloader": instaloader.__version__, "yt_dlp": yt_dlp.version.__version__, "image_sha256": hashlib.sha256(image.read_bytes()).hexdigest(), "video_sha256": hashlib.sha256(video.read_bytes()).hexdigest()}))
    finally:
        server.shutdown()
        server.server_close()
