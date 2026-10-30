import asyncio
import json
import multiprocessing
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.media import ServiceError
from app.resolvers.instagram import InstagramResolver
from app.resolvers.ytdlp_resolver import YtDlpResolver
from app.services.cleanup_service import run_cleanup
from app.services.download_service import DownloadStore
from app.services.resolve_service import ResolveService
from app.utils.url_validator import validate_instagram_url


def slow_worker(url, directory, ttl, max_bytes, timeout):
    (Path(directory) / 'started').write_text('yes')
    time.sleep(30)
    (Path(directory) / 'late-write').write_text('unexpected')


def successful_worker(url, directory, ttl, max_bytes, timeout):
    media_id = '00000000-0000-0000-0000-000000000001'
    (Path(directory) / f'{media_id}.jpg').write_bytes(b'complete media')
    (Path(directory) / 'result.json').write_text(json.dumps({'result': {
        'type': 'image', 'media': [{'id': media_id, 'format': 'jpg', 'filename': 'image.jpg'}]
    }}))


class ValidationTests(unittest.TestCase):
    def test_malformed_authorities_are_validation_errors(self):
        for url in ['https://instagram.com:abc/p/Abcde12/', 'https://instagram.com:99999/p/Abcde12/', 'https://[broken/p/Abcde12/', 'https://instagram.com:0/p/Abcde12/']:
            with self.subTest(url=url), self.assertRaises(ServiceError) as raised:
                validate_instagram_url(url)
            self.assertEqual(raised.exception.code, 'LINK_INVALID')

    def test_reels_alias_and_case_use_video_fallback(self):
        primary, fallback = MagicMock(), MagicMock()
        primary.resolve.side_effect = ServiceError('MEDIA_NOT_FOUND', 'missing')
        fallback.resolve.return_value = {'type': 'video', 'media': []}
        resolver = InstagramResolver(primary, fallback)
        for route in ['reel', 'reels', 'REELS', 'Reel']:
            resolver.resolve(f'https://instagram.com/{route}/Abcde12/')
            fallback.resolve.assert_called_with('https://www.instagram.com/reel/Abcde12/', 'Abcde12')


class CleanupTests(unittest.TestCase):
    def test_locked_file_is_retried_without_losing_record(self):
        with tempfile.TemporaryDirectory() as directory:
            store = DownloadStore(Path(directory), -1, 100)
            media_id, path = store.reserve_path('jpg')
            path.write_bytes(b'media')
            store.register(media_id, path, 'media.jpg')
            with patch.object(Path, 'unlink', side_effect=PermissionError('locked')):
                self.assertEqual(store.cleanup(), 0)
            self.assertIn(media_id, store.records)
            self.assertEqual(store.cleanup(), 1)
            self.assertFalse(path.exists())
            self.assertNotIn(media_id, store.records)


class AsyncCleanupTests(unittest.IsolatedAsyncioTestCase):
    async def test_periodic_cleanup_survives_filesystem_error(self):
        store = MagicMock(ttl_seconds=60)
        store.cleanup.side_effect = [PermissionError('locked'), asyncio.CancelledError()]
        with patch('app.services.cleanup_service.asyncio.sleep', return_value=None):
            with self.assertRaises(asyncio.CancelledError):
                await run_cleanup(store)
        self.assertEqual(store.cleanup.call_count, 2)


