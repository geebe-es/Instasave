import unittest

from app.resolvers.ytdlp_resolver import YtDlpResolver
from app.utils.url_validator import validate_instagram_url
from app.models.media import ServiceError


class UrlValidationTests(unittest.TestCase):
    def test_normalizes_public_post_url(self):
        url, shortcode = validate_instagram_url("https://instagram.com/p/Abcde12/?utm_source=test")
        self.assertEqual(url, "https://www.instagram.com/p/Abcde12/")
        self.assertEqual(shortcode, "Abcde12")

    def test_rejects_private_network_url(self):
        with self.assertRaises(ServiceError) as error:
            validate_instagram_url("https://127.0.0.1/p/Abcde12/")
        self.assertEqual(error.exception.code, "LINK_INVALID")


class VideoSelectionTests(unittest.TestCase):
    def test_prefers_largest_combined_audio_video_format(self):
        selected = YtDlpResolver._best_combined_format({"formats": [
            {"format_id": "small", "width": 640, "height": 360, "vcodec": "h264", "acodec": "aac"},
            {"format_id": "video-only", "width": 1920, "height": 1080, "vcodec": "h264", "acodec": "none"},
            {"format_id": "best", "width": 1080, "height": 1920, "vcodec": "h264", "acodec": "aac"},
        ]})
        self.assertEqual(selected["format_id"], "best")


if __name__ == "__main__":
    unittest.main()
