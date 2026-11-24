"""`detect`: find out which e-commerce platform a store uses and which of its public APIs answer.

1. Reads robots.txt and the home page politely (same client as the scraper; it never tries to get around blocks).
2. Searches the HTML and the response headers for platform fingerprints (like `grep -o -i -E`), plus any word you pass with --grep.
3. Tries the public catalog API of every platform that looks likely (robots.txt permitting) and says which one works.
4. Prints a ready-to-paste entry for stores.json.
If the home page is blocked, save it from your browser (Ctrl+S) and use --html FILE to analyse that file instead.
"""
import json
import re
import time
from pathlib import Path
from urllib.parse import urlparse

import requests

from .adapters import get_adapter
from .polite_http import RobotsDisallowed, make_client_from

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


def _context(text, match, width=45):
    a, b = max(0, match.start() - width), min(len(text), match.end() + width)
    return re.sub(r"\s+", " ", text[a:b]).strip()


def grep(text, pattern, label=None, show=1, out=print):
    matches = list(re.finditer(pattern, text, re.I))
    if matches:
        out(f"    {len(matches):>3} x  {label or pattern}   e.g. …{_context(text, matches[0])}…")
    return len(matches)


# (probe name, platform, path, params, accepts(json) -> bool)
def _is_list(d): return isinstance(d, list) and len(d) > 0
def _has(key): return lambda d: isinstance(d, dict) and bool(d.get(key))


PROBES = [
    ("Shopify products.json", "shopify", "/products.json", {"limit": 1}, _has("products")),
    ("VTEX legacy catalog API", "vtex", "/api/catalog_system/pub/products/search", {"_from": 0, "_to": 0}, _is_list),
    ("VTEX Intelligent Search", "vtex_is", "/api/io/_v/api/intelligent-search/product_search",
     {"query": "", "page": 1, "count": 1, "locale": "es-CO"}, _has("products")),
    ("VTEX Intelligent Search (trade policy 1)", "vtex_is", "/api/io/_v/api/intelligent-search/product_search/trade-policy/1",
     {"query": "", "page": 1, "count": 1, "locale": "es-CO"}, _has("products")),
    ("WooCommerce Store API", "woocommerce", "/wp-json/wc/store/v1/products", {"per_page": 1}, _is_list),
    ("Magento GraphQL", "magento", "/graphql", {"query": "{storeConfig{store_name}}"}, _has("data")),
]


def _stock_sample(entry, client, out, size=20):
    """Reads a few products to learn whether the store sells single garments or packs/kits."""
    info = {"sample": 0, "packs": None}
    try:
        from .normalizer import detect_pack
        packs = {"sample": 0, "count": 0}
        for raw in get_adapter(entry, client, size).fetch():
            info["sample"] += 1
            packs["sample"] += 1
            pack_size, _ = detect_pack(raw.name, raw.category, raw.description,
                                       is_kit=bool(raw.is_kit), unit_multiplier=raw.unit_multiplier)
            if (pack_size or 1) > 1:
                packs["count"] += 1
        info["packs"] = packs if packs["sample"] else None
    except Exception as exc:
        out(f"   (could not read a sample of products: {exc})")
        return info
    if info["sample"] == 0:
        out("   Sample: no products came back.")
        return info
    if info["packs"]:
        out(f"   Garments: {info['packs']['count']} of {info['packs']['sample']} sample products look like "
            f"packs/kits (several pieces sold together); the rest are single garments.")
    return info


def grep_html(source, words, settings, out=print):
    """Search keywords in a saved HTML file or in the home page of a URL (read politely). Returns {word: count}."""
    if Path(source).is_file():
        text = Path(source).read_text(encoding="utf-8", errors="ignore")
        out(f"Searching in file {source} ({len(text):,} characters)")
    else:
        client = make_client_from(settings)
        url = source if "//" in source else "https://" + source
        try:
            r = client.fetch_any(url)
        except (RobotsDisallowed, requests.RequestException) as exc:
            out(f"Could not read {url}: {exc}")
            return {}
        if r.status_code != 200:
            out(f"The page answered HTTP {r.status_code}. Save it from your browser (Ctrl+S) and search that file instead.")
            return {}
        text = r.text
        out(f"Searching in {url} ({len(text):,} characters)")
    counts = {}
    for word in words:
        counts[word] = grep(text, re.escape(word), out=out)
        if not counts[word]:
            out(f"      0 x  {word}")
    return counts