class WorkerTests(unittest.IsolatedAsyncioTestCase):
    async def test_timeout_kills_worker_and_removes_partial_files(self):
        with tempfile.TemporaryDirectory() as directory:
            store = DownloadStore(Path(directory), 60, 100)
            service = ResolveService(store, 3)
            with patch('app.services.resolve_service.resolve_worker', slow_worker):
                with self.assertRaises(ServiceError) as raised:
                    await service.resolve('https://instagram.com/p/Abcde12/')
            self.assertEqual(raised.exception.code, 'RESOLVE_TIMEOUT')
            self.assertEqual(service.active, 0)
            self.assertEqual(list(Path(directory).iterdir()), [])
            self.assertEqual(multiprocessing.active_children(), [])

    async def test_success_publishes_file_in_parent_store(self):
        with tempfile.TemporaryDirectory() as directory:
            store = DownloadStore(Path(directory), 60, 100)
            service = ResolveService(store, 15)
            with patch('app.services.resolve_service.resolve_worker', successful_worker):
                result = await service.resolve('https://instagram.com/p/Abcde12/')
            saved = store.get(result['media'][0]['id'])
            self.assertIsNotNone(saved)
            self.assertEqual(saved.path.read_bytes(), b'complete media')
            self.assertEqual(len(list(Path(directory).iterdir())), 1)

    async def test_cancellation_reaps_worker_and_concurrency_is_bounded(self):
        with tempfile.TemporaryDirectory() as directory:
            store = DownloadStore(Path(directory), 60, 100)
            service = ResolveService(store, 15, max_workers=1)
            with patch('app.services.resolve_service.resolve_worker', slow_worker):
                operation = asyncio.create_task(service.resolve('https://instagram.com/p/Abcde12/'))
                await asyncio.sleep(0.1)
                with self.assertRaises(ServiceError) as raised:
                    await service.resolve('https://instagram.com/p/Abcde12/')
                self.assertEqual(raised.exception.code, 'SERVICE_BUSY')
                operation.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await operation
            self.assertEqual(multiprocessing.active_children(), [])
            self.assertEqual(service.active, 0)
            self.assertEqual(list(Path(directory).iterdir()), [])


class ResolveEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def test_disconnected_request_cancels_operation(self):
        from app.main import resolve
        from app.models.media import ResolveRequest
        cancelled = asyncio.Event()
        async def pending(_url):
            try:
                await asyncio.sleep(60)
            finally:
                cancelled.set()
        request = MagicMock()
        request.is_disconnected = AsyncMock(return_value=True)
        with patch('app.main.RESOLVER') as resolver:
            resolver.resolve = pending
            with self.assertRaises(ServiceError) as raised:
                await resolve(ResolveRequest(url='https://instagram.com/p/Abcde12/'), request)
        self.assertEqual(raised.exception.code, 'REQUEST_CANCELLED')
        self.assertTrue(cancelled.is_set())

    async def test_invalid_url_returns_service_validation_error(self):
        from app.main import resolve
        from app.models.media import ResolveRequest
        request = MagicMock()
        request.is_disconnected = AsyncMock(return_value=False)
        with self.assertRaises(ServiceError) as raised:
            await resolve(ResolveRequest(url='https://instagram.com:abc/p/Abcde12/'), request)
        self.assertEqual(raised.exception.code, 'LINK_INVALID')


class VideoLimitTests(unittest.TestCase):
    def test_known_oversized_video_is_rejected_before_download(self):
        with tempfile.TemporaryDirectory() as directory:
            resolver = YtDlpResolver(DownloadStore(Path(directory), 60, 100), 10)
            with patch('app.resolvers.ytdlp_resolver.yt_dlp.YoutubeDL') as factory:
                factory.return_value.__enter__.return_value.extract_info.return_value = {'formats': [
                    {'format_id': 'best', 'ext': 'mp4', 'vcodec': 'h264', 'acodec': 'aac', 'filesize': 101}
                ]}
                with self.assertRaises(ServiceError) as raised:
                    resolver.resolve('https://instagram.com/reel/Abcde12/', 'Abcde12')
                self.assertEqual(raised.exception.code, 'FILE_TOO_LARGE')
                self.assertEqual(factory.call_count, 1)

    def test_unknown_size_is_stopped_during_download_and_partials_removed(self):
        with tempfile.TemporaryDirectory() as directory:
            store = DownloadStore(Path(directory), 60, 100)
            resolver = YtDlpResolver(store, 10)

            def factory(options):
                client = MagicMock()
                def extract(url, download):
                    if not download:
                        return {'formats': [{'format_id': 'best', 'ext': 'mp4', 'vcodec': 'h264', 'acodec': 'aac'}]}
                    partial = Path(options['outtmpl'].replace('%(ext)s', 'mp4') + '.part')
                    partial.write_bytes(b'x' * 101)
                    options['progress_hooks'][0]({'downloaded_bytes': 101})
                    self.fail('download should have stopped')
                client.__enter__.return_value.extract_info.side_effect = extract
                return client

            with patch('app.resolvers.ytdlp_resolver.yt_dlp.YoutubeDL', side_effect=factory):
                with self.assertRaises(ServiceError) as raised:
                    resolver.resolve('https://instagram.com/reel/Abcde12/', 'Abcde12')
            self.assertEqual(raised.exception.code, 'FILE_TOO_LARGE')
            self.assertEqual(list(Path(directory).iterdir()), [])
            self.assertEqual(store.records, {})
