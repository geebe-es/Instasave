import unittest
import http.client
import threading
from http.server import ThreadingHTTPServer

from server import AppHandler, ImageCandidate, ResolveError, normalize_instagram_url, select_best_image_candidate


class StaticPathTests(unittest.TestCase):
    def test_malformed_authority_returns_validation_error(self):
        for url in ['https://instagram.com:abc/p/Abcde12/', 'https://[broken/p/Abcde12/']:
            with self.subTest(url=url), self.assertRaises(ResolveError) as raised:
                normalize_instagram_url(url)
            self.assertEqual(raised.exception.status, 422)

    def test_traversal_is_not_served_and_normal_assets_still_work(self):
        server = ThreadingHTTPServer(('127.0.0.1', 0), AppHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            for path in ['/../package.json', '/%2e%2e/package.json', '/assets/../package.json', '/assets/%2e%2e/package.json', '/..\\package.json']:
                with self.subTest(path=path):
                    connection = http.client.HTTPConnection('127.0.0.1', server.server_port)
                    connection.request('GET', path)
                    response = connection.getresponse()
                    self.assertEqual(response.status, 404)
                    self.assertNotIn(b'instasave-desktop', response.read())
                    connection.close()
            for path in ['/', '/assets/brand/instasave-icon.svg']:
                connection = http.client.HTTPConnection('127.0.0.1', server.server_port)
                connection.request('GET', path)
                response = connection.getresponse()
                self.assertEqual(response.status, 200)
                response.read()
                connection.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


class BestImageCandidateTests(unittest.TestCase):
    def test_selects_largest_valid_public_image(self) -> None:
        best = select_best_image_candidate([
            ImageCandidate("https://scontent.cdninstagram.com/150.jpg", 150, 150),
            ImageCandidate("https://scontent.cdninstagram.com/320.jpg", 320, 400),
            ImageCandidate("https://scontent.cdninstagram.com/640.jpg", 640, 800),
            ImageCandidate("https://scontent.cdninstagram.com/1080.jpg", 1080, 1350),
        ])
        self.assertIsNotNone(best)
        self.assertEqual((best.width, best.height), (1080, 1350))

    def test_rejects_non_public_or_dimensionless_candidates(self) -> None:
        best = select_best_image_candidate([
            ImageCandidate("https://example.test/image.jpg", 2000, 2000),
            ImageCandidate("https://scontent.cdninstagram.com/missing-size.jpg"),
        ])
        self.assertIsNone(best)


if __name__ == "__main__":
    unittest.main()