def detect(url, settings, html_path=None, extra_grep=(), probe_all=False, save=True, out=print, snippet=True):
    parts = urlparse(url if "//" in url else "https://" + url)
    origin = f"{parts.scheme}://{parts.netloc}"
    base = (origin + parts.path).rstrip("/")          # keeps a sub-path if the store lives under one
    host = parts.netloc
    client = make_client_from(settings)
    result = {"base_url": base, "platforms": {}, "probes": [], "recommended": None, "home_status": None}
    html, header_text = "", ""

    out(f"== Detecting platform of {base}")
    # ---- robots.txt
    try:
        r = client.fetch_any(origin + "/robots.txt")
        out(f"  robots.txt: HTTP {r.status_code}")
        if r.status_code == 200:
            rules = [l.strip() for l in r.text.splitlines() if re.match(r"(?i)\s*(disallow|sitemap)", l)]
            out("    " + ("\n    ".join(rules[:12]) if rules else "(no Disallow or Sitemap lines)"))
    except (requests.RequestException, RobotsDisallowed) as exc:
        out(f"  robots.txt: could not read ({exc})")

    # ---- home page
    if html_path:
        html = Path(html_path).read_text(encoding="utf-8", errors="ignore")
        out(f"  Home page: read from file {html_path} ({len(html):,} characters)")
    else:
        try:
            r = client.fetch_any(base + "/")
        except RobotsDisallowed as exc:
            out(f"  Home page: not requested — {exc}")
        except requests.RequestException as exc:
            out(f"  Home page: request failed — {exc}")
        else:
            result["home_status"] = r.status_code
            header_text = "\n".join(f"{k}: {v}" for k, v in r.headers.items())
            cookie_names = ", ".join(sorted({c.name for c in client.session.cookies})) or "-"
            header_text += f"\ncookies: {cookie_names}"
            out(f"  Home page: HTTP {r.status_code}, {len(r.text):,} characters, server={r.headers.get('server', '-')}")
            if r.status_code == 200:
                html = r.text
                if save:
                    name = f"detect_{host.replace(':', '_')}.html"
                    Path(name).write_text(html, encoding="utf-8")
                    out(f"  Saved the HTML as {name} (you can also open it with grep / findstr)")
            else:
                out("  The store refused this request (it may use bot protection). I will not try to get around it.\n"
                    "  Save the page from your browser (Ctrl+S) and run again with --html FILE.")

    # ---- fingerprints (grep)
    text = html + "\n" + header_text
    scores = {}
    out("\n  Platform fingerprints found:")
    for platform, patterns in FINGERPRINTS.items():
        n = sum(1 for pat in patterns if re.search(pat, text, re.I))
        if n:
            scores[platform] = n
            out(f"   [{platform}]  {n}/{len(patterns)} signatures")
            for pat in patterns:
                grep(text, pat, out=out)
    if not scores:
        out("   (none)")
    prot = [name for name, pat in PROTECTION.items() if re.search(pat, header_text, re.I)]
    if prot:
        out(f"\n  Bot protection hints in the headers/cookies: {', '.join(prot)}")
    gen = re.search(r'<meta[^>]+name=["\']generator["\'][^>]+content=["\']([^"\']+)', html, re.I)
    if gen:
        out(f"  <meta generator>: {gen.group(1)}")
    jsonld = len(re.findall(r'application/ld\+json', html, re.I))
    if jsonld:
        prod = len(re.findall(r'"@type"\s*:\s*"Product"', html))
        out(f"  JSON-LD blocks: {jsonld} ({prod} with @type Product) — useful for the html adapter")
    if extra_grep:
        out("\n  Your keywords:")
        for word in extra_grep:
            if not grep(text, re.escape(word), out=out):
                out(f"      0 x  {word}")
    result["platforms"] = scores

    # ---- probe the public APIs
    out("\n  Testing public catalog APIs:")
    likely = set(scores) | ({"shopify", "vtex", "vtex_is", "woocommerce", "magento"} if (probe_all or not scores) else set())
    if "vtex" in likely:
        likely.add("vtex_is")          # a VTEX store may keep only the Intelligent Search API open
    working = []
    for name, platform, path, params, accepts in PROBES:
        if platform not in likely:
            continue
        probe = {"name": name, "platform": platform, "url": base + path, "status": None, "ok": False, "note": ""}
        r = None
        # VTEX answers 206 (partial content) when asked for a range of products, and may answer
        # 429 (too many requests) when several probes arrive together: both are worth retrying.
        for attempt in range(3):
            try:
                r = client.fetch_any(base + path, params=params)
            except RobotsDisallowed:
                probe["note"] = "skipped: robots.txt does not allow this path"
                break
            except requests.RequestException as exc:
                probe["note"] = f"network error: {exc}"
                break
            probe["status"] = r.status_code
            if r.status_code not in (200, 206, 429):
                break
            if r.status_code == 429:
                time.sleep(2.0 + attempt)             # backoff, then probe again
                continue
            try:
                probe["ok"] = bool(accepts(r.json()))
                probe["note"] = "usable JSON" if probe["ok"] else "JSON but without products"
            except ValueError:
                probe["note"] = "not JSON (probably an HTML page)"
            break
        if probe["status"] is None and not probe["note"]:
            probe["note"] = "could not reach the API"
        if r is not None and probe["status"] is not None and not probe["ok"]:
            if probe["status"] in (401, 403):
                probe["note"] = "closed to anonymous requests"
            elif probe["status"] == 404:
                probe["note"] = "does not exist"
            elif probe["status"] == 429 and not probe["ok"]:
                probe["note"] = "rate limited (try again in a moment)"
        result["probes"].append(probe)
        mark = "OK " if probe["ok"] else "-- "
        out(f"   {mark}{name:42} HTTP {probe['status'] or '-'}  {probe['note']}")
        if probe["ok"]:
            working.append(probe)

    # ---- verdict
    out("\n  Verdict:")
    adapters = {"shopify", "vtex", "vtex_is"}
    pick = next((p for p in working if p["platform"] in adapters), None)
    if pick:
        extra = {}
        if "trade-policy" in pick["url"]:
            extra = {"path": "/api/io/_v/api/intelligent-search/product_search/trade-policy/1"}
        entry = {"id": re.sub(r"\W+", "-", host.replace("www.", "")).strip("-"), "name": host.replace("www.", ""),
                 "base_url": base, "platform": pick["platform"], "config": extra, "is_active": True}
        result["recommended"] = entry
        result["stock"] = _stock_sample(entry, client, out)
        if snippet:
            out(f"   Use platform \"{pick['platform']}\". Paste this inside \"stores\" in stores.json (remember the comma between stores):")
            out("   " + json.dumps(entry, indent=2).replace("\n", "\n   "))
            out(f"   Then test it:  python -m outfit_scraper check {entry['id']}")
        else:
            out(f"   Platform detected: \"{pick['platform']}\". This store can be added.")
    elif working:
        out(f"   The store answers the {working[0]['platform']} API, but this project has no adapter for it yet.")
        out("   Send this report to get one, or use the html adapter (selectors) or JSON-LD.")
    else:
        out("   No public catalog API answered. Options: (1) read the list pages with the html adapter (selectors),\n"
            "   (2) check the sitemap for product URLs, (3) ask the store for an API or a data feed.\n"
            "   Please share this report so we can choose.")
    return result
