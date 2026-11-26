"""Detecta qué plataforma de e-commerce usa una tienda y cuál de sus APIs públicas responde.

1. Lee robots.txt y la página de inicio con el mismo cliente educado del scraper (nunca intenta saltarse
   un bloqueo o una protección anti-bots).
2. Busca huellas de la plataforma en el HTML, los encabezados y las cookies (como un `grep -i -E`).
3. Prueba la API pública de catálogo de cada plataforma probable (si robots.txt lo permite) y dice cuál sirve.
Si la página de inicio está bloqueada se puede enviar el HTML guardado desde el navegador (`html`).
"""
import re
import threading
import time
from urllib.parse import urlparse

import httpx

from app.extractors import get_extractor
from app.normalizer import classify, detect_pack
from app.polite_http import BudgetExhausted, RobotsDisallowed, ScraperError

FINGERPRINTS = {
    "vtex": [r"vtexassets\.com", r"vtexcommercestable", r"myvtex\.com", r"vtex\.render-runtime", r"__RUNTIME__",
             r"x-vtex[\w-]*", r"vtex_[a-z_]+", r"\bvtex\b"],
    "shopify": [r"cdn\.shopify\.com", r"myshopify\.com", r"window\.Shopify", r"shopify-section", r"x-shopify[\w-]*"],
    "woocommerce": [r"wp-content/plugins/woocommerce", r"woocommerce", r"wp-json"],
    "magento": [r"Magento_[A-Za-z]+", r"mage-cache-storage", r"data-mage-init", r"x-magento[\w-]*"],
    "prestashop": [r"prestashop", r"/modules/ps_"],
    "tiendanube": [r"tiendanube", r"nuvemshop"],
    "salesforce": [r"demandware", r"dwstatic", r"/on/demandware\.store"],
    "nextjs": [r"__NEXT_DATA__", r"/_next/static"],
}
PROTECTION = {"cloudflare": r"cf-ray|__cf_bm|cloudflare", "akamai": r"akamai|_abck|ak_bmsc",
              "perimeterx": r"_px\w*|perimeterx", "datadome": r"datadome", "imperva": r"incap_ses|visid_incap"}
ADAPTER_PLATFORMS = ("shopify", "vtex", "vtex_is")      # plataformas con extractor automático
IS_TRADE_POLICY_PATH = "/api/io/_v/api/intelligent-search/product_search/trade-policy/1"


def _is_list(d):
    return isinstance(d, list) and len(d) > 0


def _has(key):
    return lambda d: isinstance(d, dict) and bool(d.get(key))


# (nombre, plataforma, ruta, parámetros, acepta(json) -> bool)
PROBES = [
    ("Shopify products.json", "shopify", "/products.json", {"limit": 1}, _has("products")),
    ("VTEX legacy catalog API", "vtex", "/api/catalog_system/pub/products/search", {"_from": 0, "_to": 0}, _is_list),
    ("VTEX Intelligent Search", "vtex_is", "/api/io/_v/api/intelligent-search/product_search",
     {"query": "", "page": 1, "count": 1, "locale": "es-CO"}, _has("products")),
    ("VTEX Intelligent Search (trade policy 1)", "vtex_is", IS_TRADE_POLICY_PATH,
     {"query": "", "page": 1, "count": 1, "locale": "es-CO"}, _has("products")),
    ("WooCommerce Store API", "woocommerce", "/wp-json/wc/store/v1/products", {"per_page": 1}, _is_list),
    ("Magento GraphQL", "magento", "/graphql", {"query": "{storeConfig{store_name}}"}, _has("data")),
]


def split_base(url):
    """(origen, base) de una URL de tienda; la base conserva una subruta si la tienda vive bajo una."""
    parts = urlparse(url if "//" in url else "https://" + url)
    origin = f"{parts.scheme}://{parts.netloc}"
    return origin, (origin + parts.path).rstrip("/")


def _context(text, match, width=45):
    a, b = max(0, match.start() - width), min(len(text), match.end() + width)
    return re.sub(r"\s+", " ", text[a:b]).strip()


