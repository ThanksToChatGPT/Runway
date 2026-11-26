"""Tiendas falsas para las pruebas, servidas con `httpx.MockTransport`: no abren sockets ni salen a internet.

Sirven los mismos 36 productos de varias formas (como `demo_store.py` de outfit-scraper-v5):
  /shopify/products.json            formato Shopify (no dice cuántas unidades quedan)
  /html/catalogo?page=N             páginas HTML de listado
  /vtexlegacy/api/catalog_system/…  API clásica de VTEX con ventana pequeña (24 resultados) y categorías
  /vtexis/api/io/_v/…               VTEX Intelligent Search (la API clásica responde 401), ventana y órdenes
  /flaky429/…                       VTEX que responde 429 una vez y luego 206 (el bug que frenaba a Mattelsa)
También sirve /robots.txt, /img/… (imágenes), /private/x (bloqueado por robots), /flaky (falla dos veces y
luego responde) y /shopify/ (inicio con huellas de Shopify). El host `broken.store` simula una caída de red.
"""
import io
import json
import random
from urllib.parse import parse_qs

import httpx

try:
    from PIL import Image, ImageDraw
    HAVE_PIL = True
except ImportError:
    HAVE_PIL = False

BASE = "http://fake.store"
BROKEN = "http://broken.store"
TYPES = [("Camiseta oversize", 59900, "Algodón"), ("Hoodie básico", 129900, "Algodón"),
         ("Camisa de lino", 99900, "Lino"), ("Chaqueta cortavientos", 189900, "Poliéster"),
         ("Jean slim", 149900, "Denim"), ("Pantalón cargo", 159900, "Algodón"),
         ("Short deportivo", 69900, "Poliéster"), ("Tenis urbanos", 249900, ""),
         ("Botas de cuero", 299900, "Cuero"), ("Gorra clásica", 49900, "Algodón"),
         ("Gafas de sol", 89900, ""), ("Mochila urbana", 119900, "Nylon")]
COLORS = ["Negro", "Blanco", "Gris", "Azul", "Verde", "Beige"]
BRANDS = ["Nordic", "Urbana", "Kilimanjaro", "Basic Co"]
WINDOW = 24            # las VTEX falsas solo sirven estos resultados por consulta, como las reales (2500)
PALETTE = [(30, 90, 200), (40, 160, 90), (120, 60, 160), (200, 40, 60), (30, 30, 30)]

# Lo que esperan las pruebas del catálogo de 36 productos: cada 5.º es un pack de 3 (7 packs) y
# 9 son accesorios (gorra, gafas, mochila), 2 de ellos también packs -> 22 prendas sueltas del MVP.
TOTAL, PACKS, NON_GARMENT, SINGLE_GARMENTS = 36, 7, 7, 22


def catalog(n=TOTAL):
    rnd = random.Random(42)
    items = []
    for i in range(n):
        name, price, material = TYPES[i % len(TYPES)]
        color = COLORS[rnd.randrange(len(COLORS))]
        foot = "Tenis" in name or "Botas" in name
        sizes = ["38", "40", "42"] if foot else ["S", "M", "L", "XL"]
        pack = 3 if i % 5 == 4 else 1
        title = f"{name} {color.lower()}" + (" (pack 3)" if pack > 1 else "")
        items.append({"id": 1000 + i, "title": title, "handle": f"item-{1000 + i}",
                      "vendor": BRANDS[rnd.randrange(len(BRANDS))], "price": price + rnd.randrange(0, 5) * 10000,
                      "color": color, "sizes": [(s, rnd.random() > 0.25) for s in sizes],
                      "material": material, "img": i % 12, "pack": pack})
    return items


def quantities(it):
    n, mode = len(it["sizes"]), (it["id"] - 1000) % 4
    return {0: [1] + [0] * (n - 1), 1: [1] * n, 2: [10] * n, 3: [0] * n}[mode]


def svg(n):
    hue = (n * 47) % 360
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" '
            f'fill="hsl({hue},45%,78%)"/></svg>')


