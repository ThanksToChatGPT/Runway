"""Elige la mejor imagen de un producto: la prenda sola (sin modelo) si se puede; si no, otra.

Paso 1 (sin descargas): pistas en la URL, el texto alternativo y la etiqueta ("flat", "packshot" vs
"model", "look"...). VTEX nombra "ref-1.jpg" la foto frontal de la prenda sola.
Paso 2 (opcional, necesita Pillow): mira las primeras candidatas. Una prenda fotografiada sola tiene fondo
liso y sin tonos de piel; una foto con modelo tiene tonos de piel. Las imágenes solo se miran en memoria y
se descartan: el servicio devuelve solo sus URLs.
Es una heurística y puede equivocarse. Cada imagen recibe un `kind`: "product-only", "model" u "other".
"""
import io
import re

try:
    from PIL import Image
    HAVE_PIL = True
except ImportError:                      # el scraper sigue funcionando, solo confía en las pistas de texto
    HAVE_PIL = False

MAX_IMAGES = 8
POSITIVE = {"flat", "flatlay", "packshot", "still", "ghost", "cutout", "producto", "product", "solo", "only",
            "frente", "front", "frontal", "ecom", "pack"}
NEGATIVE = {"model", "modelo", "look", "lifestyle", "worn", "outfit", "campaign", "campana", "street",
            "detail", "detalle", "zoom", "back", "espalda", "lateral", "side", "close", "textura", "hover"}


def _canonical(url):
    """La misma foto con otra query (x.jpg?v=1 y x.jpg?v=2) es una sola; /ids/750443/x.jpg y
    /ids/750444/x.jpg con el mismo nombre son tomas distintas."""
    return url.split("?")[0].rstrip("/")


def _tokens(text):
    return set(re.split(r"[^a-z0-9]+", (text or "").lower()))


def meta_score(text):
    tokens = _tokens(text)
    base = 2 * len(tokens & POSITIVE) - 2 * len(tokens & NEGATIVE)
    # VTEX: "ref-1.jpg" (frente), "ref-2.jpg" (detalle), "ref-3.jpg" (espalda): el 1 es la prenda sola
    m = re.search(r"/(\d+)-(\d+)\.(?:jpe?g|png|webp)(?:[?#]|$)", (text or "").lower())
    if m:
        n = int(m.group(2))
        base += 3 if n == 1 else (-1 if n in (2, 4) else 0)
    return base


def analyze(data):
    """{'bg_uniform', 'bg_light', 'skin'} para los bytes de una imagen, o None si no se puede leer."""
    if not HAVE_PIL or not data:
        return None
    try:
        im = Image.open(io.BytesIO(data))
        im.draft("RGB", (256, 256))
        im = im.convert("RGB")
        im.thumbnail((96, 96), Image.NEAREST)     # sin suavizado: mezclar una prenda roja con blanco crea falsa 'piel'
    except Exception:
        return None
    w, h = im.size
    if w < 4 or h < 4:
        return None
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
    """Una prenda color piel (beige) llena la foto de píxeles 'piel': una proporción muy alta no es un modelo."""
    if info is None:
        return "", 0.0
    if 0.06 <= info["skin"] <= 0.45:
        return "model", -6.0
    if info["bg_uniform"] >= 0.80:
        return "product-only", 6.0 + (1.0 if info["bg_light"] else 0.0)
    return "other", 0.0


def pick_images(urls, meta=None, fetch_bytes=None, max_candidates=3):
    """(URLs en orden con la mejor primero, {url: kind}). Deduplica y deja máximo 8 fotos.
    `fetch_bytes(url)` devuelve los bytes de una imagen o None; sin él solo se usan las pistas."""
    meta = meta or {}
    deduped = {}
    for u in urls:
        if u:
            deduped.setdefault(_canonical(u), u)                  # x.jpg?v=1 y x.jpg?v=2 son la misma foto
    urls = list(deduped.values())
    if len(urls) <= 1:
        return urls, {}
    # la URL completa: el número de "ref-1.jpg" va antes de la parte ?v=
    hints = {u: meta_score(f"{meta.get(u, '') or meta.get(_canonical(u), '')} {u}") for u in urls}
    order = sorted(range(len(urls)), key=lambda i: (-hints[urls[i]], i))
    kinds, total = {}, {}
    decisive = any(hints[u] >= 2 for u in urls)     # si la URL ya dice cuál es la prenda sola, no se descarga nada
    for rank, i in enumerate(order):
        u = urls[i]
        kind, visual = "", 0.0
        if fetch_bytes and HAVE_PIL and rank < max_candidates and not decisive:
            data = fetch_bytes(u)
            kind, visual = classify(analyze(data)) if data else ("", 0.0)
        if not kind:
            if hints[u] <= -2:
                kind = "other"
            elif hints[u] >= 2:
                kind = "product-only"          # la URL/etiqueta lo dice: foto frontal de la prenda sola
                visual = max(visual, 6.0)      # una pista fuerte la protege cuando no se pudieron leer los píxeles
        kinds[u] = kind
        total[u] = hints[u] + visual - 0.05 * i          # un bono mínimo al orden original desempata
    best = max(urls, key=lambda u: total[u])
    ordered = ([best] + [u for u in urls if u != best])[:MAX_IMAGES]
    return ordered, {u: k for u, k in kinds.items() if k and u in ordered}
