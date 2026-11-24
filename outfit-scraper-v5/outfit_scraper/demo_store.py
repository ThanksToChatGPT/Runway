"""A small fake store used for the demo and the tests. It serves the same 36 products in several ways:
  /shopify/products.json            Shopify format (does not say how many units are left)
  /html/catalogo?page=N             plain HTML list pages
  /vtexlegacy/api/catalog_system/…  VTEX legacy API with a small window (24 results) and categories
  /vtexis/api/io/_v/…               VTEX Intelligent Search (the legacy API answers 401), small window and sort orders
It also serves /robots.txt, /img/… (pictures), /private/x (blocked by robots) and /flaky (fails twice, then works)."""
import io
import json
import random
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

try:
    from PIL import Image, ImageDraw
    HAVE_PIL = True
except ImportError:
    HAVE_PIL = False

TYPES = [("Camiseta oversize", 59900, "Algodón"), ("Hoodie básico", 129900, "Algodón"),
         ("Camisa de lino", 99900, "Lino"), ("Chaqueta cortavientos", 189900, "Poliéster"),
         ("Jean slim", 149900, "Denim"), ("Pantalón cargo", 159900, "Algodón"),
         ("Short deportivo", 69900, "Poliéster"), ("Tenis urbanos", 249900, ""),
         ("Botas de cuero", 299900, "Cuero"), ("Gorra clásica", 49900, "Algodón"),
         ("Gafas de sol", 89900, ""), ("Mochila urbana", 119900, "Nylon")]
COLORS = ["Negro", "Blanco", "Gris", "Azul", "Verde", "Beige"]
BRANDS = ["Nordic", "Urbana", "Kilimanjaro", "Basic Co"]
WINDOW = 24            # the fake VTEX stores only serve this many results per query, like the real ones (2,500)
PALETTE = [(30, 90, 200), (40, 160, 90), (120, 60, 160), (200, 40, 60), (30, 30, 30)]   # garment colors that are not skin-like


def catalog(n=36):
    rnd = random.Random(42)
    items = []
    for i in range(n):
        name, price, material = TYPES[i % len(TYPES)]
        color = COLORS[rnd.randrange(len(COLORS))]
        foot = "Tenis" in name or "Botas" in name
        sizes = ["38", "40", "42"] if foot else ["S", "M", "L", "XL"]
        # every 5th product is sold as a pack of several garments (pack_size), like real stores do
        pack = 3 if i % 5 == 4 else 1
        title = f"{name} {color.lower()}" + (" (pack 3)" if pack > 1 else "")
        items.append({"id": 1000 + i, "title": title, "handle": f"item-{1000 + i}",
                      "vendor": BRANDS[rnd.randrange(len(BRANDS))], "price": price + rnd.randrange(0, 5) * 10000,
                      "color": color, "sizes": [(s, rnd.random() > 0.25) for s in sizes],
                      "material": material, "img": i % 12, "pack": pack})
    return items


def quantities(it):
    """Units per size for the VTEX fake stores. Every 4th product has exactly 1 unit in total."""
    n, mode = len(it["sizes"]), (it["id"] - 1000) % 4
    return {0: [1] + [0] * (n - 1), 1: [1] * n, 2: [10] * n, 3: [0] * n}[mode]


def svg(n):
    hue = (n * 47) % 360
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" '
            f'fill="hsl({hue},45%,78%)"/><text x="150" y="160" font-size="28" text-anchor="middle" '
            f'fill="#333" font-family="sans-serif">demo {n}</text></svg>')


def png(kind, n):
    """a = a model wearing the garment, b = the garment alone on white, c = a close-up of the fabric."""
    rnd = random.Random(n)
    color = PALETTE[n % len(PALETTE)]
    im = Image.new("RGB", (240, 240), (255, 255, 255))
    d = ImageDraw.Draw(im)
    if kind == "b":                                           # garment alone on a plain white background
        d.rectangle((70, 60, 170, 200), fill=color)
        d.rectangle((40, 60, 70, 110), fill=color)
        d.rectangle((170, 60, 200, 110), fill=color)
    elif kind == "a":                                         # model: busy background + skin tones
        for x in range(240):
            for y in range(240):
                v = rnd.randrange(-35, 35)
                im.putpixel((x, y), (110 + v, 135 + v, 160 + v))
        d.ellipse((90, 25, 150, 100), fill=(224, 172, 140))
        d.rectangle((80, 100, 160, 210), fill=color)
    else:                                                     # close-up of the fabric
        for x in range(0, 240, 12):
            d.rectangle((x, 0, x + 6, 240), fill=color)
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


def images_for(it, origin):
    n = it["id"]
    return [f"{origin}/img/a-{n}.png", f"{origin}/img/c-{n}.png", f"{origin}/img/b-{n}.png"]   # the garment alone is the last one


