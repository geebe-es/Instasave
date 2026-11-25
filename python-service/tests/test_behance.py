import io
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from PIL import Image

from app.models.media import ServiceError
from app.services import behance_service, session_service
from app.services.behance_service import _allowed, _candidates, store_project
from app.services.download_service import DownloadStore


def png_bytes() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (12, 8), "#ff3d81").save(buffer, format="PNG")
    return buffer.getvalue()


class BehanceUrlTests(unittest.TestCase):
    def test_accepts_https_behance_cdn_only(self):
        self.assertTrue(_allowed("https://mir-s3-cdn-cf.behance.net/project_modules/max_1200_webp/a.jpg"))
        self.assertFalse(_allowed("http://mir-s3-cdn-cf.behance.net/project_modules/max_1200_webp/a.jpg"))
        self.assertFalse(_allowed("https://mir-s3-cdn-cf.behance.net.evil.test/a.jpg"))
        self.assertFalse(_allowed("https://example.com/a.jpg"))

    def test_tries_the_largest_variant_first(self):
        candidates = _candidates("https://mir-s3-cdn-cf.behance.net/project_modules/max_1200_webp/a.jpg")
        self.assertEqual(candidates[0], "https://mir-s3-cdn-cf.behance.net/project_modules/max_3840_webp/a.jpg")
        self.assertIn("https://mir-s3-cdn-cf.behance.net/project_modules/max_1200_webp/a.jpg", candidates)


class BehanceStoreTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.store = DownloadStore(Path(self.directory.name), ttl_seconds=60, max_bytes=0)

    def tearDown(self):
        self.directory.cleanup()

    def _fake_download(self, url, destination, _max_bytes):
        destination.write_bytes(png_bytes())
        return destination

    def test_stores_png_per_unique_image(self):
        urls = [
            "https://mir-s3-cdn-cf.behance.net/project_modules/max_1200_webp/one.jpg",
            "https://mir-s3-cdn-cf.behance.net/project_modules/max_1200_webp/two.jpg",
            "https://mir-s3-cdn-cf.behance.net/project_modules/max_1200_webp/one.jpg",
            "https://example.com/ignored.jpg",
        ]
        with mock.patch.object(behance_service, "_download", side_effect=self._fake_download):
            result = store_project(self.store, urls, "254892273")
        self.assertEqual(result["type"], "behance")
        self.assertEqual(len(result["media"]), 2)
        self.assertEqual([item["filename"] for item in result["media"]], [
            "behance_254892273_01.png",
            "behance_254892273_02.png",
        ])
        for item in result["media"]:
            stored = self.store.get(item["id"])
            self.assertIsNotNone(stored)
            self.assertEqual((stored.width, stored.height), (12, 8))

    def test_rejects_project_without_images(self):
        with self.assertRaises(ServiceError) as error:
            store_project(self.store, ["https://example.com/nope.jpg"], "1")
        self.assertEqual(error.exception.code, "MEDIA_NOT_FOUND")

    def test_survives_images_that_fail(self):
        urls = [
            "https://mir-s3-cdn-cf.behance.net/project_modules/max_1200_webp/one.jpg",
            "https://mir-s3-cdn-cf.behance.net/project_modules/max_1200_webp/two.jpg",
        ]
        def flaky(url, destination, _max_bytes):
            if "one.jpg" in url:
                raise ServiceError("MEDIA_NOT_FOUND", "gone", 404)
            return self._fake_download(url, destination, 0)

        with mock.patch.object(behance_service, "_download", side_effect=flaky):
            result = store_project(self.store, urls, "9")
        self.assertEqual(len(result["media"]), 1)


class SessionCookieTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name) / "cookies.txt"
        self.previous = os.environ.get("INSTASAVE_COOKIE_FILE")
        os.environ["INSTASAVE_COOKIE_FILE"] = str(self.path)
        session_service._cache = None

    def tearDown(self):
        if self.previous is None:
            os.environ.pop("INSTASAVE_COOKIE_FILE", None)
        else:
            os.environ["INSTASAVE_COOKIE_FILE"] = self.previous
        session_service._cache = None
        self.directory.cleanup()

    def test_missing_file_means_anonymous(self):
        self.assertEqual(session_service.load_cookies(), {})
        self.assertFalse(session_service.has_session())

    def test_reads_only_instagram_cookies(self):
        self.path.write_text(
            "# Netscape HTTP Cookie File\n"
            ".instagram.com\tTRUE\t/\tTRUE\t0\tsessionid\tabc123\n"
            ".instagram.com\tTRUE\t/\tTRUE\t0\tcsrftoken\txyz\n"
            ".example.com\tTRUE\t/\tFALSE\t0\tsessionid\tother\n",
            encoding="utf-8",
        )
        cookies = session_service.load_cookies()
        self.assertEqual(cookies["sessionid"], "abc123")
        self.assertEqual(cookies["csrftoken"], "xyz")
        self.assertNotIn("other", cookies.values())
        self.assertTrue(session_service.has_session())


if __name__ == "__main__":
    unittest.main()
