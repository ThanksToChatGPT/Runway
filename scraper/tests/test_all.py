import json
import os
import sqlite3
import tempfile
import threading
import unittest
import urllib.request
from http.server import ThreadingHTTPServer

from outfit_scraper import db, demo_store, image_picker
from outfit_scraper.detect import detect, grep_html
from outfit_scraper.menu import add_store_by_url
from outfit_scraper.models import RawProduct
from outfit_scraper.normalizer import classify, normalize, normalize_color, normalize_size, parse_price
from outfit_scraper.polite_http import PoliteClient, RobotsDisallowed
from outfit_scraper.runner import DEFAULT_SETTINGS, ConfigError, load_config, run_all, run_store
from outfit_scraper.viewer.server import Viewer, make_handler

# plain settings for most tests: no waiting, no image downloads
SETTINGS = {**DEFAULT_SETTINGS, "delay_seconds": 0.0, "image_delay_seconds": 0.0, "retries": 3,
            "image_analysis": False}


class Base(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server, cls.base = demo_store.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def setUp(self):
        fd, self.path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        self.conn = db.connect(self.path)
        self.stores = demo_store.demo_stores(self.base)
        for s in self.stores:
            db.upsert_store(self.conn, s)

    def tearDown(self):
        self.conn.close()
        os.remove(self.path)

    def store(self, store_id):
        return db.get_stores(self.conn, store_id=store_id)[0]


class NormalizerTests(unittest.TestCase):
    def test_price(self):
        for raw, expected in [("$ 149.900", 149900), ("180000.00", 180000), ("1.299.900", 1299900),
                              ("1,299.90", 1299.9), ("$99,900", 99900), (59900, 59900), ("", None), ("agotado", None), (0, None)]:
            self.assertEqual(parse_price(raw), expected, raw)

    def test_color_size_category(self):
        self.assertEqual(normalize_color("Negro mate"), "black")
        self.assertEqual(normalize_color("Camiseta blanca"), "white")
        self.assertEqual(normalize_color("Zapatos rojos"), "red")
        self.assertEqual(normalize_size("Talla M"), "M")
        self.assertEqual(normalize_size("2XL"), "XXL")
        self.assertEqual(normalize_size("Única"), "ONE SIZE")
        self.assertEqual(classify("Pantalón cargo negro"), ("bottom", "cargo"))
        self.assertEqual(classify("Buzo con capucha"), ("top", "hoodie"))
        self.assertEqual(classify("Cosa rara", ""), ("other", ""))

    def test_colombian_colors_and_categories(self):
        # names used by Colombian stores such as Mattelsa (they were lost by the old short list)
        self.assertEqual(normalize_color("Marfil"), "white")
        self.assertEqual(normalize_color("Crudo"), "white")
        self.assertEqual(normalize_color("Borgoña"), "red")
        self.assertEqual(normalize_color("Mostaza"), "yellow")
        self.assertEqual(normalize_color("Turquesa"), "cyan")
        self.assertEqual(normalize_color("Celeste"), "cyan")
        self.assertEqual(normalize_color("Fucsia"), "pink")
        self.assertEqual(normalize_color("Café"), "brown")
        self.assertEqual(classify("Body Azul Ícono"), ("top", "t-shirt"))
        self.assertEqual(classify("Crop Top Marfil Ícono"), ("top", "t-shirt"))

    def test_rejects_bad_records_and_keeps_units(self):
        store = {"id": "s", "name": "S"}
        self.assertIsNone(normalize(RawProduct("1", "", "http://x", 100), store)[0])
        self.assertIsNone(normalize(RawProduct("1", "Camiseta", "http://x", "sin precio"), store)[0])
        product, _ = normalize(RawProduct("1", "Camiseta negra", "http://x", "$ 59.900", sizes=[("m", True), ("M", False)],
                                          units=1, size_units={"m": 1, "M": 0}), store)
        self.assertEqual((product.price_cop, product.color, product.category, product.sizes), (59900, "black", "top", [("M", True)]))
        self.assertEqual((product.units_total, product.size_units), (1, {"M": 1}))
        self.assertEqual((product.pack_size, product.pack_evidence), (1, ""))

    def test_detect_pack_names_and_api_flags(self):
        from outfit_scraper.normalizer import detect_pack
        # "1 unit" in this project means ONE garment, not a pack of several: names say it most of the time
        for name, expected in [("Pack 3 medias algodón", 3), ("Medias x3", 3), ("Combo Jean + Buzo", 2),
                               ("Kit deportivo completo", 2), ("Juego de 2 toallas", 2), ("2 por camisetas", 2),
                               ("Boxer 3 unidades", 3), ("Set de calzas", 2)]:
            self.assertEqual(detect_pack(name)[0], expected, name)
        for name in ["Camiseta oversize negra", "Polo marfil ícono", "Jeans baggy lavandería"]:
            self.assertEqual(detect_pack(name)[0], 1, name)
        self.assertEqual(detect_pack("Camiseta", is_kit=True), (2, "isKit"))
        self.assertEqual(detect_pack("Camiseta", unit_multiplier=3), (3, "unitMultiplier=3"))
        self.assertEqual(detect_pack("Camiseta", units_hint=4)[0], 4)
        # normalize carries the pack through to the product (the name is more precise than the API flag)
        store = {"id": "s", "name": "S"}
        product, _ = normalize(RawProduct("9", "Pack 3 Medias Básicas", "http://x", 19900,
                                          is_kit=False, unit_multiplier=3.0), store)
        self.assertEqual((product.pack_size, product.pack_evidence), (3, "name: 'pack 3'"))
        # "rib 2X2" is a knitted fabric, not a pack of two garments
        single, _ = normalize(RawProduct("10", "Crop Top Vino Básico", "http://x", 59900,
                                         description="confeccionada en rib 2X2 de 280 gramos"), store)
        self.assertEqual((single.pack_size, single.pack_evidence), (1, ""))


class ImagePickerTests(unittest.TestCase):
    def test_hints_in_names(self):
        ordered, kinds = image_picker.pick_images(["https://x/model-1.jpg", "https://x/flat-1.jpg"])
        self.assertEqual(ordered[0], "https://x/flat-1.jpg")
        ordered, _ = image_picker.pick_images(["https://x/1.jpg", "https://x/2.jpg"], {"https://x/2.jpg": "Producto frente"})
        self.assertEqual(ordered[0], "https://x/2.jpg")
        self.assertEqual(image_picker.pick_images(["https://x/1.jpg"])[0], ["https://x/1.jpg"])

    def test_vtex_front_shot_goes_first_and_no_duplicates(self):
        # VTEX names photos "ref-1.jpg" (front), "ref-2.jpg" (detail), "ref-3.jpg" (back); the front is the garment alone.
        urls = [f"https://cdn.x/arquivos/ids/{73000 + i}/95964-{i}.jpg?v=6392819{i}" for i in (1, 2, 3, 1, 2)]
        ordered, kinds = image_picker.pick_images(urls)
        self.assertEqual(len(ordered), 3)                       # the same photo with another ?v= is not repeated
        self.assertIn("95964-1.jpg", ordered[0])
        self.assertEqual(kinds[ordered[0]], "product-only")
        self.assertEqual(image_picker.meta_score("https://cdn.x/ids/71/95964-1.jpg"), 3)
        self.assertLess(image_picker.meta_score("https://cdn.x/ids/71/95964-2.jpg"), 3)

    def test_at_most_eight_photos(self):
        urls = [f"https://x/{i}.jpg" for i in range(20)]
        ordered, _ = image_picker.pick_images(urls)
        self.assertEqual(len(ordered), 8)

    @unittest.skipUnless(image_picker.HAVE_PIL and demo_store.HAVE_PIL, "needs Pillow")
    def test_looking_at_the_pixels(self):
        kinds = {k: image_picker.classify(image_picker.analyze(demo_store.png(k, 7)))[0] for k in "abc"}
        self.assertEqual(kinds, {"a": "model", "b": "product-only", "c": "other"})


class ClientTests(Base):
    def test_robots(self):
        client = PoliteClient("TestBot/1.0", delay=0)
        self.assertTrue(client.allowed(self.base + "/shopify/products.json"))
        with self.assertRaises(RobotsDisallowed):
            client.get(self.base + "/private/x")

    def test_retries_on_503(self):
        demo_store.Handler.flaky_hits = 0
        client = PoliteClient("TestBot/1.0", delay=0, retries=3)
        self.assertEqual(client.get_json(self.base + "/flaky"), {"ok": True})
        self.assertEqual(client.requests_made, 3)


class CollectionTests(Base):
    def test_shopify_store(self):
        result = run_store(self.conn, self.store("demo-shopify"), SETTINGS)
        self.assertEqual((result["status"], result["saved"], result["skipped_packs"]), ("success", 29, 7))
        p = db.list_products(self.conn, store="demo-shopify", category="footwear")
        item = p["items"][0]
        self.assertTrue(item["images"] and item["sizes"] and item["price_cop"] > 0)
        self.assertEqual(set(item["images"][0]), {"url", "kind"})

    def test_html_store(self):
        # the html cards do not have an isKit flag, but the name "(pack 3)" gives the pack away
        result = run_store(self.conn, self.store("demo-html"), SETTINGS)
        self.assertEqual((result["status"], result["saved"], result["skipped_packs"]), ("success", 29, 7))

    def test_failure_is_isolated(self):
        db.upsert_store(self.conn, {"id": "broken", "name": "Broken", "base_url": "http://127.0.0.1:9", "platform": "shopify"})
        results = {r["store"]: r for r in run_all(self.conn, {**SETTINGS, "retries": 0, "max_failures": 1})}
        self.assertEqual(results["broken"]["status"], "failed")
        self.assertEqual(results["demo-shopify"]["status"], "success")

    def test_rerun_keeps_hidden_and_price_date(self):
        store = self.store("demo-shopify")
        run_store(self.conn, store, SETTINGS)
        pid = self.conn.execute("SELECT id FROM product LIMIT 1").fetchone()[0]
        self.conn.execute("UPDATE product SET is_hidden = 1, last_price_update = 'old' WHERE id = ?", (pid,))
        self.conn.commit()
        run_store(self.conn, store, SETTINGS)
        row = self.conn.execute("SELECT is_hidden, last_price_update FROM product WHERE id = ?", (pid,)).fetchone()
        self.assertEqual((row[0], row[1]), (1, "old"))
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM product").fetchone()[0], 29)

    def test_robots_blocked_store_is_logged(self):
        db.upsert_store(self.conn, {"id": "blocked", "name": "Blocked", "base_url": self.base + "/private", "platform": "shopify"})
        result = run_store(self.conn, self.store("blocked"), SETTINGS)
        self.assertEqual(result["status"], "failed")
        self.assertIn("robots", result["errors"][0])


class MorePagesTests(Base):
    """The fake VTEX stores only serve 24 results per query, like the real ones serve 2,500."""

    def test_vtex_legacy_reads_category_by_category(self):
        result = run_store(self.conn, self.store("demo-vtex"), SETTINGS)
        self.assertEqual((result["status"], result["found"], result["saved"]), ("success", 36, 29))

    def test_vtex_intelligent_search_joins_sort_orders(self):
        result = run_store(self.conn, self.store("demo-vtex-io"), SETTINGS)
        self.assertEqual((result["status"], result["found"], result["saved"]), ("success", 36, 29))

    def test_legacy_api_closed_but_intelligent_search_works(self):
        db.upsert_store(self.conn, {"id": "legacy", "name": "Legacy", "base_url": self.base + "/vtexis", "platform": "vtex"})
        legacy = run_store(self.conn, self.store("legacy"), SETTINGS)
        self.assertEqual(legacy["status"], "failed")
        self.assertIn("HTTP 401", legacy["errors"][0])


class SingleGarmentFilterTests(Base):
    def test_single_garment_skips_packs(self):
        # "1 unit" means ONE garment: the demo catalog has a pack of 3 every 5th product (7 of 36)
        result = run_store(self.conn, self.store("demo-vtex"), SETTINGS)
        self.assertEqual((result["status"], result["found"], result["saved"]), ("success", 36, 29))
        self.assertEqual(result["skipped_packs"], 7)
        rows = self.conn.execute("SELECT pack_size FROM product WHERE store_id = 'demo-vtex'").fetchall()
        self.assertTrue(rows and all(r[0] == 1 for r in rows))
        note = self.conn.execute("SELECT errors FROM scraping_log").fetchone()[0]
        self.assertIn("packs/kits of several garments", note)

    def test_packs_kept_when_filter_is_off(self):
        result = run_store(self.conn, self.store("demo-vtex"), {**SETTINGS, "single_garment": False})
        self.assertEqual(result["saved"], 36)
        packs = self.conn.execute("SELECT COUNT(*) FROM product WHERE store_id = 'demo-vtex' AND pack_size > 1").fetchone()[0]
        self.assertEqual(packs, 7)

    def test_pack_evidence_is_saved(self):
        run_store(self.conn, self.store("demo-vtex"), {**SETTINGS, "single_garment": False})
        row = self.conn.execute("SELECT name, pack_size, pack_evidence FROM product WHERE store_id = 'demo-vtex' AND pack_size > 1 LIMIT 1").fetchone()
        self.assertIn("pack", row[0].lower())
        self.assertEqual(row[1], 3)
        self.assertTrue(row[2])


@unittest.skipUnless(image_picker.HAVE_PIL and demo_store.HAVE_PIL, "needs Pillow")
class ImageSelectionTests(Base):
    def test_garment_alone_goes_first_and_only_urls_are_stored(self):
        settings = {**SETTINGS, "image_analysis": True, "single_garment": False}
        result = run_store(self.conn, self.store("demo-vtex-io"), settings, max_products=6)
        self.assertEqual(result["saved"], 6)
        for item in db.list_products(self.conn, store="demo-vtex-io")["items"]:
            urls = [i["url"] for i in item["images"]]
            self.assertEqual(len(urls), 3)
            self.assertIn("/b-", urls[0])                                  # the garment alone, although it was listed last
            kinds = {i["url"].rsplit("/", 1)[-1][0]: i["kind"] for i in item["images"]}
            self.assertEqual(kinds, {"b": "product-only", "a": "model", "c": "other"})
        cols = [r[1] for r in self.conn.execute("PRAGMA table_info(product_image)")]
        self.assertNotIn("data", cols)
        self.assertTrue(all(isinstance(r[0], str) and r[0].startswith("http") for r in self.conn.execute("SELECT image_url FROM product_image")))


class DetectAndAddTests(Base):
    def test_detect_finds_platform_and_working_api(self):
        lines = []
        result = detect(self.base + "/vtexis", SETTINGS, save=False, out=lines.append)
        self.assertIn("vtex", result["platforms"])
        status = {p["name"]: (p["status"], p["ok"]) for p in result["probes"]}
        self.assertEqual(status["VTEX legacy catalog API"], (401, False))
        self.assertEqual(status["VTEX Intelligent Search"], (200, True))
        self.assertEqual(result["recommended"]["platform"], "vtex_is")
        self.assertIn("Garments:", "\n".join(lines))               # the pack sample is reported

    def test_detect_accepts_206_and_retries_429(self):
        # the bug that stopped Mattelsa: VTEX answers 206 (partial content) to range queries and may answer
        # 429 once; v2 called both "unexpected status" and refused to add the store.
        demo_store.Handler.flaky_hits = 0
        lines = []
        result = detect(self.base + "/flaky429", SETTINGS, probe_all=False, save=False, out=lines.append)
        legacy = next(p for p in result["probes"] if p["name"] == "VTEX legacy catalog API")
        self.assertEqual((legacy["status"], legacy["ok"]), (206, True))
        self.assertEqual(result["recommended"]["platform"], "vtex")

    def test_detect_reports_the_packs_of_the_sample(self):
        lines = []
        result = detect(self.base + "/vtexlegacy", SETTINGS, save=False, out=lines.append)
        # 7 of the 36 demo products are packs, and detect says so with its 20-product sample
        self.assertGreater(result["stock"]["packs"]["count"], 0)
        self.assertIn("packs/kits", "\n".join(lines))

    def test_detect_from_saved_html_and_grep(self):
        fd, path = tempfile.mkstemp(suffix=".html")
        with os.fdopen(fd, "w") as f:
            f.write('<html><script src="https://cdn.shopify.com/s/files/theme.js"></script>Camiseta</html>')
        lines = []
        result = detect(self.base + "/shopify", SETTINGS, html_path=path, extra_grep=["Camiseta", "zzz"], save=False, out=lines.append)
        counts = grep_html(path, ["shopify", "nothing"], SETTINGS, out=lambda *a: None)
        os.remove(path)
        self.assertIn("shopify", result["platforms"])
        self.assertEqual((counts["shopify"] > 0, counts["nothing"]), (True, 0))

    def test_add_store_from_url_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            config, dbp = os.path.join(tmp, "stores.json"), os.path.join(tmp, "x.db")
            json.dump({"settings": {"delay_seconds": 0, "image_delay_seconds": 0}, "stores": []}, open(config, "w"))
            saved = add_store_by_url(config, dbp, self.base + "/vtexis", interactive=False, out=lambda *a: None)
            self.assertEqual(saved["platform"], "vtex_is")
            data = json.load(open(config))
            self.assertEqual([s["platform"] for s in data["stores"]], ["vtex_is"])
            again = add_store_by_url(config, dbp, self.base + "/vtexis", interactive=False, out=lambda *a: None)
            self.assertEqual(len(json.load(open(config))["stores"]), 1)          # the same URL is not added twice
            self.assertIsNone(add_store_by_url(config, dbp, self.base + "/nothing-here", interactive=False, out=lambda *a: None))


class ConfigAndDbTests(unittest.TestCase):
    def test_friendly_json_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "stores.json")
            open(path, "w").write('{"stores": [\n  {"id": "a"}\n  {"id": "b"}\n]}')
            with self.assertRaises(ConfigError) as ctx:
                load_config(path)
            self.assertIn("line 3", str(ctx.exception))
            self.assertIn("comma", str(ctx.exception))
            self.assertEqual(load_config(os.path.join(tmp, "missing.json"))[1], [])

    def test_old_database_gets_new_columns(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "old.db")
            old = sqlite3.connect(path)
            old.executescript("CREATE TABLE product (id TEXT PRIMARY KEY, store_id TEXT, name TEXT, price_cop REAL, external_url TEXT);"
                              "CREATE TABLE product_image (id INTEGER PRIMARY KEY, product_id TEXT, image_url TEXT, is_primary INTEGER);"
                              "CREATE TABLE product_size_stock (id INTEGER PRIMARY KEY, product_id TEXT, size TEXT, is_available INTEGER);")
            old.close()
            conn = db.connect(path)
            cols = lambda t: {r[1] for r in conn.execute(f"PRAGMA table_info({t})")}
            self.assertIn("units_total", cols("product"))
            self.assertIn("kind", cols("product_image"))
            self.assertIn("units", cols("product_size_stock"))
            self.assertIn("pack_size", cols("product"))
            self.assertIn("pack_evidence", cols("product"))
            conn.close()