def png(kind, n):
    """a = modelo con la prenda, b = la prenda sola sobre blanco, c = primer plano de la tela."""
    rnd = random.Random(n)
    color = PALETTE[n % len(PALETTE)]
    im = Image.new("RGB", (240, 240), (255, 255, 255))
    d = ImageDraw.Draw(im)
    if kind == "b":
        d.rectangle((70, 60, 170, 200), fill=color)
        d.rectangle((40, 60, 70, 110), fill=color)
        d.rectangle((170, 60, 200, 110), fill=color)
    elif kind == "a":
        for x in range(240):
            for y in range(240):
                v = rnd.randrange(-35, 35)
                im.putpixel((x, y), (110 + v, 135 + v, 160 + v))
        d.ellipse((90, 25, 150, 100), fill=(224, 172, 140))
        d.rectangle((80, 100, 160, 210), fill=color)
    else:
        for x in range(0, 240, 12):
            d.rectangle((x, 0, x + 6, 240), fill=color)
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return buf.getvalue()


def images_for(it, origin):
    n = it["id"]
    return [f"{origin}/img/a-{n}.png", f"{origin}/img/c-{n}.png", f"{origin}/img/b-{n}.png"]   # la prenda sola va última


class FakeStore:
    """Manejador de `httpx.MockTransport`. Guarda las rutas pedidas y avanza un reloj falso opcional."""

    def __init__(self, clock=None, latency=0.0):
        self.flaky_hits = 0
        self.requests = []
        self.clock = clock               # FakeClock: cada petición tarda `latency` segundos simulados
        self.latency = latency

    def transport(self):
        return httpx.MockTransport(self.handle)

    def paths(self, prefix=""):
        return [p for p in self.requests if p.startswith(prefix)]

    # ---- respuestas
    @staticmethod
    def _send(body, ctype="text/html; charset=utf-8", status=200, headers=None):
        data = body.encode() if isinstance(body, str) else body
        return httpx.Response(status, content=data, headers={"Content-Type": ctype, **(headers or {})})

    def _json(self, data, status=200):
        return self._send(json.dumps(data), "application/json", status)

    def handle(self, request):
        if self.clock is not None:
            self.clock.advance(self.latency)
        url = request.url
        if url.host == "broken.store":
            raise httpx.ConnectError("connection refused", request=request)
        self.requests.append(url.path)
        qs = parse_qs(url.query.decode())
        first = lambda k, d="": qs.get(k, [d])[0]
        items = catalog()
        origin = f"{url.scheme}://{url.host}"
        path = url.path
        if path == "/robots.txt":
            return self._send("User-agent: *\nDisallow: /private\n", "text/plain")
        if path.startswith("/img/"):
            name = path.split("/")[-1]
            if name.endswith(".png") and HAVE_PIL:
                kind, num = name[:-4].split("-")
                return self._send(png(kind, int(num)), "image/png")
            return self._send(svg(int(name.split(".")[0].split("-")[-1])), "image/svg+xml")
        if path == "/private/x":
            return self._send("secret")
        if path == "/flaky":
            self.flaky_hits += 1
            if self.flaky_hits <= 2:
                return self._send("busy", status=503, headers={"Retry-After": "0"})
            return self._json({"ok": True})
        if path == "/always503":
            return self._send("down", status=503)
        if path == "/forbidden":
            return self._send("no", status=403)
        if path == "/partial":
            return self._json([{"ok": True}], status=206)
        if path == "/shopify/":
            return self._send('<html><head><script src="https://cdn.shopify.com/s/files/theme.js"></script>'
                              '<script>window.Shopify = {};</script></head><body>shop</body></html>')
        if path == "/shopify/products.json":
            page, per = int(first("page", "1")), 18
            chunk = items[(page - 1) * per: page * per]
            products = [{
                "id": it["id"], "title": it["title"], "handle": it["handle"], "vendor": it["vendor"],
                "product_type": "", "tags": ["demo"] + (["pack"] if it["pack"] > 1 else []),
                "body_html": f"<p>{it['material']} de buena calidad</p>",
                "options": [{"name": "Talla", "position": 1}, {"name": "Color", "position": 2}],
                "variants": [{"option1": s, "option2": it["color"], "price": f"{it['price']}.00", "available": ok}
                             for s, ok in it["sizes"]],
                "images": [{"src": f"{origin}/img/{it['img']}.svg?v=1", "alt": ""},
                           {"src": f"{origin}/img/{it['img']}.svg?v=2", "alt": ""}]} for it in chunk]
            return self._json({"products": products})
        if path == "/flaky429/api/catalog_system/pub/products/search":
            self.flaky_hits += 1
            if self.flaky_hits <= 1:
                return self._send("busy", status=429, headers={"Retry-After": "0"})
            chunk = items[0:4]
            products = [{"productId": str(it["id"]), "productName": it["title"], "brand": it["vendor"],
                         "link": f"{origin}/flaky429/{it['handle']}/p", "linkText": it["handle"],
                         "categories": ["/Ropa/"], "description": "", "Talla": [s for s, _ in it["sizes"]],
                         "items": [{"itemId": str(it["id"]), "Talla": [s], "isKit": it["pack"] > 1,
                                    "unitMultiplier": float(it["pack"]) if it["pack"] > 1 else 1,
                                    "images": [{"imageUrl": u, "imageLabel": "", "imageText": ""}
                                               for u in images_for(it, origin)],
                                    "sellers": [{"sellerId": "1", "commertialOffer": {
                                        "Price": float(it["price"]), "AvailableQuantity": 1}}]}
                                   for s, _ in it["sizes"]]} for it in chunk]
            return self._json(products, status=206)
        if path == "/html/catalogo":
            page, per = int(first("page", "1")), 12
            cards = "".join(
                f'<div class="card"><a href="/html/p/{it["id"]}"><img src="/img/{it["img"]}.svg">'
                f'<h3 class="t">{it["title"]}</h3></a><span class="b">{it["vendor"]}</span>'
                f'<span class="pr">$ {it["price"]:,}'.replace(",", ".") + "</span></div>"
                for it in items[(page - 1) * per: page * per])
            return self._send(f"<html><body>{cards}</body></html>")
        if path in ("/vtexis/", "/vtexlegacy/"):
            return self._send('<html><head><script src="https://x.vtexassets.com/_v/public/assets/v1/npm/'
                              'vtex.render-runtime@8/r.js"></script><script>window.__RUNTIME__ = {};</script>'
                              '</head><body>shop</body></html>',
                              headers={"x-vtex-cache": "HIT", "Set-Cookie": "vtex_segment=abc; Path=/"})
        if path == "/vtexis/api/catalog_system/pub/products/search":
            return self._json({"error": "Unauthorized"}, 401)
        if path == "/vtexis/api/io/_v/api/intelligent-search/product_search":
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
                "items": [{"itemId": f"{it['id']}-{i}", "isKit": it["pack"] > 1,
                           "unitMultiplier": float(it["pack"]) if it["pack"] > 1 else 1,
                           "images": [{"imageUrl": u, "imageLabel": "", "imageText": ""} for u in images_for(it, origin)],
                           "variations": [{"name": "Talla", "values": [s]}, {"name": "Color", "values": [it["color"]]}],
                           "sellers": [{"sellerId": "1", "commertialOffer": {"Price": float(it["price"]),
                                                                             "AvailableQuantity": q}}]}
                          for i, ((s, _), q) in enumerate(zip(it["sizes"], quantities(it)))]} for it in chunk]
            return self._json({"products": products, "recordsFiltered": len(items)})
        if path == "/vtexlegacy/api/catalog_system/pub/category/tree/3":
            return self._json([{"id": 1, "hasChildren": False, "children": []},
                               {"id": 2, "hasChildren": False, "children": []}])
        if path == "/vtexlegacy/api/catalog_system/pub/products/search":
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
                "description": f"{it['material']} de buena calidad", "Talla": [s for s, _ in it["sizes"]],
                "Color": [it["color"]],
                "items": [{"itemId": f"{it['id']}-{i}", "Talla": [s], "Color": [it["color"]],
                           "isKit": it["pack"] > 1, "unitMultiplier": float(it["pack"]) if it["pack"] > 1 else 1,
                           "images": [{"imageUrl": u, "imageLabel": "", "imageText": ""} for u in images_for(it, origin)],
                           "sellers": [{"sellerId": "1", "commertialOffer": {"Price": float(it["price"]),
                                                                             "AvailableQuantity": q}}]}
                          for i, ((s, _), q) in enumerate(zip(it["sizes"], quantities(it)))]} for it in chunk]
            return self._json(products)
        return self._send("not found", status=404)


class FakeClock:
    """Reloj simulado: `sleep` avanza el tiempo sin esperar de verdad."""

    def __init__(self, start=1000.0):
        self.now = start
        self.slept = 0.0

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += seconds

    def sleep(self, seconds):
        self.slept += seconds
        self.now += seconds


HTML_CONFIG = {"list_urls": [{"url": f"{BASE}/html/catalogo?page={{page}}"}], "max_pages": 5,
               "selectors": {"item": ".card", "name": ".t", "price": ".pr", "link": "a@href",
                             "image": "img@src", "brand": ".b"}}