def grep(text, pattern):
    """(cantidad de coincidencias, contexto de la primera) sin distinguir mayúsculas."""
    matches = list(re.finditer(pattern, text, re.I))
    return len(matches), (_context(text, matches[0]) if matches else "")


def _probe(client, base, name, platform, path, params, accepts):
    probe = {"name": name, "platform": platform, "url": base + path, "status": None, "ok": False, "note": ""}
    # VTEX responde 206 a las consultas por rango y puede responder 429 si llegan varias seguidas: se reintenta
    for attempt in range(3):
        try:
            r = client.fetch_any(base + path, params=params)
        except RobotsDisallowed:
            probe["note"] = "omitida: robots.txt no permite esta ruta"
            return probe
        except httpx.HTTPError as exc:
            probe["note"] = f"error de red: {exc.__class__.__name__}"
            return probe
        probe["status"] = r.status_code
        if r.status_code == 429:
            retry_after = r.headers.get("Retry-After", "")
            wait = max(float(retry_after) if retry_after.isdigit() else 0, client.delay * (2 ** attempt))
            try:
                client.pause(wait)
            except BudgetExhausted:
                break
            continue
        if r.status_code not in (200, 206):
            break
        try:
            probe["ok"] = bool(accepts(r.json()))
            probe["note"] = "JSON utilizable" if probe["ok"] else "JSON sin productos"
        except ValueError:
            probe["note"] = "no es JSON (probablemente una página HTML)"
        return probe
    status = probe["status"]
    if status in (401, 403):
        probe["note"] = "cerrada a peticiones anónimas"
    elif status == 404:
        probe["note"] = "no existe"
    elif status == 429:
        probe["note"] = "límite de peticiones (intenta de nuevo en un momento)"
    elif status is not None:
        probe["note"] = f"respondió HTTP {status}"
    return probe


def _sample(base, platform, config, client, size):
    """Lee unos pocos productos para saber si la tienda vende prendas sueltas o packs y de qué categorías."""
    info = {"read": 0, "packs": 0, "categories": {}}
    try:
        for raw in get_extractor(platform, base, client, config, size).fetch():
            info["read"] += 1
            pack_size, _ = detect_pack(raw.name, raw.category, raw.description,
                                       is_kit=bool(raw.is_kit), unit_multiplier=raw.unit_multiplier)
            if pack_size > 1:
                info["packs"] += 1
            category, _ = classify(raw.name, raw.category)
            info["categories"][category] = info["categories"].get(category, 0) + 1
    except (ScraperError, ValueError) as exc:
        info["error"] = str(exc)
    return info


