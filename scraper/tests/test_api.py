"""API HTTP del servicio (FastAPI) y detección de plataforma (ported de DetectAndAddTests de
outfit-scraper-v5). Todo corre contra la tienda falsa en memoria."""
import unittest

from fastapi.testclient import TestClient

from app.config import Settings
from app.detect import DetectionCache
from app.main import app, get_runtime, get_settings
from app.service import Runtime
from tests.fake_store import BASE, FakeClock, FakeStore

SETTINGS = Settings(delay_seconds=0.0, jitter_seconds=0.0, image_analysis=False, time_budget_seconds=60.0)
BACKEND_FIELDS = {"external_id", "title", "brand", "category", "subcategory", "color", "material", "price_cop",
                  "product_url", "description", "images", "sizes"}


class ApiTestCase(unittest.TestCase):
    def setUp(self):
        self.clock = FakeClock()
        self.store = FakeStore(clock=self.clock)
        self.runtime = Runtime(transport=self.store.transport(), clock=self.clock, sleep=self.clock.sleep,
                               cache=DetectionCache(clock=self.clock))
        app.dependency_overrides[get_settings] = lambda: SETTINGS
        app.dependency_overrides[get_runtime] = lambda: self.runtime
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()

    def scrape(self, **body):
        return self.client.post("/scrape", json={"store_id": "7", "slug": "tienda", **body})

    def detect(self, **body):
        return self.client.post("/detect", json=body)


class ScrapeEndpointTests(ApiTestCase):
    def test_health(self):
        self.assertEqual(self.client.get("/health").json(), {"status": "ok"})

    def test_backend_contract_with_only_store_slug_and_url(self):
        # exactamente lo que envía HttpScraperAdapter: { store_id, slug, base_url }
        r = self.scrape(base_url=f"{BASE}/vtexis")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual((body["store_id"], body["slug"], body["platform"]), ("7", "tienda", "vtex_is"))
        self.assertEqual(body["count"], len(body["products"]))
        for item in body["products"]:
            self.assertEqual(set(item), BACKEND_FIELDS)
            self.assertIn(item["category"], ("top", "bottom", "shoes"))
            self.assertIsInstance(item["price_cop"], int)
            self.assertTrue(item["title"] and item["product_url"].startswith("http"))
            self.assertTrue(all(isinstance(u, str) for u in item["images"]))
            self.assertTrue(all(set(s) == {"size", "in_stock"} for s in item["sizes"]))

    def test_mock_slug(self):
        r = self.scrape(slug="mock", base_url="https://demo.example")
        self.assertEqual((r.status_code, r.json()["platform"], r.json()["count"]), (200, "mock", 6))

    def test_errors_are_http_statuses_the_backend_treats_as_failed(self):
        self.assertEqual(self.scrape(base_url="ftp://x.store").status_code, 422)
        self.assertEqual(self.scrape(base_url=f"{BASE}/x", platform="woocommerce").status_code, 422)
        r = self.scrape(base_url=f"{BASE}/nothing-here")
        self.assertEqual((r.status_code, r.json()["detail"]["code"]), (422, "unsupported_platform"))
        r = self.scrape(base_url=f"{BASE}/vtexis", platform="vtex")
        self.assertEqual((r.status_code, r.json()["detail"]["code"]), (502, "store_unavailable"))

    def test_max_products(self):
        body = self.scrape(base_url=f"{BASE}/shopify", platform="shopify", max_products=3).json()
        self.assertEqual((body["count"], body["stats"]["stop_reason"]), (3, "max_products"))


class DetectEndpointTests(ApiTestCase):
    def test_detect_finds_platform_and_working_api(self):
        report = self.detect(base_url=f"{BASE}/vtexis").json()
        self.assertIn("vtex", report["fingerprints"])
        status = {p["name"]: (p["status"], p["ok"]) for p in report["probes"]}
        self.assertEqual(status["VTEX legacy catalog API"], (401, False))
        self.assertEqual(status["VTEX Intelligent Search"], (200, True))
        self.assertEqual((report["platform"], report["supported"]), ("vtex_is", True))
        self.assertEqual(report["sample"]["read"], 20)                     # muestra de productos
        # el resultado queda en caché: el siguiente /scrape no vuelve a detectar
        body = self.scrape(base_url=f"{BASE}/vtexis").json()
        self.assertEqual(body["stats"]["platform_source"], "cache")

    def test_detect_accepts_206_and_retries_429(self):
        # el bug que frenaba a Mattelsa: VTEX responde 206 a las consultas por rango y puede responder 429
        report = self.detect(base_url=f"{BASE}/flaky429", sample=0).json()
        legacy = next(p for p in report["probes"] if p["name"] == "VTEX legacy catalog API")
        self.assertEqual((legacy["status"], legacy["ok"]), (206, True))
        self.assertEqual(report["platform"], "vtex")

    def test_detect_reports_the_packs_of_the_sample(self):
        report = self.detect(base_url=f"{BASE}/vtexlegacy").json()
        self.assertEqual(report["platform"], "vtex")
        self.assertGreater(report["sample"]["packs"], 0)                   # 1 de cada 5 es un pack de 3
        self.assertGreater(report["sample"]["categories"]["accessory"], 0)

    def test_detect_from_saved_html_and_grep(self):
        html = '<html><script src="https://cdn.shopify.com/s/files/theme.js"></script>Camiseta</html>'
        report = self.detect(base_url=f"{BASE}/shopify", html=html, grep=["Camiseta", "zzz"], sample=0).json()
        self.assertIn("shopify", report["fingerprints"])
        self.assertEqual(report["grep"], {"Camiseta": 1, "zzz": 0})
        self.assertEqual(report["platform"], "shopify")
        self.assertNotIn("/shopify/", self.store.requests)                # no pidió la página de inicio

    def test_detect_nothing(self):
        report = self.detect(base_url=f"{BASE}/nothing-here", sample=0).json()
        self.assertIsNone(report["platform"])
        self.assertFalse(report["supported"])
        self.assertTrue(report["message"])
        self.assertEqual(len(report["probes"]), 6)                          # probó todas las APIs conocidas


if __name__ == "__main__":
    unittest.main()
