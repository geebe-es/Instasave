import unittest

from server import ImageCandidate, select_best_image_candidate


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
