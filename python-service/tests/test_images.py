import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from PIL import Image
from app.models.media import ServiceError
from app.resolvers.instaloader_resolver import InstaloaderResolver
from app.services.download_service import DownloadStore
from app.services.image_service import convert_to_png


class PngTests(unittest.TestCase):
    def test_pixels_dimensions_and_transparency(self):
        for extension, mode in [('jpg', 'RGB'), ('webp', 'RGBA'), ('png', 'RGBA')]:
            with self.subTest(extension=extension), tempfile.TemporaryDirectory() as directory:
                source = Path(directory) / f'photo.{extension}'
                Image.new(mode, (31, 47), (40, 60, 80, 95) if mode == 'RGBA' else (40, 60, 80)).save(source, lossless=True)
                with Image.open(source) as original:
                    pixels = original.tobytes()
                result, width, height = convert_to_png(source)
                self.assertEqual((width, height), (31, 47))
                self.assertEqual(result.suffix, '.png')
                with Image.open(result) as output:
                    self.assertEqual(output.format, 'PNG')
                    self.assertEqual(output.tobytes(), pixels)

    def test_exif_orientation_is_applied_once(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'photo.jpg'
            exif = Image.Exif()
            exif[274] = 6
            Image.new('RGB', (12, 23), 'red').save(source, exif=exif)
            result, width, height = convert_to_png(source)
            self.assertEqual((width, height), (23, 12))
            with Image.open(result) as output:
                self.assertNotIn(274, output.getexif())

    def test_animation_keeps_frames(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'photo.webp'
            Image.new('RGBA', (12, 12), 'red').save(source, save_all=True,
                append_images=[Image.new('RGBA', (12, 12), 'blue')], duration=[100, 200], loop=0, lossless=True)
            result, _, _ = convert_to_png(source)
            with Image.open(result) as output:
                self.assertEqual(output.format, 'PNG')
                self.assertEqual(output.n_frames, 2)
                self.assertEqual(output.convert('RGB').getpixel((0, 0)), (255, 0, 0))
                output.seek(1)
                self.assertEqual(output.convert('RGB').getpixel((0, 0)), (0, 0, 255))

    def test_pixel_limit_is_disabled(self):
        self.assertIsNone(Image.MAX_IMAGE_PIXELS)

    def test_corrupt_image_returns_explicit_error(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'photo.jpg'
            source.write_bytes(b'not an image')
            with self.assertRaises(ServiceError) as raised:
                convert_to_png(source)
            self.assertEqual(raised.exception.code, 'IMAGE_CONVERSION_FAILED')
            self.assertFalse(source.with_suffix('.png').exists())

    def test_resolver_exposes_png_filename_mime_and_dimensions(self):
        with tempfile.TemporaryDirectory() as directory:
            store = DownloadStore(Path(directory), 60, 100000)
            resolver = InstaloaderResolver(store, 10)
            def download(_url, destination):
                Image.new('RGB', (32, 48), 'red').save(destination, format='JPEG')
            with patch.object(resolver, '_download_public_url', side_effect=download):
                for position in [1, 2, 3]:
                    item = resolver._save_item(SimpleNamespace(url='https://example.test/photo.jpg'), 'Abcde12', position, False)
                    self.assertEqual(item['format'], 'png')
                    self.assertEqual(item['filename'], f'instagram_Abcde12_{position:02d}.png')
                    self.assertEqual((item['width'], item['height']), (32, 48))
                    stored = store.get(item['id'])
                    self.assertEqual(stored.media_type, 'image/png')
                    self.assertTrue(stored.path.read_bytes().startswith(b'\x89PNG\r\n\x1a\n'))

    def test_video_bytes_remain_unchanged(self):
        with tempfile.TemporaryDirectory() as directory:
            store = DownloadStore(Path(directory), 60, 100000)
            resolver = InstaloaderResolver(store, 10)
            with patch.object(resolver, '_download_public_url', side_effect=lambda url, destination: destination.write_bytes(b'video fixture')):
                item = resolver._save_item(SimpleNamespace(video_url='https://example.test/movie.mp4'), 'Abcde12', 1, True)
            self.assertEqual(item['format'], 'mp4')
            self.assertEqual(store.get(item['id']).path.read_bytes(), b'video fixture')