class DetectDatabaseEngineTests(unittest.TestCase):
    def test_detect_sqlite_by_signature_and_test_its_api(self):
        # like the platform detection of a store: read the file signature, grep keywords, then probe the API
        from outfit_scraper.menu import detect_db_engine, test_db_api
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "outfit.db")
            conn = db.connect(path)
            db.upsert_store(conn, {"id": "s", "name": "S", "base_url": "https://x", "platform": "vtex", "config": {}})
            conn.close()
            engine, how = detect_db_engine(path)
            self.assertEqual(engine, "SQLite 3")
            self.assertIn("signature", how)
            self.assertIn("OK: sqlite3 module", test_db_api(engine, path, []))
            # a .sql text dump is told apart by grepping the keywords in the text
            dump = os.path.join(tmp, "backup.sql")
            open(dump, "w").write("-- PostgreSQL database dump\nCREATE TABLE users ();\n")
            engine2, how2 = detect_db_engine(dump)
            self.assertIn("PostgreSQL", engine2)
            self.assertIn("grep", how2)
            self.assertIn("no local API", test_db_api(engine2, dump, []))
            engine3, _ = detect_db_engine(os.path.join(tmp, "missing.db"))
            self.assertIn("does not exist", _)


class ViewerTests(Base):
    def test_api(self):
        run_all(self.conn, SETTINGS)
        viewer = Viewer(self.path, SETTINGS)
        server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(viewer))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        url = f"http://127.0.0.1:{server.server_address[1]}"
        get = lambda path: json.load(urllib.request.urlopen(url + path))
        try:
            stats = get("/api/stats")
            # 4 demo stores x 36 products; every 5th product is a pack (skipped by the single-garment filter)
            self.assertEqual(stats["products"], 4 * 29)
            self.assertEqual(stats["packs"], 0)                     # packs are not collected with the filter on
            self.assertEqual(len(get("/api/stores")), 4)
            cheap = get("/api/products?max_price=60000&sort=price_asc")
            self.assertTrue(cheap["total"] > 0 and all(i["price_cop"] <= 60000 for i in cheap["items"]))
            single = get("/api/products?single_garment=1&limit=200")
            self.assertTrue(single["total"] > 0 and all((i["pack_size"] or 1) == 1 for i in single["items"]))
            page = urllib.request.urlopen(url + "/").read().decode()
            self.assertTrue(page.startswith("<!doctype html>") and "scroll-snap-type" in page)
            self.assertNotIn("last_unit", page)                     # the stock filter is gone
            req = urllib.request.Request(url + "/api/run", data=b'{"store": "demo-shopify"}', method="POST",
                                         headers={"Content-Type": "application/json"})
            self.assertTrue(json.load(urllib.request.urlopen(req))["started"])
        finally:
            server.shutdown()


if __name__ == "__main__":
    unittest.main()
