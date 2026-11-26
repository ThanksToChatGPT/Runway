"""Scraping completo contra las tiendas falsas (ported de CollectionTests, MorePagesTests,
SingleGarmentFilterTests e ImageSelectionTests de outfit-scraper-v5)."""
import unittest
from dataclasses import replace

from app import image_picker
from app.config import Settings
from app.detect import DetectionCache
from app.service import Runtime, ScrapeFailed, scrape_store
from tests import fake_store
from tests.fake_store import BASE, BROKEN, HTML_CONFIG, FakeClock, FakeStore

# sin esperas reales ni descargas de imágenes
SETTINGS = Settings(delay_seconds=0.0, jitter_seconds=0.0, image_delay_seconds=0.0, image_analysis=False,
                    max_products=1000, time_budget_seconds=60.0)


class ServiceTestCase(unittest.TestCase):
    def setUp(self):
        self.clock = FakeClock()
        self.store = FakeStore(clock=self.clock)
        self.runtime = Runtime(transport=self.store.transport(), clock=self.clock, sleep=self.clock.sleep,
                               cache=DetectionCache(clock=self.clock))

    def scrape(self, path, settings=SETTINGS, slug="tienda", base=BASE, **kwargs):
        return scrape_store(store_id="7", slug=slug, base_url=f"{base}{path}", settings=settings,
                            runtime=self.runtime, **kwargs)

    def assertCatalog(self, result, found=fake_store.TOTAL, returned=fake_store.SINGLE_GARMENTS):
        stats = result["stats"]
        self.assertEqual((result["status"], stats["found"], result["count"]), ("success", found, returned))
        self.assertEqual(len(result["products"]), returned)
        self.assertTrue(all(p["category"] in ("top", "bottom", "shoes") for p in result["products"]))


class CollectionTests(ServiceTestCase):
    def test_shopify_store(self):
        result = self.scrape("/shopify", platform="shopify")
        self.assertCatalog(result)
        self.assertEqual((result["stats"]["skipped_packs"], result["stats"]["skipped_non_garment"]),
                         (fake_store.PACKS, fake_store.NON_GARMENT))
        shoes = [p for p in result["products"] if p["category"] == "shoes"]
        item = shoes[0]
        self.assertTrue(item["images"] and item["sizes"] and item["price_cop"] > 0)
        self.assertEqual(len(item["images"]), 1)                     # ?v=1 y ?v=2 son la misma foto
        self.assertIn(item["subcategory"], ("sneakers", "boots"))
        self.assertTrue(all(not p["title"].endswith("(pack 3)") for p in result["products"]))

    def test_html_store(self):
        # las tarjetas html no tienen marca de kit, pero el nombre "(pack 3)" delata el pack
        result = self.scrape("/html", platform="html", config=HTML_CONFIG)
        self.assertCatalog(result)
        self.assertEqual(result["stats"]["skipped_packs"], fake_store.PACKS)

    def test_html_store_needs_config_on_the_same_host(self):
        with self.assertRaises(ScrapeFailed) as ctx:
            self.scrape("/html", platform="html")
        self.assertEqual((ctx.exception.status, ctx.exception.code), (422, "invalid_config"))
        other_host = {**HTML_CONFIG, "list_urls": ["https://otro.host/catalogo?page={page}"]}
        with self.assertRaises(ScrapeFailed) as ctx:
            self.scrape("/html", platform="html", config=other_host)
        self.assertEqual(ctx.exception.code, "invalid_config")

    def test_failure_is_isolated(self):
        with self.assertRaises(ScrapeFailed) as ctx:
            self.scrape("", base=BROKEN, platform="shopify", settings=replace(SETTINGS, retries=0, max_failures=1))
        self.assertEqual(ctx.exception.status, 502)
        self.assertCatalog(self.scrape("/shopify", platform="shopify"))   # la siguiente tienda no se entera

    def test_robots_blocked_store(self):
        with self.assertRaises(ScrapeFailed) as ctx:
            self.scrape("/private", platform="shopify")
        self.assertEqual((ctx.exception.status, ctx.exception.code), (502, "robots_disallowed"))

    def test_mock_store_makes_no_requests(self):
        result = self.scrape("", slug="mock", base="https://demo.example")
        self.assertEqual((result["platform"], result["count"], result["stats"]["requests"]), ("mock", 6, 0))
        self.assertEqual(self.store.requests, [])
        self.assertEqual({p["category"] for p in result["products"]}, {"top", "bottom", "shoes"})


class MorePagesTests(ServiceTestCase):
    """Las VTEX falsas solo sirven 24 resultados por consulta, como las reales sirven 2500."""

    def test_vtex_legacy_reads_category_by_category(self):
        result = self.scrape("/vtexlegacy", platform="vtex", config={"window": fake_store.WINDOW, "page_size": 12})
        self.assertCatalog(result)
        self.assertTrue(any("category/tree" in p for p in self.store.requests))

    def test_vtex_intelligent_search_joins_sort_orders(self):
        result = self.scrape("/vtexis", platform="vtex_is")
        self.assertCatalog(result)
        item = result["products"][0]
        self.assertTrue(item["product_url"].startswith(f"{BASE}/vtexis/"))
        self.assertEqual(item["material"], "cotton")

    def test_legacy_api_closed_but_intelligent_search_works(self):
        with self.assertRaises(ScrapeFailed) as ctx:
            self.scrape("/vtexis", platform="vtex")
        self.assertEqual((ctx.exception.status, ctx.exception.code), (502, "store_unavailable"))
        self.assertIn("HTTP 401", ctx.exception.message)


