import unittest

from app.config import Settings, budget_from_backend_timeout


class ConfigTests(unittest.TestCase):
    def test_defaults_answer_before_the_backend_gives_up(self):
        settings = Settings.from_env({})
        self.assertEqual(settings.time_budget_seconds, 12.0)                # 15 000 ms del backend - 20 %
        self.assertEqual(settings.max_products, 150)
        self.assertFalse(settings.image_analysis)
        self.assertTrue(settings.respect_robots and settings.single_garment)

    def test_budget_follows_backend_timeout(self):
        self.assertEqual(Settings.from_env({"SCRAPER_TIMEOUT_MS": "30000"}).time_budget_seconds, 24.0)
        self.assertEqual(Settings.from_env({"SCRAPER_TIMEOUT_MS": "5000"}).time_budget_seconds, 3.0)
        self.assertEqual(Settings.from_env({"SCRAPER_TIME_BUDGET_MS": "4000",
                                            "SCRAPER_TIMEOUT_MS": "30000"}).time_budget_seconds, 4.0)
        self.assertEqual(budget_from_backend_timeout(1000), 1.0)
        for timeout_ms in (3000, 15000, 60000):
            self.assertLess(budget_from_backend_timeout(timeout_ms) * 1000, timeout_ms)

    def test_invalid_values_fall_back_to_defaults(self):
        settings = Settings.from_env({"SCRAPER_TIMEOUT_MS": "abc", "SCRAPER_MAX_PRODUCTS": "-3",
                                      "SCRAPER_DELAY_SECONDS": "", "SCRAPER_IMAGE_ANALYSIS": "true",
                                      "SCRAPER_RESPECT_ROBOTS": "0"})
        self.assertEqual((settings.time_budget_seconds, settings.max_products, settings.delay_seconds),
                         (12.0, 150, 1.0))
        self.assertTrue(settings.image_analysis)
        self.assertFalse(settings.respect_robots)


if __name__ == "__main__":
    unittest.main()