class Handler(BaseHTTPRequestHandler):
    flaky_hits = 0

    def log_message(self, *a):
        pass

    def _send(self, body, ctype="text/html; charset=utf-8", status=200, headers=None):
        data = body.encode() if isinstance(body, str) else body
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def _json(self, data, status=200):
        self._send(json.dumps(data), "application/json", status)

    def do_GET(self):
        url = urlparse(self.path)
        qs = parse_qs(url.query)
        first = lambda k, d="": qs.get(k, [d])[0]
        items = catalog()
        origin = f"http://{self.headers['Host']}"
        if url.path == "/robots.txt":
            return self._send("User-agent: *\nDisallow: /private\n", "text/plain")
        if url.path.startswith("/img/"):
            name = url.path.split("/")[-1]
            if name.endswith(".png") and HAVE_PIL:
                kind, num = name[:-4].split("-")
                return self._send(png(kind, int(num)), "image/png")
            return self._send(svg(int(name.split(".")[0])), "image/svg+xml")
        if url.path == "/private/x":
            return self._send("secret")
        if url.path == "/flaky":
            Handler.flaky_hits += 1
            if Handler.flaky_hits <= 2:
                return self._send("busy", status=503, headers={"Retry-After": "0"})
            return self._json({"ok": True})
        if url.path == "/shopify/products.json":
            page, per = int(first("page", "1")), 18
            chunk = items[(page - 1) * per: page * per]
            products = [{
                "id": it["id"], "title": it["title"], "handle": it["handle"], "vendor": it["vendor"],
                "product_type": "", "tags": ["demo"] + (["pack"] if it["pack"] > 1 else []),
                "body_html": f"<p>{it['material']} de buena calidad</p>",
                "options": [{"name": "Talla", "position": 1}, {"name": "Color", "position": 2}],
                "variants": [{"option1": s, "option2": it["color"], "price": f"{it['price']}.00", "available": ok}
                             for s, ok in it["sizes"]],
                "images": [{"src": f"{origin}/img/{it['img']}.svg", "alt": ""}]} for it in chunk]
            return self._json({"products": products})
        if url.path == "/flaky429/api/catalog_system/pub/products/search":
            # like a real VTEX store: first answers 429 (too many requests), then 206 (partial content)
            Handler.flaky_hits += 1
            if Handler.flaky_hits <= 1:
                return self._send("busy", status=429, headers={"Retry-After": "0"})
            chunk = items[0:4]
            products = [{"productId": str(it["id"]), "productName": it["title"], "brand": it["vendor"],
                         "link": f"{origin}/flaky429/{it['handle']}/p", "linkText": it["handle"],
                         "categories": ["/Ropa/"], "description": "", "Talla": [s for s, _ in it["sizes"]],
                         "items": [{"itemId": str(it["id"]), "Talla": [s],
                                    "isKit": it["pack"] > 1,
                                    "unitMultiplier": float(it["pack"]) if it["pack"] > 1 else 1,
                                    "images": [{"imageUrl": u, "imageLabel": "", "imageText": ""} for u in images_for(it, origin)],
                                    "sellers": [{"sellerId": "1", "commertialOffer": {"Price": float(it["price"]), "AvailableQuantity": 1}}]}
                                   for s, _ in it["sizes"]]} for it in chunk]
            return self._json(products, status=206)
        if url.path == "/html/catalogo":
            page, per = int(first("page", "1")), 12
            cards = "".join(
                f'<div class="card"><a href="/html/p/{it["id"]}"><img src="/img/{it["img"]}.svg">'
                f'<h3 class="t">{it["title"]}</h3></a><span class="b">{it["vendor"]}</span>'
                f'<span class="pr">$ {it["price"]:,}'.replace(",", ".") + "</span></div>"
                for it in items[(page - 1) * per: page * per])
            return self._send(f"<html><body>{cards}</body></html>")
        # ---------------- fake VTEX stores
        if url.path in ("/vtexis/", "/vtexlegacy/"):
            return self._send('<html><head><script src="https://x.vtexassets.com/_v/public/assets/v1/npm/vtex.render-runtime@8/r.js">'
                              '</script><script>window.__RUNTIME__ = {};</script></head><body>shop</body></html>',
                              headers={"x-vtex-cache": "HIT", "Set-Cookie": "vtex_segment=abc; Path=/"})
        if url.path == "/vtexis/api/catalog_system/pub/products/search":
            return self._json({"error": "Unauthorized"}, 401)
        if url.path == "/vtexis/api/io/_v/api/intelligent-search/product_search":
            page, per = int(first("page", "1")), int(first("count", "48"))
            pool = {"name:asc": sorted(items, key=lambda i: i["title"]),
                    "name:desc": sorted(items, key=lambda i: i["title"], reverse=True),
                    "price:asc": sorted(items, key=lambda i: i["price"]),
                    "price:desc": sorted(items, key=lambda i: -i["price"])}.get(first("sort"), items)[:WINDOW]
            chunk = pool[(page - 1) * per: page * per]
            products = [{
                "productId": str(it["id"]), "productName": it["title"], "brand": it["vendor"],
                "description": f"{it['material']} de buena calidad", "categories": [],
                "link": f"/{it['handle']}/p", "linkText": it["handle"],
                "items": [{"itemId": f"{it['id']}-{i}",
                           "isKit": it["pack"] > 1, "unitMultiplier": float(it["pack"]) if it["pack"] > 1 else 1,
                           "images": [{"imageUrl": u, "imageLabel": "", "imageText": ""} for u in images_for(it, origin)],
                           "variations": [{"name": "Talla", "values": [s]}, {"name": "Color", "values": [it["color"]]}],
                           "sellers": [{"sellerId": "1", "commertialOffer": {"Price": float(it["price"]), "AvailableQuantity": q}}]}
                          for i, ((s, _), q) in enumerate(zip(it["sizes"], quantities(it)))]} for it in chunk]
            return self._json({"products": products, "recordsFiltered": len(items)})
        if url.path == "/vtexlegacy/api/catalog_system/pub/category/tree/3":
            return self._json([{"id": 1, "hasChildren": False, "children": []}, {"id": 2, "hasChildren": False, "children": []}])
        if url.path == "/vtexlegacy/api/catalog_system/pub/products/search":
            frm, to, fq = int(first("_from", "0")), int(first("_to", "49")), first("fq")
            if frm >= WINDOW:
                return self._json({"error": "range not valid"}, 400)
            pool = items
            if fq.startswith("C:"):
                cid = int(fq[2:])
                pool = [it for it in items if (it["id"] % 2 == 0) == (cid == 1)]
            chunk = pool[frm: min(to + 1, WINDOW)]
            products = [{
                "productId": str(it["id"]), "productName": it["title"], "brand": it["vendor"],
                "link": f"{origin}/vtexlegacy/{it['handle']}/p", "linkText": it["handle"], "categories": ["/Ropa/"],
                "description": f"{it['material']} de buena calidad", "Talla": [s for s, _ in it["sizes"]], "Color": [it["color"]],
                "items": [{"itemId": f"{it['id']}-{i}", "Talla": [s], "Color": [it["color"]],
                           "isKit": it["pack"] > 1, "unitMultiplier": float(it["pack"]) if it["pack"] > 1 else 1,
                           "images": [{"imageUrl": u, "imageLabel": "", "imageText": ""} for u in images_for(it, origin)],
                           "sellers": [{"sellerId": "1", "commertialOffer": {"Price": float(it["price"]), "AvailableQuantity": q}}]}
                          for i, ((s, _), q) in enumerate(zip(it["sizes"], quantities(it)))]} for it in chunk]
            return self._json(products)
        self._send("not found", status=404)


