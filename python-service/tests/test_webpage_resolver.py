import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from PIL import Image

from app.models.media import ServiceError
from app.resolvers.instagram import InstagramResolver
from app.resolvers.webpage_resolver import WebpageResolver
from app.services.download_service import DownloadStore


def png_bytes(size: tuple[int, int]) -> bytes:
    image = Image.new('RGB', size, 'blue')
    output = io.BytesIO()
    image.save(output, format='PNG')
    return output.getvalue()


def head_response(status: int = 200, content_length: str | None = None):
    response = MagicMock(status_code=status)
    if content_length is not None:
        response.headers = {'Content-Length': content_length}
    return response


def get_response(status: int = 200, content_length: str | None = None, chunks: tuple[bytes, ...] = ()):
    response = MagicMock(status_code=status)
    if content_length is not None:
        response.headers = {'Content-Length': content_length}
    response.iter_content = lambda chunk_size: iter(chunks)
    return response


class WebpageResolverTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.mkdtemp()
        self.resolver = WebpageResolver(DownloadStore(Path(self.directory), 60, 5_000_000), 10)

    def test_best_image_url_prefers_larger_content_length(self):
        entry = {'thumbnails': [{'url': 'https://cdn/small'}, {'url': 'https://cdn/big'}, {'url': 'https://cdn/tiny'}]}
        heads = {'https://cdn/small': 64000, 'https://cdn/big': 115000, 'https://cdn/tiny': 7000}
        with patch('app.resolvers.webpage_resolver.requests') as mock_requests:
            mock_requests.head.side_effect = lambda url, **k: head_response(200, str(heads[url]))
            self.assertEqual(self.resolver._best_image_url(entry), 'https://cdn/big')

    def test_best_image_url_falls_back_when_head_is_refused(self):
        entry = {'thumbnails': [{'url': 'https://cdn/small'}, {'url': 'https://cdn/big'}]}
        with patch('app.resolvers.webpage_resolver.requests') as mock_requests:
            mock_requests.head.side_effect = lambda *a, **k: head_response(405)
            mock_requests.get.side_effect = lambda url, **k: get_response(200, '9000' if 'big' in url else '4000')
            self.assertEqual(self.resolver._best_image_url(entry), 'https://cdn/big')

    def test_save_image_streams_largest_candidate_and_converts_to_png(self):
        payload = png_bytes((8, 6))
        entry = {'thumbnails': [{'url': 'https://cdn/whole'}, {'url': 'https://cdn/part'}]}
        with patch('app.resolvers.webpage_resolver.requests') as mock_requests:
            mock_requests.head.side_effect = lambda url, **k: head_response(200, '100000')
            mock_requests.get.return_value = get_response(200, '100000', (payload,))
            item = self.resolver._save_image(entry, 'Abcde12', 1)
        self.assertFalse(json.dumps(mock_requests.get.call_args_list[0].kwargs['headers']).lower().__contains__('cookie'))
        self.assertEqual(item['type'], 'image')
        self.assertEqual(item['format'], 'png')
        self.assertEqual((item['width'], item['height']), (8, 6))
        self.assertIn('download', Path(item['downloadEndpoint']).parts)

    def test_download_keeps_the_size_limit(self):
        with tempfile.TemporaryDirectory() as directory:
            tight = WebpageResolver(DownloadStore(Path(directory), 60, 10), 10)
            with patch('app.resolvers.webpage_resolver.requests') as mock_requests:
                mock_requests.get.return_value = get_response(200, '50', (b'x' * 11,))
                with self.assertRaises(ServiceError) as raised:
                    tight._download('https://cdn/media', Path(directory) / 'media.jpg')
            self.assertEqual(raised.exception.code, 'FILE_TOO_LARGE')
            self.assertFalse((Path(directory) / 'media.jpg').exists())

    def test_unlimited_store_accepts_oversized_media(self):
        with tempfile.TemporaryDirectory() as directory:
            loose = WebpageResolver(DownloadStore(Path(directory), 60, 0), 10)
            with patch('app.resolvers.webpage_resolver.requests') as mock_requests:
                mock_requests.head.side_effect = lambda *a, **k: head_response(200, '1000000')
                mock_requests.get.return_value = get_response(200, None, (b'y' * 50_000, b'y' * 40_000))
                # No FILE_TOO_LARGE is raised even though the asset dwarfs what a
                # limited store would reject.
                loose._download('https://cdn/media', Path(directory) / 'media.jpg')
            self.assertEqual((Path(directory) / 'media.jpg').stat().st_size, 90_000)


    def test_store_with_zero_limit_registers_large_files(self):
        with tempfile.TemporaryDirectory() as directory:
            store = DownloadStore(Path(directory), 60, 0)
            path = Path(directory) / 'large.png'
            path.write_bytes(b'z' * 500_000)
            stored = store.register('limitless', path, 'large.png')
            self.assertEqual(stored.path.stat().st_size, 500_000)


class InstagramResolverFallbackTests(unittest.TestCase):
    def test_access_restricted_post_reaches_webpage_fallback(self):
        primary = MagicMock()
        primary.resolve.side_effect = ServiceError('SOURCE_ACCESS_RESTRICTED', 'blocked')
        webpage = MagicMock()
        webpage.resolve.return_value = {'type': 'image', 'media': [{'id': 'found'}]}
        resolver = InstagramResolver(primary, MagicMock(), webpage)
        result = resolver.resolve('https://instagram.com/p/Abcde12/')
        self.assertEqual(result, {'type': 'image', 'media': [{'id': 'found'}]})
        webpage.resolve.assert_called_with('https://www.instagram.com/p/Abcde12/', 'Abcde12', 'all')

    def test_restricted_reel_still_tries_the_video_fallback(self):
        primary = MagicMock()
        primary.resolve.side_effect = ServiceError('SOURCE_ACCESS_RESTRICTED', 'blocked')
        webpage = MagicMock()
        webpage.resolve.side_effect = ServiceError('SOURCE_ACCESS_RESTRICTED', 'blocked again')
        ytdlp = MagicMock()
        ytdlp.resolve.return_value = {'type': 'video', 'media': []}
        resolver = InstagramResolver(primary, ytdlp, webpage)
        result = resolver.resolve('https://instagram.com/reel/Abcde12/')
        self.assertEqual(result, {'type': 'video', 'media': []})
        webpage.resolve.assert_called_once()
        ytdlp.resolve.assert_called_with('https://www.instagram.com/reel/Abcde12/', 'Abcde12')

    def test_non_retryable_errors_stop_immediately(self):
        primary = MagicMock()
        primary.resolve.side_effect = ServiceError('LINK_INVALID', 'bad link')
        webpage, ytdlp = MagicMock(), MagicMock()
        resolver = InstagramResolver(primary, ytdlp, webpage)
        with self.assertRaises(ServiceError) as raised:
            resolver.resolve('https://instagram.com/p/Abcde12/')
        self.assertEqual(raised.exception.code, 'LINK_INVALID')
        webpage.resolve.assert_not_called()
        ytdlp.resolve.assert_not_called()