class SingleGarmentFilterTests(ServiceTestCase):
    def test_single_garment_skips_packs(self):
        result = self.scrape("/vtexlegacy", platform="vtex", config={"window": fake_store.WINDOW, "page_size": 12})
        self.assertEqual(result["stats"]["skipped_packs"], fake_store.PACKS)
        self.assertFalse(any("pack" in p["title"].lower() for p in result["products"]))

    def test_packs_kept_when_filter_is_off(self):
        result = self.scrape("/vtexlegacy", platform="vtex",
                             config={"window": fake_store.WINDOW, "page_size": 12, "single_garment": False})
        # los 2 packs de accesorios siguen fuera: no son top/bottom/shoes
        self.assertEqual(result["count"], fake_store.TOTAL - 9)
        self.assertEqual(sum("(pack 3)" in p["title"] for p in result["products"]), fake_store.PACKS - 2)


class LimitsTests(ServiceTestCase):
    def test_max_products_stops_reading(self):
        result = self.scrape("/vtexis", platform="vtex_is", max_products=5)
        self.assertEqual((result["count"], result["stats"]["stop_reason"]), (5, "max_products"))
        self.assertEqual(len(self.store.paths("/vtexis/api/io")), 1)     # una sola página de 48

    def test_responds_within_the_time_budget(self):
        # tienda lenta: cada petición tarda 1 s y hay 1 s de espera entre peticiones al mismo host
        self.store.latency = 1.0
        settings = replace(SETTINGS, delay_seconds=1.0, time_budget_seconds=5.0)
        result = self.scrape("/vtexlegacy", platform="vtex", settings=settings,
                             config={"window": fake_store.WINDOW, "page_size": 6})
        self.assertEqual((result["status"], result["stats"]["stop_reason"]), ("partial", "time_budget"))
        self.assertGreater(result["count"], 0)
        self.assertLessEqual(result["stats"]["elapsed_ms"], 5000)

    def test_timeout_without_products(self):
        self.store.latency = 3.0
        settings = replace(SETTINGS, delay_seconds=1.0, time_budget_seconds=2.0)
        with self.assertRaises(ScrapeFailed) as ctx:
            self.scrape("/vtexis", settings=settings)
        self.assertEqual((ctx.exception.status, ctx.exception.code), (504, "timeout"))

    def test_default_budget_fits_backend_timeout(self):
        self.assertLess(Settings().time_budget_seconds * 1000, 15_000)


class AutoDetectionTests(ServiceTestCase):
    """El backend solo envía { store_id, slug, base_url }: la plataforma se detecta sola."""

    def test_detects_platform_from_base_url_and_caches_it(self):
        first = self.scrape("/vtexis")
        self.assertEqual((first["platform"], first["stats"]["platform_source"]), ("vtex_is", "detected"))
        self.assertCatalog(first)
        probes = len(self.store.paths("/vtexis/api/catalog_system"))
        second = self.scrape("/vtexis/")                               # misma tienda (barra final incluida)
        self.assertEqual(second["stats"]["platform_source"], "cache")
        self.assertEqual(len(self.store.paths("/vtexis/api/catalog_system")), probes)   # sin volver a detectar

    def test_detects_shopify(self):
        result = self.scrape("/shopify")
        self.assertEqual(result["platform"], "shopify")
        self.assertCatalog(result)

    def test_unsupported_store(self):
        with self.assertRaises(ScrapeFailed) as ctx:
            self.scrape("/nothing-here")
        self.assertEqual((ctx.exception.status, ctx.exception.code), (422, "unsupported_platform"))
        self.assertIsNone(self.runtime.cache.get(f"{BASE}/nothing-here"))


@unittest.skipUnless(image_picker.HAVE_PIL and fake_store.HAVE_PIL, "necesita Pillow")
class ImageSelectionTests(ServiceTestCase):
    def test_garment_alone_goes_first_and_only_urls_are_returned(self):
        settings = replace(SETTINGS, image_analysis=True)
        result = self.scrape("/vtexis", platform="vtex_is", settings=settings, max_products=6,
                             config={"single_garment": False})
        self.assertEqual(result["count"], 6)
        for item in result["products"]:
            self.assertEqual(len(item["images"]), 3)
            self.assertIn("/b-", item["images"][0])                     # la prenda sola, aunque venía de última
            self.assertTrue(all(isinstance(u, str) and u.startswith("http") for u in item["images"]))
        self.assertTrue(self.store.paths("/img/"))

    def test_without_analysis_no_image_is_downloaded(self):
        self.scrape("/vtexis", platform="vtex_is", max_products=6)
        self.assertEqual(self.store.paths("/img/"), [])


if __name__ == "__main__":
    unittest.main()