def start(port=0):
    """Start the fake store in a background thread. Returns (server, base_url)."""
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}"


def demo_stores(base):
    return [
        {"id": "demo-shopify", "name": "Demo Shopify Store", "base_url": f"{base}/shopify", "platform": "shopify",
         "config": {"max_pages": 5}, "is_active": True},
        {"id": "demo-html", "name": "Demo HTML Store", "base_url": f"{base}/html", "platform": "html",
         "config": {"list_urls": [{"url": f"{base}/html/catalogo?page={{page}}"}], "max_pages": 5,
                    "selectors": {"item": ".card", "name": ".t", "price": ".pr", "link": "a@href",
                                  "image": "img@src", "brand": ".b"}}, "is_active": True},
        {"id": "demo-vtex-io", "name": "Demo VTEX IO Store", "base_url": f"{base}/vtexis", "platform": "vtex_is",
         "config": {}, "is_active": True},
        {"id": "demo-vtex", "name": "Demo VTEX Store", "base_url": f"{base}/vtexlegacy", "platform": "vtex",
         "config": {"window": WINDOW, "page_size": 12}, "is_active": True},
    ]


def run_demo(db_path, settings, port=8000, open_browser=True, wait=True):
    """Fake stores + collection + viewer: a quick way to see everything working."""
    import webbrowser
    from . import db
    from .runner import run_all
    from .viewer.server import start as start_viewer
    server, base = start()
    print(f"Fake store running at {base}")
    settings = {**settings, "delay_seconds": 0.0, "image_delay_seconds": 0.0}
    conn = db.connect(db_path)
    for s in demo_stores(base):
        db.upsert_store(conn, s)
    for r in run_all(conn, settings):
        print(f"  {r['store']}: {r['status']} — {r['saved']} saved of {r['found']}")
    conn.close()
    viewer, url = start_viewer(db_path, settings, port)
    print(f"Viewer running at {url}")
    if open_browser:
        webbrowser.open(url)
    if wait:
        try:
            input("Press Enter to stop the demo… ")
        except (EOFError, KeyboardInterrupt):
            pass
        viewer.shutdown()
        server.shutdown()
    return viewer, server