def detect_platform(base_url, client, html=None, grep_words=(), probe_all=False, stop_at_first=False,
                    sample_size=0):
    """Informe de detección. `platform`/`config` traen la recomendación (o None si no hay extractor posible).

    `stop_at_first=True` (lo usa `/scrape`) solo prueba plataformas con extractor y para en la primera que
    sirve, para gastar el mínimo de peticiones del presupuesto."""
    origin, base = split_base(base_url)
    result = {"base_url": base, "platform": None, "config": {}, "supported": False,
              "robots": {"allowed": None, "error": None}, "home_status": None, "fingerprints": {},
              "evidence": {}, "protection": [], "generator": None, "jsonld": {"blocks": 0, "products": 0},
              "grep": {}, "probes": [], "message": ""}
    header_text = ""

    # ---- robots.txt
    try:
        result["robots"]["allowed"] = client.allowed(base + "/")
    except RobotsDisallowed as exc:
        result["robots"] = {"allowed": False, "error": str(exc)}
    except BudgetExhausted:
        result["timed_out"] = True

    # ---- página de inicio
    if html is None:
        html = ""
        try:
            r = client.fetch_any(base + "/")
        except RobotsDisallowed:
            pass
        except BudgetExhausted:
            result["timed_out"] = True
        except httpx.HTTPError as exc:
            result["home_error"] = exc.__class__.__name__
        else:
            result["home_status"] = r.status_code
            header_text = "\n".join(f"{k}: {v}" for k, v in r.headers.items())
            cookie_names = ", ".join(sorted({c.name for c in client.http.cookies.jar})) or "-"
            header_text += f"\ncookies: {cookie_names}"
            if r.status_code == 200:
                html = r.text

    # ---- huellas (grep)
    text = html + "\n" + header_text
    for platform, patterns in FINGERPRINTS.items():
        found = {}
        for pattern in patterns:
            count, context = grep(text, pattern)
            if count:
                found[pattern] = {"count": count, "context": context}
        if found:
            result["fingerprints"][platform] = len(found)
            result["evidence"][platform] = found
    result["protection"] = [name for name, pat in PROTECTION.items() if re.search(pat, header_text, re.I)]
    gen = re.search(r'<meta[^>]+name=["\']generator["\'][^>]+content=["\']([^"\']+)', html, re.I)
    if gen:
        result["generator"] = gen.group(1)
    result["jsonld"] = {"blocks": len(re.findall(r"application/ld\+json", html, re.I)),
                        "products": len(re.findall(r'"@type"\s*:\s*"Product"', html))}
    for word in grep_words or ():
        result["grep"][word] = grep(text, re.escape(word))[0]

    # ---- APIs públicas: primero las probables por huellas; si ninguna sirve, el resto
    scores = result["fingerprints"]
    likely = set(scores)
    if "vtex" in likely:
        likely.add("vtex_is")          # una tienda VTEX puede dejar abierta solo la API de Intelligent Search
    everything = {p[1] for p in PROBES}
    rounds = [likely, everything - likely] if (likely and not probe_all) else [everything]
    working = []
    try:
        for candidates in rounds:
            for name, platform, path, params, accepts in PROBES:
                if platform not in candidates or (stop_at_first and platform not in ADAPTER_PLATFORMS):
                    continue
                probe = _probe(client, base, name, platform, path, params, accepts)
                result["probes"].append(probe)
                if probe["ok"]:
                    working.append(probe)
                    if stop_at_first:
                        break
            if any(p["platform"] in ADAPTER_PLATFORMS for p in working):
                break
    except BudgetExhausted:
        result["timed_out"] = True

    # ---- veredicto
    pick = next((p for p in working if p["platform"] in ADAPTER_PLATFORMS), None)
    if pick:
        result["platform"] = pick["platform"]
        result["config"] = {"path": IS_TRADE_POLICY_PATH} if "trade-policy" in pick["url"] else {}
        result["supported"] = True
        result["message"] = f"Plataforma detectada: {pick['platform']}."
        if sample_size:
            result["sample"] = _sample(base, pick["platform"], result["config"], client, sample_size)
    elif working:
        result["message"] = (f"La tienda responde la API de {working[0]['platform']}, pero el scraper aún no tiene "
                             "extractor para ella. Usa la plataforma 'html' con selectores.")
    elif result.get("timed_out"):
        result["message"] = "Se acabó el tiempo disponible antes de identificar la plataforma."
    elif result["robots"]["allowed"] is False and not any(p["status"] for p in result["probes"]):
        result["message"] = "robots.txt no permite leer esta tienda; el scraper no intenta saltarse el bloqueo."
    else:
        hint = f" Protección anti-bots: {', '.join(result['protection'])}." if result["protection"] else ""
        result["message"] = ("Ninguna API pública de catálogo respondió. Opciones: usar la plataforma 'html' con "
                             "selectores, revisar el sitemap o pedir a la tienda un feed de datos." + hint)
    return result


class DetectionCache:
    """Recuerda la plataforma detectada de cada tienda para no repetir la detección en cada scraping."""

    def __init__(self, ttl_seconds=6 * 3600, clock=time.monotonic):
        self.ttl = ttl_seconds
        self.clock = clock
        self._data = {}
        self._lock = threading.Lock()

    def get(self, base):
        with self._lock:
            entry = self._data.get(base)
            if entry is None:
                return None
            if self.clock() - entry["at"] > self.ttl:
                del self._data[base]
                return None
            return {"platform": entry["platform"], "config": dict(entry["config"])}

    def put(self, base, platform, config):
        if self.ttl <= 0:
            return
        with self._lock:
            self._data[base] = {"platform": platform, "config": dict(config or {}), "at": self.clock()}

    def invalidate(self, base):
        with self._lock:
            self._data.pop(base, None)

    def clear(self):
        with self._lock:
            self._data.clear()
