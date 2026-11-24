"""Chooses the best image of a product: the garment alone (no model) if possible, otherwise another one.

Step 1 (no downloads): hints in the image URL, alt text and label ("flat", "packshot" vs "model", "look"...).
Step 2 (needs Pillow): looks at the first few candidates. A garment photographed alone has a plain
background and no skin tones; a model photo has skin tones. The images are only looked at in memory and
thrown away: the database keeps only their URLs.
This is a heuristic, so it can be wrong. Every image gets a `kind`: "product-only", "model" or "other".
"""
import io
import re
from urllib.parse import urlparse

try:
    from PIL import Image
    HAVE_PIL = True
except ImportError:                      # the scraper still works, it just trusts the metadata hints
    HAVE_PIL = False

POSITIVE = {"flat", "flatlay", "packshot", "still", "ghost", "cutout", "producto", "product", "solo", "only",
            "frente", "front", "frontal", "ecom", "pack"}
NEGATIVE = {"model", "modelo", "look", "lifestyle", "worn", "outfit", "campaign", "campana", "street",
            "detail", "detalle", "zoom", "back", "espalda", "lateral", "side", "close", "textura", "hover"}


def _canonical(url):
    """Same photo, different VTEX id path or query: /ids/750443/x.jpg and /ids/750444/x.jpg
    with the same file name are different shots, but x.jpg?v=1 and x.jpg?v=2 are the same one."""
    return url.split("?")[0].rstrip("/")


def _tokens(text):
    return set(re.split(r"[^a-z0-9]+", (text or "").lower()))


def meta_score(text):
    tokens = _tokens(text)
    base = 2 * len(tokens & POSITIVE) - 2 * len(tokens & NEGATIVE)
    # VTEX image files follow "ref-1.jpg" (front), "ref-2.jpg" (detail), "ref-3.jpg" (back):
    # the first number after the reference is the front shot of the garment alone.
    m = re.search(r"/(\d+)-(\d+)\.(?:jpe?g|png|webp)(?:[?#]|$)", (text or "").lower())
    if m:
        n = int(m.group(2))
        base += 3 if n == 1 else (-1 if n in (2, 4) else 0)
    return base


def analyze(data):
    """Returns {'bg_uniform', 'bg_light', 'skin'} for the bytes of an image, or None if it cannot be read."""
    if not HAVE_PIL:
        return None
    try:
        im = Image.open(io.BytesIO(data))
        im.draft("RGB", (256, 256))
        im = im.convert("RGB")
        im.thumbnail((96, 96), Image.NEAREST)     # no smoothing: blending a red garment with white makes fake 'skin' pixels
    except Exception:
        return None
    w, h = im.size
    px = im.load()
    t = max(2, int(0.07 * min(w, h)))
    border = [px[x, y] for x in range(w) for y in range(h) if x < t or x >= w - t or y < t or y >= h - t]
    med = [sorted(c[i] for c in border)[len(border) // 2] for i in range(3)]
    close = sum(1 for c in border if sum(abs(c[i] - med[i]) for i in range(3)) < 45)
    bg_uniform = close / len(border)
    bg_light = (0.299 * med[0] + 0.587 * med[1] + 0.114 * med[2]) > 200
    x0, x1, y0, y1 = int(0.2 * w), int(0.8 * w), int(0.1 * h), int(0.9 * h)
    total = skin = 0
    for x in range(x0, x1):
        for y in range(y0, y1):
            r, g, b = px[x, y]
            yy = 0.299 * r + 0.587 * g + 0.114 * b
            cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
            cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
            total += 1
            if 77 <= cb <= 127 and 133 <= cr <= 173 and yy > 50:
                skin += 1
    return {"bg_uniform": bg_uniform, "bg_light": bg_light, "skin": skin / max(total, 1)}


def classify(info):
    """A garment of a skin-like color (beige) fills the picture with 'skin' pixels, so a very high ratio is not a model."""
    if info is None:
        return "", 0.0
    if 0.06 <= info["skin"] <= 0.45:
        return "model", -6.0
    if info["bg_uniform"] >= 0.80:
        return "product-only", 6.0 + (1.0 if info["bg_light"] else 0.0)
    return "other", 0.0


def pick_images(urls, meta=None, fetch_bytes=None, max_candidates=3):
    """Returns (urls in display order with the best one first, {url: kind}).
    `fetch_bytes(url)` returns the bytes of an image or None; without it only the hints are used."""
    meta = meta or {}
    urls = list({_canonical(u): u for u in urls if u}.values())   # x.jpg?v=1 and x.jpg?v=2 are the same photo
    if len(urls) <= 1:
        return urls, {}
    hints = {u: meta_score(f"{meta.get(u, '')} {u}") for u in urls}   # the full URL: the "ref-1.jpg" number sits before the ?v= part
    order = sorted(range(len(urls)), key=lambda i: (-hints[urls[i]], i))
    kinds, total = {}, {}
    decisive = any(hints[u] >= 2 for u in urls)     # "ref-1.jpg" already says which photo is the garment alone:
    for rank, i in enumerate(order):                # no need to download pixels, the whole catalog gets much faster
        u = urls[i]
        kind, visual = "", 0.0
        if fetch_bytes and HAVE_PIL and rank < max_candidates and not decisive:
            data = fetch_bytes(u)
            kind, visual = classify(analyze(data)) if data else ("", 0.0)
        if not kind:
            if hints[u] <= -2:
                kind = "other"
            elif hints[u] >= 2:
                kind = "product-only"          # the URL/label itself says it: front shot of the garment alone
                visual = max(visual, 6.0)      # a strong hint also protects it when the pixels could not be read
        kinds[u] = kind
        total[u] = hints[u] + visual - 0.05 * i          # a tiny bonus to the original order breaks ties
    best = max(urls, key=lambda u: total[u])
    # keep at most 8 photos of one product: the viewer carousel stays useful and the URLs stay light
    ordered = [best] + [u for u in urls if u != best]
    return ordered[:8], {u: k for u, k in kinds.items() if k and u in ordered[:8]}
